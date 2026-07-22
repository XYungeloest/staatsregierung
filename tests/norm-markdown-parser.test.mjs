import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  classifyMarkdownSource,
  parseConsolidatedMarkdown,
  parsePublicationMarkdown,
  summarizeParsedSource,
} from '../scripts/lib/norm-markdown-parser.mjs';
import {
  validateConstitutionParserContract,
  validatePublicationParserContract,
} from '../scripts/lib/norm-parser-contract.mjs';

async function issue(number) {
  const fileName = `OGVBl. 2026 Nr. ${number}.md`;
  const markdown = await readFile(new URL(`../Gesetze/${fileName}`, import.meta.url), 'utf8');
  return parsePublicationMarkdown(fileName, markdown);
}

function bodyText(norm) {
  return JSON.stringify(norm.body);
}

function flattenBlocks(blocks, output = []) {
  for (const block of blocks ?? []) {
    output.push(block);
    flattenBlocks(block.children, output);
  }
  return output;
}

test('Ausgabe 46 trennt Mantelgesetz, OstKrBzNG und Bezirksordnung', async () => {
  const parsed = await issue(46);
  const summary = summarizeParsedSource(parsed);
  assert.equal(parsed.title, 'Gesetz zur Neuordnung der Kreise und Bezirke und zur Anpassung bezirks- und kreisrechtlicher Vorschriften');
  assert.equal(parsed.documentDate, '2026-07-20');
  assert.equal(parsed.publicationDate, '2026-07-20');
  assert.equal(parsed.startPage, '2');
  assert.equal(parsed.effectiveDate, '2026-07-21');
  assert.equal(parsed.introducedNorms.length, 2);
  assert.equal(parsed.introducedNorms[0].abbr, 'OstKrBzNG');
  assert.equal(summary[1].firstStructure, '§ 1');
  assert.equal(summary[1].lastStructure, '§ 25');
  assert.equal(summary[2].lastStructure, '§ 26');
  assert.equal(summary[0].lastStructure, 'Anlage 3 (zu den §§ 7 und 8)');
});

test('Ausgabe 47 erhält Abschnitte und alle drei eingeführten Stammnormen', async () => {
  const parsed = await issue(47);
  assert.equal(parsed.introducedNorms.length, 3);
  assert.deepEqual(parsed.introducedNorms.map((norm) => norm.abbr), ['OstEisG', 'OstVerkVergG', 'VerkBindG']);
  assert.match(bodyText(parsed.introducedNorms[1]), /§ 30/u);
  assert.match(bodyText(parsed.introducedNorms[0]), /Abschnitt 3/u);
});

test('Ausgabe 51 bleibt ein Änderungsgesetz ohne erfundene Stammnorm', async () => {
  const parsed = await issue(51);
  assert.equal(parsed.type, 'aenderungsvorschrift');
  assert.equal(parsed.introducedNorms.length, 0);
  assert.equal(parsed.effectiveDate, '2026-07-20');
  assert.match(bodyText(parsed), /§ 14a/u);
});

for (const [number, ordinal] of [[53, 'Erstes'], [54, 'Zweites'], [55, 'Drittes'], [56, 'Viertes']]) {
  test(`Ausgabe ${number} erkennt die Überschrift ${ordinal} Gesetz`, async () => {
    const parsed = await issue(number);
    assert.match(parsed.title, new RegExp(`^${ordinal} Gesetz`, 'u'));
    assert.equal(parsed.type, 'aenderungsvorschrift');
    assert.equal(parsed.documentDate, '2026-07-20');
    assert.equal(parsed.publicationDate, '2026-07-20');
    assert.equal(parsed.effectiveDate, '2026-07-21');
    assert.equal(parsed.abbr, undefined);
    assert.equal(summarizeParsedSource(parsed).at(-1).lastStructure, 'Artikel 2');
  });
}

test('Ausgabe 53 bewahrt den verkündeten Wortlaut von Artikel 121a', async () => {
  const parsed = await issue(53);
  const text = bodyText(parsed);
  assert.match(text, /Siebte Volkskammer ist der siebte Landtag\. Die Wahl zur achten Volkskammer findet Ende August statt\./u);
  assert.doesNotMatch(text, /Achte Volkskammer ist der achte Landtag/u);
  assert.deepEqual(validatePublicationParserContract(parsed), []);
});

test('Artikel 120 der Lesefassung besitzt vier eindeutige Absatzkennzeichnungen', async () => {
  const markdown = await readFile(new URL('../Gesetze/Staatsverfassung.md', import.meta.url), 'utf8');
  const parsed = parseConsolidatedMarkdown('Staatsverfassung.md', markdown, {
    title: 'Verfassung des Freistaates Ostdeutschland',
  });
  const article120 = flattenBlocks(parsed.body).find((block) => block.label === 'Artikel 120');
  assert.ok(article120);
  assert.deepEqual(article120.children.map((block) => block.label), ['1)', '1a)', '1b)', '2)']);
  assert.deepEqual(validateConstitutionParserContract(parsed), []);
});

test('Ausgabe 55 bewahrt verschachtelte Änderungsanweisungen und Zitate', async () => {
  const parsed = await issue(55);
  assert.match(bodyText(parsed), /Artikel 12b/u);
  assert.match(bodyText(parsed), /Kritische Infrastruktur und Resilienz/u);
});

test('Ausgabe 56 erkennt die neu gefassten Verfassungsartikel', async () => {
  const parsed = await issue(56);
  assert.match(bodyText(parsed), /Artikel 101/u);
  assert.match(bodyText(parsed), /Artikel 112/u);
});

test('Ausgabe 57 erhält den eingefügten Paragraphen innerhalb des Zitats', async () => {
  const parsed = await issue(57);
  assert.match(bodyText(parsed), /§ 59a/u);
  assert.match(bodyText(parsed), /Zweitveröffenlichungspflicht/u);
  assert.equal(parsed.effectiveDate, '2026-07-20');
});

test('Ausgabe 58 ist eine selbstständige Rechtsverordnung des Staatsrates', async () => {
  const parsed = await issue(58);
  const summary = summarizeParsedSource(parsed)[0];
  assert.equal(parsed.type, 'verordnung');
  assert.equal(parsed.documentDate, '2026-07-20');
  assert.equal(parsed.publicationDate, '2026-07-21');
  assert.equal(parsed.effectiveDate, '2026-07-21');
  assert.equal(summary.firstStructure, '§ 1');
  assert.equal(summary.lastStructure, '§ 35');
});

test('Bilddefinitionen, Inhaltsverzeichnisse und Signaturblöcke gelangen nicht in Normkörper', async () => {
  for (const number of [46, 47, 52, 58]) {
    const parsed = await issue(number);
    for (const norm of [parsed, ...parsed.introducedNorms]) {
      const text = bodyText(norm);
      assert.doesNotMatch(text, /data:image|;base64,|Inhaltsverzeichnis|Dresden, den|LANDTAGSPRÄSIDENT/iu);
    }
  }
});

test('Pressemitteilungen werden nicht als Norm klassifiziert', async () => {
  const fileName = 'PM-21072026-03.md';
  const markdown = await readFile(new URL(`../Gesetze/${fileName}`, import.meta.url), 'utf8');
  assert.equal(classifyMarkdownSource(fileName, markdown).kind, 'editorial');
});

test('eine Anlage nach dem Ausfertigungsblock bleibt erhalten', () => {
  const markdown = `
**Gesetz- und Verordnungsblatt**
für den Freistaat Ostdeutschland.

| Nr. 99 | Ausgegeben zu Dresden am 21. Juli 2026 |

Inhaltsverzeichnis

| 20. Juli 2026 | Gesetz über einen Test | Seite 2 |

**Gesetz**
über einen Test
vom 20. Juli 2026

Der Ostdeutsche Landtag hat das folgende Gesetz beschlossen:

## § 1 Regelung

(1) Der Test wird geregelt.

Dresden, den 20. Juli 2026

**Eine unterzeichnende Person**
Der Ministerpräsident

## Anlage 1

1. Erster Eintrag
2. Zweiter Eintrag

## § 2 Inkrafttreten

Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.
`;
  const parsed = parsePublicationMarkdown('OGVBl. 2026 Nr. 99.md', markdown);
  const text = bodyText(parsed);
  assert.match(text, /Anlage 1/u);
  assert.match(text, /Erster Eintrag/u);
  assert.doesNotMatch(text, /unterzeichnende Person|Ministerpräsident/u);
});

test('Absatzmarker und Fortsetzungszeilen bleiben als eigene Absätze verbunden', () => {
  const markdown = `
**Gesetz- und Verordnungsblatt**
für den Freistaat Ostdeutschland.

| Nr. 99 | Ausgegeben zu Dresden am 21. Juli 2026 |

Inhaltsverzeichnis

| 20. Juli 2026 | Gesetz über einen Test | Seite 2 |

**Gesetz**
über einen Test
vom 20. Juli 2026

## § 1 Regelung

(1) Der erste Absatz beginnt hier
und wird in der nächsten Zeile fortgesetzt.

(1a) Der zweite Absatz bleibt eigenständig.

## § 2 Inkrafttreten

Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.
`;
  const parsed = parsePublicationMarkdown('OGVBl. 2026 Nr. 99.md', markdown);
  const firstParagraph = parsed.body.find((block) => block.label === '§ 1');
  assert.deepEqual(firstParagraph.children.map((block) => block.type), ['subparagraph', 'subparagraph']);
  assert.match(firstParagraph.children[0].text, /beginnt hier und wird in der nächsten Zeile fortgesetzt/u);
  assert.equal(firstParagraph.children[1].label, '(1a)');
});

test('Markdown-Tabellen bewahren Kopfzellen, leere Zellen und die Spaltenzahl jeder Zeile', () => {
  const markdown = `
**Gesetz- und Verordnungsblatt**
für den Freistaat Ostdeutschland.

| Nr. 99 | Ausgegeben zu Dresden am 21. Juli 2026 |

Inhaltsverzeichnis

| 20. Juli 2026 | Gesetz über einen Test | Seite 2 |

**Gesetz**
über einen Test
vom 20. Juli 2026

## § 1 Tabelle

| Bezeichnung | Wert | Hinweis |
| --- | ---: | --- |
| A | 1 | Ein längerer Inhalt bleibt vollständig erhalten. |
| B |  | kurz |
| C | 3 |

## § 2 Inkrafttreten

Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.
`;
  const parsed = parsePublicationMarkdown('OGVBl. 2026 Nr. 99.md', markdown);
  const table = parsed.body.find((block) => block.label === '§ 1').children.find((block) => block.type === 'table');
  assert.equal(table.children.length, 4);
  assert.deepEqual(table.children[0].children.map((cell) => cell.type), ['tableHeaderCell', 'tableHeaderCell', 'tableHeaderCell']);
  assert.deepEqual(table.children[0].children.map((cell) => cell.text), ['Bezeichnung', 'Wert', 'Hinweis']);
  assert.deepEqual(table.children[1].children.map((cell) => cell.text), ['A', '1', 'Ein längerer Inhalt bleibt vollständig erhalten.']);
  assert.deepEqual(table.children[2].children.map((cell) => cell.text), ['B', '', 'kurz']);
  assert.deepEqual(table.children.map((row) => row.children.length), [3, 3, 3, 2]);
});
