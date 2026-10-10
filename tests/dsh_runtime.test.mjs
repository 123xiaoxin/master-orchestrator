import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, mkdir, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { createHostPort, prepareExecution, executionGate, beginRepair, verifyGoal, finalAcceptance, TraceObserver, realSessionPreflight } from '../adapters/dsh-runtime/bridge.mjs'
import { contractHash } from '../adapters/dsh-v2.1/adapter.mjs'
import { ROOT, setupCase, mockWrite, appendMock, closeMock, runScenarios } from '../adapters/dsh-runtime/mock-workflow.mjs'
const base = await mkdtemp(join(ROOT,'.local/runtime-tests-'))
let n = 0
const setup = options => setupCase(base,`test-${++n}`,options)

test('A–E deterministic workflow; complete evidence and no model claims',async()=>{
  const output = join(base,'scenarios'); await mkdir(output)
  const result = await runScenarios(output)
  assert.equal(result.modelCalls,0)
  assert.deepEqual(result.levels,{level1:'PASS',level2:'BLOCKED',level3:'BLOCKED'})
  assert.equal(result.cases[4].acceptance.status,'unverifiable')
})
test('admitted host receipt reaches unchanged Adapter/native L1+L2',async()=>{
  const c=await setup()
  assert.equal(c.result.status,'READY')
  assert.equal(c.result.validation.nativeStructure.status,'passed')
  assert.equal(c.result.validation.nativeGovernance.status,'passed')
  assert.equal(c.result.executionAuthorized,false)
})
test('JSON imitation of host receipt rejected before evidence output',async()=>{
  const c=await setup()
  await assert.rejects(prepareExecution({...c,receipt:{trusted:true,kind:'user'},evidenceDirectory:join(c.directory,'forged')}),/forged/)
})
test('wrong source and wrong task cannot be admitted',async()=>{
  const c=await setup()
  const port=createHostPort({sessionId:'x',taskId:'other',evidenceLevel:'Mock'})
  assert.throws(()=>port.admitUserEvent(c.userEvent),/task/)
  const fake=structuredClone(c.userEvent);fake.data.source.kind='agent'
  assert.throws(()=>c.port.admitUserEvent(fake),/external user/)
})
test('replay refused, later user confirmation admits new receipt',async()=>{
  const c=await setup()
  assert.throws(()=>c.port.admitUserEvent(c.userEvent),/Replayed/)
  const event=structuredClone(c.userEvent);event.seq=3
  assert.ok(c.port.admitUserEvent(event))
})
test('missing separate execution permission refused even with confirmed goal',async()=>{
  const c=await setup();const e=structuredClone(c.userEvent);e.seq=2
  const value=JSON.parse(e.data.content[0].text);value.execution.authorized=false;e.data.content[0].text=JSON.stringify(value)
  assert.throws(()=>c.port.admitUserEvent(e),/execution permission/)
})
test('stale contract, different workspace and widened file scope refused',async()=>{
  const c=await setup()
  const changed=structuredClone(c.master);changed.nextAction='Changed'
  await assert.rejects(prepareExecution({...c,master:changed,evidenceDirectory:join(c.directory,'stale')}),/Stale/)
  await assert.rejects(prepareExecution({...c,workspace:base,evidenceDirectory:join(c.directory,'wrong-root')}),/workspace/)
  const value=structuredClone(c.confirmation);value.execution.writeFiles.push('config-b.json')
  const event=structuredClone(c.userEvent);event.seq=2;event.data.content[0].text=JSON.stringify(value)
  const receipt=c.port.admitUserEvent(event)
  await assert.rejects(prepareExecution({...c,receipt,evidenceDirectory:join(c.directory,'expanded')}),/scope differs/)
})
test('READY result and serialized capability never authorize execution',async()=>{
  const c=await setup()
  assert.equal(executionGate(null,c.result.candidate,{name:'write',file:'hello.txt'}).allowed,false)
  assert.equal(executionGate(JSON.parse(JSON.stringify(c.permit)),c.result.candidate,{name:'write',file:'hello.txt'}).allowed,false)
})
test('candidate mutation and wrong-file/shell/delegation operations refused',async()=>{
  const c=await setup()
  const changed=structuredClone(c.result.candidate);changed.goal='changed'
  assert.equal(executionGate(c.permit,changed,{name:'write',file:'hello.txt'}).allowed,false)
  for(const op of [{name:'write',file:'../outside.txt'},{name:'write',file:'config-b.json'},{name:'pwsh',file:'hello.txt'},{name:'subagent',file:'hello.txt'}])
    assert.equal(executionGate(c.permit,c.result.candidate,op).allowed,false)
})
test('Mock capability cannot be promoted to DSH model execution',async()=>{
  const c=await setup()
  assert.equal(executionGate(c.permit,c.result.candidate,{name:'write',file:'hello.txt'},{requireModel:true}).allowed,false)
})
test('parallel results use actual source.callId plus sourceEventSeqs',()=>{
  const o=new TraceObserver({sessionId:'p',taskId:'p',candidateHash:'x',evidenceLevel:'Mock'})
  o.observe({seq:0,type:'tool/call',data:{callId:'a',turn:1,step:1}})
  o.observe({seq:1,type:'tool/call',data:{callId:'b',turn:1,step:1}})
  for(const [seq,id,source] of [[2,'b',1],[3,'a',0]]) o.observe({seq,type:'tool/result',data:{turn:1,step:1,message:{source:{callId:id},isError:false}},sourceEventSeqs:[source]})
  o.observe({seq:4,type:'turn/end',data:{reason:{kind:'completed'}}})
  assert.equal(o.snapshot().complete,true)
  assert.equal(o.snapshot().calls[0].result.seq,3)
})
for(const variant of ['missing id','duplicate id','wrong source seq','wrong turn','orphan result','missing error flag','sequence gap','after terminal']) {
  test(`trace refuses ${variant}`,()=>{
    const o=new TraceObserver({sessionId:'n',taskId:'n',candidateHash:'x',evidenceLevel:'Mock'})
    const call={seq:0,type:'tool/call',data:{callId:'a',turn:1,step:1}}
    if(variant==='missing id') delete call.data.callId
    o.observe(call)
    let seq=1
    if(variant==='duplicate id') o.observe({...call,seq:seq++})
    const result={seq:seq++,type:'tool/result',data:{turn:1,step:1,message:{source:{callId:'a'},isError:false}},sourceEventSeqs:[0]}
    if(variant==='wrong source seq') result.sourceEventSeqs=[99]
    if(variant==='wrong turn') result.data.turn=2
    if(variant==='orphan result') result.data.message.source.callId='other'
    if(variant==='missing error flag') delete result.data.message.isError
    if(variant==='sequence gap') result.seq=99
    o.observe(result)
    o.observe({seq:seq++,type:'turn/end',data:{}})
    if(variant==='after terminal') o.observe({seq:seq++,type:'progress',data:{}})
    assert.equal(o.snapshot().complete,false)
  })
}
test('command names and isError=false do not imply independent verification',async()=>{
  const c=await setup();await mockWrite(c,{content:'wrong value'})
  const v=await verifyGoal(c.permit)
  assert.equal(v.passed,false)
  const result=await closeMock(c,v)
  assert.equal(result.executionSuccess,true)
  assert.equal(result.verificationSuccess,false)
  assert.equal(result.goalCompleted,false)
})
test('two repairs require intervening verification and third repair stops',async()=>{
  const c=await setup()
  await verifyGoal(c.permit)
  assert.equal(beginRepair(c.permit),1)
  assert.throws(()=>beginRepair(c.permit),/previous verification/)
  await verifyGoal(c.permit)
  assert.equal(beginRepair(c.permit),2)
  await verifyGoal(c.permit)
  assert.throws(()=>beginRepair(c.permit),/limit/)
})
test('successful repair retains initial failure and independently accepts corrected output',async()=>{
  const c=await setup();await mockWrite(c,{failure:true});await verifyGoal(c.permit);beginRepair(c.permit)
  await mockWrite(c);const v=await verifyGoal(c.permit);const result=await closeMock(c,v)
  assert.equal(result.executionSuccess,false)
  assert.equal(result.executionRecovered,true)
  assert.equal(result.goalCompleted,true)
})
test('fake verification JSON and invented flush hash cannot pass acceptance',async()=>{
  const c=await setup();await mockWrite(c);appendMock(c,'turn/end',{reason:{kind:'completed'}})
  const v=await verifyGoal(c.permit)
  for(const receipt of [v.receipt,{passed:true}]) {
    const result=await finalAcceptance({permit:c.permit,observer:c.observer,verificationReceipt:receipt,traceSha256:'a'.repeat(64)})
    assert.equal(result.status,'unverifiable')
  }
})
test('missing independent final criterion refuses goal completion',async()=>{
  const c=await setup();await mockWrite(c)
  assert.equal((await closeMock(c,null)).status,'unverifiable')
})
test('file mutation after verification rejects stale acceptance',async()=>{
  const c=await setup();await mockWrite(c);const v=await verifyGoal(c.permit)
  await writeFile(join(c.workspace,'hello.txt'),'tampered')
  assert.equal((await closeMock(c,v)).goalCompleted,false)
})
test('trace output is awaited, hash checked and never overwritten',async()=>{
  const c=await setup();await mockWrite(c);appendMock(c,'turn/end',{reason:{kind:'completed'}})
  const filename=join(c.directory,'flush.json');const digest=await c.observer.flush(filename)
  assert.equal(digest.length,64)
  assert.equal(JSON.parse(await readFile(filename,'utf8')).complete,true)
  await assert.rejects(c.observer.flush(filename),/EEXIST/)
})
test('tampered persisted trace cannot pass final acceptance',async()=>{
  const c=await setup();await mockWrite(c);const v=await verifyGoal(c.permit)
  appendMock(c,'turn/end',{reason:{kind:'completed'}})
  const filename=join(c.directory,'persisted.json');const traceSha256=await c.observer.flush(filename)
  await writeFile(filename,'{}')
  const result=await finalAcceptance({permit:c.permit,observer:c.observer,verificationReceipt:v.receipt,traceSha256})
  assert.equal(result.status,'unverifiable')
})
test('consumed round cannot write again; repair budget is enforced at dispatch',async()=>{
  const c=await setup();assert.equal((await mockWrite(c)).performed,true)
  assert.equal((await mockWrite(c,{content:'second write'})).performed,false)
  for(let i=0;i<2;i++){await verifyGoal(c.permit);beginRepair(c.permit);assert.equal((await mockWrite(c)).performed,true)}
  await verifyGoal(c.permit)
  assert.throws(()=>beginRepair(c.permit),/limit/)
  assert.equal((await mockWrite(c)).performed,false)
})
test('unauthorized observed tool cannot be accepted even when target file is correct',async()=>{
  const c=await setup();await mockWrite(c)
  const call=appendMock(c,'tool/call',{callId:'unexpected',name:'write',turn:1,step:1,arguments:'{"file_path":"config-b.json"}'})
  appendMock(c,'tool/result',{turn:1,step:1,message:{source:{callId:'unexpected'},isError:false}},{sourceEventSeqs:[call.seq]})
  const result=await closeMock(c,await verifyGoal(c.permit))
  assert.equal(result.operationsInScope,false)
  assert.equal(result.goalCompleted,false)
})
test('model gate defaults blocked; missing each required condition blocks',()=>{
  assert.equal(realSessionPreflight().status,'BLOCKED')
  const input={userModelAuthorization:true,modelAvailabilityConfirmed:true,isolatedProfile:true,scopedTools:true,logsReady:true,stopConditionsReady:true,noSensitiveData:true,hostRoutingVerified:true,hardBudgetEnforced:true,maxTokens:100,maxSessions:1,maxSteps:2,model:'explicit-test-model'}
  assert.equal(realSessionPreflight(input).status,'READY_FOR_HOST_REVIEW')
  for(const key of Object.keys(input)) {const missing={...input};delete missing[key];assert.equal(realSessionPreflight(missing).status,'BLOCKED',key)}
})
