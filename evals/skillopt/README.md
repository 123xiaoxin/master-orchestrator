# SkillOpt training materials for Master

Ready-to-copy dataset, scoring, config template, and reference env for training
the Master skill with a **local** [Microsoft SkillOpt](https://microsoft.github.io/SkillOpt/docs/)
checkout.

This package **prepares materials only**. It does not start training, call a
model, authorize spend, or write back into `skills/master-skill/`.

## What you get

| Path | Role |
| --- | --- |
| `corpus/cases.json` | Source of truth: 36 cases (12/12/12) |
| `data/master_orchestrator_split/` | SkillOpt `split_dir` with `train`/`val`/`test` `items.json` |
| `scripts/materialize_split.py` | Rebuild / check split files from corpus |
| `scripts/score_prediction.py` | hard/soft scorer for `master_output_contract.v1` |
| `scripts/prepare_initial_skill.py` | Export governed `master-prompt.md` as `skill_init` |
| `config/master-orchestrator.default.yaml` | SkillOpt YAML template |
| `skillopt_env/` | Reference `DataLoader` / `rollout` / `EnvAdapter` |
| `scoring.md` / `adapter-notes.md` | Scoring + wiring guide |

Optimization scope matches [docs/skillopt-baseline.md](../../docs/skillopt-baseline.md):
intent clarification and execution correction. Editable surfaces are limited
01/06/08 phrasing; authorization, phase order, schemas, and repair limits stay frozen.

## Quick start (local SkillOpt)

```bash
# 1) In master-orchestrator: refresh split + export skill
python -B -X utf8 evals/skillopt/scripts/materialize_split.py --check
python -B -X utf8 evals/skillopt/scripts/prepare_initial_skill.py \
  --output /path/to/SkillOpt/skillopt/envs/master_orchestrator/skills/initial.md

# 2) Copy reference env + config into SkillOpt (see adapter-notes.md)
# 3) Point env.split_dir at:
#    <this-repo>/evals/skillopt/data/master_orchestrator_split
# 4) Dry-run with small batch_size before any paid loop
```

## Split policy

- **train (12)**: optimizer-visible
- **val (12)**: gating / selection only
- **test (12)**: final report only after selection

Labels exist in every split so the local rollout can score. Do **not** feed
held-out inputs, labels, or per-case failures into reflection / candidate
generation.

## Sample coverage

Intent: clear, vague, conflict, means/goal, non-expert, elicitation, revision.
Correction: agent failure, tool error, misunderstanding, wrong-goal artifact,
scope/authorization violation, repair-budget exhaustion, fabricated completion.

Pilot size is still small for statistical promotion. Treat early runs as
engineering dry-runs; keep uncertainty and do not promote from one tiny pass.

## Safety

- No SkillOpt process is started from this repository's CI.
- Do not overwrite installed Master skills from candidates without review.
- Obtain model IDs and monetary budget before live train.
- See `evals/skillopt-preflight.json` (planning record; still disabled by default).
