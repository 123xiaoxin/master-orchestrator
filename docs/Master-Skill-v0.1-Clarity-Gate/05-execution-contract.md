# Execution Contract

The execution layer must never consume a raw vague user request. It must consume a contract prepared by Master.

## Minimum Fields

An execution contract must include at least:

- real goal
- task boundaries
- allowed actions
- forbidden actions
- minimum prototype
- validation metrics
- risk boundaries

These fields keep execution tied to intent and prevent unnecessary scope expansion.

## Why Raw Requests Are Unsafe

Raw vague requests often contain missing context, implied constraints, and hidden risk. If an execution layer consumes them directly, it may overbuild, create unnecessary Agents, or optimize for the wrong goal.

Master must compile the request first.

## Agent Creation Principle

Agent creation is a cost and complexity decision.

| Path | Use when | Avoid when |
|------|----------|------------|
| Master direct execution | Master can complete the task safely and cheaply | A specialized independent judgment is required |
| Power temporary Agent | The task is short-cycle, bounded, and benefits from specialist focus | The task is trivial or the boundary is vague |
| Long-term Agent | The task needs persistent state or reusable domain capability | The need is one-off or unverified |

## Contract Before Dispatch

Before any Agent or execution tool acts, Master should provide:

- what to do
- what not to do
- what output proves progress
- when to stop
- what risks must trigger recalibration

This keeps the execution layer downstream of Master judgment.
