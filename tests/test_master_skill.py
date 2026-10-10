"""Integration invariants; no model calls, runtime actions, or installed changes."""
import importlib.util
import json
import pathlib
import shutil
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('master_skill', ROOT / 'scripts/master_skill.py')
skill = importlib.util.module_from_spec(spec)
spec.loader.exec_module(skill)


class MasterIntegration(unittest.TestCase):
    def setUp(self):
        (ROOT / '.local').mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='integration-test-', dir=ROOT / '.local')
        self.root = pathlib.Path(self.temp.name)
        for name in ['skills', 'prompts', 'schemas', 'helpers', 'templates', 'docs', 'scripts']:
            shutil.copytree(ROOT / name, self.root / name, ignore=shutil.ignore_patterns('__pycache__'))
        self.data = json.loads((self.root / skill.MANIFEST).read_text(encoding='utf-8'))

    def tearDown(self):
        # TemporaryDirectory owns a fresh GUID workspace below repo .local.
        self.temp.cleanup()

    def save(self):
        skill.write_json(self.root / skill.MANIFEST, self.data)

    def test_required_closure_and_intent_selection(self):
        data = skill.load_manifest(self.root)
        self.assertEqual([m['id'] for m in skill.select(data, [])], ['01', '05', '07', '08'])
        self.assertEqual([m['id'] for m in skill.select(data, ['06'])], ['01', '05', '07', '08', '06'])
        self.assertNotIn('02', [m['id'] for m in skill.select(data, ['06'])])

    def test_cycle_is_rejected(self):
        self.data['modules'][0]['dependsOn'] = ['08']
        self.save()
        with self.assertRaisesRegex(ValueError, 'cycle'):
            skill.load_manifest(self.root)

    def test_missing_module_is_rejected(self):
        (self.root / 'prompts/08-goal-pursuit-and-evidence.md').rename(self.root / 'missing.md')
        with self.assertRaises(ValueError):
            skill.load_manifest(self.root)

    def test_escaping_source_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'outside'):
            skill.contained(self.root, '../outside.md')

    def test_required_evidence_cannot_be_dropped(self):
        self.data['modules'][3]['required'] = False
        self.save()
        with self.assertRaisesRegex(ValueError, 'Required governance closure'):
            skill.load_manifest(self.root)

    def test_unknown_dependency_is_rejected(self):
        self.data['modules'][3]['dependsOn'] = ['99']
        self.save()
        with self.assertRaisesRegex(ValueError, 'Unknown dependency'):
            skill.load_manifest(self.root)

    def test_version_disagreement_is_rejected(self):
        self.data['packageVersion'] = '9.0-final'
        self.save()
        with self.assertRaisesRegex(ValueError, 'version disagrees'):
            skill.load_manifest(self.root)

    def test_package_is_self_contained_and_does_not_overwrite(self):
        data = skill.load_manifest(self.root)
        output = self.root / '.local/package'
        skill.package(self.root, data, str(output))
        for path in output.rglob('*.md'):
            skill.check_links(output, path)
        lock = json.loads((output / 'source-lock.json').read_text(encoding='utf-8'))
        self.assertEqual(len(lock['selectedModules']), 8)
        self.assertIn('references/prompts/08-goal-pursuit-and-evidence.md', lock['artifacts'])
        self.assertIn('skills/master-skill/SKILL.md', lock['sources'])
        before = (output / 'SKILL.md').read_bytes()
        with self.assertRaisesRegex(ValueError, 'new directory'):
            skill.package(self.root, data, str(output))
        self.assertEqual((output / 'SKILL.md').read_bytes(), before)

    def test_export_keeps_baseline_and_source_boundaries(self):
        data = skill.load_manifest(self.root)
        original = (self.root / data['entrypoint']).read_bytes()
        output = skill.export(self.root, data, ['06'], str(self.root / '.local/export'))
        lock = json.loads((output / 'source-lock.json').read_text(encoding='utf-8'))
        self.assertEqual(lock['selectedModules'], ['01', '05', '07', '08', '06'])
        text = (output / 'master-prompt.md').read_text(encoding='utf-8')
        for mid in lock['selectedModules']:
            module = next(m for m in data['modules'] if m['id'] == mid)
            self.assertIn('<!-- SOURCE: ' + module['path'], text)
        self.assertEqual(original, (self.root / data['entrypoint']).read_bytes())
        self.assertEqual(len(lock['sourceCommit']), 40)
        self.assertEqual(len(lock['artifacts']['master-prompt.md']), 64)

    def test_output_cannot_replace_source_or_installed_skill(self):
        with self.assertRaisesRegex(ValueError, 'below this repository'):
            skill.output_dir(self.root, str(self.root / 'skills/new-skill'))
        with self.assertRaisesRegex(ValueError, 'below this repository'):
            skill.output_dir(self.root, str(self.root.parent / 'installed'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
