# Isolated runtime verification

This small sidecar reuses the unchanged v1 → v2.1 Adapter. It is not a replacement DSH runtime and does not launch models.

Run from the repository root:

```powershell
node --test --test-reporter=tap tests/dsh_runtime.test.mjs
node scripts/dsh_runtime_entry.mjs --offline
node scripts/dsh_runtime_entry.mjs --real-preflight
```

The last command intentionally exits 2. It prepares an isolated home/workspace, component profile and authorization-review template. Public JSON cannot switch on unimplemented host routing, tool confinement or cumulative budget enforcement. The profile contains no agent/model provider; it is a preparation artifact, not a tested headless Master profile. Do not run a bare `dsh headless` command as a substitute: the installed driver can select a chargeable default model and does not compose Master Presets.

## Trust and evidence

`createHostPort` is a trusted, same-process host interface. Keep it out of model tools and public HTTP handlers. An admitted structured user message must bind task, goal, contract, explicit independent execution permission, workspace, exact write files and independent checks. `prepareExecution` materializes that observed host projection for the existing Adapter. A serialized receipt, source `kind:user`, READY result or high clarity score grants no execution permission.

The confirmation protocol is `master_runtime_confirmation.v1`: `taskId`, `goalConfirmation`, `authorization`, `assumptionConfirmations`, `userDecisions`, and `execution:{authorized,workspace,writeFiles,checks,maxRepairs:2}`. Authorization uses the Adapter's exact Master hash and scope fields. This interface supports only `write:<relative-file>` scopes and byte-hash or JSON `enabled=true` checks. It does not infer authority from natural-language phrases or turn arbitrary model text into user consent.

The isolated Cordis observer checks the live Session object, committed event identity and workspace. It admits receipts only as **DSH component** evidence, and permanently denies every tool. Actual model-session host wiring remains blocked. A malicious trusted host can call host APIs; these capabilities are not authentication against a compromised host process. Real user freshness, revocation and authenticated ingress must be audited before lifting the guard. The installed `Session.eventAt` identity check is available but deprecated; future DSH versions require an explicit migration review.

`executionGate` reads permission; `claimOperation` consumes one dispatch per execution/repair round. `beginRepair` requires the previous round's independent verification and permits at most two repairs. No shell, delegation, network or write outside named files is admitted. Only disposable workspaces below repository `.local` are supported. This path guard is designed for a trusted single-process disposable test controller, not a general adversarial filesystem sandbox: concurrent symlink/hardlink attacks and shell effects require a reviewed DSH sandbox/tool policy before model execution.

`TraceObserver` uses `tool/call.data.callId`, `tool/result.data.message.source.callId`, `sourceEventSeqs`, turn and step. Missing IDs/results, duplicate IDs, mismatched references, sequence gaps or events after terminal block acceptance. No command-name heuristic establishes verification. `flush` awaits a new trace write and verifies its bytes. The acceptance API requires that private flush proof, a private independent verification receipt, current contract/session/task binding and a fresh read of outputs. Tool success, validation success and goal acceptance stay separate; initial failures remain visible after successful correction.

The deterministic controller writes disposable files and labels every fixture/event **Mock**. Its scripted clarification and correction prove guard behavior, not Master model behavior. Component probes exercise actual installed Cordis, Session and ToolRuntime with controller-injected events; they do not execute model-proposed tools.

## Actual component probe

Run `scripts/probe_dsh_runtime.cjs` using the installed Electron executable with `ELECTRON_RUN_AS_NODE=1` and `--expose-internals`. Arguments are the actual `@deepseek-ai` package root inside `app.asar`, then a **new** output directory below repository `.local`. The probe loads only SystemPrompt, SessionStore and ToolRuntime. It creates no agent or model/credentials service, observes controller-injected events, checks forged event refusal and the real tool guard, hashes installed sources and awaits sidecar output. On Windows use `Start-Process -WindowStyle Hidden -Wait -PassThru`; restore the environment afterward. The report records exact paths and versions for this machine.

## Remaining real-session conditions

Explicit model and availability, authenticated user cost authorization, token/cost cap, maximum sessions/steps, isolated executable Master composition, cumulative budget enforcement (per-request `maxTokens` alone is insufficient), authenticated host user source, scoped tool guard, complete durable logs, stop conditions and no sensitive payload are all required. Passing a review template is not proof these exist. No real model launcher is exposed until these conditions and native DSH composition have been implemented and validated.
