# Initial skill for SkillOpt

Do not commit a generated `initial.md` here. Export from the governed source:

```powershell
python scripts/master_skill.py check
python scripts/master_skill.py export --modules 06 --output .local/skillopt-baseline
```

Then:

```powershell
Copy-Item .\.local\skillopt-baseline\master-prompt.md `
  <SkillOpt>\skillopt\envs\master_orchestrator\skills\initial.md
Copy-Item .\.local\skillopt-baseline\source-lock.json `
  <experiment-log>\source-lock.json
```

Or:

```bash
python -B -X utf8 evals/skillopt/scripts/prepare_initial_skill.py \
  --output /path/to/SkillOpt/skillopt/envs/master_orchestrator/skills/initial.md
```

The export includes required modules 01/05/07/08 plus conditional 06. SkillOpt
may edit only the sections listed in `docs/skillopt-baseline.md`.
