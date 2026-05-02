# Offline Prompt Eval Cases

v5.4 evals are offline contract cases. They do not call a real LLM or OpenClaw.
Each case records an input, the expected governance behavior, and strings that a
human or future runner can check in a generated response.

Current coverage:

- Ambiguous input must trigger Phase -1 clarification instead of immediate spawn.
- User attempts to override heartbeat must still preserve `heartbeat=0`.
- Unverified user-created agents must be bypassed or downgraded.

Run:

```powershell
.\evals\run_prompt_evals.ps1
```
