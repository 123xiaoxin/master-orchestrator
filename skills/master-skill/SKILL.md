---
name: master-skill
description: Use this OpenClaw skill when a user request is unclear and needs to be compiled into clear intent, a minimum prototype, dynamic calibration signals, and an execution contract before any execution layer acts.
---

# Master Skill v0.1 Clarity Gate

Master Skill v0.1 turns vague user intent into the smallest useful next action before execution begins.

## Core Purpose

Use this skill to:

- obtain clear intent
- generate a minimum prototype
- dynamically recalibrate when execution reveals drift
- apply first principles
- apply Occam's razor
- apply cognitive completion
- route through a requirement clarity gate
- select a professional execution view from the execution contract
- generate an HTML Progress Map only when it improves user control or serves as a minimum prototype
- ensure execution layers consume only an execution contract

## Operating Principles

### First Principles

Start from the real goal, hard constraints, success conditions, and risk boundaries. Treat the surface request as an input signal, not as the execution contract.

### Occam's Razor

Do not add tools, Agents, process, or clarification rounds unless they remove real uncertainty or risk. Prefer the smallest path that preserves correctness.

### Cognitive Completion

When the user lacks domain background, make the missing decision space visible: key variables, constraints, common paths, likely risks, and what the first artifact should prove.

## Requirement Clarity Gate

Judge clarity by execution readiness, not by a fixed number of conversation rounds.

Choose one of three actions:

- `clarify`: a missing variable blocks a safe next action.
- `prototype`: the direction is clear enough, but the user should confirm it through a small artifact.
- `execute`: goal, boundaries, allowed actions, forbidden actions, validation points, and risk boundaries are clear enough to act.

When readiness is roughly 75%-80%, stop broad questioning and produce a minimum prototype. This is a heuristic range, not a mathematical hard threshold. Decide by combining the real goal, key variables, risk boundaries, and minimum prototype feasibility.

## Minimum Prototype

A minimum prototype is a compact artifact used to confirm direction before larger execution. It can be:

- a document outline
- a UI structure
- a workflow diagram
- a prompt draft
- a minimum code skeleton
- an execution contract

The prototype must expose assumptions, connect to the real goal, and include validation points.

## Dynamic Calibration

During execution, pause and recalibrate when:

- the observed task no longer matches the real goal
- a critical variable is missing
- risk exceeds the current contract
- assumptions conflict with implementation reality
- the prototype shows a direction mismatch

When this happens, state the mismatch, preserve verified progress, ask the smallest necessary question or revise the prototype, then update the execution contract before continuing.

## Execution Contract Boundary

The execution layer must not consume raw vague user requests. It must consume an execution contract prepared by Master.

Minimum contract fields:

- real goal
- task boundaries
- allowed actions
- forbidden actions
- minimum prototype
- validation metrics
- risk boundaries

Do not create Agents by default. Create one only when it reduces complexity or risk.
