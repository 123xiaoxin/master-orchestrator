import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { adapt, contractHash, sha256 } from '../dsh-v2.1/adapter.mjs'
import { createHostPort, criterion, prepareExecution, executionGate, claimOperation, beginRepair, verifyGoal, TraceObserver, finalAcceptance, realSessionPreflight } from './bridge.mjs'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export async function setupCase(base, name, {file='hello.txt',goal='在测试目录创建一个 hello.txt 文件，内容为 hello master。', checks, evidenceLevel='Mock',initialEvents=[]} = {}) {
  const directory = join(base,name)
  const workspace = join(directory,'workspace')
  await mkdir(workspace,{recursive:true})
  checks ??= [{kind:'bytes',file,sha256:sha256('hello master')}]
  const master = {version:'master_output_contract.v1',decision:'execute',phase:'phase_3',realGoal:goal,
    nonGoals:['Only disposable test data.'],executionClarity:{score:90,rationale:'Deterministic fixture; no model judgment.'},
    minimumPrototype:'Bound single-file write followed by independent read.',executionContract:{allowedActions:[`write:${file}`],
      forbiddenActions:['shell','network','delegate','write outside named file'],riskBoundaries:['Disposable isolated workspace only; no paid model calls.'],validationPlan:checks.map(criterion)},
    shouldCreateAgent:false,nextAction:'Execute only with a separate admitted host capability.'}
  const agentRecord = {agentDecisions:[{decision:'Use single-file test operation',rationale:'Controlled offline fixture.'}],assumptions:[],
    minimumTaskModel:{type:'disposable_file',description:'Restricted file output and explicit independent criterion.'},
    minimumPrototype:{type:'file_outline',description:master.minimumPrototype},
    definitions:{correct:'Declared byte/JSON criterion satisfied.',usable:'File readable within authorized workspace.',done:'Complete correlated trace and fresh independent file inspection both pass.'},
    verificationRequired:checks.map(c=>({item:criterion(c),howToVerify:'Read actual file independently; compare bytes/hash or parsed enabled property.'})),blockReason:null,degradePlan:null}
  const confirmation = {version:'master_runtime_confirmation.v1',taskId:name,goalConfirmation:{goal,status:'confirmed'},
    authorization:{contractSha256:contractHash(master),...master.executionContract,shouldCreateAgent:false},
    assumptionConfirmations:[],userDecisions:[],execution:{authorized:true,workspace,writeFiles:[file],checks,maxRepairs:2}}
  // This host message is fabricated by the deterministic test controller and
  // explicitly labelled Mock. It is NEVER real user authorization to run DSH.
  const userEvent = {type:'user/message',seq:initialEvents.length,time:initialEvents.length,data:{role:'user',id:`mock-user-${name}`,source:{kind:'user'},content:[{type:'text',text:JSON.stringify(confirmation)}]}}
  const port = createHostPort({sessionId:`mock-${name}`,taskId:name,evidenceLevel})
  const receipt = port.admitUserEvent(userEvent)
  const prepared = await prepareExecution({master,agentRecord,receipt,workspace,evidenceDirectory:join(directory,'evidence'),frameworkDir:process.env.MASTER_DSH_FRAMEWORK})
  if (prepared.result.status !== 'READY') throw new Error(JSON.stringify(prepared.result.diagnostics))
  const observer = new TraceObserver({sessionId:`mock-${name}`,taskId:name,candidateHash:contractHash(prepared.result.candidate),evidenceLevel})
  initialEvents.forEach(e=>observer.observe(e))
  observer.observe(userEvent)
  return {directory,workspace,master,agentRecord,confirmation,userEvent,port,receipt,observer,...prepared}
}
export function appendMock(c,type,data,extra={}) {
  const seq = c.observer.snapshot().events.length
  const event = {type,seq,time:seq,data,...extra}
  c.observer.observe(event)
  return event
}
export async function mockWrite(c,{file='hello.txt',content='hello master',failure=false,omitResult=false}={}) {
  const gate = claimOperation(c.permit,c.result.candidate,{name:'write',file})
  if (!gate.allowed) return {gate,performed:false}
  const callId = `mock-call-${c.observer.snapshot().calls.length+1}`
  const call = appendMock(c,'tool/call',{turn:1,step:1,callId,name:'write',arguments:JSON.stringify({file_path:file,content})})
  if (!failure) await writeFile(join(c.workspace,file),content)
  if (!omitResult) appendMock(c,'tool/result',{turn:1,step:1,message:{role:'tool',source:{kind:'tool',callId},toolCallId:callId,isError:failure,content:[{type:'text',text:failure?'Controlled failure':'ok'}]},...(failure?{error:{code:'MOCK_FAILURE'}}:{})},{sourceEventSeqs:[call.seq]})
  return {gate,performed:true,callId}
}
export async function closeMock(c,verification,reason='completed') {
  appendMock(c,'turn/end',{turn:1,reason:{kind:reason}})
  const traceSha256 = await c.observer.flush(join(c.directory,'trace.json'))
  const acceptance = await finalAcceptance({permit:c.permit,observer:c.observer,verificationReceipt:verification?.receipt,traceSha256})
  await writeFile(join(c.directory,'acceptance.json'),JSON.stringify(acceptance,null,2)+'\n',{flag:'wx'})
  return acceptance
}

export async function runScenarios(base) {
  const cases = []
  const a = await setupCase(base,'A')
  await mockWrite(a)
  const av = await verifyGoal(a.permit)
  cases.push({case:'A',actualExecution:true,runtime:'deterministic Node file controller, not DSH',masterBehavior:'Mock plan: clear goal; zero questions',acceptance:await closeMock(a,av)})

  const question = '你希望优化后达到什么可验证的结果？'
  const vague = '帮我把这个小项目优化一下。'
  const clarifyMaster = {version:'master_output_contract.v1',decision:'clarify',phase:'phase_1b',realGoal:vague,
    nonGoals:[],executionClarity:{score:20,rationale:'Success condition unspecified; scripted Mock decision.'},minimumPrototype:null,
    executionContract:{allowedActions:[],forbiddenActions:['Any project changes before confirmation'],riskBoundaries:['No authorized optimization direction'],validationPlan:[]},shouldCreateAgent:false,nextAction:question}
  const clarifyFields = {goalConfirmation:{goal:vague,status:'working'},authorization:null,userDecisions:[{question,whyUser:'Only user can define desired result',impactIfUnknown:'high'}],
    agentDecisions:[],assumptions:[],assumptionConfirmations:[],minimumTaskModel:null,minimumPrototype:null,definitions:{correct:null,usable:null,done:null},verificationRequired:[],blockReason:null,degradePlan:null}
  const clarifyDirectory=join(base,'B-clarification');await mkdir(clarifyDirectory)
  const clarifyBytes=JSON.stringify(clarifyFields,null,2)+'\n';await writeFile(join(clarifyDirectory,'mock-agent.json'),clarifyBytes,{flag:'wx'})
  const clarifyEvidence={version:'master_dsh_evidence.v1',masterSha256:contractHash(clarifyMaster),sources:[{id:'agent',kind:'agent',path:'mock-agent.json',sha256:sha256(clarifyBytes)}],
    fieldRefs:Object.keys(clarifyFields).map(field=>({field,sourceId:'agent',pointer:`/${field}`}))}
  const clarifyResult=await adapt(clarifyMaster,clarifyEvidence,{evidenceRoot:clarifyDirectory,frameworkDir:process.env.MASTER_DSH_FRAMEWORK})
  if(clarifyResult.status!=='READY')throw new Error(JSON.stringify(clarifyResult.diagnostics))
  await writeFile(join(clarifyDirectory,'adapter-result.json'),JSON.stringify(clarifyResult,null,2)+'\n',{flag:'wx'})
  const before = executionGate(null,clarifyResult.candidate,{name:'write',file:'hello.txt'})
  const b = await setupCase(base,'B-confirmed',{initialEvents:[
    {seq:0,time:0,type:'user/message',data:{role:'user',source:{kind:'user'},content:[{type:'text',text:vague}]}},
    {seq:1,time:1,type:'assistant/message',data:{message:{role:'assistant',content:[{type:'text',text:question}]}}}
  ]})
  // No natural-language semantic judge exists here. This is a scripted turn,
  // followed by a distinct synthetic host confirmation and new bound contract.
  await mockWrite(b)
  cases.push({case:'B',actualExecution:true,runtime:'Mock',question,questionCount:1,anchoredMenu:false,initialWriteDenied:!before.allowed,
    clarificationCandidateDecision:clarifyResult.candidate.decision,clarificationContractHash:contractHash(clarifyMaster),subsequentConfirmationSeq:b.userEvent.seq,subsequentContractHash:contractHash(b.master),masterBehavior:'Scripted clarification only; real intent interpretation unverified',acceptance:await closeMock(b,await verifyGoal(b.permit))})

  const c = await setupCase(base,'C',{file:'config-a.json',goal:'只修改测试目录中的 config-a.json，将 enabled 改为 true。',checks:[{kind:'enabled',file:'config-a.json'}]})
  await writeFile(join(c.workspace,'config-a.json'),'{"enabled":false}')
  await writeFile(join(c.workspace,'config-b.json'),'{"enabled":false}')
  const wrong = await mockWrite(c,{file:'config-b.json',content:'{"enabled":true}'})
  const observedDrift = await verifyGoal(c.permit)
  const repairRound = beginRepair(c.permit)
  await mockWrite(c,{file:'config-a.json',content:'{"enabled":true}'})
  const unchangedB = await readFile(join(c.workspace,'config-b.json'),'utf8') === '{"enabled":false}'
  cases.push({case:'C',actualExecution:true,runtime:'Mock',driftOrigin:'controller injected wrong-file proposal',wrongProposalDenied:!wrong.gate.allowed,
    observedTargetMismatch:!observedDrift.passed,unchangedB,repairRound,masterBehavior:'Independent deterministic verifier detected target mismatch; Master model did not observe or correct anything',acceptance:await closeMock(c,await verifyGoal(c.permit))})

  const d = await setupCase(base,'D')
  await mockWrite(d,{failure:true})
  const repairs = []
  for (let i=0;i<2;i++) {
    const beforeVerification = await verifyGoal(d.permit)
    const round = beginRepair(d.permit)
    await mockWrite(d,{failure:true})
    const after = await verifyGoal(d.permit)
    repairs.push({round,beforePassed:beforeVerification.passed,afterPassed:after.passed})
  }
  let stopped = false
  try { beginRepair(d.permit) } catch { stopped = true }
  cases.push({case:'D',actualExecution:true,runtime:'Mock controlled failing tool',repairs,stoppedAtLimit:stopped,masterBehavior:'Deterministic controller; no model repair decisions',acceptance:await closeMock(d,await verifyGoal(d.permit),'error')})

  const e = await setupCase(base,'E')
  await mockWrite(e,{omitResult:true})
  cases.push({case:'E',actualExecution:true,runtime:'Mock',missing:'tool result deliberately omitted; no record synthesized',masterBehavior:'Evidence guard blocks completed claim',acceptance:await closeMock(e,await verifyGoal(e.permit))})
  const summary = {version:'master_dsh_offline_workflow.v1',evidenceLevel:'Mock',modelCalls:0,fullDshSession:false,cases,
    levels:{level1:'PASS',level2:'BLOCKED',level3:'BLOCKED'},realSessionPreflight:realSessionPreflight()}
  // Fail if the expected safeguards did not actually occur; no unconditional PASS.
  if (!(cases[0].acceptance.goalCompleted && cases[1].initialWriteDenied && cases[1].acceptance.goalCompleted && cases[2].wrongProposalDenied && cases[2].observedTargetMismatch && cases[2].unchangedB && cases[2].acceptance.goalCompleted && cases[3].stoppedAtLimit && !cases[3].acceptance.goalCompleted && cases[4].acceptance.status === 'unverifiable'))
    throw new Error('Offline scenario acceptance failed')
  await writeFile(join(base,'results.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'})
  return summary
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = await mkdtemp(join(ROOT,'.local/dsh-runtime-e2e-'))
  const result = await runScenarios(base)
  console.log(JSON.stringify({output:base,levels:result.levels,cases:result.cases.map(c=>({case:c.case,acceptance:c.acceptance.status})),modelCalls:0}))
}
