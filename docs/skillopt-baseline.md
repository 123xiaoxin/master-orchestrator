# SkillOpt baseline and optimization boundary

This integration does not start training, invoke a model, replace installed
Skills, or reimplement SkillOpt. The next authorized scope is **intent
clarification and execution correction**. Other capabilities are compatibility
constraints, not optimization targets.

## Actual rule source

Start at [SKILL.md](../skills/master-skill/SKILL.md), use
[modules.json](../skills/master-skill/modules.json), and explicitly include the
required closure 01/05/07/08 plus 06 for intent evidence. 02/03/04 are included in
the distributable package but should be selected in an experiment only for
compatibility scenarios that require them.

```powershell
python scripts/master_skill.py check
python scripts/master_skill.py export --modules 06 --output .local/skillopt-baseline
```

The generated `master-prompt.md` contains source boundaries and module revisions;
`source-lock.json` identifies the exact entrypoint, selected modules, Git base,
dirty state and content hashes. This snapshot is a test input, not a combined
production Prompt. Preserve the original source tree and baseline artifact.

The previous repository `evals/run_llm_evals.ps1` default loaded only
`prompts/01-core-master-framework.md`. That omitted 05/07/08 and the full 06 rules.
It could not cover the effective unified governance closure. The current runner
requires an explicitly exported snapshot or an explicit legacy `-PromptFile`;
no model run has been performed in this integration.

No SkillOpt configuration, training logs, scores or experiment IDs were found in
the audited Git tree/history. Therefore “previous SkillOpt optimized only 01” is
user-provided experiment context, consistent with the runner's old default, not
an independently recovered experiment result.

## Candidate rules

| Candidate source | Permitted optimization |
|---|---|
| 01 Phase -1b | Question phrasing, real-goal explanation, smallest useful prototype guidance |
| 06 | User-evidence collection and question strategy; preserve one decision question per turn, anti-anchoring and tested handoff constraints |
| 08 Dynamic Adjustment | Observed drift detection, contract/progress update strategy and bounded correction wording |
| Entry / 05 / 07 / 02-04 / contracts | Frozen compatibility and safety context |

Freeze authorization, phase dependency/order, non-fabrication, evidence origin,
maximum two repair rounds, stop conditions, final acceptance gates and all
Schema IDs/field shapes. “True goal” interpretation cannot supply authorization.
Partial evidence cannot be invented to satisfy the four-layer guard. An
optimizer cannot turn a declarative ledger into observed runtime evidence.

Create candidates in an isolated copy/worktree; retain baseline files and the
source lock. Record experiment ID, candidate/base hashes, model/provider,
token/output limits, case split, judge versions and seeds. Review only the
permitted sections against the frozen baseline before any evaluation. No direct
write-back to `skills/master-skill/SKILL.md` or installed skills.

## Required preconditions for the next experiment

1. Review this integration and capture its accepted commit plus source hashes.
   Current committed base is `a6c2d0c48fb22f1bf8e9522c3e27270049c95267`; it does
   not include the accepted integration. Do not present it as the integrated
   release SHA.
2. Prevent scoring leakage: keep held-out cases, judge instructions and expected
   answers out of training/candidate generation. The repository's static string
   assertions are not a sufficient independent quality judge.
3. Address small-sample instability: use a declared sample plan, repeated runs
   and report variation/uncertainty; do not select a winner from one tiny sample.
4. Address output truncation: budget for the full selected context and output;
   inspect finish reasons and token usage. A truncated output is an invalid or
   incomplete trial, not a semantic failure to hide or a successful trial.
5. Independently validate simple, vague-intent, and observed-drift scenarios;
   separate static checks, Mock fixtures, real model behavior and live runtime
   enforcement. Compare baseline and candidate under matched conditions.
6. Resolve DSH Framework v1.8 / v2.1 contract authority before treating that
   installed Skill as this experiment's effective runtime source. Capture actual
   loaded sources and observed traces, not just a model's assertion of loading.
7. Obtain authorization and budget for paid model evaluation/training. This
   task grants neither large paid evaluations nor a SkillOpt training run.

Scoring leakage, unstable small samples and output truncation were reported by
the user from the first experiment; source logs were not available to reverify
them. They remain mandatory evaluation preconditions.

## Independent validation and decision

Run the existing local CI, entrypoint/closure/package tests, and contract
validators on each candidate. Keep protected-source diffs empty. Use a reviewer
or evaluator independent of candidate generation with withheld tests and
observed tool evidence. This integration's self-checks are not independent model
review. A candidate passes only with intact safety invariants, compatible
contracts, no fabricated evidence and measurable held-out improvement. Otherwise
retain the baseline and stop promotion; bounded repair never means endless
optimization retries.

**Source preparation is available; the next experiment's full startup conditions
are not yet met.** Runtime authority, held-out evaluation design, truncation
handling and paid-run authorization must be established first.

## Runtime verification follow-up (2026-10-10)

The accepted integration is `032aa7fa123e5ae50262033cbad7af173e45e14e`.
The manifest distinguishes upstreamBaselineSha and acceptedIntegrationSha.
Always regenerate the artifact from the final clean commit; its source-lock
records the actual sourceCommit, including subsequent evaluator changes.

See [runtime verification report](reports/master-runtime-integration-verification.md)
for measured DSH component loading and remaining protocol gaps.
The runner now rejects empty, truncated, malformed and schema-invalid output,
and supports parsed field checks. This is not an independent semantic judge.
Twelve pilot cases are disjoint train/validation/test groups of four. Only train
is optimizer-visible; do not pass held-out inputs, checks, per-case failures or
outputs to candidate generation. Four samples per split cannot support reliable
improvement claims. No model evaluation or training has been run.

`evals/skillopt-preflight.json` (repository planning record, not packaged runtime resource) is a disabled planning
record, not a configuration proven against an installed SkillOpt API. Resolve
model IDs, authorization, monetary cap and independent judging before use.

## Prepared training materials (2026-11-26)

Offline SkillOpt-ready materials live in the repository path `evals/skillopt/`
(not packaged into the Master Skill distributable):

- Corpus and `split_dir` (`train`/`val`/`test`, 12 each)
- Contract scorer (`score_prediction.py`)
- Config template and copy-ready reference env adapter
- `prepare_initial_skill.py` to export governed `master-prompt.md` as `skill_init`

Use those files with a local SkillOpt checkout. Materials preparation is not
training admission: freeze/protection, held-out isolation, independent judging,
and paid-run authorization remain mandatory before any live optimize loop.
