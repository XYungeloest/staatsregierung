import assert from 'node:assert/strict';
import test from 'node:test';

import { createD1NormStore } from '../apps/recht/src/lib/runtime/store.ts';
import type { D1Database, D1PreparedStatement, D1Result } from '../apps/recht/src/lib/runtime/d1-types.ts';

/**
 * Abfrageformen der D1-Variante ohne Datenbank: ein aufzeichnender D1-Ersatz liefert
 * leere Ergebnisse und protokolliert jede SQL-Anweisung samt Parametern. Geprüft wird
 * der Kostenpfad: keine Route lädt den vollständigen Korpus (meta_json/version_json),
 * Filter laufen als SQL, Verkündungen und Suche berühren law_norms nicht als Volltabelle.
 */

interface LoggedQuery {
  sql: string;
  params: unknown[];
}

function recordingDatabase(rows: Record<string, unknown[]> = {}): { db: D1Database; log: LoggedQuery[] } {
  const log: LoggedQuery[] = [];
  const resultsFor = (sql: string): unknown[] => {
    for (const [needle, value] of Object.entries(rows)) if (sql.includes(needle)) return value;
    return [];
  };
  const db: D1Database = {
    prepare(sql: string): D1PreparedStatement {
      const params: unknown[] = [];
      const statement: D1PreparedStatement = {
        bind(...values: unknown[]) {
          params.push(...values);
          return statement;
        },
        async first<T>() {
          log.push({ sql, params: [...params] });
          return (resultsFor(sql)[0] as T) ?? null;
        },
        async all<T>(): Promise<D1Result<T>> {
          log.push({ sql, params: [...params] });
          return { results: resultsFor(sql) as T[], success: true };
        },
        async run() {
          log.push({ sql, params: [...params] });
          return { results: [], success: true };
        },
      };
      return statement;
    },
    async batch() {
      return [];
    },
  };
  return { db, log };
}

const loadsCorpus = (query: LoggedQuery): boolean => /meta_json|version_json|history_json/u.test(query.sql) && !/WHERE slug = \?|WHERE norm_id = \?/u.test(query.sql);

test('listNormSummariesByType filtert per SQL über den Typindex und liest keine JSON-Volltexte', async () => {
  const { db, log } = recordingDatabase();
  await createD1NormStore(db).listNormSummariesByType('gesetz');
  assert.equal(log.length, 1);
  assert.match(log[0].sql, /WHERE n\.type IN \(\?\)/u);
  assert.deepEqual(log[0].params, ['gesetz']);
  assert.match(log[0].sql, /ORDER BY n\.sort_title, n\.slug/u);
  assert.ok(!/meta_json|version_json|history_json/u.test(log[0].sql));
  const subject = recordingDatabase();
  await createD1NormStore(subject.db).listNormSummaries({ subjectSlug: 'bildung-und-schule', statuses: ['in-force'] });
  assert.match(subject.log[0].sql, /law_norm_subjects s WHERE s\.subject_slug = \?/u);
  assert.deepEqual(subject.log[0].params, ['in-force', 'bildung-und-schule']);
});

test('listPublications liest nur law_publications und keine Normen', async () => {
  const { db, log } = recordingDatabase();
  const store = createD1NormStore(db);
  await store.listPublications();
  await store.listPublications({ limit: 4 });
  assert.equal(log.length, 2);
  assert.ok(log.every((query) => query.sql.startsWith('SELECT publication_json FROM law_publications')));
  assert.match(log[1].sql, /LIMIT \?$/u);
  assert.deepEqual(log[1].params, [4]);
});

test('Suche lädt keinen Korpus: FTS-Kandidaten, Suchdokumente der Kandidaten, Einheiten über den Slug-Index', async () => {
  const { db, log } = recordingDatabase({ 'min(s.rank)': [{ slug: 'a' }, { slug: 'b' }], 'count(DISTINCT s.slug)': [{ total: 2 }] });
  const store = createD1NormStore(db);
  const { slugs } = await store.searchCandidates({ match: '("polizei"*)', limit: 120, offset: 0, types: ['gesetz'] });
  assert.deepEqual(slugs, ['a', 'b']);
  await store.getSearchDocuments(slugs, '("polizei"*)');
  await store.getSearchDocuments(slugs, null);
  await store.listSearchPublications();
  assert.ok(log.every((query) => !loadsCorpus(query)), `Korpusabfrage gefunden: ${log.map((query) => query.sql).join(' | ')}`);
  assert.ok(log.some((query) => /FROM law_search s JOIN law_norms n ON n\.id = s\.norm_id WHERE law_search MATCH \?/u.test(query.sql)));
  assert.ok(log.some((query) => /FROM law_search WHERE law_search MATCH \? AND slug IN/u.test(query.sql)));
  assert.ok(log.some((query) => /FROM law_search_units WHERE slug IN/u.test(query.sql)), 'ohne Suchausdruck werden die Einheiten über die relationale Tabelle gelesen');
  assert.ok(log.every((query) => !/FROM law_search WHERE slug IN/u.test(query.sql)), 'kein FTS-Scan ohne MATCH');
  assert.ok(log.some((query) => query.sql.includes("key = ?") && query.params.includes('search_publications_json')));
});

test('Startseiten- und Übersichtsabfragen lesen Metadatenzeilen, Historie über den Datumsindex und begrenzte Listen', async () => {
  const { db, log } = recordingDatabase({
    "key = ?": [{ value: '[]' }],
  });
  const store = createD1NormStore(db);
  await store.listChanges({ changeTypes: ['amendment', 'repeal'], until: '2026-09-03', order: 'desc', limit: 12 });
  await store.listChanges({ changeTypes: ['amendment'], after: '2026-09-03', order: 'asc', limit: 12 });
  await store.getCorpusStats();
  await store.listSubjectAreas();
  await store.listSubjectSummaries();
  await store.listSearchSuggestions();
  await store.listVersionSummaries();
  await store.getSearchFilters();
  assert.ok(log.every((query) => !loadsCorpus(query)), `Korpusabfrage gefunden: ${log.map((query) => query.sql).join(' | ')}`);
  const history = log.filter((query) => query.sql.includes('FROM law_norm_history h'));
  assert.equal(history.length, 2);
  assert.match(history[0].sql, /h\.change_date <= \?\s+ORDER BY h\.change_date DESC, n\.sort_title LIMIT \?/u);
  assert.deepEqual(history[0].params, ['amendment', 'repeal', '2026-09-03', 12]);
  assert.match(history[1].sql, /h\.change_date > \?\s+ORDER BY h\.change_date ASC/u);
  const metaReads = log.filter((query) => query.sql === 'SELECT value FROM law_runtime_meta WHERE key = ?').map((query) => query.params[0]);
  for (const key of ['corpus_stats_json', 'subject_areas_json', 'subject_groups_json', 'search_filters_json']) assert.ok(metaReads.includes(key), key);
  assert.ok(log.some((query) => query.sql.startsWith('SELECT slug, title, short_title, abbr, aliases_json, type FROM law_norms')));
  assert.ok(log.some((query) => query.sql.startsWith('SELECT n.slug, v.version_id, v.valid_from, v.temporal_kind FROM law_versions v')));
});

test('getNorm liest genau die Zeilen der angefragten Norm und die Körper der gewünschten Fassungen', async () => {
  const meta = { id: 'x', slug: 'x', title: 'X', shortTitle: 'X', type: 'gesetz', status: 'in-force', subjects: ['A'], keywords: [], initialCitation: 'X (OGVBl. S. 1)', predecessor: null, successor: null, summary: 'S' };
  const version = { versionId: '2023-11-01', validFrom: '2023-11-01', validTo: null, isCurrent: true, citation: 'X', changeNote: 'N' };
  const { db, log } = recordingDatabase({
    'FROM law_norms WHERE slug = ?': [{ id: 'x', slug: 'x', meta_json: JSON.stringify(meta), history_json: JSON.stringify({ initialVersionId: '2023-11-01', entries: [] }) }],
    'FROM law_versions WHERE norm_id = ?': [{ norm_id: 'x', version_id: '2023-11-01', version_json: JSON.stringify(version), full_citation: null, publication_ref_json: null }],
  });
  const record = await createD1NormStore(db).getNorm('x', 'current');
  assert.equal(record?.meta.slug, 'x');
  assert.deepEqual(log.map((query) => query.params), [['x'], ['x'], ['x', '2023-11-01']]);
  assert.ok(log.every((query) => /WHERE slug = \?|WHERE norm_id = \?/u.test(query.sql)));
});

test('seitenweise Übersichten laufen als SQL mit COUNT(*) und LIMIT/OFFSET; Buchstabe, Freitext, Herkunft und Sachgebiet sind Bedingungen', async () => {
  const { db, log } = recordingDatabase({ 'COUNT(*) AS total': [{ total: 120 }] });
  const store = createD1NormStore(db);
  const page = await store.queryNormSummaries({ letter: 'B', page: 3, pageSize: 50 });
  assert.equal(page.total, 120);
  assert.equal(page.page, 3);
  assert.equal(page.pageCount, 3);
  assert.equal(log.length, 2);
  assert.match(log[0].sql, /^SELECT COUNT\(\*\) AS total FROM law_norms n WHERE n\.index_letter = \?$/u);
  assert.deepEqual(log[0].params, ['B']);
  assert.match(log[1].sql, /WHERE n\.index_letter = \? ORDER BY n\.sort_title, n\.slug LIMIT \? OFFSET \?$/u);
  assert.deepEqual(log[1].params, ['B', 50, 100]);
  assert.ok(!/meta_json|version_json|history_json/u.test(log[1].sql));

  const filtered = recordingDatabase({ 'COUNT(*) AS total': [{ total: 0 }] });
  const empty = await createD1NormStore(filtered.db).queryNormSummaries({ q: 'Gemeinde%ordnung', originKind: 'inherited-amended', types: ['gesetz'], statuses: ['in-force'], subject: 'Kommunales', page: 9 });
  assert.equal(empty.total, 0);
  assert.equal(empty.page, 1, 'Seite fällt auf die letzte vorhandene Seite zurück');
  assert.equal(empty.pageCount, 1);
  const sql = filtered.log[0].sql;
  assert.match(sql, /n\.type IN \(\?\)/u);
  assert.match(sql, /n\.status IN \(\?\)/u);
  assert.match(sql, /n\.origin_kind = \?/u);
  assert.match(sql, /law_norm_subjects s WHERE s\.subject = \?/u);
  assert.match(sql, /n\.sort_title LIKE \? ESCAPE '\\' OR lower\(n\.short_title\) LIKE \? ESCAPE '\\' OR lower\(n\.abbr\) LIKE \? ESCAPE '\\' OR n\.id IN \(SELECT k\.norm_id FROM law_norm_keywords k WHERE lower\(k\.keyword\) LIKE \? ESCAPE '\\'\)/u);
  assert.deepEqual(filtered.log[0].params, ['gesetz', 'in-force', 'inherited-amended', 'Kommunales', '%gemeinde\\%ordnung%', '%gemeinde\\%ordnung%', '%gemeinde\\%ordnung%', '%gemeinde\\%ordnung%']);
  assert.deepEqual(filtered.log[1].params.slice(-2), [50, 0]);
});

test('Buchstabengruppen, Stichwortindex und Herkunftszähler lesen nur Aggregat- bzw. Indexzeilen', async () => {
  const { db, log } = recordingDatabase({
    'GROUP BY index_letter': [{ letter: 'A', count: 3 }, { letter: '#', count: 1 }],
    'COUNT(DISTINCT k.keyword)': [{ total: 250 }],
    'GROUP BY k.keyword ORDER BY k.keyword LIMIT': [{ keyword: 'Abgaben' }],
    'FROM law_norm_keywords k JOIN law_norms n': [{ keyword: 'Abgaben', slug: 'a', short_title: 'A-Gesetz' }, { keyword: 'Abgaben', slug: 'b', short_title: 'B-Gesetz' }, { keyword: 'Abgaben', slug: 'a', short_title: 'A-Gesetz' }],
    'GROUP BY origin_kind': [{ origin_kind: 'ostdeutsch-original', count: 5 }, { origin_kind: null, count: 1 }],
  });
  const store = createD1NormStore(db);
  assert.deepEqual(await store.listIndexLetters(), [{ letter: 'A', count: 3 }, { letter: '#', count: 1 }]);
  const keywords = await store.listKeywordIndex('A', { q: 'abg', page: 2 });
  assert.deepEqual(keywords.entries, [{ keyword: 'Abgaben', norms: [{ slug: 'a', shortTitle: 'A-Gesetz' }, { slug: 'b', shortTitle: 'B-Gesetz' }] }]);
  assert.deepEqual({ total: keywords.total, page: keywords.page, pageSize: keywords.pageSize, pageCount: keywords.pageCount }, { total: 250, page: 2, pageSize: 100, pageCount: 3 });
  assert.deepEqual(await store.countByOriginKind(), { 'ostdeutsch-original': 5 });
  const countQuery = log.find((query) => query.sql.includes('COUNT(DISTINCT k.keyword)'));
  assert.ok(countQuery);
  assert.match(countQuery.sql, /WHERE k\.index_letter = \? AND lower\(k\.keyword\) LIKE \? ESCAPE/u);
  assert.deepEqual(countQuery.params, ['A', '%abg%']);
  const pageQuery = log.find((query) => query.sql.includes('GROUP BY k.keyword ORDER BY k.keyword LIMIT'));
  assert.ok(pageQuery);
  assert.deepEqual(pageQuery.params, ['A', '%abg%', 100, 100]);
  const joinQuery = log.find((query) => query.sql.includes('FROM law_norm_keywords k JOIN law_norms n'));
  assert.ok(joinQuery);
  assert.match(joinQuery.sql, /WHERE k\.index_letter = \? AND lower\(k\.keyword\) LIKE \? ESCAPE '\\' AND k\.keyword BETWEEN \? AND \? ORDER BY k\.keyword/u);
  assert.deepEqual(joinQuery.params, ['A', '%abg%', 'Abgaben', 'Abgaben'], 'höchstens vier Parameter, unabhängig von der Seitengröße (D1-Grenze 100)');
  assert.ok(log.every((query) => !loadsCorpus(query)));
});
