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
  keywordCore,
  resolveIdentityFields,
  fsnReferenceIndex,
  generatedKeywordProblem,
  isOwnTitleQuotingSummary,
  isPlaceholderSummary,
  isFormulaSummary,
  occursAsThemeWord,
  normBodyText,
  retainFsnNumber,
  splitParentheticalTitle,
  titleWords,
} from '../scripts/lib/norm-title-rules.mjs';

test('eine echte Abkürzung besteht die Regel, Titel- und Kurztitelwiederholungen nicht', () => {
  const identity = { title: 'Gesetz über die Prüfung von Testfällen', shortTitle: 'Testprüfgesetz' };
  assert.equal(abbreviationProblem('TestPrG', identity), null);
  assert.equal(isAbbreviation('TestPrG', identity), true);
  assert.equal(abbreviationProblem('Gesetz über die Prüfung von Testfällen', identity), 'wiederholt den Titel');
  assert.equal(abbreviationProblem('Testprüfgesetz', identity), 'wiederholt den Kurztitel');
  assert.equal(abbreviationProblem(undefined, identity), null);
});

test('ein ausgeschriebenes Wort ist keine Abkürzung, auch nicht als Teil einer Kurzbezeichnung', () => {
  const identity = { title: 'Verwaltungsvorschrift über den Einsatz von Testgeräten im Testwesen', shortTitle: 'VwV Geräte – Testwesen' };
  assert.equal(abbreviationProblem('Testwesen', identity), 'ist ein ausgeschriebenes Wort und keine Abkürzung');
  assert.equal(abbreviationProblem('Prüfung', { title: 'Verordnung über etwas anderes' }), 'ist ein ausgeschriebenes Wort und keine Abkürzung');
  // Echte Kürzel mit mehreren Großbuchstaben oder kurzer Wortform bleiben zulässig.
  assert.equal(abbreviationProblem('TestwesenVO', identity), null);
  assert.equal(abbreviationProblem('Test', identity), null);
  assert.equal(abbreviationProblem('VwV Testwesen', identity), null);
  // Die amtliche Klammerform „Kurzbezeichnung – Wort“ liefert keine Abkürzung.
  assert.equal(resolveIdentityFields({ title: identity.title, abbr: 'Testwesen' }).abbr, undefined);
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

test('Artikel, Präpositionen und Konjunktionen verdecken keine Initialenfolge', () => {
  // Zwölf Titelwörter, davon fünf Funktionswörter: die Folge deckt weniger als die Hälfte aller
  // Wörter, aber mindestens die Hälfte der sieben Sachwörter ab.
  const title = 'Gesetz zur Änderung des Testgesetzes zur Regelung der Prüfstellen im Freistaat Ostdeutschland';
  assert.equal(isTitleInitialism('ÄTRP', title), true);
  assert.equal(abbreviationProblem('ÄTRP', { title }), 'ist nur die Initialenfolge des Titels');
  assert.equal(isTitleInitialism('ÜüTO', 'Gesetz zu dem Übereinkommen über den Testschutz des Ostseeraums'), true);
  // Echte Kürzel aus Wortteilen und kurze Folgen gegenüber langen Sachtiteln bleiben zulässig.
  assert.equal(isTitleInitialism('OstTestG', title), false);
  assert.equal(abbreviationProblem('TestÄndG', { title }), null);
  assert.equal(
    isTitleInitialism('TSO', 'Verordnung des Ostdeutschen Staatsministeriums für Testwesen und des Ostdeutschen Staatsministeriums für Prüfwesen über Testschulen und Prüfstellen im Freistaat Ostdeutschland'),
    false,
  );
});

test('kleingeschriebene Wortanfänge des Titels bilden ebenfalls eine Initialenfolge', () => {
  const title = 'Gesetz zur Einführung besonderer Testregeln für die Testhauptstadt und zur Änderung prüf-, mess- und zählrechtlicher Vorschriften';
  assert.equal(isTitleInitialism('EbTTÄpmzV', title), true);
  assert.equal(abbreviationProblem('EbTTÄpmzV', { title }), 'ist nur die Initialenfolge des Titels');
  // Wortteile mit drei Kleinbuchstaben, die keine Wortanfänge sind, bleiben eine echte Abkürzung.
  assert.equal(isTitleInitialism('TestÄndG', title), false);
  assert.equal(isTitleInitialism('Testpassgesetz', 'Gesetz über den Testpass für junge Erwachsene'), false);
});

test('ein im amtlichen Titel geklammertes Kürzel ist keine Initialenfolge', () => {
  const title = 'Prüfordnung für die Testprüfung im Ausbildungsberuf Kaufmann für Testwesen (PTKfT)';
  assert.equal(isTitleInitialism('PTKfT', title), false);
  assert.equal(abbreviationProblem('PTKfT', { title }), null);
  const dashed = 'Ordnung über die Prüfung im Testberuf Kauffrau für Testwesen (Testprüfungsordnung – PTKfT)';
  assert.equal(abbreviationProblem('PTKfT', { title: dashed }), null);
  // Ohne Klammerzusatz bleibt dieselbe Folge eine aus dem Titel gebildete Initialenfolge.
  const plain = 'Prüfordnung für die Testprüfung im Ausbildungsberuf Kaufmann für Testwesen';
  assert.equal(abbreviationProblem('PTKfT', { title: plain }), 'ist nur die Initialenfolge des Titels');
  // Ein Wortteil mit Bindestrich in der Klammer belegt das Teilkürzel nicht.
  const hyphenated = 'Prüfordnung für die Testprüfung im Ausbildungsberuf Kaufmann für Testwesen (Ost-PTKfT)';
  assert.equal(isTitleInitialism('PTKfT', hyphenated), true);
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

test('das Titelmodell verwirft eine Kurzbezeichnung, die den Titel wiederholt', () => {
  const identity = resolveIdentityFields({
    title: 'Gesetz über die Prüfung von Testfällen',
    shortTitle: 'Gesetz über die Prüfung von Testfällen',
    abbr: 'TestPrG',
  });
  assert.equal(identity.shortTitle, undefined);
  assert.equal(identity.abbr, 'TestPrG');
});

test('das Titelmodell verwirft eine Abkürzung, die den Kurztitel wiederholt', () => {
  const identity = resolveIdentityFields({
    title: 'Verwaltungsvorschrift über die Tätigkeit von Testpersonen an Teststellen',
    shortTitle: 'VwV Testpersonen',
    abbr: 'VwV Testpersonen',
  });
  assert.equal(identity.shortTitle, 'VwV Testpersonen');
  assert.equal(identity.abbr, undefined);
});

test('der gepflegte Langtitel gewinnt gegen die Kurzform der Quellenkonfiguration', () => {
  const gepflegt = 'Gesetz über den Vollzug der Prüfung von Testfällen im Freistaat Ostdeutschland';
  const identity = resolveIdentityFields({ title: gepflegt ?? 'Ostdeutsches Testprüfgesetz' });
  assert.equal(identity.title, gepflegt);
});

test('die Fundstellennummer der amtlichen Quelle überlebt eine neu gebaute Quellenangabe', () => {
  const previous = new Map([['data/recht/sources/revosax/test/1.1.html', {
    kind: 'revosax-snapshot',
    localSource: 'data/recht/sources/revosax/test/1.1.html',
    fsnNumber: '270-7',
  }]]);
  const neu = { kind: 'revosax-snapshot', localSource: 'data/recht/sources/revosax/test/1.1.html' };
  assert.equal(retainFsnNumber(neu, previous).fsnNumber, '270-7');
  assert.equal(retainFsnNumber({ localSource: 'anders.html' }, previous).fsnNumber, undefined);
});

test('die Fundstellennummer überlebt den Wechsel von der archivierten zur versionierten Quelle derselben Vorschrift', () => {
  const archiviert = { kind: 'revosax-snapshot', availability: 'r2-archived', objectKey: 'revosax/1.html', lawId: '1', fsnNumber: '270-7' };
  const neu = { kind: 'revosax-snapshot', localSource: 'data/recht/sources/revosax/test/1.1.html', lawId: '1' };
  assert.equal(retainFsnNumber(neu, fsnReferenceIndex([archiviert])).fsnNumber, '270-7');
  assert.equal(retainFsnNumber({ ...neu, lawId: '2' }, fsnReferenceIndex([archiviert])).fsnNumber, undefined);
  assert.equal(retainFsnNumber({ kind: 'amendment-source', lawId: '1' }, fsnReferenceIndex([archiviert])).fsnNumber, undefined);
  const widerspruch = fsnReferenceIndex([archiviert, { ...archiviert, objectKey: 'revosax/1.2.html', fsnNumber: '270-8' }]);
  assert.equal(retainFsnNumber(neu, widerspruch).fsnNumber, undefined);
});

test('Titelbestandteile ab fünf Zeichen sind keine Schlagwörter', () => {
  const words = titleWords({
    title: 'Verordnung über die Prüfung von Testfällen',
    shortTitle: 'Beispielschulen- und Testkursverordnung',
  });
  assert.equal(words.has('Verordnung'), true);
  assert.equal(words.has('Testfällen'), true);
  assert.equal(words.has('Beispielschulen'), true);
  assert.equal(words.has('über'), false, 'kürzer als fünf Zeichen');
  assert.equal(keywordCore('-Beispielschulen-'), 'Beispielschulen');
});

test('Schlagwörter mit Spuren früherer Erzeuger werden erkannt, belegte Begriffe bleiben', () => {
  const meta = {
    slug: 'verordnung-uber-die-prufung-von-testfallen-im-musterland',
    title: 'Verordnung über die Prüfung von Testfällen im Musterland',
    shortTitle: 'Testfall- und Prüfverordnung',
  };
  const sourceText = normBodyText([
    { type: 'paragraph', label: '§ 1', title: 'Zweck', children: [{ type: 'paragraphText', text: 'Die Prüfstelle fördert die Verwaltung von Testfällen.' }] },
  ]);
  // Bruchstück der Kennung: kleingeschrieben, ohne Umlaut, Glied des Slugs.
  assert.match(generatedKeywordProblem('prufung', meta, sourceText), /Kennung/u);
  // Funktionswort aus dem Titel.
  assert.match(generatedKeywordProblem('über', meta, sourceText), /Funktionswort/u);
  // Bruchstück einer Wortverbindung des Titels, zusammengezogen und mit offenem „und“.
  assert.match(generatedKeywordProblem('Testfallund', meta, sourceText), /Wortverbindung/u);
  assert.match(generatedKeywordProblem('Testfall- und', meta, sourceText), /Wortverbindung/u);
  // Initialenfolge des Titels ohne Beleg im Text; im Text belegt bleibt sie.
  assert.match(generatedKeywordProblem('VüdPvTiM', meta, sourceText), /Initialenfolge/u);
  assert.equal(generatedKeywordProblem('VüdPvTiM', meta, `${sourceText} (VüdPvTiM)`), null);
  // Themenwort des früheren Erzeugers: ohne Bezug entfernt, mit Bezug im Normtext belegt.
  assert.match(generatedKeywordProblem('Nachbarschaft', meta, sourceText), /Themenwort/u);
  assert.equal(generatedKeywordProblem('Verwaltung', meta, sourceText), null);
  // Redaktionelle Begriffe bleiben unberührt.
  assert.equal(generatedKeywordProblem('Prüfstelle', meta, sourceText), null);
  assert.equal(generatedKeywordProblem('freiwillig', meta, sourceText), null);
});

test('Themenwörter gelten auch gebeugt und als Glied eines Kompositums als belegt', () => {
  const meta = { slug: 'gesetz-uber-musterhauser', title: 'Gesetz über Musterhäuser' };
  const sourceText = 'Die Bereitstellung des Wohnraums und der Musterhausvergesellschaftungsbeitrag. Bearbeitung.';
  assert.equal(generatedKeywordProblem('Wohnraum', meta, sourceText), null);
  assert.equal(generatedKeywordProblem('Vergesellschaftung', meta, sourceText), null);
  assert.equal(occursAsThemeWord('Vergesellschaftung', 'Vergesellschaftungswert'), true);
  // Kurze Themenwörter im Wortinneren gehören meist zu einem anderen Wort.
  assert.equal(occursAsThemeWord('Arbeit', sourceText), false);
  assert.match(generatedKeywordProblem('Arbeit', meta, sourceText), /Themenwort/u);
  assert.equal(occursAsThemeWord('Arbeit', 'Die Arbeitsgruppe tagt.'), true);
});

test('großgeschriebene Glieder der Kennung ohne Beleg in Titel und Text werden erkannt', () => {
  const meta = {
    slug: 'gesetz-zur-anderung-des-mustergesetzes-zur-regelung-der-testfalle',
    title: 'Gesetz zur Änderung des Ostdeutschen Musterdienstgesetzes zur Regelung der Testfälle',
  };
  const sourceText = 'Das Ostdeutsche Musterdienstgesetz wird wie folgt geändert.';
  assert.match(generatedKeywordProblem('Mustergesetzes', meta, sourceText), /Kennung/u);
  // Im Titel oder Text belegt bleibt das Glied ein zulässiges Schlagwort.
  assert.equal(generatedKeywordProblem('Regelung', meta, sourceText), null);
  assert.equal(generatedKeywordProblem('Mustergesetzes', meta, `${sourceText} Das Mustergesetzes-Register.`), null);
});

test('Platzhalterformeln ohne Inhaltsaussage sind Formeln', () => {
  const placeholder = 'Die Änderungsvorschrift ändert die im Titel bezeichneten Regelungen und dokumentiert den beschlossenen neuen Rechtsstand.';
  assert.equal(isPlaceholderSummary(placeholder), true);
  assert.equal(isFormulaSummary(placeholder, 'Erstes Gesetz zur Änderung des Testfallgesetzes'), true);
  assert.equal(isPlaceholderSummary('Das Abkommen regelt die Zusammenarbeit im Testraum sowie die Rechte und Pflichten der Vertragsparteien.'), true);
  assert.equal(isPlaceholderSummary('Ändert das Testfallgesetz und führt eine Gebühr für Großveranstaltungen ein.'), false);
  assert.equal(isPlaceholderSummary(''), false);
});

test('eine Kurzfassung, die nur den eigenen Titel zitiert, ist eine Formel', () => {
  const meta = { title: 'Gesetz über Testfälle', shortTitle: 'Testfallgesetz' };
  assert.equal(isOwnTitleQuotingSummary('Das Gesetz regelt den in „Gesetz über Testfälle“ bezeichneten Gegenstand.', meta), true);
  assert.equal(isOwnTitleQuotingSummary('Die Verordnung konkretisiert die gesetzlichen Vorgaben zu „Testfallgesetz“.', meta), true);
  assert.equal(isOwnTitleQuotingSummary('Errichtet die Prüfstelle „Musterhaus“ und regelt ihre Aufgaben.', meta), false);
  assert.equal(isOwnTitleQuotingSummary('', meta), false);
  // Das Zitat trägt hinter dem Titel noch Kurzbezeichnung und Abkürzung in Klammern.
  assert.equal(isOwnTitleQuotingSummary('Die Richtlinie regelt die in „Gesetz über Testfälle (Testfallgesetz – TfG)“ bezeichnete Förderung.', meta), true);
});
