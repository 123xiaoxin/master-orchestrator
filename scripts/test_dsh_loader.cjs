// Run with DSH's Electron Node host. Only an explicit isolated custom root is read.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

async function main() {
  const [providerFile, skillRoot, reportFile] = process.argv.slice(2);
  if (!providerFile || !skillRoot || !reportFile) throw new Error('providerFile skillRoot reportFile required');
  const repository = path.resolve(__dirname, '..');
  const local = path.join(repository, '.local') + path.sep;
  for (const target of [skillRoot, reportFile]) {
    if (!path.resolve(target).startsWith(local)) throw new Error('Only repository .local targets allowed');
  }
  if (fs.existsSync(reportFile)) throw new Error('Report already exists');
  const { FileSystemSkillProvider } = require(providerFile);
  const warnings = [];
  const ctx = { get: () => undefined, logger: { warn: (message) => warnings.push(message), debug: () => {} } };
  const control = { signal: new AbortController().signal, invalidate: () => {} };
  const provider = new FileSystemSkillProvider(ctx, control, {
    includeDefaultRoots: false, customSkillDirs: [path.resolve(skillRoot)], watch: false,
    dshHome: path.join(repository, '.local', 'dsh-probe', 'home'),
    agentsHome: path.join(repository, '.local', 'dsh-probe', 'agents'),
  });
  try {
    const candidates = await provider.list({cwd: repository});
    assert.equal(candidates.length, 1);
    const skill = await provider.get(candidates[0], {signal: control.signal});
    assert.equal(skill.name, 'master-skill');
    assert.ok(skill.content.includes('Read all four required modules'));
    const manifest = JSON.parse(fs.readFileSync(path.join(skill.resourceBase.path, 'modules.json'), 'utf8'));
    const reads = [];
    for (const module of manifest.modules.filter(m => m.required || m.id === '06')) {
      const filename = path.resolve(skill.resourceBase.path, module.path);
      assert.ok(filename.startsWith(path.resolve(skillRoot) + path.sep));
      const content = fs.readFileSync(filename);
      assert.ok(content.length > 0);
      reads.push({id: module.id, sha256: crypto.createHash('sha256').update(content).digest('hex')});
    }
    assert.deepEqual(reads.map(r => r.id), ['01','05','07','08','06']);
    fs.writeFileSync(reportFile, JSON.stringify({ok:true, evidenceLevel:'real DSH filesystem provider / isolated component',
      modelCalls:0, fullDshSession:false, entrypoint:skill.path, moduleReads:reads, warnings,
      providerSha256:crypto.createHash('sha256').update(fs.readFileSync(providerFile)).digest('hex')}, null, 2));
    console.log('DSH provider discovered and loaded isolated candidate; five resource reads verified.');
  } finally { await provider.dispose(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
