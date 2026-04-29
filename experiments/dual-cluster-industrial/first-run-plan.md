# First Run Plan

## Objective

Run the first controlled dual-cluster experiment to validate Master Orchestrator long-chain behavior.

This is a protocol validation run, not a production industrial automation run.

## Scope

Cluster A focuses on framework hardening.

Cluster B focuses on industrial safety-first template review.

The first run should not create or imply any direct equipment-control capability.

## Inputs

| Input | Path |
|-------|------|
| Core prompt | `prompts/🧠 01-core 主控框架.md` |
| Agency prompt | `prompts/🎭 02-agency 专家调度.md` |
| Industrial principles | `docs/industrial/industrial-agent-principles.md` |
| Safety gateway design | `docs/industrial/safety-gateway-design.md` |
| Experiment protocol | `experiments/dual-cluster-industrial/protocol.md` |
| Checklist | `experiments/dual-cluster-industrial/phase-checklist.md` |

## Phase 0 Commands

Read-only only:

```powershell
.\helpers\check_env.ps1 -OpenClawTimeoutSeconds 12 -ExpertPreviewLimit 40
.\helpers\validate_templates.ps1
```

## Phase 1 Draft Deployment

| Cluster | Goal | Suggested Template | Agents | Safety Notes |
|---------|------|--------------------|--------|--------------|
| A | Review framework readiness for dual-cluster execution | `webapp-build` only as placeholder until a framework template exists | product-manager, code-reviewer, evidence-collector | No industrial claims |
| B | Review industrial safety template and principles | `industrial-safety-governance` | automation-governance-architect, workflow-architect, compliance-auditor, security-engineer, evidence-collector | `proposal_only`, no direct device control |

The first run can use Cluster A as a lightweight self-review lane instead of creating a large second pack. If the operator wants full dual-pack creation, create both packs only after Phase 2 approval.

## Phase 2 Questions

Master must ask:

1. Proceed to Phase 3?
2. Use step-by-step or managed mode?
3. Create Cluster B only, or both Cluster A and B?
4. Cleanup policy: `destroy`, `keep`, or `archive-template`?

## Phase 3 Guardrails

- Do not let Cluster B generate direct equipment commands.
- Store long outputs as file references or concise summaries.
- Keep Cluster A and Cluster B results separate until Phase 4.
- Use `-DryRun` if the operator only wants a rehearsal.

## Phase 4 Expected Outputs

- Experiment outcome summary
- Template validation summary
- Industrial safety compliance notes
- Framework gaps discovered by the run
- Cleanup result
- Next changes to commit

## Minimal Success Criteria

- Phase 0-2 finish without creating agents.
- `validate_templates.ps1` passes.
- Industrial templates remain `proposal_only`.
- Master produces a final cross-review summary.
