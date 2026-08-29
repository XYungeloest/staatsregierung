import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  classifyHtmlSource,
  parseConsolidatedHtml,
  parsePublicationHtml,
  summarizeParsedSource,
  validateListSequences,
} from '../scripts/lib/norm-html-parser.mjs';
import {
  validateConstitutionParserContract,
  validatePublicationParserContract,
} from '../scripts/lib/norm-parser-contract.mjs';
import { complexHtmlStructureFixtures } from './fixtures/norm-structure-fixtures.mjs';

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

function hierarchyFixture(content, css = '') {
  const html = `<!doctype html><html><head><style>${css}</style></head><body>
    <p>Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland</p>
    <p>Nr. 99</p><p>Ausgegeben zu Dresden am 27. August 2026</p>
    <p>Inhaltsverzeichnis</p><p>27. August 2026 Richtlinie über einen Hierarchietest Seite 2</p>
    <p>Richtlinie<br>über einen Hierarchietest<br>vom 27. August 2026</p>
    <h2>I.<br>Prüfbereich</h2>${content}
    <p>Dresden, den 27. August 2026</p></body></html>`;
  return parsePublicationHtml('hierarchie-fixture.html', html).body.find((block) => block.label === 'I.');
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

test('alternative amtliche Ausgaben werden als strukturierte Veröffentlichungen erkannt', async () => {
  const fileName = 'GMBl-14-2026.html';
  const html = await readFile(new URL(`../Gesetze/${fileName}`, import.meta.url), 'utf8');
  assert.equal(classifyHtmlSource(fileName, html).kind, 'publication');
  const parsed = parsePublicationHtml(fileName, html);
  assert.equal(parsed.publication, 'GMBl.');
  assert.ok(parsed.issue);
  assert.ok(parsed.body.length > 0);
  assert.deepEqual(validatePublicationParserContract(parsed), []);
});

test('Altquellen-Transkriptionen bewahren einfache und mehrstufige Legacy-Strukturen', async () => {
  const [simpleHtml, nestedHtml] = await Promise.all([
    readFile(new URL('../Gesetze/OABl. 2025 Nr. 3.html', import.meta.url), 'utf8'),
    readFile(new URL('../Gesetze/OABl. 2025 Nr. 1.html', import.meta.url), 'utf8'),
  ]);
  const simple = parsePublicationHtml('OABl. 2025 Nr. 3.html', simpleHtml);
  const nested = parsePublicationHtml('OABl. 2025 Nr. 1.html', nestedHtml);
  const flat = flatten(nested.body).map(({ block }) => block);

  assert.equal(simple.body[0]?.type, 'paragraphText');
  assert.equal(flat.find((block) => block.label === '4.1')?.type, 'subsection');
  assert.equal(flat.filter((block) => block.label === '5.').length, 2);
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
  assert.deepEqual(number1.children.map((child) => child.label), complexHtmlStructureFixtures[53].number1Children);
  assert.equal(number1.children[0].label, 'a.');
  assert.equal(number1.children[0].children[0].label, 'i.');
  assert.equal(number1.children.find((block) => block.text.startsWith('Artikel 3')).children.length, 2);

  const article5 = flat.find(({ block, insideQuote }) => insideQuote && block.type === 'article' && block.label === 'Artikel 5')?.block;
  assert.ok(article5);
  assert.deepEqual(article5.children.map((block) => block.label), ['(1)', '(2)', '(3)']);
  const letterD = number1.children.find((block) => block.label === 'd.');
  const letterE = number1.children.find((block) => block.label === 'e.');
  assert.ok(flatten(letterD.children).some(({ block }) => block.type === 'article' && block.label === 'Artikel 5'));
  assert.match(letterE.text, /^Artikel 6 wird wie folgt geändert/u);
  assert.equal(number1.children.filter((block) => block.label === 'a.').length, 1);
  assert.ok(flat.some(({ block }) => block.type === 'quotedProvision'));
  assert.deepEqual(validatePublicationParserContract(parsed), []);
});

test('PDF-geprüfte Strukturfixtures sichern die komplexen HTML-Ausgaben 3, 17, 46, 47, 52, 53, 54 und 58', async () => {
  for (const number of [3, 17, 46, 47, 52, 53, 54, 58]) {
    const parsed = await issue(number);
    const fixture = complexHtmlStructureFixtures[number];
    const summary = summarizeParsedSource(parsed);
    if (fixture.outerArticles) assert.deepEqual(summary[0].outerArticles, fixture.outerArticles, `Ausgabe ${number}: äußere Artikel`);
    if (fixture.outerParagraphs) assert.deepEqual(summary[0].outerParagraphs, fixture.outerParagraphs, `Ausgabe ${number}: äußere Paragraphen`);
    if (fixture.introducedLastStructures) {
      assert.deepEqual(summary.slice(1).map((entry) => entry.lastStructure), fixture.introducedLastStructures, `Ausgabe ${number}: eingeführte Normen`);
    }
    if (fixture.introducedAbbreviations) {
      assert.deepEqual(parsed.introducedNorms.map((norm) => norm.abbr), fixture.introducedAbbreviations, `Ausgabe ${number}: Abkürzungen`);
    }
    if (fixture.number1Children) {
      const article1 = parsed.body.find((block) => block.label === 'Artikel 1');
      const number1 = article1?.children.find((block) => block.label === '1.');
      assert.deepEqual(number1?.children.map((child) => child.label), fixture.number1Children, `Ausgabe ${number}: Geschwister unter Nummer 1`);
    }
    const flat = flatten(parsed.body);
    if (fixture.quotedStructure) {
      assert.ok(flat.some(({ block, insideQuote }) => insideQuote && block.type === fixture.quotedStructure), `Ausgabe ${number}: zitierte Struktur ${fixture.quotedStructure}`);
    }
    if (fixture.quotedLabel) {
      assert.ok(flat.some(({ block, insideQuote }) => insideQuote && block.label === fixture.quotedLabel), `Ausgabe ${number}: zitierte Struktur ${fixture.quotedLabel}`);
    }
    if (fixture.quotedArticle) {
      const quotedArticle = flat.find(({ block, insideQuote }) => insideQuote && block.type === 'article' && block.label === fixture.quotedArticle)?.block;
      assert.ok(quotedArticle, `Ausgabe ${number}: zitierter Artikel ${fixture.quotedArticle}`);
      assert.deepEqual(quotedArticle.children.map((child) => child.label), fixture.quotedParagraphs, `Ausgabe ${number}: Absätze in ${fixture.quotedArticle}`);
    }
    if (fixture.tableCount !== undefined) assert.equal(summary[0].tableCount, fixture.tableCount, `Ausgabe ${number}: Tabellen`);
    assert.deepEqual(validateListSequences(parsed.body), [], `Ausgabe ${number}: Listensequenzen`);
  }
});

test('Sequenzvalidierung meldet doppelte, rückwärts laufende und stilistisch gemischte Geschwister', () => {
  const item = (label, numberingStyle = 'lower-latin', listId = 'test-list') => ({
    type: 'item', label, text: label, level: 0, listId, numberingStyle, children: [],
  });
  assert.match(validateListSequences([item('a.'), item('a.')])[0], /doppeltes Gliederungszeichen/u);
  assert.match(validateListSequences([item('b.'), item('a.')])[0], /rückwärts laufende Nummerierungsfolge/u);
  assert.match(validateListSequences([item('a.'), item('c.')])[0], /lückenhafte Nummerierungsfolge/u);
  assert.match(validateListSequences([item('a.'), item('ii.', 'lower-roman')])[0], /widersprüchliche Nummerierungsstile/u);
  assert.deepEqual(validateListSequences([item('a.'), { type: 'paragraphText', text: 'Neue Liste.' }, item('a.')]), []);
});

test('alphabetische Untergliederung endet vor der nächsten Dezimalnummer', () => {
  const section = hierarchyFixture(`
    <p>1. Elternpunkt</p>
    <ol type="a"><li style="margin-left:36pt">Unterpunkt A</li><li style="margin-left:36pt">Unterpunkt B</li></ol>
    <p>2. Nächster Elternpunkt</p>`);
  const [one, two] = section.children.filter((block) => block.type === 'item');
  assert.equal(one.label, '1.');
  assert.deepEqual(one.children.map((block) => block.label), ['a.', 'b.']);
  assert.equal(two.label, '2.');
  assert.equal(two.level, 0);
});

test('Spiegelstriche nach einer eingerückten Einleitung bleiben Kinder des Elternpunkts', () => {
  const section = hierarchyFixture(`
    <p>2. Einleitung:</p>
    <ul><li style="margin-left:36pt">Punkt A</li><li style="margin-left:36pt">Punkt B</li></ul>
    <p>3. Nächster Elternpunkt</p>`);
  const [two, three] = section.children.filter((block) => block.type === 'item');
  assert.deepEqual(two.children.map((block) => block.label), ['–', '–']);
  assert.equal(three.label, '3.');
});

test('Fließtext und alphabetische Unterpunkte werden semantisch demselben Elternpunkt zugeordnet', () => {
  const section = hierarchyFixture(`
    <p>3. Überschrift:</p>
    <p>erläuternder Fließtext</p>
    <ol type="a"><li style="margin-left:36pt">Unterpunkt A</li><li style="margin-left:36pt">Unterpunkt B</li></ol>
    <p>4. Nächster Elternpunkt</p>`);
  const [three, four] = section.children.filter((block) => block.type === 'item');
  assert.equal(three.children[0].type, 'paragraphText');
  assert.deepEqual(three.children.slice(1).map((block) => block.label), ['a.', 'b.']);
  assert.equal(four.label, '4.');
});

test('CSS-Einrückung verbindet technisch verschiedene Google-Docs-Listen-IDs', () => {
  const css = `
    .lst-kix_parent-0>li:before{content:counter(lst-ctn-kix_parent-0,decimal) ". "}
    .lst-kix_child-0>li:before{content:counter(lst-ctn-kix_child-0,lower-latin) ") "}
    ol.lst-kix_parent-0.start{counter-reset:lst-ctn-kix_parent-0 0}
    ol.lst-kix_child-0.start{counter-reset:lst-ctn-kix_child-0 0}`;
  const section = hierarchyFixture(`
    <ol class="lst-kix_parent-0 start"><li style="margin-left:0">Elternpunkt:</li></ol>
    <ol class="lst-kix_child-0 start"><li style="margin-left:36pt">Unterpunkt A</li><li style="margin-left:36pt">Unterpunkt B</li></ol>`, css);
  const parent = section.children.find((block) => block.type === 'item');
  assert.equal(parent.listId, 'parent');
  assert.deepEqual(parent.children.map((block) => block.label), ['a)', 'b)']);
  assert.ok(parent.children.every((block) => block.listId === 'child'));
});

test('eine durch Fließtext getrennte neue Liste bleibt trotz neuer Listen-ID unabhängig', () => {
  const section = hierarchyFixture(`
    <p>1. Erster Punkt</p>
    <p>Eigenständiger neuer Sachabschnitt.</p>
    <ol type="a"><li style="margin-left:36pt">Unabhängiger Punkt A</li><li style="margin-left:36pt">Unabhängiger Punkt B</li></ol>`);
  const one = section.children.find((block) => block.label === '1.');
  assert.deepEqual(one.children, []);
  assert.deepEqual(section.children.filter((block) => block.type === 'item').map((block) => block.label), ['1.', 'a.', 'b.']);
});

test('ein allein gedruckter Dezimalanker erhält die unmittelbar folgende alphabetische Unterliste', () => {
  const section = hierarchyFixture(`
    <p>1. Erster Punkt</p>
    <p>2.</p>
    <ol type="a"><li>Unterpunkt A</li><li>Unterpunkt B</li></ol>
    <p>3. Nächster Elternpunkt</p>`);
  const [one, two, three] = section.children.filter((block) => block.type === 'item');
  assert.equal(one.label, '1.');
  assert.equal(two.label, '2.');
  assert.equal(two.text, '');
  assert.deepEqual(two.children.map((block) => block.label), ['a.', 'b.']);
  assert.equal(three.label, '3.');
});

test('die reale Helsinki-Quelle verliert keine allein gedruckten Gliederungsanker', async () => {
  const fileName = 'OVertrBl. 2026 Nr. 1.html';
  const html = await readFile(new URL(`../Gesetze/${fileName}`, import.meta.url), 'utf8');
  const parsed = parsePublicationHtml(fileName, html);
  const flat = [parsed.body, ...parsed.introducedNorms.map((norm) => norm.body)]
    .flatMap((body) => flatten(body).map(({ block }) => block));
  assert.equal(flat.filter((block) => block.type === 'paragraphText' && /^\d+\.$/u.test(block.text)).length, 0);
  assert.ok(flat.some((block) => block.label === '2.' && block.children?.some((child) => /^a[.)]$/u.test(child.label))));
});

test('reale Förderrichtlinienstruktur erhält Eltern, Fortsetzungstext und Unterlisten', async () => {
  const fileName = 'StAnzO. 2026 Nr. 5.html';
  const html = await readFile(new URL(`../Gesetze/${fileName}`, import.meta.url), 'utf8');
  const parsed = parsePublicationHtml(fileName, html);
  const sections = Object.fromEntries(['I.', 'IV.', 'VI.', 'VII.'].map((label) => [
    label,
    parsed.body.find((block) => block.label === label && block.children?.some((child) => child.type === 'item')),
  ]));
  const item = (section, label) => sections[section].children.find((block) => block.label === label);
  assert.deepEqual(item('I.', '2.').children.map((block) => block.label), ['-', '-', '-']);
  assert.equal(item('IV.', '1.').children[0].type, 'paragraphText');
  assert.deepEqual(item('IV.', '3.').children.slice(1).map((block) => block.label), ['a)', 'b)']);
  assert.equal(item('VI.', '1.').children[0].type, 'paragraphText');
  assert.equal(
    item('VI.', '1.').children[0].text,
    'Ostdeutsche Aufbaubank (OAB) Gerberstraße 5 04105 Leipzig.',
  );
  assert.deepEqual(item('VI.', '2.').children.map((block) => block.label), ['a)', 'b)']);
  assert.deepEqual(item('VII.', '1.').children.map((block) => block.label), ['a)', 'b)']);
  assert.equal(item('IV.', '4.').level, 0);
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
  assert.equal(table.children[0].children[0].scope, 'col');
  assert.equal(table.children[0].children[1].scope, 'colgroup');
  assert.equal(table.children[1].children[0].scope, 'col');
});

test('HTML-Tabellen erhalten explizite Scopes und erfinden bei uneindeutigen Kopfzellen keinen Scope', () => {
  const html = `<!doctype html><html><head><style></style></head><body>
    <p>Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland</p>
    <p>Nr. 98</p><p>Ausgegeben zu Dresden am 21. Juli 2026</p>
    <p>Inhaltsverzeichnis</p><p>20. Juli 2026 Testgesetz Seite 2</p>
    <p>Gesetz<br>über einen Scopetest<br>vom 20. Juli 2026</p>
    <h2>§ 1<br>Tabelle</h2>
    <table><tbody>
      <tr><th scope="rowgroup" rowspan="2">Gruppe</th><td>A</td></tr>
      <tr><td>B</td></tr>
      <tr><th>Uneindeutig</th><td>C</td></tr>
      <tr><td>D</td><th>Uneindeutige Kopfzelle</th></tr>
    </tbody></table>
    <h2>§ 2<br>Inkrafttreten</h2><p>Dieses Gesetz tritt am Tag nach seiner Verkündung in Kraft.</p>
    <p>Dresden, den 20. Juli 2026</p></body></html>`;
  const parsed = parsePublicationHtml('scope-test.html', html);
  const table = flatten(parsed.body).find(({ block }) => block.type === 'table')?.block;
  assert.equal(table.children[0].children[0].scope, 'rowgroup');
  assert.equal(table.children[2].children[0].scope, 'row');
  assert.equal(table.children[0].children[1].scope, undefined);
  assert.equal(table.children[3].children[1].scope, undefined);
});
