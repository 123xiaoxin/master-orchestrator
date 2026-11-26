#!/usr/bin/env python3
"""Offline checks for SkillOpt training materials."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PACKAGE = ROOT / "evals" / "skillopt"
SCRIPTS = PACKAGE / "scripts"
sys.path.insert(0, str(SCRIPTS))

from materialize_split import build_splits, check_splits, load_corpus  # noqa: E402
from score_prediction import score_item  # noqa: E402


class SkillOptMaterialsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.corpus = load_corpus()

    def test_counts_and_unique_ids(self) -> None:
        buckets = build_splits(self.corpus)
        self.assertEqual({k: len(v) for k, v in buckets.items()}, {"train": 12, "val": 12, "test": 12})
        ids = [c["id"] for c in self.corpus["cases"]]
        self.assertEqual(len(ids), len(set(ids)))

    def test_split_files_match_corpus(self) -> None:
        errors = check_splits(self.corpus)
        self.assertEqual(errors, [], msg="\n".join(errors))

    def test_only_train_optimizer_visible(self) -> None:
        buckets = build_splits(self.corpus)
        for item in buckets["train"]:
            self.assertTrue(item["optimizer_visible"])
        for split in ("val", "test"):
            for item in buckets[split]:
                self.assertFalse(item["optimizer_visible"])

    def test_score_clarify_equivalence(self) -> None:
        item = {
            "id": "x",
            "question": "q",
            "ground_truth": {"decision": "clarify", "shouldCreateAgent": False},
        }
        prediction = json.dumps(
            {
                "version": "master_output_contract.v1",
                "decision": "require_more_information",
                "shouldCreateAgent": False,
            }
        )
        scored = score_item(item, prediction)
        self.assertEqual(scored["hard"], 1)
        self.assertEqual(scored["soft"], 1.0)

    def test_score_rejects_agent_spawn(self) -> None:
        item = {
            "id": "y",
            "question": "q",
            "ground_truth": {"decision": "execute", "shouldCreateAgent": False},
        }
        prediction = json.dumps(
            {
                "version": "master_output_contract.v1",
                "decision": "execute",
                "shouldCreateAgent": True,
            }
        )
        scored = score_item(item, prediction)
        self.assertEqual(scored["hard"], 0)
        self.assertAlmostEqual(scored["soft"], 0.7)

    def test_manifest_exists(self) -> None:
        path = PACKAGE / "data" / "master_orchestrator_split" / "split_manifest.json"
        self.assertTrue(path.is_file())
        manifest = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["counts"], {"train": 12, "val": 12, "test": 12})
        self.assertEqual(manifest["optimizerVisibleSplits"], ["train"])


if __name__ == "__main__":
    unittest.main()
