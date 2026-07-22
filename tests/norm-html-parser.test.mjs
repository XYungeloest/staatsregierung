import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  classifyHtmlSource,
  parseConsolidatedHtml,
  parsePublicationHtml,
  summarizeParsedSource,
} from '../scripts/lib/norm-html-parser.mjs';
import {
  validateConstitutionParserContract,
  validatePublicationParserContract,
} from '../scripts/lib/norm-parser-contract.mjs';

async function issue(number) {
  const fileName = `OGVBl. 2026 Nr. ${number}.html`;
  const html = await readFile(new URL(`../Gesetze/${fileName}`, import.meta.url), 'utf8');
  return parsePublicationHtml(fileName, html);
}

function flatten(blocks, output = [], insideQuote = false) {
  for (const block of blocks ?? []) {
    output.push({ block, insideQuote });
    flatten(block.children, output, insideQuote || block.type === 'quotedProvision');
  }
  return output;
}

function bodyText(norm) {
  return JSON.stringify(norm.body);
}

test('Ausgaben 46 bis 58 werden ausschließlich aus HTML mit intern erkannten Ausgabedaten gelesen', async () => {
  for (let number = 46; number <= 58; number += 1) {
    const parsed = await issue(number);
    assert.equal(parsed.issue, String(number));
    assert.equal(parsed.documentDate, '2026-07-20');
    assert.equal(parsed.publicationDate, number === 58 ? '2026-07-21' : '2026-07-20');
    assert.deepEqual(validatePublicationParserContract(parsed), []);
  }
});

test('Ausgabe 46 trennt Mantelgesetz, OstKrBzNG und Bezirksordnung', async () => {
  const parsed = await issue(46);
  const summary = summarizeParsedSource(parsed);
  assert.equal(parsed.introducedNorms.length, 2);
  assert.equal(parsed.introducedNorms[0].abbr, 'OstKrBzNG');
  assert.equal(summary[1].firstStructure, '§ 1');
  assert.equal(summary[1].lastStructure, '§ 25');
  assert.equal(summary[2].lastStructure, '§ 26');
});

test('Ausgabe 47 erhält alle drei eingeführten Stammnormen', async () => {
  const parsed = await issue(47);
  assert.deepEqual(parsed.introducedNorms.map((norm) => norm.abbr), ['OstEisG', 'OstVerkVergG', 'VerkBindG']);
  assert.match(bodyText(parsed.introducedNorms[1]), /§ 30/u);
});

test('Ausgabe 53 rekonstruiert äußere Artikel, sibling-Listen und zitierte Neufassungen', async () => {
  const parsed = await issue(53);
  const flat = flatten(parsed.body);
  const outerArticles = flat
    .filter(({ block, insideQuote }) => !insideQuote && block.type === 'article')
    .map(({ block }) => block.label);
  assert.deepEqual(outerArticles, ['Artikel 1', 'Artikel 2']);

  const article1 = parsed.body.find((block) => block.label === 'Artikel 1');
  assert.equal(article1.title, 'Änderung der Staatsverfassung');
  const number1 = article1.children.find((block) => block.type === 'item');
  assert.equal(number1.label, '1.');
  assert.equal(number1.children[0].label, 'a.');
  assert.equal(number1.children[0].children[0].label, 'i.');
  assert.equal(number1.children.find((block) => block.text.startsWith('Artikel 3')).children.length, 2);

  const article5 = flat.find(({ block, insideQuote }) => insideQuote && block.type === 'article' && block.label === 'Artikel 5')?.block;
  assert.ok(article5);
  assert.deepEqual(article5.children.map((block) => block.label), ['(1)', '(2)', '(3)']);
  assert.ok(flat.some(({ block }) => block.type === 'quotedProvision'));
  assert.deepEqual(validatePublicationParserContract(parsed), []);
});

test('Ausgabe 17 hält das eingebettete Hoheitszeichengesetz unter Artikel 4', async () => {
  const parsed = await issue(17);
  const flat = flatten(parsed.body);
  const outerArticles = flat
    .filter(({ block, insideQuote }) => !insideQuote && block.type === 'article')
    .map(({ block }) => block.label);
  assert.deepEqual(outerArticles, ['Artikel 1', 'Artikel 2', 'Artikel 3', 'Artikel 4', 'Artikel 5']);

  const article4 = parsed.body.find((block) => block.label === 'Artikel 4');
  assert.match(article4.title, /^Gesetz über die Hoheitszeichen/u);
  assert.equal(article4.children[0].type, 'quotedProvision');
  assert.equal(article4.children[0].children[0].label, 'Abschnitt 1');
  assert.ok(flat.some(({ block, insideQuote }) => insideQuote && block.label === '§ 15'));
  assert.ok(!parsed.body.some((block) => block.type === 'section'));
});

test('Ausgabe 3 hält die ersetzte Anlage im Zitat und Artikel 2 auf der Außenebene', async () => {
  const parsed = await issue(3);
  const flat = flatten(parsed.body);
  const outerArticles = flat
    .filter(({ block, insideQuote }) => !insideQuote && block.type === 'article')
    .map(({ block }) => block.label);
  assert.deepEqual(outerArticles, ['Artikel 1', 'Artikel 2']);
  assert.ok(flat.some(({ block, insideQuote }) => insideQuote && block.type === 'annex'));
  assert.ok(!parsed.body.some((block) => block.type === 'annex'));
});

test('konsolidierte Staatsverfassung kommt aus HTML und erhält Artikel 120 quellentreu', async () => {
  const html = await readFile(new URL('../Gesetze/Staatsverfassung.html', import.meta.url), 'utf8');
  const parsed = parseConsolidatedHtml('Staatsverfassung.html', html, { title: 'Verfassung des Freistaates Ostdeutschland' });
  const article120 = flatten(parsed.body).find(({ block }) => block.label === 'Artikel 120')?.block;
  assert.deepEqual(article120.children.map((block) => block.label), ['(1)', '(1a)', '(1b)', '(2)']);
  assert.deepEqual(validateConstitutionParserContract(parsed), []);
});

test('Kopf, Inhaltsverzeichnis, CSS und Signaturen gelangen nicht in Normkörper', async () => {
  for (const number of [46, 47, 52, 53, 58]) {
    const parsed = await issue(number);
    for (const norm of [parsed, ...parsed.introducedNorms]) {
      assert.doesNotMatch(bodyText(norm), /data:image|;base64,|@import|Inhaltsverzeichnis|Dresden, den|LANDTAGSPRÄSIDENT/iu);
    }
  }
});

test('redaktionelles HTML wird nicht als Norm klassifiziert', () => {
  const html = '<!doctype html><html><body><h1>Pressemitteilung</h1><p>Begleittext zu einem Gesetz.</p></body></html>';
  assert.equal(classifyHtmlSource('PM-21072026-03.html', html).kind, 'editorial');
});

test('HTML-Tabellen bewahren leere Zellen, Kopfzellen, Spalten und Zellspannen', () => {
  const html = `<!doctype html><html><head><style></style></head><body>
    <p>Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland</p>
    <p>Nr. 99</p><p>Ausgegeben zu Dresden am 21. Juli 2026</p>
    <p>Inhaltsverzeichnis</p><p>20. Juli 2026 Testgesetz Seite 2</p>
    <p>Gesetz<br>über einen Tabellentest<br>vom 20. Juli 2026</p>
    <p>Der Ostdeutsche Landtag hat das folgende Gesetz beschlossen:</p>
    <h2>§ 1<br>Tabelle</h2>
    <table><thead><tr><th rowspan="2">Bezeichnung</th><th colspan="2">Werte</th></tr><tr><th>A</th><th>B</th></tr></thead>
      <tbody><tr><td>Eintrag</td><td></td><td>3</td></tr></tbody></table>
    <h2>§ 2<br>Inkrafttreten</h2><p>Dieses Gesetz tritt am Tag nach seiner Verkündung in Kraft.</p>
    <p>Dresden, den 20. Juli 2026</p></body></html>`;
  const parsed = parsePublicationHtml('abweichender-dateiname.html', html);
  const table = flatten(parsed.body).find(({ block }) => block.type === 'table')?.block;
  assert.equal(table.columns, 3);
  assert.equal(table.children[0].children[0].rowspan, 2);
  assert.equal(table.children[0].children[1].colspan, 2);
  assert.equal(table.children[2].children[1].text, '');
  assert.equal(table.children[0].children[0].type, 'tableHeaderCell');
});
