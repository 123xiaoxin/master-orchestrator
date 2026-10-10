"""Snapshot local DSH contracts and test them offline; never invoke a model."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dsh-home', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    out = args.output.resolve()
    if not out.is_relative_to((root / '.local').resolve()) or out.exists():
        raise ValueError('Output must be a new directory under repository .local')
    framework = args.dsh_home / 'skills/master-orchestrator/framework'
    preset = args.dsh_home / '.agent-presets/master-orchestrator'
    sources = [framework / name for name in (
        'master_execution_contract.v2.1.schema.json', 'validate-contract.mjs',
        'schema-validate.mjs', 'example-contract.v2.1.json',
        'MASTER-EXECUTION-FRAMEWORK.md', 'SEMANTIC-DEFINITIONS.md')]
    sources += [preset / name for name in ('runtime-trace-plugin.mjs', 'trace-ledger.mjs', 'agent.cordis.yml', 'preset.yml')]
    for source in sources:
        if not source.is_file():
            raise FileNotFoundError(source)
    out.mkdir(parents=True)
    hashes = {}
    for source in sources:
        shutil.copyfile(source, out / source.name)
        hashes[str(source)] = hashlib.sha256(source.read_bytes()).hexdigest()
    checks = []
    def run(name, argv, expected):
        result = subprocess.run(argv, cwd=out, capture_output=True, text=True, encoding='utf-8')
        checks.append({'name': name, 'ok': result.returncode == expected,
                       'exitCode': result.returncode, 'evidenceLevel': 'schema/offline',
                       'stdout': result.stdout, 'stderr': result.stderr})
    run('external_v21_example', ['node', 'validate-contract.mjs', 'example-contract.v2.1.json'], 0)
    schema = json.loads((root / 'schemas/master_output_contract.v1.schema.json').read_text(encoding='utf-8'))
    (out / 'repo-v1.json').write_text(json.dumps(schema['examples'][0]), encoding='utf-8')
    run('v1_is_not_a_v21_contract', ['node', 'validate-contract.mjs', 'repo-v1.json'], 1)
    fixture = json.loads((out / 'example-contract.v2.1.json').read_text(encoding='utf-8'))
    fixture['goalStatus'] = 'working'
    (out / 'unconfirmed-execute.json').write_text(json.dumps(fixture), encoding='utf-8')
    run('execute_rejects_unconfirmed_goal', ['node', 'validate-contract.mjs', 'unconfirmed-execute.json'], 1)
    fixture['goalStatus'] = 'confirmed'
    fixture['minimumPrototype'] = None
    (out / 'no-prototype.json').write_text(json.dumps(fixture), encoding='utf-8')
    run('execute_rejects_missing_prototype', ['node', 'validate-contract.mjs', 'no-prototype.json'], 1)
    smoke = out / 'probe.mjs'
    smoke.write_text('''import assert from 'node:assert/strict';
import { buildAutoBundle, classify } from './runtime-trace-plugin.mjs';
const failed = buildAutoBundle('mock-session', 1, new Date().toISOString(),
 [{name:'pwsh',args:{command:'test-command'},isError:true}], {reason:{kind:'failed'}});
assert.equal(failed.result.status, 'failed');
assert.equal(failed.events[1].validationOutcome, 'failed');
const completed = buildAutoBundle('mock-session', 2, new Date().toISOString(), [], {reason:{kind:'completed'}});
assert.equal(completed.result.status, 'succeeded');
assert.equal(completed.acceptance, null);
assert.equal(completed.contractEnvelope.goal, '');
assert.deepEqual(completed.contractEnvelope.successCriteria, []);
// A command name alone is classified as validation; this is a known limitation.
assert.equal(classify('pwsh', {command:'echo test'}).type, 'validation_completed');
console.log(JSON.stringify({ok:true, assertions:7, evidenceLevel:'Mock', realSession:false}));
''', encoding='utf-8')
    run('trace_plugin_import_and_mock_events', ['node', 'probe.mjs'], 0)
    result = {'ok': all(c['ok'] for c in checks), 'sourceHashes': hashes, 'checks': checks,
              'realDshSession': False, 'modelCalls': 0, 'automaticConversionImplemented': False}
    (out / 'verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'ok': result['ok'], 'checks': len(checks), 'output': str(out)}))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
