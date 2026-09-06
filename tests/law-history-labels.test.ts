import assert from 'node:assert/strict';
import test from 'node:test';

import { countNoun, formatCount, formatNormCount } from '../apps/recht/src/lib/counts.ts';
import {
  describeChange,
  displayChangeNote,
  displayHistoryTitle,
  isPlaceholderHistoryTitle,
} from '../apps/recht/src/lib/history-labels.ts';

/**
 * Bezeichnungen der Änderungseinträge und Zählwortlaut. Alle Daten sind erfunden; kein
 * Bestandstitel, keine Bestandsabkürzung, kein Bestandsslug und keine echte Fundstelle.
 */

test('Platzhaltertitel tragen keine Aussage und werden nicht angezeigt', () => {
  for (const title of ['Verkündung.', 'Stammfassung', 'Stammfassung verkündet.', 'Erlass.']) {
    assert.equal(isPlaceholderHistoryTitle(title), true, title);
    assert.equal(displayHistoryTitle(title), undefined, title);
  }
  assert.equal(isPlaceholderHistoryTitle('Verkündung des Testgesetzes.'), false);
});

test('die Herkunftsformel wird mit ausgeschriebenem Datum angezeigt', () => {
  assert.equal(
    displayHistoryTitle('Vollständige Ausgangsfassung zum Rechtsüberleitungsstichtag.'),
    'Übernommene Ausgangsfassung mit Rechtsstand vom 1. November 2023',
  );
  assert.equal(
    displayHistoryTitle('Vollständige Ausgangsfassung zum Rechtsüberleitungsstichtag (Artikel 2 der Mantelvorschrift).'),
    'Übernommene Ausgangsfassung mit Rechtsstand vom 1. November 2023 (Artikel 2 der Mantelvorschrift)',
  );
  assert.equal(
    displayHistoryTitle('Vollständige Ausgangsfassung zum verbindlichen Stichtag.'),
    'Übernommene Ausgangsfassung mit Rechtsstand vom 1. November 2023',
  );
});

test('freier Text bleibt unverändert', () => {
  assert.equal(displayHistoryTitle('Geändert durch Artikel 3 des Testgesetzes.'), 'Geändert durch Artikel 3 des Testgesetzes.');
  assert.equal(displayHistoryTitle(''), undefined);
  assert.equal(displayHistoryTitle(null), undefined);
});

test('der Änderungsstand nennt kein Systemwort und kein maschinenlesbares Datum', () => {
  assert.equal(
    displayChangeNote('Ausgangsfassung zum Rechtsüberleitungsstichtag 2023-11-01: übernommener Rechtsstand dieses Tages.'),
    'Übernommene Ausgangsfassung mit Rechtsstand vom 1. November 2023.',
  );
  assert.equal(
    displayChangeNote('Ausgangsfassung zum Rechtsüberleitungsstichtag 2023-11-01: Artikel 4 der Mantelvorschrift.'),
    'Übernommene Ausgangsfassung mit Rechtsstand vom 1. November 2023: Artikel 4 der Mantelvorschrift.',
  );
  assert.equal(displayChangeNote('Verkündete Fassung.'), 'Verkündete Fassung.');
  assert.equal(displayChangeNote(undefined), '');
});

test('ein Änderungseintrag ohne aussagekräftigen Titel zeigt den Anfang des Vollzitats', () => {
  assert.equal(
    describeChange({ title: 'Verkündung.', citation: 'Testgesetz vom 2. September 2026 (TBl. S. 12)' }),
    'Testgesetz vom 2. September 2026',
  );
  assert.equal(
    describeChange({ title: 'Geändert durch Artikel 1 der Testverordnung.', citation: 'Testverordnung vom 1. Juli 2026 (TBl. S. 3)' }),
    'Geändert durch Artikel 1 der Testverordnung.',
  );
  // Ohne Klammer bleibt das Vollzitat vollständig stehen.
  assert.equal(describeChange({ title: 'Stammfassung.', citation: 'Testgesetz vom 2. September 2026' }), 'Testgesetz vom 2. September 2026');
  assert.equal(describeChange({ title: 'Verkündung.', citation: '' }), '');
});

test('Zähler bilden Einzahl und Mehrzahl', () => {
  assert.equal(formatCount(1, 'Ausgabe', 'Ausgaben'), '1 Ausgabe');
  assert.equal(formatCount(0, 'Ausgabe', 'Ausgaben'), '0 Ausgaben');
  assert.equal(countNoun(1, 'Vorschrift', 'Vorschriften'), 'Vorschrift');
  assert.equal(countNoun(2, 'Vorschrift', 'Vorschriften'), 'Vorschriften');
  assert.equal(formatNormCount(1), '1 Vorschrift');
  assert.equal(formatNormCount(23), '23 Vorschriften');
});
