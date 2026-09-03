import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { combineFingerprint, hashRoots, listFingerprintFiles, projectionFingerprint } from '../scripts/lib/d1-projection-fingerprint.mjs';

test('der Fingerabdruck zählt nur Dateien, die Git kennt: ignorierte Punktdateien ändern ihn nicht', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fingerprint-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  await mkdir(join(root, 'content', 'normen', 'a'), { recursive: true });
  await writeFile(join(root, '.gitignore'), '.DS_Store\n');
  await writeFile(join(root, 'content', 'normen', 'a', 'meta.json'), '{"slug":"a"}\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  const before = await hashRoots(root, ['content/normen']);
  await writeFile(join(root, 'content', 'normen', 'a', '.DS_Store'), 'finder');
  await writeFile(join(root, 'content', 'normen', '.DS_Store'), 'finder');
  assert.equal(await hashRoots(root, ['content/normen']), before, 'ignorierte Dateien zählen nicht');
  // Eine noch nicht eingecheckte, aber nicht ignorierte Datei zählt (lokaler Arbeitsstand).
  await writeFile(join(root, 'content', 'normen', 'a', 'history.json'), '{"entries":[]}\n');
  assert.notEqual(await hashRoots(root, ['content/normen']), before);
  const files = await listFingerprintFiles(root, ['content/normen']);
  assert.deepEqual(files.map((file) => file.slice(root.length + 1)), ['content/normen/a/history.json', 'content/normen/a/meta.json']);
  // Inhaltsänderung ändert den Wert; eine bloße Berührung (mtime) nicht.
  const afterAdd = await hashRoots(root, ['content/normen']);
  await writeFile(join(root, 'content', 'normen', 'a', 'meta.json'), '{"slug":"a"}\n');
  assert.equal(await hashRoots(root, ['content/normen']), afterAdd);
  await writeFile(join(root, 'content', 'normen', 'a', 'meta.json'), '{"slug":"b"}\n');
  assert.notEqual(await hashRoots(root, ['content/normen']), afterAdd);
});

test('der Bestandshash entspricht dem Hash über die von Git verwalteten Dateien des Repositorys', async () => {
  const tracked = execFileSync('git', ['ls-files', '-z', '--', 'content/verkuendungen'], { encoding: 'utf8' }).split('\0').filter(Boolean).sort();
  assert.ok(tracked.length > 50);
  const lines = [];
  for (const path of tracked) lines.push(`${path}\t${createHash('sha256').update(await readFile(path)).digest('hex')}`);
  const expected = createHash('sha256').update(lines.join('\n')).digest('hex');
  assert.equal(await hashRoots(process.cwd(), ['content/verkuendungen']), expected);
  assert.equal(combineFingerprint({ logic: 'l', corpus: 'c', portal: 'p' }), combineFingerprint({ logic: 'l', corpus: 'c', portal: 'p' }));
  const first = await projectionFingerprint();
  assert.match(first.fingerprint, /^[0-9a-f]{64}$/u);
  assert.deepEqual(await projectionFingerprint(), first, 'deterministisch');
});
