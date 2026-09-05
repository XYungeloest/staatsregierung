import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { buildDerivedContext } from '@ostrecht/shared/lib/norms/derived.ts';
import { loadNorm } from '@ostrecht/shared/lib/norms/loader.ts';
import { loadAllVerkuendungen } from '@ostrecht/shared/lib/norms/publications.ts';

import { REFERENCE_DATE_PATH, scopeFromChangedPaths } from '../../scripts/lib/d1-sync-scope.mjs';
import { referenceDateAffectedSlugs, referenceDateSignature } from '../../scripts/lib/d1-reference-date.mjs';
import { buildSyncPlan, estimatePlanCost } from '../../scripts/sync-recht-d1.mjs';

/**
 * Stichtagsfortschreibung in der D1-Projektion: Der gezielte inkrementelle Lauf (nur die
 * stichtagsabhängig betroffenen Normen plus abgeleitete Daten aller Normen) muss dieselben
 * Tabelleninhalte erzeugen wie eine frische Vollprojektion zum neuen Stichtag. Der Vergleich
 * läuft gegen eine In-Memory-SQLite mit den echten Migrationen (FTS5, Trigger) über einen
 * repräsentativen Ausschnitt des Bestands, der die zum 4. September 2026 betroffenen Normen
 * einschließt.
 */

const FROM = '2026-09-01';
const TO = '2026-09-04';
const NOW = '2026-09-04T08:00:00.000Z';
const ROOT = process.cwd();
const IDENTITY_OLD = { fingerprint: 'a'.repeat(64), scope: 'full', logic: 'l'.repeat(64), corpus: 'c'.repeat(64), portal: 'p'.repeat(64) };
const IDENTITY_NEW = { fingerprint: 'b'.repeat(64), scope: 'full', logic: 'l'.repeat(64), corpus: 'd'.repeat(64), portal: 'p'.repeat(64) };
const TABLES = [
  'law_norms', 'law_versions', 'law_version_blocks', 'law_source_objects', 'law_norm_derived', 'law_publications',
  'law_search_documents', 'law_search_units', 'law_norm_subjects', 'law_norm_history', 'law_norm_keywords', 'law_runtime_meta',
];
// Spalten ohne fachlichen Inhalt: Zeitstempel, Laufmodus und die fortlaufende rowid der Suchzeilen.
const IGNORED_COLUMNS = new Set(['updated_at']);
const IGNORED_META_KEYS = new Set(['last_sync_at', 'sync_mode']);

const DATE_SENSITIVE_SLUGS = [
  'interflug-gesetz', 'gesetz-zur-errichtung-der-interflug',
  'zinnwald-vergesellschaftungsgesetz', 'gesetz-zur-einfuehrung-eines-zinnwald-vergesellschaftungsgesetzes',
  'ostdeutsches-daseinsvorsorgegesetz', 'gesetz-zur-einfuehrung-eines-besonderen-gesetzes-ueber-die-oeffentliche-daseinsvorsorge',
  'ostdeutsches-hoheitszeichengesetz', 'besonderes-gesetz-zur-neuregelung-des-hoheitszeichenrechts',
  'staatsvertrag-zur-anderung-des-staatsvertrages-uber-den-nord-122dpnt',
  'bekanntmachung-ueber-das-inkrafttreten-des-ndr-aenderungs-und-ueberleitungsstaatsvertrages',
  'saechsische-haushaltsordnung',
];

async function loadSqlite() {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    return DatabaseSync;
  } catch (error) {
    throw new Error(`node:sqlite ist erforderlich (Node ≥ 22.13): ${error.message}`);
  }
}

async function loadFixtureNorms() {
  const fixture = JSON.parse(await readFile(join(ROOT, 'data', 'recht', 'runtime-fixture.json'), 'utf8'));
  const slugs = [...new Set([...fixture.slugs.map((entry) => (typeof entry === 'string' ? entry : entry.slug)), ...DATE_SENSITIVE_SLUGS])].sort();
  const norms = await Promise.all(slugs.map((slug) => loadNorm(slug)));
  return norms.sort((left, right) => left.meta.title.localeCompare(right.meta.title));
}

async function createDatabase(DatabaseSync) {
  const db = new DatabaseSync(':memory:');
  const schemaDir = join(ROOT, 'data', 'recht', 'd1');
  for (const name of (await readdir(schemaDir)).filter((file) => /^\d{4}_.*\.sql$/u.test(file)).sort()) {
    db.exec(await readFile(join(schemaDir, name), 'utf8'));
  }
  return db;
}

function bindable(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function executePlan(db, plan) {
  for (const group of plan.groups) {
    for (const query of group.queries) {
      db.prepare(query.sql).run(...(query.params ?? []).map(bindable));
    }
  }
}

function dumpTable(db, table) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all().map((row) => {
    const entry = {};
    for (const [key, value] of Object.entries(row)) {
      if (IGNORED_COLUMNS.has(key)) continue;
      if (table === 'law_search_units' && key === 'id') continue;
      entry[key] = value;
    }
    return entry;
  });
  if (table === 'law_runtime_meta') return rows.filter((row) => !IGNORED_META_KEYS.has(row.key)).sort((left, right) => left.key.localeCompare(right.key));
  return rows.map((row) => JSON.stringify(row)).sort().map((row) => JSON.parse(row));
}

function ftsHits(db, term) {
  return db.prepare('SELECT norm_id, version_id, provision_path FROM law_search WHERE law_search MATCH ? ORDER BY norm_id, version_id, provision_path').all(term);
}

test('Stichtagsabhängige Signatur und betroffene Normen zwischen 2026-09-01 und 2026-09-04', async () => {
  const norms = await loadFixtureNorms();
  const affected = referenceDateAffectedSlugs(norms, FROM, TO);
  for (const slug of DATE_SENSITIVE_SLUGS) assert.ok(affected.includes(slug), `${slug} muss stichtagsabhängig betroffen sein`);
  assert.ok(!affected.includes('sero-verordnung'), 'eine unveränderte Norm ist nicht betroffen');
  assert.deepEqual(referenceDateAffectedSlugs(norms, TO, TO), []);
  assert.deepEqual(referenceDateAffectedSlugs(norms, TO, FROM), affected, 'die Richtung des Stichtagswechsels ändert die Menge nicht');
  const interflug = norms.find((norm) => norm.meta.slug === 'interflug-gesetz');
  assert.match(referenceDateSignature(interflug, FROM), /2026-09-03:future/u);
  assert.match(referenceDateSignature(interflug, TO), /2026-09-03:current/u);
  const scope = scopeFromChangedPaths([REFERENCE_DATE_PATH], { existingSlugs: new Set(norms.map((norm) => norm.meta.slug)), referenceDateSlugs: () => affected });
  assert.equal(scope.mode, 'incremental');
  assert.deepEqual(scope.slugs, affected);
  assert.equal(scope.derivedRebuild, true);
  assert.equal(scopeFromChangedPaths([REFERENCE_DATE_PATH], { existingSlugs: new Set() }).mode, 'full', 'ohne alten Stichtag bleibt editorial.json ein Full-Trigger');
});

test('gezielte Stichtagsfortschreibung erzeugt dieselbe Projektion wie eine frische Vollprojektion', async () => {
  const DatabaseSync = await loadSqlite();
  const [norms, publications] = await Promise.all([loadFixtureNorms(), loadAllVerkuendungen()]);
  const contextOld = buildDerivedContext({ norms, publications, asOf: FROM });
  const contextNew = buildDerivedContext({ norms, publications, asOf: TO });
  const fullScope = { mode: 'full', slugs: [], deletedSlugs: [], publicationSlugs: [], deletedPublications: [], derivedRebuild: false, reasons: ['--full'] };

  // A: Vollprojektion zum alten Stichtag, danach gezielte Fortschreibung.
  const targeted = await createDatabase(DatabaseSync);
  executePlan(targeted, buildSyncPlan({ scope: fullScope, norms, publications, context: contextOld, now: NOW, fingerprint: IDENTITY_OLD }));
  const before = Object.fromEntries(TABLES.map((table) => [table, dumpTable(targeted, table)]));
  const affected = referenceDateAffectedSlugs(norms, FROM, TO);
  const scope = scopeFromChangedPaths([REFERENCE_DATE_PATH], { existingSlugs: new Set(norms.map((norm) => norm.meta.slug)), existingPublications: new Set(publications.map((publication) => publication.slug)), referenceDateSlugs: () => affected });
  const incrementalPlan = buildSyncPlan({ scope, norms, publications, context: contextNew, now: NOW, fingerprint: IDENTITY_NEW, writeIdentity: true });
  assert.equal(incrementalPlan.full, false);
  assert.equal(incrementalPlan.selected.length, affected.length);
  assert.equal(incrementalPlan.derivedCount, norms.length - affected.length);
  executePlan(targeted, incrementalPlan);
  targeted.exec("INSERT INTO law_search(law_search) VALUES ('integrity-check')");

  // B: frische Vollprojektion zum neuen Stichtag.
  const fresh = await createDatabase(DatabaseSync);
  executePlan(fresh, buildSyncPlan({ scope: fullScope, norms, publications, context: contextNew, now: NOW, fingerprint: IDENTITY_NEW }));

  for (const table of TABLES) {
    assert.deepEqual(dumpTable(targeted, table), dumpTable(fresh, table), `Tabelle ${table} weicht zwischen gezielter Fortschreibung und Vollprojektion ab`);
  }
  for (const term of ['Interflug', 'Zinnwald', 'Daseinsvorsorge', 'Hoheitszeichen', 'Haushaltsordnung']) {
    assert.deepEqual(ftsHits(targeted, term), ftsHits(fresh, term), `Volltextindex für „${term}“ weicht ab`);
    assert.ok(ftsHits(fresh, term).length > 0, `„${term}“ muss über den Suchindex der geltenden Fassung auffindbar sein`);
  }
  // Die Fortschreibung hat tatsächlich etwas verändert (Fassungseinordnung, geltende Fassung, Identität).
  assert.notDeepEqual(before.law_versions, dumpTable(fresh, 'law_versions'));
  const meta = Object.fromEntries(dumpTable(fresh, 'law_runtime_meta').map((row) => [row.key, row.value]));
  assert.equal(meta.projection_fingerprint, IDENTITY_NEW.fingerprint);
  assert.equal(meta.sync_state, 'complete');
  const temporal = Object.fromEntries(fresh.prepare("SELECT n.slug || ':' || v.version_id AS key, v.temporal_kind FROM law_versions v JOIN law_norms n ON n.id = v.norm_id WHERE n.slug IN ('interflug-gesetz', 'zinnwald-vergesellschaftungsgesetz', 'saechsische-haushaltsordnung')").all().map((row) => [row.key, row.temporal_kind]));
  assert.equal(temporal['interflug-gesetz:2026-09-03'], 'current');
  assert.equal(temporal['zinnwald-vergesellschaftungsgesetz:2026-09-02'], 'current');
  assert.equal(temporal['saechsische-haushaltsordnung:2026-01-27'], 'historical');
  assert.equal(temporal['saechsische-haushaltsordnung:2026-09-03'], 'current');
  const cost = estimatePlanCost(incrementalPlan);
  assert.ok(cost.rowsWrittenMax > 0);

  // Nachgewiesen enge Logikänderung (Äquivalenznachweis, logicChange narrow): zusätzlich
  // Suchdokumente aller Normen neu – ebenfalls identisch mit der frischen Vollprojektion und idempotent.
  const narrowScope = scopeFromChangedPaths([REFERENCE_DATE_PATH, 'packages/recht-search/src/search.ts'], { existingSlugs: new Set(norms.map((norm) => norm.meta.slug)), existingPublications: new Set(publications.map((publication) => publication.slug)), referenceDateSlugs: () => affected, logicChange: 'narrow' });
  assert.equal(narrowScope.refreshSearchDocuments, true);
  const narrowPlan = buildSyncPlan({ scope: narrowScope, norms, publications, context: contextNew, now: NOW, fingerprint: IDENTITY_NEW, writeIdentity: true });
  assert.equal(narrowPlan.documentRefreshCount, norms.length - affected.length);
  executePlan(targeted, narrowPlan);
  for (const table of TABLES) {
    assert.deepEqual(dumpTable(targeted, table), dumpTable(fresh, table), `Tabelle ${table} weicht nach der engen Logikfortschreibung ab`);
  }
});
