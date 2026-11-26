# Master SkillOpt scoring

Target output for every item is `master_output_contract.v1` JSON (no prose
before/after when used as a SkillOpt rollout format).

## Hard score (`hard` ∈ {0,1})

`hard = 1` only if both hold:

1. `decision` matches ground truth, treating `clarify` and
   `require_more_information` as equivalent.
2. `shouldCreateAgent` equals ground truth (boolean).

Anything else is `0`, including unparsable JSON, truncated output, or schema
invalid contracts.

## Soft score (`soft` ∈ [0,1])

| Component | Weight |
| --- | ---: |
| decision match (with clarify equivalence) | 0.7 |
| `shouldCreateAgent` match | 0.3 |

Soft score is for gate diagnostics. Promotion decisions should prefer hard gate
plus human review of held-out trajectories.

## What is intentionally not scored here

- Natural-language question quality (Socratic / anti-anchoring)
- Real-goal semantic correctness beyond the decision field
- Runtime enforcement, tool evidence, or live DSH behavior
- Protected-section integrity (checked separately against baseline hashes)

Those remain manual / independent-judge responsibilities. Do not treat a high
hard score as full Master acceptance.

## Isolation

- Optimizer-visible split: **train only**
- `val` / `test`: score locally during rollout; never send held-out prompts,
  labels, expected answers, or per-case failure text into reflection prompts
- Candidate edits must stay inside editable 01/06/08 sections listed in
  [docs/skillopt-baseline.md](../../docs/skillopt-baseline.md)
