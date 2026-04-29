# Industrial Agent Principles

## Core Principle

Industrial agents are safety-first systems. Their primary goal is not to be more autonomous or more creative. Their primary goal is to avoid unsafe, unverifiable, or unaudited action.

Default stance:

```text
proposal_only
```

An industrial agent pack may produce candidate actions, risk explanations, evidence, and escalation paths. It must not directly control equipment unless a separate, approved safety gateway, white-listed tool path, and human authorization policy exist.

## Four Safety Laws

| Law | Requirement | Implementation |
|-----|-------------|----------------|
| Do not be wrong | Critical actions require deterministic verification, not probabilistic confidence alone | Reject uncertain actions, require evidence, use rule checks |
| Stay controllable | Humans retain authority over critical operations | Approval, interrupt, takeover, and escalation paths |
| Stay local | Safety decisions must remain close to the site | Edge validation, local fallback, no remote-only control loop |
| Stay stable | The system must tolerate long-running operation | Degrade safely, recover, audit, and preserve continuity |

## Decision Boundary

Industrial packs divide work into three levels:

| Level | Allowed Output | Execution Permission |
|-------|----------------|----------------------|
| Observe | State summaries, anomaly descriptions, evidence bundles | No execution |
| Recommend | Candidate actions, risk rank, expected impact | No execution |
| Assist | Prepare commands for review, checklists, rollback plans | Requires gateway and human approval |
| Execute | Device control or parameter changes | Out of scope for default templates |

The default templates in this repository stop at `Recommend` or `Assist`.

## Required Safety Gate

Before any operational action can move toward execution, it must pass:

1. Rule engine validation
2. Permission check
3. Risk scoring
4. High-risk action list check
5. Human approval when required
6. Audit record creation
7. Rollback or fallback plan confirmation

Actions that fail any gate are blocked.

## Forbidden Actions

- Direct device control from an LLM response
- Bypassing rule approval or white-listed tools
- Executing uncertain or partially specified instructions
- Privilege escalation
- High-risk action without second confirmation
- Running without audit trail
- Treating workspace isolation as a safety boundary

## Required Audit Fields

Every industrial workflow should preserve:

- Input source and timestamp
- Current equipment or process state
- User instruction
- Retrieved knowledge sources
- Candidate actions
- Risk score and rationale
- Rule hits and blocks
- Approver identity, if any
- Execution result, if any
- Alarms, side effects, rollback, and handoff timeline

## Cloud Edge Site Split

| Layer | Role | Notes |
|-------|------|-------|
| Cloud | Knowledge management, offline analysis, global reporting | Never be the only safety path |
| Edge | Local decision support, final safety checks, fallback | Must tolerate network loss |
| Site | Sensors, controllers, alarms, interlocks | Site safety logic has priority over AI output |

## Template Rules

Industrial templates in this repository must include:

- `domain: "industrial"`
- `safetyMode: "proposal_only"` unless a separate safety design justifies otherwise
- `auditRequired: true`
- `approvalRequiredFor`
- `forbiddenActions`
- `fallbackPolicy`
- `riskLevels`

Industrial templates should be reviewed more strictly than general templates.
