"""Validate, package, and export Master sources without runtime/model actions."""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = 'skills/master-skill/modules.json'
LINK = re.compile(r'(?<!!)\[[^\]\n]+\]\(([^)\n]+)\)')


def contained(root, name):
    path = (root / name).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError('Path outside source root: ' + name)
    if not path.exists():
        raise ValueError('Missing source: ' + name)
    return path


def load_manifest(root):
    data = json.loads(contained(root, MANIFEST).read_text(encoding='utf-8'))
    if data['manifestVersion'] != 1:
        raise ValueError('Unsupported manifestVersion')
    if data['entrypoint'] != 'skills/master-skill/SKILL.md':
        raise ValueError('Unexpected normative entrypoint')
    mods = data['modules']
    ids = [m['id'] for m in mods]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate module id')
    if len({m['path'] for m in mods}) != len(mods):
        raise ValueError('Duplicate module path')
    if {m['id'] for m in mods if m['required']} != {'01', '05', '07', '08'}:
        raise ValueError('Required governance closure must contain 01/05/07/08')
    expected = {p.relative_to(root).as_posix() for p in (root / 'prompts').glob('*.md')}
    if expected != {m['path'] for m in mods}:
        raise ValueError('Manifest must cover each maintained prompt module')
    by_id = {m['id']: m for m in mods}
    visited, active = set(), set()

    def visit(mid):
        if mid not in by_id:
            raise ValueError('Unknown dependency: ' + mid)
        if mid in active:
            raise ValueError('Module dependency cycle: ' + mid)
        if mid in visited:
            return
        active.add(mid)
        module = by_id[mid]
        contained(root, module['path'])
        if not module['condition'] or not module['revision']:
            raise ValueError('Missing module condition/revision: ' + mid)
        for dep in module['dependsOn']:
            visit(dep)
        active.remove(mid)
        visited.add(mid)

    for mid in ids:
        visit(mid)
    for resource in data['resources']:
        contained(root, resource)
    entry = contained(root, data['entrypoint']).read_text(encoding='utf-8')
    for field, key in [('project_version', 'projectVersion'), ('package_version', 'packageVersion')]:
        if not re.search(r'^  ' + field + ': ' + re.escape(data[key]) + r'$', entry, re.M):
            raise ValueError('Entrypoint version disagrees with manifest: ' + field)
    for module in mods:
        if '../../' + module['path'] not in entry:
            raise ValueError('Entrypoint does not reference module: ' + module['id'])
    for p in (root / 'skills/master-skill').glob('*.md'):
        check_links(root, p)
    return data


def local_link(path, text):
    raw = text.strip('<>')
    if urlsplit(raw).scheme or raw.startswith('#'):
        return None
    return (path.parent / raw.split('#', 1)[0]).resolve()


def check_links(root, path):
    for match in LINK.finditer(path.read_text(encoding='utf-8')):
        target = local_link(path, match.group(1))
        if target is not None and (not target.is_relative_to(root.resolve()) or not target.exists()):
            raise ValueError('Broken or escaping reference: ' + str(path) + ' -> ' + match.group(1))


def select(data, extras):
    by_id = {m['id']: m for m in data['modules']}
    order, seen = [], set()

    def visit(mid):
        if mid not in by_id:
            raise ValueError('Unknown selected module: ' + mid)
        if mid in seen:
            return
        for dep in by_id[mid]['dependsOn']:
            visit(dep)
        seen.add(mid)
        order.append(mid)

    for module in data['modules']:
        if module['required']:
            visit(module['id'])
    for mid in extras:
        visit(mid)
    return [by_id[mid] for mid in order]


def source_files(root, data):
    names = {data['entrypoint'], MANIFEST, 'skills/master-skill/AGENTS.md',
             'skills/master-skill/IDENTITY.md', 'skills/master-skill/README.md'}
    names.update(m['path'] for m in data['modules'])
    for resource in data['resources']:
        path = contained(root, resource)
        names.update(p.relative_to(root).as_posix() for p in path.rglob('*') if p.is_file()) if path.is_dir() else names.add(resource)
    return sorted(names)


def lock(root, data, files, selected):
    def git(*args):
        result = subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True, encoding='utf-8')
        if result.returncode:
            raise ValueError('Git provenance unavailable: ' + result.stderr.strip())
        return result.stdout.strip()
    return {'manifestVersion': data['manifestVersion'], 'projectVersion': data['projectVersion'],
            'packageVersion': data['packageVersion'], 'sourceCommit': git('rev-parse', 'HEAD'),
            'sourceBranch': git('branch', '--show-current'),
            'workingTreeDirty': bool(git('status', '--porcelain')),
            'generator': {'path': 'scripts/master_skill.py',
                          'sha256': hashlib.sha256((root / 'scripts/master_skill.py').read_bytes()).hexdigest()},
            'selectedModules': [m['id'] for m in selected],
            'sources': {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in files}}


def output_dir(root, name):
    out = pathlib.Path(name).resolve()
    # The builder must never write inside maintained source or outside this repo.
    allowed = (root / '.local').resolve()
    if not out.is_relative_to(allowed) or out == allowed or out.exists():
        raise ValueError('Output must be a new directory below this repository .local/')
    out.mkdir(parents=True)
    return out


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def package(root, data, name):
    files = source_files(root, data)
    selected = select(data, [m['id'] for m in data['modules']])
    provenance = lock(root, data, files, selected)
    out = output_dir(root, name)
    paths = {p: pathlib.Path(p).relative_to('skills/master-skill') if p.startswith('skills/master-skill/')
             else pathlib.Path('references') / p for p in files}
    import os
    for name, dest in paths.items():
        source = root / name
        target = out / dest
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.suffix == '.md':
            text = source.read_text(encoding='utf-8')
            def rewrite(match):
                resolved = local_link(source, match.group(1))
                if resolved is None:
                    return match.group(0)
                if not resolved.is_relative_to(root):
                    raise ValueError('Escaping package reference: ' + name)
                relative = resolved.relative_to(root).as_posix()
                if relative not in paths:
                    raise ValueError('Unpackaged reference: ' + name + ' -> ' + relative)
                link = os.path.relpath(out / paths[relative], target.parent).replace('\\', '/')
                if '#' in match.group(1):
                    link += '#' + match.group(1).split('#', 1)[1]
                return match.group(0).replace('(' + match.group(1) + ')', '(' + link + ')')
            target.write_text(LINK.sub(rewrite, text), encoding='utf-8', newline='\n')
        else:
            target.write_bytes(source.read_bytes())
    # Distribution paths differ from repo paths, but module identities do not.
    distributed = json.loads(json.dumps(data))
    distributed['entrypoint'] = 'SKILL.md'
    for module in distributed['modules']:
        module['path'] = paths[module['path']].as_posix()
    distributed['resources'] = ['references/' + resource for resource in data['resources']]
    write_json(out / 'modules.json', distributed)
    for path in out.rglob('*.md'):
        check_links(out, path)
    provenance['artifacts'] = {p.relative_to(out).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                               for p in sorted(out.rglob('*')) if p.is_file()}
    write_json(out / 'source-lock.json', provenance)
    return out


def export(root, data, extras, name):
    selected = select(data, extras)
    files = source_files(root, data)
    provenance = lock(root, data, files, selected)
    out = output_dir(root, name)
    # A dependency-resolved test artifact, not a merged normative source file.
    parts = ['# Master selected source snapshot\n',
             'Selected entrypoint and module texts are supplied inline below. Reading this context\n'
             'does not constitute a file-reader tool call. If another conditional module is needed\n'
             'but unavailable, disclose the loading gap; do not invent its contents or tool calls.\n',
             'Selection: ' + ', '.join(m['id'] for m in selected) + '\n',
             (root / data['entrypoint']).read_text(encoding='utf-8')]
    for module in selected:
        parts += ['\n<!-- SOURCE: ' + module['path'] + '; revision: ' + module['revision'] + ' -->\n',
                  (root / module['path']).read_text(encoding='utf-8')]
    artifact = out / 'master-prompt.md'
    artifact.write_text('\n'.join(parts), encoding='utf-8', newline='\n')
    provenance['artifacts'] = {'master-prompt.md': hashlib.sha256(artifact.read_bytes()).hexdigest()}
    write_json(out / 'source-lock.json', provenance)
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['check', 'build', 'export'])
    parser.add_argument('--root', type=pathlib.Path, default=ROOT)
    parser.add_argument('--modules', nargs='*', default=[])
    parser.add_argument('--output')
    args = parser.parse_args()
    root = args.root.resolve()
    try:
        data = load_manifest(root)
        if args.action == 'check':
            print(json.dumps({'ok': True, 'entrypoint': data['entrypoint'],
                              'requiredModules': [m['id'] for m in select(data, [])],
                              'totalModules': len(data['modules'])}))
        else:
            if not args.output:
                raise ValueError('--output is required')
            out = package(root, data, args.output) if args.action == 'build' else export(root, data, args.modules, args.output)
            print(json.dumps({'ok': True, 'output': str(out)}))
    except (ValueError, KeyError, OSError) as error:
        print(json.dumps({'ok': False, 'error': str(error)}))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
