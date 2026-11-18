import assert from 'node:assert/strict';
import test from 'node:test';

import { countNoun, formatCount, formatNormCount } from '../apps/recht/src/lib/counts.ts';
import {
  describeChange,
  displayChangeNote,
  displayHistoryNote,
  displayHistoryTitle,
  citationReference,
  futureHistoryTypeLabel,
  historyCitationLabel,
  historyEffectiveDate,
  historyNoteSlug,
  historyTypeLabel,
  isPlaceholderHistoryTitle,
  isSunsetEntry,
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

test('Wirksam ist bei Stammfassung und Änderung der Geltungsbeginn der entstandenen Fassung', () => {
  // Stammfassung vom Tag der Ausfertigung, in Kraft erst zehn Tage nach der Verkündung.
  assert.equal(historyEffectiveDate({ date: '2026-02-02', type: 'initial' }, { validFrom: '2026-02-13' }), '2026-02-13');
  // Rückwirkendes Inkrafttreten.
  assert.equal(historyEffectiveDate({ date: '2026-02-02', type: 'initial' }, { validFrom: '2025-01-01' }), '2025-01-01');
  assert.equal(historyEffectiveDate({ date: '2026-03-01', type: 'amendment' }, { validFrom: '2026-03-01' }), '2026-03-01');
  // Hinweise (Berichtigungen) erzeugen keinen neuen Wirksamkeitstag und behalten ihr Datum.
  assert.equal(historyEffectiveDate({ date: '2026-04-04', type: 'notice' }, { validFrom: '2026-02-13' }), '2026-04-04');
  // Ohne Fassung bleibt das Eintragsdatum.
  assert.equal(historyEffectiveDate({ date: '2026-05-05', type: 'repeal' }, undefined), '2026-05-05');
});

test('die Fundstelle einer Protokollzeile nennt bei Änderungen die ändernde Vorschrift', () => {
  const consolidated = 'Testgesetz in der Fassung der Bekanntmachung vom 1. Mai 2010 (TBl. S. 10), das zuletzt durch Artikel 2 des Gesetzes vom 3. Juni 2020 (TBl. S. 99) geändert worden ist';
  assert.equal(historyCitationLabel({ type: 'notice', citation: consolidated }), 'TBl. S. 99');
  assert.equal(historyCitationLabel({ type: 'amendment', citation: consolidated }), 'TBl. S. 99');
  assert.equal(historyCitationLabel({ type: 'initial', citation: consolidated }), 'TBl. S. 10');
  assert.equal(historyCitationLabel({ type: 'repeal', citation: consolidated }), 'TBl. S. 10');
  assert.equal(historyCitationLabel({ type: 'amendment', citation: 'Gesetz vom 1. Juli 2026 (TBl. 2026 Nr. 3)' }), 'TBl. 2026 Nr. 3');
  assert.equal(historyCitationLabel({ type: 'notice', citation: 'Testgesetz vom 1. Juli 2026' }), 'Testgesetz vom 1. Juli 2026');
});

test('ein Außerkrafttreten durch Befristung heißt nicht Aufhebung und nennt die Fundstelle der befristenden Vorschrift', () => {
  // Befristung im eigenen Text: Vollzitat der Vorschrift selbst; Fundstelle ist die Stammfundstelle,
  // nicht die einer späteren Änderung.
  const own = {
    type: 'repeal',
    title: 'Tritt durch Befristung im übernommenen Text außer Kraft.',
    citation: 'Testgesetz vom 1. Mai 2010 (TBl. S. 10), zuletzt geändert durch Artikel 2 des Gesetzes vom 3. Juni 2026 (TBl. 2026 Nr. 9)',
    relatedNorm: null,
  };
  assert.equal(isSunsetEntry(own), true);
  assert.equal(historyTypeLabel(own), 'Befristung');
  assert.equal(historyCitationLabel(own), 'TBl. S. 10');
  // Befristung durch eine andere Vorschrift ohne Bestandsverweis: deren Fundstelle.
  const external = { type: 'repeal', title: 'Tritt durch Befristung im Text außer Kraft.', citation: 'Testgesetz vom 2. Juni 2026 (TBl. 2026 Nr. 7), Artikel 2 Absatz 2', relatedNorm: null };
  assert.equal(historyTypeLabel(external), 'Befristung');
  assert.equal(historyCitationLabel(external), 'TBl. 2026 Nr. 7');
  // Befristung nur im Hinweis belegt.
  assert.equal(historyTypeLabel({ type: 'repeal', title: 'Mit Ablauf des 31. Mai 2026 außer Kraft getreten.', note: 'Befristung nach der Schlussbestimmung.', relatedNorm: null }), 'Befristung');
  // Aufhebung durch eine andere Vorschrift bleibt Aufhebung, auch ohne Befristung im Titel.
  assert.equal(historyTypeLabel({ type: 'repeal', title: 'Ausdrücklich aufgehoben.', relatedNorm: 'testaufhebungsgesetz' }), 'Aufhebung');
  assert.equal(historyTypeLabel({ type: 'repeal', title: 'Befristung aufgehoben.', relatedNorm: 'testaufhebungsgesetz' }), 'Aufhebung');
  assert.equal(historyTypeLabel({ type: 'amendment', title: 'Befristung verlängert.' }), 'Änderung');
  assert.equal(historyTypeLabel({ type: 'initial', title: 'Stammfassung.' }), 'Stammfassung');
});

test('ein künftiger Eintrag heißt „Noch nicht in Kraft“, eine künftige Befristung bleibt Befristung', () => {
  const sunset = { type: 'repeal', title: 'Tritt durch Befristung im Text außer Kraft.', relatedNorm: null };
  assert.equal(futureHistoryTypeLabel(sunset), 'Befristung (künftig)');
  assert.equal(futureHistoryTypeLabel({ type: 'repeal', title: 'Mit Ablauf des 31. Dezember 2027 außer Kraft.', note: 'Befristung nach der Schlussbestimmung.' }), 'Befristung (künftig)');
  assert.equal(futureHistoryTypeLabel({ type: 'amendment', title: 'Befristung verlängert.' }), 'Noch nicht in Kraft');
  assert.equal(futureHistoryTypeLabel({ type: 'initial', title: 'Stammfassung.' }), 'Noch nicht in Kraft');
  assert.equal(futureHistoryTypeLabel({ type: 'repeal', title: 'Befristung aufgehoben.', relatedNorm: 'testaufhebungsgesetz' }), 'Noch nicht in Kraft');
});

test('Klammern mit Titel oder Kurzbezeichnung gelten nicht als Fundstelle', () => {
  // Kurzbezeichnung, Gliederungsangabe und Titel vor der eigentlichen Fundstelle.
  assert.equal(historyCitationLabel({ type: 'initial', citation: 'Testgesetz (TestG) vom 1. Juli 2026 (TBl. S. 12)' }), 'TBl. S. 12');
  assert.equal(historyCitationLabel({ type: 'repeal', citation: 'Testvorschrift zum Siebten Abschnitt (Siebter Abschnitt) vom 2. Mai 2010 (TABl. 2010 S. 4)' }), 'TABl. 2010 S. 4');
  assert.equal(citationReference('Testverordnung (TGB IX) vom 3. März 2026 (TGVBl. 2026 Nr. 7)'), 'TGVBl. 2026 Nr. 7');
  assert.equal(citationReference('Testerlass vom 4. April 2026 (amtliche Einzelverkündung)'), 'amtliche Einzelverkündung');
  // Eine Klammer im zitierten Titel („…“) ist keine Fundstelle, auch wenn sie eine Nummer trägt.
  assert.equal(citationReference('Änderung der Testvorschrift „Testausstattung (Testrundschreiben Nr. 4/2006)“ vom 2. März 2012 (TABl. S. 291, 292)'), 'TABl. S. 291, 292');
  // Bei Änderungen die letzte Fundstelle, auch wenn danach noch eine Kurzbezeichnung steht.
  assert.equal(citationReference('Testgesetz vom 1. Mai 2010 (TBl. S. 10), geändert durch Gesetz vom 3. Juni 2020 (TBl. S. 99) (Teständerungsgesetz)', 'last'), 'TBl. S. 99');
  // Nur Klammern ohne Fundstelle: keine Fundstelle statt eines Titels.
  assert.equal(historyCitationLabel({ type: 'initial', citation: 'Testgesetz (TestG) vom 1. Juli 2026' }), '');
  assert.equal(citationReference(''), '');
});

test('Hinweise zeigen die bezeichnete Vorschrift statt ihres Bestandsschlüssels', () => {
  const labels = new Map([['testgesetz-zur-neuordnung-der-testfaelle', 'Testneuordnungsgesetz']]);
  const labelOf = (slug: string) => labels.get(slug);
  const note = 'testgesetz-zur-neuordnung-der-testfaelle, Artikel 1 Einleitungssatz';
  assert.equal(historyNoteSlug(note), 'testgesetz-zur-neuordnung-der-testfaelle');
  assert.deepEqual(displayHistoryNote(note, labelOf), {
    text: 'Beleg: Testneuordnungsgesetz, Artikel 1 Einleitungssatz',
    relatedSlug: 'testgesetz-zur-neuordnung-der-testfaelle',
    relatedLabel: 'Testneuordnungsgesetz',
    provision: 'Artikel 1 Einleitungssatz',
  });
  // Nicht auflösbarer Schlüssel: nur der Fundort, nie der Schlüssel.
  const unresolved = displayHistoryNote('unbekanntes-testgesetz-x1y2, Artikel 4', labelOf);
  assert.equal(unresolved?.text, 'Beleg in der ändernden Vorschrift: Artikel 4');
  assert.equal(unresolved?.relatedSlug, undefined);
  // Freier Text bleibt; ein Ablageort der Redaktionsentscheidung entfällt.
  assert.deepEqual(displayHistoryNote('Berichtigung der Überschrift.', labelOf), { text: 'Berichtigung der Überschrift.' });
  assert.equal(historyNoteSlug('Berichtigung der Überschrift.'), undefined);
  assert.deepEqual(
    displayHistoryNote('Befristung nach § 9 der übernommenen Fassung: „Sie tritt mit Ablauf des 1. Mai 2030 außer Kraft.“ Entscheidung dokumentiert in daten/test-entscheidungen.json.', labelOf),
    { text: 'Befristung nach § 9 der übernommenen Fassung: „Sie tritt mit Ablauf des 1. Mai 2030 außer Kraft.“' },
  );
  assert.equal(displayHistoryNote('', labelOf), undefined);
});

test('ein Bestandsschlüssel aus einem Wort gilt nur, wenn er eine vorhandene Vorschrift bezeichnet', () => {
  const labels = new Map([['testneuordnungsgesetz', 'Testneuordnungsgesetz']]);
  const labelOf = (slug: string) => labels.get(slug);
  const note = 'testneuordnungsgesetz, Artikel 11';
  assert.equal(historyNoteSlug(note), 'testneuordnungsgesetz');
  assert.deepEqual(displayHistoryNote(note, labelOf), {
    text: 'Beleg: Testneuordnungsgesetz, Artikel 11',
    relatedSlug: 'testneuordnungsgesetz',
    relatedLabel: 'Testneuordnungsgesetz',
    provision: 'Artikel 11',
  });
  // Ein Wort, das keine Vorschrift bezeichnet, ist kein Schlüssel: der Hinweis bleibt, wie er ist.
  assert.deepEqual(displayHistoryNote('redaktionell, Artikel 2 berichtigt', labelOf), { text: 'redaktionell, Artikel 2 berichtigt' });
});
