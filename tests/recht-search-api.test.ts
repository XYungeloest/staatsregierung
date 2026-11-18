import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFtsColumnMatch, buildFtsMatch, buildSearchQueryPlan, searchScopeColumns, type NormSearchState } from '@ostrecht/recht-search/search-query.ts';
import type { SearchPublication } from '@ostrecht/recht-search/search.ts';

import { citedPublications, parseLimit, parseOriginFilter, parseScope, parseSort, parseVersionScope } from '../apps/recht/src/pages/api/suche.json.ts';

const publication = (overrides: Partial<SearchPublication>): SearchPublication => ({
  slug: 'ogvbl-2026-9099', url: '/verkuendungen/ogvbl-2026-9099/', title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 9099',
  designation: 'OGVBl. 2026 Nr. 9099', aliases: ['Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 9099'], date: '2026-09-02',
  publication: 'OGVBl.', year: '2026', issue: '9099', ...overrides,
});
const publications = [
  publication({}),
  publication({ slug: 'ogvbl-2026-909', designation: 'OGVBl. 2026 Nr. 909', title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 909', aliases: ['Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 909'], issue: '909'}),
  publication({ slug: 'overtrbl-2026-904', designation: 'OVertrBl. 2026 Nr. 904', title: 'Ostdeutsches Vertragsblatt 2026 Nr. 904', aliases: ['Ostdeutsches Vertragsblatt 2026 Nr. 904'], publication: 'OVertrBl.', issue: '904', date: '2026-03-24' }),
  publication({ slug: 'overtrbl-2026-9040', designation: 'OVertrBl. 2026 Nr. 9040', title: 'Ostdeutsches Vertragsblatt 2026 Nr. 9040', aliases: ['Ostdeutsches Vertragsblatt 2026 Nr. 9040'], publication: 'OVertrBl.', issue: '9040', date: '2026-12-01' }),
];

/** Suchzustand für die Planprüfungen; dieselben Vorgaben wie die Suchseite. */
function searchState(overrides: Partial<NormSearchState> = {}): NormSearchState {
  return {
    q: '', exclude: '', exact: '', scope: 'all', types: [], ministries: [], subjects: [], statuses: [], origins: [],
    versionScope: 'current', includeAmendments: false, geltungstag: '', validFrom: '', validTo: '', citation: '',
    publicationSources: [], publicationYears: [], publicationIssue: '', publicationPage: '',
    sort: 'relevance', sortExplicit: false, ...overrides,
  };
}

test('zitierte Ausgaben werden an Wortgrenzen erkannt – mit und ohne Punkte, als Langtitel, nie als Teil einer anderen Nummer', () => {
  const slugs = (query: string) => citedPublications(query, publications).map((entry) => entry.slug);
  assert.deepEqual(slugs('OVertrBl. 2026 Nr. 904'), ['overtrbl-2026-904']);
  assert.deepEqual(slugs('OVertrBl 2026 Nr 904 S. 2'), ['overtrbl-2026-904']);
  assert.deepEqual(slugs('Staatsvertrag overtrbl. 2026 nr. 904'), ['overtrbl-2026-904']);
  assert.deepEqual(slugs('Ostdeutsches Vertragsblatt 2026 Nr. 9040'), ['overtrbl-2026-9040']);
  assert.deepEqual(slugs('OGVBl. 2026 Nr. 9099'), ['ogvbl-2026-9099']);
  assert.deepEqual(slugs('OGVBl. 2026 Nr. 909'), ['ogvbl-2026-909']);
  assert.deepEqual(slugs('Testbegriff'), []);
  assert.deepEqual(slugs('2026 Nr. 904'), []);
  assert.deepEqual(slugs(''), []);
});

test('Herkunftsfilter und FTS-Ausdruck bleiben fail-safe', () => {
  const plan = (overrides: Partial<NormSearchState>) => buildSearchQueryPlan(searchState(overrides));
  assert.deepEqual(parseOriginFilter(['inherited-amended', 'unbekannt', 'inherited-amended', 'ostdeutsch-original']), ['inherited-amended', 'ostdeutsch-original']);
  assert.equal(buildFtsMatch(plan({})), null);
  assert.match(buildFtsMatch(plan({ q: 'Testbegriff' })) ?? '', /"testbegriff"\*/u);
  // Mehrere Begriffe sammeln Kandidaten großzügig; die Verknüpfung leisten die UND-Bedingungen.
  assert.match(buildFtsMatch(plan({ q: 'Testbegriff Zweitbegriff' })) ?? '', /\) OR \(/u);
  // Eine Anfrage aus Normtyp oder Strukturadresse allein läuft über die Filterspalten.
  assert.equal(buildFtsMatch(plan({ q: 'Verordnungen' })), null);
  assert.equal(buildFtsMatch(plan({ q: '§ 2a' })), null);
  // Spaltenfilter je Suchbereich.
  assert.equal(searchScopeColumns('all'), null);
  assert.equal(searchScopeColumns('metadata'), null, 'Metadaten trennt die Einheitenart, nicht der Spaltenfilter');
  assert.equal(buildFtsColumnMatch(searchScopeColumns('title'), '("amt"*)'), '{title short_title abbr}: ("amt"*)');
  assert.equal(buildFtsColumnMatch(searchScopeColumns('body'), '("amt"*)'), '{label heading body}: ("amt"*)');
});

test('Anfrageparameter der Such-API werden begrenzt und fail-safe gelesen', () => {
  assert.equal(parseLimit(null), 20, 'ohne Angabe eine Seite von zwanzig Treffern');
  assert.equal(parseLimit('50'), 50);
  assert.equal(parseLimit('5000'), 100, 'die Seitengröße bleibt bei hundert');
  assert.equal(parseLimit('0'), 20);
  assert.equal(parseLimit('keine Zahl'), 20);
  assert.equal(parseScope('body'), 'body');
  assert.equal(parseScope('unbekannt'), 'all');
  assert.deepEqual(parseSort('title'), { sort: 'title', explicit: true });
  assert.deepEqual(parseSort(null), { sort: 'activity', explicit: false });
  assert.deepEqual(parseSort('unbekannt'), { sort: 'activity', explicit: false });
  assert.equal(parseVersionScope('historical'), 'historical');
  assert.equal(parseVersionScope('all'), 'all');
  assert.equal(parseVersionScope('unbekannt'), undefined);
});
