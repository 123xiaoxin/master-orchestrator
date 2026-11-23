"""Synthetic offline boundary tests, not generated conversations or behavior evidence."""
import copy
import importlib.util
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


checks = load('interaction_checks_under_test', ROOT / 'evals/interaction_checks.py')
fixtures = load('interaction_fixtures', ROOT / 'tests/fixtures.py')


def encode(value, **kwargs):
    return json.dumps(value, ensure_ascii=False, **kwargs).encode('utf-8')


class InteractionChecks(unittest.TestCase):
    def setUp(self):
        self.inp, self.state = fixtures.base()
        guard = patch.object(socket.socket, 'connect', side_effect=AssertionError('network forbidden'))
        guard.start()
        self.addCleanup(guard.stop)

    def run_check(self, candidates=None, **kwargs):
        return checks.check_attempts(self.inp, candidates or [encode(self.state)], **kwargs)

    def codes(self, report):
        return {error['code'] for attempt in report['attempts'] for error in attempt['errors']}

    def test_complete_request_needs_zero_questions(self):
        result = self.run_check()
        self.assertTrue(result['ok'])
        self.assertEqual(result['attempts'][0]['questionCount'], 0)
        self.assertEqual(result['attempts'][0]['nextStep'], 'ready_for_planning')
        self.assertFalse(result['semanticMinimalityVerified'])
        self.assertFalse(result['executionAuthorized'])
        self.assertEqual(result['behaviorStatus'], 'BEHAVIOR_NOT_VERIFIED')

    def test_one_current_gap_has_one_question(self):
        fixtures.gap(self.state)
        result = self.run_check()
        self.assertTrue(result['ok'])
        self.assertEqual(result['attempts'][0]['questionCount'], 1)
        self.assertEqual(result['attempts'][0]['nextStep'], 'clarify')

    def test_independent_gaps_allow_parallel_or_combined_questions(self):
        fixtures.gap(self.state, gap_id='D1', description='交付对象是谁？')
        fixtures.gap(self.state, gap_id='D2', description='交付截止时间是什么？')
        self.assertEqual(self.run_check()['attempts'][0]['questionCount'], 2)
        self.state['requests'][0]['gapRefs'].append('D2')
        self.state['requests'][0]['text'] = '请说明交付对象和截止时间。'
        self.state['requests'].pop()
        result = self.run_check()
        self.assertTrue(result['ok'])
        self.assertEqual(result['attempts'][0]['questionCount'], 1)

    def test_missing_critical_request_is_not_rewarded_for_less_questions(self):
        fixtures.gap(self.state)
        self.state['requests'] = []
        result = self.run_check(max_repairs=0)
        self.assertFalse(result['ok'])
        self.assertIn('missing_request', self.codes(result))

    def test_duplicate_question_with_different_id_or_whitespace_fails(self):
        fixtures.gap(self.state)
        duplicate = copy.deepcopy(self.state['requests'][0])
        duplicate.update(id='different-id', text='  '+duplicate['text']+'\n')
        self.state['requests'].append(duplicate)
        result = self.run_check(max_repairs=0)
        self.assertIn('duplicate_request', self.codes(result))
        self.assertFalse(result['ok'])

    def test_overlapping_questions_need_review_not_automatic_semantic_verdict(self):
        fixtures.gap(self.state)
        second = copy.deepcopy(self.state['requests'][0])
        second.update(id='Q2', text='这个边界影响哪一步交接？')
        self.state['requests'].append(second)
        result = self.run_check()
        self.assertTrue(result['ok'])
        self.assertEqual(len(result['attempts'][0]['reviewFlags']), 2)
        self.assertFalse(result['semanticMinimalityVerified'])

    def test_resolved_future_and_execution_gaps_do_not_justify_questions(self):
        fixtures.gap(self.state)
        for field, value in [('status', 'resolved'), ('affects', 'future'), ('affects', 'execution')]:
            state = copy.deepcopy(self.state)
            state['gaps'][0][field] = value
            result = self.run_check([encode(state)], max_repairs=0)
            self.assertIn('irrelevant_question', self.codes(result))

    def test_pause_keeps_gaps_but_does_not_ask(self):
        fixtures.gap(self.state)
        self.inp['sources'].append(fixtures.source('Upause', '先暂停'))
        self.inp['control'] = {'pauseReason': 'user', 'sourceRefs': ['Upause']}
        self.state['proposedNext'] = 'paused'
        self.assertIn('requests_while_paused', self.codes(self.run_check(max_repairs=0)))
        self.state['requests'] = []
        self.assertTrue(self.run_check()['ok'])
        self.assertEqual(self.state['gaps'][0]['status'], 'open')

    def test_zero_repair_allowance_stops_initial_invalid_candidate(self):
        result = self.run_check([b'not json'], max_repairs=0)
        self.assertEqual(result['status'], 'REPAIR_LIMIT')
        self.assertEqual(result['metrics']['repairAttempts'], 0)
        self.assertIsNone(result['acceptedAttemptIndex'])

    def test_success_at_exact_repair_limit_is_accepted(self):
        raw = encode(self.state)
        result = self.run_check([b'bad', b'{}', raw])
        self.assertTrue(result['ok'])
        self.assertEqual(result['acceptedAttemptIndex'], 2)
        self.assertEqual(result['metrics']['repairAttempts'], 2)

    def test_changing_errors_and_state_ids_does_not_reset_repair_count(self):
        wrong = copy.deepcopy(self.state)
        wrong['stateId'] = 'another'
        wrong['items'][0]['provenance']['sourceRefs'] = ['missing']
        result = self.run_check([b'bad', b'{}', encode(wrong)])
        self.assertEqual(result['status'], 'REPAIR_LIMIT')
        self.assertEqual(result['metrics']['repairAttempts'], 2)
        self.assertEqual(result['attempts'][-1]['valid'], False)

    def test_success_only_after_limit_is_not_accepted(self):
        raw = encode(self.state)
        result = self.run_check([b'bad', b'{}', b'null', raw])
        self.assertEqual(result['status'], 'TRACE_VIOLATION')
        self.assertIsNone(result['acceptedAttemptIndex'])
        self.assertEqual(result['metrics']['rawOutputBytesTotal'], 3+2+4+len(raw))

    def test_output_after_success_is_not_disguised_as_a_repair(self):
        result = self.run_check([encode(self.state), encode(self.state)])
        self.assertEqual(result['status'], 'TRACE_VIOLATION')
        self.assertIsNone(result['acceptedAttemptIndex'])

    def test_malformed_duplicate_nonfinite_and_invalid_utf8_consume_attempts(self):
        for bad in [b'', b'\xff', b'{"a":1,"a":2}', b'{"a":NaN}', b'```json\n{}\n```']:
            result = self.run_check([bad, encode(self.state)])
            self.assertTrue(result['ok'])
            self.assertIn('candidate_json', self.codes(result))
            self.assertEqual(result['metrics']['repairAttempts'], 1)

    def test_byte_limit_accepts_exact_size_and_rejects_one_more(self):
        raw = encode(self.state)
        self.assertTrue(self.run_check([raw], max_output_bytes=len(raw))['ok'])
        result = self.run_check([raw+b' '], max_output_bytes=len(raw))
        self.assertEqual(result['status'], 'OUTPUT_LIMIT')
        self.assertEqual(result['metrics']['rawOutputBytesTotal'], len(raw)+1)

    def test_output_limit_stops_instead_of_truncating_or_retrying(self):
        result = self.run_check([b' '*20, b'{}'], max_output_bytes=10)
        self.assertEqual(result['status'], 'TRACE_VIOLATION')
        self.assertIn('output_byte_limit', self.codes(result))
        self.assertEqual(result['metrics']['rawOutputBytesTotal'], 22)

    def test_chinese_emoji_and_crlf_count_original_bytes(self):
        self.state['items'][0]['text'] += ' 中文🙂'
        raw = encode(self.state, indent=2).replace(b'\n', b'\r\n') + b'\r\n'
        result = self.run_check([raw])
        self.assertTrue(result['ok'])
        self.assertGreater(len(raw), len(raw.decode('utf-8')))
        self.assertEqual(result['attempts'][0]['rawOutputBytes'], len(raw))
        self.assertEqual(result['attempts'][0]['renderedSummaryUtf8Bytes'],
                         len(checks.clarify.process(self.inp, self.state)['summary'].encode('utf-8')))

    def test_json_escaping_changes_raw_bytes_but_not_canonical_state_metric(self):
        raw = encode(self.state)
        escaped = json.dumps(self.state, ensure_ascii=True).encode('utf-8')
        first, second = self.run_check([raw]), self.run_check([escaped])
        self.assertNotEqual(len(raw), len(escaped))
        self.assertNotEqual(first['attempts'][0]['sha256'], second['attempts'][0]['sha256'])
        self.assertEqual(first['attempts'][0]['canonicalStateUtf8Bytes'], second['attempts'][0]['canonicalStateUtf8Bytes'])

    def test_invalid_output_counts_toward_total(self):
        failed = '错误输出\r\n'.encode('utf-8')
        good = encode(self.state)
        result = self.run_check([failed, good])
        self.assertEqual(result['metrics']['rawOutputBytesTotal'], len(failed)+len(good))

    def test_input_and_previous_are_not_rewritten_or_faked_as_paused(self):
        previous = checks.clarify.process(self.inp, self.state)
        inp, state = fixtures.revision(self.inp, self.state)
        fixtures.change(state, 'SC1', '交付改为手机端，业务目标不变')
        frozen = copy.deepcopy((inp, previous))
        result = checks.check_attempts(inp, [b'bad'], previous, max_repairs=0)
        self.assertEqual(result['status'], 'REPAIR_LIMIT')
        self.assertNotIn('state', result)
        self.assertEqual((inp, previous), frozen)
        self.assertTrue(checks.check_attempts(inp, [encode(state)], previous)['ok'])
        previous['digest'] = 'corrupt'
        result = checks.check_attempts(inp, [encode(state)], previous, max_repairs=0)
        self.assertIn('previous_invalid', self.codes(result))

    def test_invalid_limits_and_mutable_bytes_fail(self):
        for kwargs in [{'max_repairs': True}, {'max_repairs': -1}, {'max_output_bytes': 0}, {'max_output_bytes': False}]:
            with self.assertRaises(ValueError):
                self.run_check(**kwargs)
        with self.assertRaises(ValueError):
            self.run_check([bytearray(b'{}')])
        with self.assertRaises(ValueError):
            checks.check_attempts(self.inp, [])

    def test_escaped_unpaired_surrogate_is_an_invalid_attempt_not_a_crash(self):
        state = copy.deepcopy(self.state)
        state['items'][0]['text'] = '\ud800'
        raw = json.dumps(state, ensure_ascii=True).encode('utf-8')
        result = self.run_check([raw, encode(self.state)])
        self.assertTrue(result['ok'])
        self.assertIn('candidate_unicode', self.codes(result))
        self.assertEqual(result['metrics']['rawOutputBytesTotal'], len(raw)+len(encode(self.state)))

    def test_input_hash_seals_resolved_local_source_without_mutating_input(self):
        scratch = ROOT / '.test-tmp'
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='source-', dir=scratch) as directory:
            file = Path(directory)/'material.txt'
            file.write_text('first material', encoding='utf-8')
            self.inp['sources'].append(fixtures.source('M1', None, 'material', locator='file:material.txt'))
            first = self.run_check(input_dir=directory)
            self.assertIsNone(self.inp['sources'][-1]['content'])
            file.write_text('second material', encoding='utf-8')
            second = self.run_check(input_dir=directory)
            self.assertNotEqual(first['inputSha256'], second['inputSha256'])

    def test_cli_reads_actual_files_and_keeps_inputs_unchanged(self):
        scratch = ROOT / '.test-tmp'
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='interaction-', dir=scratch) as directory:
            folder = Path(directory)
            inp, candidate = folder/'input.json', folder/'candidate.json'
            inp.write_bytes(encode(self.inp))
            raw = encode(self.state, indent=2).replace(b'\n', b'\r\n')
            candidate.write_bytes(raw)
            command = [sys.executable, '-B', '-X', 'utf8', str(ROOT/'evals/interaction_checks.py'),
                       '--input', str(inp), '--candidate', str(candidate)]
            run = subprocess.run(command, capture_output=True, encoding='utf-8', timeout=30)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(json.loads(run.stdout)['metrics']['rawOutputBytesTotal'], len(raw))
            self.assertEqual(candidate.read_bytes(), raw)
            capped = subprocess.run(command+['--max-output-bytes', '1'], capture_output=True, encoding='utf-8', timeout=30)
            self.assertEqual(capped.returncode, 2)
            self.assertEqual(json.loads(capped.stdout)['status'], 'OUTPUT_LIMIT')


if __name__ == '__main__':
    unittest.main()
