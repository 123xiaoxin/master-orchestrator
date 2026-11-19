"""Validate supplied clarification state; never generate model answers or execute work."""
import argparse
import copy
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


class Invalid(ValueError):
    def __init__(self, errors):
        self.errors = errors
        super().__init__('Clarification contract invalid')


def read_json(path):
    def unique(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise ValueError('Duplicate JSON key: ' + key)
            out[key] = value
        return out
    return json.loads(pathlib.Path(path).read_text(encoding='utf-8-sig'),
                      object_pairs_hook=unique,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Invalid JSON number: ' + value)))


def seal(result):
    data = {k: v for k, v in result.items() if k != 'digest'}
    return hashlib.sha256(json.dumps(data, ensure_ascii=False, sort_keys=True,
                                    separators=(',', ':'), allow_nan=False).encode('utf-8')).hexdigest()


def snapshot_sources(input, input_dir=None):
    """Freeze locally resolved text in the canonical result, never just its locator."""
    value = copy.deepcopy(input)
    if not isinstance(value, dict) or not isinstance(value.get('sources'), list):
        return value
    base = pathlib.Path(input_dir or '.').resolve()
    for source in value['sources']:
        if not isinstance(source, dict):
            continue
        locator = source.get('locator')
        if (source.get('availability') == 'provided' and source.get('content') is None
                and isinstance(locator, str) and locator.startswith('file:')):
            relative = pathlib.Path(locator[5:])
            target = (base / relative).resolve()
            if not relative.is_absolute() and target.is_relative_to(base) and target.is_file():
                try:
                    source['content'] = target.read_text(encoding='utf-8-sig')
                except (OSError, UnicodeError):
                    pass  # validate reports the precise unavailable-source error.
    return value


def derive(input, state):
    if input['control']['pauseReason'] is not None:
        return 'paused'
    pending = [g for g in state['gaps'] if g['status'] == 'open' and g['affects'] == 'current']
    for resolution, decision in [('user', 'clarify'), ('evidence', 'await_evidence'),
                                 ('example', 'prototype_to_clarify')]:
        if any(g['resolution'] == resolution for g in pending):
            return decision
    core = {i['kind'] for i in state['items'] if i['status'] == 'active'}
    return 'ready_for_planning' if {'goal', 'scope', 'criterion'} <= core else 'clarify'


def validate(input, state, previous=None, input_dir=None, _history=True, _frozen=False):
    from jsonschema import Draft202012Validator
    errors = []
    input = snapshot_sources(input, input_dir)

    def issue(code, path, message):
        errors.append({'code': code, 'path': path, 'message': message})

    for name, value in [('input', input), ('state', state)]:
        schema = read_json(ROOT / 'contracts' / ('clarify_' + name + '.v1.schema.json'))
        for error in Draft202012Validator(schema).iter_errors(value):
            issue('schema', name + '/' + '/'.join(map(str, error.absolute_path)), error.message)
    if errors:
        return errors
    historical_sources = {}
    if isinstance(previous, dict) and isinstance(previous.get('input'), dict):
        prior_sources = previous['input'].get('sources', [])
        if isinstance(prior_sources, list):
            historical_sources = {s['id']: s for s in prior_sources if isinstance(s, dict) and 'id' in s}
    source_map = {}
    for n, source in enumerate(input['sources']):
        sid = source['id']
        if sid in source_map:
            issue('duplicate_id', 'input/sources', sid)
        source_map[sid] = source
        if (source['projectId'], source['taskId']) != (input['projectId'], input['taskId']):
            issue('cross_project', 'input/sources/' + str(n), 'Source belongs to another project/task')
        if source['availability'] == 'provided' and source['content'] is None and source['locator'] is None:
            issue('source_content', sid, 'Provided source needs content or a resolvable file locator')
        if source['availability'] == 'unavailable' and source['content'] is not None:
            issue('source_content', sid, 'Unavailable source cannot claim provided content')
        locator = source['locator'] or ''
        if locator.startswith('file:'):
            if _frozen and source['content'] is None:
                issue('previous_invalid', sid, 'Historical local source lacks an immutable text snapshot')
                continue
            # Prior artifacts carry immutable text. A current-source inspection must
            # get a new ID; replay never substitutes today's file for old evidence.
            if (_frozen or historical_sources.get(sid) == source) and source['content'] is not None:
                continue
            base = pathlib.Path(input_dir or '.').resolve()
            relative = pathlib.Path(locator[5:])
            target = (base / relative).resolve()
            if relative.is_absolute() or not target.is_relative_to(base):
                issue('source_path', sid, 'Local reference must stay within input directory')
            elif not target.is_file():
                issue('source_missing', sid, 'Local reference does not exist')
            else:
                try:
                    actual = target.read_text(encoding='utf-8-sig')
                    if source['availability'] != 'provided':
                        issue('source_availability', sid, 'Readable local source must be provided')
                    if source['content'] is not None and source['content'] != actual:
                        issue('source_mismatch', sid, 'Source content differs from local file')
                    # Resolve for validation only; do not mutate the canonical input.
                    source_map[sid] = dict(source, content=actual)
                except (OSError, UnicodeError) as exc:
                    issue('source_unreadable', sid, str(exc))
        elif source['availability'] == 'provided' and source['content'] is None:
            issue('source_unverified', sid, 'External locator alone is not inspected evidence')

    def refs(values, path, kinds=None, accessible=False):
        found = []
        for sid in values:
            source = source_map.get(sid)
            if source is None:
                issue('evidence_ref', path, 'Unknown source: ' + sid)
            else:
                found.append(source)
                if kinds and source['kind'] not in kinds:
                    issue('provenance', path, 'Incompatible source kind: ' + sid)
                if accessible and (source['availability'] != 'provided' or source['content'] is None):
                    issue('evidence_unavailable', path, 'Evidence not inspected: ' + sid)
        return found

    refs(input['request']['sourceRefs'], 'input/request', {'user_message'}, True)
    pause = input['control']['pauseReason']
    if pause is not None:
        if not input['control']['sourceRefs']:
            issue('pause_evidence', 'input/control', 'Pause requires a source')
        kinds = {'user_message'} if pause == 'user' else ({'host_control'} if pause == 'resource_limit' else {'host_control', 'model', 'user_message'})
        refs(input['control']['sourceRefs'], 'input/control', kinds, True)
    else:
        refs(input['control']['sourceRefs'], 'input/control')
    if (state['projectId'], state['taskId']) != (input['projectId'], input['taskId']):
        issue('cross_project', 'state', 'State project/task differs from input')
    if state['previousStateId'] != input['previousStateId']:
        issue('previous_ref', 'state/previousStateId', 'Input/state previous references differ')

    seen = set()
    for collection in ('items', 'gaps', 'requests', 'handoffs'):
        for entry in state[collection]:
            if entry['id'] in seen:
                issue('duplicate_id', 'state/' + collection, entry['id'])
            seen.add(entry['id'])
    items = {i['id']: i for i in state['items']}
    gaps = {g['id']: g for g in state['gaps']}
    provenance = {
        'user_stated': ({'user_message'}, 'explicit'),
        'user_accepted': ({'user_message'}, 'accepted'),
        'material_fact': ({'material'}, 'not_applicable'),
        'inspection_result': ({'inspection'}, 'not_applicable'),
        'model_inference': (None, 'unconfirmed'),
        'default_assumption': (None, 'unconfirmed')}
    for item in state['items']:
        path = 'state/items/' + item['id']
        for field, kind in [('verification', 'criterion'), ('riskIfWrong', 'assumption'),
                            ('affects', 'assumption'), ('conditionStatus', 'execution_condition')]:
            if field in item and item['kind'] != kind:
                issue('kind_field', path, field + ' only applies to ' + kind)
        p = item['provenance']
        kinds, confirmation = provenance[p['kind']]
        sources = refs(p['sourceRefs'], path, kinds, kinds is not None)
        if item['confirmation'] != confirmation:
            issue('forged_confirmation', path, 'Confirmation does not match provenance')
        if 'quote' in p and not any(s['availability'] == 'provided' and p['quote'] in (s['content'] or '') for s in sources):
            issue('quote_mismatch', path, 'Quote is absent from referenced accessible sources')
        if item['kind'] == 'execution_condition' and item['conditionStatus'] == 'available' and p['kind'] != 'inspection_result':
            issue('unchecked_capability', path, 'Available capability requires inspection evidence')
        for dep in item.get('dependsOn', []):
            if dep not in items:
                issue('item_ref', path, 'Unknown dependency: ' + dep)
            elif item['status'] == 'active' and items[dep]['status'] == 'retired' and not any(g['status'] == 'open' and item['id'] in g['itemRefs'] for g in state['gaps']):
                issue('stale_dependency', path, 'Retired dependency requires an open reevaluation gap')
        if item['status'] == 'active' and item['kind'] == 'assumption' and item['riskIfWrong'] == 'high' and item['affects'] == 'current':
            if not any(g['status'] == 'open' and g['affects'] == 'current' and item['id'] in g['itemRefs'] for g in state['gaps']):
                issue('high_risk_assumption', path, 'High-impact current assumption requires an open current gap')
    # Cyclic dependencies cannot be handed to downstream planning as an ordered basis.
    visited, active = set(), set()
    def visit(iid):
        if iid in active:
            issue('dependency_cycle', iid, 'Cyclic item dependency'); return
        if iid in visited or iid not in items:
            return
        active.add(iid)
        for dependency in items[iid].get('dependsOn', []):
            visit(dependency)
        active.remove(iid); visited.add(iid)
    for iid in items:
        visit(iid)
    for gap in state['gaps']:
        refs(gap['sourceRefs'], 'state/gaps/' + gap['id'], accessible=gap['status'] == 'resolved')
        if gap['status'] == 'resolved':
            required_kinds = {'material', 'inspection'} if gap['resolution'] == 'evidence' else {'user_message'}
            if not any(source_map.get(sid, {}).get('kind') in required_kinds for sid in gap['sourceRefs']):
                issue('resolution_evidence', gap['id'], 'Resolution needs user choice or material/inspection evidence as applicable')
        for iid in gap['itemRefs']:
            if iid not in items:
                issue('item_ref', gap['id'], 'Unknown item: ' + iid)
        if gap['kind'] == 'conflict' and len(gap['sourceRefs']) < 2:
            issue('conflict_evidence', gap['id'], 'Conflict needs both source references')
    covered = set()
    for request in state['requests']:
        for gid in request['gapRefs']:
            gap = gaps.get(gid)
            if gap is None:
                issue('gap_ref', request['id'], 'Unknown gap: ' + gid); continue
            covered.add(gid)
            if gap['status'] != 'open' or gap['affects'] != 'current':
                issue('irrelevant_question', request['id'], 'Request must address open current gap')
            if gap['resolution'] != request['method']:
                issue('resolution_mismatch', request['id'], 'Request method differs from gap')
        if request['method'] == 'example' and not input['allowExpressiveExamples']:
            issue('example_permission', request['id'], 'Expression sample outside supplied scope')
    if pause is None:
        for gap in state['gaps']:
            if gap['status'] == 'open' and gap['affects'] == 'current' and gap['id'] not in covered:
                issue('missing_request', gap['id'], 'Current gap needs a targeted request')
    kinds = {i['kind'] for i in state['items'] if i['status'] == 'active'}
    for core in ('goal', 'scope', 'criterion'):
        if core not in kinds and not any(g['status'] == 'open' and g['affects'] == 'current' and core in g['blocks'] for g in state['gaps']):
            issue('missing_core_gap', core, 'Missing core information must remain an explicit gap')
    for handoff in state['handoffs']:
        for cid in handoff['criterionRefs']:
            item = items.get(cid)
            if item is None or item['kind'] != 'criterion':
                issue('criterion_ref', handoff['id'], 'Unknown criterion: ' + cid)
            elif item['status'] == 'retired' and handoff['status'] != 'needs_review':
                issue('stale_handoff', handoff['id'], 'Retired criterion requires reevaluation')

    for change in state['changes']:
        refs(change['sourceRefs'], 'state/changes/' + change['itemId'], accessible=True)
    if len({c['itemId'] for c in state['changes']}) != len(state['changes']):
        issue('duplicate_change', 'state/changes', 'One change record per changed item')
    if _history:
        if previous is None:
            if state['revision'] != 1 or state['previousStateId'] is not None or state['changes']:
                issue('previous_missing', 'state', 'Initial revision must be 1 with no previous state or changes')
        else:
            required = {'input', 'state', 'nextStep', 'summary', 'digest', 'valid', 'executionAuthorized', 'evidenceType', 'behaviorStatus'}
            if not isinstance(previous, dict) or not required <= previous.keys():
                issue('previous_invalid', 'previous', 'Expected complete previous result.json')
            else:
                prior_errors = validate(previous['input'], previous['state'], input_dir=input_dir, _history=False, _frozen=True)
                if prior_errors or previous['digest'] != seal(previous):
                    issue('previous_invalid', 'previous', 'Previous artifact fails validation or digest')
                elif (previous['nextStep'] != derive(previous['input'], previous['state']) or
                      previous['summary'] != render(previous['input'], previous['state'], previous['nextStep']) or
                      previous['valid'] is not True or previous['executionAuthorized'] is not False or
                      previous['evidenceType'] != previous['input']['evidenceType'] or
                      previous['behaviorStatus'] != 'BEHAVIOR_NOT_VERIFIED'):
                    issue('previous_inconsistent', 'previous', 'Previous machine result and summary disagree')
                else:
                    old = previous['state']
                    if (old['projectId'], old['taskId']) != (state['projectId'], state['taskId']):
                        issue('cross_project', 'previous', 'Previous state belongs to another project/task')
                    if state['previousStateId'] != old['stateId'] or state['stateId'] == old['stateId'] or state['revision'] != old['revision'] + 1:
                        issue('previous_ref', 'state', 'Revision must extend exact previous state with a new ID')
                    new_sources = {s['id']: s for s in input['sources']}
                    for source in previous['input']['sources']:
                        if new_sources.get(source['id']) != source:
                            issue('source_history', source['id'], 'Prior source removed or edited; append a correction instead')
                    old_items = {i['id']: i for i in old['items']}
                    changes = {c['itemId']: c for c in state['changes']}
                    changed = set()
                    old_source_ids = {s['id'] for s in previous['input']['sources']}
                    for iid, before in old_items.items():
                        after = items.get(iid)
                        if after is None:
                            issue('deleted_item', iid, 'Retire old items instead of deleting'); continue
                        if after['kind'] != before['kind']:
                            issue('stable_id', iid, 'Item kind cannot change under stable ID')
                        if before['status'] == 'retired' and after != before:
                            issue('retired_item', iid, 'Retired records are immutable')
                    for iid, after in items.items():
                        before = old_items.get(iid)
                        if before == after:
                            continue
                        changed.add(iid)
                        expected = 'added' if before is None else ('retired' if after['status'] == 'retired' and before['status'] != 'retired' else 'modified')
                        change = changes.get(iid)
                        if change is None or change['action'] != expected:
                            issue('change_record', iid, 'Missing or incorrect action: ' + expected); continue
                        if change['type'] == 'requirement_change':
                            refs(change['sourceRefs'], iid, {'user_message'}, True)
                            if not any(s not in old_source_ids for s in change['sourceRefs']):
                                issue('change_evidence', iid, 'Requirement change needs newly supplied user evidence')
                        if change['type'] == 'execution_issue' and after['kind'] in {'goal', 'scope', 'requirement', 'constraint', 'criterion'}:
                            issue('execution_changed_requirement', iid, 'Execution failure cannot rewrite requirements or acceptance')
                    if set(changes) != changed:
                        issue('change_coverage', 'state/changes', 'Change records must match exactly the changed items')
                    for collection in ('gaps', 'handoffs'):
                        current = {v['id']: v for v in state[collection]}
                        for entry in old[collection]:
                            if entry['id'] not in current:
                                issue('history_deleted', entry['id'], 'Previous ' + collection + ' cannot disappear')
                            elif collection == 'gaps':
                                after = current[entry['id']]
                                if not set(entry['sourceRefs']) <= set(after['sourceRefs']):
                                    issue('conflict_history', entry['id'], 'Preserve previous gap sources')
                                if entry != after and not any(s not in old_source_ids for s in after['sourceRefs']):
                                    issue('change_evidence', entry['id'], 'Gap update requires new evidence')
                                if entry['status'] == 'open' and after['status'] == 'resolved':
                                    required_kinds = {'material', 'inspection'} if entry['resolution'] == 'evidence' else {'user_message'}
                                    if not any(s not in old_source_ids and source_map.get(s, {}).get('kind') in required_kinds for s in after['sourceRefs']):
                                        issue('resolution_evidence', entry['id'], 'Closing a gap requires newly supplied evidence of the original resolution kind')
                            elif entry != current[entry['id']] and current[entry['id']]['status'] != 'needs_review':
                                issue('stale_handoff', entry['id'], 'Changed handoff references require reevaluation')
                    old_handoffs = {h['id']: h for h in old['handoffs']}
                    for handoff in state['handoffs']:
                        prior_refs = old_handoffs.get(handoff['id'], {}).get('criterionRefs', [])
                        if changed.intersection(set(handoff['criterionRefs']) | set(prior_refs)) and handoff['status'] != 'needs_review':
                            issue('stale_handoff', handoff['id'], 'Changed criterion requires handoff reevaluation')
    computed = derive(input, state)
    if state['proposedNext'] != computed:
        issue('decision_mismatch', 'state/proposedNext', 'proposed=' + state['proposedNext'] + '; computed=' + computed)
    return errors


def render(input, state, decision):
    lines = ['# 澄清摘要', '', '下一步：' + decision,
             '项目 / 任务：' + state['projectId'] + ' / ' + state['taskId'],
             '状态版本：' + state['stateId'] + '（' + str(state['revision']) + '）',
             '证据类型：' + input['evidenceType'],
             '执行授权：未由此模块授予。', '行为评测：BEHAVIOR_NOT_VERIFIED', '', '## 当前理解', '']
    for item in state['items']:
        if item['status'] == 'active':
            lines.append('- [' + item['id'] + '] ' + item['kind'] + '：' + item['text'] +
                         '（' + item['confirmation'] + '；' + item['provenance']['kind'] +
                         '；来源 ' + ', '.join(item['provenance']['sourceRefs']) + '）')
            if 'verification' in item:
                v = item['verification']
                lines.append('  验证：' + v['method'] + '；证据：' + v['evidenceType'] + '；判断主体：' + v['assessor'])
            if 'riskIfWrong' in item:
                lines.append('  假设出错代价：' + item['riskIfWrong'] + '；影响：' + item['affects'])
            if 'conditionStatus' in item:
                lines.append('  执行条件：' + item['conditionStatus'])
    lines.extend(['', '## 未决事项与下一步', ''])
    unresolved = [g for g in state['gaps'] if g['status'] == 'open']
    for gap in unresolved:
        lines.append('- [' + gap['id'] + '] ' + gap['description'] + '（影响：' + gap['affects'] + '；解决方式：' + gap['resolution'] + '；来源：' + ', '.join(gap['sourceRefs']) + '）')
    if not unresolved:
        lines.append('无已登记的未决缺口；这不证明未遗漏语义问题。')
    if input['control']['pauseReason']:
        lines.append('暂停原因：' + input['control']['pauseReason'] + '；保留以上未完成事项。')
    else:
        for request in state['requests']:
            lines.append('- [' + request['id'] + ' → ' + ', '.join(request['gapRefs']) + '] ' + request['text'])
            if 'sample' in request:
                lines.append('  表达性样例：' + request['sample'])
    lines.extend(['', '## 修订与交接', ''])
    for change in state['changes']:
        lines.append('- ' + change['itemId'] + '：' + change['action'] + ' / ' + change['type'] + '；来源：' + ', '.join(change['sourceRefs']))
    for item in state['items']:
        if item['status'] == 'retired':
            lines.append('- 已失效 [' + item['id'] + '] ' + item['text'])
    for handoff in state['handoffs']:
        lines.append('- ' + handoff['id'] + '：' + handoff['status'] + '；标准：' + ', '.join(handoff['criterionRefs']))
    return '\n'.join(lines) + '\n'


def process(input, state, previous=None, input_dir=None):
    input = snapshot_sources(input, input_dir)
    errors = validate(input, state, previous, input_dir)
    if errors:
        raise Invalid(errors)
    decision = derive(input, state)
    result = {'valid': True, 'input': input, 'state': state, 'nextStep': decision,
              'summary': render(input, state, decision), 'executionAuthorized': False,
              'evidenceType': input['evidenceType'], 'behaviorStatus': 'BEHAVIOR_NOT_VERIFIED',
              'parentDigest': previous['digest'] if previous else None}
    result['digest'] = seal(result)
    return result


def main(argv=None):
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    run = sub.add_parser('run')
    for flag in ('input', 'candidate', 'output'):
        run.add_argument('--' + flag, required=True)
    run.add_argument('--previous')
    args = parser.parse_args(argv)
    try:
        inp = pathlib.Path(args.input)
        result = process(read_json(inp), read_json(args.candidate),
                         read_json(args.previous) if args.previous else None, inp.resolve().parent)
        output = pathlib.Path(args.output)
        output.mkdir(parents=True, exist_ok=False)
        (output / 'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        (output / 'summary.md').write_text(result['summary'], encoding='utf-8')
        report = {k: result[k] for k in ('valid', 'nextStep', 'evidenceType', 'behaviorStatus', 'executionAuthorized', 'digest')}
        report['limitations'] = ['Structural consistency only; semantic fidelity and provenance authenticity require independent review.']
        (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False))
        return 0
    except Invalid as exc:
        print(json.dumps({'valid': False, 'errors': exc.errors, 'nextStep': None}, ensure_ascii=False))
        return 2
    except (OSError, ValueError, UnicodeError, ImportError) as exc:
        print(json.dumps({'valid': False, 'runtimeError': str(exc), 'nextStep': None}, ensure_ascii=False))
        return 3


if __name__ == '__main__':
    sys.exit(main())
