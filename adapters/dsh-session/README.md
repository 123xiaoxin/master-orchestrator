# Gated native DSH session host

This small host composes the installed DSH components and reuses the existing
Master v1 Adapter and execution sidecar. It is not a new Agent loop, a second
contract standard, or the DSH headless/Preset loader. Real providers and
production file execution are deliberately **BLOCKED**.

The optional `readOnlyIntent` host mode registers no file tools and denies every
tool dispatch, including later registration. It additionally assembles module 06
with the entry and required modules, checking packaged source/artifact hashes.
`deepseek-readonly.mjs` selects only `deepseek-official/deepseek-flash` through
the installed native DeepSeekAdapter's Messages protocol, with thinking off.
Network remains closed: only component mode can use the intercepted transport;
live input-token bound certification and actual billing/remote cancellation
evidence remain engineering blockers, independent of user budget approval.
`scripts/dsh_readonly_probe.cjs` accepts the same three paths as the Provider
probe and NEVER forwards fetch. Its two replies are labelled Mock fixtures.
`evals/readonly-intent` provides synthetic split samples and a manual semantic
review interface; no paid model or Judge is invoked.

`controlled-provider.mjs` now decorates the native LlmAdapter boundary. It uses
local metadata for preparation, then checks the entire request and reserves the
existing BudgetLedger before touching even the delegate's preparation method.
Only an explicitly approved `offline-fixture` protocol is admitted; a network
transport cannot be enabled by setting a JSON flag. Its byte/framing input bound
is specific to that fixture, not a claim about a real tokenizer. Provider policy
hash and price provenance are bound into the private budget approval.

`scripts/dsh_provider_probe.cjs` takes the same three paths as the session script
without a mode argument. It runs the shared Provider cases through the actual
installed LlmRuntime, then a fully composed Agent, using an in-memory delegate.
`tests/dsh_provider.test.mjs` runs the portable decorator unit harness in CI.
Cancellation is observed by the fixture; real service cancellation, account
limits, billing and production filesystem confinement still need acceptance.

## Components and entry

`native-host.mjs` verifies nine installed entry-file hashes in
`native-runtime-source-lock.json`, then awaits actual Cordis plugins:
SystemPrompt, SessionStore, SessionProjectionRegistry, ToolRuntime, LlmRuntime,
AgentRegistry and AgentLoop. It uses the actual filesystem Skill provider with
only an isolated custom root. Packaged source/artifact hashes and required
modules 01/05/07/08 are checked before agent-scoped SystemPrompt assembly.
Rules reaching assembly does not establish model compliance.

Run `scripts/dsh_session_wiring.cjs` in the reviewed installed Electron Node
host with `ELECTRON_RUN_AS_NODE=1` and `--expose-internals`. Its arguments are:

```text
<@deepseek-ai package directory> <isolated directory containing master-skill>
<fresh absolute repository .local output directory> <mode>
```

Quote paths containing spaces. Restore the original environment afterward.
The script refuses existing output directories and writes only under `.local`.
The Skill directory contains the packaged `master-skill` folder, not source
prompts or the flat build output itself. No additional dependencies are needed.

Modes:

- `--prepare`: creates the real Agent and exercises blocked admission; no model.
- `--component-test`: additionally uses explicitly synthetic authenticated
  controller declarations, the actual Adapter/native L1/L2, real host-driven
  ToolRuntime write/read, and one local fixture usage stream. No model/provider.
- `--serve-gated`: requires an actual interactive input/output TTY and waits for
  termination. It prints a short-lived private operator capability only to that
  console. Both real-model and production-write gates remain closed. This mode
  has not been enrolled with a real human in this verification.

The fixed generated profile is a controlled host composition input, not a
purported DSH CLI configuration format. No current global Preset is loaded.

## Authorization and budgets

`ingress.mjs` implements a private POST `/operator` loopback transport, not an
invented DSH RPC. It binds an in-memory 256-bit bearer capability to one actual
Session object and task, enforces five-minute expiry and request replay checks,
and issues private nonserializable proofs. Requests carry `sessionId`, `taskId`,
`requestId`, `action` and `payload`. Actions are `message`, `budget`, `confirm`,
`revoke`. Logs contain source labels and a principal hash, never the capability.
The component signer cannot sign production requests. This assumes a trusted
launcher/local operator; it does not isolate hostile code running as that user.

Budget approval is separate from execution confirmation: the first binds an
explicit provider/model/goal/configuration, but enables no file operations.
Confirmation binds the existing Master contract, exact allowed/forbidden/risk
scope, task and live session. Same-scope next-action changes can rebind with an
audit entry; expanding scope cannot. Revocation, expiry and session close
invalidate grants. JSON `trusted:true`, model text and tool results cannot mint
grants. Confirmation/retry cannot reset cumulative budget accounting.

The generated `budget-authorization.template.json` is review data only. All
limits and provider/model/prices are null or unapproved. It grants nothing.
The ledger requires explicit call/session/step/input/output/cost/time caps and
approved conservative price bounds. Synchronous reservations include pending
concurrent requests. Unknown usage charges the reserved upper bound and stops;
over-bound usage records the observation and stops. Abort and subsequent tool
admission respect the stop state. Price arithmetic uses integer micro-units.
An upper-bound charge is not an invoice. Fixture currency `TEST` is not money.

Real `agent/pre-step` rejects before provider preparation; direct `llm/stream`
also rejects. Some provider preparation can precede that stream hook, so no
paid-provider or credentials service is mounted. A reviewed preparation,
input/output bound, usage, price and cancellation route is still required.

## Tool and evidence boundary

The actual ToolRuntime dispatch guard allows only an exact live Agent and
explicitly scoped `write`/`read` in component mode, after budget, live grant and
Adapter admission. Existing bridge reads are opt-in and restricted to the same
explicitly writable test files; old write-only contracts retain their behavior.
Shell, network, PTC, delegation, delete and alternate tool services are absent.

`file-tools.mjs` permits only flat safe filenames, exclusive new-file creation,
small reads/writes, regular single-link files and canonical root checks.
Traversal, absolute/ADS/reserved names, links and overwrites are rejected.
These are application capability checks, **not an OS sandbox**. Windows root
replacement/link races have not been confined at the OS boundary; production
dispatch always denies even after confirmation.

Controller requests and actual ToolRuntime result objects are separately
correlated by unique call ID and Agent identity. They are not fabricated native
Session tool calls. Canonical committed Session events are observed separately.
The deprecated native `Session.eventAt` identity check is pinned to this runtime
and needs review on upgrades. Independent file verification returns a system
message to the actual Agent inbox with `goalCompleted:false`; later model
decision-making is untested.

Native `sessions.flush` awaits the host sidecar listener and readback hashes;
teardown is also persisted. This is not the native JSONL backend and does not
implement or validate `agents.resume`. Result reconciliation alone never means
final goal acceptance. The ordinary Node suites run in local CI; installed DSH
assembly is a separate explicit local probe.
