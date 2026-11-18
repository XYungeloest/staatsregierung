import assert from 'node:assert/strict';
import test from 'node:test';

import { formatIssuePageRange, formatPublicationExtent } from '../apps/recht/src/lib/publication-extent.ts';

/** Umfang einer Verkündungsausgabe: höchste Endseite aller Einträge, sonst Zahl der Einträge. */
test('der Umfang einer Ausgabe ist die höchste Endseite, sonst die Zahl der Einträge', () => {
  const entry = (pages?: string, startPage?: string) => ({ id: 'x', title: 'T', type: 'gesetz', citation: 'c', ...(pages ? { pages } : {}), ...(startPage ? { startPage } : {}) });
  assert.equal(formatPublicationExtent({ entries: [entry('2–5'), entry('6–12')] as never }), '12 Seiten');
  assert.equal(formatPublicationExtent({ entries: [entry(undefined, '3'), entry('S. 4')] as never }), '4 Seiten');
  assert.equal(formatPublicationExtent({ entries: [entry(undefined, '1')] as never }), '1 Seite');
  assert.equal(formatPublicationExtent({ entries: [entry('2–5'), entry()] as never }), '2 Einträge');
  assert.equal(formatPublicationExtent({ entries: [entry()] as never }), '1 Eintrag');
  assert.equal(formatPublicationExtent({ entries: [] }), '');
});

const issueEntry = (pages?: string, startPage?: string) => ({ id: 'x', title: 'T', type: 'gesetz', citation: 'c', ...(pages ? { pages } : {}), ...(startPage ? { startPage } : {}) });
const issueSource = (pageRange: string, kind = 'primary-pdf') => ({ kind, label: 'Quelle', availability: 'versioned', pageRange });

test('der belegte Seitenumfang der Ausgabe geht den Bereichen der Einzelveröffentlichungen vor', () => {
  const publication = { entries: [issueEntry('2-3'), issueEntry('4-30')], sourceReferences: [issueSource('2–30')] } as never;
  assert.equal(formatIssuePageRange(publication), '2–30');
  assert.equal(formatPublicationExtent(publication), '30 Seiten');
  const mantel = { entries: [issueEntry(undefined, '2'), issueEntry(), issueEntry()], sourceReferences: [issueSource('2–19', 'structured-html-transcription')] } as never;
  assert.equal(formatIssuePageRange(mantel), '2–19');
  assert.equal(formatPublicationExtent(mantel), '19 Seiten');
});

test('ohne belegten Umfang reicht die Seitenangabe von der ersten Anfangs- bis zur letzten Endseite', () => {
  assert.equal(formatIssuePageRange({ entries: [issueEntry('2-5'), issueEntry('6-7')] } as never), '2–7');
  assert.equal(formatIssuePageRange({ entries: [issueEntry('2–9'), issueEntry('2–6')] } as never), '2–9');
  assert.equal(formatIssuePageRange({ entries: [issueEntry('3')] } as never), '3');
});

test('eine bloße Anfangsseite erscheint nie als vollständiger Umfang der Ausgabe', () => {
  assert.equal(formatIssuePageRange({ entries: [issueEntry(undefined, '2'), issueEntry()] } as never), 'ab 2');
  assert.equal(formatIssuePageRange({ entries: [issueEntry(), issueEntry()] } as never), undefined);
});
