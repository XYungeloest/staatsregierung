import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyMarkdownSource, parsePublicationMarkdown } from '../scripts/lib/norm-markdown-parser.mjs';

/**
 * Legacy-Markdown-Parser auf synthetischen Ausgaben: Anlagen nach dem Ausfertigungsblock,
 * Absatzmarker mit Fortsetzungszeilen, Tabellen und die redaktionelle Klassifikation. Die
 * verbliebenen Markdown-only-Quellen prüft der strikte Importer-Audit in content:check.
 */
function issue(body) {
  return `
**Gesetz- und Verordnungsblatt**
für den Freistaat Ostdeutschland.

| Nr. 99 | Ausgegeben zu Dresden am 21. Juli 2026 |

Inhaltsverzeichnis

| 20. Juli 2026 | Gesetz über einen Test | Seite 2 |

**Gesetz**
über einen Test
vom 20. Juli 2026

${body}
`;
}

function bodyText(norm) {
  return JSON.stringify(norm.body);
}

test('eine Anlage nach dem Ausfertigungsblock bleibt erhalten, der Signaturblock nicht', () => {
  const parsed = parsePublicationMarkdown('OGVBl. 2026 Nr. 99.md', issue(`
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
`));
  const text = bodyText(parsed);
  assert.match(text, /Anlage 1/u);
  assert.match(text, /Erster Eintrag/u);
  assert.doesNotMatch(text, /unterzeichnende Person|Ministerpräsident|Inhaltsverzeichnis/u);
});

test('Absatzmarker und Fortsetzungszeilen bleiben als eigene Absätze verbunden', () => {
  const parsed = parsePublicationMarkdown('OGVBl. 2026 Nr. 99.md', issue(`
## § 1 Regelung

(1) Der erste Absatz beginnt hier
und wird in der nächsten Zeile fortgesetzt.

(1a) Der zweite Absatz bleibt eigenständig.

## § 2 Inkrafttreten

Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.
`));
  const firstParagraph = parsed.body.find((block) => block.label === '§ 1');
  assert.deepEqual(firstParagraph.children.map((block) => block.type), ['subparagraph', 'subparagraph']);
  assert.match(firstParagraph.children[0].text, /beginnt hier und wird in der nächsten Zeile fortgesetzt/u);
  assert.equal(firstParagraph.children[1].label, '(1a)');
});

test('Markdown-Tabellen bewahren Kopfzellen, leere Zellen und die Spaltenzahl jeder Zeile', () => {
  const parsed = parsePublicationMarkdown('OGVBl. 2026 Nr. 99.md', issue(`
## § 1 Tabelle

| Bezeichnung | Wert | Hinweis |
| --- | ---: | --- |
| A | 1 | Ein längerer Inhalt bleibt vollständig erhalten. |
| B |  | kurz |
| C | 3 |

## § 2 Inkrafttreten

Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.
`));
  const table = parsed.body.find((block) => block.label === '§ 1').children.find((block) => block.type === 'table');
  assert.equal(table.children.length, 4);
  assert.deepEqual(table.children[0].children.map((cell) => cell.type), ['tableHeaderCell', 'tableHeaderCell', 'tableHeaderCell']);
  assert.deepEqual(table.children[0].children.map((cell) => cell.text), ['Bezeichnung', 'Wert', 'Hinweis']);
  assert.deepEqual(table.children[1].children.map((cell) => cell.text), ['A', '1', 'Ein längerer Inhalt bleibt vollständig erhalten.']);
  assert.deepEqual(table.children[2].children.map((cell) => cell.text), ['B', '', 'kurz']);
  assert.deepEqual(table.children.map((row) => row.children.length), [3, 3, 3, 2]);
});

test('redaktionelles Markdown wird nicht als Norm klassifiziert', () => {
  const markdown = '# Pressemitteilung\n\nDie Staatsregierung informiert über ein Gesetz.\n';
  assert.equal(classifyMarkdownSource('PM-21072026-03.md', markdown).kind, 'editorial');
});
