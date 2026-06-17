# AI Agent Capability And Execution System Report - Engineering Impact

Source: `AI Agent 能力来源与执行系统研究报告 v0.2`

This document converts the research report into engineering impact analysis for
`master-orchestrator`. It is intentionally scoped to research grounding,
contract boundaries, and minimal validation recommendations.

It does not implement an Agent Runtime, multi-agent orchestration, OpenClaw
lifecycle takeover, background tasks, workflow runtime, project memory runtime,
or runtime adapters.

## 1. Research Report Summary

The report's core claim is that AI Agent capability is not produced by the base
model alone. Stable execution comes from the combination of model reasoning,
tool access, execution protocol, context management, intent compilation,
formal contracts, runtime constraints, and evidence validation.

For Master systems, the most important conclusion is narrower:

Master's primary value is not to replace every execution Agent or become a
Runtime. Master's current value is to compile vague, high-entropy user intent
into clear, bounded, verifiable execution contracts before work enters an
execution layer.

Current boundary:

```text
Master Skill v0.1
= clear intent + minimum prototype + dynamic calibration + execution contract
```

Non-boundary:

```text
Master Skill v0.1
!= all-purpose Agent + Agent Runtime + multi-agent system + long-term memory
```

`v5.8 = Master governance behavior contract validation layer; it is not an
Agent Runtime implementation.`

## 2. Agent Capability Eight-Layer Model

The report splits Agent capability into eight layers:

| Layer | Source of capability | Current repository relationship |
|---|---|---|
| L1 | Base model capability | Out of scope; assumed external. |
| L2 | Tool access capability | Referenced by contracts; not implemented here. |
| L3 | Agent execution protocol | Covered by prompt modules and governance docs. |
| L4 | Context and memory management | Partly covered as filesystem context discipline; no memory runtime. |
| L5 | Intent compilation and formal contracts | Covered by clarity, task analysis, master output contracts, schemas, examples, evals. |
| L6 | Task state and orchestration | Partly covered by state machine schema and validator; no workflow runtime. |
| L7 | Validation and evidence mechanism | Covered by verify/repair, final report, evidence source-of-truth docs and evals. |
| L8 | User prompt and project rule governance | Partly covered by phase discipline, boundaries, and conservative execution rules. |

Engineering implication: this repository should strengthen L5 and L7 first,
and keep L6 limited to contract validation until a separate Runtime layer
exists.

## 3. Intent Compilation: From Vague Intent To Execution Contract

Intent Compilation means converting a vague natural language request into a
low-entropy execution contract:

```text
User Intent
-> Clarified Intent
-> Execution Contract
-> Minimal Deliverable
-> Verification Criteria
```

Existing coverage:

- `schemas/intent_elicitation.v1.schema.json`
- `schemas/task_analysis.v1.schema.json`
- `schemas/requirement_clarity.v1.schema.json`
- `schemas/master_output_contract.v1.schema.json`
- `examples/intent-elicit/`
- `examples/task-analysis/`
- `examples/master-output-contract/`
- offline eval cases for clarification, execution contract, and Phase -1a.

Minimal next optimization should be eval or documentation only: verify that
complex execution cannot start before the required contract fields exist. This
does not require a Runtime.

## 4. Master-First And Cold Expert Library

The report reinforces the existing Master-First rule:

- Master performs clarification, task judgment, contract generation, and
  minimum prototype work by default.
- Additional Agents are created only when professional judgment, independent
  verification, isolation, or parallel work is necessary.

Cold Expert Library means expert capability should remain cold as templates,
skills, checklists, contracts, or role specs until needed. It must not become a
resident Specialist Legion.

Existing coverage:

- README Master-First and Cold Expert Library rules.
- Agent Pack templates and validators.
- conservative limits on creating temporary Agents.

Current action: no new Agent creation system, no warm pools, no resident expert
fleet.

## 5. Prompt / Contract / Harness / Validator Boundaries

The report's boundary model maps cleanly onto this repository:

| Layer | Responsibility | Current repository stance |
|---|---|---|
| Prompt | Guide model behavior. | Prompt modules define expected discipline. |
| Contract | Define executable boundaries. | Schemas and examples define accepted shapes. |
| Harness | Enforce runtime constraints and record observed facts. | Defined as discipline only, not implemented here. |
| Validator | Judge whether outputs and examples satisfy contracts. | Helpers, Pester tests, offline eval, and CI. |

Important boundary:

- Harness Runtime Control in this repo is a discipline definition.
- It is not live runtime hooks, tool interception, OpenClaw lifecycle control,
  or an autonomous Agent Runtime.
- Platform-specific enforcement belongs in `agent-runtime-contracts` and future
  adapter repositories.

## 6. Evidence Ledger: Declared / Observed / Audited

The report's evidence model matches the v5.6.3 and v5.8 direction:

| Evidence type | Meaning | Source-of-truth level |
|---|---|---|
| Declared Evidence | What Master says happened. | Explanatory claim only. |
| Observed Evidence | What tools, logs, files, tests, or runtime traces show. | Factual source for tool activity. |
| Audited Evidence | Reconciliation by CI, validator, external judge, or human audit. | Acceptance and trust layer. |

Existing coverage:

- `docs/runtime-evidence-source-of-truth.md`
- `prompts/08-goal-pursuit-and-evidence.md`
- `schemas/final_report.v1.schema.json`
- `schemas/goal_pursuit_ledger.v1.schema.json`
- `evals/cases/evidence-source-of-truth-gate.json`
- `evals/cases/final-report-gate-required.json`

Boundary:

- Declared evidence is not observed evidence.
- Offline eval validates behavior-contract definitions, not real LLM behavior.
- This repository does not automatically generate session JSONL,
  `tool-calls.json`, or `harness-audit.json`.

## 7. Verify / Repair Loop Limit

The report states that verification failure must not become infinite repair.

Existing coverage:

- `schemas/verify_repair_loop.v1.schema.json`
- `helpers/validate_verify_repair_loop.ps1`
- `tests/VerifyRepairLoop.Tests.ps1`
- `examples/verify-repair/encoding-check-repair-loop.json`
- `evals/cases/verify-repair-loop.json`

Current rule:

- repair is bounded;
- revalidation is required after repair;
- after the limit, status must move to blocked, failed, degraded, or
  needs-user-decision.

No runtime retry scheduler should be added in this repository.

## 8. Filesystem-Context: Minimal Viable Context Persistence

Filesystem-Context is the only memory-related concept from the report that is
safe to absorb now.

Definition:

The repository filesystem can act as a minimal context persistence layer through
stable, reviewable files such as README, TODO, docs, schemas, examples, eval
cases, handoff notes, and validation reports.

Rules:

- use context selection, not context dump;
- load only files relevant to the current task;
- keep user preference below safety, truthfulness, permissions, and execution
  protocol;
- prefer durable docs, schemas, examples, and evals over hidden memory;
- do not implement project-scoped memory runtime in this repository.

Minimal next optimization can be a doc or offline eval that checks "context
selection before execution" language. It should not create a memory store.

## 9. Impact On Master Skill

Master Skill should remain a user-facing transformation layer:

```text
v0.1 = vague intent -> clear intent -> executable prototype
```

Keep:

- clarity gate;
- non-leading intent elicitation;
- minimum prototype;
- dynamic calibration;
- execution contract;
- user-readable output.

Do not add:

- full runtime;
- default multi-agent dispatch;
- long-term memory;
- automatic task tree;
- Goal Judge;
- Stop Gate;
- Workflow Runtime;
- OpenClaw lifecycle takeover.

## 10. Impact On Master Agent

Master Agent is the internal governance controller. It can grow beyond Master
Skill, but it still must not become Runtime.

Appropriate future additions:

- task type classification;
- capability planning;
- context selection;
- prompt priority governance;
- plan review;
- execution supervision;
- cold expert selection.

Still out of scope:

- bottom-level tool execution engine;
- multi-agent runtime;
- background task system;
- cross-session recovery;
- workflow scheduler.

## 11. Impact On Master Orchestrator

Master Orchestrator is the engineering validation layer. Its job is to prove
that Master rules are explicit, testable, and reviewable.

Existing v5.8 coverage:

- Master Output Contract;
- Capability Gap Contract;
- Final Report Contract;
- Five-Layer Snapshot;
- Goal Pursuit Ledger;
- State Machine Validator;
- Verify / Repair Validator;
- Evidence Source-of-Truth Gate;
- Runtime Evidence boundary;
- local CI and Pester validation.

Best next move: keep strengthening contracts, examples, offline eval
definitions, and validators in small increments. Do not absorb runtime adapter
responsibilities.

## 12. Future Impact On Runtime / Hermes

The following belong to future Runtime or Hermes work, not this repository's
current line:

- Task Tree;
- Workflow Runtime;
- Subagent Orchestration;
- Stop Gate;
- Goal Judge;
- Checkpoint / Memory;
- Trace Bundle;
- Runtime Events;
- Tool Permission Model;
- A2A / MCP Adapter;
- Budget Routing;
- Project-Scoped Memory;
- full Filesystem-Context runtime.

This repository may define contracts that future runtime systems consume. It
should not implement those runtime systems.

## 13. Version Boundary Table

| Track | Role | Safe content | Not included |
|---|---|---|---|
| Master Skill v0.1 | User-facing transformation layer | clarity, minimum prototype, dynamic calibration, execution contract | runtime, default multi-agent, long-term memory |
| Master Skill / Agent v0.2 | Governance expansion | prompt priority governance, context selection, capability planning, cold expert selection | workflow runtime, background execution, warm expert pools |
| Master Orchestrator v5.8 | Engineering validation layer | schemas, examples, evals, validators, CI, evidence contracts | runtime adapter, OpenClaw takeover, real tool interception |
| Runtime / Hermes | Future execution system | workflow, task tree, checkpoint, events, permissions, adapters | should not be folded into Master Skill or v5.8 |

## 14. Current Non-Goals

Do not implement now:

- full Agent Runtime;
- multi-agent orchestration system;
- Specialist Legion;
- resident expert Agents or warm pools;
- OpenClaw lifecycle takeover;
- background long-task system;
- Workflow Runtime;
- Project-Scoped Memory runtime;
- Budget Routing runtime;
- KV cache compaction;
- latent briefing system;
- automatic session JSONL / `tool-calls.json` / `harness-audit.json`
  generation;
- treating v5.8 as Runtime implementation.

## 15. Concept Classification

| Concept | Classification | Reason |
|---|---|---|
| Intent Compilation | Covered and suitable for small eval/doc strengthening | Already represented by clarity, task analysis, and master output contracts. |
| Formal Contract / Data Contract | Covered | Schemas, examples, helpers, and tests are the repository core. |
| Master-First | Covered | Existing README and dispatch rules preserve Master-first execution. |
| Cold Expert Library | Covered | Existing Agent Pack model keeps experts cold until needed. |
| Harness Runtime Control | Covered as discipline | Must remain non-runtime in this repo. |
| Verify / Repair Loop Limit | Covered | Existing schema, validator, tests, and eval enforce bounded repair. |
| Evidence Ledger: Declared / Observed / Audited | Covered | Evidence source-of-truth docs and evals define the boundary. |
| Final Report Source-of-Truth Gate | Covered | Final report contract and eval cover the gate. |
| Filesystem-Context | Minimal next docs candidate | Safe only as context persistence principle, not memory runtime. |
| Context Selection | Minimal next docs/eval candidate | Useful if kept as selection discipline. |
| Project-Scoped Memory | Future parking lot | Requires runtime semantics and persistence. |
| Budget Routing | Future parking lot | Requires runtime budget accounting and enforcement. |
| Workflow + Local Agent | Future parking lot | Would expand into workflow runtime. |
| Runtime / Hermes future boundary | Future architecture boundary | Should remain outside current repository implementation. |
| Specialist Legion / Warm Pools | Explicitly rejected now | Expands complexity and violates Master-First. |

## 16. Minimal Engineering Optimization Recommendations

These are recommendations, not implemented changes in this document.

| File path | Purpose | Current version? | Risk | Needs user confirmation? |
|---|---|---:|---|---:|
| `docs/research/ai-agent-capability-and-execution-system-report.md` | Preserve research impact, classifications, and boundaries. | yes | low | no |
| `evals/cases/intent-compilation-contract-boundary.json` | Ensure complex execution requires a contract before execution. | candidate v5.8.x | low | yes |
| `evals/cases/filesystem-context-selection.json` | Ensure Master selects relevant files instead of dumping context. | candidate v5.8.x | low | yes |
| `examples/master-output-contract/context-selection-contract.json` | Show a safe lightweight Filesystem-Context example. | candidate v5.8.x | low | yes |
| `README.md` | Optional link from Current Positioning to this research impact doc. | optional | low | yes |
| `TODO.md` | Add research-driven next-step parking lot without implementation claims. | optional | low | yes |
| `prompts/08-goal-pursuit-and-evidence.md` | Optional wording tightening around declared/observed/audited evidence. | optional | medium | yes |
| `schemas/master_output_contract.v1.schema.json` | Optional field-description clarification only; no new required runtime field. | optional | medium | yes |
| `helpers/*` | No change recommended now unless a new contract is approved. | no | medium | yes |
| Runtime adapter repositories | Implement trace extraction, permissions, adapters, budget routing, project memory. | future / do not implement now | high | yes |

Default rule: any recommendation involving Runtime, Subagent, Memory, Workflow,
Budget Routing, or warm experts is future / do not implement now.

## 17. Final Engineering Judgment

The report supports the current v5.8 direction. It does not justify expanding
this repository into a Runtime. The smallest useful optimization is to preserve
the research impact analysis and use it to guide future low-risk eval, example,
and documentation additions.

The next engineering step should be approved explicitly before modifying
schemas, prompts, helpers, tests, or CI.
