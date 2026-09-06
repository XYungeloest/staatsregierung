import assert from 'node:assert/strict';
import test from 'node:test';

import type { SearchPublication } from '@ostrecht/recht-search/search.ts';

import { buildFtsMatch, citedPublications, parseOriginFilter } from '../apps/recht/src/pages/api/suche.json.ts';

const publication = (overrides: Partial<SearchPublication>): SearchPublication => ({
  slug: 'ogvbl-2026-99', url: '/verkuendungen/ogvbl-2026-99/', title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 99',
  designation: 'OGVBl. 2026 Nr. 99', aliases: ['Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 99'], date: '2026-09-02',
  publication: 'OGVBl.', year: '2026', issue: '99', ...overrides,
});
const publications = [
  publication({}),
  publication({ slug: 'ogvbl-2026-9', designation: 'OGVBl. 2026 Nr. 9', title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 9', aliases: ['Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 9'], issue: '9'}),
  publication({ slug: 'overtrbl-2026-04', designation: 'OVertrBl. 2026 Nr. 4', title: 'Ostdeutsches Vertragsblatt 2026 Nr. 4', aliases: ['Ostdeutsches Vertragsblatt 2026 Nr. 4'], publication: 'OVertrBl.', issue: '4', date: '2026-03-24' }),
  publication({ slug: 'overtrbl-2026-40', designation: 'OVertrBl. 2026 Nr. 40', title: 'Ostdeutsches Vertragsblatt 2026 Nr. 40', aliases: ['Ostdeutsches Vertragsblatt 2026 Nr. 40'], publication: 'OVertrBl.', issue: '40', date: '2026-12-01' }),
];

test('zitierte Ausgaben werden an Wortgrenzen erkannt – mit und ohne Punkte, als Langtitel, nie als Teil einer anderen Nummer', () => {
  const slugs = (query: string) => citedPublications(query, publications).map((entry) => entry.slug);
  assert.deepEqual(slugs('OVertrBl. 2026 Nr. 4'), ['overtrbl-2026-04']);
  assert.deepEqual(slugs('OVertrBl 2026 Nr 4 S. 2'), ['overtrbl-2026-04']);
  assert.deepEqual(slugs('Staatsvertrag overtrbl. 2026 nr. 4'), ['overtrbl-2026-04']);
  assert.deepEqual(slugs('Ostdeutsches Vertragsblatt 2026 Nr. 40'), ['overtrbl-2026-40']);
  assert.deepEqual(slugs('OGVBl. 2026 Nr. 99'), ['ogvbl-2026-99']);
  assert.deepEqual(slugs('OGVBl. 2026 Nr. 9'), ['ogvbl-2026-9']);
  assert.deepEqual(slugs('Testbegriff'), []);
  assert.deepEqual(slugs('2026 Nr. 4'), []);
  assert.deepEqual(slugs(''), []);
});

test('Herkunftsfilter und FTS-Ausdruck der Kandidaten-API bleiben fail-safe', () => {
  assert.deepEqual(parseOriginFilter(['inherited-amended', 'unbekannt', 'inherited-amended', 'ostdeutsch-original']), ['inherited-amended', 'ostdeutsch-original']);
  assert.equal(buildFtsMatch({ q: '', exact: '', citation: '' }), null);
  assert.match(buildFtsMatch({ q: 'Testbegriff', exact: '', citation: '' }) ?? '', /"testbegriff"\*/u);
});
