"""Check and copy the independent Skill without accessing Master Core."""
import argparse
import hashlib
import json
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
LINK = re.compile(r'(?<!!)\[[^\]\n]+\]\(([^)\n]+)\)')
SKIP = {'__pycache__', '.git', '.local', '.test-tmp'}


def files(root):
    return sorted(p for p in root.rglob('*') if p.is_file() and not set(p.relative_to(root).parts) & SKIP and p.suffix != '.pyc' and p.name != 'package-manifest.json')


def check(root):
    issues = []
    required = ['SKILL.md', 'README.md', 'requirements.txt', 'contracts/contract.md',
                'contracts/clarify_input.v1.schema.json', 'contracts/clarify_state.v1.schema.json',
                'tools/clarify.py', 'references/clarification-method.md', 'evals/cases.jsonl']
    for name in required:
        if not (root / name).is_file():
            issues.append('Missing resource: ' + name)
    for p in root.rglob('*'):
        if p.is_symlink():
            issues.append('Symlink is not portable: ' + str(p.relative_to(root)))
    for p in files(root):
        if p.is_symlink():
            continue
        if p.suffix not in {'.md', '.json', '.jsonl', '.py', '.txt'}:
            continue
        text = p.read_text(encoding='utf-8')
        name = p.relative_to(root).as_posix()
        if text.startswith('\ufeff'):
            issues.append('UTF-8 BOM: ' + name)
        # Credential/private-path heuristics are an audit aid, not a secret detector proof.
        private = r'[A-Z]:[\\/]+Users[\\/]|/' + r'Users/|/' + r'home/[^\s/]+/'
        secret = r'sk-[A-Za-z0-9]{20,}|(?:api_key|password)\s*[=:]\s*[\"\'][A-Za-z0-9]{12,}'
        if re.search('(?i)(?:' + private + '|' + secret + ')', text):
            issues.append('Possible private path/credential: ' + name)
        if p.suffix == '.md':
            for link in LINK.findall(text):
                target = link.strip('<>').split('#', 1)[0]
                if not target or re.match(r'[a-z]+://', target):
                    continue
                local = (p.parent / target).resolve()
                if not local.is_relative_to(root.resolve()) or not local.exists():
                    issues.append('Escaping/missing link: ' + name + ' -> ' + target)
    return issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', help='New directory outside the source package')
    args = parser.parse_args()
    try:
        issues = check(ROOT)
        if issues:
            print(json.dumps({'ok': False, 'issues': issues}, ensure_ascii=False)); return 2
        hashes = {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in files(ROOT)}
        if args.output:
            out = pathlib.Path(args.output).resolve()
            if out.exists() or out.is_relative_to(ROOT):
                raise ValueError('Package destination must be new and outside source package')
            shutil.copytree(ROOT, out, ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '.git', '.local', '.test-tmp', 'package-manifest.json'))
            manifest = {'packageVersion': '0.1.0', 'artifacts': hashes,
                        'behaviorStatus': 'BEHAVIOR_NOT_VERIFIED', 'integrationStatus': 'INTEGRATION_NOT_STARTED'}
            (out / 'package-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
            if check(out):
                raise ValueError('Copied package failed portable checks')
        print(json.dumps({'ok': True, 'files': len(hashes), 'behaviorStatus': 'BEHAVIOR_NOT_VERIFIED'}))
        return 0
    except (OSError, ValueError, UnicodeError) as exc:
        print(json.dumps({'ok': False, 'error': str(exc)})); return 3


if __name__ == '__main__':
    sys.exit(main())
