"""Validate frozen eval inputs or prepare packets. Never calls a model/network."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(',', ':')).encode('utf-8')).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def load_and_check(root=HERE):
    cases = [json.loads(line) for line in (root / 'cases.jsonl').read_text(encoding='utf-8').splitlines() if line.strip()]
    frozen = read_json(root / 'freeze.json')
    plan = read_json(root / 'plan.json')
    ids = [case['caseId'] for case in cases]
    if len(ids) != len(set(ids)) or not {f'T{i:02}' for i in range(1, 27)} <= set(ids):
        raise ValueError('cases must contain unique T01 through T26; additional replacement holdouts are allowed')
    all_capabilities = {f'CL-{i:02}' for i in range(1, 13)}
    held = {c['caseId'] for c in cases if c['split'] == 'holdout'}
    if len(held) < 4 or held != set(frozen['holdoutCaseIds']):
        raise ValueError('frozen holdout membership mismatch')
    if not frozen['frozenBeforeBehaviorOutputs'] or frozen['behaviorOutputsObservedAtFreeze'] != 0:
        raise ValueError('freeze must precede observed behavior outcomes')
    if set(frozen['caseSha256']) != set(ids):
        raise ValueError('freeze must cover every case')
    for case in cases:
        cid = case['caseId']
        if canonical_hash(case) != frozen['caseSha256'][cid]:
            raise ValueError(f'{cid}: frozen case changed; issue reviewed new freeze, do not silently rehash')
        for key in ['title', 'domain', 'split', 'projectId', 'taskId', 'capabilityIds',
                    'inputMessages', 'expectedBehaviors', 'forbiddenBehaviors',
                    'successCriteria', 'responseScript', 'reviewBasis', 'severity']:
            if not case.get(key):
                raise ValueError(f'{cid}: missing {key}')
        if case['evidenceType'] != 'synthetic_case_definition':
            raise ValueError(f'{cid}: case definition is not behavior evidence')
        if not set(case['capabilityIds']) <= all_capabilities:
            raise ValueError(f'{cid}: unknown capability')
        sources = case['inputMessages'] + case['providedContext'] + case['visibleMaterials']
        source_ids = [source['id'] for source in sources]
        if len(source_ids) != len(set(source_ids)):
            raise ValueError(f'{cid}: duplicate source id')
        if set(case['reviewBasis']['sourceIds']) != set(source_ids):
            raise ValueError(f'{cid}: review source references mismatch')
        expected_ids = [point['id'] for point in case['expectedBehaviors'] + case['forbiddenBehaviors']]
        if len(expected_ids) != len(set(expected_ids)):
            raise ValueError(f'{cid}: duplicate review item id')
        if case['responseScript']['unexpectedQuestion'] != 'human_response_or_mark_incomplete':
            raise ValueError(f'{cid}: unexpected question must not invoke a synthetic model user')
    selected = plan['selectedCaseIds']
    if len(selected) != len(set(selected)) or len(selected) < 12 or not set(selected) <= set(ids):
        raise ValueError('invalid selected case set')
    selected_cases = [c for c in cases if c['caseId'] in selected]
    if set().union(*(set(c['capabilityIds']) for c in selected_cases)) != all_capabilities:
        raise ValueError('selected cases must cover all twelve capabilities')
    if {c['domain'] for c in selected_cases} != {'software_process', 'content_document', 'device_readonly'}:
        raise ValueError('selected cases must cover three domains')
    if len(held & set(selected)) < 4:
        raise ValueError('selected cases need at least four untouched holdouts')
    repeats = plan['repeatCaseIds']
    if len(repeats) < 3 or len(repeats) != len(set(repeats)) or not set(repeats) <= set(selected):
        raise ValueError('three distinct selected repeats required')
    if plan['arms'] != ['baseline', 'skill'] or plan['baselineLoadsSkill'] or not plan['skillArmLoadsSkill']:
        raise ValueError('paired arms must differ only in Skill loading')
    if plan['minimumIndependentSessions'] != 2 * (len(selected) + len(repeats) * plan['repeatCount']):
        raise ValueError('session arithmetic mismatch')
    if plan['status'] != 'BEHAVIOR_NOT_VERIFIED' or plan['authorization']['approved'] is not False:
        raise ValueError('preparation plan cannot self-authorize or assert verified behavior')
    return cases, plan, frozen


def source_for_contract(source):
    kind = source.get('kind', 'user_message')
    mapped = {'prior_user_message': 'user_message', 'prior_model_suggestion': 'model',
              'prior_model_question': 'model', 'prior_model_sample': 'model',
              'host_resource_notice': 'host_control'}.get(kind, kind)
    if mapped not in {'user_message', 'material', 'inspection', 'model', 'host_control'}:
        mapped = 'material'
    return {'id': source['id'], 'projectId': source['projectId'], 'taskId': source['taskId'],
            'kind': mapped, 'content': source.get('content'), 'locator': None,
            'availability': source.get('availability', 'provided')}


def make_packet(case):
    """No oracle, review rubric, title, capability IDs or scripted answer leakage."""
    sources = case['inputMessages'] + case['providedContext'] + case['visibleMaterials']
    same = [s for s in sources if s['projectId'] == case['projectId'] and s['taskId'] == case['taskId']]
    excluded = [s for s in sources if s not in same]
    controls = [s['id'] for s in same if s.get('kind') == 'host_resource_notice']
    envelope = {'schemaVersion': 'clarify_input.v1', 'projectId': case['projectId'], 'taskId': case['taskId'],
                'request': {'text': '\n'.join(s['content'] for s in case['inputMessages']),
                            'mode': 'clarify', 'sourceRefs': [s['id'] for s in case['inputMessages']]},
                'sources': [source_for_contract(s) for s in same], 'previousStateId': None,
                'control': {'pauseReason': 'resource_limit' if controls else None, 'sourceRefs': controls},
                'allowExpressiveExamples': True, 'evidenceType': 'synthetic'}
    return {'input': envelope, 'excludedBackground': excluded,
            'scenarioSeedContext': [s for s in same if s.get('kind') == 'previous_state_summary']}


def prepare(output, root=HERE):
    cases, plan, frozen = load_and_check(root)
    module = root.parent.resolve()
    output = output.resolve()
    if output == module or module in output.parents:
        raise ValueError('output must be outside the capability package')
    if output.exists():
        raise ValueError('output must be a new directory; never overwrite evidence')
    required = [module / 'SKILL.md', module / 'contracts/contract.md',
                module / 'contracts/clarify_input.v1.schema.json', module / 'contracts/clarify_state.v1.schema.json']
    if any(not p.is_file() for p in required):
        raise ValueError('Skill and declared contracts must exist before preparation')
    # Copy only the instructions/contracts required for loading, never eval oracles.
    snapshot_files = [module / 'SKILL.md'] + sorted((module / 'references').rglob('*.md')) + sorted((module / 'contracts').glob('*'))
    if any(p.is_symlink() or not p.resolve().is_relative_to(module) for p in snapshot_files):
        raise ValueError('snapshot source escapes package')
    prepared = [(case, make_packet(case)) for case in cases if case['caseId'] in plan['selectedCaseIds']]
    output.mkdir(parents=True, exist_ok=False)

    def write(name, data):
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    for case, packet in prepared:
        write(f"inputs/{case['caseId']}.json", packet)
    for source in snapshot_files:
        if source.is_file():
            target = output / 'skill' / source.relative_to(module)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(source.read_bytes())
    write('operator-only/plan.json', plan)
    write('operator-only/run-record.template.json', read_json(root / 'run-record.template.json'))
    write('operator-only/comparison.template.json', read_json(root / 'comparison.template.json'))
    write('operator-only/response-scripts.json', {c['caseId']: c['responseScript'] for c, _ in prepared})
    write('operator-only/manifest.json', {
        'status': 'BEHAVIOR_NOT_VERIFIED', 'modelCalls': 0, 'executable': False,
        'selectedCaseIds': plan['selectedCaseIds'], 'minimumIndependentSessions': plan['minimumIndependentSessions'],
        'caseSha256': {c['caseId']: frozen['caseSha256'][c['caseId']] for c, _ in prepared},
        'skillFilesSha256': {p.relative_to(module).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                            for p in snapshot_files if p.is_file()},
        'instructions': 'Use README protocol. This is preparation, not a host adapter or authorization. '
                        'Never expose operator-only files, oracle expectations or response scripts to the evaluated model.'})
    return {'ok': True, 'preparedCases': len(prepared), 'modelCalls': 0,
            'behaviorStatus': 'BEHAVIOR_NOT_VERIFIED', 'output': str(output)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('check')
    prep = sub.add_parser('prepare')
    prep.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == 'check':
            cases, plan, freeze = load_and_check()
            result = {'ok': True, 'cases': len(cases), 'capabilities': 12,
                      'selectedCases': len(plan['selectedCaseIds']), 'holdouts': freeze['holdoutCaseIds'],
                      'minimumIndependentSessions': plan['minimumIndependentSessions'],
                      'modelCalls': 0, 'behaviorStatus': 'BEHAVIOR_NOT_VERIFIED'}
        else:
            result = prepare(args.output)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (OSError, json.JSONDecodeError, UnicodeError) as error:
        print(json.dumps({'ok': False, 'error': str(error), 'behaviorStatus': 'BEHAVIOR_NOT_VERIFIED'}))
        return 3
    except (ValueError, KeyError, TypeError) as error:
        print(json.dumps({'ok': False, 'error': str(error), 'behaviorStatus': 'BEHAVIOR_NOT_VERIFIED'}))
        return 2


if __name__ == '__main__':
    sys.exit(main())
