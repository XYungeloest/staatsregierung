import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPublicationExtent } from '../apps/recht/src/lib/publication-extent.ts';

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
