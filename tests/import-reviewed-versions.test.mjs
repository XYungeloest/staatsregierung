import assert from 'node:assert/strict';
import test from 'node:test';

import {
  preferReviewedSeedBodies,
  publicationEntryTitle,
  reviewedSeedVersionIds,
} from '../scripts/lib/import-reviewed-versions.mjs';

const sources = {
  targets: {
    'beispielnorm': { existingVersionSeed: { versionId: '2030-01-01' } },
    'andere-norm': { resultAbbr: 'AndG' },
  },
};

const generatedBody = [{ type: 'article', label: 'Artikel 1', children: [{ type: 'paragraphText', text: 'Lesefassung' }] }];
const reviewedBody = [{ type: 'article', label: 'Artikel 1', children: [{ type: 'paragraphText', text: 'Geprüfte Fassung.' }] }];

test('Seed-Kennungen stammen nur aus existingVersionSeed des Ziels', () => {
  assert.deepEqual([...reviewedSeedVersionIds(sources, 'beispielnorm')], ['2030-01-01']);
  assert.equal(reviewedSeedVersionIds(sources, 'andere-norm').size, 0);
  assert.equal(reviewedSeedVersionIds(sources, 'unbekannt').size, 0);
  assert.equal(reviewedSeedVersionIds(undefined, 'beispielnorm').size, 0);
});

test('geprüfte Seed-Fassung behält beim Neueinlesen der Lesefassung ihren Normtext', () => {
  const record = { meta: { slug: 'beispielnorm' }, versions: [{ versionId: '2030-01-01', citation: 'neu', body: generatedBody }] };
  const stored = [{ versionId: '2030-01-01', citation: 'alt', body: reviewedBody }];
  const { record: result, preserved } = preferReviewedSeedBodies(record, stored, reviewedSeedVersionIds(sources, 'beispielnorm'));
  assert.deepEqual(preserved, ['2030-01-01']);
  assert.deepEqual(result.versions[0].body, reviewedBody);
  assert.equal(result.versions[0].citation, 'neu', 'nur der Normtext wird bewahrt');
  assert.notEqual(result.versions[0].body, reviewedBody, 'der gespeicherte Normtext wird kopiert, nicht geteilt');
  assert.deepEqual(record.versions[0].body, generatedBody, 'der erzeugte Datensatz bleibt unverändert');
});

test('ohne Seed-Kennzeichnung oder gespeicherte Fassung gilt das Parserergebnis', () => {
  const record = { meta: { slug: 'andere-norm' }, versions: [{ versionId: '2030-01-01', body: generatedBody }] };
  const stored = [{ versionId: '2030-01-01', body: reviewedBody }];
  assert.deepEqual(preferReviewedSeedBodies(record, stored, reviewedSeedVersionIds(sources, 'andere-norm')).record.versions[0].body, generatedBody);
  const seeded = { meta: { slug: 'beispielnorm' }, versions: [{ versionId: '2030-01-01', body: generatedBody }] };
  const { record: result, preserved } = preferReviewedSeedBodies(seeded, [], reviewedSeedVersionIds(sources, 'beispielnorm'));
  assert.deepEqual(preserved, []);
  assert.deepEqual(result.versions[0].body, generatedBody);
});

test('Verkündungseintrag trägt den Titel der verknüpften Fassung', () => {
  const meta = { title: 'Späterer Titel der Beispielnorm' };
  assert.equal(publicationEntryTitle({ versionId: '2030-01-01', title: 'Verkündeter Titel der Beispielnorm' }, meta), 'Verkündeter Titel der Beispielnorm');
  assert.equal(publicationEntryTitle({ versionId: '2030-01-01' }, meta), 'Späterer Titel der Beispielnorm');
  assert.equal(publicationEntryTitle(undefined, meta), 'Späterer Titel der Beispielnorm');
});
