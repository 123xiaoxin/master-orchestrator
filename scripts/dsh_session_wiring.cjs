// No paid-model mode is exposed. Run in installed Electron's Node host.
const fs=require('node:fs/promises')
const path=require('node:path')
const assert=require('node:assert/strict')
const {pathToFileURL}=require('node:url')
async function main() {
  const [packageRoot,skillRoot,output,mode='--prepare']=process.argv.slice(2)
  if(!packageRoot||!skillRoot||!output||!['--prepare','--component-test','--serve-gated'].includes(mode))throw new Error('packages skill-root new-output [--prepare|--component-test|--serve-gated] required')
  if(mode==='--serve-gated'&&!(process.stdin.isTTY&&process.stdout.isTTY))throw new Error('Operator console must be an actual interactive TTY; piped/controller enrollment is refused')
  const root=path.resolve(__dirname,'..'),local=await fs.realpath(path.join(root,'.local')),target=path.resolve(output)
  const rel=path.relative(local,target),parent=await fs.realpath(path.dirname(target))
  if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel)||!(parent===local||parent.startsWith(local+path.sep)))throw new Error('Fresh contained .local output required')
  await fs.mkdir(target)
  const workspace=path.join(target,'workspace');await fs.mkdir(workspace)
  const {assembleHost,COMPONENTS,COMPONENT_CONFIG}=await import(pathToFileURL(path.join(root,'adapters/dsh-session/native-host.mjs')).href)
  const profile={version:'master_dsh_isolated_profile.v1',sessionId:'master-wiring-'+path.basename(target),taskId:'hello-pilot',
    components:COMPONENTS.map(name=>({name,config:COMPONENT_CONFIG[name]??{}}))}
  const profileFile=path.join(target,'profile.json');await fs.writeFile(profileFile,JSON.stringify(profile,null,2)+'\n',{flag:'wx'})
  await fs.writeFile(path.join(target,'budget-authorization.template.json'),JSON.stringify({
    provider:null,model:null,maxCalls:null,maxSessions:null,maxSteps:null,maxInputTokens:null,maxOutputTokens:null,maxCostMicros:null,maxRuntimeMs:null,
    requestInputUpperBound:null,requestOutputUpperBound:null,price:{currency:null,inputMicrosPerToken:null,outputMicrosPerToken:null,approvedConservativeUpperBound:false},
    note:'Review data only, not an authenticated approval. No suggested amounts are preapproved; real ingress/provider/isolation must be verified.'},null,2)+'\n',{flag:'wx'})
  await fs.writeFile(path.join(target,'pilot-plan.json'),JSON.stringify({request:'在授权的隔离目录中创建 hello.txt，写入 hello master，然后读取文件确认内容完全一致。',
    executable:false,source:'host pilot preparation, not user confirmation or model contract',writeFiles:['hello.txt'],readFiles:['hello.txt'],
    acceptance:['Actual model session and rule input','Native Adapter L1/L2','Authenticated live user permission','Scoped actual tool IO',
      'Complete correlated durable trace','Independent exact-byte verification','Actual usage within authorized conservative bounds']},null,2)+'\n',{flag:'wx'})
  const host=await assembleHost({packageRoot,profileFile,skillRoot,workspace,output:target,componentTest:mode==='--component-test'})
  const checks={};let report
  try {
    checks.actualAgentSessionCreated=host.ctx.agents.get(host.agent.id)===host.agent && host.ctx.sessions.get(host.agent.id)===host.agent.session
    await host.send('在授权的隔离目录中创建 hello.txt，写入 hello master，然后读取文件确认内容完全一致。')
    checks.unauthorizedFollowupBlocked=host.observed.some(e=>e.type==='turn/end'&&e.data.reason?.kind==='blocked')
    checks.requiredRulesAssembled=host.assemblies.some(a=>['entry','01','05','07','08'].every(id=>a.sectionNames.includes('master:'+id)))
    let bypassDenied=false
    try {for await(const _ of host.ctx.llm.stream({provider:'arbitrary-paid-route',model:'unapproved',messages:[],tools:[],signal:new AbortController().signal})) {}}
    catch{bypassDenied=true}
    checks.directLlmBypassDenied=bypassDenied
    const before=await host.tool('write',{file_path:'hello.txt',content:'hello master'},'without-user-grant')
    checks.noGrantToolDenied=before.isError===true
    const untrusted=await host.ingress.requestUntrusted({sessionId:host.agent.id,taskId:profile.taskId,requestId:'fake-user',action:'confirm',payload:{trusted:true}})
    checks.forgedHostIngressDenied=untrusted.httpStatus===403
    if(mode==='--component-test') {
      // These are synthetic controller declarations. No real-user grant or
      // model output is implied; the actual ToolRuntime DOES execute file IO.
      const fixture=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/dsh-adapter/master.v1.json'),'utf8'))
      const record=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/dsh-adapter/agent-record.json'),'utf8'))
      const {contractHash,sha256}=await import(pathToFileURL(path.join(root,'adapters/dsh-v2.1/adapter.mjs')).href)
      fixture.realGoal='在授权的隔离目录中创建 hello.txt，写入 hello master，然后读取文件确认内容完全一致。'
      fixture.minimumPrototype='Exclusive hello.txt creation, scoped read and independent exact-byte verification.'
      fixture.nextAction='Dispatch only scoped tools after host authorization and budget admission.'
      record.minimumTaskModel={type:'disposable_file',description:'Create one named test file and verify exact content.'}
      record.minimumPrototype={type:'file_outline',description:fixture.minimumPrototype}
      record.definitions={correct:'Bytes equal hello master.',usable:'Named file can be read within the isolated capability.',done:'Complete observed execution and independent byte verification, never a model declaration alone.'}
      record.provenance={kind:'component-controller-authored-file-pilot-model',purpose:'Preparation fixture, not actual Master inference'}
      fixture.executionContract={allowedActions:['write:hello.txt','read:hello.txt'],forbiddenActions:['shell','network','delete','overwrite','delegate'],riskBoundaries:['Disposable workspace only'],validationPlan:[`bytes:hello.txt:${sha256('hello master')}`]}
      record.verificationRequired=fixture.executionContract.validationPlan.map(item=>({item,howToVerify:'Independent byte hash and scoped read.'}))
      const confirmation={version:'master_runtime_confirmation.v1',taskId:profile.taskId,goalConfirmation:{goal:fixture.realGoal,status:'confirmed'},
        authorization:{contractSha256:contractHash(fixture),...fixture.executionContract,shouldCreateAgent:false},assumptionConfirmations:[],userDecisions:[],
        execution:{authorized:true,workspace,writeFiles:['hello.txt'],readFiles:['hello.txt'],checks:[{kind:'bytes',file:'hello.txt',sha256:sha256('hello master')}],maxRepairs:2}}
      const config={maxCalls:5,maxSessions:1,maxSteps:20,maxInputTokens:200,maxOutputTokens:200,maxCostMicros:'1000',maxRuntimeMs:60000,
        price:{currency:'TEST',inputMicrosPerToken:'1',outputMicrosPerToken:'1',approvedConservativeUpperBound:true},requestInputUpperBound:10,requestOutputUpperBound:10}
      const result=await host.projectForComponent({master:fixture,agentRecord:record,confirmation,budgetConfig:config})
      checks.adapterAndNativeReady=result.status==='READY'&&result.validation.nativeStructure.status==='passed'&&result.validation.nativeGovernance.status==='passed'
      checks.readyDidNotGrantProduction=result.executionAuthorized===false&&host.authority.realIngressVerified===false
      checks.authenticatedControllerIngress=host.ingress.audit().filter(e=>e.type==='authenticated').length===2
      checks.initialBudgetGrantsNoExecution=host.authority.audit().some(e=>e.type==='model_budget_approved'&&e.executionPermission===false)
      checks.budgetOnlyDispatchDenied=host.toolFacts.some(e=>e.callId==='budget-without-execution-permission'&&e.result.isError===true)
      const written=await host.tool('write',{file_path:'hello.txt',content:'hello master'},'actual-scoped-write')
      checks.realScopedToolWriteSucceeded=written.isError===false
      const read=await host.tool('read',{file_path:'hello.txt'},'actual-scoped-read')
      checks.realScopedToolReadSucceeded=read.isError===false&&JSON.parse(read.content[0].text).content==='hello master'
      const duplicate=await host.tool('write',{file_path:'hello.txt',content:'overwrite'},'repeat-write')
      checks.overwriteDenied=duplicate.isError===true
      const traversal=await host.tool('read',{file_path:'../outside'},'path-traversal')
      checks.traversalDenied=traversal.isError===true
      const shell=await host.tool('pwsh',{command:'never execute'},'unknown-shell')
      checks.unknownToolDenied=shell.isError===true
      const verified=await host.returnVerification();await host.agent.whenIdle()
      checks.independentVerificationReturned=verified.passed&&host.observed.some(e=>e.type==='agent/inbox/spliced'&&JSON.stringify(e.data).includes('master-independent-verification'))
      checks.mockRequestReservedAndSettled=await host.localBudgetProbe()===1&&host.budget().calls===1&&host.budget().pendingRequests===0
      host.authority.revoke(host.channel)
      checks.revokedAuthorizationDenied=(await host.tool('read',{file_path:'hello.txt'},'revoked-read')).isError===true
    }
    checks.awaitedNativeFlush=await host.flush()===true&&host.flushes.length>0
    checks.actualToolResultsReconciled=host.reconciliation().complete
    for(const [name,passed] of Object.entries(checks))assert.equal(passed,true,name)
    report={evidenceLevel:mode==='--component-test'?'Actual DSH Agent assembly + actual host-driven ToolRuntime IO + Mock local LLM adapter':'Actual DSH Agent assembly; no model',
      runtimeSources:host.sources,profile,ruleRecords:host.ruleRecords,checks,sessionId:host.agent.id,sessionFormat:host.agent.session.header.version,
      observedEvents:host.observed,toolRequests:host.toolRequests,toolFacts:host.toolFacts,reconciliation:host.reconciliation(),gateFacts:host.gateFacts,assemblies:host.assemblies,flushes:host.flushes,
      router:host.router.audit(),authorization:host.authority.audit(),ingress:{address:host.ingress.address,operatorEnrolled:host.ingress.operatorEnrolled,audit:host.ingress.audit()},budget:host.budget(),readiness:host.readiness(),
      modelCalls:0,paidProviderRequests:0,actualPaidCost:'0 (no provider I/O)',masterModelBehaviorVerified:false,
      limitations:['Component confirmation is controller-authored, not authenticated external-user authorization',
        'Real tool operations are host-driven; no model proposed them','Rule assembly does not prove model compliance','Native JSONL resume backend not mounted; sidecar flush listener used']}
    if(mode==='--serve-gated')await new Promise(done=>{process.once('SIGINT',done);process.once('SIGTERM',done)})
  }finally{await host.close()}
  report.budget=host.budget()
  report.authorization=host.authority.audit()
  report.ingress.audit=host.ingress.audit()
  await fs.writeFile(path.join(target,'verification.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})
  console.log(JSON.stringify({output:target,checks,status:'BLOCKED',modelCalls:0,completeAgentCreated:true}))
}
main().catch(error=>{console.error(error.stack);process.exitCode=1})
