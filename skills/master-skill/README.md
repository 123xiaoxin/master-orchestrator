# Master Skill v0.1 Clarity Gate

This folder packages Master Skill v0.1 as an OpenClaw-installable skill workspace.

## Files

- `SKILL.md`: skill metadata and core operating rules.
- `AGENTS.md`: execution instructions for the Master Skill agent.
- `IDENTITY.md`: compact identity and posture.
- `README.md`: installation and usage notes.

## Core Scope

The skill only covers:

- obtaining clear intent
- generating a minimum prototype
- dynamic recalibration
- first principles
- Occam's razor
- cognitive completion
- requirement clarity gate
- execution contract before execution

It does not include industry-specific cases, platform-specific workflows, or content-form-specific implementation logic.

## Install

From the repository root:

```powershell
$source = ".\skills\master-skill"
$target = "$env:USERPROFILE\.openclaw\skills\master-skill"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
Copy-Item -Recurse -Force -LiteralPath $source -Destination $target
```

If your OpenClaw runtime expects skill workspaces under a different local directory, copy the entire `skills/master-skill` folder there without changing file names.

## Use

Use this skill when a request is unclear, broad, or likely to be overbuilt. The expected output is a clarity decision:

- `clarify`
- `prototype`
- `execute`

Before any execution layer acts, Master must produce an execution contract with real goal, boundaries, allowed actions, forbidden actions, minimum prototype, validation metrics, and risk boundaries.
