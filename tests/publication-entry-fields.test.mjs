import assert from 'node:assert/strict';
import test from 'node:test';

import {
  entrySharesIssueSource,
  legacyEntryCitation,
  legacyEntryDocumentDate,
  publicationEntryPageProblems,
  publicationEntryPages,
} from '../scripts/lib/publication-entry-fields.mjs';

test('nur die Mantelvorschrift erhält den Seitenbereich der ganzen Ausgabe', () => {
  assert.equal(publicationEntryPages(0, { issuePageRange: '2–40' }), '2–40');
  assert.equal(publicationEntryPages(1, { issuePageRange: '2–40' }), undefined);
  assert.equal(publicationEntryPages(3, { issuePageRange: '2–40' }), undefined);
});

test('eine eingeführte Stammnorm erhält nur ihren eigens belegten Bereich', () => {
  assert.equal(publicationEntryPages(1, { issuePageRange: '2–40', configuredPages: '2–13' }), '2–13');
  assert.equal(publicationEntryPages(2, { issuePageRange: '2–40', configuredPages: '14–18' }), '14–18');
});

test('ohne Seitenzahl der Ausgabe entsteht auch für die Mantelvorschrift kein Bereich', () => {
  assert.equal(publicationEntryPages(0, {}), undefined);
  assert.equal(publicationEntryPages(0), undefined);
});

test('pauschal mehreren eingeführten Normen zugeordneter Bereich wird erkannt', () => {
  const problems = publicationEntryPageProblems([
    { id: 'mantel', pages: '2–9' },
    { id: 'stammnorm-a', pages: '2–9' },
    { id: 'stammnorm-b', pages: '2-9' },
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /2–9/u);
  assert.match(problems[0], /entries\[1\], entries\[2\]/u);
});

test('belegte, verschiedene Bereiche und ein mit der Mantelvorschrift übereinstimmender erster Artikel sind zulässig', () => {
  assert.deepEqual(publicationEntryPageProblems([
    { id: 'mantel', pages: '2–9' },
    { id: 'stammnorm-a', pages: '2–9' },
  ]), []);
  assert.deepEqual(publicationEntryPageProblems([
    { id: 'mantel', pages: '2–9' },
    { id: 'stammnorm-a', pages: '2–4' },
    { id: 'stammnorm-b', pages: '4–7' },
    { id: 'stammnorm-c' },
    { id: 'stammnorm-d' },
  ]), []);
});

test('gleiche Einzelseiten verschiedener kurzer Vorschriften sind zulässig', () => {
  assert.deepEqual(publicationEntryPageProblems([
    { id: 'mantel', pages: '2–5' },
    { id: 'stammnorm-a', pages: '5' },
    { id: 'stammnorm-b', pages: '5' },
  ]), []);
  assert.deepEqual(publicationEntryPageProblems(undefined), []);
});

const publication = { publication: 'StAnzO.', year: 2030, issue: '7' };
const meta = { type: 'verwaltungsvorschrift', initialCitation: 'Verwaltungsvorschrift (StAnzO. 2030 Nr. 7)' };

test('ein redaktionell offengelassenes Dokumentdatum wird beim erneuten Import nicht ergänzt', () => {
  const previous = { id: 'vwv', citation: 'Verwaltungsvorschrift (StAnzO. 2030 Nr. 7 S. 2)', pages: '2' };
  const documentDate = legacyEntryDocumentDate(previous, undefined, '2030-05-27', '2030-05-27');
  assert.equal(documentDate, undefined);
  assert.equal(legacyEntryCitation(previous, meta, publication, documentDate), 'Verwaltungsvorschrift (StAnzO. 2030 Nr. 7 S. 2)');
});

test('ohne gepflegten Eintrag oder mit gepflegtem Datum gilt die bisherige Reihenfolge', () => {
  assert.equal(legacyEntryDocumentDate(undefined, undefined, '2030-05-27'), '2030-05-27');
  assert.equal(legacyEntryDocumentDate({ documentDate: '2030-05-19' }, '2030-05-20', '2030-05-27'), '2030-05-19');
  assert.equal(legacyEntryDocumentDate({}, '2030-05-20', '2030-05-27'), '2030-05-20');
});

test('eine datierte Zitierung entsteht nur mit feststehendem Dokumentdatum', () => {
  const datedMeta = { type: 'verwaltungsvorschrift', initialCitation: 'Anordnung vom 3. März 2030 (StAnzO. 2030 Nr. 7)' };
  assert.equal(
    legacyEntryCitation({ citation: 'Anordnung vom 3. März 2030 (StAnzO. 2030 Nr. 7 S. 2)' }, datedMeta, publication, '2030-03-03'),
    'Anordnung vom 3. März 2030 (StAnzO. 2030 Nr. 7 S. 2)',
  );
  assert.equal(
    legacyEntryCitation({ citation: 'Anordnung (StAnzO. 2030 Nr. 7 S. 2)', pages: '2' }, datedMeta, publication, '2030-03-03'),
    'Anordnung vom 3. März 2030 (StAnzO. 2030 Nr. 7 S. 2)',
  );
  assert.equal(
    legacyEntryCitation({ startPage: 4 }, meta, publication, undefined),
    'Verwaltungsvorschrift (StAnzO. 2030 Nr. 7 S. 4)',
  );
});

const issueReferences = [
  { kind: 'structured-html-transcription', localSource: 'Gesetze/Blatt 1.html' },
  { kind: 'primary-pdf', localSource: 'Gesetze/Blatt 1.pdf', derivedSource: 'Gesetze/Blatt 1.html' },
];

test('Ausgabe und Norm teilen die strukturtragende Transkription der Ausgabe', () => {
  assert.equal(entrySharesIssueSource(issueReferences, [
    { kind: 'structured-html-transcription', localSource: 'Gesetze/Blatt 1.html' },
  ]), true);
});

test('eine aus dem Original-PDF derselben Ausgabe abgeleitete eigene Transkription genügt', () => {
  assert.equal(entrySharesIssueSource(issueReferences, [
    { kind: 'structured-html-transcription', localSource: 'Gesetze/Stammgesetz.html', derivedSource: 'Gesetze/Blatt 1.pdf' },
  ]), true);
});

test('Transkriptionen anderer Ausgaben und bloße PDF-Verweise genügen nicht', () => {
  assert.equal(entrySharesIssueSource(issueReferences, [
    { kind: 'structured-html-transcription', localSource: 'Gesetze/Blatt 2.html', derivedSource: 'Gesetze/Blatt 2.pdf' },
    { kind: 'amendment-source', localSource: 'Gesetze/Blatt 3.html', derivedSource: 'Gesetze/Blatt 1.pdf' },
  ]), false);
  assert.equal(entrySharesIssueSource(issueReferences, undefined), false);
});
