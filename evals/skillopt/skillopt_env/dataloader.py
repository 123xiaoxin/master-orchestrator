"""SplitDataLoader for Master Orchestrator SkillOpt items."""

from __future__ import annotations

import json
from pathlib import Path

try:
    from skillopt.datasets.base import SplitDataLoader
except ImportError:  # pragma: no cover - only used inside SkillOpt checkout
    class SplitDataLoader:  # type: ignore[no-redef]
        def __init__(self, **kwargs):
            raise ImportError(
                "skillopt is not installed; copy this package into a SkillOpt checkout"
            )


def _normalize(raw: dict) -> dict:
    return {
        "id": str(raw["id"]),
        "question": raw["question"],
        "ground_truth": raw["ground_truth"],
        "task_type": raw.get("task_type", "intent"),
        "category": raw.get("category", "general"),
        "soft_hints": raw.get("soft_hints") or {},
        "notes": raw.get("notes"),
        "optimizer_visible": bool(raw.get("optimizer_visible", False)),
    }


class MasterOrchestratorDataLoader(SplitDataLoader):
    """Load items.json from train/ / val/ / test/ under split_dir."""

    def load_split_items(self, split_path: str) -> list[dict]:
        path = Path(split_path)
        candidates = sorted(path.glob("items.json"))
        if not candidates:
            candidates = sorted(path.glob("*.json"))
        if not candidates:
            raise FileNotFoundError(f"No .json file found in {split_path}")
        with candidates[0].open(encoding="utf-8") as f:
            raw = json.load(f)
        if isinstance(raw, dict) and "cases" in raw:
            raw = raw["cases"]
        if not isinstance(raw, list):
            raise ValueError(f"expected list in {candidates[0]}")
        return [_normalize(item) for item in raw]
