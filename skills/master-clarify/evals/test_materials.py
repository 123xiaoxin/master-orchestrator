"""Tests of eval material integrity; never claims model behavior validation."""
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('clarify_eval_prepare', ROOT / 'prepare.py')
materials = importlib.util.module_from_spec(spec)
spec.loader.exec_module(materials)


class EvaluationMaterials(unittest.TestCase):
    def test_frozen_cases_and_coverage(self):
        cases, plan, freeze = materials.load_and_check()
        self.assertEqual(len(cases), 26)
        self.assertEqual(set(freeze['holdoutCaseIds']), {'T05', 'T14', 'T22', 'T25'})
        self.assertEqual(plan['minimumIndependentSessions'], 34)

    def test_modified_heldout_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix='clarify-eval-check-', dir=ROOT.parent) as name:
            root = Path(name)
            for filename in ['cases.jsonl', 'plan.json', 'freeze.json']:
                shutil.copyfile(ROOT / filename, root / filename)
            cases = [json.loads(line) for line in (root / 'cases.jsonl').read_text(encoding='utf-8').splitlines()]
            cases[4]['inputMessages'][0]['content'] += ' changed after freeze'
            (root / 'cases.jsonl').write_text('\n'.join(json.dumps(c, ensure_ascii=False) for c in cases), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'T05: frozen case changed'):
                materials.load_and_check(root)

    def test_missing_selected_coverage_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix='clarify-eval-coverage-', dir=ROOT.parent) as name:
            root = Path(name)
            for filename in ['cases.jsonl', 'plan.json', 'freeze.json']:
                shutil.copyfile(ROOT / filename, root / filename)
            plan = json.loads((root / 'plan.json').read_text(encoding='utf-8'))
            plan['selectedCaseIds'].remove('T07')
            (root / 'plan.json').write_text(json.dumps(plan), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'all twelve capabilities'):
                materials.load_and_check(root)

    def test_packets_have_no_oracles_or_scripted_future_answers(self):
        cases, _, _ = materials.load_and_check()
        for case in cases:
            packet = materials.make_packet(case)
            self.assertEqual(set(packet), {'input', 'excludedBackground', 'scenarioSeedContext'})
            encoded = json.dumps(packet, ensure_ascii=False)
            for forbidden in ['expectedBehaviors', 'forbiddenBehaviors', 'responseScript', 'capabilityIds', 'successCriteria']:
                self.assertNotIn(forbidden, encoded)
            self.assertEqual(packet['input']['evidenceType'], 'synthetic')
            self.assertIsNone(packet['input']['previousStateId'])

    def test_cross_project_context_is_excluded_from_contract_sources(self):
        cases, _, _ = materials.load_and_check()
        packet = materials.make_packet(next(c for c in cases if c['caseId'] == 'T23'))
        self.assertEqual(packet['excludedBackground'][0]['projectId'], 'project-alpha')
        self.assertTrue(all(s['projectId'] == packet['input']['projectId'] for s in packet['input']['sources']))

    def test_seed_is_not_fabricated_previous_result(self):
        cases, _, _ = materials.load_and_check()
        packet = materials.make_packet(next(c for c in cases if c['caseId'] == 'T25'))
        self.assertTrue(packet['scenarioSeedContext'])
        self.assertIsNone(packet['input']['previousStateId'])
        self.assertNotIn('state', packet)

    def test_prepare_refuses_overwrite_and_keeps_templates_unrun(self):
        with tempfile.TemporaryDirectory(prefix='clarify-eval-prepare-', dir=ROOT.parent) as name:
            output = Path(name) / 'packets'
            module = Path(name) / 'module'
            module.mkdir()
            shutil.copyfile(ROOT.parent / 'SKILL.md', module / 'SKILL.md')
            for folder in ['contracts', 'references', 'evals']:
                shutil.copytree(ROOT.parent / folder, module / folder,
                                ignore=shutil.ignore_patterns('__pycache__'))
            result = materials.prepare(output, module / 'evals')
            self.assertEqual(result['modelCalls'], 0)
            self.assertEqual(result['behaviorStatus'], 'BEHAVIOR_NOT_VERIFIED')
            record = json.loads((output / 'operator-only/run-record.template.json').read_text(encoding='utf-8'))
            self.assertEqual(record['status'], 'NOT_RUN')
            self.assertEqual(record['transcript'], [])
            self.assertFalse(record['p6Admission'])
            with self.assertRaisesRegex(ValueError, 'new directory'):
                materials.prepare(output, module / 'evals')


if __name__ == '__main__':
    unittest.main()
