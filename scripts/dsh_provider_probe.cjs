// No credentials or real provider modules are loaded. Installed Electron Node.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
const {pathToFileURL}=require('node:url')
async function main(){
  const [packageRoot,skillRoot,output]=process.argv.slice(2),root=path.resolve(__dirname,'..')
  if(!packageRoot||!skillRoot||!output)throw new Error('Actual packages, isolated Skill root, fresh .local output required')
  const local=await fs.realpath(path.join(root,'.local')),target=path.resolve(output),parent=await fs.realpath(path.dirname(target)),rel=path.relative(local,target)
  if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel)||!(parent===local||parent.startsWith(local+path.sep)))throw new Error('Contained disposable output required')
  await fs.mkdir(target)
  const {sha256,contractHash}=await import(pathToFileURL(path.join(root,'adapters/dsh-v2.1/adapter.mjs')).href)
  const lock=JSON.parse(await fs.readFile(path.join(root,'adapters/dsh-session/native-runtime-source-lock.json')))
  for(const name of ['cordis','dsh-llm'])assert.equal(sha256(await fs.readFile(path.join(packageRoot,name,'lib/index.js'))),lock.entries[name].sha256)
  const {Context}=require(path.join(packageRoot,'cordis')),{default:LlmRuntime,LlmAdapter}=require(path.join(packageRoot,'dsh-llm'))
  const {providerCase,providerCases,fixturePolicy}=await import(pathToFileURL(path.join(root,'tests/provider-cases.mjs')).href)
  const results=[]
  // Fail closed against accidental fixture network calls. This denies common
  // Node transports in this process; not a substitute for an OS egress policy.
  let networkAttempts=0
  const deny=()=>{networkAttempts++;throw new Error('Offline probe network denied')}
  globalThis.fetch=deny
  for(const name of ['node:http','node:https']){const mod=require(name);mod.request=deny;mod.get=deny}
  require('node:net').Socket.prototype.connect=deny
  require('node:tls').connect=deny
  // Only private loopback HTTP authentication is allowed; all external network
  // transports remain denied in this probe process.
  const net=require('node:net'),http=require('node:http')
  // Authentication is tested by the existing ingress suite; provider cases use
  // actual HTTP, so the gate below allows only their private loopback traffic.
  net.Socket.prototype.connect=function(...args){
    const input=Array.isArray(args[0])?args[0]:args,options=typeof input[0]==='object'?input[0]:{port:input[0],host:input[1]}
    if(options.host!=='127.0.0.1'||options.path||!options.port)return deny()
    return originalConnect.apply(this,args)
  }
  http.request=function(options,...args){if(options?.host!=='127.0.0.1'||options.path!=='/operator')return deny();return originalRequest.call(this,options,...args)}
  require('node:dgram').createSocket=deny
  require('node:module').syncBuiltinESMExports()
  const runtimeFactory=async make=>{
    const ctx=new Context();await ctx.plugin(LlmRuntime,{})
    const adapter=make({LlmAdapter});ctx.llm.registerAdapter(['controlled-offline'],adapter)
    return {llm:ctx.llm,close:()=>ctx.fiber.dispose()}
  }
  for(const [name,options,check] of providerCases){
    const c=await providerCase(runtimeFactory,options)
    try{await check(c);results.push({name,passed:true,interface:'actual installed DSH LlmRuntime',provider:'in-memory fixture',calls:c.calls,audit:c.audit,budget:c.ledger.snapshot()})}
    finally{await c.close()}
  }
  const {assembleHost,COMPONENTS,COMPONENT_CONFIG}=await import(pathToFileURL(path.join(root,'adapters/dsh-session/native-host.mjs')).href)
  const agentOutput=path.join(target,'agent');await fs.mkdir(agentOutput);const workspace=path.join(agentOutput,'workspace');await fs.mkdir(workspace)
  const profileFile=path.join(agentOutput,'profile.json'),taskId='offline-provider-agent'
  await fs.writeFile(profileFile,JSON.stringify({version:'master_dsh_isolated_profile.v1',sessionId:'provider-offline-agent',taskId,components:COMPONENTS.map(name=>({name,config:COMPONENT_CONFIG[name]??{}}))}),{flag:'wx'})
  const host=await assembleHost({packageRoot,skillRoot,profileFile,workspace,output:agentOutput,componentTest:true})
  const agentAudit=[],agentCalls={prepare:0,dispatch:0,maxTokens:null},policy={...fixturePolicy(),inputUpperBound:200000,contextWindow:300000}
  let agentReport
  try{
    const delegate={prepareCall:async(provider,model)=>{agentCalls.prepare++;return {model:{provider,id:model,name:model},stream:request=>({async *[Symbol.asyncIterator](){
      agentCalls.dispatch++;agentCalls.maxTokens=request.maxTokens
      yield {type:'usage',usage:{inputTokens:10,outputTokens:0,totalTokens:10}}
      yield {type:'finish',reason:{kind:'stop'}}
    }})}}}
    host.mountControlledFixture({delegate,policy,audit:agentAudit})
    await host.send('No tool action: exercise the local controlled provider only.')
    assert.equal(agentCalls.prepare,0)
    const config={maxCalls:2,maxSessions:1,maxSteps:5,maxInputTokens:400000,maxOutputTokens:40,maxCostMicros:'1200080',maxRuntimeMs:60000,
      price:{currency:'TEST',inputMicrosPerToken:'3',outputMicrosPerToken:'2',approvedConservativeUpperBound:true},providerPolicyHash:contractHash(policy),requestInputUpperBound:200000,requestOutputUpperBound:20}
    const approval=await host.ingress.requestForComponentTest({sessionId:host.agent.id,taskId,requestId:'offline-budget',action:'budget',payload:{provider:policy.provider,model:policy.model,goal:'offline local provider Agent assembly',budgetConfig:config,expiresAt:Date.now()+60000}})
    assert.equal(approval.httpStatus,200)
    await host.send('No file operation. Return no content; this is a no-inference fixture.')
    assert.equal(agentCalls.dispatch,1);assert.equal(agentCalls.prepare,1);assert.equal(agentCalls.maxTokens,20)
    assert.equal(host.budget().calls,1)
    assert(host.observed.some(e=>e.type==='request/header'))
    assert(host.observed.some(e=>e.type==='turn/end'&&e.data.reason?.kind==='completed'))
    await host.flush()
    agentReport={passed:true,calls:agentCalls,audit:agentAudit,budget:host.budget(),sessionEvents:host.observed,ruleRecords:host.ruleRecords,flushes:host.flushes,realModel:false,actualPaidCost:null}
  }finally{await host.close()}
  assert.equal(networkAttempts,0)
  const report={status:'PROVIDER_OFFLINE_PASS',cases:results,total:results.length,failed:0,agent:agentReport,networkAttempts,realNetworkRequests:0,realModelCalls:0,paidCalls:0,actualPaidCost:'0; no provider network I/O',productionNetworkAdmission:false,productionFileIsolation:'BLOCKED'}
  await fs.writeFile(path.join(target,'verification.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})
  console.log(JSON.stringify({output:target,status:report.status,total:results.length,agentPassed:agentReport.passed,realModelCalls:0,networkAttempts}))
}
const originalConnect=require('node:net').Socket.prototype.connect,originalRequest=require('node:http').request
main().catch(error=>{console.error(error.stack);process.exitCode=1})
