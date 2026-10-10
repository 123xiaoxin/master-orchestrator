# Offline Prompt Eval Cases

v5.4 evals are offline contract cases. They do not call a real LLM or OpenClaw.
Each case records an input, the expected governance behavior, and strings that a
human or future runner can check in a generated response.

Current coverage:

- Ambiguous input must trigger Phase -1 clarification instead of immediate spawn.
- User attempts to override heartbeat must still preserve `heartbeat=0`.
- Unverified user-created agents must be bypassed or downgraded.
- Clarity Gate cases must avoid fixed clarification rounds, treat 75%-80% readiness as a heuristic range for minimum prototypes, and require execution contracts before dispatch.

Run:

```powershell
.\evals\run_prompt_evals.ps1
```

## LLM Behavior Eval Runner

There is no implicit 01-only Prompt default. First export the required governance
closure plus optional intent module, then explicitly select that snapshot:

```powershell
python scripts/master_skill.py export --modules 06 --output .local/skillopt-baseline
# A model call requires separate authorization and populated credentials:
.\evals\run_llm_evals.ps1 -PromptFile .\.local\skillopt-baseline\master-prompt.md
```

The runner verifies an adjacent `source-lock.json` against the actual Prompt hash
and preserves it with the run. An explicit legacy `-PromptFile` remains
available for reproduction, but a single 01 module is not the unified source.
See [SkillOpt preconditions](../docs/skillopt-baseline.md); no training is started.

`run_llm_evals.ps1` calls an OpenAI-compatible chat completions endpoint and
checks the generated output against each case's `mustContain`, `mustContainAny`,
and `mustNotContain` assertions. It does not replace `run_prompt_evals.ps1`;
the offline structure runner remains unchanged.

Runtime Validation Output Mode asks the Master prompt to prefer
`master_output_contract.v1` JSON during model evals. The goal is not to force
natural-language wording to match exactly; the runner checks key behaviors,
fields, and forbidden actions.

The LLM runner also appends a Runtime Validation Eval Instruction to the system
prompt. That instruction requires machine-checkable `master_output_contract.v1`
JSON with no prose before or after the JSON. This is eval/runtime validation
format only; it is not the normal user conversation format.

`mustContainAny` is optional. Each item is a candidate group, and any one string
in the group may satisfy that assertion:

```json
{
  "mustContainAny": [
    [
      "\"decision\": \"clarify\"",
      "\"decision\": \"require_more_information\"",
      "Phase -1"
    ],
    [
      "\"executionContract\"",
      "execution contract",
      "执行契约"
    ]
  ]
}
```

Required environment variables:

- `MASTER_EVAL_API_KEY`: API key for the selected endpoint.
- `MASTER_EVAL_MODEL`: model name.

Optional environment variables:

- `MASTER_EVAL_BASE_URL`: OpenAI-compatible base URL. Defaults to
  `https://api.openai.com/v1` when unset.
- `OPENAI_BASE_URL` / `OPENAI_API_BASE`: fallback base URL variables.
- `OPENAI_MODEL`: fallback model variable if `MASTER_EVAL_MODEL` is unset.

Use `MASTER_EVAL_*` variables for this runner so eval credentials do not get
confused with OpenClaw-specific environment variables.

Run:

```powershell
$env:MASTER_EVAL_API_KEY = "<redacted>"
$env:MASTER_EVAL_MODEL = "your-model"
$env:MASTER_EVAL_BASE_URL = "https://api.openai.com/v1"
.\evals\run_llm_evals.ps1 -PromptFile .\.local\skillopt-baseline\master-prompt.md
```

DeepSeek-compatible example:

```powershell
$env:MASTER_EVAL_API_KEY = "<redacted>"
$env:MASTER_EVAL_BASE_URL = "https://api.deepseek.com/v1"
$env:MASTER_EVAL_MODEL = "deepseek-chat"
.\evals\run_llm_evals.ps1 -PromptFile .\.local\runtime-verification\skillopt-baseline\master-prompt.md
```

Useful options:

```powershell
.\evals\run_llm_evals.ps1 `
  -PromptFile .\prompts\01-core-master-framework.md `
  -CasesDir .\evals\cases `
  -ResultsDir .\evals\results `
  -RequireJson
```

Outputs are written under `evals/results/<timestamp>/`, including per-case
model output files, `summary.json`, and `summary.md`.
Do not commit `evals/results/`; it is ignored by git because it contains run
artifacts and may contain model outputs from private eval prompts.

Safety boundaries:

- The runner never executes model output.
- The runner never creates real Agents.
- The runner never calls OpenClaw actions.
- Real API keys must come from environment variables, not source files.

## Runtime preflight (2026-10-10)

All model outputs must satisfy the actual v1 JSON Schema; JSON syntax alone is
insufficient. Empty output, finish_reason truncation, malformed JSON, schema
errors and structured field failures are separate categories. The runner stores
provider usage/finish metadata when available. Legacy keyword checks remain
diagnostics and cannot establish semantic correctness.

Twelve pilot definitions in runtime-cases are disjoint train/validation/test
splits of four. Use -CasesDir evals/runtime-cases -Split train (or validation or
test for independent review), always with an explicit governed -PromptFile.
Only case input is sent to the target, never behaviorChecks. Per-case held-out
results, detailed outputs and expected answers must not reach an optimizer.
No optimizer has been integrated or run; file-level isolation still needs proof.

EvaluateOutput.ps1 checks parsed fields rather than keyword positions and
returns generic failure codes. Semantic judgment and real runtime enforcement
remain separate, unperformed checks. See
[verification report](../docs/reports/master-runtime-integration-verification.md)
and [disabled preflight plan](skillopt-preflight.json).
