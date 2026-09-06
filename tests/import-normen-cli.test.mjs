import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

/**
 * Schutzregeln des Importers, unabhängig vom realen Quellenbestand: der strikte Audit schreibt
 * nie, und ein Markdown-Altbestand wird nicht geöffnet, sobald dieselbe Ausgabe als HTML
 * vorliegt. Der strikte Audit über den realen Bestand läuft in content:check.
 */
async function temporarySources() {
  const directory = await mkdtemp(join(tmpdir(), 'import-normen-'));
  await writeFile(join(directory, 'OGVBl. 2026 Nr. 99.html'), '<html><body><p>Test</p></body></html>\n');
  await writeFile(join(directory, 'OGVBl. 2026 Nr. 99.md'), '# Test\n');
  return directory;
}

function run(args) {
  return spawnSync(process.execPath, ['scripts/import-normen.mjs', ...args], { encoding: 'utf8' });
}

test('strikter Audit kann nicht versehentlich schreiben', async () => {
  const result = run(['--source-dir', await temporarySources(), '--strict', '--write']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /reiner Prüfmodus/u);
});

test('Importer öffnet Markdown nicht, wenn dieselbe Ausgabe als HTML vorhanden ist', async () => {
  const result = run(['--source-dir', await temporarySources(), '--file', 'OGVBl. 2026 Nr. 99.md']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HTML-Quelle derselben Ausgabe vorhanden; Markdown-Altbestand wird nicht geöffnet/u);
});
