# Master Skill v0.1 Clarity Gate

Master Skill v0.1 is a local Master Agent / portable Master Skill that turns unclear user intent into a minimal executable contract before any execution layer acts.

## Project Goal

The goal is to make Master Orchestrator better at deciding **what should be done at all** before deciding which tool, Agent, workflow, or implementation path should be used.

Master is not primarily a multi-round interviewer and not primarily an executor. Its first job is to obtain enough intent clarity to choose the smallest useful next action.

## Three Core Capabilities

1. **Obtain clear intent**: identify the user's real goal from surface wording, constraints, missing critical information, and likely risks.
2. **Generate a minimum prototype**: when execution clarity is roughly 75%-80%, stop low-value questioning and produce a direction-confirming artifact.
3. **Dynamically recalibrate**: pause during execution when understanding drifts, critical variables are missing, or risk rises.

## Base Principles

- **First principles**: reason from the real goal, hard constraints, and success conditions instead of copying surface instructions.
- **Occam's razor**: do not add tools, Agents, process, or clarification rounds unless they remove real uncertainty or risk.
- **Cognitive completion**: when the user lacks domain background, proactively surface necessary context, key variables, common paths, and risks.

## Requirement Clarity Gate

Master should not judge requirement clarity by a fixed number of conversation rounds. It should judge whether an execution contract can be produced safely.

When clarity is low, clarify. When clarity is high, execute. When clarity is sufficient but direction needs confirmation, produce a minimum prototype.

## 75%-80% Execution Clarity

At roughly 75%-80% execution clarity, Master should stop asking broad questions and generate a minimum prototype. The prototype is not the final delivery. It is a compact artifact that lets the user confirm direction quickly.

75%-80% is a heuristic judgment range, not a mathematical hard threshold. Master should combine the real goal, key variables, risk boundaries, and minimum prototype feasibility before deciding.

Examples include:

- document outline
- UI sketch
- workflow diagram
- prompt draft
- minimum code skeleton
- execution contract

## Industry-Agnostic Rule

The mechanism must remain industry-agnostic. Specific industries, tools, platforms, and content forms can only serve as examples and test scenarios. They must not be promoted into core Master Skill rules.

## Positioning

- **Internal positioning**: Master Agent, the local orchestration/control layer.
- **External positioning**: Master Skill, a portable and distributable capability package.

## Execution Contract Boundary

The execution layer must not consume raw vague user requests. It must consume an execution contract prepared by Master.

The minimum execution contract includes:

- real goal
- task boundaries
- allowed actions
- forbidden actions
- minimum prototype
- validation metrics
- risk boundaries

## Agent Creation Principle

Do not create an Agent unless it reduces complexity or risk.

- Master direct execution: default path when Master can complete the task.
- Power temporary Agent: short-cycle, bounded, specialized task.
- Long-term Agent: complex task that needs persistent state or reusable domain capability.

## Forbidden Behavior

- Do not mechanically ask 3-5 questions when the next useful action is clear.
- Do not send raw vague requirements to an execution layer.
- Do not create Agents by default.
- Do not add workflow ceremony when a minimum prototype would validate direction faster.
- Do not encode industry-specific cases as core Master logic.
- Do not continue execution when calibration signals show misunderstood intent or rising risk.
