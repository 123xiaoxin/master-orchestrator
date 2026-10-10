import { readFile, writeFile, realpath, mkdir } from 'node:fs/promises'
import { realpathSync, lstatSync } from 'node:fs'
import { resolve, relative, isAbsolute, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { adapt, contractHash, sha256 } from '../dsh-v2.1/adapter.mjs'

const receipts = new WeakMap()
const permits = new WeakMap()
const inside = (root, path) => { const r = relative(root, path); return r !== '..' && !r.startsWith('../') && !r.startsWith('..\\') && !isAbsolute(r) }
const equal = (a, b) => contractHash(a) === contractHash(b)
const requireValue = (condition, message) => { if (!condition) throw new Error(message) }

/** Host-only capability boundary. JSON files cannot recreate its receipts.
 * Mock hosts must explicitly identify themselves; neither mode authenticates a
 * public network caller. The Cordis plugin supplies the actual session boundary.
 */
export function createHostPort({ sessionId, taskId, evidenceLevel }) {
  requireValue(['Mock', 'DSH component', 'DSH model session'].includes(evidenceLevel), 'Unknown evidence level')
  requireValue(sessionId && taskId, 'Session and task identity required')
  let lastSeq = -1
  return Object.freeze({
    admitUserEvent(event) {
      requireValue(event.type === 'user/message' && event.data?.source?.kind === 'user', 'Not an external user message')
      requireValue(Number.isSafeInteger(event.seq) && event.seq > lastSeq, 'Replayed or unordered user message')
      const content = event.data.content
      requireValue(Array.isArray(content) && content.length === 1 && content[0].type === 'text', 'One explicit structured host confirmation required')
      const value = JSON.parse(content[0].text)
      requireValue(value.version === 'master_runtime_confirmation.v1' && value.taskId === taskId, 'Wrong confirmation protocol or task')
      requireValue(value.goalConfirmation?.status === 'confirmed' && typeof value.goalConfirmation.goal === 'string', 'Goal not confirmed')
      requireValue(/^[a-f0-9]{64}$/u.test(value.authorization?.contractSha256), 'Missing bound authorization')
      requireValue(value.execution?.authorized === true, 'Independent execution permission missing')
      lastSeq = event.seq
      const receipt = Object.freeze({})
      receipts.set(receipt, { value: structuredClone(value), sessionId, taskId, seq:event.seq, evidenceLevel, eventSha256:contractHash(event) })
      return receipt
    }
  })
}

// Closed vocabulary for these disposable-file tests, not a semantic authority
// interpreter for unrestricted natural language contracts.
export function criterion(check) {
  if (check.kind === 'bytes' && /^[a-f0-9]{64}$/u.test(check.sha256)) return `bytes:${check.file}:${check.sha256}`
  if (check.kind === 'enabled') return `enabled:${check.file}:true`
  throw new Error('Unsupported independent verification')
}
function safeFile(root, file, allowMissing = true) {
  requireValue(typeof file === 'string' && file.length > 0 && !isAbsolute(file), 'Relative file required')
  const target = resolve(root, file)
  requireValue(inside(root, target) && target !== root, 'Workspace escape')
  const parent = realpathSync(dirname(target))
  requireValue(inside(root, parent), 'Parent symlink escape')
  try {
    requireValue(!lstatSync(target).isSymbolicLink(), 'Symlink target refused')
    requireValue(inside(root, realpathSync(target)), 'Target escape')
  } catch (error) { if (!(allowMissing && error.code === 'ENOENT')) throw error }
  return target
}

/** Feed the existing Adapter from admitted host evidence, then issue a separate
 * process-local execution capability. A READY JSON result alone grants nothing.
 */
export async function prepareExecution({ master, agentRecord, receipt, workspace, evidenceDirectory, frameworkDir }) {
  const host = receipts.get(receipt)
  requireValue(host, 'Untrusted or forged host receipt')
  requireValue(host.value.authorization.contractSha256 === contractHash(master), 'Stale confirmation')
  const root = await realpath(workspace)
  requireValue(root === resolve(host.value.execution.workspace), 'Wrong authorized workspace')
  const local = await realpath(resolve(dirname(fileURLToPath(import.meta.url)),'../../.local'))
  requireValue(inside(local,root) && root !== local, 'Only repository .local disposable workspaces are supported')
  const files = host.value.execution.writeFiles
  const checks = host.value.execution.checks
  requireValue(Array.isArray(files) && files.length > 0 && new Set(files).size === files.length, 'Explicit file scope required')
  requireValue(Array.isArray(checks) && checks.length > 0, 'Acceptance criteria required')
  requireValue(equal(master.executionContract.allowedActions, files.map(f => `write:${f}`)), 'File scope differs from contract')
  requireValue(equal(master.executionContract.validationPlan, checks.map(criterion)), 'Acceptance differs from contract')
  requireValue(host.value.execution.maxRepairs === 2 && master.shouldCreateAgent === false, 'Only bounded nondelegated tests supported')
  files.forEach(f => safeFile(root, f))
  checks.forEach(c => { requireValue(files.includes(c.file), 'Verification outside scope'); safeFile(root, c.file) })
  await mkdir(evidenceDirectory) // new directory only, never overwrite evidence
  const userPath = join(evidenceDirectory, 'host-user.json')
  const agentPath = join(evidenceDirectory, 'agent.json')
  const userBytes = JSON.stringify({...host.value, hostObservation:{sessionId:host.sessionId, seq:host.seq, eventSha256:host.eventSha256, evidenceLevel:host.evidenceLevel}}, null, 2) + '\n'
  const agentBytes = JSON.stringify(agentRecord, null, 2) + '\n'
  await writeFile(userPath, userBytes, {flag:'wx'})
  await writeFile(agentPath, agentBytes, {flag:'wx'})
  const userFields = ['goalConfirmation','authorization','assumptionConfirmations','userDecisions']
  const agentFields = ['agentDecisions','assumptions','minimumTaskModel','minimumPrototype','definitions','verificationRequired','blockReason','degradePlan']
  const evidence = {version:'master_dsh_evidence.v1', masterSha256:contractHash(master), sources:[
    {id:'host', path:'host-user.json', kind:'user', sha256:sha256(userBytes)},
    {id:'agent', path:'agent.json', kind:'agent', sha256:sha256(agentBytes)}
  ], fieldRefs:[...userFields.map(field => ({field,sourceId:'host',pointer:`/${field}`})), ...agentFields.map(field => ({field,sourceId:'agent',pointer:`/${field}`}))]}
  const result = await adapt(master, evidence, {evidenceRoot:evidenceDirectory, trustedUserSources:[userPath], frameworkDir})
  await writeFile(join(evidenceDirectory, 'adapter-result.json'), JSON.stringify(result,null,2)+'\n', {flag:'wx'})
  if (result.status !== 'READY') return {result, permit:null}
  requireValue(result.candidate.decision === 'execute', 'Nonexecution decision')
  const permit = Object.freeze({})
  permits.set(permit, {root,files:structuredClone(files),checks:structuredClone(checks), candidate:structuredClone(result.candidate), candidateHash:contractHash(result.candidate), masterHash:contractHash(master), host, repairs:0, awaitingVerification:false,verifiedRound:null,dispatchedRounds:new Set(),revision:0})
  return {result,permit}
}

export function executionGate(permit, candidate, operation, { requireModel = false } = {}) {
  try {
    const p = permits.get(permit)
    requireValue(p, 'Missing independent execution capability')
    requireValue(!requireModel || p.host.evidenceLevel === 'DSH model session', 'Mock/component permission cannot authorize a model session')
    requireValue(contractHash(candidate) === p.candidateHash, 'Candidate changed after validation')
    requireValue(operation.name === 'write' && p.files.includes(operation.file), 'Operation outside explicit file scope')
    requireValue(!p.dispatchedRounds.has(p.repairs), 'This execution/repair round already dispatched')
    safeFile(p.root, operation.file)
    return {allowed:true}
  } catch (error) { return {allowed:false, reason:error.message} }
}

export function claimOperation(permit,candidate,operation) {
  const gate = executionGate(permit,candidate,operation)
  if (gate.allowed) {
    const p = permits.get(permit)
    p.dispatchedRounds.add(p.repairs)
    p.revision++
  }
  return gate
}

export function beginRepair(permit) {
  const p = permits.get(permit)
  requireValue(p && !p.awaitingVerification && p.verifiedRound === p.repairs, 'Repair requires previous verification')
  requireValue(p.repairs < 2, 'Repair limit reached')
  p.repairs++
  p.awaitingVerification = true
  return p.repairs
}

/** Strict sidecar reconciliation of durable DSH event envelopes. No name-based
 * validation and no last-call association; each result cites ID and source seq.
 * Caller is the trusted runtime observer, not model-authored ledger JSON.
 */
export class TraceObserver {
  #events = []
  #calls = new Map()
  #violations = []
  #ended = false
  #flushed = null
  constructor({sessionId,taskId,candidateHash,evidenceLevel}) {
    Object.assign(this, {sessionId,taskId,candidateHash,evidenceLevel})
  }
  observe(event) {
    this.#flushed = null
    const e = structuredClone(event)
    if (e.seq !== this.#events.length) this.#violations.push('sequence_discontinuity')
    if (this.#ended) this.#violations.push('event_after_terminal')
    if (e.type === 'tool/call') {
      const id = e.data?.callId
      if (!id || this.#calls.has(id)) this.#violations.push('missing_or_duplicate_call_id')
      else this.#calls.set(id, {call:e,result:null})
    }
    if (e.type === 'tool/result') {
      const call = this.#calls.get(e.data?.message?.source?.callId)
      if (!call || call.result || !equal(e.sourceEventSeqs, [call.call.seq]) || e.data.turn !== call.call.data.turn || e.data.step !== call.call.data.step || typeof e.data.message.isError !== 'boolean')
        this.#violations.push('unmatched_result')
      else call.result = e
    }
    if (e.type === 'turn/end') this.#ended = true
    this.#events.push(e)
  }
  snapshot() {
    const calls = [...this.#calls.values()].map(c => structuredClone(c))
    const complete = this.#ended && calls.length > 0 && calls.every(c => c.result) && this.#violations.length === 0
    return {sessionId:this.sessionId,taskId:this.taskId,contractVersion:'master_execution_contract.v2.1',contractSha256:this.candidateHash,
      evidenceLevel:this.evidenceLevel,events:structuredClone(this.#events),calls,violations:[...this.#violations],complete,
      executionSuccess:complete && calls.every(c => c.result.data.message.isError === false && !c.result.data.error),
      // A terminal completed event is deliberately absent from this criterion.
      verificationSuccess:null,goalAcceptance:'not_evaluated'}
  }
  async flush(filename) {
    const data = JSON.stringify(this.snapshot(),null,2)+'\n'
    await writeFile(filename, data, {flag:'wx'})
    requireValue(sha256(await readFile(filename)) === sha256(data), 'Trace write verification failed')
    this.#flushed = {digest:sha256(data),filename}
    return this.#flushed.digest
  }
  async hasFlushed(digest) {
    if (!this.#flushed || this.#flushed.digest !== digest) return false
    try { return sha256(await readFile(this.#flushed.filename)) === digest }
    catch { return false }
  }
}

/** Independent file inspection, not model self-report. Narrow test oracle only. */
export async function verifyGoal(permit) {
  const p = permits.get(permit)
  requireValue(p, 'No bound verification policy')
  const results = []
  for (const check of p.checks) {
    try {
      const bytes = await readFile(safeFile(p.root,check.file,false))
      const passed = check.kind === 'bytes' ? sha256(bytes) === check.sha256 : JSON.parse(bytes.toString('utf8')).enabled === true
      results.push({criterion:criterion(check),file:check.file,observedSha256:sha256(bytes),passed})
    } catch (error) { results.push({criterion:criterion(check),file:check.file,passed:false,error:error.message}) }
  }
  p.awaitingVerification = false
  p.verifiedRound = p.repairs
  const receipt = Object.freeze({})
  // Separate receipt prevents imported JSON or an agent claim passing final acceptance.
  verifications.set(receipt,{permit,results,passed:results.every(r=>r.passed),repairs:p.repairs,revision:p.revision})
  return {receipt,results,passed:results.every(r=>r.passed)}
}
const verifications = new WeakMap()
export async function finalAcceptance({permit,observer,verificationReceipt,traceSha256}) {
  const p = permits.get(permit), v = verifications.get(verificationReceipt), t = observer.snapshot()
  const bound = p && v?.permit === permit && t.contractSha256 === p.candidateHash && t.sessionId === p.host.sessionId && t.taskId === p.host.taskId && t.evidenceLevel === p.host.evidenceLevel
  const verified = bound && v.repairs === p.repairs && v.revision === p.revision && t.complete && await observer.hasFlushed(traceSha256)
  const current = bound ? await verifyGoal(permit) : null
  const fresh = current?.passed && equal(current.results,v.results)
  const operationsInScope = bound && t.calls.every(c => {
    try { const args = JSON.parse(c.call.data.arguments); return c.call.data.name === 'write' && p.files.includes(args.file_path) && !!safeFile(p.root,args.file_path) }
    catch { return false }
  })
  const lastResult = t.calls.at(-1)?.result?.data
  const executionRecovered = lastResult?.message?.isError === false && !lastResult.error
  const terminalCompleted = t.events.at(-1)?.type === 'turn/end' && t.events.at(-1).data?.reason?.kind === 'completed'
  const accepted = verified && v.passed && fresh && operationsInScope && executionRecovered && terminalCompleted
  return {status:!verified ? 'unverifiable' : accepted ? 'accepted' : 'rejected',
    executionSuccess:t.executionSuccess,verificationSuccess:bound ? v.passed : null,
    executionRecovered,operationsInScope,goalCompleted:!!accepted,evidenceLevel:t.evidenceLevel,
    repairs:p?.repairs ?? null,criteria:v?.results ?? [],limitations:t.evidenceLevel === 'DSH model session' ? [] : ['No Master model behavior proven; deterministic/component evidence only.']}
}

/** No model launcher: hard gate until both budget and verified host routing exist. */
export function realSessionPreflight(input = {}) {
  const reasons = []
  for (const key of ['userModelAuthorization','modelAvailabilityConfirmed','isolatedProfile','scopedTools','logsReady','stopConditionsReady','noSensitiveData','hostRoutingVerified','hardBudgetEnforced'])
    if (input[key] !== true) reasons.push(key)
  for (const key of ['maxTokens','maxSessions','maxSteps']) if (!Number.isSafeInteger(input[key]) || input[key] <= 0) reasons.push(key)
  if (typeof input.model !== 'string' || !input.model.trim()) reasons.push('model')
  return {status:reasons.length ? 'BLOCKED' : 'READY_FOR_HOST_REVIEW',reasons,modelCalls:0,executionPerformed:false}
}
