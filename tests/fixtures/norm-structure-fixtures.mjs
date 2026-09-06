/**
 * PDF-geprüfte Strukturmerkmale amtlicher HTML-Quellen unter Gesetze/ (unveränderliche
 * Verkündungen). Jeder Eintrag beschreibt nur Struktur (Gliederungsebenen, Zitate, Tabellen,
 * Listenhierarchie), keine Wortlaute; tests/norm-html-parser.test.mjs prüft sie gegen den Parser.
 *
 * Schlüssel: outerArticles/outerParagraphs (äußere Gliederung), introducedLastStructures und
 * introducedAbbreviations (eingeführte Stammnormen), quotedStructure/quotedLabel/quotedArticle mit
 * quotedParagraphs (zitierte Neufassungen), noTopLevel (Blocktypen, die nur im Zitat vorkommen),
 * number1Children/number1FirstChildPath (Geschwister und Verschachtelung unter Nummer 1 in
 * Artikel 1), tableCount, labelTypes/labelCounts (Blocktyp bzw. Häufigkeit eines Gliederungszeichens),
 * firstBlockType, noStandaloneDecimalAnchors/decimalWithLetterChildren (allein gedruckte Anker),
 * itemChildrenLabels/itemsWithLeadingText/topLevelItems („Abschnitt|Nummer“-Pfade in Richtlinien),
 * consolidated/title/labelChildren (konsolidierte Lesefassung).
 */
export const complexHtmlStructureFixtures = {
  'OGVBl. 2026 Nr. 3.html': {
    outerArticles: ['Artikel 1', 'Artikel 2'],
    quotedStructure: 'annex',
    noTopLevel: ['annex'],
    tableCount: 1,
  },
  'OGVBl. 2026 Nr. 17.html': {
    outerArticles: ['Artikel 1', 'Artikel 2', 'Artikel 3', 'Artikel 4', 'Artikel 5'],
    quotedLabel: '§ 15',
    articleQuotedFirstChild: { article: 'Artikel 4', label: 'Abschnitt 1' },
    noTopLevel: ['section'],
  },
  'OGVBl. 2026 Nr. 46.html': {
    introducedCount: 2,
    introducedLastStructures: ['§ 25', '§ 26'],
  },
  'OGVBl. 2026 Nr. 47.html': {
    introducedAbbreviations: ['OstEisG', 'OstVerkVergG', 'VerkBindG'],
  },
  'OGVBl. 2026 Nr. 52.html': {
    outerArticles: Array.from({ length: 13 }, (_, index) => `Artikel ${index + 1}`),
    introducedLastStructures: ['§ 48', '§ 7', '§ 7', '§ 13', '§ 8'],
  },
  'OGVBl. 2026 Nr. 53.html': {
    outerArticles: ['Artikel 1', 'Artikel 2'],
    number1Children: ['a.', 'b.', 'c.', 'd.', 'e.'],
    number1FirstChildPath: ['a.', 'i.'],
    quotedArticle: 'Artikel 5',
    quotedParagraphs: ['(1)', '(2)', '(3)'],
  },
  'OGVBl. 2026 Nr. 54.html': {
    outerArticles: ['Artikel 1', 'Artikel 2'],
    number1Children: ['a.', 'b.', 'c.', 'd.', 'e.'],
    quotedArticle: 'Artikel 95a',
    quotedParagraphs: ['(1)', '(2)', '(3)', '(4)', '(5)', '(6)'],
  },
  'OGVBl. 2026 Nr. 58.html': {
    outerParagraphs: Array.from({ length: 35 }, (_, index) => `§ ${index + 1}`),
  },
  // Altquellen-Transkriptionen: einfache und mehrstufige Legacy-Strukturen.
  'OABl. 2025 Nr. 1.html': {
    labelTypes: { '4.1': 'subsection' },
    labelCounts: { '5.': 2 },
  },
  'OABl. 2025 Nr. 3.html': {
    firstBlockType: 'paragraphText',
  },
  // Allein gedruckte Gliederungsanker gehen nicht verloren.
  'OVertrBl. 2026 Nr. 1.html': {
    noStandaloneDecimalAnchors: true,
    decimalWithLetterChildren: ['2.'],
  },
  // Förderrichtlinie: Eltern, Fortsetzungstext und Unterlisten.
  'StAnzO. 2026 Nr. 5.html': {
    itemChildrenLabels: { 'I.|2.': ['-', '-', '-'], 'IV.|3.': ['a)', 'b)'], 'VI.|2.': ['a)', 'b)'], 'VII.|1.': ['a)', 'b)'] },
    itemsWithLeadingText: ['IV.|1.', 'IV.|3.', 'VI.|1.'],
    topLevelItems: ['IV.|4.'],
  },
  // Konsolidierte Lesefassung: Absatzkennzeichnungen mit Buchstabenzusatz.
  'Staatsverfassung.html': {
    consolidated: true,
    title: 'Verfassung des Freistaates Ostdeutschland',
    labelChildren: { 'Artikel 120': ['(1)', '(1a)', '(1b)', '(2)'] },
  },
};
