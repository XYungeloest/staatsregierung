import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBaselineRecord, buildEnvelopeComponentRecord, objectKeyFor } from '../scripts/materialize-revosax-baseline.mjs';

const entry = {
  sourceId: '90001.1',
  revosaxLawId: '90001',
  versionSuffix: '1',
  versionNumber: '1',
  category: 'VO',
  inferredType: 'verordnung',
  sourceUrl: 'https://www.revosax.sachsen.de/vorschrift/90001.1',
  retrievedAt: '2026-09-03T12:00:00.000Z',
  sourceSha256: 'a'.repeat(64),
  listing: { label: 'Sächsische Beispielpauschalenverordnung' },
};

// Der Materializer passt immer den unveränderten Parse (original) mit dem aktuellen
// Adapter an; ein gespeichertes „adapted“ aus dem Staging wird nicht verwendet.
const parsed = {
  original: {
    sourceTitle: 'Verordnung des Sächsischen Staatsministeriums für Beispielwesen über die Gewährung einer Beispielpauschale',
    shortTitle: 'Sächsische Beispielpauschalenverordnung',
    abbr: 'SächsBspPauschVO',
    fullCitation: 'Sächsische Beispielpauschalenverordnung vom 27. September 2023 (SächsGVBl. S. 9001), die durch die Verordnung vom 1. August 2024 (SächsGVBl. S. 9002) geändert worden ist',
    fsnNumber: '230-99.9',
    documentDate: '2023-09-27',
    sourceValidFrom: '2023-10-31',
    sourceValidTo: '2024-08-16',
    sourceNotes: [{ label: '1', text: '§ 1 geändert durch Verordnung vom 1. August 2024 (SächsGVBl. S. 9002)' }],
    body: [{ type: 'paragraph', label: '§ 1', title: 'Pauschale', children: [{ type: 'paragraphText', text: 'Der Freistaat Sachsen gewährt nach dem SächsBspGHG eine Pauschale.' }] }],
  },
  adapted: { sourceTitle: 'VERALTET – darf nicht verwendet werden', body: [] },
};

const objectRecord = { sha256: 'a'.repeat(64), url: 'https://www.revosax.sachsen.de/vorschrift/90001.1' };

test('Ausgangsfassung wird mit R2-Provenienz, historischer Zitierung und Stichtagsfassung materialisiert', () => {
  const record = buildBaselineRecord({ entry, parsed, slug: 'ostdeutsche-beispielpauschalenverordnung', objectRecord });
  assert.equal(record.meta.slug, 'ostdeutsche-beispielpauschalenverordnung');
  assert.equal(record.meta.type, 'verordnung');
  assert.equal(record.meta.status, 'in-force');
  assert.equal(record.meta.shortTitle, 'Ostdeutsche Beispielpauschalenverordnung');
  assert.equal(record.meta.abbr, 'OstBspPauschVO');
  assert.equal(record.meta.documentDate, '2023-09-27');
  assert.equal(record.meta.effectiveDate, undefined);
  assert.equal(record.meta.enactingBody, undefined);
  // Ursprungsorgan als Provenienz, nicht als Erlassorgan der ostdeutschen Norm.
  assert.equal(record.meta.originEnactingBody, undefined); // das Beispielministerium ist nicht in der ableitbaren Organliste
  assert.equal(record.version.body[0].children[0].text, 'Der Freistaat Ostdeutschland gewährt nach dem OstBspGHG eine Pauschale.');
  assert.match(record.version.changeNote, /^Ausgangsfassung zum Rechtsüberleitungsstichtag 2023-11-01/u);
  assert.doesNotMatch(record.version.changeNote, /sächsisch/iu);
  // Sachgebiet aus der amtlichen Gliederungsnummer der Quellseite (230 → Untergruppe 23).
  assert.deepEqual(record.meta.subjects, ['Kommunalrecht']);
  assert.equal(record.meta.primarySubject, 'Kommunalrecht');
  // Schlagwort ist allein die amtliche Bezeichnung der Trefferliste, und nur wenn sie sich von
  // Titel, Kurzbezeichnung und Abkürzung unterscheidet. Hier ist sie die Abkürzung — die steht
  // als eigene Spalte im Volltextindex und wird nicht wiederholt.
  assert.deepEqual(record.meta.keywords, []);
  // Spätere sächsische Änderung wird aus dem Seiten-Vollzitat entfernt; die Fundstelle bleibt historisch.
  assert.equal(record.meta.initialCitation, 'Ostdeutsche Beispielpauschalenverordnung vom 27. September 2023 (SächsGVBl. S. 9001)');
  assert.equal(record.version.versionId, '2023-11-01');
  assert.equal(record.version.validFrom, '2023-11-01');
  assert.equal(record.version.validTo, null);
  assert.equal(record.version.citation, record.meta.initialCitation);
  assert.deepEqual(record.version.sourceNotes, parsed.original.sourceNotes);
  assert.equal(record.history.initialVersionId, '2023-11-01');
  const source = record.version.sourceReferences[0];
  assert.equal(source.availability, 'r2-archived');
  assert.equal(source.objectKey, 'revosax/2023-11-01/90001.1.html');
  assert.equal(source.localSource, undefined);
  assert.equal(source.sourceRole, 'official-snapshot');
  assert.equal(source.retrievedAt, '2026-09-03');
  assert.equal(source.sourceValidTo, '2024-08-16');
  // Die Fundstellennummer bleibt als Provenienz erhalten, damit die Zuordnung ohne Rohcache nachvollziehbar ist.
  assert.equal(source.fsnNumber, '230-99.9');
  assert.equal(objectKeyFor('2023-11-01', '90002'), 'revosax/2023-11-01/90002.html');
});

test('Änderungsvorschriften bleiben eigenständige Rechtsakte mit historischem Wirksamkeitsdatum', () => {
  const amendment = buildBaselineRecord({
    entry: { ...entry, sourceId: '90003', versionSuffix: null, versionNumber: '1', category: 'ÄVO', inferredType: 'aenderungsvorschrift', sourceUrl: 'https://www.revosax.sachsen.de/vorschrift/90003', listing: { label: 'Änd. der Beispiel-Qualifizierungsverordnung' } },
    parsed: { original: { ...parsed.original, shortTitle: 'Änd. der Beispiel-Qualifizierungsverordnung', abbr: undefined, sourceTitle: 'Änderung der Beispiel-Qualifizierungsverordnung', fullCitation: 'Verordnung vom 11. Oktober 2023 (SächsGVBl. S. 9003)' } },
    slug: 'aend-der-beispiel-qualifizierungsverordnung',
    objectRecord: { ...objectRecord, url: 'https://www.revosax.sachsen.de/vorschrift/90003' },
  });
  assert.equal(amendment.meta.type, 'aenderungsvorschrift');
  assert.equal(amendment.meta.status, 'one-time-act');
  assert.equal(amendment.meta.effectiveDate, '2023-10-31');
  assert.equal(amendment.meta.abbr, undefined);
  // Der Massenimport schreibt keine Kurzfassung mehr: eine Formel, die den Titel wiederholt,
  // beschreibt keinen Regelungsgegenstand (data/recht/norm-summary-review.json führt den Vorrat).
  assert.equal(amendment.meta.summary, undefined);
  assert.equal(amendment.meta.summarySource, undefined);
  assert.equal(amendment.meta.affectedNorms, undefined);
});

test('fehlende oder abweichende R2-Archivierung und Sachsen-Reststellen blockieren die Materialisierung', () => {
  assert.throws(() => buildBaselineRecord({ entry, parsed, slug: 'x', objectRecord: undefined }), /nicht im R2-Manifest archiviert/u);
  assert.throws(() => buildBaselineRecord({ entry, parsed, slug: 'x', objectRecord: { ...objectRecord, sha256: 'b'.repeat(64) } }), /SHA-256 im R2-Manifest weicht/u);
  assert.throws(() => buildBaselineRecord({ entry, parsed, slug: 'x', objectRecord: { ...objectRecord, url: 'https://www.revosax.sachsen.de/vorschrift/90001.2' } }), /amtliche URL im R2-Manifest/u);
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
  assert.equal(law.meta.summary, undefined);
});

test('Erlassdatum stammt ersatzweise aus der amtlichen Trefferliste, und das Ursprungsorgan ist Provenienz', () => {
  const record = buildBaselineRecord({
    entry: { ...entry, sourceId: '90005', versionSuffix: null, category: 'G', inferredType: 'gesetz', sourceUrl: 'https://www.revosax.sachsen.de/vorschrift/90005', listing: { label: 'Sächsisches Testgesetz', documentDate: '2023-06-30' } },
    parsed: { original: { ...parsed.original, documentDate: null, sourceTitle: 'Sächsisches Testgesetz', shortTitle: 'Sächsisches Testgesetz', abbr: 'SächsTestG', fullCitation: 'Sächsisches Testgesetz vom 30. Juni 2023 (SächsGVBl. S. 1)' } },
    slug: 'ostdeutsches-testgesetz',
    objectRecord: { sha256: 'a'.repeat(64), url: 'https://www.revosax.sachsen.de/vorschrift/90005' },
  });
  assert.equal(record.meta.documentDate, '2023-06-30');
  assert.equal(record.meta.originEnactingBody, 'Sächsischer Landtag');
  assert.equal(record.meta.enactingBody, undefined);
  assert.equal(record.meta.title, 'Ostdeutsches Testgesetz');
});

test('ein Artikel einer Mantelvorschrift wird als eigene Änderungsvorschrift mit beiden Quellen materialisiert', () => {
  const componentEntry = {
    sourceId: '90006', revosaxLawId: '90006', versionSuffix: null, category: 'ÄG', inferredType: 'aenderungsvorschrift',
    sourceUrl: 'https://www.revosax.sachsen.de/vorschrift/90006', retrievedAt: '2026-09-03T12:00:00.000Z', sourceSha256: 'b'.repeat(64),
    listing: { label: 'Änd. SächsBspVG', title: 'Änderung des Sächsischen Beispielvertretungsgesetzes', documentDate: '2004-05-05', validFrom: '2004-05-15' },
  };
  const component = {
    sourceId: '90006', lawId: '90006', envelopeLawId: '90007', envelopeTitle: 'Sächsisches Beispielmodernisierungsgesetz', anchor: 'a44',
    sourceTitle: 'Änderung des Sächsischen Beispielvertretungsgesetzes',
    sourceCitation: 'Änderung des Sächsischen Beispielvertretungsgesetzes vom 5. Mai 2004 (SächsGVBl. S. 9006, 9010)',
    articleLabel: 'Artikel 44', articleBlockPath: [1], class: 'A',
  };
  const envelopeSource = { objectKey: 'revosax/2023-11-01/90007.html', sha256: 'c'.repeat(64), url: 'https://www.revosax.sachsen.de/vorschrift/90007', retrievedAt: '2026-09-03T12:00:00.000Z', sourceValidFrom: '2004-05-15', sourceValidTo: null };
  const envelopeBody = [
    { type: 'paragraphText', text: 'Der Sächsische Landtag hat beschlossen:' },
    { type: 'article', label: 'Artikel 44', title: 'Änderung des Sächsischen Beispielvertretungsgesetzes', children: [{ type: 'paragraphText', text: 'Das Sächsische Beispielvertretungsgesetz (SächsBspVG) wird geändert.' }] },
  ];
  const record = buildEnvelopeComponentRecord({
    entry: componentEntry, component, envelopeSource, envelopeBody, slug: 'aend-ostbspvg', containedIn: 'ostdeutsches-beispielmodernisierungsgesetz',
    objectRecords: { 'revosax/2023-11-01/90006.html': { sha256: 'b'.repeat(64) }, 'revosax/2023-11-01/90007.html': { sha256: 'c'.repeat(64) } },
  });
  assert.equal(record.meta.type, 'aenderungsvorschrift');
  assert.equal(record.meta.status, 'one-time-act');
  assert.equal(record.meta.title, 'Änderung des Ostdeutschen Beispielvertretungsgesetzes');
  // Abkürzungsartige Trefferlistenbezeichnungen sind keine Kurzbezeichnung, bleiben aber auffindbar.
  assert.equal(record.meta.shortTitle, undefined);
  assert.deepEqual(record.meta.keywords, ['Änd. OstBspVG']);
  assert.equal(record.meta.summarySource, undefined);
  assert.equal(record.meta.containedIn, 'ostdeutsches-beispielmodernisierungsgesetz');
  assert.equal(record.meta.documentDate, '2004-05-05');
  assert.equal(record.meta.effectiveDate, '2004-05-15');
  assert.equal(record.meta.originEnactingBody, 'Sächsischer Landtag');
  assert.equal(record.meta.initialCitation, 'Änderung des Ostdeutschen Beispielvertretungsgesetzes vom 5. Mai 2004 (SächsGVBl. S. 9006, 9010)');
  assert.equal(record.version.body.length, 1);
  assert.equal(record.version.body[0].label, 'Artikel 44');
  assert.equal(record.version.body[0].children[0].text, 'Das Ostdeutsche Beispielvertretungsgesetz (OstBspVG) wird geändert.');
  const [own, envelope] = record.version.sourceReferences;
  assert.equal(own.sourceRole, 'official-snapshot');
  assert.equal(own.lawId, '90006');
  assert.equal(envelope.sourceRole, 'envelope-snapshot');
  assert.equal(envelope.lawId, '90007');
  assert.equal(envelope.url, 'https://www.revosax.sachsen.de/vorschrift/90007#a44');
  assert.throws(() => buildEnvelopeComponentRecord({ entry: componentEntry, component, envelopeSource, envelopeBody, slug: 'x', containedIn: null, objectRecords: {} }), /nicht im R2-Manifest/u);
});

test('Befristungsentscheidungen modellieren das Außerkrafttreten aus dem übernommenen Text', () => {
  // Synthetischer Bestand: keine reale Norm, fiktive Daten und Gliederung.
  const slug = 'beispielrichtlinie';
  const sunsetEntry = { ...entry, listing: { label: 'Beispielrichtlinie' } };
  const basis = 'Sie tritt am Tage nach ihrer Veröffentlichung in Kraft und mit Ablauf des 30. Juni 2025 außer Kraft.';
  const sunsetParsed = {
    ...parsed,
    original: {
      ...parsed.original,
      sourceTitle: 'Richtlinie über ein Beispielverfahren',
      shortTitle: 'Beispielrichtlinie',
      abbr: undefined,
      fullCitation: 'Beispielrichtlinie vom 1. Oktober 2023',
      body: [{ type: 'section', label: 'Ziffer 9', title: 'Inkrafttreten', children: [{ type: 'paragraphText', text: basis }] }],
    },
  };
  const build = (sunset, buildSlug = slug) => buildBaselineRecord({ entry: sunsetEntry, parsed: sunsetParsed, slug: buildSlug, objectRecord, sunset });

  const past = build({ resolution: 'sunset-applies', expiryDate: '2025-06-30', status: 'repealed', basis, basisLocation: 'Ziffer 9' });
  assert.equal(past.meta.status, 'repealed');
  assert.equal(past.meta.expiryDate, '2025-06-30');
  assert.equal(past.version.validTo, '2025-06-30');
  assert.equal(past.version.isCurrent, false);
  assert.equal(past.history.entries.length, 2);
  assert.equal(past.history.entries[1].type, 'repeal');
  // „mit Ablauf des <Datum>“: letzter Geltungstag ist das Datum, die Historie steht am Folgetag.
  assert.equal(past.history.entries[1].date, '2025-07-01');
  assert.equal(past.history.entries[1].affectingVersionId, null);
  assert.match(past.history.entries[1].note ?? '', /Befristung nach Ziffer 9 der übernommenen Fassung: „Sie tritt am Tage nach ihrer Veröffentlichung in Kraft und mit Ablauf des 30\. Juni 2025 außer Kraft\.“/u);

  const future = build({ resolution: 'sunset-applies', expiryDate: '2030-12-31', status: 'in-force', basis: 'Sie tritt mit Ablauf des 31. Dezember 2030 außer Kraft.', basisLocation: 'Ziffer 10' });
  assert.equal(future.meta.status, 'in-force');
  assert.equal(future.meta.expiryDate, '2030-12-31');
  assert.equal(future.version.validTo, '2030-12-31');
  assert.equal(future.version.isCurrent, true);
  assert.match(future.history.entries[1].title, /^Tritt durch Befristung/u);
  assert.equal(future.history.entries[1].date, '2031-01-01');

  // „tritt am <Datum> außer Kraft“: letzter Geltungstag ist der Vortag, der Historieneintrag steht
  // am genannten Datum; ein Gleichtagsdatum widerspricht der Regel.
  const onDayBasis = 'Diese Richtlinie tritt am 1. Juli 2025 außer Kraft.';
  const onDay = build({ resolution: 'sunset-applies', ceasesOn: '2025-07-01', expiryDate: '2025-06-30', status: 'repealed', basis: onDayBasis, basisLocation: 'Ziffer 11' });
  assert.equal(onDay.meta.expiryDate, '2025-06-30');
  assert.equal(onDay.version.validTo, '2025-06-30');
  assert.equal(onDay.history.entries[1].date, '2025-07-01');
  assert.throws(() => build({ resolution: 'sunset-applies', expiryDate: '2025-07-01', status: 'repealed', basis: onDayBasis }, 'x'), /verlangt ceasesOn 2025-07-01 und expiryDate 2025-06-30/u);

  // Offene Fälle bleiben unverändert; ungültige Entscheidungen scheitern.
  const open = build({ resolution: 'open', basis });
  assert.equal(open.meta.status, 'in-force');
  assert.equal(open.version.validTo, null);
  assert.equal(open.history.entries.length, 1);
  assert.throws(() => build({ resolution: 'sunset-applies', expiryDate: '2023-10-01', status: 'repealed', basis }, 'x'), /vor dem Beginn der Ausgangsfassung/u);
  assert.throws(() => build({ resolution: 'sunset-applies', expiryDate: '2025-06-30', status: 'historical', basis }, 'x'), /unzulässigem Status/u);
});
