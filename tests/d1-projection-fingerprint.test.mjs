import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { FULL_SCOPE, combineFingerprint, fixtureScope, hashRoots, listFingerprintFiles, projectionFingerprint, projectionIdentity, projectionIdentityAtRef } from '../scripts/lib/d1-projection-fingerprint.mjs';

async function temporaryRepository() {
  const root = await mkdtemp(join(tmpdir(), 'fingerprint-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  await mkdir(join(root, 'content', 'normen', 'a'), { recursive: true });
  await writeFile(join(root, '.gitignore'), '.DS_Store\n');
  await writeFile(join(root, 'content', 'normen', 'a', 'meta.json'), '{"slug":"a"}\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  return root;
}

test('der Fingerabdruck zählt nur Dateien, die Git kennt: ignorierte Punktdateien ändern ihn nicht', async () => {
  const root = await temporaryRepository();
  const before = await hashRoots(root, ['content/normen']);
  await writeFile(join(root, 'content', 'normen', 'a', '.DS_Store'), 'finder');
  await writeFile(join(root, 'content', 'normen', '.DS_Store'), 'finder');
  assert.equal(await hashRoots(root, ['content/normen']), before, 'ignorierte Dateien zählen nicht');
  // Eine noch nicht eingecheckte, aber nicht ignorierte Datei zählt (lokaler Arbeitsstand).
  await writeFile(join(root, 'content', 'normen', 'a', 'history.json'), '{"entries":[]}\n');
  assert.notEqual(await hashRoots(root, ['content/normen']), before);
  assert.deepEqual(await listFingerprintFiles(root, ['content/normen']), ['content/normen/a/history.json', 'content/normen/a/meta.json']);
  // Inhaltsänderung ändert den Wert; eine bloße Berührung (mtime) nicht.
  const afterAdd = await hashRoots(root, ['content/normen']);
  await writeFile(join(root, 'content', 'normen', 'a', 'meta.json'), '{"slug":"a"}\n');
  assert.equal(await hashRoots(root, ['content/normen']), afterAdd);
  await writeFile(join(root, 'content', 'normen', 'a', 'meta.json'), '{"slug":"b"}\n');
  assert.notEqual(await hashRoots(root, ['content/normen']), afterAdd);
});

test('der Bestandshash beruht auf Git-Blob-Kennungen der verwalteten Dateien', async () => {
  const staged = execFileSync('git', ['ls-files', '-s', '-z', '--', 'content/verkuendungen'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  assert.ok(staged.length > 50);
  const lines = staged.map((entry) => {
    const [meta, path] = entry.split('\t');
    return `${path}\t${meta.split(' ')[1]}`;
  });
  // Nur gültig, wenn der Arbeitsbaum unter content/verkuendungen dem Index entspricht.
  const dirty = execFileSync('git', ['status', '--porcelain', '--', 'content/verkuendungen'], { encoding: 'utf8' }).trim();
  if (dirty) return;
  const expected = createHash('sha256').update(lines.sort().join('\n')).digest('hex');
  assert.equal(await hashRoots(process.cwd(), ['content/verkuendungen']), expected);
  const first = await projectionFingerprint();
  assert.match(first.fingerprint, /^[0-9a-f]{64}$/u);
  assert.equal(first.scope, FULL_SCOPE);
  assert.deepEqual(await projectionFingerprint(), first, 'deterministisch');
});

test('die Identität eines Git-Refs entspricht dem sauberen Arbeitsbaum und unterscheidet Commits', async () => {
  const root = await temporaryRepository();
  execFileSync('git', ['commit', '-q', '-m', 'A'], { cwd: root });
  const atHead = await projectionIdentityAtRef('HEAD', { root });
  const workingTree = await projectionIdentity({ root });
  assert.equal(atHead.fingerprint, workingTree.fingerprint, 'sauberer Arbeitsbaum = HEAD');
  assert.equal(atHead.ref, 'HEAD');
  await writeFile(join(root, 'content', 'normen', 'a', 'meta.json'), '{"slug":"a","title":"neu"}\n');
  execFileSync('git', ['commit', '-q', '-am', 'B'], { cwd: root });
  const atB = await projectionIdentityAtRef('HEAD', { root });
  const atA = await projectionIdentityAtRef('HEAD~1', { root });
  assert.notEqual(atB.fingerprint, atA.fingerprint, 'Bestandsänderung ändert die Identität');
  assert.equal(atA.fingerprint, atHead.fingerprint, 'Identität eines Refs ist stabil, ohne Checkout');
  assert.equal((await projectionIdentity({ root })).fingerprint, atB.fingerprint);
  // Eine Änderung der Projektionslogik ändert die Identität ebenfalls.
  await mkdir(join(root, 'data', 'recht', 'd1'), { recursive: true });
  await writeFile(join(root, 'data', 'recht', 'd1', '0001_x.sql'), 'CREATE TABLE x (id);\n');
  const withLogic = await projectionIdentity({ root });
  assert.notEqual(withLogic.fingerprint, atB.fingerprint);
  assert.notEqual(withLogic.logic, atB.logic);
  assert.equal(withLogic.corpus, atB.corpus);
});

test('der Scope ist Teil der Identität: Fixture ≠ Vollbestand, zwei Fixtures ≠ einander', async () => {
  const root = await temporaryRepository();
  await mkdir(join(root, 'data', 'recht'), { recursive: true });
  await writeFile(join(root, 'data', 'recht', 'fixture-a.json'), '{"slugs":["a"]}\n');
  await writeFile(join(root, 'data', 'recht', 'fixture-b.json'), '{"slugs":["a","b"]}\n');
  const full = await projectionIdentity({ root });
  const scopeA = await fixtureScope(root, 'data/recht/fixture-a.json');
  const scopeB = await fixtureScope(root, 'data/recht/fixture-b.json');
  assert.match(scopeA, /^fixture:data\/recht\/fixture-a\.json@[0-9a-f]{16}$/u);
  const fixtureA = await projectionIdentity({ root, scope: scopeA });
  const fixtureB = await projectionIdentity({ root, scope: scopeB });
  assert.equal(fixtureA.corpus, full.corpus, 'gleicher Bestand');
  assert.notEqual(fixtureA.fingerprint, full.fingerprint, 'Fixture behauptet nie die Identität des Vollbestands');
  assert.notEqual(fixtureA.fingerprint, fixtureB.fingerprint, 'zwei Fixtures erkennen einander nicht');
  assert.equal((await projectionIdentity({ root, scope: scopeA })).fingerprint, fixtureA.fingerprint, 'dasselbe Fixture ist ein No-op');
  // Geänderter Fixture-Inhalt = anderer Scope.
  await writeFile(join(root, 'data', 'recht', 'fixture-a.json'), '{"slugs":["b"]}\n');
  assert.notEqual(await fixtureScope(root, 'data/recht/fixture-a.json'), scopeA);
  assert.notEqual(combineFingerprint({ logic: 'l', corpus: 'c', portal: 'p', scope: 'full' }), combineFingerprint({ logic: 'l', corpus: 'c', portal: 'p', scope: 'fixture:x@1' }));
});
