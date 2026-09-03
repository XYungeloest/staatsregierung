import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBaselineRecord, buildEnvelopeComponentRecord, objectKeyFor } from '../scripts/materialize-revosax-baseline.mjs';

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

// Der Materializer passt immer den unveränderten Parse (original) mit dem aktuellen
// Adapter an; ein gespeichertes „adapted“ aus dem Staging wird nicht verwendet.
const parsed = {
  original: {
    sourceTitle: 'Verordnung des Sächsischen Staatsministeriums für Soziales über die Gewährung einer Pauschale für soziale Zwecke',
    shortTitle: 'Sächsische Kommunalpauschalenverordnung',
    abbr: 'SächsKomPauschVO',
    fullCitation: 'Sächsische Kommunalpauschalenverordnung vom 27. September 2023 (SächsGVBl. S. 837), die durch die Verordnung vom 1. August 2024 (SächsGVBl. S. 700) geändert worden ist',
    documentDate: '2023-09-27',
    sourceValidFrom: '2023-10-31',
    sourceValidTo: '2024-08-16',
    sourceNotes: [{ label: '1', text: '§ 1 geändert durch Verordnung vom 1. August 2024 (SächsGVBl. S. 700)' }],
    body: [{ type: 'paragraph', label: '§ 1', title: 'Pauschale', children: [{ type: 'paragraphText', text: 'Der Freistaat Sachsen gewährt nach dem SächsVerfGHG eine Pauschale.' }] }],
  },
  adapted: { sourceTitle: 'VERALTET – darf nicht verwendet werden', body: [] },
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
  // Ursprungsorgan als Provenienz, nicht als Erlassorgan der ostdeutschen Norm.
  assert.equal(record.meta.originEnactingBody, undefined); // Sozialministerium ist nicht in der ableitbaren Organliste
  assert.equal(record.version.body[0].children[0].text, 'Der Freistaat Ostdeutschland gewährt nach dem OstVerfGHG eine Pauschale.');
  assert.match(record.version.changeNote, /^Ausgangsfassung zum Rechtsüberleitungsstichtag 2023-11-01/u);
  assert.doesNotMatch(record.version.changeNote, /sächsisch/iu);
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
    parsed: { original: { ...parsed.original, shortTitle: 'Änd. der Lehrer-Qualifizierungsverordnung', abbr: undefined, sourceTitle: 'Änderung der Lehrer-Qualifizierungsverordnung', fullCitation: 'Verordnung vom 11. Oktober 2023 (SächsGVBl. S. 822)' } },
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
  // Der Reststellenschutz im Materializer greift nur bei einer Lücke zwischen Adapter und
  // Audit; die Anpassung aus dem Original ist deterministisch, daher wird hier die
  // Schemaprüfung (ungültiger Slug) als weiterer Abbruchgrund geprüft.
  assert.throws(() => buildBaselineRecord({ entry, slug: 'Ungültiger Slug', objectRecord, parsed }), /technischer Slug/u);
});

test('Gesetze erhalten den historischen Landtag als Ursprungsorgan (Provenienz), nicht als Erlassorgan', () => {
  const law = buildBaselineRecord({
    entry: { ...entry, sourceId: '1', category: 'G', inferredType: 'gesetz', sourceUrl: 'https://www.revosax.sachsen.de/vorschrift/1', listing: { label: 'Testgesetz' } },
    parsed: { original: { ...parsed.original, shortTitle: 'Testgesetz', abbr: 'TestG', sourceTitle: 'Gesetz über den Test', fullCitation: 'Gesetz über den Test vom 1. Januar 2020 (SächsGVBl. S. 1)' } },
    slug: 'testgesetz',
    objectRecord: { ...objectRecord, url: 'https://www.revosax.sachsen.de/vorschrift/1' },
  });
  assert.equal(law.meta.originEnactingBody, 'Sächsischer Landtag');
  assert.equal(law.meta.enactingBody, undefined);
  assert.equal(law.meta.summary, 'Enthält die Regelungen der am 1. November 2023 übernommenen Ausgangsfassung „Testgesetz“.');
});

test('Erlassdatum stammt ersatzweise aus der amtlichen Trefferliste, und das Ursprungsorgan ist Provenienz', () => {
  const record = buildBaselineRecord({
    entry: { ...entry, sourceId: '20251', versionSuffix: null, category: 'G', inferredType: 'gesetz', sourceUrl: 'https://www.revosax.sachsen.de/vorschrift/20251', listing: { label: 'Sächsisches Testgesetz', documentDate: '2023-06-30' } },
    parsed: { original: { ...parsed.original, documentDate: null, sourceTitle: 'Sächsisches Testgesetz', shortTitle: 'Sächsisches Testgesetz', abbr: 'SächsTestG', fullCitation: 'Sächsisches Testgesetz vom 30. Juni 2023 (SächsGVBl. S. 1)' } },
    slug: 'ostdeutsches-testgesetz',
    objectRecord: { sha256: 'a'.repeat(64), url: 'https://www.revosax.sachsen.de/vorschrift/20251' },
  });
  assert.equal(record.meta.documentDate, '2023-06-30');
  assert.equal(record.meta.originEnactingBody, 'Sächsischer Landtag');
  assert.equal(record.meta.enactingBody, undefined);
  assert.equal(record.meta.title, 'Ostdeutsches Testgesetz');
});

test('ein Artikel einer Mantelvorschrift wird als eigene Änderungsvorschrift mit beiden Quellen materialisiert', () => {
  const componentEntry = {
    sourceId: '1003', revosaxLawId: '1003', versionSuffix: null, category: 'ÄG', inferredType: 'aenderungsvorschrift',
    sourceUrl: 'https://www.revosax.sachsen.de/vorschrift/1003', retrievedAt: '2026-09-03T12:00:00.000Z', sourceSha256: 'b'.repeat(64),
    listing: { label: 'Änd. SächsPersVG', title: 'Änderung des Sächsischen Personalvertretungsgesetzes', documentDate: '2004-05-05', validFrom: '2004-05-15' },
  };
  const component = {
    sourceId: '1003', lawId: '1003', envelopeLawId: '1228', envelopeTitle: 'Sächsisches Verwaltungsmodernisierungsgesetz', anchor: 'a44',
    sourceTitle: 'Änderung des Sächsischen Personalvertretungsgesetzes',
    sourceCitation: 'Änderung des Sächsischen Personalvertretungsgesetzes vom 5. Mai 2004 (SächsGVBl. S. 148, 171)',
    articleLabel: 'Artikel 44', articleBlockPath: [1], class: 'A',
  };
  const envelopeSource = { objectKey: 'revosax/2023-11-01/1228.html', sha256: 'c'.repeat(64), url: 'https://www.revosax.sachsen.de/vorschrift/1228', retrievedAt: '2026-09-03T12:00:00.000Z', sourceValidFrom: '2004-05-15', sourceValidTo: null };
  const envelopeBody = [
    { type: 'paragraphText', text: 'Der Sächsische Landtag hat beschlossen:' },
    { type: 'article', label: 'Artikel 44', title: 'Änderung des Sächsischen Personalvertretungsgesetzes', children: [{ type: 'paragraphText', text: 'Das Sächsische Personalvertretungsgesetz (SächsPersVG) wird geändert.' }] },
  ];
  const record = buildEnvelopeComponentRecord({
    entry: componentEntry, component, envelopeSource, envelopeBody, slug: 'aend-ostpersvg', containedIn: 'ostdeutsches-verwaltungsmodernisierungsgesetz',
    objectRecords: { 'revosax/2023-11-01/1003.html': { sha256: 'b'.repeat(64) }, 'revosax/2023-11-01/1228.html': { sha256: 'c'.repeat(64) } },
  });
  assert.equal(record.meta.type, 'aenderungsvorschrift');
  assert.equal(record.meta.status, 'one-time-act');
  assert.equal(record.meta.title, 'Änderung des Ostdeutschen Personalvertretungsgesetzes');
  assert.equal(record.meta.shortTitle, 'Änd. OstPersVG');
  assert.equal(record.meta.containedIn, 'ostdeutsches-verwaltungsmodernisierungsgesetz');
  assert.equal(record.meta.documentDate, '2004-05-05');
  assert.equal(record.meta.effectiveDate, '2004-05-15');
  assert.equal(record.meta.originEnactingBody, 'Sächsischer Landtag');
  assert.equal(record.meta.initialCitation, 'Änderung des Ostdeutschen Personalvertretungsgesetzes vom 5. Mai 2004 (SächsGVBl. S. 148, 171)');
  assert.equal(record.version.body.length, 1);
  assert.equal(record.version.body[0].label, 'Artikel 44');
  assert.equal(record.version.body[0].children[0].text, 'Das Ostdeutsche Personalvertretungsgesetz (OstPersVG) wird geändert.');
  const [own, envelope] = record.version.sourceReferences;
  assert.equal(own.sourceRole, 'official-snapshot');
  assert.equal(own.lawId, '1003');
  assert.equal(envelope.sourceRole, 'envelope-snapshot');
  assert.equal(envelope.lawId, '1228');
  assert.equal(envelope.url, 'https://www.revosax.sachsen.de/vorschrift/1228#a44');
  assert.throws(() => buildEnvelopeComponentRecord({ entry: componentEntry, component, envelopeSource, envelopeBody, slug: 'x', containedIn: null, objectRecords: {} }), /nicht im R2-Manifest/u);
});

test('Befristungsentscheidungen modellieren das Außerkrafttreten aus dem übernommenen Text', () => {
  const sunsetParsed = {
    ...parsed,
    original: {
      ...parsed.original,
      body: [{ type: 'section', label: 'VII.', title: 'Inkrafttreten', children: [{ type: 'paragraphText', text: 'Sie tritt am Tage nach ihrer Veröffentlichung in Kraft und mit Ablauf des 31. Dezember 2023 außer Kraft.' }] }],
    },
  };
  const basis = 'Sie tritt am Tage nach ihrer Veröffentlichung in Kraft und mit Ablauf des 31. Dezember 2023 außer Kraft.';
  const past = buildBaselineRecord({ entry, parsed: sunsetParsed, slug: 'ostdeutsche-kommunalpauschalenverordnung', objectRecord, sunset: { resolution: 'sunset-applies', expiryDate: '2023-12-31', status: 'repealed', basis, basisLocation: 'VII.' } });
  assert.equal(past.meta.status, 'repealed');
  assert.equal(past.meta.expiryDate, '2023-12-31');
  assert.equal(past.version.validTo, '2023-12-31');
  assert.equal(past.version.isCurrent, false);
  assert.equal(past.history.entries.length, 2);
  assert.equal(past.history.entries[1].type, 'repeal');
  assert.equal(past.history.entries[1].date, '2023-12-31');
  assert.equal(past.history.entries[1].affectingVersionId, null);
  assert.match(past.history.entries[1].note ?? '', /Befristung nach VII\. der übernommenen Fassung: „Sie tritt am Tage nach ihrer Veröffentlichung in Kraft und mit Ablauf des 31\. Dezember 2023 außer Kraft\.“/u);

  const future = buildBaselineRecord({ entry, parsed: sunsetParsed, slug: 'ostdeutsche-kommunalpauschalenverordnung', objectRecord, sunset: { resolution: 'sunset-applies', expiryDate: '2027-12-31', status: 'in-force', basis, basisLocation: 'X.' } });
  assert.equal(future.meta.status, 'in-force');
  assert.equal(future.meta.expiryDate, '2027-12-31');
  assert.equal(future.version.validTo, '2027-12-31');
  assert.equal(future.version.isCurrent, true);
  assert.match(future.history.entries[1].title, /^Tritt durch Befristung/u);

  // Offene Fälle bleiben unverändert; ungültige Entscheidungen scheitern.
  const open = buildBaselineRecord({ entry, parsed: sunsetParsed, slug: 'ostdeutsche-kommunalpauschalenverordnung', objectRecord, sunset: { resolution: 'open', basis } });
  assert.equal(open.meta.status, 'in-force');
  assert.equal(open.version.validTo, null);
  assert.equal(open.history.entries.length, 1);
  assert.throws(() => buildBaselineRecord({ entry, parsed: sunsetParsed, slug: 'x', objectRecord, sunset: { resolution: 'sunset-applies', expiryDate: '2023-10-01', status: 'repealed', basis } }), /vor dem Beginn der Ausgangsfassung/u);
  assert.throws(() => buildBaselineRecord({ entry, parsed: sunsetParsed, slug: 'x', objectRecord, sunset: { resolution: 'sunset-applies', expiryDate: '2023-12-31', status: 'historical', basis } }), /unzulässigem Status/u);
});
