"""Audit captured candidate bytes offline; never call a model or repair a state."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('clarify_interaction_validator', ROOT / 'tools/clarify.py')
clarify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(clarify)
DEFAULT_MAX_REPAIRS = 2
DEFAULT_MAX_OUTPUT_BYTES = 65536


def decode_candidate(raw):
    def unique(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError('duplicate JSON key')
            value[key] = item
        return value

    def nonfinite(_):
        raise ValueError('nonfinite JSON number')

    # No stripping wrappers, BOM, whitespace or reserialization before byte accounting.
    return json.loads(raw.decode('utf-8'), object_pairs_hook=unique, parse_constant=nonfinite)


def request_checks(inp, state):
    """Only after contract validation; semantic necessity is not mechanically known."""
    errors, reviews = [], []
    seen = set()
    counts = Counter(gid for r in state['requests'] for gid in r['gapRefs'])
    for request in state['requests']:
        signature = (request['method'], tuple(sorted(request['gapRefs'])),
                     ' '.join(request['text'].split()), ' '.join(request.get('sample', '').split()))
        if signature in seen:
            errors.append({'code': 'duplicate_request', 'path': request['id']})
        seen.add(signature)
        if any(counts[gid] > 1 for gid in request['gapRefs']):
            reviews.append({'code': 'overlapping_gap_requests', 'path': request['id']})
    if inp['control']['pauseReason'] is not None and state['requests']:
        errors.append({'code': 'requests_while_paused', 'path': 'state/requests'})
    return errors, reviews


def check_attempts(inp, candidates, previous=None, input_dir=None,
                   max_repairs=DEFAULT_MAX_REPAIRS, max_output_bytes=DEFAULT_MAX_OUTPUT_BYTES):
    """One fixed input/previous pair, in capture order; no automatic retry/reset.

    A valid candidate followed by more output, or output after either cap, is a
    trace violation. All supplied bytes count, including output we cannot accept.
    The caller must separately retain raw files and establish their provenance.
    """
    if type(max_repairs) is not int or not 0 <= max_repairs <= DEFAULT_MAX_REPAIRS:
        raise ValueError('max_repairs must be an integer from 0 to 2')
    if type(max_output_bytes) is not int or not 1 <= max_output_bytes <= DEFAULT_MAX_OUTPUT_BYTES:
        raise ValueError('max_output_bytes must be an integer from 1 to 65536')
    if not isinstance(candidates, (list, tuple)) or not candidates or any(type(b) is not bytes for b in candidates):
        raise ValueError('provide one or more captured immutable byte strings')

    inp = clarify.snapshot_sources(inp, input_dir)
    input_sha = clarify.seal({'input': inp})

    attempts, violations = [], []
    terminal = False
    status = 'NEEDS_REPAIR'
    accepted = None
    accepted_result = None
    for index, raw in enumerate(candidates):
        row = {'index': index, 'kind': 'initial' if index == 0 else 'repair',
               'rawOutputBytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
               'valid': False, 'errors': [], 'reviewFlags': []}
        attempts.append(row)
        if terminal or index > max_repairs:
            row['errors'].append({'code': 'attempt_after_stop', 'path': str(index)})
            violations.append({'code': 'attempt_after_stop', 'path': str(index)})
            continue
        if len(raw) > max_output_bytes:
            row['errors'].append({'code': 'output_byte_limit', 'path': str(index)})
            status, terminal = 'OUTPUT_LIMIT', True
            continue
        try:
            state = decode_candidate(raw)
        except (ValueError, UnicodeError, RecursionError):
            row['errors'].append({'code': 'candidate_json', 'path': str(index)})
        else:
            # Recompute validity instead of trusting a trace's self-reported flag.
            try:
                result = clarify.process(inp, state, previous, input_dir)
            except clarify.Invalid as exc:
                row['errors'] = [{'code': e['code'], 'path': e['path']} for e in exc.errors]
            except UnicodeError:
                row['errors'].append({'code': 'candidate_unicode', 'path': str(index)})
            except RecursionError:
                row['errors'].append({'code': 'candidate_depth', 'path': str(index)})
            else:
                row['errors'], row['reviewFlags'] = request_checks(inp, state)
                if not row['errors']:
                    row['valid'] = True
                    row['nextStep'] = result['nextStep']
                    row['questionCount'] = sum(r['method'] == 'user' for r in state['requests'])
                    row['requestCount'] = len(state['requests'])
                    row['canonicalStateUtf8Bytes'] = len(json.dumps(state, ensure_ascii=False,
                                                                  sort_keys=True, separators=(',', ':')).encode('utf-8'))
                    # Logical render metric, explicitly not an on-disk CRLF file size.
                    row['renderedSummaryUtf8Bytes'] = len(result['summary'].encode('utf-8'))
                    accepted, status, terminal = index, 'ACCEPTED_OFFLINE', True
                    accepted_result = result
        if not terminal and index == max_repairs:
            status, terminal = 'REPAIR_LIMIT', True

    if violations:
        status = 'TRACE_VIOLATION'
        accepted = None
        accepted_result = None
    # Advice for an offline host protocol, never authority to invoke a model/tool.
    directive = {'action': 'repair_candidate' if status == 'NEEDS_REPAIR' else 'stop',
                 'candidateIndex': None, 'resultDigest': None, 'requestIds': []}
    if accepted_result is not None:
        directive.update(candidateIndex=accepted, resultDigest=accepted_result['digest'])
        if attempts[accepted]['reviewFlags']:
            directive['action'] = 'review_required'
        else:
            next_step = accepted_result['nextStep']
            action, method = {
                'clarify': ('ask_user', 'user'),
                'await_evidence': ('request_evidence', 'evidence'),
                'prototype_to_clarify': ('present_example', 'example'),
                'ready_for_planning': ('handoff_to_planning', None),
                'paused': ('preserve_paused', None),
            }[next_step]
            directive['action'] = action
            directive['requestIds'] = [r['id'] for r in accepted_result['state']['requests']
                                       if method is not None and r['method'] == method]
            if method is not None and not directive['requestIds']:
                directive['action'] = 'review_required'
    return {'recordType': 'clarify_interaction_check.v1', 'status': status,
            'ok': status == 'ACCEPTED_OFFLINE', 'acceptedAttemptIndex': accepted,
            'hostDirective': directive,
            'limits': {'maxRepairs': max_repairs, 'maxOutputBytesPerAttempt': max_output_bytes},
            'inputSha256': input_sha,
            'previousDigest': previous.get('digest') if isinstance(previous, dict) else None,
            'attempts': attempts, 'traceViolations': violations,
            'metrics': {'candidateCount': len(candidates), 'repairAttempts': len(candidates) - 1,
                        'rawOutputBytesTotal': sum(len(raw) for raw in candidates)},
            'previousArtifactSupplied': previous is not None, 'previousArtifactModified': False,
            'semanticMinimalityVerified': False, 'sourceAuthenticityVerified': False,
            'modelCalls': 0, 'executionAuthorized': False,
            'behaviorStatus': 'BEHAVIOR_NOT_VERIFIED', 'p6Admission': False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--candidate', type=Path, action='append', required=True,
                        help='Captured output, repeated in initial/repair order')
    parser.add_argument('--previous', type=Path)
    parser.add_argument('--max-repairs', type=int, default=DEFAULT_MAX_REPAIRS)
    parser.add_argument('--max-output-bytes', type=int, default=DEFAULT_MAX_OUTPUT_BYTES)
    args = parser.parse_args(argv)
    try:
        report = check_attempts(clarify.read_json(args.input), [p.read_bytes() for p in args.candidate],
                                clarify.read_json(args.previous) if args.previous else None,
                                args.input.resolve().parent, args.max_repairs, args.max_output_bytes)
        print(json.dumps(report, ensure_ascii=False))
        return 0 if report['ok'] else 2
    except (OSError, ValueError, UnicodeError, ImportError, RecursionError) as exc:
        print(json.dumps({'ok': False, 'errorType': type(exc).__name__,
                          'behaviorStatus': 'BEHAVIOR_NOT_VERIFIED', 'executionAuthorized': False}))
        return 3


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main())
