#!/usr/bin/env python3
"""Materialize SkillOpt split_dir items from corpus/cases.json.

Usage (from repository root):
  python -B -X utf8 evals/skillopt/scripts/materialize_split.py
  python -B -X utf8 evals/skillopt/scripts/materialize_split.py --check
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PACKAGE = ROOT / "evals" / "skillopt"
CORPUS = PACKAGE / "corpus" / "cases.json"
SPLIT_DIR = PACKAGE / "data" / "master_orchestrator_split"
SPLIT_ALIASES = {"train": "train", "val": "val", "validation": "val", "test": "test"}


def _sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_corpus(path: Path = CORPUS) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def normalize_item(case: dict) -> dict:
    split = SPLIT_ALIASES[case["split"]]
    question = case["question"]
    return {
        "id": case["id"],
        "split": split,
        "task_type": case.get("task_type", "intent"),
        "category": case.get("category", "general"),
        "question": question,
        "inputSha256": _sha256_text(question),
        "ground_truth": case["ground_truth"],
        "soft_hints": case.get("soft_hints") or {},
        "source": case.get("source"),
        "notes": case.get("notes"),
        "optimizer_visible": split == "train",
    }


def build_splits(corpus: dict) -> dict[str, list[dict]]:
    buckets: dict[str, list[dict]] = {"train": [], "val": [], "test": []}
    seen: set[str] = set()
    for case in corpus["cases"]:
        item = normalize_item(case)
        if item["id"] in seen:
            raise ValueError(f"duplicate case id: {item['id']}")
        seen.add(item["id"])
        buckets[item["split"]].append(item)
    for key in buckets:
        buckets[key].sort(key=lambda x: x["id"])
    return buckets


def write_splits(buckets: dict[str, list[dict]], out_dir: Path = SPLIT_DIR) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    for split, items in buckets.items():
        split_path = out_dir / split
        split_path.mkdir(parents=True, exist_ok=True)
        payload_path = split_path / "items.json"
        payload_path.write_text(
            json.dumps(items, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    counts = {k: len(v) for k, v in buckets.items()}
    manifest = {
        "benchmark": "master_orchestrator",
        "format": "skillopt.split_dir.v1",
        "split_mode": "split_dir",
        "counts": counts,
        "item_fields": [
            "id",
            "question",
            "task_type",
            "category",
            "ground_truth",
            "soft_hints",
            "inputSha256",
            "optimizer_visible",
        ],
        "optimizerVisibleSplits": ["train"],
        "promotionOnly": ["val", "test"],
        "scoring": {
            "module": "evals/skillopt/scripts/score_prediction.py",
            "hard": "decision (clarify≡require_more_information) AND shouldCreateAgent",
            "soft": "0.7 decision + 0.3 shouldCreateAgent",
        },
        "sourceCorpus": "evals/skillopt/corpus/cases.json",
        "notes": [
            "Labels exist in all splits for local rollout scoring only.",
            "Do not feed held-out inputs, labels, or per-case failures into SkillOpt reflection.",
            "This package does not start training or authorize paid model calls.",
        ],
    }
    (out_dir / "split_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest


def check_splits(corpus: dict, out_dir: Path = SPLIT_DIR) -> list[str]:
    errors: list[str] = []
    buckets = build_splits(corpus)
    expected_counts = corpus.get("counts") or {}
    actual = {k: len(v) for k, v in buckets.items()}
    for split, n in expected_counts.items():
        key = SPLIT_ALIASES.get(split, split)
        if actual.get(key) != n:
            errors.append(f"count mismatch {key}: expected {n}, got {actual.get(key)}")

    cats = Counter(c["category"] for c in corpus["cases"])
    if len(cats) < 5:
        errors.append(f"expected diverse categories, got {dict(cats)}")

    for split, items in buckets.items():
        path = out_dir / split / "items.json"
        if not path.is_file():
            errors.append(f"missing {path.relative_to(ROOT)}")
            continue
        disk = json.loads(path.read_text(encoding="utf-8"))
        if disk != items:
            errors.append(f"stale split file: {path.relative_to(ROOT)}; re-run materialize")
        for item in disk:
            if "id" not in item or "question" not in item or "ground_truth" not in item:
                errors.append(f"{item.get('id', '?')} missing required fields")
            gt = item.get("ground_truth") or {}
            if gt.get("decision") not in {
                "execute",
                "clarify",
                "require_more_information",
                "prototype",
                "degrade",
                "block",
            }:
                errors.append(f"{item['id']} invalid decision {gt.get('decision')}")
            if "shouldCreateAgent" not in gt:
                errors.append(f"{item['id']} missing shouldCreateAgent")
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate existing split files")
    parser.add_argument("--corpus", type=Path, default=CORPUS)
    parser.add_argument("--out", type=Path, default=SPLIT_DIR)
    args = parser.parse_args(argv)

    corpus = load_corpus(args.corpus)
    if args.check:
        errors = check_splits(corpus, args.out)
        if errors:
            print("CHECK FAILED", file=sys.stderr)
            for err in errors:
                print(f"- {err}", file=sys.stderr)
            return 2
        print("CHECK OK")
        return 0

    buckets = build_splits(corpus)
    manifest = write_splits(buckets, args.out)
    print(json.dumps({"wrote": str(args.out), "counts": manifest["counts"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
