import { createRequire } from 'node:module'
import { readFile, writeFile, realpath } from 'node:fs/promises'
import { resolve, join, dirname, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contractHash, sha256 } from '../dsh-v2.1/adapter.mjs'
import { BudgetLedger } from './budget.mjs'
import { HostAuthority } from './authority.mjs'
import { IsolatedFiles } from './file-tools.mjs'
import { ContractRouter } from './router.mjs'
import { createIngress, ingressProof } from './ingress.mjs'
import { controlledProvider } from './controlled-provider.mjs'

const require=createRequire(import.meta.url)
const HERE=dirname(fileURLToPath(import.meta.url))
const ROOT=resolve(HERE,'../..')
export const COMPONENTS=['dsh-system-prompt','dsh-session','dsh-session-projection','dsh-tools','dsh-llm','dsh-agent','dsh-agent-loop']
export const COMPONENT_CONFIG={
  'dsh-tools':{mode:'native',maxParallelSubCalls:1},
  'dsh-agent-loop':{agents:[],maxParallelToolCalls:1}
}
const within=(root,target)=>{const r=relative(root,target);return r && r!=='..'&&!r.startsWith('../')&&!r.startsWith('..\\')&&!isAbsolute(r)}

/** Loads fixed real DSH services, not arbitrary profile plugins or providers.
 * No model adapter, credential service, remote gateway, shell or PTC is mounted.
 * Real-user/provider/filesystem admission remains closed until audited separately.
 */
export async function assembleHost({packageRoot,profileFile,skillRoot,workspace,output,componentTest=false}) {
  const local=await realpath(join(ROOT,'.local')),root=await realpath(workspace)
  if(!within(local,root)||!within(local,await realpath(output)))throw new Error('Only isolated .local workspace/output accepted')
  const lock=JSON.parse(await readFile(join(HERE,'native-runtime-source-lock.json'),'utf8'))
  const sources={}
  for(const name of ['cordis',...COMPONENTS,'dsh-skill-filesystem']) {
    const entry=join(packageRoot,name,'lib/index.js'), bytes=await readFile(entry)
    if(sha256(bytes)!==lock.entries[name].sha256)throw new Error(`Unreviewed native source: ${name}`)
    sources[name]={path:entry,sha256:sha256(bytes),version:lock.entries[name].version}
  }
  const profile=JSON.parse(await readFile(profileFile,'utf8'))
  if(profile.version!=='master_dsh_isolated_profile.v1'||profile.components.length!==COMPONENTS.length||
    profile.components.some((r,i)=>r.name!==COMPONENTS[i]||contractHash(r.config??{})!==contractHash(COMPONENT_CONFIG[r.name]??{}))||profile.components.some(r=>Object.keys(r).some(k=>!['name','config'].includes(k))))
    throw new Error('Only fixed isolated composition allowed')
  const {Context}=require(join(packageRoot,'cordis'))
  const native=Object.fromEntries(COMPONENTS.map(name=>[name,require(join(packageRoot,name))]))
  const {createUserMessage}=native['dsh-llm']
  const {FileSystemSkillProvider}=require(join(packageRoot,'dsh-skill-filesystem'))
  const ctx=new Context()
  const observed=[],toolFacts=[],toolRequests=[],gateFacts=[],assemblies=[],flushes=[],toolViolations=[]
  const pendingTools=new Map()
  let agent,handle,router,grant,master,authority,channel,files,budget,bounds,probeAdapter,ingress,lastAdapterResult,grantTimer,modelGrant,budgetBinding,controlledRoute
  // Actual native LLM waterfall interception. Never forwards to a provider in
  // this no-authorization build, including direct calls bypassing Agent hooks.
  ctx.on('llm/stream',async function*(request,next){
    if(componentTest && controlledRoute && request.provider===controlledRoute.provider) {yield* await next();return}
    if(!componentTest || request.provider!=='local-offline-probe' || !budget || !bounds) {
      gateFacts.push({type:'llm_dispatch_denied',source:'native llm/stream waterfall'})
      throw new Error('Real provider route and cost authorization are not admitted')
    }
    budget.step(agent.id)
    const reservation=budget.reserve({sessionId:agent.id,inputUpperBound:bounds.input,outputUpperBound:bounds.output})
    let usage
    try {
      const stream=await next()
      for await(const chunk of stream){budget.signal.throwIfAborted();if(chunk.type==='usage')usage=chunk.usage;yield chunk}
    }finally{budget.settle(reservation,usage)}
  })
  ctx.on('agent/pre-step',(_request,next)=>{
    if(componentTest&&controlledRoute&&budget.allowTool().allowed)return next()
    gateFacts.push({type:'agent_step_denied',source:'native agent/pre-step waterfall'});return {kind:'reject'}
  },{global:true})
  ctx.on('agent/request',async(_position,next)=>{
    const proposal=await next()
    return componentTest&&controlledRoute?{provider:controlledRoute.provider,model:controlledRoute.model,maxTokens:controlledRoute.outputUpperBound}:proposal
  },{global:true})
  ctx.on('session/event',(session,event)=>{
    if(session.id===profile.sessionId && ctx.sessions.get(session.id)===session && session.eventAt(event.seq)===event)
      {observed.push(structuredClone(event));if(event.type==='assistant/message'&&router?.captureModelContract(event))master=router.capturedMaster}
  },{global:true})
  ctx.on('system-prompt/assemble',async(assembly,context,next)=>{
    const result=await next()
    if(context.agent?.id===profile.sessionId)assemblies.push({source:'actual SystemPrompt assembly',sectionNames:result.sections.map(s=>s.name),
      sha256:contractHash(result.sections.map(s=>({name:s.name,text:s.text})))})
    return result
  },{global:true})
  ctx.on('tools/result',(exec,result)=>{
    const request=pendingTools.get(exec.callId)
    if(!request||request.result||exec.agent!==agent) {toolViolations.push('unmatched_or_duplicate_runtime_result');return}
    request.result=result
    toolFacts.push({source:'actual DSH ToolRuntime result; caller is host controller',callId:exec.callId,tool:exec.name,
      sessionId:exec.agent?.id??null,arguments:structuredClone(exec.arguments),result:structuredClone(result)})
  },{global:true})
  ctx.on('session/flush',async session=>{
    if(session.id!==profile.sessionId)return
    const filename=join(output,`session-flush-${flushes.length+1}.json`)
    const bytes=JSON.stringify({source:'actual committed DSH Session events',header:session.header,events:observed},null,2)+'\n'
    await writeFile(filename,bytes,{flag:'wx'})
    if(sha256(await readFile(filename))!==sha256(bytes))throw new Error('Session sidecar durability mismatch')
    flushes.push({path:filename,sha256:sha256(bytes),eventCount:observed.length})
  },{global:true})
  try {
    for(const row of profile.components)await ctx.plugin(native[row.name].default,row.config??{})
    if(!ctx.agents || !ctx.agentLoop || !ctx.llm)throw new Error('Actual Agent components not mounted')
    const skillDirectory=await realpath(skillRoot)
    if(!within(local,skillDirectory))throw new Error('Only isolated packaged Skill supported')
    const provider=new FileSystemSkillProvider({get:()=>undefined,logger:{warn:()=>{},debug:()=>{}}},{signal:new AbortController().signal,invalidate:()=>{}},
      {includeDefaultRoots:false,customSkillDirs:[skillDirectory],watch:false,dshHome:join(output,'home'),agentsHome:join(output,'agents')})
    let ruleRecords=[]
    try {
      const candidates=await provider.list({cwd:root})
      if(candidates.length!==1)throw new Error('Exactly one isolated Master Skill required')
      const skill=await provider.get(candidates[0],{signal:new AbortController().signal})
      const manifest=JSON.parse(await readFile(join(skill.resourceBase.path,'modules.json'),'utf8'))
      const sourceLock=JSON.parse(await readFile(join(skill.resourceBase.path,'source-lock.json'),'utf8'))
      const normativeManifest=JSON.parse(await readFile(join(ROOT,'skills/master-skill/modules.json'),'utf8'))
      for(const path of ['skills/master-skill/SKILL.md','skills/master-skill/modules.json',...normativeManifest.modules.filter(m=>m.required).map(m=>m.path)])
        if(sourceLock.sources[path]!==sha256(await readFile(join(ROOT,path))))throw new Error('Packaged Skill source differs from current normative source')
      for(const path of ['SKILL.md','modules.json',...manifest.modules.filter(m=>m.required).map(m=>m.path)])
        if(sourceLock.artifacts[path]!==sha256(await readFile(join(skill.resourceBase.path,path))))throw new Error('Packaged Skill artifact hash mismatch')
      ruleRecords=[{id:'entry',text:skill.content,sha256:sha256(await readFile(skill.path))}]
      for(const module of manifest.modules.filter(m=>m.required)) {
        const filename=await realpath(resolve(skill.resourceBase.path,module.path))
        if(!within(skillDirectory,filename))throw new Error('Skill module escape')
        const bytes=await readFile(filename)
        ruleRecords.push({id:module.id,text:bytes.toString('utf8'),sha256:sha256(bytes)})
      }
      if(JSON.stringify(ruleRecords.slice(1).map(r=>r.id))!==JSON.stringify(['01','05','07','08']))throw new Error('Mandatory modules changed')
    }finally{await provider.dispose()}
    handle=await ctx.agents.create({sessionId:profile.sessionId,meta:{cwd:root},
      agentOptions:{provider:'no-paid-provider-mounted',model:'no-model-authorized'},setup:(agentCtx)=>{
        ruleRecords.forEach((r,i)=>agentCtx.systemPrompt.section({name:`master:${r.id}`,order:100+i,text:r.text}))
      }})
    agent=handle.agent
    await agent.whenIdle()
    if(componentTest) {
      const {LlmAdapter}=native['dsh-llm']
      probeAdapter=new class extends LlmAdapter {
        calls=0
        async *stream(){this.calls++;yield {type:'usage',usage:{inputTokens:1,outputTokens:1,totalTokens:2}}}
      }()
      ctx.llm.registerAdapter(['local-offline-probe'],probeAdapter)
    }
    authority=new HostAuthority({mode:componentTest?'component-test':'unverified'})
    channel=authority.registerSession(agent.session,profile.taskId)
    budget=new BudgetLedger() // closed: no budget and no authenticated model grant
    files=new IsolatedFiles(root,{writeFiles:['hello.txt'],readFiles:['hello.txt']})
    router=new ContractRouter({authority,session:agent.session,taskId:profile.taskId,workspace:root,evidenceParent:output})
    ingress=await createIngress({session:agent.session,taskId:profile.taskId,componentTest,onAuthenticated:async(message,proof)=>{
      const actor=ingressProof(proof,agent.session,profile.taskId)
      if(message.action==='revoke'){authority.revoke(channel);budget.stop('authorization_revoked');return {revoked:true}}
      if(message.action==='message'){
        if(typeof message.payload?.text!=='string')throw new Error('Text user message required')
        agent.followup(createUserMessage({source:{kind:'user',rpcId:message.requestId},content:[{type:'text',text:message.payload.text}]}))
        await agent.whenIdle();return {delivered:true,modelGate:'BLOCKED'}
      }
      if(message.action==='budget') {
        if(modelGrant)throw new Error('Budget already initialized; confirmation/retry cannot reset cumulative usage')
        const {budgetConfig,expiresAt,provider,model,goal}=message.payload
        modelGrant=authority.authorizeModelBudget(channel,proof)
        budgetBinding={provider,model,goal,budgetConfig}
        budget.stop('replaced_closed_budget')
        budget=new BudgetLedger(budgetConfig,{authorize:()=>authority.liveModelBudget(modelGrant,agent.session,budgetBinding)})
        bounds={input:budgetConfig.requestInputUpperBound,output:budgetConfig.requestOutputUpperBound}
        budget.openSession(agent.id)
        budget.signal.addEventListener('abort',()=>agent.cancel({kind:'user'}),{once:true})
        clearTimeout(grantTimer)
        grantTimer=setTimeout(()=>{authority.revoke(channel);budget.stop('authorization_expired')},Math.max(1,Math.min(expiresAt,actor.expiresAt)-Date.now()))
        grantTimer.unref?.()
        return {budgetInitialized:true,executionPermission:false,modelGate:'BLOCKED'}
      }
      if(!master)throw new Error('No sourced Master contract ready for confirmation')
      const {confirmation,expiresAt,agentRecord}=message.payload
      if(!modelGrant||master.realGoal!==budgetBinding.goal||!budget.allowTool().allowed)throw new Error('No live same-goal budget approval')
      grant=authority.confirmFromIngress(channel,{requestId:message.requestId,master,confirmation,expiresAt},proof)
      const result=await router.consume({master,agentRecord,grant,evidenceDirectory:join(output,'adapter-evidence')})
      lastAdapterResult=result
      return {adapterStatus:result.status,modelGate:'BLOCKED'}
    }})
    const denial=(exec)=>{
      let reason
      if(exec.agent!==agent)reason='Wrong or missing live Agent'
      else if(!['write','read'].includes(exec.name))reason='Tool not explicitly authorized'
      else if(!exec.arguments || typeof exec.arguments.file_path!=='string'||Object.keys(exec.arguments).some(k=>!['file_path','content'].includes(k)))reason='Invalid closed tool arguments'
      else if(!componentTest)reason='Actual external-user and filesystem isolation admission unverified'
      else if(!budget.allowTool().allowed)reason=budget.allowTool().reason
      else if(!files.check(exec.name,exec.arguments.file_path).allowed)reason=files.check(exec.name,exec.arguments.file_path).reason
      else {
        const gate=exec.name==='write'?router.checkWrite(exec.arguments.file_path,{claim:true}):router.checkRead(exec.arguments.file_path)
        if(!gate.allowed)reason=gate.reason
        else {try{budget.step(agent.id)}catch(error){reason=error.message}}
      }
      gateFacts.push({type:'tool_request',callId:exec.callId,tool:exec.name,source:'actual tools.guard dispatch boundary',allowed:reason===undefined,reason:reason??null})
      return reason
    }
    ctx.tools.guard(denial)
    for(const name of ['write','read']) {
      const parameters={type:'object',properties:{file_path:{type:'string'},...(name==='write'?{content:{type:'string'}}:{})},required:name==='write'?['file_path','content']:['file_path'],additionalProperties:false}
      ctx.tools.register({name,description:'Only explicitly admitted disposable flat test files',parameters,
        output:{schema:{type:'object',properties:{file:{type:'string'},operation:{type:'string'},bytes:{type:'integer'},content:{type:'string'}},required:['file','operation'],additionalProperties:false},
          render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},
        execute:async(args)=>{
          const errors=native['dsh-tools'].validateJsonSchemaValue(parameters,args)
          if(errors.length)throw new Error('Invalid tool arguments')
          return files.execute(name,args.file_path,args.content)
        }})
    }
    const trackedTool=async(name,args,callId)=>{
      if(!callId||pendingTools.has(callId))throw new Error('Unique tool Call ID required')
      const record={source:'host-controller request, not model-generated',callId,sessionId:agent.id,tool:name,arguments:structuredClone(args)}
      toolRequests.push(record)
      const pending={record,result:null};pendingTools.set(callId,pending)
      const result=await ctx.tools.execute({agent,name,arguments:args,callId,signal:budget.signal})
      if(pending.result!==result)toolViolations.push('returned_result_does_not_match_runtime_observation')
      return result
    }
    return {ctx,agent,authority,channel,router,sources,ruleRecords:ruleRecords.map(({id,sha256})=>({id,sha256})),
      observed,toolFacts,toolRequests,gateFacts,assemblies,flushes,ingress,
      send:async(text)=>{agent.followup(createUserMessage({source:{kind:'user'},content:[{type:'text',text}]}));await agent.whenIdle()},
      projectForComponent:async({master:input,agentRecord,confirmation,budgetConfig})=>{
        if(!componentTest)throw new Error('Component controller cannot activate production ingress')
        master=structuredClone(input)
        const funding=await ingress.requestForComponentTest({sessionId:agent.id,taskId:profile.taskId,requestId:'component-budget',action:'budget',
          payload:{provider:'local-offline-probe',model:'fixture',goal:master.realGoal,budgetConfig,expiresAt:Date.now()+60000}})
        if(funding.httpStatus!==200)throw new Error(JSON.stringify(funding.body))
        const premature=await trackedTool('write',{file_path:'hello.txt',content:'hello master'},'budget-without-execution-permission')
        if(premature.isError!==true)throw new Error('Budget approval improperly enabled file execution')
        const response=await ingress.requestForComponentTest({sessionId:agent.id,taskId:profile.taskId,requestId:'component-confirmation',action:'confirm',
          payload:{confirmation,expiresAt:Date.now()+60000,agentRecord}})
        if(response.httpStatus!==200)throw new Error(JSON.stringify(response.body))
        if(!lastAdapterResult)throw new Error('No actual Adapter result')
        return structuredClone(lastAdapterResult)
      },
      tool:trackedTool,
      mountControlledFixture:({delegate,policy,audit})=>{
        if(!componentTest||controlledRoute||policy.transport!=='offline-fixture'||policy.networkAllowed!==false)throw new Error('Only one explicitly controlled offline component route allowed')
        const adapter=controlledProvider({LlmAdapter:native['dsh-llm'].LlmAdapter,delegate,policy,audit,sessionId:agent.id,
          getBudget:()=>budget,getBudgetConfig:()=>budgetBinding?.budgetConfig??{},
          authorize:({provider,model,policyHash})=>!!(budgetBinding&&budgetBinding.provider===provider&&budgetBinding.model===model&&
            budgetBinding.budgetConfig.providerPolicyHash===policyHash&&authority.liveModelBudget(modelGrant,agent.session,budgetBinding))})
        ctx.llm.registerAdapter([policy.provider],adapter)
        controlledRoute=structuredClone(policy)
        return adapter
      },
      reconciliation:()=>({complete:toolRequests.length>0&&toolRequests.length===toolFacts.length&&toolViolations.length===0,
        requested:toolRequests.length,observedResults:toolFacts.length,violations:[...toolViolations],goalAcceptance:'not_evaluated'}),
      localBudgetProbe:async()=>{for await(const _ of ctx.llm.stream({provider:'local-offline-probe',model:'fixture',messages:[],tools:[],maxTokens:bounds?.output??1,signal:budget.signal})){};return probeAdapter?.calls??0},
      returnVerification:()=>router.verifyAndReturn(agent,createUserMessage),
      flush:()=>ctx.sessions.flush(agent.session),budget:()=>budget.snapshot(),
      readiness:()=>({status:'BLOCKED',engineeringMissing:['No reviewed real-provider preparation/usage/price-bound route', 'Production filesystem isolation admission not verified'],
        operatorEnrollmentPending:!ingress.operatorEnrolled,actualUserConfirmationObserved:authority.realIngressVerified,
        modelCalls:0,realModelSession:false,completeAgentCreated:true}),
      close:async()=>{
        clearTimeout(grantTimer);await ingress.close();budget.stop('host_closed');authority.close(channel);await agent.whenIdle();await ctx.sessions.flush(agent.session)
        await handle.dispose();await ctx.fiber.dispose()
        const filename=join(output,'session-final-sidecar.json')
        const bytes=JSON.stringify({source:'actual Session events through host teardown; independent sidecar, not native JSONL',header:agent.session.header,events:observed},null,2)+'\n'
        await writeFile(filename,bytes,{flag:'wx'})
        if(sha256(await readFile(filename))!==sha256(bytes))throw new Error('Final teardown sidecar hash mismatch')
        flushes.push({path:filename,sha256:sha256(bytes),eventCount:observed.length,source:'independent sidecar teardown snapshot'})
      }
    }
  }catch(error){clearTimeout(grantTimer);await ingress?.close?.();await handle?.dispose?.();await ctx.fiber.dispose();throw error}
}
