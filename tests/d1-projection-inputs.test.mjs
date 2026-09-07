import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { buildFixtureNorms, buildFixturePublications, buildFixturePortal } from './helpers/fixture-corpus.ts';
import { applyScopeToCopy } from '../scripts/lib/d1-projection-proof.mjs';
import { compareProjections } from '../scripts/lib/d1-projection-compare.mjs';
import { executePlan, openDatabase } from '../scripts/lib/d1-sqlite.mjs';
import * as sync from '../scripts/sync-recht-d1.mjs';

const ROOT = process.cwd();
const NOW = '2026-01-01T00:00:00.000Z';
const IDENTITY = {
  fingerprint: 'f'.repeat(64),
  scope: 'full',
  logic: 'l'.repeat(64),
  corpus: 'c'.repeat(64),
  portal: 'p'.repeat(64),
};

/**
 * Die Projektion hat vier Eingaben: Normen, Verkündungen, Ableitungskontext und das
 * Stichwortregister. Das Register liefert die Stichworteinträge der Art `register` und geht in
 * `corpus_hash` ein. Sync, Vollseed und Verifikation laden es; als der Äquivalenznachweis es nicht
 * lud, verglich er einen Vollseed *mit* Register gegen eine inkrementelle Simulation *ohne* — die
 * fachlichen Tabellen stimmten, nur `law_runtime_meta.corpus_hash` wich ab. Diese Prüfungen halten
 * fest, dass alle Wege dieselben Eingaben verwenden.
 */
async function projectionInputs() {
  const norms = buildFixtureNorms();
  const publications = buildFixturePublications();
  const { topics, pressReleases } = buildFixturePortal();
  const { buildDerivedContext } = await import('@ostrecht/shared/lib/norms/derived.ts');
  const { EDITORIAL_REFERENCE_DATE } = await import('@ostrecht/shared/lib/norms/versions.ts');
  const { getPressReleaseUrl, getTopicUrl } = await import('@ostrecht/shared/lib/portal/routes.ts');
  const context = buildDerivedContext({ norms, publications, topics, pressReleases, topicUrl: getTopicUrl, pressReleaseUrl: getPressReleaseUrl, asOf: EDITORIAL_REFERENCE_DATE });
  // Ein nichtleeres Register über zwei Vorschriften des Fixtures.
  const register = new Map([
    [norms[0].meta.slug, ['Erstes Registerwort', 'Zweites Registerwort']],
    [norms[1].meta.slug, ['Drittes Registerwort']],
  ]);
  return { sync, norms, publications, topics, pressReleases, context, register };
}

async function fullProjection(inputs, { register }) {
  const path = join(await mkdtemp(join(tmpdir(), 'projection-inputs-')), 'full.sqlite');
  const scope = await sync.resolveScope(['--full'], { norms: inputs.norms, publications: inputs.publications });
  const plan = sync.buildSyncPlan({ scope, norms: inputs.norms, publications: inputs.publications, context: inputs.context, now: NOW, fingerprint: IDENTITY, identity: IDENTITY, writeIdentity: true, register });
  const db = await openDatabase(path, { create: true, root: ROOT });
  try {
    executePlan(db, plan);
  } finally {
    db.close();
  }
  return path;
}

async function runtimeMeta(path, key) {
  const db = await openDatabase(path, { create: false, root: ROOT, readOnly: true });
  try {
    return db.prepare('SELECT value FROM law_runtime_meta WHERE key = ?').get(key)?.value ?? null;
  } finally {
    db.close();
  }
}

async function registerKeywordRows(path) {
  const db = await openDatabase(path, { create: false, root: ROOT, readOnly: true });
  try {
    return db.prepare("SELECT norm_id, keyword FROM law_norm_keywords WHERE kind = 'register' ORDER BY norm_id, keyword").all();
  } finally {
    db.close();
  }
}

test('das Stichwortregister verändert den Bestandsfingerabdruck und die Stichworteinträge', async () => {
  const inputs = await projectionInputs();
  const withRegister = await fullProjection(inputs, { register: inputs.register });
  const withoutRegister = await fullProjection(inputs, { register: new Map() });

  const hashWith = await runtimeMeta(withRegister, 'corpus_hash');
  const hashWithout = await runtimeMeta(withoutRegister, 'corpus_hash');
  assert.notEqual(hashWith, hashWithout, 'ohne Register entsteht ein anderer corpus_hash – genau diese Abweichung meldete der Nachweis');
  assert.equal(hashWith, sync.corpusFingerprint(inputs.norms, inputs.publications, inputs.register));

  const rowsWith = await registerKeywordRows(withRegister);
  const rowsWithout = await registerKeywordRows(withoutRegister);
  assert.equal(rowsWith.length, 3, 'drei Registerstichwörter über zwei Vorschriften');
  assert.deepEqual(rowsWithout, [], 'ohne Register schreibt der Plan keine Registerstichwörter');

  await rm(join(withRegister, '..'), { recursive: true, force: true });
  await rm(join(withoutRegister, '..'), { recursive: true, force: true });
});

test('ein inkrementeller Umfang auf einer Vollprojektion lässt corpus_hash und jede fachliche Tabelle unverändert', async () => {
  const inputs = await projectionInputs();
  const base = await fullProjection(inputs, { register: inputs.register });

  // Einmal eine Vorschrift ohne Registerstichwörter, einmal eine mit: beide Male muss die
  // Kopie danach Zeile für Zeile der Vollprojektion entsprechen.
  for (const slug of [inputs.norms[2].meta.slug, inputs.norms[0].meta.slug]) {
    const candidate = join(await mkdtemp(join(tmpdir(), 'projection-inputs-')), 'candidate.sqlite');
    const scope = await sync.resolveScope(['--slug', slug], { norms: inputs.norms, publications: inputs.publications });
    await applyScopeToCopy({ root: ROOT, basePath: base, out: candidate, scope, inputs, identity: IDENTITY, now: NOW });

    assert.equal(await runtimeMeta(candidate, 'corpus_hash'), await runtimeMeta(base, 'corpus_hash'), `corpus_hash nach dem Umfang ${slug}`);
    const comparison = await compareProjections(candidate, base, { root: ROOT });
    assert.deepEqual(comparison.differingTables, [], `${slug}: abweichende Tabellen ${comparison.differingTables.join(', ')}`);
    assert.equal(comparison.identical, true, `${slug}: Projektion identisch`);
    await rm(join(candidate, '..'), { recursive: true, force: true });
  }

  await rm(join(base, '..'), { recursive: true, force: true });
});

test('Projektionseingaben ohne Register werden abgewiesen, statt still einen anderen corpus_hash zu schreiben', async () => {
  const inputs = await projectionInputs();
  const base = await fullProjection(inputs, { register: inputs.register });
  const candidate = join(await mkdtemp(join(tmpdir(), 'projection-inputs-')), 'candidate.sqlite');
  const scope = await sync.resolveScope(['--slug', inputs.norms[0].meta.slug], { norms: inputs.norms, publications: inputs.publications });

  await assert.rejects(
    () => applyScopeToCopy({ root: ROOT, basePath: base, out: candidate, scope, inputs: { ...inputs, register: undefined }, identity: IDENTITY, now: NOW }),
    /Stichwortregister/u,
  );

  await rm(join(base, '..'), { recursive: true, force: true });
  await rm(join(candidate, '..'), { recursive: true, force: true });
});
