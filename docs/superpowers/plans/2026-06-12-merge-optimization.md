# Master Orchestrator Merge Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate portable CI/testing, optional Phase -1a intent elicitation, and correctly scoped reusable templates into the current v5.6.3 baseline.

**Architecture:** Keep the existing phase engine intact. Add portability at helper boundaries, add Phase -1a as an optional evidence-producing module that always hands off to Phase -1b, and expose one complete local/remote validation pipeline.

**Tech Stack:** Windows PowerShell 5.1 compatible scripts, PowerShell 7 CI, Pester 5.4.1, JSON Schema 2020-12 documents, Markdown prompts.

---

### Task 1: Portable Agent Pack Validation

**Files:**
- Modify: `helpers/create_agent_pack.ps1`
- Modify: `helpers/validate_templates.ps1`
- Create: `tests/AgentPack.Tests.ps1`
- Create: `tests/TestSupport.ps1`

- [x] Write failing tests proving a temporary `AgencyRoot` is honored.
- [x] Run the focused Pester file and confirm it fails on the missing parameter.
- [x] Add `AgencyRoot` parameters and pass them through every expert lookup.
- [x] Run the focused tests and confirm they pass.

### Task 2: Honest Complete CI

**Files:**
- Create: `run-tests.ps1`
- Create: `local-ci.ps1`
- Create: `.github/workflows/ci.yml`
- Create: `tests/CiContract.Tests.ps1`
- Modify: `.gitignore`

- [x] Write contract tests proving local CI invokes the complete `tests` directory.
- [x] Confirm the tests fail before CI scripts exist.
- [x] Implement full-suite local CI and a PowerShell 7 GitHub workflow without third-party PowerShell setup actions.
- [x] Confirm contract tests and the complete suite pass.

### Task 3: Intent Elicitation Contract

**Files:**
- Create: `schemas/intent_elicitation.v1.schema.json`
- Create: `helpers/validate_intent_elicitation.ps1`
- Create: `examples/intent-elicit/*.json`
- Create: `tests/IntentElicitation.Tests.ps1`

- [x] Write failing tests for required fields, enum values, intent shifts, and the Phase -1b-only handoff.
- [x] Confirm the tests fail before the schema and validator exist.
- [x] Implement the schema, semantic validator, and five JSON examples.
- [x] Confirm examples pass and an invalid Phase 0 handoff fails.

### Task 4: Phase -1a Prompt Integration

**Files:**
- Create: `prompts/06-intent-elicitation.md`
- Modify: `prompts/01-core-master-framework.md`
- Modify: `evals/run_prompt_evals.ps1`
- Create: `evals/cases/elicit-*.json`
- Create: `tests/PromptContract.Tests.ps1`

- [x] Write failing prompt-contract tests for one-question turns, anti-anchoring, optional loading, and mandatory Phase -1b handoff.
- [x] Implement the prompt module and the minimal core prompt integration.
- [x] Extend offline eval coverage reporting without claiming real LLM execution.
- [x] Run prompt-contract and offline eval checks.

### Task 5: Reusable Templates

**Files:**
- Create: `templates/bug-fix.json`
- Create: `templates/code-review.json`
- Create: `templates/feature-request.json`
- Create: `templates/research-report.json`
- Create: `tests/TemplateRoles.Tests.ps1`

- [x] Write failing role-contract tests.
- [x] Add templates using only available expert names and role-appropriate work.
- [x] Validate dependencies, expert existence, Micro-SOPs, and role assertions.

### Task 6: Documentation and Release Verification

**Files:**
- Modify: `README.md`
- Modify: `TODO.md`
- Modify: `templates/README.md`
- Create: `docs/ci-cd.md`

- [x] Document the optional Phase -1a boundary and validation commands.
- [x] Run the full Pester suite.
- [x] Run encoding, template, task-analysis, intent-elicitation, and offline eval checks.
- [x] Run local CI and `git diff --check`.
- [x] Review the complete diff against this design.
