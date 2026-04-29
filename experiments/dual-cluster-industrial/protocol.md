# Dual Cluster Protocol

## Purpose

This protocol tests long-chain Master Orchestrator behavior with two parallel clusters:

- Cluster A: Master framework engineering
- Cluster B: Industrial safety-first agent packs

## Phase 0: Environment Check

Allowed tools:

- `helpers/check_env.ps1`
- read-only file inspection

Required output:

- Available expert count
- Available templates
- Recommended plugins
- Known OpenClaw command status
- Any blocker before creating agents

Forbidden:

- Creating agents
- Cleaning agents
- Editing files before Phase 2 confirmation

## Phase 1: Dual Cluster Plan

Master must output a deployment table for both clusters:

| Cluster | Task | Template | Agents | Dependencies | Safety Notes |
|---------|------|----------|--------|--------------|--------------|

Cluster B must include:

- `safetyMode: proposal_only`
- high-risk action constraints
- audit requirements
- no direct device control

Forbidden:

- Calling `create_temp_expert.ps1`
- Calling `create_agent_pack.ps1`
- Calling `cleanup_temp.ps1`
- Calling `finalize_agent_pack.ps1`

## Phase 2: Human Confirmation

Master must ask for:

- Execution mode: step-by-step or managed
- Whether to create both clusters now
- Cleanup policy: destroy, keep, or archive-template

No agent creation is allowed before explicit confirmation.

## Phase 3: Parallel Execution

Cluster isolation rules:

- Cluster A and B do not call each other directly
- Each cluster reports back to Master
- Master controls merge order
- Industrial outputs remain proposal-only

Recommended flow:

1. Create Cluster A pack
2. Create Cluster B pack
3. Dispatch tasks independently
4. Store concise summaries
5. Return evidence and file paths to Master

## Phase 4: Cross Review and Merge

Required cross-review:

- Cluster A reviews Cluster B outputs for template validity and repository consistency
- Cluster B reviews Cluster A outputs for industrial safety compliance
- Master resolves conflicts and writes final summary

Required closeout:

- Final delivery summary
- Validation results
- Safety deviations, if any
- Cleanup action
- Lessons learned

## Success Criteria

- Phase 1-2 no agent creation
- Both clusters remain isolated during Phase 3
- Industrial cluster never suggests direct device control
- Final outputs are auditable
- Temporary agents are destroyed or intentionally retained
