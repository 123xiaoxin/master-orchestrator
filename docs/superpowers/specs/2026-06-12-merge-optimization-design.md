# Master Orchestrator Merge Optimization Design

## Goal

Use the current `de289a5` repository as the only baseline, preserve v5.6.3
runtime evidence governance, and selectively integrate the useful parts of the
Mimo and MiniMax snapshots without copying their known defects.

## Non-Goals

- Do not replace the repository with either external snapshot.
- Do not weaken or reorder Phase -1 through Phase 5.
- Do not let intent elicitation skip Phase -1b and enter Phase 0 directly.
- Do not treat offline eval case definitions as real LLM behavior tests.
- Do not commit, push, or modify `main` during implementation.

## Layer 1: Portable Engineering Validation

Add a repository-owned validation layer that works outside the original
developer machine:

- `create_agent_pack.ps1` accepts an optional `AgencyRoot`.
- `validate_templates.ps1` passes the same root through to dry-run validation.
- Pester tests use temporary repositories and temporary expert stubs.
- `run-tests.ps1` always runs the complete test directory.
- `local-ci.ps1` runs all release checks and all Pester tests. It must never
  report green after running only a smoke-test subset.
- GitHub Actions uses the `pwsh` already present on GitHub-hosted runners,
  installs Pester explicitly, and runs the same validation entry points.

## Layer 2: Optional Phase -1a Intent Elicitation

Add a small optional prompt module before the existing Phase -1b Clarity Gate.
It is enabled only for vague, abstract, non-technical requests or when the user
asks for help forming intent.

Rules:

- Ask one question per turn.
- Prefer open Socratic questions and user-supplied imagery.
- Do not offer near-target A/B/C choices by default.
- A contrasting-reference fallback is allowed only when the user cannot
  verbalize an answer.
- Preserve the user's own words and explicitly record intent shifts.
- Stop when the record is concrete enough, the user asks to stop, or the turn
  budget is exhausted.
- The only next-phase values are `continue_elicitation` and
  `phase_minus_1b_clarity_gate`.

Artifacts:

- `prompts/06-intent-elicitation.md`
- `schemas/intent_elicitation.v1.schema.json`
- `helpers/validate_intent_elicitation.ps1`
- JSON examples under `examples/intent-elicit/`
- Offline behavior-contract cases under `evals/cases/`

## Layer 3: Correctly Scoped Agent Pack Templates

Add four reusable templates while keeping every role aligned with the actual
expert definition:

- `bug-fix`: reproduce -> implement -> review
- `code-review`: map context -> review -> verify findings
- `feature-request`: product -> design -> implementation -> evidence -> review
- `research-report`: research -> analysis -> report writing

Only expert names present in the configured expert library are used.

## Compatibility

- Existing schemas remain backward compatible.
- Existing templates remain valid.
- Existing four release checks continue to pass.
- v5.6.3 remains the source-of-truth layer for runtime evidence.
- Phase -1a produces evidence for Phase -1b; it does not create an execution
  contract and does not authorize execution.

## Verification

Completion requires:

1. Full Pester suite reports zero failures.
2. Encoding check passes.
3. All templates validate using an isolated expert-stub root.
4. All task-analysis examples validate.
5. All intent-elicitation examples validate.
6. Offline prompt eval definitions pass and include the new coverage.
7. Local CI runs the full suite and exits zero.
8. `git diff --check` reports no whitespace errors.
