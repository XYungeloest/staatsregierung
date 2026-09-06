import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildSeedSnapshot,
  expectedNormCount,
  runtimeSeedIdentity,
  seedManifestPath,
  verifySeedSnapshot,
} from '../../scripts/lib/d1-runtime-seed.mjs';

const FIXTURE = 'data/recht/runtime-fixture.json';

// Seed-Werkzeug gegen die echte lokale D1 (Miniflare) mit dem Testfixture: Bau, Verifikation und
// Ablehnung bei fremder Identität oder unvollständigem Zustand. Die Fingerabdruckregeln selbst
// prüft tests/d1-runtime-seed.test.mjs ohne Datenbank.
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
