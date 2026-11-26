# Master Skill developer package (Draft)

Project: `5.8-draft`; package: `0.2.0-draft`. Module revisions and `.v1`
contracts retain separate identities. See [version governance](../../docs/version-governance.md).

[SKILL.md](SKILL.md) is the single normative entrypoint. `AGENTS.md` and
`IDENTITY.md` are adapter pointers. [modules.json](modules.json) records required
01/05/07/08 and conditional 06/02/03/04 dependencies.

## Build before installing

From the repository root, with Python 3.10+ (standard library only):

```powershell
python scripts/master_skill.py check
python scripts/master_skill.py build --output .local/master-skill-package
```

The output is self-contained: relative links, prompt modules, contracts,
reference helpers/templates, documentation and `source-lock.json` with actual
Git HEAD, dirty status and source hashes. The builder refuses an existing output
directory. Copy the generated package to a **new** skill directory supported by
the host. Back up and reconcile existing installations before replacement;
do not force-copy over an unknown installed version. The source folder alone
is not a distributable package.

## Loading and environment limits

The host must expose the entrypoint and a file reader. Read all required modules
and applicable conditional modules explicitly. No dynamic loading implementation
is claimed. Required reading does not force complex-task records on simple tasks.

OpenClaw reference helpers require the matching environment and authorization.
DSH uses its own tools; do not run OpenClaw lifecycle helpers there. The local
DSH Framework v1.8 / contract v2.1 is an external variant with unresolved
protocol differences, not a repository adapter. This task does not replace
installed skills or modify runtime configuration.

Verify package construction, model behavior, and runtime enforcement separately.
A successful build establishes resource availability only.

## SkillOpt preparation

```powershell
python scripts/master_skill.py export --modules 06 --output .local/skillopt-baseline
```

This exports the entrypoint plus required dependency closure and 06, with a
source lock. It performs no model call or training. Read
[SkillOpt boundaries](../../docs/skillopt-baseline.md) before making a candidate.

Dataset, scorer, config template, and reference SkillOpt env adapter:
[evals/skillopt/](../../evals/skillopt/). Helper:

```powershell
python -B -X utf8 evals/skillopt/scripts/prepare_initial_skill.py
```
