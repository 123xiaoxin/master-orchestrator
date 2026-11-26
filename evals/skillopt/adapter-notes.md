# Wiring the reference env into local SkillOpt

This repository ships a **reference** env under `evals/skillopt/skillopt_env/`.
It is not executed by master-orchestrator CI.

## Copy

From your SkillOpt checkout root:

```bash
mkdir -p skillopt/envs/master_orchestrator/skills
cp -R /path/to/master-orchestrator/evals/skillopt/skillopt_env/* \
  skillopt/envs/master_orchestrator/
cp /path/to/master-orchestrator/evals/skillopt/scripts/score_prediction.py \
  skillopt/envs/master_orchestrator/
# Adjust rollout import if you flatten score_prediction next to rollout.py
```

Also copy the YAML template:

```bash
mkdir -p configs/master_orchestrator
cp /path/to/master-orchestrator/evals/skillopt/config/master-orchestrator.default.yaml \
  configs/master_orchestrator/default.yaml
```

Set `env.split_dir` to the absolute path of:

```text
master-orchestrator/evals/skillopt/data/master_orchestrator_split
```

## Register

In SkillOpt `scripts/train.py` and `scripts/eval_only.py` `_register_builtins()`:

```python
try:
    from skillopt.envs.master_orchestrator.adapter import MasterOrchestratorAdapter
    _ENV_REGISTRY["master_orchestrator"] = MasterOrchestratorAdapter
except ImportError:
    pass
```

## Initial skill

```bash
# in master-orchestrator
python scripts/master_skill.py export --modules 06 --output .local/skillopt-baseline
cp .local/skillopt-baseline/master-prompt.md \
  /path/to/SkillOpt/skillopt/envs/master_orchestrator/skills/initial.md
```

Keep `source-lock.json` with the experiment log. Do not overwrite
`skills/master-skill/` in this repository from SkillOpt candidates.

## Isolation checklist

1. Train on `train` only for reflection / candidate generation.
2. Gate on `val`; report `test` only after selection.
3. Strip held-out case text from optimizer prompts if your SkillOpt fork
   otherwise includes full batch payloads in reflection.
4. Diff candidates against baseline; reject edits outside editable 01/06/08
   sections (`docs/skillopt-baseline.md`).
5. Stop if protected hashes, Schema IDs, repair limit, or authorization text change.
