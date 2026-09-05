import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  SEED_FORMAT_VERSION,
  SEED_TOOL_FILES,
  buildSeedSnapshot,
  combineSeedFingerprint,
  expectedNormCount,
  locateMiniflareDatabase,
  runtimeSeedIdentity,
  seedFileName,
  seedManifestPath,
  verifySeedSnapshot,
} from '../../scripts/lib/d1-runtime-seed.mjs';

const FIXTURE = 'data/recht/runtime-fixture.json';
const LOCK = JSON.stringify({ packages: { 'node_modules/wrangler': { version: '4.128.0' }, 'node_modules/miniflare': { version: '5.0.0' }, 'node_modules/workerd': { version: '1.0.0' } } });

/** Minimales Repository mit Rechtsbestand, Projektionslogik, Seed-Werkzeugen und Lockfile. */
async function temporaryRepository() {
  const root = await mkdtemp(join(tmpdir(), 'runtime-seed-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  await mkdir(join(root, 'content', 'normen', 'a'), { recursive: true });
  await mkdir(join(root, 'content', 'themen'), { recursive: true });
  await mkdir(join(root, 'data', 'recht', 'd1'), { recursive: true });
  await mkdir(join(root, 'packages', 'shared', 'src', 'styles'), { recursive: true });
  await mkdir(join(root, 'packages', 'shared', 'src', 'config'), { recursive: true });
  await mkdir(join(root, 'scripts', 'lib'), { recursive: true });
  await writeFile(join(root, '.gitignore'), '.DS_Store\n.cache/\n');
  await writeFile(join(root, 'content', 'normen', 'a', 'meta.json'), '{"slug":"a"}\n');
  await writeFile(join(root, 'content', 'themen', 't.json'), '{"slug":"t"}\n');
  await writeFile(join(root, 'data', 'recht', 'd1', '0001_x.sql'), 'CREATE TABLE x (id);\n');
  await writeFile(join(root, 'packages', 'shared', 'src', 'styles', 'home.css'), '.a{}\n');
  await writeFile(join(root, 'packages', 'shared', 'src', 'config', 'editorial.json'), '{"referenceDate":"2026-09-04"}\n');
  for (const file of SEED_TOOL_FILES) await writeFile(join(root, file), `// ${file}\n`);
  await writeFile(join(root, 'package-lock.json'), LOCK);
  execFileSync('git', ['add', '.'], { cwd: root });
  return root;
}

test('Seed-Fingerabdruck ist deterministisch und hängt genau von den seedrelevanten Eingaben ab', async () => {
  const root = await temporaryRepository();
  const base = await runtimeSeedIdentity({ root });
  assert.match(base.fingerprint, /^[0-9a-f]{64}$/u);
  assert.equal(base.scope, 'full');
  assert.equal(base.format, SEED_FORMAT_VERSION);
  assert.deepEqual(base.toolVersions, { wrangler: '4.128.0', miniflare: '5.0.0', workerd: '1.0.0' });
  assert.equal((await runtimeSeedIdentity({ root })).fingerprint, base.fingerprint, 'gleiche Eingaben → gleicher Wert');

  // Reine CSS-Änderung und bloße Berührung (mtime) ändern den Seed nicht.
  await writeFile(join(root, 'packages', 'shared', 'src', 'styles', 'home.css'), '.a{color:red}\n');
  await writeFile(join(root, 'content', 'normen', 'a', 'meta.json'), '{"slug":"a"}\n');
  assert.equal((await runtimeSeedIdentity({ root })).fingerprint, base.fingerprint, 'CSS und mtime sind keine Seed-Eingaben');

  // Rechtsbestand, Migrationen, Stichtag, Portalgrundlagen, Seed-Werkzeuge, Werkzeugversion: jeweils ein anderer Seed.
  const variants = [];
  await writeFile(join(root, 'content', 'normen', 'a', 'meta.json'), '{"slug":"a","title":"neu"}\n');
  variants.push((await runtimeSeedIdentity({ root })).fingerprint);
  await writeFile(join(root, 'data', 'recht', 'd1', '0002_y.sql'), 'CREATE TABLE y (id);\n');
  variants.push((await runtimeSeedIdentity({ root })).fingerprint);
  await writeFile(join(root, 'packages', 'shared', 'src', 'config', 'editorial.json'), '{"referenceDate":"2026-09-05"}\n');
  variants.push((await runtimeSeedIdentity({ root })).fingerprint);
  await writeFile(join(root, 'content', 'themen', 't.json'), '{"slug":"t","title":"x"}\n');
  variants.push((await runtimeSeedIdentity({ root })).fingerprint);
  await writeFile(join(root, SEED_TOOL_FILES[0]), '// geändert\n');
  variants.push((await runtimeSeedIdentity({ root })).fingerprint);
  await writeFile(join(root, 'package-lock.json'), LOCK.replace('4.128.0', '4.129.0'));
  variants.push((await runtimeSeedIdentity({ root })).fingerprint);
  assert.equal(new Set([base.fingerprint, ...variants]).size, variants.length + 1, 'jede seedrelevante Änderung ergibt einen neuen Fingerabdruck');

  // Fixture-Scope ≠ Vollbestand; der Dateiname trägt Modus und Fingerabdruck.
  await mkdir(join(root, 'data', 'recht'), { recursive: true });
  await writeFile(join(root, 'data', 'recht', 'fixture.json'), '{"slugs":["a"]}\n');
  const fixture = await runtimeSeedIdentity({ root, fixture: 'data/recht/fixture.json' });
  assert.notEqual(fixture.fingerprint, (await runtimeSeedIdentity({ root })).fingerprint);
  assert.match(seedFileName(fixture), /^ostrecht-recht-fixture-[0-9a-f]{32}\.sqlite$/u);
  assert.match(seedFileName(await runtimeSeedIdentity({ root })), /^ostrecht-recht-full-[0-9a-f]{32}\.sqlite$/u);
  assert.equal(await expectedNormCount(root, 'data/recht/fixture.json'), 1);
  assert.equal(await expectedNormCount(root, null), 1);
  assert.notEqual(combineSeedFingerprint({ projectionFingerprint: 'p', seedToolHash: 's', toolVersions: { wrangler: '1' } }), combineSeedFingerprint({ projectionFingerprint: 'p', seedToolHash: 's', toolVersions: { wrangler: '1' }, format: 2 }));
  await rm(root, { recursive: true, force: true });
});

test('Fixture-Seed wird gebaut, verifiziert und bei abweichender Identität oder unvollständigem Zustand abgelehnt', async () => {
  const root = process.cwd();
  const workDir = await mkdtemp(join(tmpdir(), 'runtime-seed-build-'));
  const snapshot = join(workDir, 'fixture.sqlite');
  const log = () => {};
  const identity = await runtimeSeedIdentity({ root, fixture: FIXTURE });
  const built = await buildSeedSnapshot({ root, fixture: FIXTURE, out: snapshot, identity, log });
  assert.equal(built.manifest.seedFingerprint, identity.fingerprint);
  assert.equal(built.manifest.normCount, await expectedNormCount(root, FIXTURE));
  assert.equal(built.manifest.scope, identity.scope);
  const verified = await verifySeedSnapshot({ root, fixture: FIXTURE, snapshot, identity, log });
  assert.equal(Number(verified.counts.norms), built.manifest.normCount);
  assert.ok(Number(verified.counts.search_units) > 0);

  // Der Seed-Fingerabdruck des Vollbestands passt nicht zu einem Fixture-Snapshot.
  await assert.rejects(verifySeedSnapshot({ root, fixture: null, snapshot, log }), /abgelehnt/u);

  // Manipulierter Zustand: unvollständiger Sync wird erkannt.
  const { DatabaseSync } = await import('node:sqlite');
  const tampered = join(workDir, 'tampered.sqlite');
  await copyFile(snapshot, tampered);
  await copyFile(seedManifestPath(snapshot), seedManifestPath(tampered));
  const db = new DatabaseSync(tampered);
  db.exec("UPDATE law_runtime_meta SET value = 'incremental-in-progress' WHERE key = 'sync_state'");
  db.close();
  await assert.rejects(verifySeedSnapshot({ root, fixture: FIXTURE, snapshot: tampered, identity, log }), /sync_state/u);

  // Manifest mit fremdem Fingerabdruck wird abgelehnt.
  const foreign = join(workDir, 'foreign.sqlite');
  await copyFile(snapshot, foreign);
  const manifest = JSON.parse(await readFile(seedManifestPath(snapshot), 'utf8'));
  await writeFile(seedManifestPath(foreign), JSON.stringify({ ...manifest, seedFingerprint: 'f'.repeat(64) }));
  await assert.rejects(verifySeedSnapshot({ root, fixture: FIXTURE, snapshot: foreign, identity, log }), /Manifest/u);
  await rm(workDir, { recursive: true, force: true });
});

test('die lokale D1-Datei von Miniflare wird an ihrer Hex-Kennung erkannt, die Metadatendatei nicht', async () => {
  const persistTo = await mkdtemp(join(tmpdir(), 'runtime-seed-persist-'));
  assert.deepEqual(await locateMiniflareDatabase(persistTo), []);
  const objectDir = join(persistTo, 'v3', 'd1', 'miniflare-D1DatabaseObject');
  await mkdir(objectDir, { recursive: true });
  await writeFile(join(objectDir, 'metadata.sqlite'), '');
  await writeFile(join(objectDir, `${'1fc85cda8f1f159b'.repeat(4)}.sqlite`), '');
  await writeFile(join(objectDir, `${'1fc85cda8f1f159b'.repeat(4)}.sqlite-wal`), '');
  const found = await locateMiniflareDatabase(persistTo);
  assert.equal(found.length, 1);
  assert.match(found[0], /[0-9a-f]{64}\.sqlite$/u);
  await rm(persistTo, { recursive: true, force: true });
});
