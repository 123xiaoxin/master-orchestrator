import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, symlink, link } from 'node:fs/promises'
import { join } from 'node:path'
import { BudgetLedger } from '../adapters/dsh-session/budget.mjs'
import { HostAuthority } from '../adapters/dsh-session/authority.mjs'
import { IsolatedFiles } from '../adapters/dsh-session/file-tools.mjs'
import { ContractRouter } from '../adapters/dsh-session/router.mjs'
import { createIngress, ingressProof } from '../adapters/dsh-session/ingress.mjs'
import { ROOT, setupCase } from '../adapters/dsh-runtime/mock-workflow.mjs'
import { contractHash } from '../adapters/dsh-v2.1/adapter.mjs'

const base=await mkdtemp(join(ROOT,'.local/session-tests-'))
const config={maxCalls:10,maxSessions:2,maxSteps:10,maxInputTokens:100,maxOutputTokens:100,maxCostMicros:'200',maxRuntimeMs:60000,
  price:{currency:'TEST',inputMicrosPerToken:'1',outputMicrosPerToken:'1',approvedConservativeUpperBound:true}}
const budget=override=>{const b=new BudgetLedger({...config,...override},{authorize:()=>true});b.openSession('s');return b}
const reserve=(b,input=10,output=10)=>b.reserve({sessionId:'s',inputUpperBound:input,outputUpperBound:output})
let index=0
async function authorityCase(){
  const c=await setupCase(base,`a-${++index}`)
  let now=1000
  const a=new HostAuthority({mode:'component-test',clock:()=>now})
  const session={id:'native-shaped-test-session'}
  const channel=a.registerSession(session,'t')
  const confirmation={...c.confirmation,taskId:'t'}
  const grant=a.confirm(channel,{requestId:'r',master:c.master,confirmation,expiresAt:2000})
  return {...c,a,session,channel,confirmation,grant,expire:()=>{now=2001}}
}
test('budget defaults fail closed with no real authorization',()=>{
  const b=new BudgetLedger(config)
  assert.throws(()=>b.openSession('s'),/authorization/)
  assert.equal(b.allowTool().allowed,false)
  assert.equal(b.snapshot().calls,0)
})
for(const key of ['maxCalls','maxSessions','maxSteps','maxInputTokens','maxOutputTokens','maxRuntimeMs','maxCostMicros','price'])
  test(`missing approved ${key} blocks request`,()=>{
    const input=structuredClone(config);delete input[key]
    const b=new BudgetLedger(input,{authorize:()=>true})
    assert.throws(()=>b.openSession('s'))
  })
test('per-request maxTokens alone is not a cumulative budget',()=>{
  const b=new BudgetLedger({maxTokens:100},{authorize:()=>true})
  assert.throws(()=>b.openSession('s'),/maxCalls/)
})
test('unknown price or currency cannot be treated as known cost',()=>{
  const b=new BudgetLedger({...config,price:{currency:'TEST',inputMicrosPerToken:'0.2',outputMicrosPerToken:'1'}},{authorize:()=>true})
  assert.throws(()=>b.openSession('s'),/price/)
})
test('input/output/cache usage is counted conservatively across calls',()=>{
  const b=budget();let r=reserve(b);b.settle(r,{inputTokens:3,cacheReadTokens:2,cacheWriteTokens:1,outputTokens:4,totalTokens:10})
  r=reserve(b);b.settle(r,{inputTokens:2,outputTokens:1,totalTokens:3})
  const s=b.snapshot();assert.equal(s.observedInputTokens,8);assert.equal(s.observedOutputTokens,5);assert.equal(s.chargedCostUpperBoundMicros,'13');assert.equal(s.actualBilledCost,null)
})
for(const [name,override,input,output] of [['input cap',{maxInputTokens:5},6,1],['output cap',{maxOutputTokens:5},1,6],['cost cap',{maxCostMicros:'5'},3,3]])
  test(`reservation blocks insufficient ${name}`,()=>{const b=budget(override);assert.throws(()=>reserve(b,input,output),/limit/);assert.equal(b.snapshot().calls,0);assert.equal(b.allowTool().allowed,false)})
test('concurrent reservations cannot each spend the same headroom',async()=>{
  const b=budget({maxInputTokens:10,maxOutputTokens:10})
  const attempts=await Promise.allSettled([1,2].map(()=>Promise.resolve().then(()=>reserve(b,6,6))))
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(b.snapshot().reservedInput,6)
  const receipt=attempts.find(r=>r.status==='fulfilled').value;b.settle(receipt,{inputTokens:2,outputTokens:2})
  assert.equal(b.snapshot().observedInputTokens,2);assert.equal(b.allowTool().allowed,false)
})
test('at cumulative limit model and tool admission stops, evidence retained',()=>{
  const b=budget({maxCalls:1});const r=reserve(b);b.settle(r,{inputTokens:2,outputTokens:2})
  assert.throws(()=>reserve(b));assert.equal(b.allowTool().allowed,false)
  assert.equal(b.snapshot().calls,1);assert.equal(b.snapshot().observedInputTokens,2)
})
test('session cap and step cap are host enforced',()=>{
  const b=budget({maxSessions:1,maxSteps:1});b.step('s');assert.equal(b.allowTool().allowed,false)
  const c=budget({maxSessions:1});assert.throws(()=>c.openSession('second'),/session_limit/)
})
test('unknown/error usage keeps upper reservation and stops, never invents zero',()=>{
  const b=budget();const r=reserve(b);b.settle(r,null)
  assert.equal(b.snapshot().observedInputTokens,null);assert.equal(b.snapshot().chargedInputUpperBound,10);assert.equal(b.snapshot().stopped,'usage_unverifiable')
})
test('provider exceeding reserved bound and inconsistent total fail closed',()=>{
  const b=budget();const r=reserve(b);b.settle(r,{inputTokens:11,outputTokens:1})
  assert.equal(b.snapshot().stopped,'provider_exceeded_reserved_bound')
  assert.equal(b.snapshot().observedInputTokens,11)
  assert.equal(b.snapshot().observedOutputTokens,1)
  const c=budget();const q=reserve(c);c.settle(q,{inputTokens:1,outputTokens:1,totalTokens:999})
  assert.equal(c.snapshot().stopped,'usage_unverifiable')
})
test('reservation cannot be fabricated, duplicated or refunded twice',()=>{
  const b=budget(),r=reserve(b);assert.throws(()=>b.settle({},null),/Unknown/)
  b.settle(r,{inputTokens:1,outputTokens:1});assert.throws(()=>b.settle(r,null),/settled/)
})
test('runtime deadline stops admissions and aborts active work',async()=>{
  const b=budget({maxRuntimeMs:10});await new Promise(r=>setTimeout(r,25))
  assert.equal(b.signal.aborted,true);assert.equal(b.allowTool().allowed,false);assert.equal(b.snapshot().stopped,'runtime_limit')
})
test('ordinary JSON cannot authenticate a host channel or grant',async()=>{
  const c=await authorityCase()
  assert.throws(()=>c.a.confirm({trusted:true},{requestId:'x',master:c.master,confirmation:c.confirmation,expiresAt:2000}),/Unauthenticated/)
  assert.equal(c.a.live({trusted:true},c.session,c.master),false)
})
test('production external-user ingress remains closed, including real-looking JSON',async()=>{
  const c=await authorityCase(),a=new HostAuthority(),channel=a.registerSession(c.session,'t')
  assert.throws(()=>a.confirm(channel,{requestId:'x',master:c.master,confirmation:c.confirmation,expiresAt:Date.now()+1000}),/unverified/)
  assert.equal(a.realIngressVerified,false)
})
test('model/tool messages and copied controller events cannot become host channels',async()=>{
  const c=await authorityCase()
  for(const fake of [{source:{kind:'user'}},{source:{kind:'model'}},{source:{kind:'tool'}},JSON.parse(JSON.stringify(c.channel))])
    assert.throws(()=>c.a.confirm(fake,{requestId:'x',master:c.master,confirmation:c.confirmation,expiresAt:2000}),/Unauthenticated/)
})
test('authorization expires and revokes immediately',async()=>{
  const c=await authorityCase();assert.equal(c.a.live(c.grant,c.session,c.master),true)
  c.expire();assert.equal(c.a.live(c.grant,c.session,c.master),false)
  const d=await authorityCase();d.a.revoke(d.channel);assert.equal(d.a.live(d.grant,d.session,d.master),false)
})
test('same goal/scope/criteria reuses grant and rebinds exact contract hash',async()=>{
  const c=await authorityCase(),m=structuredClone(c.master);m.nextAction='Same scope next operation'
  assert.equal(c.a.live(c.grant,c.session,m),true)
  assert.equal(c.a.projection(c.grant,c.session,m).authorization.contractSha256,contractHash(m))
  m.executionContract.allowedActions.push('write:outside.txt');assert.equal(c.a.live(c.grant,c.session,m),false)
})
test('wrong task/session/scope/replay and session teardown refuse authority',async()=>{
  const c=await authorityCase();assert.equal(c.a.live(c.grant,{id:c.session.id},c.master),false)
  const changed=structuredClone(c.confirmation);changed.taskId='other'
  assert.throws(()=>c.a.confirm(c.channel,{requestId:'new',master:c.master,confirmation:changed,expiresAt:2000}),/mismatch/)
  assert.throws(()=>c.a.confirm(c.channel,{requestId:'r',master:c.master,confirmation:c.confirmation,expiresAt:2000}),/Replayed/)
  c.a.close(c.channel);assert.equal(c.a.live(c.grant,c.session,c.master),false)
})
test('router refuses no authorization and READY JSON cannot authorize it',async()=>{
  const c=await authorityCase();const router=new ContractRouter({authority:c.a,session:c.session,taskId:'t',workspace:c.workspace})
  assert.equal(router.checkWrite('hello.txt').allowed,false)
  await assert.rejects(router.consume({master:c.master,agentRecord:c.agentRecord,grant:{status:'READY'},evidenceDirectory:join(c.directory,'router')}),/authorization/)
})
test('router connects unchanged Adapter and native checks, revocation blocks reuse',async()=>{
  const c=await authorityCase();const router=new ContractRouter({authority:c.a,session:c.session,taskId:'t',workspace:c.workspace})
  const result=await router.consume({master:c.master,agentRecord:c.agentRecord,grant:c.grant,evidenceDirectory:join(c.directory,'router')})
  assert.equal(result.status,'READY');assert.equal(result.executionAuthorized,false)
  assert.equal(router.checkWrite('hello.txt').allowed,true)
  c.a.revoke(c.channel);assert.equal(router.checkWrite('hello.txt').allowed,false)
})
test('missing task model yields BLOCKED and cannot dispatch',async()=>{
  const c=await authorityCase();const router=new ContractRouter({authority:c.a,session:c.session,taskId:'t',workspace:c.workspace})
  const record=structuredClone(c.agentRecord);record.minimumTaskModel=null
  const result=await router.consume({master:c.master,agentRecord:record,grant:c.grant,evidenceDirectory:join(c.directory,'missing-model')})
  assert.equal(result.status,'BLOCKED');assert.equal(router.checkWrite('hello.txt').allowed,false)
})
test('malformed Master yields INVALID and cannot dispatch',async()=>{
  const c=await authorityCase();const router=new ContractRouter({authority:c.a,session:c.session,taskId:'t',workspace:c.workspace})
  const master=structuredClone(c.master);master.executionClarity.score='invalid'
  const result=await router.consume({master,agentRecord:c.agentRecord,grant:c.grant,evidenceDirectory:join(c.directory,'invalid')})
  assert.equal(result.status,'INVALID');assert.equal(router.checkWrite('hello.txt').allowed,false)
})
test('file capability permits exclusive creation and actual scoped read',async()=>{
  const root=await mkdtemp(join(base,'files-')),files=new IsolatedFiles(root,{writeFiles:['hello.txt'],readFiles:['hello.txt']})
  await files.execute('write','hello.txt','hello master');assert.equal((await files.execute('read','hello.txt')).content,'hello master')
  await assert.rejects(files.execute('write','hello.txt','overwrite'),/EEXIST/)
})
test('path traversal, absolute/Windows alternate paths and unapproved operations refuse',async()=>{
  const root=await mkdtemp(join(base,'paths-')),files=new IsolatedFiles(root,{writeFiles:['hello.txt'],readFiles:['hello.txt']})
  for(const name of ['../hello.txt','sub/hello.txt','C:\\secret','hello.txt:stream','NUL','CON.txt'])assert.equal(files.check('read',name).allowed,false)
  for(const op of ['delete','pwsh','network','subagent','write_outside'])assert.equal(files.check(op,'hello.txt').allowed,false)
})
test('symbolic link and hard-link aliases cannot bypass named-file scope',async()=>{
  const root=await mkdtemp(join(base,'links-')),outside=join(base,'outside.txt');await writeFile(outside,'private fixture')
  const files=new IsolatedFiles(root,{readFiles:['hello.txt']})
  // File symlinks may require Windows privileges; use a junction (directory
  // symlink) which is available without developer mode and must also refuse.
  await symlink(base,join(root,'hello.txt'),process.platform==='win32'?'junction':'dir')
  assert.equal(files.check('read','hello.txt').allowed,false)
  const second=await mkdtemp(join(base,'hard-link-'));await link(outside,join(second,'hello.txt'))
  assert.equal(new IsolatedFiles(second,{readFiles:['hello.txt']}).check('read','hello.txt').allowed,false)
})
test('oversized content/read are bounded and tool failures are explicit',async()=>{
  const root=await mkdtemp(join(base,'sizes-')),files=new IsolatedFiles(root,{writeFiles:['hello.txt'],readFiles:['hello.txt']})
  await assert.rejects(files.execute('write','hello.txt','x'.repeat(4097)),/Bounded/)
  await writeFile(join(root,'hello.txt'),'x'.repeat(4097))
  await assert.rejects(files.execute('read','hello.txt'),/oversized/)
})
test('authenticated loopback rejects ordinary JSON and unsigned model-like input',async()=>{
  const session={id:'ingress'},received=[]
  const ingress=await createIngress({session,taskId:'t',componentTest:true,onAuthenticated:(m,p)=>{received.push(ingressProof(p,session,'t'));return {received:true}}})
  try {
    const result=await ingress.requestUntrusted({sessionId:session.id,taskId:'t',requestId:'fake',action:'confirm',payload:{trusted:true,source:{kind:'user'}}})
    assert.equal(result.httpStatus,403);assert.equal(received.length,0)
    const good=await ingress.requestForComponentTest({sessionId:session.id,taskId:'t',requestId:'good',action:'message',payload:{text:'sample'}})
    assert.equal(good.httpStatus,200);assert.equal(received[0].origin,'component-test');assert.equal(received[0].payload.text,'sample')
  }finally{await ingress.close()}
})
test('signed request still refuses wrong session/task and replay',async()=>{
  const session={id:'bound'},ingress=await createIngress({session,taskId:'t',componentTest:true,onAuthenticated:()=>({})})
  try {
    const body={sessionId:session.id,taskId:'t',requestId:'r',action:'message',payload:{text:'x'}}
    assert.equal((await ingress.requestForComponentTest({...body,sessionId:'other'})).httpStatus,400)
    assert.equal((await ingress.requestForComponentTest({...body,taskId:'other'})).httpStatus,400)
    assert.equal((await ingress.requestForComponentTest(body)).httpStatus,200)
    assert.equal((await ingress.requestForComponentTest(body)).httpStatus,400)
  }finally{await ingress.close()}
})
test('signed confirmation binds exact received payload and caller source',async()=>{
  const c=await authorityCase();let granted
  const ingress=await createIngress({session:c.session,taskId:'t',componentTest:true,onAuthenticated:(m,p)=>{
    granted=c.a.confirmFromIngress(c.channel,{requestId:m.requestId,master:c.master,...m.payload},p);return {received:true}
  }})
  try {
    assert.equal((await ingress.requestForComponentTest({sessionId:c.session.id,taskId:'t',requestId:'signed',action:'confirm',
      payload:{confirmation:c.confirmation,expiresAt:Date.now()+1000}})).httpStatus,200)
    assert.equal(c.a.live(granted,c.session,c.master),true);assert.equal(c.a.realIngressVerified,false)
  }finally{await ingress.close()}
})
test('cannot replace confirmation after transport authentication',async()=>{
  const c=await authorityCase()
  const ingress=await createIngress({session:c.session,taskId:'t',componentTest:true,onAuthenticated:(m,p)=>{
    const altered=structuredClone(m.payload.confirmation);altered.execution.authorized=false
    c.a.confirmFromIngress(c.channel,{requestId:m.requestId,master:c.master,confirmation:altered,expiresAt:m.payload.expiresAt},p)
  }})
  try {assert.equal((await ingress.requestForComponentTest({sessionId:c.session.id,taskId:'t',requestId:'tamper',action:'confirm',payload:{confirmation:c.confirmation,expiresAt:Date.now()+1000}})).httpStatus,400)}
  finally{await ingress.close()}
})
test('user message receipt cannot be reinterpreted as confirmation',async()=>{
  const c=await authorityCase()
  const ingress=await createIngress({session:c.session,taskId:'t',componentTest:true,onAuthenticated:(m,p)=>{
    c.a.confirmFromIngress(c.channel,{requestId:m.requestId,master:c.master,confirmation:c.confirmation,expiresAt:Date.now()+1000},p)
  }})
  try {assert.equal((await ingress.requestForComponentTest({sessionId:c.session.id,taskId:'t',requestId:'not-confirmation',action:'message',payload:{text:'hello'}})).httpStatus,400)}
  finally{await ingress.close()}
})
test('initial model budget capability does not become execution authority',async()=>{
  const c=await authorityCase();let grant
  const binding={provider:'local-test',model:'fixture',goal:c.master.realGoal,budgetConfig:config}
  const ingress=await createIngress({session:c.session,taskId:'t',componentTest:true,onAuthenticated:(_m,p)=>{
    grant=c.a.authorizeModelBudget(c.channel,p);return {executionPermission:false}
  }})
  try {
    assert.equal((await ingress.requestForComponentTest({sessionId:c.session.id,taskId:'t',requestId:'budget',action:'budget',payload:{...binding,expiresAt:Date.now()+1000}})).httpStatus,200)
    assert.equal(c.a.liveModelBudget(grant,c.session,binding),true)
    assert.equal(c.a.live(grant,c.session,c.master),false)
    assert.equal(c.a.liveModelBudget(grant,c.session,{...binding,model:'other'}),false)
    c.a.revoke(c.channel);assert.equal(c.a.liveModelBudget(grant,c.session,binding),false)
  }finally{await ingress.close()}
})
test('fabricated authentication proof is not accepted by confirmation ingress',async()=>{
  const c=await authorityCase()
  assert.throws(()=>c.a.confirmFromIngress(c.channel,{requestId:'fake',master:c.master,confirmation:c.confirmation,expiresAt:2000},{authenticated:true}),/proof/)
})
test('production signer is absent and operator not enrolled through a pipe',async()=>{
  const session={id:'production'},ingress=await createIngress({session,taskId:'t',onAuthenticated:()=>({})})
  try {assert.throws(()=>ingress.requestForComponentTest({}),/not available/)}finally{await ingress.close()}
})
