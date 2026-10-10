import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, mkdtemp, rm, cp } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { adapt, contractHash, sha256 } from '../adapters/dsh-v2.1/adapter.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURES = join(ROOT, 'tests/fixtures/dsh-adapter')
const FRAMEWORK = process.env.MASTER_DSH_FRAMEWORK || join(ROOT, 'adapters/dsh-v2.1/native')
const readJson = async filename => JSON.parse(await readFile(filename, 'utf8'))
const writeJson = (filename, value) => writeFile(filename, JSON.stringify(value, null, 2) + '\n')

async function context(t) {
  await mkdir(join(ROOT, '.local'), {recursive:true})
  const directory = await mkdtemp(join(ROOT, '.local/adapter-test-'))
  t.after(() => rm(directory, {recursive:true, force:true})) // Only the owned fresh test directory.
  const c = {directory, master:await readJson(join(FIXTURES, 'master.v1.json')),
    user:await readJson(join(FIXTURES, 'user-authority.json')),
    agent:await readJson(join(FIXTURES, 'agent-record.json')),
    evidence:await readJson(join(FIXTURES, 'evidence.json'))}
  c.options = {frameworkDir:FRAMEWORK, evidenceRoot:directory, trustedUserSources:[join(directory, 'user-authority.json')]}
  c.flush = async () => {
    c.evidence.masterSha256 = contractHash(c.master)
    c.user.authorization.contractSha256 = c.evidence.masterSha256
    for (const [filename, value] of [['master.v1.json', c.master], ['user-authority.json', c.user], ['agent-record.json', c.agent]])
      await writeJson(join(directory, filename), value)
    for (const source of c.evidence.sources) {
      if (source.path === 'user-authority.json' || source.path === 'agent-record.json')
        source.sha256 = sha256(await readFile(join(directory, source.path)))
    }
    await writeJson(join(directory, 'evidence.json'), c.evidence)
  }
  await c.flush()
  return c
}
const convert = c => adapt(c.master, c.evidence, c.options)
function rejects(result, status, category) {
  assert.equal(result.status, status)
  assert.equal(result.candidate, null)
  assert.equal(result.diagnostics[0].category, category)
  assert.equal(result.executionAuthorized, false)
  assert.equal(result.executionPerformed, false)
  assert.equal(result.goalCompleted, false)
}

test('actual-task positive fixture preserves permissions and all criteria; native L1/L2 pass', async t => {
  const c = await context(t), r = await convert(c)
  assert.equal(r.status, 'READY', JSON.stringify(r.diagnostics))
  assert.equal(r.validation.masterStructure.status, 'passed')
  assert.equal(r.validation.nativeStructure.status, 'passed')
  assert.equal(r.validation.nativeGovernance.status, 'passed')
  assert.equal(r.candidate.goal, c.master.realGoal)
  assert.deepEqual(r.candidate.nonGoals, c.master.nonGoals)
  assert.deepEqual(r.candidate.taskScope, c.master.executionContract.allowedActions)
  assert.deepEqual(r.candidate.validationCriteria, c.master.executionContract.validationPlan)
  assert.deepEqual(r.candidate.risks, c.master.executionContract.riskBoundaries)
  for (const item of c.master.executionContract.forbiddenActions) assert.ok(r.candidate.constraints.includes('Forbidden action: ' + item))
  assert.deepEqual(r.audit.master, c.master)
  assert.equal(r.executionPerformed, false)
})
test('missing goal confirmation reference blocks', async t => {
  const c = await context(t); c.evidence.fieldRefs = c.evidence.fieldRefs.filter(r => r.field !== 'goalConfirmation')
  rejects(await convert(c), 'BLOCKED', 'missing_user_confirmation')
})
test('working goal cannot become execute READY', async t => {
  const c = await context(t); c.user.goalConfirmation.status = 'working'; await c.flush()
  rejects(await convert(c), 'BLOCKED', 'missing_user_confirmation')
})
test('body cannot self-admit user authority', async t => {
  const c = await context(t); c.options.trustedUserSources = []
  rejects(await convert(c), 'BLOCKED', 'untrusted_user_evidence')
})
test('trusted path with agent kind cannot claim user confirmation', async t => {
  const c = await context(t); c.evidence.sources[0].kind = 'agent'
  rejects(await convert(c), 'BLOCKED', 'untrusted_user_evidence')
})
test('goal mismatch is a semantic conflict', async t => {
  const c = await context(t); c.user.goalConfirmation.goal = 'Another goal'; await c.flush()
  rejects(await convert(c), 'INVALID', 'goal_conflict')
})
test('missing authorization reference blocks', async t => {
  const c = await context(t); c.evidence.fieldRefs = c.evidence.fieldRefs.filter(r => r.field !== 'authorization')
  rejects(await convert(c), 'BLOCKED', 'missing_authorization')
})
test('text prototype does not manufacture a structured task model', async t => {
  const c = await context(t); c.agent.minimumTaskModel = null; await c.flush()
  rejects(await convert(c), 'BLOCKED', 'missing_task_model')
})
test('missing structured prototype blocks', async t => {
  const c = await context(t); c.agent.minimumPrototype = null; c.master.minimumPrototype = null; await c.flush()
  rejects(await convert(c), 'BLOCKED', 'missing_prototype')
})
test('same action cannot be allowed and forbidden', async t => {
  const c = await context(t); const action = c.master.executionContract.allowedActions[0]
  c.master.executionContract.forbiddenActions.push(action); c.user.authorization.forbiddenActions.push(action); await c.flush()
  rejects(await convert(c), 'INVALID', 'permission_conflict')
})
test('explicit do-not prefix cannot hide an action conflict', async t => {
  const c = await context(t); c.master.executionContract.allowedActions.push('Write user data')
  c.master.executionContract.forbiddenActions.push('Do not Write user data.')
  c.user.authorization.allowedActions.push('Write user data'); c.user.authorization.forbiddenActions.push('Do not Write user data.')
  await c.flush(); rejects(await convert(c), 'INVALID', 'permission_conflict')
})
test('authorization scope expansion cannot be silently accepted', async t => {
  const c = await context(t); c.user.authorization.allowedActions.push('Upload user data'); await c.flush()
  rejects(await convert(c), 'INVALID', 'permission_scope_conflict')
})
test('delegation permission must match', async t => {
  const c = await context(t); c.user.authorization.shouldCreateAgent = true; await c.flush()
  rejects(await convert(c), 'INVALID', 'delegation_permission_conflict')
})
test('explicit risk information is mandatory for actionable conversion', async t => {
  const c = await context(t); c.master.executionContract.riskBoundaries = []; c.user.authorization.riskBoundaries = []; await c.flush()
  rejects(await convert(c), 'BLOCKED', 'missing_risk_information')
})
test('missing done definition cannot be inferred from a clear goal', async t => {
  const c = await context(t); c.agent.definitions.done = null; await c.flush()
  rejects(await convert(c), 'BLOCKED', 'missing_verification')
})
test('missing criterion method cannot be dropped', async t => {
  const c = await context(t); c.agent.verificationRequired.pop(); await c.flush()
  rejects(await convert(c), 'BLOCKED', 'missing_verification')
})
test('require_more_information maps only to clarify, retaining working goal', async t => {
  const c = await context(t); c.master.decision = 'require_more_information'; c.master.minimumPrototype = null
  c.user.goalConfirmation.status = 'working'; c.agent.minimumPrototype = null; c.agent.minimumTaskModel = null
  c.agent.userDecisions = [{question:'What is the required outcome?', whyUser:'Only the user can confirm this value decision', impactIfUnknown:'high'}]
  await c.flush(); const r = await convert(c)
  assert.equal(r.status, 'READY', JSON.stringify(r.diagnostics)); assert.equal(r.candidate.decision, 'clarify')
  assert.equal(r.candidate.goalStatus, 'working'); assert.equal(r.executionAuthorized, false)
})
test('unknown version is rejected', async t => {
  const c = await context(t); c.master.version = 'master_output_contract.v9'
  rejects(await convert(c), 'INVALID', 'unsupported_contract_version')
})
test('illegal decision enum fails unchanged source schema', async t => {
  const c = await context(t); c.master.decision = 'launch'; await c.flush()
  rejects(await convert(c), 'INVALID', 'master_schema_error')
})
test('nested input type errors fail source schema', async t => {
  const c = await context(t); c.master.executionContract.allowedActions = 'read'; await c.flush()
  rejects(await convert(c), 'INVALID', 'master_schema_error')
})
test('Object.prototype named extra input fields cannot bypass additionalProperties false', async t => {
  const c = await context(t); c.master.toString = 'unknown own field'; await c.flush()
  rejects(await convert(c), 'INVALID', 'master_schema_error')
})
test('Object.prototype named extra mapped fields cannot bypass native subset', async t => {
  const c = await context(t); c.agent.minimumTaskModel.constructor = 'unknown own field'; await c.flush()
  rejects(await convert(c), 'INVALID', 'mapped_schema_own_key_error')
})
test('native structural rejection withholds candidate and skips governance', async t => {
  const c = await context(t); c.agent.minimumTaskModel = {type:'model'}; await c.flush()
  const r = await convert(c); rejects(r, 'INVALID', 'native_schema_rejection')
  assert.equal(r.validation.nativeStructure.status, 'failed'); assert.equal(r.validation.nativeGovernance.status, 'not_run')
})
test('native governance rejection cannot be bypassed by structural success', async t => {
  const c = await context(t); c.agent.definitions.done = c.agent.definitions.correct; await c.flush()
  const r = await convert(c); rejects(r, 'INVALID', 'native_governance_rejection')
  assert.equal(r.validation.nativeStructure.status, 'passed'); assert.equal(r.validation.nativeGovernance.status, 'failed')
})
test('unresolved high user decision is rejected by native governance', async t => {
  const c = await context(t); c.agent.userDecisions = [{question:'Approve external upload?',whyUser:'Changes data exposure',impactIfUnknown:'high'}]; await c.flush()
  rejects(await convert(c), 'INVALID', 'native_governance_rejection')
})
test('confirmed assumptions need actual admitted user matches', async t => {
  const c = await context(t); c.agent.assumptions = [{assumption:'External upload approved',reason:'Agent inferred it',impact:'high',reversible:false,confirmed:true,validation:'Review policy'}]; await c.flush()
  rejects(await convert(c), 'BLOCKED', 'missing_assumption_confirmation')
})
test('changed prototype text cannot be discarded', async t => {
  const c = await context(t); c.agent.minimumPrototype.description = 'Different prototype'; await c.flush()
  rejects(await convert(c), 'INVALID', 'prototype_conflict')
})
test('stale contract binding is invalid', async t => {
  const c = await context(t); c.evidence.masterSha256 = '0'.repeat(64)
  rejects(await convert(c), 'INVALID', 'evidence_binding_mismatch')
})
test('source tampering invalidates evidence', async t => {
  const c = await context(t); await writeFile(join(c.directory, 'user-authority.json'), '{}')
  rejects(await convert(c), 'INVALID', 'source_hash_mismatch')
})
test('evidence path cannot escape root', async t => {
  const c = await context(t)
  c.evidence.sources[0].path = '../../tests/fixtures/dsh-adapter/user-authority.json'
  rejects(await convert(c), 'INVALID', 'source_path_escape')
})
test('duplicate field references do not override authority', async t => {
  const c = await context(t); c.evidence.fieldRefs.push(c.evidence.fieldRefs[0])
  rejects(await convert(c), 'INVALID', 'duplicate_field')
})
test('adapter leaves both original inputs untouched', async t => {
  const c = await context(t); const before = JSON.stringify([c.master,c.evidence]); await convert(c)
  assert.equal(JSON.stringify([c.master,c.evidence]), before)
})
test('native low-score warning remains a warning, not a hard gate', async t => {
  const c = await context(t); c.master.executionClarity.score = 20; await c.flush(); const r = await convert(c)
  assert.equal(r.status, 'READY'); assert.ok(r.validation.nativeGovernance.warnings.length > 0)
})
test('changed native code is blocked before import', async t => {
  const c = await context(t); const dir = join(c.directory, 'native'); await cp(join(ROOT, 'adapters/dsh-v2.1/native'), dir, {recursive:true})
  await writeFile(join(dir, 'schema-validate.mjs'), 'throw new Error("must not import changed code")')
  c.options.frameworkDir = dir; rejects(await convert(c), 'BLOCKED', 'native_source_changed')
})
test('missing native environment blocks rather than issuing a candidate', async t => {
  const c = await context(t); c.options.frameworkDir = join(c.directory, 'not-installed')
  rejects(await convert(c), 'BLOCKED', 'missing_dependency_or_evidence')
})
test('malformed JSON CLI returns the same result shape without a candidate', async t => {
  const c = await context(t); await writeFile(join(c.directory, 'master.v1.json'), '{')
  const args = [join(ROOT,'adapters/dsh-v2.1/adapter.mjs'),'--master',join(c.directory,'master.v1.json'),
    '--evidence',join(c.directory,'evidence.json'),'--evidence-root',c.directory]
  let r
  try { execFileSync(process.execPath, args, {encoding:'utf8'}) } catch (error) { r = JSON.parse(error.stdout) }
  assert.equal(r.status, 'INVALID'); assert.equal(r.candidate, null)
  assert.equal(r.validation.nativeGovernance.status, 'not_run'); assert.equal(r.audit.master, null)
})
test('CLI invokes selected native implementation and only saves an offline candidate', async t => {
  const c = await context(t), out = join(c.directory, 'result')
  const args = [join(ROOT,'adapters/dsh-v2.1/adapter.mjs'),'--master',join(c.directory,'master.v1.json'),
    '--evidence',join(c.directory,'evidence.json'),'--evidence-root',c.directory,
    '--trusted-user-source',join(c.directory,'user-authority.json'),'--framework-dir',FRAMEWORK,'--output',out]
  const r = JSON.parse(execFileSync(process.execPath, args, {encoding:'utf8'}))
  assert.equal(r.status, 'READY'); assert.equal(r.executionPerformed, false)
  assert.deepEqual(await readJson(join(out,'candidate.v2.1.json')), r.candidate)
  assert.throws(() => execFileSync(process.execPath, args, {encoding:'utf8'}))
  assert.deepEqual(await readJson(join(out,'candidate.v2.1.json')), r.candidate)
})
