import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

test('source archive excludes local secrets, logs, dumps and generated binaries', t => {
  const python = process.env.PYTHON || 'python';
  const probe = spawnSync(python, ['--version']);
  if (probe.error?.code === 'ENOENT') return t.skip('Set PYTHON to run archive security regression');
  const result = spawnSync(python, ['-c', `
import importlib.util, tempfile, zipfile
from pathlib import Path
spec = importlib.util.spec_from_file_location('bundle', 'scripts/source-bundle.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp)
    allowed = ['src/main.js', 'scripts/build-engine.py', 'vendor/doom/Makefile.emscripten', 'public/licenses/DOOM-GPL.txt', '.env.example']
    denied = ['.env.production', '.npmrc', '.aws/credentials', 'credentials.json', 'debug.log', 'backup.sql', 'src/.env', 'src/secrets.json', 'tests/test-results/session.json', 'public/engine/doom.wasm']
    for name in allowed + denied:
        p = root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text('fixture')
    with zipfile.ZipFile(m.bundle(root)) as z:
        assert set(z.namelist()) == set(allowed), z.namelist()
`], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr || String(result.error || ''));
});
