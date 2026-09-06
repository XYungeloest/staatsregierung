import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ABBR_MAX_LENGTH,
  ABBR_MAX_LENGTH_WITHOUT_WHITESPACE,
  abbreviationProblem,
  isAbbreviation,
  isAbbreviationLikeLabel,
  isDerivedSummary,
  isTitleFormulaSummary,
  isTitleInitialism,
  splitParentheticalTitle,
} from '../scripts/lib/norm-title-rules.mjs';

test('eine echte Abkürzung besteht die Regel, Titel- und Kurztitelwiederholungen nicht', () => {
  const identity = { title: 'Gesetz über die Prüfung von Testfällen', shortTitle: 'Testprüfgesetz' };
  assert.equal(abbreviationProblem('TestPrG', identity), null);
  assert.equal(isAbbreviation('TestPrG', identity), true);
  assert.equal(abbreviationProblem('Gesetz über die Prüfung von Testfällen', identity), 'wiederholt den Titel');
  assert.equal(abbreviationProblem('Testprüfgesetz', identity), 'wiederholt den Kurztitel');
  assert.equal(abbreviationProblem(undefined, identity), null);
});

test('Längengrenze: mit Leerzeichen höchstens 20, zusammengeschrieben höchstens 30 Zeichen', () => {
  const identity = { title: 'Verordnung über die Prüfung von Testfällen im Testwesen' };
  assert.equal(ABBR_MAX_LENGTH, 20);
  assert.equal(ABBR_MAX_LENGTH_WITHOUT_WHITESPACE, 30);
  assert.equal(abbreviationProblem('VwV Testwesen Ost', identity), null);
  assert.equal(
    abbreviationProblem('VwV Testwesen Ostdeutschland', identity),
    'ist mit 28 Zeichen länger als 20 Zeichen',
  );
  assert.equal(abbreviationProblem('TestPrüfstellenVO', identity), null);
  assert.equal(
    abbreviationProblem('TestPrüfstellenVerfahrensVerordnung', identity),
    'ist mit 35 Zeichen länger als 30 Zeichen',
  );
});

test('Zeilenumbrüche und unbelegte Kürzel bleiben unzulässig', () => {
  const identity = { title: 'Erlass über das Testzentrum für Testfälle' };
  assert.equal(abbreviationProblem('Erlass Testzentrum\nfür Testfälle', identity), 'enthält einen Zeilenumbruch');
  assert.equal(abbreviationProblem('ZweitVeröffG', { title: 'Gesetz über etwas ganz anderes' }), 'ist nicht durch die Primärquelle belegt');
});

test('Initialenfolgen des Titels sind keine Abkürzung, echte Kürzel bleiben erhalten', () => {
  const title = 'Gesetz über den Testpass für junge Erwachsene im Freistaat Ostdeutschland';
  assert.equal(isTitleInitialism('üTjEFO', title), true);
  assert.equal(abbreviationProblem('üTjEFO', { title }), 'ist nur die Initialenfolge des Titels');
  assert.equal(isTitleInitialism('OstTestG', title), false);
  // Kurzbezeichnungen mit echten Wortteilen sind keine Initialenfolge.
  assert.equal(isTitleInitialism('Testpassgesetz', title), false);
  assert.equal(isTitleInitialism('TG', title), false, 'zu kurz für eine belastbare Erkennung');
});

test('abkürzungsartige Bezeichnungen gehören in die Stichwörter, nicht in den Kurztitel', () => {
  assert.equal(isAbbreviationLikeLabel('Änd. OstTestG'), true);
  assert.equal(isAbbreviationLikeLabel('2. ÄndVO OstTestG'), true);
  assert.equal(isAbbreviationLikeLabel('OstTestG'), true);
  assert.equal(isAbbreviationLikeLabel('Ostdeutsches Testgesetz'), false);
  assert.equal(isAbbreviationLikeLabel('VwV Testwesen'), false);
  assert.equal(isAbbreviationLikeLabel(''), false);
});

test('Formelhafte Zusammenfassungen werden erkannt', () => {
  assert.equal(isDerivedSummary('Enthält die Regelungen der am 1. November 2023 übernommenen Ausgangsfassung „Testgesetz“.'), true);
  assert.equal(isDerivedSummary('Übernommene Änderungsvorschrift des Rechtsbestands zum 1. November 2023: „Änd. OstTestG“.'), true);
  assert.equal(isDerivedSummary('Enthält die Regelungen der amtlichen Ausgangsfassung „Testgesetz“.'), true);
  assert.equal(isDerivedSummary('Regelt die Prüfung von Testfällen und das Verfahren der Prüfstellen.'), false);
  assert.equal(isTitleFormulaSummary('Regelt Ostdeutsches Testgesetz.', 'Ostdeutsches Testgesetz'), true);
  assert.equal(isTitleFormulaSummary('Regelt die Prüfung von Testfällen.', 'Ostdeutsches Testgesetz'), false);
});

test('die Klammerform wird in Langtitel, Kurzbezeichnung und Abkürzung geteilt', () => {
  assert.deepEqual(
    splitParentheticalTitle('Gesetz über die Prüfung von Testfällen (Ostdeutsches Testprüfgesetz – TestPrG)'),
    {
      title: 'Gesetz über die Prüfung von Testfällen',
      shortTitle: 'Ostdeutsches Testprüfgesetz',
      abbr: 'TestPrG',
      separator: 'dash',
    },
  );
  assert.deepEqual(
    splitParentheticalTitle('Gesetz über die Prüfung von Testfällen (TestPrG)'),
    { title: 'Gesetz über die Prüfung von Testfällen', abbr: 'TestPrG', separator: 'single' },
  );
  assert.deepEqual(
    splitParentheticalTitle('Förderrichtlinie Testförderung (2014–2020)'),
    { title: 'Förderrichtlinie Testförderung (2014–2020)', separator: null },
  );
  assert.deepEqual(
    splitParentheticalTitle('Ostdeutsches Testgesetz'),
    { title: 'Ostdeutsches Testgesetz', separator: null },
  );
});
