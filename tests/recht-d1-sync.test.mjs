import assert from 'node:assert/strict';
import test from 'node:test';

import { groupStatementFiles, renderStatement, sqlLiteral } from '../scripts/sync-recht-d1.mjs';

test('D1-SQL-Literale und Anweisungen werden sicher gerendert', () => {
  assert.equal(sqlLiteral(null), 'NULL');
  assert.equal(sqlLiteral(undefined), 'NULL');
  assert.equal(sqlLiteral(3), '3');
  assert.equal(sqlLiteral(true), '1');
  assert.equal(sqlLiteral("O'Brien; DROP TABLE x; -- ?"), "'O''Brien; DROP TABLE x; -- ?'");
  assert.equal(
    renderStatement({ sql: 'INSERT INTO t (a, b) VALUES (?, ?)', params: ['x?y', null] }),
    "INSERT INTO t (a, b) VALUES ('x?y', NULL);",
  );
  assert.throws(() => renderStatement({ sql: 'SELECT ?, ?', params: ['a'] }), /mehr Platzhalter/u);
  assert.throws(() => renderStatement({ sql: 'SELECT ?', params: ['a', 'b'] }), /weniger Platzhalter/u);
});

test('SQL-Dateien fassen Normen zusammen, ohne eine Norm zu zerteilen', () => {
  const norms = [
    { slug: 'a', statements: ['A1;', 'A2;'] },
    { slug: 'b', statements: ['B1;', 'B2;', 'B3;'] },
    { slug: 'c', statements: ['C1;'] },
  ];
  const files = groupStatementFiles(norms, { maxStatements: 4 });
  assert.deepEqual(files.map((file) => file.slugs), [['a'], ['b', 'c']]);
  const large = groupStatementFiles(norms, { maxBytes: 8 });
  assert.deepEqual(large.map((file) => file.slugs), [['a'], ['b'], ['c']]);
  assert.deepEqual(groupStatementFiles(norms).map((file) => file.slugs), [['a', 'b', 'c']]);
});

// ---------------------------------------------------------------------------
// Kostenpfad der Projektion (Migration 0005) auf dem synthetischen Bestand: indexierte Löschungen,
// Vollprojektion ohne normweise Suchindex-Löschung, Budgetgrenzen.
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';

import { buildDerivedContext } from '@ostrecht/shared/lib/norms/derived.ts';

import { fixtureCorpus } from './helpers/fixture-corpus.ts';
import {
  buildSyncPlan, corpusOverviewMeta, createStats, deleteNormQueries, derivedQueries, estimatePlanCost, normQueries, recordResults, SyncBudgetExceeded, summarizeStatements,
} from '../scripts/sync-recht-d1.mjs';
import { SEARCH_TRIGGERS, SEARCH_UNIT_COLUMNS, searchIndexResetStatements } from '../scripts/lib/d1-search-schema.mjs';

const FINGERPRINT = { fingerprint: 'f'.repeat(64), logic: 'l'.repeat(64), corpus: 'c'.repeat(64), portal: 'p'.repeat(64) };
const NOW = '2026-09-03T12:00:00.000Z';

let fixturePromise = null;
/** Synthetischer Bestand: Stammnorm mit Fassungen, Mantelbestandteil, Änderungsakt, übernommene Verordnungen (tests/helpers/fixture-corpus.ts). */
function fixture() {
  fixturePromise ??= (async () => {
    const all = fixtureCorpus().norms;
    const bySlug = new Map(all.map((norm) => [norm.meta.slug, norm]));
    const norms = ['testgesetz', 'aend-gebuehrenverordnung-artikel', 'aenderungsgesetz-testgesetz', 'testverordnung', 'aufgehobene-verordnung'].map((slug) => bySlug.get(slug));
    const context = buildDerivedContext({ norms, publications: [], topics: [], pressReleases: [] });
    return { norms, context };
  })();
  return fixturePromise;
}

function params(query) {
  return query.params ?? [];
}

test('Vollprojektion: Reset einmal am Anfang, keine normweisen Suchindex-Löschungen, keine NOT-IN-Scans, Metadaten am Ende', async () => {
  const { norms, context } = await fixture();
  const scope = { mode: 'full', slugs: [], deletedSlugs: [], publicationSlugs: [], deletedPublications: [], derivedRebuild: false, reasons: [] };
  const plan = buildSyncPlan({ scope, norms, publications: [], context, now: NOW, fingerprint: FINGERPRINT });
  assert.equal(plan.full, true);
  assert.equal(plan.groups[0].slug, '(reset)');
  const resetSql = plan.groups[0].queries.map((query) => query.sql);
  assert.deepEqual(resetSql.slice(0, searchIndexResetStatements().length), searchIndexResetStatements());
  const normSql = plan.groups.slice(1, -1).flatMap((group) => group.queries.map((query) => query.sql));
  assert.ok(normSql.length > 0);
  assert.ok(normSql.every((sql) => !sql.startsWith('DELETE')), 'die Vollprojektion löscht nicht normweise');
  assert.ok(normSql.every((sql) => !/law_search\b(?!_units|_documents)/u.test(sql)), 'der FTS-Index wird nur über law_search_units (Trigger) befüllt');
  const all = plan.groups.flatMap((group) => group.queries.map((query) => query.sql));
  assert.ok(all.every((sql) => !/NOT IN \(SELECT/u.test(sql)), 'keine NOT-IN-Aufräumläufe');
  assert.equal(all.filter((sql) => sql.startsWith('INSERT INTO law_norms ')).length, norms.length);
  assert.equal(plan.searchUnitCount, all.filter((sql) => sql.startsWith('INSERT INTO law_search_units')).length);
  const last = plan.groups.at(-1).queries;
  const metaKeys = last.filter((query) => query.sql.startsWith('INSERT INTO law_runtime_meta')).map((query) => query.params[0]);
  assert.ok(['projection_fingerprint', 'projection_scope', 'sync_state', 'corpus_hash', 'last_sync_at', 'sync_mode', 'search_filters_json', 'subject_areas_json', 'corpus_stats_json'].every((key) => metaKeys.includes(key)));
  assert.equal(last.at(-1).sql.startsWith('INSERT INTO law_runtime_meta'), true, 'Laufzeitmetadaten sind die letzten Anweisungen');
  assert.equal(last.find((query) => query.params[0] === 'projection_fingerprint').params[1], FINGERPRINT.fingerprint);
  const cost = estimatePlanCost(plan);
  // Kalibrierte Schätzung: D1 zählt je Anweisung mindestens eine gelesene Zeile (gemessen 103.403 bei 103.127 Anweisungen).
  assert.ok(cost.rowsReadApprox >= plan.statementCount && cost.rowsReadApprox <= plan.statementCount + 16, 'die Vollprojektion liest etwa eine Zeile je Anweisung');
  assert.ok(cost.rowsWrittenMax >= plan.statementCount * 1.25 + plan.searchUnitCount * 14, 'Schreibschätzung deckt Index- und FTS5-Schattenzeilen ab');
});

test('einzelner Slug: nur Zeilen dieser Norm über Indizes, kein Reset; Derived-Rebuild berührt bei anderen Normen nur abgeleitete Daten', async () => {
  const { norms, context } = await fixture();
  // Ziel ohne Beziehungen zu anderen Normen des Ausschnitts: keine fremde norm_id in den Parametern.
  const target = norms.find((norm) => norm.meta.slug === 'testverordnung');
  const scope = { mode: 'incremental', slugs: [target.meta.slug], deletedSlugs: [], publicationSlugs: [], deletedPublications: [], derivedRebuild: false, reasons: [] };
  const plan = buildSyncPlan({ scope, norms, publications: [], context, now: NOW, fingerprint: FINGERPRINT });
  assert.equal(plan.full, false);
  assert.ok(plan.groups.every((group) => group.slug !== '(reset)'));
  const normGroup = plan.groups.find((group) => group.slug === target.meta.slug);
  assert.ok(normGroup);
  const deletes = normGroup.queries.filter((query) => query.sql.startsWith('DELETE'));
  assert.deepEqual(deletes.map((query) => query.sql), [
    'DELETE FROM law_search_units WHERE norm_id = ?',
    'DELETE FROM law_norm_subjects WHERE norm_id = ?',
    'DELETE FROM law_norm_keywords WHERE norm_id = ?',
    'DELETE FROM law_norm_history WHERE norm_id = ?',
    'DELETE FROM law_source_objects WHERE norm_id = ?',
    'DELETE FROM law_version_blocks WHERE norm_id = ?',
    'DELETE FROM law_versions WHERE norm_id = ?',
    'DELETE FROM law_norm_derived WHERE norm_id = ?',
  ]);
  assert.ok(normGroup.queries.every((query) => !query.sql.startsWith('DELETE') || params(query)[0] === target.meta.id));
  assert.ok(normGroup.queries.filter((query) => query.sql.startsWith('INSERT INTO law_')).every((query) => query.sql.includes('law_runtime_meta') || params(query)[0] === target.meta.id), 'jede Einfügung trägt die norm_id der Zielnorm');
  const otherIds = norms.filter((norm) => norm !== target).map((norm) => norm.meta.id);
  const referenced = plan.groups.flatMap((group) => group.queries).flatMap((query) => params(query)).filter((value) => otherIds.includes(value));
  assert.deepEqual(referenced, [], 'ohne Derived-Rebuild werden andere Normen nicht angefasst');

  const rebuild = buildSyncPlan({ scope: { ...scope, derivedRebuild: true }, norms, publications: [], context, now: NOW, fingerprint: FINGERPRINT });
  const derivedGroups = rebuild.groups.filter((group) => group.slug.startsWith('(abgeleitet '));
  assert.equal(derivedGroups.length, norms.length - 1);
  for (const group of derivedGroups) {
    assert.ok(group.queries.every((query) => /^(DELETE FROM|INSERT INTO) law_norm_derived|^UPDATE law_norms SET origin_kind/u.test(query.sql)));
  }
  assert.equal(rebuild.derivedCount, norms.length - 1);
});

test('Suchindex-Löschung läuft über den Index der Einheitentabelle und rowid-Trigger, nie über einen FTS-Scan', async () => {
  const { norms, context } = await fixture();
  const queries = normQueries(norms[0], context, NOW);
  assert.equal(queries[0].sql, 'DELETE FROM law_search_units WHERE norm_id = ?');
  assert.ok(queries.every((query) => !/DELETE FROM law_search\b(?!_)/u.test(query.sql)), 'kein DELETE auf der FTS-Tabelle');
  const unitInserts = queries.filter((query) => query.sql.startsWith('INSERT INTO law_search_units'));
  assert.ok(unitInserts.length > 0);
  assert.ok(unitInserts.every((query) => query.params.length === SEARCH_UNIT_COLUMNS.length));
  assert.ok(SEARCH_TRIGGERS[1].includes("VALUES ('delete', old.id"), 'der Löschtrigger nutzt den rowid-genauen FTS5-delete-Befehl');
  const removal = deleteNormQueries('foo').map((query) => query.sql);
  assert.equal(removal[0], 'DELETE FROM law_search_units WHERE norm_id IN (SELECT id FROM law_norms WHERE slug = ?)');
  assert.ok(removal.every((sql) => !/DELETE FROM law_search\b(?!_)/u.test(sql)));
});

test('Migration 0005 führt genau die Trigger und Indizes des Schemamoduls', async () => {
  const migration = await readFile(new URL('../data/recht/d1/0005_search_units.sql', import.meta.url), 'utf8');
  const normalize = (value) => value.replace(/\s+/gu, ' ').trim();
  for (const trigger of SEARCH_TRIGGERS) {
    assert.ok(normalize(migration).includes(normalize(trigger)), `Trigger fehlt oder weicht ab: ${trigger.slice(0, 60)}`);
  }
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_law_search_units_norm ON law_search_units\(norm_id\)/u);
  assert.match(migration, /content='law_search_units'/u);
  assert.match(migration, /content_rowid='id'/u);
  assert.match(migration, /INSERT INTO law_search\(law_search\) VALUES \('rebuild'\)/u);
  for (const column of ['subjects_json', 'keywords_json', 'aliases_json', 'origin_kind', 'origin_baseline_version_id', 'origin_last_own_change_date', 'version_count', 'last_change_date']) {
    assert.ok(migration.includes(`ALTER TABLE law_norms ADD COLUMN ${column}`), column);
  }
});

test('Migration 0007 ergänzt die Filterspalten der Kandidatenabfrage und füllt sie für vorhandene Zeilen', async () => {
  const migration = await readFile(new URL('../data/recht/d1/0007_search_candidate_filters.sql', import.meta.url), 'utf8');
  for (const column of ['last_activity_date', 'is_amendment']) {
    assert.ok(migration.includes(`ALTER TABLE law_norms ADD COLUMN ${column}`), column);
  }
  for (const column of ['publication_source', 'publication_year']) {
    assert.ok(migration.includes(`ALTER TABLE law_versions ADD COLUMN ${column}`), column);
  }
  // Backfill: Altzeilen tragen sofort den richtigen Wert, sonst zählt die Suche zwischen
  // Migration und Sync eine falsche Menge und die Sitemap meldet ein falsches lastmod.
  assert.match(migration, /UPDATE law_norms SET last_activity_date = last_change_date/u);
  assert.match(migration, /UPDATE law_norms SET is_amendment = COALESCE\(\(\s*SELECT max\(CASE WHEN json_extract\(d\.document_json, '\$\.isAmendment'\)/u);
  assert.match(migration, /UPDATE law_versions SET\s+publication_source = json_extract\(publication_ref_json, '\$\.publication'\)/u);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_law_versions_candidate ON law_versions\(norm_id, temporal_kind, publication_source, publication_year\)/u);
});

test('die Projektion schreibt Rechtsänderung, Aktivität, Änderungskennzeichen und Fundstellenspalten je Norm', async () => {
  const { norms, context } = await fixture();
  const amendment = norms.find((norm) => norm.meta.type === 'aenderungsvorschrift');
  const statute = norms.find((norm) => norm.meta.slug === 'testgesetz');
  const normInsert = (norm) => normQueries(norm, context, NOW, { full: true })
    .find((query) => query.sql.startsWith('INSERT INTO law_norms'));
  const versionInsert = (norm) => normQueries(norm, context, NOW, { full: true })
    .find((query) => query.sql.startsWith('INSERT INTO law_versions'));

  for (const [norm, expected] of [[amendment, 1], [statute, 0]]) {
    const insert = normInsert(norm);
    const columns = insert.sql.slice(insert.sql.indexOf('(') + 1, insert.sql.indexOf(')')).split(',').map((name) => name.trim());
    assert.equal(columns.length, insert.params.length, 'Spalten und Werte müssen sich decken');
    assert.equal(insert.params[columns.indexOf('is_amendment')], expected, norm.meta.slug);
    const change = insert.params[columns.indexOf('last_change_date')];
    const activity = insert.params[columns.indexOf('last_activity_date')];
    // Die Rechtsänderung liegt nie nach der Aktivität; ein Hinweis kann die Aktivität anheben.
    assert.ok(!change || !activity || change <= activity, `${norm.meta.slug}: ${change} > ${activity}`);
  }

  const versions = versionInsert(statute);
  const versionColumns = versions.sql.slice(versions.sql.indexOf('(') + 1, versions.sql.indexOf(')')).split(',').map((name) => name.trim());
  assert.equal(versionColumns.length, versions.params.length);
  const source = versions.params[versionColumns.indexOf('publication_source')];
  const year = versions.params[versionColumns.indexOf('publication_year')];
  assert.equal(year === null, source === null, 'Verkündungsblatt und Jahr kommen aus derselben Fundstelle');
  if (year !== null) assert.match(year, /^\d{4}$/u);
});

test('Budgetgrenzen für gelesene und geschriebene Zeilen brechen den Lauf ab', () => {
  const stats = createStats({ maxRowsRead: 100, maxRowsWritten: 50 });
  recordResults(stats, [{ meta: { rows_read: 60, rows_written: 10, duration: 2 } }], { queries: 3, batches: 1 });
  assert.deepEqual({ queries: stats.queries, batches: stats.batches, rowsRead: stats.rowsRead, rowsWritten: stats.rowsWritten }, { queries: 3, batches: 1, rowsRead: 60, rowsWritten: 10 });
  assert.throws(() => recordResults(stats, [{ meta: { rows_read: 50, rows_written: 0 } }]), SyncBudgetExceeded);
  const writes = createStats({ maxRowsWritten: 5 });
  assert.throws(() => recordResults(writes, [{ meta: { rows_written: 6 } }]), /Schreibbudget/u);
  assert.doesNotThrow(() => recordResults(createStats(), [{ meta: { rows_read: 10 ** 9 } }]));
});

test('Anweisungszähler und Übersichtsmetadaten sind deterministisch', async () => {
  const { norms, context } = await fixture();
  const summary = summarizeStatements(normQueries(norms[0], context, NOW));
  assert.equal(summary['insert law_norms'], 1);
  assert.equal(summary['delete law_search_units'], 1);
  assert.equal(summary['insert law_versions'], norms[0].versions.length);
  const meta = corpusOverviewMeta(norms, []);
  const stats = JSON.parse(meta.corpus_stats_json);
  assert.equal(stats.normCount, norms.length);
  const subjectGroups = JSON.parse(meta.subject_groups_json);
  assert.ok(Array.isArray(subjectGroups));
  // Nummer und Reihenfolge der amtlichen Systematik werden mitprojiziert.
  assert.ok(subjectGroups.every((group) => /^\d{2}$/u.test(group.number) && group.slug.startsWith(`${group.number}-`)));
  assert.deepEqual([...subjectGroups].sort((left, right) => left.number.localeCompare(right.number)), subjectGroups);
  const subjectAreas = JSON.parse(meta.subject_areas_json);
  assert.ok(subjectAreas.every((area) => typeof area.normCount === 'number'));
  assert.deepEqual(subjectAreas.map((area) => area.number), [...subjectAreas.map((area) => area.number)].sort());
  assert.deepEqual(corpusOverviewMeta(norms, []), meta);
  const derived = derivedQueries(norms[0], context, NOW);
  assert.equal(derived.length, 3);
});
