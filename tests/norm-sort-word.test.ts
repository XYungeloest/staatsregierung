import assert from 'node:assert/strict';
import test from 'node:test';

import { getNormSortKey, getNormSortWord } from '@ostrecht/shared/lib/norms/presentation.ts';
import { getGermanIndexLetter } from '@ostrecht/shared/lib/norms/routes.ts';

/**
 * Ordnungswort: das erste inhaltstragende Wort einer Bezeichnung. Geprüft wird die Textlogik an
 * erfundenen Bezeichnungen – keine Vorschrift des Bestands kommt hier vor; Aussagen über den
 * ganzen Bestand trifft tests/corpus/norm-sort-word-distribution.test.ts.
 */

const word = (title: string, shortTitle?: string): string => getNormSortWord({ title, shortTitle });

test('die Gattungsbezeichnung, Präposition und Artikel entfallen', () => {
  assert.equal(word('Gesetz über die Musterbehörde'), 'Musterbehörde');
  assert.equal(word('Gesetz gegen missbräuchliche Musteranträge'), 'missbräuchliche Musteranträge');
  assert.equal(word('Verordnung zur Musterprüfung'), 'Musterprüfung');
  assert.equal(word('Verwaltungsvorschrift über den Musterdienst'), 'Musterdienst');
  assert.equal(word('Bekanntmachung der Musterliste'), 'Musterliste');
  assert.equal(word('Allgemeinverfügung zum Musterbetrieb'), 'Musterbetrieb');
});

test('ein Kurztitel geht dem Langtitel vor', () => {
  assert.equal(word('Gesetz über die Ordnung des Musterwesens', 'Musterordnungsgesetz'), 'Musterordnungsgesetz');
  // Ein Kurztitel, der dem Langtitel entspricht, bleibt außer Betracht.
  assert.equal(word('Gesetz über das Musterwesen', 'Gesetz über das Musterwesen'), 'Musterwesen');
});

test('Ordnungszahlen und Abkürzungen der Rechtsform entfallen', () => {
  assert.equal(word('Zweite Verordnung zur Änderung der Musterverordnung'), 'Änderung der Musterverordnung');
  assert.equal(word('3. Verordnung über Musterfälle'), 'Musterfälle');
  assert.equal(word('VwV Musterwesen'), 'Musterwesen');
  assert.equal(word('VwV-Musterrechte'), 'Musterrechte');
  assert.equal(word('RL Musterbus'), 'Musterbus');
  assert.equal(word('FRL überörtlicher Musterbedarf'), 'überörtlicher Musterbedarf');
  // Nach der Abkürzung wirkt die Präpositionsregel weiter.
  assert.equal(word('VwV zur MusterA und MusterB'), 'MusterA und MusterB');
});

test('die erlassende Stelle entfällt bis zum Regelungsgegenstand', () => {
  assert.equal(word('Verordnung der Ostdeutschen Staatsregierung über die Anerkennung von Musterstellen'), 'Anerkennung von Musterstellen');
  assert.equal(word('Verwaltungsvorschrift des Ostdeutschen Staatsministeriums der Finanzen zur Gewährung von Mustervorschüssen'), 'Gewährung von Mustervorschüssen');
  assert.equal(word('Verwaltungsvorschrift des Ostdeutschen Staatsministeriums für Kultus über Musterbereiche'), 'Musterbereiche');
  assert.equal(word('Verordnung des Regierungspräsidiums Musterstadt zur Festsetzung des Musterschutzgebiets'), 'Festsetzung des Musterschutzgebiets');
  // Ministeriumsnamen enthalten selbst „für“ und „und“; nur „für den/die/das“ beendet die Angabe.
  assert.equal(word('Verwaltungsvorschrift des Ostdeutschen Staatsministeriums für Soziales, Gesundheit und Familie für den Betrieb von Mustereinrichtungen'), 'Betrieb von Mustereinrichtungen');
  // Fehlt ein Fügewort, trägt der Gedankenstrich die Trennung.
  assert.equal(word('Verwaltungsvorschrift des Ostdeutschen Staatsministeriums der Finanzen – Gleich lautender Erlass – Mustersteuer bei Pauschalierung'), 'Mustersteuer bei Pauschalierung');
  // Schreibfehler in der amtlichen Quelle brechen die Regel nicht.
  assert.equal(word('Verordnung des Ostdeutsches Staatsministeriums des Innern über Mustergebühren'), 'Mustergebühren');
});

test('Landesadjektive entfallen, zusammengesetzte Bezeichnungen bleiben', () => {
  assert.equal(word('Ostdeutsches Mustergesetz'), 'Mustergesetz');
  assert.equal(word('Sächsische Musterverordnung'), 'Musterverordnung');
  assert.equal(word('Ostdeutsches Gesetz zur Ausführung des Mustergesetzes'), 'Ausführung des Mustergesetzes');
  // Ohne Leerzeichen ist „Ostdeutsche“ Teil des Wortes und bleibt stehen.
  assert.equal(word('Ostdeutsche-Muster-Gesetz'), 'Ostdeutsche-Muster-Gesetz');
});

test('die Rechtsform entfällt nur einmal; ein Vertragsname bleibt erhalten', () => {
  assert.equal(word('Gesetz zu dem Staatsvertrag über das Musterwesen'), 'Staatsvertrag über das Musterwesen');
});

test('Anführungszeichen, Ziffern und Sonderzeichen', () => {
  assert.equal(word('Bekanntmachung über die Verleihung der „Mustermedaille“'), 'Verleihung der „Mustermedaille“');
  assert.equal(word('„Musterprogramm“ des Freistaates'), 'Musterprogramm“ des Freistaates');
  assert.equal(getGermanIndexLetter(word('ÖPNV-Mustergesetz')), 'O');
});

test('bleibt nichts übrig, gilt der Titel', () => {
  assert.equal(word('Verordnung'), 'Verordnung');
  assert.equal(word('Gesetz'), 'Gesetz');
  assert.equal(word(''), '');
});

test('der Vergleichsschlüssel löst Umlaute auf und schreibt klein', () => {
  assert.equal(getNormSortKey({ title: 'Ostdeutsches Ärztegesetz' }), 'arztegesetz');
  assert.equal(getNormSortKey({ title: 'Gesetz über die Straßenmaße' }), 'strassenmasse');
  assert.equal(getNormSortKey({ title: 'Bekanntmachung über die Verleihung der „Mustermedaille“' }), 'verleihung der mustermedaille');
  // Der Schlüssel sortiert Umlaute in ihre Buchstabengruppe; die Anzeige behält sie.
  const keys = ['Ostdeutsches Ärztegesetz', 'Ostdeutsches Amtsgesetz', 'Ostdeutsches Bahngesetz']
    .map((title) => getNormSortKey({ title }))
    .sort();
  assert.deepEqual(keys, ['amtsgesetz', 'arztegesetz', 'bahngesetz']);
});
