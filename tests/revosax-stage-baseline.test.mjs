import assert from 'node:assert/strict';
import test from 'node:test';

import { selectHits, slugify } from '../scripts/revosax-stage-baseline.mjs';

const hits = [
  { lawId: '10', category: 'G', label: 'A' },
  { lawId: '11', category: 'ÄG', label: 'B' },
  { lawId: '12', category: 'G', label: 'C' },
  { lawId: '13', category: 'VO', label: 'D' },
  { lawId: '14', category: 'ÄVO', label: 'E' },
  { lawId: '15', category: 'VO', label: 'F' },
];

test('Staging-Slugs transliterieren Umlaute deterministisch', () => {
  assert.equal(slugify('Ostdeutsche Kommunalpauschalenverordnung'), 'ostdeutsche-kommunalpauschalenverordnung');
  assert.equal(slugify('Änd. der Lehrer-Qualifizierungsverordnung'), 'aend-der-lehrer-qualifizierungsverordnung');
  assert.equal(slugify('VwV Jahresabschluss 2023 (Größe/Übersicht)'), 'vwv-jahresabschluss-2023-groesse-uebersicht');
  assert.equal(slugify(''), 'revosax-norm');
  assert.ok(slugify('x'.repeat(200)).length <= 96);
});

test('Stichprobenauswahl unterstützt Bereich, lawId-Filter und typverteilte Auswahl', () => {
  assert.deepEqual(selectHits(hits, { startAt: 1, limit: 2 }).map(({ hit }) => hit.lawId), ['11', '12']);
  assert.deepEqual(selectHits(hits, { lawIds: ['15', '10'] }).map(({ hit }) => hit.lawId), ['10', '15']);
  const stratified = selectHits(hits, { stratified: 4 });
  assert.deepEqual(stratified.map(({ hit }) => hit.category).sort(), ['G', 'VO', 'ÄG', 'ÄVO'].sort());
  assert.deepEqual(stratified.map(({ index }) => index), [0, 1, 3, 4]);
  assert.equal(selectHits(hits, { stratified: 10 }).length, 6);
});

import { resolveMultiVersionEntries } from '../scripts/revosax-stage-baseline.mjs';

function entry(overrides) {
  return {
    revosaxLawId: '19759',
    versionSuffix: null,
    sourceId: '19759',
    canonicalVersionUrl: 'https://www.revosax.sachsen.de/vorschrift/19759.2',
    versionNumber: '2',
    adaptedBodyHash: 'same',
    adaptedTitle: 'Titel',
    adaptedAbbr: null,
    listing: { url: 'https://www.revosax.sachsen.de/vorschrift/19759-x', alternativeVersionUrls: [] },
    reviewFlags: [],
    skipReason: null,
    ...overrides,
  };
}

test('Mehrfachfassungen derselben lawId werden deterministisch aufgelöst oder als Review markiert', () => {
  const alias = entry({ versionSuffix: '2', sourceId: '19759.2', listing: { url: 'https://www.revosax.sachsen.de/vorschrift/19759.2', alternativeVersionUrls: ['https://www.revosax.sachsen.de/vorschrift/19759-x'] } });
  const dynamic = entry({ listing: { url: 'https://www.revosax.sachsen.de/vorschrift/19759-x', alternativeVersionUrls: ['https://www.revosax.sachsen.de/vorschrift/19759.2'] } });
  const aliasResolutions = resolveMultiVersionEntries([dynamic, alias]);
  assert.deepEqual(aliasResolutions, [{ lawId: '19759', resolution: 'same-version-alias', kept: '19759.2', skipped: '19759' }]);
  assert.equal(dynamic.skipReason, 'same-version-alias:19759.2');
  assert.equal(alias.skipReason, null);

  const older = entry({ versionSuffix: '1', sourceId: '19759.1', canonicalVersionUrl: 'https://www.revosax.sachsen.de/vorschrift/19759.1', versionNumber: '1', listing: { url: 'https://www.revosax.sachsen.de/vorschrift/19759.1', alternativeVersionUrls: ['https://www.revosax.sachsen.de/vorschrift/19759.2'] } });
  const newer = entry({ versionSuffix: '2', sourceId: '19759.2', listing: { url: 'https://www.revosax.sachsen.de/vorschrift/19759.2', alternativeVersionUrls: ['https://www.revosax.sachsen.de/vorschrift/19759.1'] } });
  const identical = resolveMultiVersionEntries([older, newer]);
  assert.deepEqual(identical, [{ lawId: '19759', resolution: 'identical-text', kept: '19759.2', skipped: '19759.1' }]);
  assert.equal(older.skipReason, 'identical-text-superseded-by:19759.2');
  assert.deepEqual(newer.reviewFlags, ['multi-version-identical-text']);

  const differingOld = entry({ versionSuffix: '1', sourceId: '19759.1', canonicalVersionUrl: 'https://www.revosax.sachsen.de/vorschrift/19759.1', versionNumber: '1', adaptedBodyHash: 'other', listing: { url: 'https://www.revosax.sachsen.de/vorschrift/19759.1', alternativeVersionUrls: ['https://www.revosax.sachsen.de/vorschrift/19759.2'] } });
  const differingNew = entry({ versionSuffix: '2', sourceId: '19759.2', listing: { url: 'https://www.revosax.sachsen.de/vorschrift/19759.2', alternativeVersionUrls: ['https://www.revosax.sachsen.de/vorschrift/19759.1'] } });
  const review = resolveMultiVersionEntries([differingOld, differingNew]);
  assert.equal(review[0].resolution, 'review');
  assert.deepEqual(review[0].candidates, ['19759.1', '19759.2']);
  assert.equal(differingOld.skipReason, null);
  assert.deepEqual(differingNew.reviewFlags, ['multi-version-text-differs']);

  const lonely = entry({ versionSuffix: '1', sourceId: '19759.1', listing: { url: 'https://www.revosax.sachsen.de/vorschrift/19759.1', alternativeVersionUrls: ['https://www.revosax.sachsen.de/vorschrift/19759.2'] } });
  resolveMultiVersionEntries([lonely]);
  assert.deepEqual(lonely.reviewFlags, ['multi-version-sibling-not-staged']);
});

test('Slugs enden an Wortgrenzen', () => {
  const long = slugify('Gemeinsame Verwaltungsvorschrift des Ostdeutschen Staatsministeriums der Finanzen und des Ostdeutschen Staatsministeriums des Innern zu Investorenvorhaben');
  assert.ok(long.length <= 96);
  assert.doesNotMatch(long, /-$/u);
  assert.equal(long, 'gemeinsame-verwaltungsvorschrift-des-ostdeutschen-staatsministeriums-der-finanzen-und-des');
});
