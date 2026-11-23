"""Tests of eval material integrity; never claims model behavior validation."""
import importlib.util
import hashlib
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
            (module / 'references/not-for-model.md').write_text('operator-only sentinel', encoding='utf-8')
            result = materials.prepare(output, module / 'evals')
            self.assertEqual(result['modelCalls'], 0)
            self.assertEqual(result['behaviorStatus'], 'BEHAVIOR_NOT_VERIFIED')
            record = json.loads((output / 'operator-only/run-record.template.json').read_text(encoding='utf-8'))
            self.assertEqual(record['status'], 'NOT_RUN')
            self.assertEqual(record['transcript'], [])
            self.assertFalse(record['p6Admission'])
            manifest = json.loads((output / 'operator-only/manifest.json').read_text(encoding='utf-8'))
            common = ['contracts/contract.md', 'contracts/clarify_input.v1.schema.json',
                      'contracts/clarify_state.v1.schema.json']
            skill = ['SKILL.md', 'references/clarification-method.md', 'references/compatibility.md']
            self.assertEqual(manifest['modelFilesByArm'], {'baseline': common, 'skill': common + skill})
            self.assertFalse(manifest['executable'])
            self.assertEqual(manifest['modelFileBase'], 'skill/')
            copied = {p.relative_to(output/'skill').as_posix() for p in (output/'skill').rglob('*') if p.is_file()}
            self.assertEqual(copied, set(common + skill))
            for name in copied:
                self.assertEqual((output/'skill'/name).read_bytes(), (module/name).read_bytes())
                self.assertEqual(manifest['skillFilesSha256'][name], hashlib.sha256((module/name).read_bytes()).hexdigest())
            protocol = (module/'evals/host-protocol.md').read_bytes()
            self.assertEqual((output/'operator-only/host-protocol.md').read_bytes(), protocol)
            self.assertEqual(manifest['operatorProtocolSha256'], hashlib.sha256(protocol).hexdigest())
            with self.assertRaisesRegex(ValueError, 'new directory'):
                materials.prepare(output, module / 'evals')

    def test_prepare_requires_every_declared_model_file_and_operator_protocol(self):
        for missing in ['clarification-method.md', 'host-protocol.md']:
            with self.subTest(missing=missing), tempfile.TemporaryDirectory(prefix='clarify-missing-', dir=ROOT.parent) as name:
                module = Path(name)/'module'
                module.mkdir()
                shutil.copyfile(ROOT.parent/'SKILL.md', module/'SKILL.md')
                for folder in ['contracts', 'references', 'evals']:
                    shutil.copytree(ROOT.parent/folder, module/folder,
                                    ignore=shutil.ignore_patterns('__pycache__', missing))
                output = Path(name)/'packets'
                with self.assertRaisesRegex(ValueError, 'Declared model files'):
                    materials.prepare(output, module/'evals')
                self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
