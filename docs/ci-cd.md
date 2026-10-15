# CI/CD

The repository uses one validation pipeline locally and in GitHub Actions.

## Local Validation

Prerequisites: PowerShell 7, Python 3.10+ (standard library), Node 22+, and Pester 5.4.1+.
No model calls or SkillOpt training are part of this pipeline.

```powershell
Install-Module Pester -Scope CurrentUser -RequiredVersion 5.4.1
```

Run every check:

```powershell
.\local-ci.ps1
```

Write a machine-readable report:

```powershell
.\local-ci.ps1 -OutputReport
```

The pipeline runs:

1. UTF-8 without BOM and prompt filename checks.
2. Agent Pack validation against the configured expert library.
3. `task_analysis.v1` example validation.
4. `intent_elicitation.v1` example and Phase -1a handoff validation.
5. State machine, Verify/Repair and Master output contract validation.
6. Five-layer snapshot, Final Report, Capability Gap and Goal Pursuit validation.
7. Offline prompt eval definition validation.
8. Skill entrypoint/version/dependency/reference validation and package/export tests.
9. Offline DSH Contract Adapter tests using hash-locked unmodified native snapshots.
10. Offline runtime sidecar tests: host receipts, scope gates, correlated traces, two-repair stop and independent acceptance; A–E use deterministic Mock tools.
11. Host authorization lifecycle, concurrent cumulative budgets and confined-file capability tests.
12. Controlled Provider preflight, pricing, budget, cancellation and conservative failure settlement with a no-network fixture.
13. Single DeepSeek readonly boundary, held-out intent samples and evidence-bound independent review tests.
14. The complete Pester test directory through `run-tests.ps1`.

`scripts/dsh_provider_probe.cjs` separately runs the Provider cases through the
actual installed DSH LlmRuntime and a fully assembled Agent. These local
component checks use an in-memory Provider, not real model or billing services.

`local-ci.ps1` does not run a smoke-test subset. Any Pester failure makes the
whole pipeline fail.

## Isolated Expert Library

Template validation accepts a temporary expert root:

```powershell
.\local-ci.ps1 -AgencyRoot C:\temp\agency-agents
```

Each referenced expert must still have:

```text
<AgencyRoot>/<expert-name>/AGENTS.md
```

The injected root changes only where experts are resolved. It does not disable
expert existence checks.

## GitHub Actions

`.github/workflows/ci.yml` runs on `ubuntu-latest`.

- GitHub-hosted runners already provide `pwsh`.
- The workflow installs Pester 5.4.1.
- Python 3.12 is selected explicitly for Skill package checks.
- Node 22 is selected explicitly for the standalone Adapter tests; no npm install.
- Expert stubs are generated from the actual template files.
- The workflow calls `local-ci.ps1`, so local and remote checks stay aligned.
- NUnit and local CI reports are uploaded even when validation fails.

No third-party PowerShell setup Action is required.

## Offline Eval Boundary

`evals/run_prompt_evals.ps1` validates case definitions and coverage only. It
does not call a real LLM and must not be described as proof of model behavior.
Real Phase -1a dialogue evaluation remains a separate future task.
