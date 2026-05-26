# Harness Runtime Control

## Scope

This document defines Harness Runtime Control for Master Skill and Master
Orchestrator.

It is a harness discipline definition, not a runtime implementation. It does not
authorize automatic OpenClaw changes, automatic hooks, automatic tool execution,
or configuration changes.

It does not add schema, helpers, prompts, eval cases, or OpenClaw runtime code.
Its purpose is to clarify which Master rules should eventually become runtime
discipline instead of remaining only in documentation or prompt text.

Harness Runtime Control turns Master principles into:

- phase order;
- state records;
- authorization boundaries;
- verification and repair;
- failure stopping rules;
- checkpoint and resume;
- capability routing;
- specialist triggers;
- final reports;
- deposition decisions.

## 1. Harness Layer Definition

Harness is the runtime control layer outside the model.

It is responsible for:

- process order;
- state tracking;
- permission boundaries;
- verification and repair;
- failure stopping;
- checkpoint / resume;
- capability route control;
- specialist trigger checks;
- final report enforcement;
- deposition judgment.

Harness does not make the model smarter. It makes model behavior more stable,
traceable, recoverable, and verifiable.

If a rule only exists in a prompt, the model may follow it inconsistently. If a
rule enters the harness, it becomes runtime discipline.

## 2. What Harness Is Not

Harness is not:

- model capability;
- a normal prompt;
- a Skill;
- RAG;
- a business Agent;
- a professional execution role;
- a large autonomous execution system.

Harness does not directly produce business deliverables. It controls the process
by which deliverables are planned, executed, verified, and reported.

## 3. Runtime Phase Gate

Complex tasks should not jump directly from user request to execution.

Recommended phase order:

```text
intake
-> cognitive_staging
-> draft_execution_contract
-> specialist_review / counter_review
-> contract_fusion
-> capability_matching
-> capability_gap_decision
-> execution
-> verify_repair
-> final_report
```

Simple tasks can use a lightweight path, but they must still preserve minimal
goal confirmation, risk judgment, and result verification.

Complex, high-risk, long-running, customer-facing, or quality-critical tasks
cannot skip required phases.

| Phase | Purpose |
|---|---|
| intake | Receive the user request and classify task type and risk. |
| cognitive_staging | Gather information, analyze context, and frame the task. |
| draft_execution_contract | Produce the first Execution Contract. |
| specialist_review / counter_review | Review professional quality, risk, and feasibility. |
| contract_fusion | Merge review findings into the revised contract. |
| capability_matching | Decide whether CLI, MCP, Skill, script, Agent, or manual handoff is needed. |
| capability_gap_decision | Route missing capability through an explicit decision tree. |
| execution | Perform controlled execution. |
| verify_repair | Verify, repair with limits, and reverify. |
| final_report | Report results, validation, risks, and deposition candidates. |

## 4. Runtime State Machine

Harness should use `state_machine.v1` to manage complex and long-running tasks.

Recommended runtime fields:

```json
{
  "taskId": "",
  "phase": "",
  "status": "",
  "owner": "",
  "requiredReview": [],
  "capabilityRoute": "",
  "verificationStatus": "",
  "repairCount": 0,
  "blockedReason": "",
  "resumeFrom": {}
}
```

Runtime expectations:

- `taskId` identifies the task.
- `phase` identifies the current runtime phase.
- `status` records pending, in_progress, blocked, repaired, verified,
  completed, or failed.
- `owner` identifies the current responsible role or route.
- `requiredReview` records required specialist or counter review.
- `capabilityRoute` records CLI, MCP, Skill, script, Agent, or manual handoff.
- `verificationStatus` records verification state.
- `repairCount` must stay finite.
- `blockedReason` must explain why execution cannot continue.
- `resumeFrom` must support restart after interruption.

Harness should not rely on chat memory for complex-task recovery. State must be a
recoverable, verifiable, and handoff-ready execution coordinate.

## 5. Verify / Repair Harness

`verify_repair_loop.v1` should become runtime discipline, not only guidance.

Rules:

- A failed verification cannot be reported as completed work.
- Repair is limited to at most 2 rounds.
- Each repair round must be followed by revalidation.
- Repair must not become an infinite loop.
- If verification still fails after the limit, execution must stop.
- The stop report must include failure reason, remaining risk, and user decision
  points.

Minimal shape:

```json
{
  "target": "",
  "verifyStep": {
    "command": "",
    "scope": ""
  },
  "status": "pending_verification",
  "attempt": 0,
  "maxAttempts": 2,
  "attempts": [],
  "nextAction": "",
  "updatedAt": ""
}
```

Harness control points:

- define verification before execution;
- enter repair only after verification failure;
- revalidate after repair;
- stop after 2 failed repair attempts;
- never package unverified output as success.

## 6. Capability Gap Router

When Master detects a missing capability, it must not only report "missing tool."

It should route through the Capability Gap Decision Tree and select one path:

- `degrade`
- `substitute`
- `install_or_enable`
- `generate_temporary_capability`
- `manual_handoff`

Required output:

```json
{
  "missingCapability": "",
  "impact": "",
  "candidateRoutes": [],
  "selectedRoute": "",
  "riskLevel": "",
  "requiresAuthorization": false,
  "verificationPlan": "",
  "fallback": ""
}
```

Routing principles:

- prefer safe, low-cost, verifiable paths by default;
- select the route based on Execution Contract, risk, and user goal;
- do not treat the route order as a mandatory linear flow;
- if the gap is professional judgment, prefer Specialist Review,
  Counter-Agent Review, or Experience Review before installing tools or
  generating scripts;
- if installation or temporary capability would pollute the environment,
  change global configuration, introduce long-term dependency, or be hard to
  roll back, prefer `manual_handoff`.

## 7. Specialist Trigger Harness

Harness should check specialist needs during task analysis.

Common trigger dimensions:

- UI / UX;
- Security;
- QA;
- AI Engineer;
- Frontend / Backend;
- Audience Experience;
- Counter-Agent;
- Documentation;
- Release / Deploy.

Trigger rules:

- UI / UX tasks must trigger Experience Review.
- Security, token, permission, and data tasks must trigger Security review.
- Multi-file code changes should trigger QA or engineering review.
- RAG, Agent, model, and tool-use tasks should trigger AI Engineer review.
- Customer-visible content should trigger Audience Experience review.
- Complex execution contracts should trigger Counter-Agent Review.

Master should not use generic reasoning as a substitute for professional
perspective when that perspective materially affects delivery quality.

Specialist perspective does not mean default execution Agent creation. When the
perspective affects real delivery quality, user experience, security risk, or
rework cost, it should be escalated to an independent specialist Agent or
Counter-Agent.

## 8. Authorization Gate

The following operations require user authorization:

- `git push` / release / deploy;
- gateway restart / `doctor --fix`;
- dependency installation;
- configuration modification;
- MCP enablement;
- execution of unknown scripts;
- delete / overwrite / data migration;
- sensitive data upload;
- force operations;
- production environment changes;
- paid API usage or large-scale download / upload.

Harness rules:

- before authorization, only read-only checks, plans, and risk explanation are
  allowed;
- the authorization request must state operation, impact, risk, and rollback or
  fallback;
- unauthorized work must not be represented as completed;
- high-risk operations must include verification plan and fallback.

## 9. Final Report / Deposition Gate

Complex tasks should end with a Final Report.

Minimum content:

```json
{
  "completed": [],
  "verificationResults": [],
  "risks": [],
  "unfinishedItems": [],
  "skillDepositionCandidate": false,
  "depositionTarget": "",
  "nextActions": []
}
```

The report should explain:

- what was done;
- how it was verified;
- verification result;
- remaining risks;
- unfinished items;
- whether user decision is still needed;
- whether a skill deposition candidate was produced;
- which layer should receive the deposition:
  - Prompt;
  - Harness;
  - Skill;
  - RAG / Memory;
  - model selection note.

Without a Final Report, a complex task should not be considered a complete
execution loop.

## 10. Future Engineering Notes

Future work can turn this discipline into:

- helper scripts;
- schemas;
- offline eval cases;
- real LLM eval cases;
- OpenClaw runtime rules;
- preflight checkers;
- state machine validators;
- authorization policy checkers;
- final report validators.

Suggested order:

1. Harness preflight checklist.
2. Verify / Repair enforcement.
3. Authorization Gate checker.
4. Specialist Trigger checklist.
5. Final Report validator.
6. Capability Gap route validator.

This phase should not build a large runtime. Define the discipline first, then
engineer the smallest verifiable control points.

## Final Principles

1. Harness is the runtime control layer outside the model.
2. Important prompt rules should eventually enter Harness to become stable.
3. Complex tasks cannot skip required Phase Gates.
4. Failed verification cannot be reported as completion.
5. High-risk operations require authorization.
6. Missing capability requires routing, not only reporting.
7. Final Report is part of the execution loop.
8. Harness exists to make execution controlled, recoverable, and verifiable.
