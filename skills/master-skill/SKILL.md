---
name: master-skill
description: Govern ambiguous, multi-stage, or evidence-sensitive tasks by clarifying intent, compiling an authorized execution contract, detecting drift, verifying bounded repairs, and reporting observed evidence. Use for Master governance; runtime adapters remain external.
metadata:
  project_version: 5.8-draft
  package_version: 0.2.0-draft
---

# Master Skill — unified developer entrypoint (Draft)

This is the only normative Skill entrypoint in this repository. The source
manifest is [modules.json](modules.json). This entrypoint selects maintained
prompt modules; it does not define another lifecycle or implement a runtime.

## Read the rules before acting

Read all four required modules in this order, using an available file reader:

1. [01 Core / Intent / Contract](../../prompts/01-core-master-framework.md)
2. [05 Execution verification and bounded repair](../../prompts/05-agent-capability-imitation.md)
3. [07 Harness gates and authorization](../../prompts/07-harness-runtime-control.md)
4. [08 Goal pursuit and evidence integrity](../../prompts/08-goal-pursuit-and-evidence.md)

Required reading does not require every long-task ledger for a simple task.
Apply each module's record conditions; goal, authorization, validation, drift,
and evidence integrity still apply. If any required source is inaccessible,
stop dependent execution and disclose the loading gap. Do not silently use 01
alone. Explicit file reads are the loading mechanism; no dynamic Skill loader
or runtime enforcement is assumed.

Read conditional modules before the affected decision:

| Module | Condition | Dependencies |
|---|---|---|
| [06 Intent evidence](../../prompts/06-intent-elicitation.md) | Vague, abstract, non-technical request, intent discovery or shift | 01; evidence only, then Phase -1b |
| [02 Specialist dispatch](../../prompts/02-agency-dispatch.md) | Necessary independent capability with confirmed authorization | 01, 07; Master-First |
| [03 Quality retrospective](../../prompts/03-quality-flywheel.md) | Explicit quality review or trend request | 01, 08; Phase 5 |
| [04 Skill deposition](../../prompts/04-skillcraft.md) | Verified reusable pattern and authorized deposition | 01, 08; Phase 5 |

Dependencies point from a module to its prerequisites. References back to Core
describe context; they never instruct recursively reopening the entrypoint.
Read each selected module once per source revision. File presence and successful
package construction do not prove that a model actually read or followed it.

## Authority and contract vocabulary

Host instructions and the user's authorized scope constrain this Skill. Within
the repository, this entrypoint owns selection and conflict resolution; 01 owns
the Phase -1..5 macro lifecycle and Phase -1b clarity judgment. 06 only supplies
user evidence. 05/07/08 refine execution, correction, and acceptance without
skipping macro phases. 03/04 cannot defer execution verification to Phase 5.
Historical Clarity Gate documents explain origins; they are not another entry.

Respect authorization already given for the same actions and boundaries; record
it at Phase 3. Ask for missing authorization or a material scope/risk change.
An inferred real goal, numerical clarity score, prototype, or model-written
ledger cannot supply authorization. Preserve verified work during correction;
stop affected execution until the contract and required authorization are current.

Use [master_output_contract.v1](../../schemas/master_output_contract.v1.schema.json)
for validation-mode outputs. Map conceptual fields without adding illegal keys:

| Concept | JSON location |
|---|---|
| Real goal / boundaries | `realGoal` / `nonGoals` and action limits |
| Allowed / forbidden actions | `executionContract.allowedActions` / `forbiddenActions` |
| Minimum prototype | `minimumPrototype` (string or null) |
| Validation metrics / success assertions | `executionContract.validationPlan` |
| Risk boundaries | `executionContract.riskBoundaries` |

[requirement_clarity.v1](../../schemas/requirement_clarity.v1.schema.json)
is a different clarity record, with its own field names; never interchange the
two JSON layouts. The four-layer concrete + 0.75 handoff guard in 06 is a tested
`intent_elicitation.v1` record constraint, not a universal execution permission
or a fixed conversation count. The Phase -1b 75%-80% prototype heuristic remains
a judgment aid. Missing user evidence stays partial/unknown.

Phase 4 performs verification and at most two repair rounds; Phase 5 performs
the retrospective and closing acceptance. Only observed traces establish tool
calls. Without a complete trace, mark `ledgerUnverified: true` in
`final_report.v1.sourceOfTruthGate`, disclose the limitation, and do not claim
the governed task is `completed`. A static validator cannot establish observed
evidence or independent review.

## Portable use

Build a self-contained package using the repository builder before installation;
copying this source folder alone omits required modules. OpenClaw-specific
helpers require OpenClaw and authorization; they are not DSH tools. An adapter
must preserve these rules and map its tools explicitly. A local adapter that
declares a different final contract must be reconciled before migration.

See [version governance](../../docs/version-governance.md) and
[SkillOpt boundaries](../../docs/skillopt-baseline.md). Do not train or overwrite
this entrypoint as part of ordinary execution.
