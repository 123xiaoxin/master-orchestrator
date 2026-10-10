# Master v1 → DSH v2.1 offline Contract Adapter

`adapter.mjs` converts an existing contract and sourced evidence, or refuses.
It does not decide user intent, advance phases, grant permissions, call Agents,
or certify execution. CI selects Node 22; local verification used Node 26.8.1. Only built-in modules
are used. No packages, models, credentials, or active DSH configuration needed.

## Invocation

From the repository root, with a new output directory beneath an existing
`.local` parent:

```powershell
node adapters/dsh-v2.1/adapter.mjs `
  --master tests/fixtures/dsh-adapter/master.v1.json `
  --evidence tests/fixtures/dsh-adapter/evidence.json `
  --evidence-root tests/fixtures/dsh-adapter `
  --trusted-user-source tests/fixtures/dsh-adapter/user-authority.json `
  --framework-dir C:/Users/tongk/.dsh/skills/master-orchestrator/framework `
  --output .local/dsh-adapter/new-run
```

All inputs are read-only. The output directory must not exist, its resolved
parent must be inside repository `.local`, and it is never overwritten. READY
writes `result.json` and `candidate.v2.1.json`; other statuses write only the
result. JSON is also emitted to stdout. Exit codes: READY=0, INVALID=1,
BLOCKED=2. CLI parse/I/O errors retain the same result shape and exit 1.

`--framework-dir` may be omitted to use `native/`, a byte-for-byte snapshot of
the actual installed Schema and two validators. `native-source-lock.json`
pins their SHA-256 and records original source/version, plus Framework and
semantic-definition hashes. Changed native files block before importing code;
review and repin only after a separate compatibility review. Master schema
changes also block. Snapshot files are not edited target definitions.

The API exports `adapt(master, evidence, {frameworkDir, evidenceRoot,
trustedUserSources})`, `contractHash`, and `sha256`. `contractHash` hashes UTF-8
JSON with recursively sorted object keys, compact separators, preserved array
order and unescaped Unicode. It is a content binding, not a user signature.

## Evidence envelope

`evidence.schema.json` specifies `master_dsh_evidence.v1`:

- `masterSha256`: exact `contractHash(master)`.
- `sources`: unique `{id,path,sha256,kind}` records. Path is relative to
  evidenceRoot; realpath/symlink escape is rejected. Source must be a readable
  JSON file with matching byte SHA-256. kind is user, agent or verification.
- `fieldRefs`: unique `{field,sourceId,pointer}` records; non-root JSON Pointers
  use standard `~0` and `~1` decoding and own-property lookup. Missing values
  are blocked; no implicit empty array/null/confirmation is fabricated.

All twelve referenced values must be supplied explicitly:

| Field | Required source value |
|---|---|
| goalConfirmation | `{goal,status}`; goal equals realGoal; status working or confirmed |
| authorization | `{contractSha256,allowedActions,forbiddenActions,riskBoundaries,shouldCreateAgent}`; exact contract binding and list/flag equality for execute/prototype/degrade |
| userDecisions | Native question/whyUser/impactIfUnknown array, explicit [] allowed |
| agentDecisions | Native decision/rationale array, explicit [] allowed |
| assumptions | Native assumption/reason/impact/reversible/confirmed/validation array |
| assumptionConfirmations | Explicit array of user-confirmed assumption text; may be [] when no assumptions claim confirmed |
| minimumTaskModel | Native `{type,description}` or explicit null for nonactionable states |
| minimumPrototype | Native `{type,description}` or explicit null; any non-null v1 description must be preserved verbatim |
| definitions | Native correct/usable/done object; execute requires three nonblank strings |
| verificationRequired | Native item/howToVerify array; every v1 validationPlan item needs a matching nonblank method for actionable conversion |
| blockReason | Native string/null, governed by decision |
| degradePlan | Native goal/loss/rationale object/null, governed by decision |

User authority is **out of band**: the host supplies canonical trusted user
paths in the API or repeated `--trusted-user-source` arguments. A `kind:user`
inside the evidence body cannot self-admit authority. Confirmed goals,
actionable authorization, confirmed assumptions and a changed degraded goal
require both admitted path and user kind. The trusted host is responsible for
authentic user origin, review of conditional grants, freshness/revocation and
semantic scope consistency. Hashes alone prove bytes, not identity or consent.
Never admit an arbitrary model-generated source as user-authoritative.

The checked-in positive fixture is specifically this user's current offline
Adapter task. Its host projection records literal task goal, permitted and
prohibited bullet text, quoted source sections and original attachment SHA-256.
The task model/prototype outline/verification plan are explicitly agent-authored
records, not a fabricated user reply or observed execution. Tests admit that
projection explicitly; they do not approve an unrelated business task. Negative
mutations are synthetic test records, not new user decisions.

## Mapping and refusal

The native field is `validationCriteria`, not `verificationCriteria`. All 22
required target fields are provided; no v1-only key is inserted into the target.
The result's separate audit record retains full Master v1, evidence references
and resolved fields. Only the candidate is sent to a DSH contract consumer.

decision is copied except require_more_information→clarify, the nonexecuting
clarification alias already defined by Core. phase, goal, nonGoals, clarity,
Agent flag and nextAction are preserved. taskScope copies allowedActions;
constraints retain explicit `Allowed action:`, `Forbidden action:` and `Risk
boundary:` clauses. risks copies riskBoundaries; validationCriteria copies the
entire validationPlan, preserving order and duplicates. Remaining fields come
only from references above. No phase_3→phase_4 promotion occurs.

READY requires source/evidence structure, provenance binding, required evidence,
adapter boundary checks and unmodified native L1/L2 success. A READY clarify
candidate is a clarification contract, not an executable contract. BLOCKED
means missing confirmation/authority/model/prototype/criteria/risk/dependency,
or changed unreviewed native/source-schema version. INVALID means malformed or
unsupported input, conflicting goals/prototypes/permissions, stale bindings,
source tampering/path escape, or native structural/governance rejection.

The deterministic conflict gate checks identical actions and explicit
Do not/Must not/禁止/不得 prefixes (with final period removed). It does not infer
synonyms, exceptions, path scope implications or arbitrary natural-language
contradictions. The host must resolve/normalize ambiguous permissions before
admission. A converter cannot replace semantic policy review or runtime
permission enforcement. Known textual boundaries are nevertheless preserved,
not silently omitted. Native warnings stay warnings, never score thresholds.

The native interpreter uses inherited-key lookup for additionalProperties. A
Schema-driven own-key guard rejects Object.prototype-named extra fields without
editing native sources; mappedOwnKeys is reported separately.

Every result has diagnostics and separate validation statuses for Master
structure, evidence structure, native structure and native governance. L2 is
not_run after L1 failure. No rejected candidate is exposed as `candidate` or
written to a candidate file. executionAuthorized, executionPerformed and
goalCompleted are always false: the adapter itself neither grants nor performs
execution, even when external authorization evidence is present.

## Repeatable verification

```powershell
node --test tests/dsh_adapter.test.mjs
# To repeat all tests against the actual installation rather than its snapshot:
$env:MASTER_DSH_FRAMEWORK = 'C:/Users/tongk/.dsh/skills/master-orchestrator/framework'
node --test tests/dsh_adapter.test.mjs
```

Restore the process environment after the second command. Local CI runs the
same 37 cases using locked native snapshots. Full DSH sessions, prototype
verification history, trace correlation, final goal acceptance and semantic
Agent behavior are outside this offline contract test and remain unverified.
