# Master version governance

The project remains a development draft. No release or Git tag is created by
this integration. The authoritative mapping is
[modules.json](../skills/master-skill/modules.json), and the normative developer
entrypoint is [SKILL.md](../skills/master-skill/SKILL.md).

| Identity | Current value | Meaning / maintenance |
|---|---|---|
| Project version | `5.8-draft` | Repository governance/validation line; README uses “v5.8 draft” |
| Skill package | `0.2.0-draft` | Unified developer package; replaces the v0.1 clarity-only packaging in this working branch |
| Prompt revisions | Per-module `revision` in modules.json | Historical origin plus `integration.1`; numbers need not match the project |
| Schema / contract | Existing `.v1` names and `$id` | Wire format identity; never renumber merely to match project version |
| Source Commit | `git rev-parse HEAD` | Exact committed base; uncommitted work also requires file hashes |
| SkillOpt experiment | User-assigned experiment ID | Not a project release or prompt version; no new experiment started here |

Upstream baseline SHA: `a6c2d0c48fb22f1bf8e9522c3e27270049c95267`.
Accepted integration commit: `032aa7fa123e5ae50262033cbad7af173e45e14e`.
Later evaluator/verification commits are identified by the actual build lock;
the upstream SHA does **not** identify the integrated content. Each build/export records `sourceCommit`,
`sourceBranch`, `workingTreeDirty`, selected modules, source SHA-256 hashes and
artifact hashes in `source-lock.json`. Keep that lock with the artifact. An
accepted subsequent commit establishes the new committed integration baseline;
then regenerate the lock instead of hand-editing SHA fields.

Each manifest module also records `introducedCommit`, proven by its Git file
addition history. For example, 07/08 encode v5.6-origin designs but their Prompt
files were introduced by `041a507` on the v5.8 line. A design version is not a
file's introduction commit.

## Rules for future changes

- Update the project version only when its scope changes; stay draft until an
  authorized release is actually made.
- Update the package version when the developer package's interface or required
  module selection changes. A draft package version is not a published release.
- Update only changed module revisions in the manifest; keep original version
  lines in historical documents as provenance. Those documents do not select
  current runtime rules.
- Contract changes need compatibility review, matching schemas/examples/validators
  and tests. Semantic acceptance rules may be stricter than JSON serialization.
  A valid record never proves that its declared evidence actually occurred.
- Maintain the entrypoint's metadata and manifest together; `master_skill.py
  check` verifies versions, references, coverage and dependency acyclicity.
- Preserve candidates separately from canonical sources; no optimizer writes
  directly into the production entrypoint.

## Module mapping

| Layer | Source modules | Selection |
|---|---|---|
| Core / Intent / Contract | 01 | Required |
| Correction / execution verification | 05 | Required; detailed records when applicable |
| Contract / Harness gates | 07 → 01,05 | Required; no runtime hooks implemented |
| Correction / goal and evidence | 08 → 07 | Required; complete ledgers for complex/audited tasks |
| Intent evidence | 06 → 01 | Conditional; no execution authority |
| Extensions | 02 → 01,07; 03/04 → 01,08 | Conditional dispatch, retrospective and deposition |

Historical Clarity Gate principles now live in Core 01; the old documents remain
explanatory references. The source tree is kept modular. `master_skill.py export`
creates a dependency-resolved evaluation snapshot, not another normative core.

## Runtime adapters

Adapters must refer to this same entrypoint and identify the source lock they
consume. A runtime file reader is required; dynamic Skill loading is not
implemented here. Generated packages contain the resources and use package-local
links, while source links point to the repository. These are two locations for
one rule set, not separately maintained rule definitions.

The locally installed DSH variant has Framework v1.8 and
`master_execution_contract.v2.1`, which are absent from this repository. Its
mandatory prototype and final-protocol rules have not been reconciled with
Core's direct-execution option and `master_output_contract.v1` validation format.
Do not overwrite that variant or claim adapter equivalence. Installed OpenClaw
also has a historical v0.1 package; migration and live behavior remain separate.
