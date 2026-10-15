import { createServer, request } from 'node:http'
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import { userInfo } from 'node:os'

const proofs=new WeakMap()
export function ingressProof(proof,session,taskId) {
  const record=proofs.get(proof)
  if(!record || record.session!==session || record.taskId!==taskId || record.expiresAt<=Date.now())throw new Error('Missing authenticated host ingress proof')
  return {...record,payload:structuredClone(record.payload)}
}

/** A private loopback operator channel, not a fabricated DSH RPC API. Token
 * stays in host memory, outside all tools/Skill/output files. Only a real TTY
 * can enroll an operator; component clients are separately tagged. No endpoint
 * dispatches models or tools. Real billing remains independently gated.
 */
export async function createIngress({session,taskId,onAuthenticated,componentTest=false}) {
  if(!session?.id||!taskId||typeof onAuthenticated!=='function')throw new Error('Explicit live host session binding required')
  const token=randomBytes(32).toString('hex'),expiresAt=Date.now()+300000
  const principalHash=createHash('sha256').update(JSON.stringify(userInfo())).digest('hex')
  const origin=componentTest?'component-test':process.stdin.isTTY&&process.stdout.isTTY?'operator':'operator-not-enrolled'
  const seen=new Set(),audit=[]
  const server=createServer(async(req,res)=>{
    const reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body))}
    try {
      const supplied=req.headers.authorization
      const actual=typeof supplied==='string'&&supplied.startsWith('Bearer ')?supplied.slice(7):''
      const known=Buffer.from(token),given=Buffer.from(actual)
      if(req.socket.remoteAddress!=='127.0.0.1'||req.method!=='POST'||req.url!=='/operator'||given.length!==known.length||!timingSafeEqual(given,known)||Date.now()>=expiresAt||origin==='operator-not-enrolled') {
        audit.push({type:'denied',reason:'authentication_or_transport',source:'actual loopback request'});reply(403,{status:'BLOCKED'});return
      }
      const chunks=[];let bytes=0
      for await(const chunk of req){bytes+=chunk.length;if(bytes>32768)throw new Error('Bounded operator message required');chunks.push(chunk)}
      const message=JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if(message.sessionId!==session.id||message.taskId!==taskId||!message.requestId||seen.has(message.requestId)||!['message','budget','confirm','revoke'].includes(message.action))throw new Error('Session/task/action/replay mismatch')
      seen.add(message.requestId)
      const proof=Object.freeze({})
      proofs.set(proof,{session,taskId,requestId:message.requestId,action:message.action,payload:structuredClone(message.payload),origin,principalHash,expiresAt})
      const result=await onAuthenticated(message,proof)
      audit.push({type:'authenticated',action:message.action,requestId:message.requestId,origin,principalHash,source:'actual loopback request'})
      reply(200,{status:'HOST_INPUT_ACCEPTED',result})
    }catch(error){audit.push({type:'denied',reason:error.message,source:'actual loopback request'});reply(400,{status:'BLOCKED',reason:error.message})}
  })
  await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes)})
  const port=server.address().port
  // An operator receives the credential only on the interactive host console.
  // It is never printed in this task's redirected/noninteractive probes.
  if(origin==='operator')process.stdout.write(`Private operator endpoint http://127.0.0.1:${port}/operator\nBearer ${token}\n`)
  const send=(message,credential)=>new Promise((yes,no)=>{
    const body=JSON.stringify(message)
    const req=request({host:'127.0.0.1',port,path:'/operator',method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{
      const data=[];res.on('data',c=>data.push(c));res.on('end',()=>yes({httpStatus:res.statusCode,body:JSON.parse(Buffer.concat(data).toString('utf8'))}))
    });req.on('error',no);req.end(body)
  })
  return Object.freeze({address:`http://127.0.0.1:${port}/operator`,operatorEnrolled:origin==='operator',
    requestUntrusted:message=>send(message,'untrusted'),
    requestForComponentTest:message=>{if(!componentTest)throw new Error('Test signer not available in production');return send(message,token)},
    audit:()=>structuredClone(audit),close:()=>new Promise((yes,no)=>server.close(error=>error?no(error):yes()))})
}
