# Implementation Status

This document defines the current implementation boundary of
`master-orchestrator`.

The repository is a governance specification, execution contract, and
validation framework for Agent Runtime workflows. It defines how a Master
should frame, govern, validate, and accept work. It is not itself a live Agent
Runtime implementation.

## Current Repository Provides

- governance rules
- prompt modules
- schemas
- examples
- offline eval definitions
- validation scripts
- CI checks
- portable Pester tests

These assets define expected behavior, structured contracts, validation
criteria, and release checks. They can be consumed by a runtime or adapter, but
their presence does not prove that a live runtime enforces them.

## Current Repository Does Not Provide

- live runtime hooks
- automatic OpenClaw control
- real tool interception
- real LLM behavior execution
- runtime adapter implementation
- automatic generation of OpenClaw session JSONL, `tool-calls.json`, or
  `harness-audit.json`

The repository does not take control of an OpenClaw installation, modify its
configuration automatically, or install lifecycle hooks.

## Runtime Boundary

Harness Runtime Control is a discipline definition. It specifies desired phase
gates, authorization boundaries, state handling, verification, repair, and
reporting behavior. It is not a currently running harness implementation.

Runtime integration has moved to `agent-runtime-contracts` and future runtime
adapter repositories. Those repositories are responsible for neutral runtime
protocols and platform-specific enforcement.

A successful runtime operation does not by itself mean that Master completed
the user goal. `runtime succeeded` is not equivalent to `Master completed`.
Master completion still requires the applicable execution contract, evidence,
validation, acceptance criteria, and final status rules to pass.

## Evidence Boundary

Declared evidence is not observed evidence.

The observed runtime trace is the factual source for whether tool calls
occurred, when they occurred, and which execution phase produced them.
Model-declared ledgers are explanatory claims that must be reconciled against
observed evidence.

This repository defines evidence semantics, reconciliation expectations, and
acceptance boundaries. It does not automatically generate runtime traces,
OpenClaw session JSONL, `tool-calls.json`, or `harness-audit.json`.

The v5.6.3 Runtime Evidence Source of Truth boundary remains authoritative:
declared evidence must not be presented as observed evidence.

## Offline Eval Boundary

Offline eval validates behavior-contract definitions and coverage.

It does not call a real LLM, execute a live Agent conversation, or test actual
model behavior. Passing offline eval confirms that repository cases satisfy the
defined contract checks; it cannot prove that a real LLM will behave the same
way in a runtime.

Real LLM behavior evaluation requires a separate runtime-backed evaluation
system and observed evidence.

## OpenClaw Boundary

OpenClaw is the current reference mapping and local execution environment used
by repository examples and helper workflows.

OpenClaw is not the only runtime for Master Core. OpenClaw-specific lifecycle
control, hooks, trace extraction, and adapter behavior should belong to a
future OpenClaw adapter repository, not Master Core.

The governance rules and execution contracts should remain portable across
runtimes.

## Runtime Adapter Roadmap

`agent-runtime-contracts` is responsible for the runtime-neutral protocol
layer.

Future adapters may include:

- OpenClaw
- Codex
- Claude Code
- Cursor
- Hermes

Each adapter may implement platform-specific execution, observation, and
control while consuming the same neutral contracts.

`master-orchestrator` remains responsible for Master Core governance, contract
definitions, validation rules, and acceptance boundaries. It should not absorb
platform-specific runtime implementations.
