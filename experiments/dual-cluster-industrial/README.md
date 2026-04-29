# Dual Cluster Industrial Experiment

This experiment validates whether Master Orchestrator can coordinate two parallel agent clusters without losing phase discipline, safety boundaries, or auditability.

## Goal

Run two workstreams at the same time:

| Cluster | Purpose | Output |
|---------|---------|--------|
| Cluster A | Framework hardening | Improvements to Master Orchestrator templates, helper scripts, and docs |
| Cluster B | Industrial vertical pack design | Industrial safety-first templates and principles |

The experiment is successful only if Master keeps both clusters isolated during execution and merges results through a final cross-review.

## Files

| File | Purpose |
|------|---------|
| `protocol.md` | Experiment protocol and phase rules |
| `phase-checklist.md` | Per-phase checklist |
| `run-log-template.md` | Audit-friendly run log template |
| `first-run-plan.md` | Concrete first-run scope and expected outputs |
| `master-start-prompt.md` | Prompt to start the experiment in a Master session |

## Default Scope

First run should be small:

- Review and improve `docs/industrial/industrial-agent-principles.md`
- Validate `templates/industrial/industrial-safety-governance.json`
- Check whether `helpers/create_agent_pack.ps1 -DryRun` catches invalid template dependencies

Do not directly create a device-control agent. Industrial cluster stays in `proposal_only` mode.
