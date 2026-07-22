import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('strikter Normquellen-Audit bestätigt den gespeicherten Datenbestand', () => {
  const result = spawnSync(process.execPath, [
    'scripts/import-normen.mjs',
    '--source-dir',
    'Gesetze',
    '--strict',
    '--quiet',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /0 strikte Abweichungen/u);
});

test('strikter Audit kann nicht versehentlich schreiben', () => {
  const result = spawnSync(process.execPath, [
    'scripts/import-normen.mjs',
    '--source-dir',
    'Gesetze',
    '--strict',
    '--write',
    '--file',
    'OGVBl. 2026 Nr. 53.md',
  ], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /reiner Prüfmodus/u);
});
