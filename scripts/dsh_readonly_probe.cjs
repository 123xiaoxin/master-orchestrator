// Installed Electron Node only. The native DeepSeekAdapter serializes/parses;
// fetch is replaced before it is loaded and NEVER delegates to a real transport.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
const {pathToFileURL}=require('node:url')
async function main(){
 const [packageRoot,skillRoot,output]=process.argv.slice(2),root=path.resolve(__dirname,'..'),local=await fs.realpath(path.join(root,'.local')),target=path.resolve(output)
 const rel=path.relative(local,target),parent=await fs.realpath(path.dirname(target))
 if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel)||!(parent===local||parent.startsWith(local+path.sep)))throw new Error('Fresh contained .local output required')
 await fs.mkdir(target);const workspace=path.join(target,'workspace');await fs.mkdir(workspace)
 const {sha256,contractHash}=await import(pathToFileURL(path.join(root,'adapters/dsh-v2.1/adapter.mjs')).href)
 const {TARGET,createDeepSeekBoundary}=await import(pathToFileURL(path.join(root,'adapters/dsh-session/deepseek-readonly.mjs')).href)
 const source=path.join(packageRoot,'dsh-llm-deepseek/lib/index.js'),hash=sha256(await fs.readFile(source))
 assert.equal(hash,'226e2047b843f954d8478207613f3e44448671c6f98f8edee77008d0fe005484')
 const wire=[],checks={},audit=[];let fixtureEnabled=false
 const originalRequest=require('node:http').request,originalConnect=require('node:net').Socket.prototype.connect
 const deny=()=>{throw new Error('Readonly offline probe blocks real transport')}
 require('node:http').request=function(o,...a){if(o?.host!=='127.0.0.1'||o.path!=='/operator')return deny();return originalRequest.call(this,o,...a)}
 require('node:https').request=deny;require('node:https').get=deny;require('node:tls').connect=deny;require('node:dgram').createSocket=deny
 require('node:net').Socket.prototype.connect=function(...a){const x=Array.isArray(a[0])?a[0]:a,o=typeof x[0]==='object'?x[0]:{host:x[1]};if(o.host!=='127.0.0.1'||o.path)return deny();return originalConnect.apply(this,a)}
 require('node:module').syncBuiltinESMExports()
 globalThis.fetch=async(url,options)=>{
  assert.equal(fixtureEnabled,true);assert.equal(String(url),'https://api.deepseek.com/anthropic/v1/messages')
  const body=JSON.parse(options.body);assert.equal(body.model,TARGET.model);assert.equal(body.thinking.type,'disabled');assert.equal(body.max_tokens,256);assert.equal(body.tools,undefined)
  wire.push({url:String(url),body,source:'native DeepSeekAdapter serialized request; intercepted in memory, never sent'})
  const reply=wire.length===1?'[MOCK] 你最希望先改善哪件事？':'[MOCK] 已收到补充，目标更新为了解老客不再来的原因。'
  const events=[{type:'message_start',message:{usage:{input_tokens:10,cache_read_input_tokens:2,cache_creation_input_tokens:0}}},
   {type:'content_block_start',index:0,content_block:{type:'text',text:''}},
   {type:'content_block_delta',index:0,delta:{type:'text_delta',text:reply}},{type:'content_block_stop',index:0},
   {type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:5}},{type:'message_stop'}]
  return new Response(events.map(e=>'event: '+e.type+'\ndata: '+JSON.stringify(e)+'\n\n').join(''),{status:200,headers:{'content-type':'text/event-stream'}})
 }
 const {DeepSeekAdapter,resolveAdapterOptions}=require(path.join(packageRoot,'dsh-llm-deepseek'))
 const boundary=createDeepSeekBoundary({DeepSeekAdapter,resolveAdapterOptions,componentTest:true})
 const realClosed=createDeepSeekBoundary({DeepSeekAdapter,resolveAdapterOptions})
 try{realClosed.measure({messages:[]},realClosed.policy)}catch{checks.uncertifiedRealTokenBoundBlocked=true}
 const {assembleHost,COMPONENTS,COMPONENT_CONFIG}=await import(pathToFileURL(path.join(root,'adapters/dsh-session/native-host.mjs')).href)
 const profileFile=path.join(target,'profile.json'),taskId='readonly-intent'
 await fs.writeFile(profileFile,JSON.stringify({version:'master_dsh_isolated_profile.v1',sessionId:'readonly-offline-session',taskId,components:COMPONENTS.map(name=>({name,config:COMPONENT_CONFIG[name]??{}}))}),{flag:'wx'})
 const host=await assembleHost({packageRoot,skillRoot,profileFile,workspace,output:target,componentTest:true,readOnlyIntent:true})
 let report
 try{
  host.mountReadonlyDeepSeek({boundary,audit})
  await host.send('unauthorized synthetic input');checks.noApprovalNoProviderContact=wire.length===0
  const config={maxCalls:3,maxSessions:1,maxSteps:4,maxInputTokens:600000,maxOutputTokens:768,maxCostMicros:'601536',maxRuntimeMs:60000,
    price:{currency:'USD',inputMicrosPerToken:'1',outputMicrosPerToken:'2',approvedConservativeUpperBound:true},providerPolicyHash:contractHash(boundary.policy),requestInputUpperBound:200000,requestOutputUpperBound:256}
  const approved=await host.ingress.requestForComponentTest({sessionId:host.agent.id,taskId,requestId:'fixture-budget',action:'budget',payload:{provider:TARGET.provider,model:TARGET.model,goal:'Synthetic read-only intent evaluation',budgetConfig:config,expiresAt:Date.now()+60000}})
  assert.equal(approved.httpStatus,200);fixtureEnabled=true
  for(const [i,text] of ['想让虚构的小店经营好一点。','主要是老客不再来了，我想先了解原因。'].entries()){
    const accepted=await host.ingress.requestForComponentTest({sessionId:host.agent.id,taskId,requestId:'fixture-user-'+i,action:'message',payload:{text}})
    assert.equal(accepted.httpStatus,200)
  }
  checks.nativeTwoTurnProviderCalls=wire.length===2
  checks.rulesIncludingIntent06=['entry','01','05','07','08','06'].every(id=>host.ruleRecords.some(r=>r.id===id))
  checks.nativeSystemPromptIncludes06=host.assemblies.some(a=>a.sectionNames.includes('master:06'))
  checks.fullRulesReachSerializedRequest=wire.every(w=>typeof w.body.system==='string'&&w.body.system.length>10000)
  checks.noToolSchemas=wire.every(w=>w.body.tools===undefined)
  for(const tool of ['read','write','pwsh','browser','web_search','spawn_agent','mcp'])checks['toolDenied:'+tool]=(await host.tool(tool,{file_path:'no-access',command:'never'},'readonly-'+tool)).isError===true
  checks.noWorkspaceFiles=(await fs.readdir(workspace)).length===0
  checks.budgetCallsMatch=host.budget().calls===2&&host.budget().pendingRequests===0
  checks.actualSessionReplies=host.observed.filter(e=>e.type==='assistant/message').length===2
  checks.awaitedFlush=await host.flush()===true
  await fs.writeFile(path.join(target,'pre-assert-evidence.json'),JSON.stringify({checks,audit,budget:host.budget(),wire},null,2)+'\n',{flag:'wx'})
  for(const [name,value] of Object.entries(checks))assert.equal(value,true,name)
  const transcript={caseId:'vague-test',declaredSource:'mock',turns:[{role:'user',text:'想让虚构的小店经营好一点。'},{role:'assistant',text:'[MOCK] 你最希望先改善哪件事？'},{role:'user',text:'主要是老客不再来了，我想先了解原因。'},{role:'assistant',text:'[MOCK] 已收到补充，目标更新为了解老客不再来的原因。'}],toolCalls:[]}
  await fs.writeFile(path.join(target,'transcript.mock.json'),JSON.stringify(transcript,null,2)+'\n',{flag:'wx'})
  report={offlineStatus:'READONLY_OFFLINE_PASS',pilotReadiness:'BLOCKED',target:TARGET,nativeDeepSeekSource:{path:source,sha256:hash},checks,wire,audit,
    budget:host.budget(),rules:host.ruleRecords,assemblies:host.assemblies,sessionEvents:host.observed,ingress:host.ingress.audit(),toolFacts:host.toolFacts,flushes:host.flushes,
    limitations:realClosed.readiness().engineeringMissing,mockTransportCalls:wire.length,realModelCalls:0,realProviderNetworkRequests:0,paidCalls:0,actualPaidCost:0,semanticEvaluation:'NOT_RUN'}
 }finally{await host.close()}
 report.finalBudget=host.budget()
 await fs.writeFile(path.join(target,'verification.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({output:target,offlineStatus:report.offlineStatus,pilotReadiness:report.pilotReadiness,checks:Object.keys(checks).length,mockCalls:wire.length,realModelCalls:0}))
}
main().catch(e=>{console.error(e.stack);process.exitCode=1})
