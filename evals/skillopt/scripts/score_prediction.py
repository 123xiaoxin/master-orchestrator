#!/usr/bin/env python3
"""Score Master SkillOpt predictions against corpus ground truth.

hard = 1 only when decision (with clarify equivalence) and shouldCreateAgent match.
soft in [0, 1] awards partial credit for each field.
"""

from __future__ import annotations

import json
import re
from typing import Any

CLARIFY_EQUIV = frozenset({"clarify", "require_more_information"})


def _decision_match(predicted: str | None, expected: str) -> bool:
    if predicted is None:
        return False
    p = str(predicted).strip()
    e = str(expected).strip()
    if e in CLARIFY_EQUIV:
        return p in CLARIFY_EQUIV
    return p == e


def extract_contract(text: str) -> dict[str, Any] | None:
    """Best-effort extract of master_output_contract.v1 JSON from model output."""
    if not text or not str(text).strip():
        return None
    raw = str(text).strip()
    try:
        obj = json.loads(raw)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass

    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, flags=re.DOTALL)
    if fence:
        try:
            obj = json.loads(fence.group(1))
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass

    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        try:
            obj = json.loads(raw[start : end + 1])
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            return None
    return None


def score_item(item: dict[str, Any], prediction: str) -> dict[str, Any]:
    gt = item.get("ground_truth") or {}
    expected_decision = gt.get("decision")
    expected_agent = gt.get("shouldCreateAgent")

    contract = extract_contract(prediction)
    predicted_decision = None if contract is None else contract.get("decision")
    predicted_agent = None if contract is None else contract.get("shouldCreateAgent")

    decision_ok = _decision_match(predicted_decision, expected_decision)
    agent_ok = predicted_agent is not None and bool(predicted_agent) == bool(expected_agent)

    soft = 0.0
    if decision_ok:
        soft += 0.7
    if agent_ok:
        soft += 0.3
    hard = 1 if (decision_ok and agent_ok) else 0

    return {
        "id": str(item.get("id")),
        "hard": hard,
        "soft": round(soft, 4),
        "decision_ok": decision_ok,
        "should_create_agent_ok": agent_ok,
        "predicted_decision": predicted_decision,
        "predicted_shouldCreateAgent": predicted_agent,
        "expected_decision": expected_decision,
        "expected_shouldCreateAgent": expected_agent,
        "parsed_contract": contract is not None,
        "task_type": item.get("task_type", "master"),
        "task_description": item.get("question", ""),
        "question": item.get("question", ""),
    }


def score_batch(items: list[dict[str, Any]], predictions: dict[str, str]) -> list[dict[str, Any]]:
    results = []
    for item in items:
        pred = predictions.get(str(item["id"]), "")
        results.append(score_item(item, pred))
    return results
