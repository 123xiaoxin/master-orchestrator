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
.\evals\run_llm_evals.ps1
```

DeepSeek-compatible example:

```powershell
$env:MASTER_EVAL_API_KEY = "<redacted>"
$env:MASTER_EVAL_BASE_URL = "https://api.deepseek.com/v1"
$env:MASTER_EVAL_MODEL = "deepseek-chat"
.\evals\run_llm_evals.ps1
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
