import { readFile, realpath, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve, relative, isAbsolute, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const SOURCE = 'master_output_contract.v1'
const TARGET = 'master_execution_contract.v2.1'
const FIELDS = ['goalConfirmation', 'authorization', 'userDecisions', 'agentDecisions',
  'assumptions', 'assumptionConfirmations', 'minimumTaskModel', 'minimumPrototype',
  'definitions', 'verificationRequired', 'blockReason', 'degradePlan']
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const canonical = value => JSON.stringify(value && typeof value === 'object'
  ? Array.isArray(value) ? value.map(v => JSON.parse(canonical(v)))
    : Object.fromEntries(Object.keys(value).sort().map(k => [k, JSON.parse(canonical(value[k]))]))
  : value)
export const contractHash = value => sha256(canonical(value))
const equal = (a, b) => canonical(a) === canonical(b)
const within = (root, filename) => { const p = relative(root, filename); return p !== '..' && !p.startsWith('../') && !p.startsWith('..\\') && !isAbsolute(p) }
const json = bytes => JSON.parse(bytes.toString('utf8'))
const actionKey = text => text.trim().replace(/^(?:do not\s+|must not\s+|禁止|不得)/iu, '').trim().replace(/[.。]$/u, '')
// The native subset uses `in` for unknown keys. Own-key checking closes inherited
// Object.prototype names while still taking every field definition from Schema.
function ownKeyErrors(schema, value, path = '$') {
  const errors = []
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => errors.push(...ownKeyErrors(schema.items, v, `${path}[${i}]`)))
  else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties ?? {}
    if (schema.additionalProperties === false)
      for (const key of Object.keys(value)) if (!Object.hasOwn(properties, key)) errors.push(`${path}.${key}: unknown own field`)
    for (const [key, sub] of Object.entries(properties)) if (Object.hasOwn(value, key)) errors.push(...ownKeyErrors(sub, value[key], `${path}.${key}`))
  }
  return errors
}

class Rejection extends Error {
  constructor(status, code, field, message) { super(message); Object.assign(this, {status, code, field}) }
}
const reject = (status, code, field, message) => { throw new Rejection(status, code, field, message) }

export async function loadNative(frameworkDir = join(HERE, 'native')) {
  const lock = json(await readFile(join(HERE, 'native-source-lock.json')))
  const directory = await realpath(frameworkDir)
  const sourceHashes = {}
  for (const [name, expected] of Object.entries(lock.files).filter(([, item]) => item.vendored)) {
    const filename = await realpath(join(directory, name))
    if (!within(directory, filename)) reject('INVALID', 'native_source_escape', name, 'Native dependency escapes selected directory.')
    const bytes = await readFile(filename)
    const digest = sha256(bytes)
    if (digest !== expected.sha256) reject('BLOCKED', 'native_source_changed', name, 'Review the new native version before conversion.')
    sourceHashes[name] = digest
  }
  const structural = await import(pathToFileURL(join(directory, 'schema-validate.mjs')).href)
  const governance = await import(pathToFileURL(join(directory, 'validate-contract.mjs')).href)
  const schema = json(await readFile(join(directory, 'master_execution_contract.v2.1.schema.json')))
  if (schema.properties.schemaVersion.const !== TARGET) reject('INVALID', 'unsupported_target_version', 'schemaVersion', 'Unexpected native target identity.')
  return {schema, validate: structural.validateAgainstSchema, check: governance.checkContract,
    directory, sourceHashes, frameworkVersion: lock.frameworkVersion, masterSchemaSha256:lock.masterSchemaSha256,
    sourceLockSha256:sha256(await readFile(join(HERE, 'native-source-lock.json')))}
}

function pointer(document, path) {
  if (!path.startsWith('/')) reject('INVALID', 'invalid_pointer', path, 'Use a non-root JSON Pointer.')
  let value = document
  for (const token of path.slice(1).split('/')) {
    if (/~(?![01])/u.test(token)) reject('INVALID', 'invalid_pointer', path, 'Invalid JSON Pointer escape.')
    const key = token.replace(/~1/g, '/').replace(/~0/g, '~')
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key))
      reject('BLOCKED', 'missing_evidence_value', path, 'Referenced evidence value is missing.')
    value = value[key]
  }
  return structuredClone(value)
}

/** READY means an offline candidate only. The caller owns trusted user-source admission. */
function emptyResult() {
  return {version: 'master_dsh_adapter_result.v1', status: 'INVALID', candidate: null,
    diagnostics: [], validation: {masterStructure: {status:'not_run'}, evidenceStructure:{status:'not_run'},
      nativeStructure:{status:'not_run'}, nativeGovernance:{status:'not_run'}, mappedOwnKeys:{status:'not_run'}},
    executionAuthorized: false, executionPerformed: false, goalCompleted: false,
    audit: {master: null, evidence: null, resolvedFields: null}, provenance: {adapterVersion:'1.0.0-draft'}}
}
export async function adapt(masterInput, evidenceInput, options = {}) {
  const result = emptyResult()
  try {
    // Non-JSON API inputs (for example cycles) must fail before entering the audit record.
    JSON.stringify(masterInput)
    JSON.stringify(evidenceInput)
    const master = structuredClone(masterInput)
    const evidence = structuredClone(evidenceInput)
    result.audit.master = master
    result.audit.evidence = evidence
    if (master?.version !== SOURCE) reject('INVALID', 'unsupported_contract_version', 'version', 'Expected Master v1.')
    if (evidence?.version !== 'master_dsh_evidence.v1') reject('INVALID', 'unsupported_evidence_version', 'version', 'Expected adapter evidence v1.')
    const native = await loadNative(options.frameworkDir)
    result.provenance.native = {directory:native.directory, sourceHashes:native.sourceHashes, frameworkVersion:native.frameworkVersion, contract:TARGET}
    const masterBytes = await readFile(join(ROOT, 'schemas/master_output_contract.v1.schema.json'))
    result.provenance.masterSchemaSha256 = sha256(masterBytes)
    result.provenance.adapterSha256 = sha256(await readFile(fileURLToPath(import.meta.url)))
    result.provenance.nativeSourceLockSha256 = native.sourceLockSha256
    if (result.provenance.masterSchemaSha256 !== native.masterSchemaSha256)
      reject('BLOCKED', 'source_contract_schema_changed', 'masterSchema', 'Review source schema changes before conversion.')
    const masterSchema = json(masterBytes)
    const sourceErrors = [...native.validate(masterSchema, master), ...ownKeyErrors(masterSchema, master)]
    result.validation.masterStructure = {status: sourceErrors.length ? 'failed' : 'passed', errors:sourceErrors, engine:'native + Schema-driven own-key guard'}
    if (sourceErrors.length) reject('INVALID', 'master_schema_error', 'master', 'Master input fails its unchanged source schema.')
    const evidenceSchema = json(await readFile(join(HERE, 'evidence.schema.json')))
    const envelopeErrors = [...native.validate(evidenceSchema, evidence), ...ownKeyErrors(evidenceSchema, evidence)]
    result.validation.evidenceStructure = {status:envelopeErrors.length ? 'failed' : 'passed', errors:envelopeErrors}
    if (envelopeErrors.length) reject('INVALID', 'evidence_schema_error', 'evidence', 'Evidence reference envelope is malformed.')
    const digest = contractHash(master)
    result.provenance.masterSha256 = digest
    result.provenance.evidenceSha256 = contractHash(evidence)
    if (evidence.masterSha256 !== digest) reject('INVALID', 'evidence_binding_mismatch', 'masterSha256', 'Evidence targets a different Master contract.')
    const sourceRoot = await realpath(options.evidenceRoot)
    const trusted = new Set(await Promise.all((options.trustedUserSources ?? []).map(p => realpath(p))))
    const sources = new Map()
    for (const source of evidence.sources) {
      if (sources.has(source.id)) reject('INVALID', 'duplicate_source', source.id, 'Duplicate evidence source ID.')
      if (!/^[a-f0-9]{64}$/u.test(source.sha256)) reject('INVALID', 'invalid_source_hash', source.id, 'Expected SHA-256 hex.')
      if (isAbsolute(source.path)) reject('INVALID', 'source_path_escape', source.id, 'Evidence paths must be relative to evidenceRoot.')
      let filename
      try { filename = await realpath(resolve(sourceRoot, source.path)) }
      catch { reject('BLOCKED', 'missing_evidence_source', source.id, 'Evidence source is not readable.') }
      if (!within(sourceRoot, filename)) reject('INVALID', 'source_path_escape', source.id, 'Evidence source escapes evidenceRoot.')
      const bytes = await readFile(filename)
      if (sha256(bytes) !== source.sha256) reject('INVALID', 'source_hash_mismatch', source.id, 'Evidence source bytes changed.')
      let document
      try { document = json(bytes) } catch { reject('INVALID', 'source_format_error', source.id, 'Evidence sources must be JSON records.') }
      sources.set(source.id, {...source, filename, document, trusted:source.kind === 'user' && trusted.has(filename)})
    }
    const refs = new Map()
    for (const ref of evidence.fieldRefs) {
      if (refs.has(ref.field)) reject('INVALID', 'duplicate_field', ref.field, 'Duplicate field reference.')
      if (!sources.has(ref.sourceId)) reject('BLOCKED', 'missing_evidence_source', ref.field, 'Referenced source ID is missing.')
      refs.set(ref.field, ref)
    }
    const values = {}
    for (const field of FIELDS) {
      const ref = refs.get(field)
      if (!ref) {
        const code = field === 'goalConfirmation' ? 'missing_user_confirmation' : field === 'authorization' ? 'missing_authorization'
          : field === 'definitions' || field === 'verificationRequired' ? 'missing_verification' : 'missing_evidence_field'
        reject('BLOCKED', code, field, 'Provide an explicit sourced field, including an explicit null/empty value when appropriate.')
      }
      values[field] = pointer(sources.get(ref.sourceId).document, ref.pointer)
    }
    result.audit.resolvedFields = structuredClone(values)
    result.provenance.evidenceSources = evidence.sources.map(s => ({id:s.id, sha256:s.sha256, path:s.path, kind:s.kind}))
    const requireUser = field => {
      if (!sources.get(refs.get(field).sourceId).trusted)
        reject('BLOCKED', 'untrusted_user_evidence', field, 'User authority must be admitted by the host outside the evidence body.')
    }
    const confirmation = values.goalConfirmation
    if (!confirmation || !['working','confirmed'].includes(confirmation.status) || typeof confirmation.goal !== 'string')
      reject('INVALID', 'confirmation_format_error', 'goalConfirmation', 'Expected {goal,status}.')
    if (confirmation.goal !== master.realGoal) reject('INVALID', 'goal_conflict', 'goalConfirmation', 'Evidence and Master goal differ.')
    if (confirmation.status === 'confirmed') requireUser('goalConfirmation')
    const decision = master.decision === 'require_more_information' ? 'clarify' : master.decision
    if (decision === 'execute' && confirmation.status !== 'confirmed') reject('BLOCKED', 'missing_user_confirmation', 'goalConfirmation', 'Execute requires a confirmed goal.')
    const contract = master.executionContract
    const forbiddenKeys = new Set(contract.forbiddenActions.map(actionKey))
    if (contract.allowedActions.some(a => forbiddenKeys.has(actionKey(a))))
      reject('INVALID', 'permission_conflict', 'allowedActions', 'The same action is allowed and forbidden (literal or explicit prohibition prefix).')
    const active = ['execute','prototype','degrade'].includes(decision)
    if (active) {
      requireUser('authorization')
      const authority = values.authorization
      if (!authority || authority.contractSha256 !== digest) reject('BLOCKED', 'missing_authorization', 'authorization', 'Authorization must bind this exact contract.')
      for (const field of ['allowedActions','forbiddenActions','riskBoundaries']) {
        if (!equal(authority[field], contract[field])) reject('INVALID', 'permission_scope_conflict', field, 'Authorization and contract action/boundary lists differ.')
      }
      if (authority.shouldCreateAgent !== master.shouldCreateAgent) reject('INVALID', 'delegation_permission_conflict', 'shouldCreateAgent', 'Delegation authority differs.')
      if (!contract.riskBoundaries.length) reject('BLOCKED', 'missing_risk_information', 'riskBoundaries', 'Actionable conversion requires explicit risk boundaries.')
      if (!contract.validationPlan.length || !Array.isArray(values.verificationRequired) || !values.verificationRequired.length)
        reject('BLOCKED', 'missing_verification', 'verificationRequired', 'Actionable conversion needs criteria and verification methods.')
      for (const criterion of contract.validationPlan) {
        if (!values.verificationRequired.some(v => v?.item === criterion && typeof v.howToVerify === 'string' && v.howToVerify.trim()))
          reject('BLOCKED', 'missing_verification', 'verificationRequired', 'A Master validation criterion lacks a sourced verification method.')
      }
    }
    if (['execute','prototype'].includes(decision)) {
      for (const field of ['minimumTaskModel','minimumPrototype'])
        if (values[field] === null) reject('BLOCKED', field === 'minimumTaskModel' ? 'missing_task_model' : 'missing_prototype', field, 'Provide the structured source; adapter cannot invent it.')
    }
    if (decision === 'execute' && (!values.definitions || ['correct','usable','done'].some(k => typeof values.definitions[k] !== 'string' || !values.definitions[k].trim())))
      reject('BLOCKED', 'missing_verification', 'definitions', 'Execute requires sourced correct/usable/done definitions.')
    if (master.minimumPrototype !== null && values.minimumPrototype?.description !== master.minimumPrototype)
      reject('INVALID', 'prototype_conflict', 'minimumPrototype', 'A non-null Master prototype must be preserved verbatim.')
    if (Array.isArray(values.assumptions)) {
      const confirmed = values.assumptions.filter(a => a?.confirmed === true)
      if (confirmed.length) {
        requireUser('assumptionConfirmations')
        if (!Array.isArray(values.assumptionConfirmations) || confirmed.some(a => !values.assumptionConfirmations.includes(a.assumption)))
          reject('BLOCKED', 'missing_assumption_confirmation', 'assumptions', 'Confirmed assumptions require explicit user-sourced matches.')
      }
    }
    if (decision === 'degrade' && values.degradePlan?.goal !== master.realGoal) requireUser('degradePlan')
    const candidate = {schemaVersion:TARGET, decision, phase:master.phase, goal:master.realGoal,
      goalStatus:confirmation.status, nonGoals:structuredClone(master.nonGoals),
      constraints:[...contract.allowedActions.map(a => 'Allowed action: ' + a),
        ...contract.forbiddenActions.map(a => 'Forbidden action: ' + a),
        ...contract.riskBoundaries.map(a => 'Risk boundary: ' + a)],
      taskScope:structuredClone(contract.allowedActions), risks:structuredClone(contract.riskBoundaries),
      validationCriteria:structuredClone(contract.validationPlan), executionClarity:structuredClone(master.executionClarity),
      shouldCreateAgent:master.shouldCreateAgent, nextAction:master.nextAction}
    for (const field of ['userDecisions','agentDecisions','assumptions','minimumTaskModel','minimumPrototype','definitions','verificationRequired','blockReason','degradePlan'])
      candidate[field] = structuredClone(values[field])
    const structuralErrors = native.validate(native.schema, candidate)
    result.validation.nativeStructure = {status:structuralErrors.length ? 'failed' : 'passed', errors:structuralErrors}
    const ownErrors = ownKeyErrors(native.schema, candidate)
    result.validation.mappedOwnKeys = {status:ownErrors.length ? 'failed' : 'passed', errors:ownErrors}
    if (ownErrors.length) reject('INVALID', 'mapped_schema_own_key_error', 'candidate', 'Mapped object includes Schema-forbidden own fields; native sources remain unchanged.')
    // Always use the unmodified native combined validator; it deliberately skips L2 after L1 failure.
    const checked = native.check(candidate, native.schema)
    const governanceErrors = checked.errors.filter(e => e.startsWith('[L2]'))
    result.validation.nativeGovernance = {status:structuralErrors.length ? 'not_run' : governanceErrors.length ? 'failed' : 'passed', errors:governanceErrors, warnings:checked.warnings}
    if (checked.errors.length || structuralErrors.length) reject('INVALID', structuralErrors.length ? 'native_schema_rejection' : 'native_governance_rejection', 'candidate', 'Native validator rejected the candidate; nothing executable is emitted.')
    result.status = 'READY'
    result.candidate = candidate
    result.provenance.candidateSha256 = contractHash(candidate)
    return result
  } catch (error) {
    const missing = ['ENOENT','EACCES'].includes(error.code)
    result.status = error instanceof Rejection ? error.status : missing ? 'BLOCKED' : 'INVALID'
    result.diagnostics.push({category:error instanceof Rejection ? error.code : missing ? 'missing_dependency_or_evidence' : 'adapter_io_or_format_error',
      field:error.field ?? '', message:error.message})
    return result
  }
}

async function cli() {
  const args = process.argv.slice(2), options = {trustedUserSources:[]}
  for (let i = 0; i < args.length; i++) {
    const key = args[i], value = args[++i]
    if (!value) throw new Error('Missing argument value.')
    if (key === '--trusted-user-source') options.trustedUserSources.push(resolve(value))
    else if (key === '--master') options.master = resolve(value)
    else if (key === '--evidence') options.evidence = resolve(value)
    else if (key === '--evidence-root') options.evidenceRoot = resolve(value)
    else if (key === '--framework-dir') options.frameworkDir = resolve(value)
    else if (key === '--output') options.output = resolve(value)
    else throw new Error('Unknown argument: ' + key)
  }
  if (!options.master || !options.evidence || !options.evidenceRoot) throw new Error('--master --evidence --evidence-root required.')
  const result = await adapt(json(await readFile(options.master)), json(await readFile(options.evidence)), options)
  if (options.output) {
    const local = await realpath(join(ROOT, '.local'))
    if (!within(local, options.output) || options.output === local) throw new Error('Output must be a new directory below repository .local.')
    // mkdir without recursive refuses overwriting an existing output; parent must already be isolated.
    const parent = await realpath(dirname(options.output))
    if (!within(local, parent)) throw new Error('Output parent escapes .local.')
    await mkdir(options.output)
    await writeFile(join(options.output, 'result.json'), JSON.stringify(result, null, 2) + '\n')
    if (result.status === 'READY') await writeFile(join(options.output, 'candidate.v2.1.json'), JSON.stringify(result.candidate, null, 2) + '\n')
  }
  console.log(JSON.stringify(result))
  process.exitCode = result.status === 'READY' ? 0 : result.status === 'BLOCKED' ? 2 : 1
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch(error => {
    const result = emptyResult()
    result.diagnostics.push({category:'cli_io_or_format_error', field:'', message:error.message})
    console.log(JSON.stringify(result))
    process.exitCode = 1
  })
}
