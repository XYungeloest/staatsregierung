import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBaselineRecord, objectKeyFor } from '../scripts/materialize-revosax-baseline.mjs';

const entry = {
  sourceId: '20250.1',
  revosaxLawId: '20250',
  versionSuffix: '1',
  versionNumber: '1',
  category: 'VO',
  inferredType: 'verordnung',
  sourceUrl: 'https://www.revosax.sachsen.de/vorschrift/20250.1',
  retrievedAt: '2026-09-03T12:00:00.000Z',
  sourceSha256: 'a'.repeat(64),
  listing: { label: 'Sächsische Kommunalpauschalenverordnung' },
};

const parsed = {
  original: {
    sourceTitle: 'Verordnung des Sächsischen Staatsministeriums für Soziales über die Gewährung einer Pauschale für soziale Zwecke',
    documentDate: '2023-09-27',
    sourceValidFrom: '2023-10-31',
    sourceValidTo: '2024-08-16',
    sourceNotes: [{ label: '1', text: '§ 1 geändert durch Verordnung vom 1. August 2024 (SächsGVBl. S. 700)' }],
  },
  adapted: {
    sourceTitle: 'Verordnung des Ostdeutschen Staatsministeriums für Soziales über die Gewährung einer Pauschale für soziale Zwecke',
    shortTitle: 'Ostdeutsche Kommunalpauschalenverordnung',
    abbr: 'OstKomPauschVO',
    fullCitation: 'Ostdeutsche Kommunalpauschalenverordnung vom 27. September 2023 (SächsGVBl. S. 837), die durch die Verordnung vom 1. August 2024 (SächsGVBl. S. 700) geändert worden ist',
    body: [{ type: 'paragraph', label: '§ 1', title: 'Pauschale', children: [{ type: 'paragraphText', text: 'Der Freistaat Ostdeutschland gewährt eine Pauschale.' }] }],
  },
};

const objectRecord = { sha256: 'a'.repeat(64), url: 'https://www.revosax.sachsen.de/vorschrift/20250.1' };

test('Ausgangsfassung wird mit R2-Provenienz, historischer Zitierung und Stichtagsfassung materialisiert', () => {
  const record = buildBaselineRecord({ entry, parsed, slug: 'ostdeutsche-kommunalpauschalenverordnung', objectRecord });
  assert.equal(record.meta.slug, 'ostdeutsche-kommunalpauschalenverordnung');
  assert.equal(record.meta.type, 'verordnung');
  assert.equal(record.meta.status, 'in-force');
  assert.equal(record.meta.shortTitle, 'Ostdeutsche Kommunalpauschalenverordnung');
  assert.equal(record.meta.abbr, 'OstKomPauschVO');
  assert.equal(record.meta.documentDate, '2023-09-27');
  assert.equal(record.meta.effectiveDate, undefined);
  assert.equal(record.meta.enactingBody, undefined);
  assert.deepEqual(record.meta.subjects, ['Kommunal- und Verwaltungsrecht', 'Gesundheit und Soziales']);
  assert.ok(record.meta.keywords.includes('OstKomPauschVO'));
  // Spätere sächsische Änderung wird aus dem Seiten-Vollzitat entfernt; die Fundstelle bleibt historisch.
  assert.equal(record.meta.initialCitation, 'Ostdeutsche Kommunalpauschalenverordnung vom 27. September 2023 (SächsGVBl. S. 837)');
  assert.equal(record.version.versionId, '2023-11-01');
  assert.equal(record.version.validFrom, '2023-11-01');
  assert.equal(record.version.validTo, null);
  assert.equal(record.version.citation, record.meta.initialCitation);
  assert.deepEqual(record.version.sourceNotes, parsed.original.sourceNotes);
  assert.equal(record.history.initialVersionId, '2023-11-01');
  const source = record.version.sourceReferences[0];
  assert.equal(source.availability, 'r2-archived');
  assert.equal(source.objectKey, 'revosax/2023-11-01/20250.1.html');
  assert.equal(source.localSource, undefined);
  assert.equal(source.sourceRole, 'official-snapshot');
  assert.equal(source.retrievedAt, '2026-09-03');
  assert.equal(source.sourceValidTo, '2024-08-16');
  assert.equal(objectKeyFor('2023-11-01', '20247'), 'revosax/2023-11-01/20247.html');
});

test('Änderungsvorschriften bleiben eigenständige Rechtsakte mit historischem Wirksamkeitsdatum', () => {
  const amendment = buildBaselineRecord({
    entry: { ...entry, sourceId: '20249', versionSuffix: null, versionNumber: '1', category: 'ÄVO', inferredType: 'aenderungsvorschrift', sourceUrl: 'https://www.revosax.sachsen.de/vorschrift/20249', listing: { label: 'Änd. der Lehrer-Qualifizierungsverordnung' } },
    parsed: { ...parsed, adapted: { ...parsed.adapted, shortTitle: 'Änd. der Lehrer-Qualifizierungsverordnung', abbr: undefined, sourceTitle: 'Änderung der Lehrer-Qualifizierungsverordnung', fullCitation: 'Verordnung vom 11. Oktober 2023 (SächsGVBl. S. 822)' } },
    slug: 'aend-der-lehrer-qualifizierungsverordnung',
    objectRecord: { ...objectRecord, url: 'https://www.revosax.sachsen.de/vorschrift/20249' },
  });
  assert.equal(amendment.meta.type, 'aenderungsvorschrift');
  assert.equal(amendment.meta.status, 'one-time-act');
  assert.equal(amendment.meta.effectiveDate, '2023-10-31');
  assert.equal(amendment.meta.abbr, undefined);
  assert.match(amendment.meta.summary, /Übernommene Änderungsvorschrift/u);
  assert.equal(amendment.meta.affectedNorms, undefined);
});

test('fehlende oder abweichende R2-Archivierung und Sachsen-Reststellen blockieren die Materialisierung', () => {
  assert.throws(() => buildBaselineRecord({ entry, parsed, slug: 'x', objectRecord: undefined }), /nicht im R2-Manifest archiviert/u);
  assert.throws(() => buildBaselineRecord({ entry, parsed, slug: 'x', objectRecord: { ...objectRecord, sha256: 'b'.repeat(64) } }), /SHA-256 im R2-Manifest weicht/u);
  assert.throws(() => buildBaselineRecord({ entry, parsed, slug: 'x', objectRecord: { ...objectRecord, url: 'https://www.revosax.sachsen.de/vorschrift/20250.2' } }), /amtliche URL im R2-Manifest/u);
  assert.throws(() => buildBaselineRecord({
    entry, slug: 'x', objectRecord,
    parsed: { ...parsed, adapted: { ...parsed.adapted, body: [{ type: 'paragraph', label: '§ 1', children: [{ type: 'paragraphText', text: 'Im Freistaat Sachsen gilt dies.' }] }] } },
  }), /Sachsen-Reststellen/u);
  assert.throws(() => buildBaselineRecord({ entry, slug: 'Ungültiger Slug', objectRecord, parsed }), /technischer Slug/u);
});

test('Gesetze erhalten den historischen Landtag als erlassendes Organ', () => {
  const law = buildBaselineRecord({
    entry: { ...entry, sourceId: '1', category: 'G', inferredType: 'gesetz', sourceUrl: 'https://www.revosax.sachsen.de/vorschrift/1', listing: { label: 'Testgesetz' } },
    parsed: { ...parsed, adapted: { ...parsed.adapted, shortTitle: 'Testgesetz', abbr: 'TestG', sourceTitle: 'Gesetz über den Test', fullCitation: 'Gesetz über den Test vom 1. Januar 2020 (SächsGVBl. S. 1)' }, original: { ...parsed.original, sourceTitle: 'Gesetz über den Test' } },
    slug: 'testgesetz',
    objectRecord: { ...objectRecord, url: 'https://www.revosax.sachsen.de/vorschrift/1' },
  });
  assert.equal(law.meta.enactingBody, 'Sächsischer Landtag');
  assert.equal(law.meta.summary, 'Enthält die Regelungen der am 1. November 2023 übernommenen Ausgangsfassung „Testgesetz“.');
});
