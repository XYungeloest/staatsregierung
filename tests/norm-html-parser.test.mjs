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

// Kopf, Inhaltsverzeichnis, CSS, eingebettete Bilder und Signaturblöcke gehören nie in einen Normkörper.
const IMPORT_ARTEFACTS = /data:image|;base64,|@import|Inhaltsverzeichnis|Dresden, den|LANDTAGSPRÄSIDENT/u;

function itemAt(parsed, path) {
  const [sectionLabel, itemLabel] = path.split('|');
  const section = parsed.body.find((block) => block.label === sectionLabel && block.children?.some((child) => child.type === 'item'));
  return section?.children.find((block) => block.label === itemLabel);
}

test('PDF-geprüfte Strukturfixtures sichern die amtlichen HTML-Quellen strukturtreu und artefaktfrei', async () => {
  for (const [fileName, fixture] of Object.entries(complexHtmlStructureFixtures)) {
    const html = await readFile(new URL(`../Gesetze/${fileName}`, import.meta.url), 'utf8');
    if (fixture.consolidated) {
      const parsed = parseConsolidatedHtml(fileName, html, { title: fixture.title });
      assert.deepEqual(validateConstitutionParserContract(parsed), [], fileName);
      for (const [label, children] of Object.entries(fixture.labelChildren ?? {})) {
        const block = flatten(parsed.body).find((entry) => entry.block.label === label)?.block;
        assert.deepEqual(block?.children.map((child) => child.label), children, `${fileName}: ${label}`);
      }
      assert.doesNotMatch(bodyText(parsed), IMPORT_ARTEFACTS, fileName);
      continue;
    }
    assert.equal(classifyHtmlSource(fileName, html).kind, 'publication', fileName);
    const parsed = parsePublicationHtml(fileName, html);
    assert.deepEqual(validatePublicationParserContract(parsed), [], fileName);
    const summary = summarizeParsedSource(parsed);
    const flat = flatten(parsed.body);
    const allBlocks = [parsed.body, ...parsed.introducedNorms.map((norm) => norm.body)].flatMap((body) => flatten(body).map((entry) => entry.block));
    if (fixture.outerArticles) assert.deepEqual(summary[0].outerArticles, fixture.outerArticles, `${fileName}: äußere Artikel`);
    if (fixture.outerParagraphs) assert.deepEqual(summary[0].outerParagraphs, fixture.outerParagraphs, `${fileName}: äußere Paragraphen`);
    if (fixture.introducedCount !== undefined) assert.equal(parsed.introducedNorms.length, fixture.introducedCount, `${fileName}: eingeführte Normen`);
    if (fixture.introducedLastStructures) assert.deepEqual(summary.slice(1).map((entry) => entry.lastStructure), fixture.introducedLastStructures, `${fileName}: eingeführte Normen`);
    if (fixture.introducedAbbreviations) assert.deepEqual(parsed.introducedNorms.map((norm) => norm.abbr), fixture.introducedAbbreviations, `${fileName}: Abkürzungen`);
    if (fixture.number1Children) {
      const article1 = parsed.body.find((block) => block.label === 'Artikel 1');
      const number1 = article1?.children.find((block) => block.label === '1.');
      assert.deepEqual(number1?.children.map((child) => child.label), fixture.number1Children, `${fileName}: Geschwister unter Nummer 1`);
      assert.equal(number1?.children.filter((block) => block.label === fixture.number1Children[0]).length, 1, `${fileName}: kein doppeltes Gliederungszeichen unter Nummer 1`);
      if (fixture.number1FirstChildPath) {
        assert.deepEqual([number1?.children[0]?.label, number1?.children[0]?.children?.[0]?.label], fixture.number1FirstChildPath, `${fileName}: Verschachtelung unter Nummer 1`);
      }
    }
    if (fixture.quotedStructure) assert.ok(flat.some(({ block, insideQuote }) => insideQuote && block.type === fixture.quotedStructure), `${fileName}: zitierte Struktur ${fixture.quotedStructure}`);
    if (fixture.quotedLabel) assert.ok(flat.some(({ block, insideQuote }) => insideQuote && block.label === fixture.quotedLabel), `${fileName}: zitierte Struktur ${fixture.quotedLabel}`);
    if (fixture.quotedArticle) {
      const quotedArticle = flat.find(({ block, insideQuote }) => insideQuote && block.type === 'article' && block.label === fixture.quotedArticle)?.block;
      assert.ok(quotedArticle, `${fileName}: zitierter Artikel ${fixture.quotedArticle}`);
      assert.deepEqual(quotedArticle.children.map((child) => child.label), fixture.quotedParagraphs, `${fileName}: Absätze in ${fixture.quotedArticle}`);
    }
    if (fixture.articleQuotedFirstChild) {
      const article = parsed.body.find((block) => block.label === fixture.articleQuotedFirstChild.article);
      assert.equal(article?.children[0]?.type, 'quotedProvision', `${fileName}: ${fixture.articleQuotedFirstChild.article} beginnt mit einem Zitat`);
      assert.equal(article?.children[0]?.children[0]?.label, fixture.articleQuotedFirstChild.label, `${fileName}: erste zitierte Gliederung`);
    }
    for (const type of fixture.noTopLevel ?? []) assert.ok(!parsed.body.some((block) => block.type === type), `${fileName}: ${type} nur innerhalb des Zitats`);
    if (fixture.tableCount !== undefined) assert.equal(summary[0].tableCount, fixture.tableCount, `${fileName}: Tabellen`);
    for (const [label, type] of Object.entries(fixture.labelTypes ?? {})) assert.equal(allBlocks.find((block) => block.label === label)?.type, type, `${fileName}: Blocktyp von ${label}`);
    for (const [label, count] of Object.entries(fixture.labelCounts ?? {})) assert.equal(allBlocks.filter((block) => block.label === label).length, count, `${fileName}: Häufigkeit von ${label}`);
    if (fixture.firstBlockType) assert.equal(parsed.body[0]?.type, fixture.firstBlockType, `${fileName}: erster Block`);
    if (fixture.noStandaloneDecimalAnchors) assert.equal(allBlocks.filter((block) => block.type === 'paragraphText' && /^\d+\.$/u.test(block.text)).length, 0, `${fileName}: allein gedruckte Dezimalanker`);
    for (const label of fixture.decimalWithLetterChildren ?? []) assert.ok(allBlocks.some((block) => block.label === label && block.children?.some((child) => /^a[.)]$/u.test(child.label))), `${fileName}: ${label} trägt eine Buchstabenunterliste`);
    for (const [path, labels] of Object.entries(fixture.itemChildrenLabels ?? {})) assert.deepEqual(itemAt(parsed, path)?.children.filter((child) => child.type === 'item').map((child) => child.label), labels, `${fileName}: Unterpunkte von ${path}`);
    for (const path of fixture.itemsWithLeadingText ?? []) assert.equal(itemAt(parsed, path)?.children[0]?.type, 'paragraphText', `${fileName}: Fortsetzungstext unter ${path}`);
    for (const path of fixture.topLevelItems ?? []) assert.equal(itemAt(parsed, path)?.level, 0, `${fileName}: ${path} bleibt auf der Elternebene`);
    assert.deepEqual(validateListSequences(parsed.body), [], `${fileName}: Listensequenzen`);
    for (const norm of [parsed, ...parsed.introducedNorms]) assert.doesNotMatch(bodyText(norm), IMPORT_ARTEFACTS, fileName);
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

test('redaktionelles HTML wird nicht als Norm klassifiziert', () => {
  const html = '<!doctype html><html><body><h1>Pressemitteilung</h1><p>Begleittext zu einem Gesetz.</p></body></html>';
  assert.equal(classifyHtmlSource('PM-21072026-03.html', html).kind, 'editorial');
});

test('eine Ausgabe ohne Rechtsvorschrift bleibt Verkündungsblatt, ist aber keine Normquelle', () => {
  const gazette = (content) => `<!doctype html><html><head><style></style></head><body>
    <p>Staatsanzeiger für den Freistaat Ostdeutschland</p>
    <p>Nr. 99</p><p>Ausgegeben zu Dresden am 27. August 2026</p>
    <p>Inhaltsverzeichnis</p>${content}
    <p>Dresden, den 27. August 2026</p></body></html>`;
  const report = classifyHtmlSource('ausgabe-ohne-norm.html', gazette(`
    <p>27. August 2026 Bericht über einen Prüfvorgang Seite 2</p>
    <p>Bericht<br>über einen Prüfvorgang<br>vom 27. August 2026</p>
    <p>Dieser Bericht begründet keine unmittelbar geltenden Rechte oder Pflichten.</p>`));
  assert.equal(report.kind, 'publication');
  assert.equal(report.publication, 'StAnzO.');
  assert.equal(report.normative, false);

  const notice = classifyHtmlSource('ausgabe-mit-norm.html', gazette(`
    <p>27. August 2026 Bekanntmachung über einen Prüfvorgang Seite 2</p>
    <p>Bekanntmachung<br>über einen Prüfvorgang<br>vom 27. August 2026</p>
    <h2>I.<br>Gegenstand</h2><p>Bekannt gemacht wird ein Prüfvorgang.</p>`));
  assert.equal(notice.kind, 'publication');
  assert.equal(notice.normative, true);
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

test('gesperrt gesetzte Unterschriften werden als eigener Block erfasst, Seitenangaben entfallen', () => {
  const html = `<!doctype html><html><head><style></style></head><body>
    <p>Gesetz- und Verordnungsblatt f\u00fcr den Freistaat Ostdeutschland</p>
    <p>Nr. 97</p><p>Ausgegeben zu Dresden am 21. Juli 2026</p>
    <p>Inhaltsverzeichnis</p><p>20. Juli 2026 Testgesetz Seite 2</p>
    <p>Gesetz<br>\u00fcber einen Unterschriftentest<br>vom 20. Juli 2026</p>
    <h2>\u00a7 1<br>Inkrafttreten</h2><p>Dieses Gesetz tritt am Tag nach seiner Verk\u00fcndung in Kraft.</p>
    <p><span>Alex Beispiel<br></span><span>D e r &nbsp; M I N I S T E R P R &Auml; S I D E N T &nbsp; d e s</span></p>
    <p><span>F R E I S T A A T E S &nbsp; O S T D E U T S C H L A N D</span></p>
    <div><p>Seite </p></div></body></html>`;
  const parsed = parsePublicationHtml('unterschriftentest.html', html);
  const signatures = flatten(parsed.body).filter(({ block }) => block.type === 'signature').map(({ block }) => block);
  assert.equal(signatures.length, 1);
  assert.equal(signatures[0].text, 'Alex Beispiel');
  assert.equal(signatures[0].title, 'Der Ministerpr\u00e4sident des Freistaates Ostdeutschland');
  assert.equal(signatures[0].children, undefined);
  // Der Unterschriftenblock steht auf Dokumentebene, nicht in der letzten Vorschrift.
  assert.equal(parsed.body.at(-1).type, 'signature');
  assert.doesNotMatch(bodyText(parsed), /Seite/u);
});

test('mehrere Unterschriften einer Ausgabe bleiben getrennt und tragen die Amtsbezeichnung in Normalschreibung', () => {
  const html = `<!doctype html><html><head><style></style></head><body>
    <p>Gesetz- und Verordnungsblatt f\u00fcr den Freistaat Ostdeutschland</p>
    <p>Nr. 96</p><p>Ausgegeben zu Dresden am 21. Juli 2026</p>
    <p>Inhaltsverzeichnis</p><p>20. Juli 2026 Testgesetz Seite 2</p>
    <p>Gesetz<br>\u00fcber einen zweiten Unterschriftentest<br>vom 20. Juli 2026</p>
    <h2>\u00a7 1<br>Inkrafttreten</h2><p>Dieses Gesetz tritt am Tag nach seiner Verk\u00fcndung in Kraft.</p>
    <p><span>Alex Beispiel<br></span><span>D e r &nbsp; M I N I S T E R P R &Auml; S I D E N T</span></p>
    <p><span>Kim Muster<br></span><span>D i e &nbsp; S T A A T S M I N I S T E R I N &nbsp; D E S &nbsp; I N N E R N,</span></p>
    <p><span>B A U &nbsp; U N D &nbsp; F &Uuml; R &nbsp; K O M M U N A L E S</span></p>
    </body></html>`;
  const parsed = parsePublicationHtml('unterschriftentest-2.html', html);
  const signatures = flatten(parsed.body).filter(({ block }) => block.type === 'signature').map(({ block }) => block);
  assert.deepEqual(signatures.map((block) => [block.text, block.title]), [
    ['Alex Beispiel', 'Der Ministerpr\u00e4sident'],
    ['Kim Muster', 'Die Staatsministerin des Innern, Bau und f\u00fcr Kommunales'],
  ]);
});

test('gesperrte Hervorhebungen werden als gew\u00f6hnliches Wort gespeichert', () => {
  const html = `<!doctype html><html><head><style></style></head><body>
    <p>Gesetz- und Verordnungsblatt f\u00fcr den Freistaat Ostdeutschland</p>
    <p>Nr. 95</p><p>Ausgegeben zu Dresden am 21. Juli 2026</p>
    <p>Inhaltsverzeichnis</p><p>20. Juli 2026 Testgesetz Seite 2</p>
    <p>Gesetz<br>\u00fcber einen Hervorhebungstest<br>vom 20. Juli 2026</p>
    <h2>\u00a7 1<br>Hervorhebung</h2>
    <p>Der Antrag s o l l bis zum Ablauf der Frist gestellt werden.</p>
    <p>A n l a g e : \u00dcbersicht der Fristen</p>
    <h2>\u00a7 2<br>Inkrafttreten</h2><p>Dieses Gesetz tritt am Tag nach seiner Verk\u00fcndung in Kraft.</p>
    <p>Dresden, den 20. Juli 2026</p></body></html>`;
  const parsed = parsePublicationHtml('hervorhebungstest.html', html);
  const texts = flatten(parsed.body).map(({ block }) => block.text).filter(Boolean);
  assert.ok(texts.some((text) => text.includes('soll bis zum Ablauf der Frist')), texts.join(' | '));
  // „A n l a g e :“ ist eine Gliederungs\u00fcberschrift; auch dort steht der Sperrsatz aufgel\u00f6st.
  assert.match(bodyText(parsed), /Anlage/u);
  assert.doesNotMatch(bodyText(parsed), /s o l l|A n l a g e/u);
});

test('gesperrter Satz au\u00dferhalb eines Unterschriftenblocks bricht den Import ab', () => {
  const html = `<!doctype html><html><head><style></style></head><body>
    <p>Gesetz- und Verordnungsblatt f\u00fcr den Freistaat Ostdeutschland</p>
    <p>Nr. 94</p><p>Ausgegeben zu Dresden am 21. Juli 2026</p>
    <p>Inhaltsverzeichnis</p><p>20. Juli 2026 Testgesetz Seite 2</p>
    <p>Gesetz<br>\u00fcber einen Sperrsatztest<br>vom 20. Juli 2026</p>
    <h2>\u00a7 1<br>Sperrsatz</h2>
    <p>D e r &nbsp; A N T R A G &nbsp; b l e i b t &nbsp; g e s p e r r t und wird nicht aufgel\u00f6st, weil die Quelle Wortgrenzen f\u00fchrt.</p>
    <h2>\u00a7 2<br>Inkrafttreten</h2><p>Dieses Gesetz tritt am Tag nach seiner Verk\u00fcndung in Kraft.</p>
    <p>Dresden, den 20. Juli 2026</p></body></html>`;
  const parsed = parsePublicationHtml('sperrsatztest.html', html);
  // Der Sperrsatz ist aufgel\u00f6st; im Normk\u00f6rper bleibt kein gesperrter Text zur\u00fcck.
  assert.doesNotMatch(bodyText(parsed), /(?<!\p{L})\p{L}(?: \p{L}){3,}(?!\p{L})/u);
});
