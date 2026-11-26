"""Rollout helper: chat_target + Master contract scoring."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Allow importing score_prediction when this package is copied into SkillOpt,
# or when run from the master-orchestrator tree.
_SCORE_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(_SCORE_DIR) not in sys.path:
    sys.path.insert(0, str(_SCORE_DIR))

from score_prediction import score_item  # noqa: E402

EVAL_FORMAT = (
    "Runtime Validation Eval Instruction: respond with a single JSON object "
    "that satisfies master_output_contract.v1. No prose before or after the JSON."
)


def _chat_target(*, system: str, user: str, max_completion_tokens: int) -> tuple[str, dict]:
    try:
        from skillopt.model import chat_target
    except ImportError as exc:  # pragma: no cover
        raise ImportError(
            "skillopt.model.chat_target required; run inside a SkillOpt environment"
        ) from exc
    return chat_target(
        system=system,
        user=user,
        max_completion_tokens=max_completion_tokens,
    )


def _rollout_one(
    item: dict,
    skill_content: str,
    *,
    prediction_dir: Path,
    max_completion_tokens: int,
) -> dict:
    system = skill_content.rstrip() + "\n\n" + EVAL_FORMAT
    user = item["question"]
    prediction, _usage = _chat_target(
        system=system,
        user=user,
        max_completion_tokens=max_completion_tokens,
    )
    scored = score_item(item, prediction)

    task_dir = prediction_dir / str(item["id"])
    task_dir.mkdir(parents=True, exist_ok=True)
    conversation = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
        {"role": "assistant", "content": prediction},
    ]
    (task_dir / "conversation.json").write_text(
        json.dumps(conversation, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (task_dir / "score.json").write_text(
        json.dumps(scored, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return {
        "id": scored["id"],
        "hard": scored["hard"],
        "soft": scored["soft"],
        "predicted_answer": prediction,
        "task_description": item.get("question", ""),
        "question": item.get("question", ""),
        "task_type": item.get("task_type", "intent"),
        "target_system_prompt": system,
        "target_user_prompt": user,
        "n_turns": 1,
        "fail_reason": None
        if scored["hard"]
        else f"decision_ok={scored['decision_ok']} agent_ok={scored['should_create_agent_ok']}",
    }


def run_batch(
    *,
    items: list[dict],
    skill_content: str,
    out_root: str,
    workers: int = 2,
    max_completion_tokens: int = 4096,
) -> list[dict]:
    del workers  # sequential reference implementation
    os.makedirs(out_root, exist_ok=True)
    prediction_dir = Path(out_root, "predictions")
    results = [
        _rollout_one(
            item,
            skill_content,
            prediction_dir=prediction_dir,
            max_completion_tokens=max_completion_tokens,
        )
        for item in items
    ]
    Path(out_root, "rollouts.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return results
