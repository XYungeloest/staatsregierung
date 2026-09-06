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
    async batch<T>(statements: D1PreparedStatement[]): Promise<Array<D1Result<T>>> {
      return Promise.all(statements.map((statement) => statement.all<T>()));
    },
  };
  return { db, log };
}

const loadsCorpus = (query: LoggedQuery): boolean => /meta_json|version_json|history_json/u.test(query.sql) && !/WHERE slug = \?|WHERE norm_id = \?/u.test(query.sql);

test('listNormSummariesByType filtert per SQL über den Typindex und liest keine JSON-Volltexte', async () => {
  const { db, log } = recordingDatabase();
  await createD1NormStore(db).listNormSummariesByType('gesetz');
  assert.equal(log.length, 1);
  assert.match(log[0].sql, /WHERE n\.in_inventory = 1 AND n\.type IN \(\?\)/u);
  assert.deepEqual(log[0].params, ['gesetz']);
  assert.match(log[0].sql, /ORDER BY COALESCE\(n\.sort_word, n\.sort_title\), n\.slug/u);
  assert.ok(!/meta_json|version_json|history_json/u.test(log[0].sql));
  const subject = recordingDatabase();
  await createD1NormStore(subject.db).listNormSummaries({ subjectSlug: 'bildung-und-schule', statuses: ['in-force'] });
  assert.match(subject.log[0].sql, /^SELECT .*WHERE n\.in_inventory = 1 AND n\.status IN/su);
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

test('Herkunftsfilter der Suche läuft serverseitig über law_norms.origin_kind – für Kandidaten und Gesamtzahl, mit und ohne Suchausdruck', async () => {
  const { db, log } = recordingDatabase({ 'min(s.rank)': [{ slug: 'a' }], 'count(DISTINCT s.slug)': [{ total: 1 }] });
  const store = createD1NormStore(db);
  await store.searchCandidates({ match: '("gesetz"*)', limit: 120, offset: 0, types: ['gesetz'], origins: ['inherited-amended', 'ostdeutsch-original'], includeAmendments: true });
  const [candidates, total] = log;
  assert.match(candidates.sql, /WHERE law_search MATCH \? AND n\.type IN \(\?\) AND n\.origin_kind IN \(\?, \?\) AND rank MATCH 'bm25\(0,0,0,0,0,0,0,10,10,10,2,2,1\)' GROUP BY s\.slug/u);
  assert.deepEqual(candidates.params, ['("gesetz"*)', 'gesetz', 'inherited-amended', 'ostdeutsch-original', 120, 0]);
  assert.match(total.sql, /count\(DISTINCT s\.slug\).*AND n\.origin_kind IN \(\?, \?\)$/u);
  assert.deepEqual(total.params, ['("gesetz"*)', 'gesetz', 'inherited-amended', 'ostdeutsch-original']);
  const browse = recordingDatabase();
  await createD1NormStore(browse.db).searchCandidates({ match: null, limit: 50, offset: 100, origins: ['inherited-unchanged'], includeAmendments: true });
  assert.match(browse.log[0].sql, /FROM law_norms n WHERE 1 = 1 AND n\.origin_kind IN \(\?\) ORDER BY/u);
  assert.deepEqual(browse.log[0].params, ['inherited-unchanged', 50, 100]);
  assert.match(browse.log[1].sql, /count\(\*\).*AND n\.origin_kind IN \(\?\)$/u);
  const unfiltered = recordingDatabase();
  await createD1NormStore(unfiltered.db).searchCandidates({ match: null, limit: 50, offset: 0, includeAmendments: true });
  assert.ok(unfiltered.log.every((query) => !query.sql.includes('origin_kind')), 'ohne Herkunftsfilter keine Herkunftsbedingung');
});

test('Grundmenge der Suche: übernommene Änderungsvorschriften bleiben draußen, außer sie sind unmittelbar getroffen', async () => {
  const inventory = /AND \(NOT \(n\.type = 'aenderungsvorschrift' AND n\.origin_kind IN \('inherited-unchanged', 'inherited-amended'\)\)/u;
  const standard = recordingDatabase({ 'count(*)': [{ total: 0 }] });
  await createD1NormStore(standard.db).searchCandidates({ match: null, limit: 20, offset: 0 });
  assert.match(standard.log[0].sql, inventory, 'ohne Häkchen gilt die Grundmenge');
  assert.ok(!standard.log[0].sql.includes('n.is_amendment = 0'), 'die alte Bedingung über is_amendment ist ersetzt');

  const included = recordingDatabase({ 'count(*)': [{ total: 0 }] });
  await createD1NormStore(included.db).searchCandidates({ match: null, limit: 20, offset: 0, includeAmendments: true });
  assert.ok(included.log.every((query) => !inventory.test(query.sql)), 'mit Häkchen entfällt die Einschränkung');

  const typed = recordingDatabase({ 'count(*)': [{ total: 0 }] });
  await createD1NormStore(typed.db).searchCandidates({ match: null, limit: 20, offset: 0, types: ['aenderungsvorschrift'] });
  assert.ok(typed.log.every((query) => !inventory.test(query.sql)), 'der Normtypfilter holt sie ausdrücklich zurück');

  // Unmittelbarer Treffer: Gleichheit mit einer Bezeichnung oder eine zitierte Ausgabe.
  const direct = recordingDatabase({ 'count(*)': [{ total: 0 }], 'FROM law_norms n WHERE n.slug IN': [{ slug: 'aend-x' }] });
  await createD1NormStore(direct.db).searchCandidates({
    match: null,
    limit: 20,
    offset: 0,
    citedSlugs: ['aend-x'],
    plan: { tokenGroups: [], phrases: [], excludeTokens: [], references: [], identityValues: ['OstTestG'], scope: 'all', sort: 'relevance', freeText: true, hasPublicationReference: false },
  });
  const page = direct.log.find((query) => query.sql.includes('LIMIT ? OFFSET ?'));
  assert.ok(page);
  assert.match(page.sql, /n\.abbr = \? COLLATE NOCASE OR n\.short_title = \? COLLATE NOCASE OR n\.title = \? COLLATE NOCASE/u);
  assert.match(page.sql, /OR n\.slug IN \(\?\)\)/u);
  assert.ok(page.params.includes('OstTestG'));
  assert.match(page.sql, /AND n\.slug NOT IN \(\?\)/u, 'die vorangestellten Direkttreffer zählen nicht doppelt');
});

test('Suchplan wird zu SQL: Begriffe dokumentweit mit UND, Ausschluss als NOT IN, Bezüge über json_extract', async () => {
  const { db, log } = recordingDatabase({ 'min(s.rank)': [{ slug: 'a' }], 'count(DISTINCT s.slug)': [{ total: 1 }] });
  await createD1NormStore(db).searchCandidates({
    match: '("gemeinde"*) OR ("haushalt"*)',
    limit: 20,
    offset: 0,
    includeAmendments: true,
    sort: 'relevance',
    plan: {
      tokenGroups: [{ variants: ['gemeinde'], prefix: true }, { variants: ['haushalt'], prefix: true }],
      phrases: ['oeffentliche aufgabe'],
      excludeTokens: [{ variants: ['aenderung'], prefix: true }],
      references: [{ kind: 'paragraph', number: '2a', subsection: '1', label: '§ 2a Abs. 1' }],
      identityValues: ['Gemeinde Haushalt'],
      titlePhrase: 'gemeinde haushalt',
      scope: 'all',
      sort: 'relevance',
      freeText: true,
      hasPublicationReference: false,
    },
  });
  const [page, total] = log;
  assert.equal((page.sql.match(/AND n\.id IN \(SELECT norm_id FROM law_search WHERE law_search MATCH \?\)/gu) ?? []).length, 3, 'zwei Begriffsgruppen und eine Wortfolge');
  assert.match(page.sql, /AND n\.id NOT IN \(SELECT norm_id FROM law_search WHERE law_search MATCH \?\)/u);
  assert.match(page.sql, /json_extract\(u\.references_json, '\$\.paragraph'\) = \?/u);
  assert.match(page.sql, /json_each\(json_extract\(u\.references_json, '\$\.subsections'\)\) je WHERE je\.value = \?/u);
  assert.match(page.sql, /max\(CASE WHEN n\.id IN \(SELECT norm_id FROM law_search WHERE law_search MATCH \?\) THEN 1 ELSE 0 END\) AS title_hit/u);
  assert.match(page.sql, /max\(CASE WHEN s\.rowid IN \(SELECT rowid FROM law_search WHERE law_search MATCH \?\) THEN 1 ELSE 0 END\) AS unit_hit/u);
  assert.match(page.sql, /ORDER BY identity DESC, title_hit DESC, is_amendment, unit_hit DESC, best, sort_title, s\.slug LIMIT \? OFFSET \?/u);
  // Die Zählung beschreibt dieselbe Menge: gleiche Bedingungen, gleiche Parameter nach dem Ausdruck.
  const conditions = (sql: string): string => sql.replace(/^.*WHERE law_search MATCH \?/su, '').replace(/ AND rank MATCH[^]*$| GROUP BY[^]*$/su, '');
  assert.equal(conditions(total.sql), conditions(page.sql));
  assert.deepEqual(total.params, page.params.slice(page.params.length - total.params.length - 2, -2));
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
  assert.match(history[0].sql, /h\.change_date <= \? ORDER BY h\.change_date DESC, n\.sort_title, n\.slug LIMIT \?/u);
  assert.deepEqual(history[0].params, ['amendment', 'repeal', '2026-09-03', 12]);
  assert.match(history[1].sql, /h\.change_date > \? ORDER BY h\.change_date ASC/u);
  const metaReads = log.filter((query) => query.sql === 'SELECT value FROM law_runtime_meta WHERE key = ?').map((query) => query.params[0]);
  for (const key of ['corpus_stats_json', 'subject_areas_json', 'subject_groups_json', 'search_filters_json']) assert.ok(metaReads.includes(key), key);
  assert.ok(log.some((query) => query.sql.startsWith('SELECT slug, title, short_title, abbr, aliases_json, type FROM law_norms')));
  assert.ok(log.some((query) => query.sql.startsWith('SELECT n.slug, v.version_id, v.valid_from, v.temporal_kind FROM law_versions v')));
});

test('Aktuelle Änderungen der Startseite: je Norm ein Ereignis über eine Fensterfunktion, Erlass eingeschlossen, nach Ereignisdatum absteigend', async () => {
  const { db, log } = recordingDatabase();
  const store = createD1NormStore(db);
  await store.listChanges({ changeTypes: ['initial', 'amendment', 'repeal'], until: '2026-09-04', order: 'desc', limit: 12, distinctNorms: true });
  await store.listChanges({ changeTypes: ['initial', 'amendment', 'repeal'], after: '2026-09-04', order: 'asc', limit: 12, distinctNorms: true });
  const [latest, upcoming] = log.filter((query) => query.sql.includes('FROM law_norm_history h'));
  assert.match(latest.sql, /row_number\(\) OVER \(PARTITION BY h\.norm_id ORDER BY h\.change_date DESC, h\.change_type, h\.title\) AS rn/u);
  assert.match(latest.sql, /WHERE rn = 1 ORDER BY change_date DESC, sort_title, slug LIMIT \?/u);
  assert.match(latest.sql, /h\.change_date <= \?/u);
  assert.deepEqual(latest.params, ['initial', 'amendment', 'repeal', '2026-09-04', 12]);
  assert.match(upcoming.sql, /PARTITION BY h\.norm_id ORDER BY h\.change_date ASC/u);
  assert.match(upcoming.sql, /h\.change_date > \?/u);
  assert.ok(log.every((query) => !loadsCorpus(query)));
});

test('Übersichten ohne Suchbegriff sortieren nach jüngster Rechtsänderung (last_change_date), A–Z alphabetisch; die Volltextsuche bleibt nach Rang', async () => {
  const { db, log } = recordingDatabase({ 'count(*)': [{ total: 0 }], 'COUNT(*)': [{ total: 0 }] });
  const store = createD1NormStore(db);
  await store.searchCandidates({ match: null, limit: 120, offset: 0, includeAmendments: true });
  await store.searchCandidates({ match: null, limit: 120, offset: 0, types: ['gesetz'], origins: ['inherited-amended'], includeAmendments: true });
  await store.searchCandidates({ match: '"Testbegriff"', limit: 120, offset: 0, includeAmendments: true });
  await store.searchCandidates({ match: null, limit: 20, offset: 0, includeAmendments: true, sort: 'title' });
  await store.queryNormSummaries({ sort: 'activity', page: 1, pageSize: 50 });
  await store.queryNormSummaries({ letter: 'G', page: 1, pageSize: 50 });
  const browse = log.filter((query) => query.sql.startsWith('SELECT n.slug FROM law_norms n') && query.sql.includes('LIMIT'));
  assert.equal(browse.length, 3);
  for (const query of browse.slice(0, 2)) assert.match(query.sql, /ORDER BY \(n\.last_change_date IS NULL\), n\.last_change_date DESC, COALESCE\(n\.sort_word, n\.sort_title\), n\.slug LIMIT \? OFFSET \?/u);
  assert.deepEqual(browse[1].params, ['gesetz', 'inherited-amended', 120, 0]);
  assert.match(browse[2].sql, /ORDER BY n\.sort_title, n\.slug LIMIT \? OFFSET \?/u, 'eine ausdrückliche Sortierung wirkt auch beim Stöbern');
  assert.ok(browse.slice(0, 2).every((query) => !query.sql.includes('current_valid_from')));
  const fulltext = log.find((query) => query.sql.includes('law_search MATCH ?') && query.sql.includes('LIMIT'));
  assert.match(fulltext?.sql ?? '', /ORDER BY identity DESC, title_hit DESC, is_amendment, unit_hit DESC, best, sort_title, s\.slug LIMIT \? OFFSET \?/u);
  const pages = log.filter((query) => query.sql.includes('LIMIT ? OFFSET ?') && query.sql.includes('n.sort_title') && !query.sql.startsWith('SELECT n.slug FROM law_norms n') && !query.sql.includes('law_search'));
  assert.equal(pages.length, 2);
  assert.match(pages[0].sql, /ORDER BY \(n\.last_change_date IS NULL\), n\.last_change_date DESC, COALESCE\(n\.sort_word, n\.sort_title\), n\.slug LIMIT/u);
  // Grundmenge und Ordnungswort: das A–Z blendet übernommene Änderungsvorschriften aus und
  // sortiert nach dem Ordnungswort, während der Titel die Überschrift bleibt.
  assert.match(pages[1].sql, /WHERE n\.in_inventory = 1 AND n\.index_letter = \? ORDER BY COALESCE\(n\.sort_word, n\.sort_title\), n\.slug LIMIT/u);
});

test('Kandidatenabfrage drückt jeden tragbaren Filter als SQL aus; Zählung und Seite verwenden dieselben Bedingungen', async () => {
  const { db, log } = recordingDatabase({ 'count(*)': [{ total: 0 }] });
  const store = createD1NormStore(db);
  await store.searchCandidates({
    match: null,
    limit: 120,
    offset: 0,
    types: ['gesetz'],
    origins: ['ostdeutsch-original'],
    ministries: ['Staatskanzlei des Freistaates Ostdeutschland'],
    subjectSlugs: ['bildung-und-schule'],
    statuses: ['in-force'],
    publicationSources: ['OGVBl.'],
    publicationYears: ['2026'],
    validOn: '2026-09-04',
    versionScope: 'current',
    publicationIssue: '16',
    publicationPage: '12',
    includeAmendments: true,
  });
  const [page, count] = log;
  // Normebene über die schmalen Spalten, Sachgebiet über die Zuordnungstabelle.
  assert.match(page.sql, /AND n\.type IN \(\?\)/u);
  assert.match(page.sql, /AND n\.origin_kind IN \(\?\)/u);
  assert.match(page.sql, /AND n\.responsible_ministry IN \(\?\)/u);
  assert.match(page.sql, /AND n\.status IN \(\?\)/u);
  assert.match(page.sql, /EXISTS \(SELECT 1 FROM law_norm_subjects sub WHERE sub\.norm_id = n\.id AND sub\.subject_slug IN \(\?\)\)/u);
  // Fassungsart, Verkündungsblatt, Jahr, Gültigkeit, Ausgabennummer und Seite muss dieselbe
  // Fassung erfüllen: genau ein EXISTS.
  assert.match(page.sql, /EXISTS \(SELECT 1 FROM law_versions v WHERE v\.norm_id = n\.id AND v\.temporal_kind = \? AND v\.publication_source IN \(\?\) AND v\.publication_year IN \(\?\) AND v\.valid_from <= \? AND \(v\.valid_to IS NULL OR v\.valid_to >= \?\) AND lower\(json_extract\(v\.publication_ref_json, '\$\.issue'\)\) = \? AND instr\(lower\(coalesce\(json_extract\(v\.publication_ref_json, '\$\.pages'\), json_extract\(v\.publication_ref_json, '\$\.startPage'\), ''\)\), \?\) > 0\)/u);
  assert.equal((page.sql.match(/FROM law_versions v/gu) ?? []).length, 1);
  // Die Zählung darf keine andere Menge beschreiben als die Seite.
  assert.match(count.sql, /^SELECT count\(\*\) AS total FROM law_norms n WHERE 1 = 1/u);
  const conditions = (sql: string): string => sql.replace(/^.*WHERE 1 = 1/su, '').replace(/ ORDER BY.*$/su, '');
  assert.equal(conditions(count.sql), conditions(page.sql));
  assert.deepEqual(count.params, page.params.slice(0, -2));

  // Ohne Filter bleibt die Abfrage unverändert schmal.
  const { db: plainDb, log: plainLog } = recordingDatabase({ 'count(*)': [{ total: 0 }] });
  await createD1NormStore(plainDb).searchCandidates({ match: null, limit: 120, offset: 0, includeAmendments: true });
  assert.equal(plainLog[0].sql, 'SELECT n.slug FROM law_norms n WHERE 1 = 1 ORDER BY (n.last_change_date IS NULL), n.last_change_date DESC, COALESCE(n.sort_word, n.sort_title), n.slug LIMIT ? OFFSET ?');
  assert.deepEqual(plainLog[0].params, [120, 0]);
});

test('Facettenzähler laufen als ein Stapel; jede Facette zählt Vorschriften ohne die eigene Bedingung', async () => {
  const { db, log } = recordingDatabase({ 'GROUP BY': [{ value: 'gesetz', count: 3 }] });
  const counts = await createD1NormStore(db).countSearchFacets({
    match: '("gemeinde"*)',
    limit: 20,
    offset: 0,
    types: ['gesetz'],
    origins: ['ostdeutsch-original'],
    includeAmendments: true,
  });
  assert.equal(log.length, 7, 'sieben Gruppierungen, ein Stapel');
  assert.deepEqual(Object.keys(counts), ['type', 'origin', 'ministry', 'subject', 'status', 'publicationSource', 'publicationYear']);
  assert.deepEqual(counts.type, { gesetz: 3 });
  const byColumn = (column: string) => log.find((query) => query.sql.includes(`GROUP BY ${column}`));
  const type = byColumn('n.type');
  assert.ok(type);
  assert.ok(!type.sql.includes('n.type IN'), 'die eigene Bedingung entfällt, damit Geschwister wählbar bleiben');
  assert.match(type.sql, /count\(DISTINCT s\.slug\) AS count FROM law_search s JOIN law_norms n ON n\.id = s\.norm_id WHERE law_search MATCH \?/u);
  assert.match(type.sql, /AND n\.origin_kind IN \(\?\)/u, 'die übrigen Bedingungen bleiben');
  const origin = byColumn('n.origin_kind');
  assert.ok(origin && !origin.sql.includes('n.origin_kind IN'));
  assert.match(byColumn('fs.subject')?.sql ?? '', /JOIN law_norm_subjects fs ON fs\.norm_id = n\.id/u);
  assert.match(byColumn('fv.publication_source')?.sql ?? '', /JOIN law_versions fv ON fv\.norm_id = n\.id/u);
  assert.ok(log.every((query) => !loadsCorpus(query)));

  // Ohne Suchausdruck zählt die Gruppierung unmittelbar über law_norms.
  const browse = recordingDatabase({ 'GROUP BY': [{ value: 'in-force', count: 2 }] });
  await createD1NormStore(browse.db).countSearchFacets({ match: null, limit: 20, offset: 0, includeAmendments: true });
  assert.match(browse.log[0].sql, /count\(DISTINCT n\.slug\) AS count FROM law_norms n WHERE 1 = 1/u);
});

test('Einheiten der Trefferseite sind je Vorschrift gedeckelt (Fensterfunktion), nie der ganze Normtext', async () => {
  const { db, log } = recordingDatabase();
  const store = createD1NormStore(db);
  await store.getSearchDocuments(['a', 'b'], '("gemeinde"*)', { unitsPerNorm: 5 });
  await store.getSearchDocuments(['a'], null, { unitsPerNorm: 3 });
  const ranked = log.find((query) => query.sql.includes('law_search MATCH ?') && query.sql.includes('row_number'));
  assert.ok(ranked);
  assert.match(ranked.sql, /row_number\(\) OVER \(PARTITION BY slug ORDER BY rank\) AS rn FROM law_search WHERE law_search MATCH \? AND slug IN \(\?, \?\)\) WHERE rn <= \?/u);
  assert.deepEqual(ranked.params, ['("gemeinde"*)', 'a', 'b', 5]);
  const relational = log.find((query) => query.sql.includes('FROM law_search_units WHERE slug IN'));
  assert.ok(relational);
  assert.match(relational.sql, /row_number\(\) OVER \(PARTITION BY slug ORDER BY CAST\(provision_path AS INTEGER\)\) AS rn/u);
  assert.deepEqual(relational.params, ['a', 3]);
  assert.ok(log.every((query) => !loadsCorpus(query)));
});

test('Buchstabenzähler eines Verzeichnisses laufen als GROUP BY über dieselben Bedingungen wie die Seitenabfrage', async () => {
  const { db, log } = recordingDatabase({ 'GROUP BY n.index_letter': [{ letter: 'G', count: 4 }] });
  const store = createD1NormStore(db);
  assert.deepEqual(await store.listIndexLetters({ types: ['gesetz'] }), [{ letter: 'G', count: 4 }]);
  assert.match(log[0].sql, /^SELECT n\.index_letter AS letter, COUNT\(\*\) AS count FROM law_norms n WHERE n\.in_inventory = 1 AND n\.type IN \(\?\) GROUP BY n\.index_letter ORDER BY n\.index_letter$/u);
  assert.deepEqual(log[0].params, ['gesetz']);
  await store.listIndexLetters({ subjectSlug: 'bildung-und-schule', originKind: 'ostdeutsch-original' });
  assert.match(log[1].sql, /n\.origin_kind = \? AND n\.id IN \(SELECT s\.norm_id FROM law_norm_subjects s WHERE s\.subject_slug = \?\) GROUP BY n\.index_letter/u);
  // Der Normtypfilter „Änderungsvorschrift“ hebt die Grundmenge auf, sonst bliebe er ohne Treffer.
  await store.listIndexLetters({ types: ['aenderungsvorschrift'] });
  assert.ok(!log[2].sql.includes('in_inventory'));
  await store.listIndexLetters({ types: ['gesetz'], includeInheritedAmendments: true });
  assert.ok(!log[3].sql.includes('in_inventory'));
  assert.ok(log.every((query) => !/meta_json|version_json|history_json/u.test(query.sql)));
});

test('getNorm liest genau die Zeilen der angefragten Norm und die Körper der gewünschten Fassungen', async () => {
  // Titelmodell: eine Norm ohne eigene Kurzbezeichnung führt nur den Langtitel.
  const meta = { id: 'x', slug: 'x', title: 'X', type: 'gesetz', status: 'in-force', subjects: ['A'], keywords: [], initialCitation: 'X (OGVBl. S. 1)', predecessor: null, successor: null, summary: 'S' };
  const version = { versionId: '2023-11-01', validFrom: '2023-11-01', validTo: null, isCurrent: true, citation: 'X', changeNote: 'N' };
  const { db, log } = recordingDatabase({
    'FROM law_norms WHERE slug = ?': [{ id: 'x', slug: 'x', meta_json: JSON.stringify(meta), history_json: JSON.stringify({ initialVersionId: '2023-11-01', entries: [] }) }],
    'FROM law_versions WHERE norm_id = ?': [{ norm_id: 'x', version_id: '2023-11-01', version_json: JSON.stringify(version), full_citation: null, publication_ref_json: null }],
  });
  const record = await createD1NormStore(db).getNorm('x', 'current');
  assert.equal(record?.meta.slug, 'x');
  assert.equal(record?.meta.shortTitle, undefined);
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
  assert.match(log[0].sql, /^SELECT COUNT\(\*\) AS total FROM law_norms n WHERE n\.in_inventory = 1 AND n\.index_letter = \?$/u);
  assert.deepEqual(log[0].params, ['B']);
  assert.match(log[1].sql, /WHERE n\.in_inventory = 1 AND n\.index_letter = \? ORDER BY COALESCE\(n\.sort_word, n\.sort_title\), n\.slug LIMIT \? OFFSET \?$/u);
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
    'GROUP BY n.index_letter': [{ letter: 'A', count: 3 }, { letter: '#', count: 1 }],
    'COUNT(DISTINCT k.keyword)': [{ total: 250 }],
    'GROUP BY k.keyword ORDER BY k.keyword LIMIT': [{ keyword: 'Abgaben' }],
    'FROM law_norm_keywords k JOIN law_norms n': [{ keyword: 'Abgaben', slug: 'a', short_title: 'A-Gesetz' }, { keyword: 'Abgaben', slug: 'b', short_title: 'B-Gesetz' }, { keyword: 'Abgaben', slug: 'a', short_title: 'A-Gesetz' }],
    'GROUP BY n.origin_kind': [{ origin_kind: 'ostdeutsch-original', count: 5 }, { origin_kind: null, count: 1 }],
  });
  const store = createD1NormStore(db);
  assert.deepEqual(await store.listIndexLetters(), [{ letter: 'A', count: 3 }, { letter: '#', count: 1 }]);
  const keywords = await store.listKeywordIndex('A', { kinds: ['abbr', 'short-title'], q: 'abg', page: 2 });
  assert.deepEqual(keywords.entries, [{ keyword: 'Abgaben', norms: [{ slug: 'a', shortTitle: 'A-Gesetz' }, { slug: 'b', shortTitle: 'B-Gesetz' }] }]);
  assert.deepEqual({ total: keywords.total, page: keywords.page, pageSize: keywords.pageSize, pageCount: keywords.pageCount }, { total: 250, page: 2, pageSize: 50, pageCount: 5 });
  assert.deepEqual(await store.countByOriginKind(), { 'ostdeutsch-original': 5 });
  const countQuery = log.find((query) => query.sql.includes('COUNT(DISTINCT k.keyword)'));
  assert.ok(countQuery);
  assert.match(countQuery.sql, /WHERE k\.index_letter = \? AND k\.kind IN \(\?, \?\) AND lower\(k\.keyword\) LIKE \? ESCAPE/u);
  assert.deepEqual(countQuery.params, ['A', 'abbr', 'short-title', '%abg%']);
  const pageQuery = log.find((query) => query.sql.includes('GROUP BY k.keyword ORDER BY k.keyword LIMIT'));
  assert.ok(pageQuery);
  assert.deepEqual(pageQuery.params, ['A', 'abbr', 'short-title', '%abg%', 50, 50]);
  const joinQuery = log.find((query) => query.sql.includes('FROM law_norm_keywords k JOIN law_norms n'));
  assert.ok(joinQuery);
  assert.match(joinQuery.sql, /WHERE k\.index_letter = \? AND k\.kind IN \(\?, \?\) AND lower\(k\.keyword\) LIKE \? ESCAPE '\\' AND k\.keyword BETWEEN \? AND \? ORDER BY k\.keyword/u);
  assert.deepEqual(joinQuery.params, ['A', 'abbr', 'short-title', '%abg%', 'Abgaben', 'Abgaben'], 'höchstens sechs Parameter, unabhängig von der Seitengröße (D1-Grenze 100)');
  assert.ok(log.every((query) => !loadsCorpus(query)));
});
