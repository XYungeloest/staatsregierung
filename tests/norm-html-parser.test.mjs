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
  ACCEPTED_SEQUENCE_ISSUES,
  acceptedSequenceIssuesFor,
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
    const parsed = parsePublicationHtml(fileName, html, { acceptedSequenceIssues: acceptedSequenceIssuesFor(fileName) });
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
    assert.deepEqual(validateListSequences(parsed.body), acceptedSequenceIssuesFor(fileName), `${fileName}: Listensequenzen`);
    for (const norm of [parsed, ...parsed.introducedNorms]) assert.doesNotMatch(bodyText(norm), IMPORT_ARTEFACTS, fileName);
  }
});

test('eine amtlich belegte Nummerierungslücke wird nur mit wörtlich hinterlegtem Befund zugelassen', async () => {
  for (const [fileName, acceptance] of Object.entries(ACCEPTED_SEQUENCE_ISSUES)) {
    const html = await readFile(new URL(`../Gesetze/${fileName}`, import.meta.url), 'utf8');
    assert.ok(acceptance.evidence.length > 20, `${fileName}: Nachweis fehlt`);
    assert.throws(() => parsePublicationHtml(fileName, html), /needs-review/u, `${fileName}: ohne Freigabe bleibt der Befund ein Abbruchgrund`);
    assert.throws(
      () => parsePublicationHtml(fileName, html, { acceptedSequenceIssues: ['anderer Befund'] }),
      /needs-review/u,
      `${fileName}: ein abweichender Freigabetext lässt den Import nicht zu`,
    );
    const parsed = parsePublicationHtml(fileName, html, { acceptedSequenceIssues: acceptance.issues });
    assert.deepEqual(validateListSequences(parsed.body), acceptance.issues, `${fileName}: genau die hinterlegten Befunde bleiben sichtbar`);
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

test('Stammnormtitel direkt im Mantelartikel bilden eigenständige Normen und begrenzen ihre Gliederung', () => {
  const html = `<!doctype html><html><body>
    <p>Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland</p>
    <p>Nr. 99</p><p>Ausgegeben zu Dresden am 14. Oktober 2026</p>
    <p>Inhaltsverzeichnis</p><p>14. Oktober 2026 Gesetz zur Einführung einer Prüfregelung Seite 2</p>
    <p>Gesetz<br>zur Einführung einer Prüfregelung<br>vom 14. Oktober 2026</p>
    <h1>Artikel 1<br>Besonderes Gesetz über eine Prüfregelung<br>Prüfregelungsgesetz<br>(PrüfRG)</h1>
    <h2>Abschnitt 1<br>Grundlagen</h2><h3>§ 1<br>Aufgabe</h3><p>Die Stelle prüft den Vorgang.</p>
    <h1>Artikel 2<br>Gesetz über einen weiteren Prüfvorgang (Prüfvorgangsgesetz – PVG)</h1>
    <h2>§ 1<br>Verfahren</h2><p>Die Stelle dokumentiert den Vorgang.</p>
    <h1>Artikel 3<br>Änderung des Prüfregelungsgesetzes</h1><p>§ 1 wird aufgehoben.</p>
    <h1>Artikel 4<br>Inkrafttreten</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>
    <p>Dresden, den 14. Oktober 2026</p></body></html>`;
  const parsed = parsePublicationHtml('mantel-fixture.html', html);
  assert.equal(parsed.introducedNorms.length, 2);
  assert.equal(parsed.introducedNorms[0].title, 'Besonderes Gesetz über eine Prüfregelung');
  assert.equal(parsed.introducedNorms[0].shortTitle, 'Prüfregelungsgesetz');
  assert.equal(parsed.introducedNorms[0].abbr, 'PrüfRG');
  assert.equal(parsed.introducedNorms[1].abbr, 'PVG');
  assert.ok(parsed.body.find((b) => b.label === 'Artikel 1').children.some((b) => b.type === 'quotedProvision'));
  assert.deepEqual(parsed.body.filter((b) => b.type === 'article').map((b) => b.label), ['Artikel 1', 'Artikel 2', 'Artikel 3', 'Artikel 4']);
  assert.doesNotMatch(JSON.stringify(parsed.introducedNorms.map((n) => n.body)), /Änderung des Prüfregelungsgesetzes|Inkrafttreten/u);
});

test('ein zitierter Inhaltsübersichtseintrag mit Schlusspunkt endet vor einem neuen Listenbezeichner', () => {
  const section = hierarchyFixture(`
    <ol start="1"><li>In der Inhaltsübersicht wird folgende Angabe eingefügt:</li></ol>
    <h3>„§ 1a Förderung“.</h3>
    <ol start="2"><li>Nach § 1 wird folgender § 1a eingefügt:</li></ol>
    <h3>„§ 1a<br>Förderung</h3>
    <p>(1) Die Förderung wird ermöglicht.</p>
    <p>(2) Die Voraussetzungen bleiben unberührt.“</p>
  `);
  const items = section.children.filter(block => block.type === 'item');
  assert.deepEqual(items.map(block => block.label), ['1.', '2.']);
  assert.equal(items[0].children[0].type, 'quotedProvision');
  assert.equal(items[0].children[0].children[0].children.length, 0);
  const provision = items[1].children[0].children[0];
  assert.equal(provision.label, '§ 1a');
  assert.equal(provision.title, 'Förderung');
  assert.deepEqual(provision.children.map(block => block.label), ['(1)', '(2)']);
});

test('mehrteilige Einführungstitel trennen Stammnorm und Schlussartikel bei beiden Überschriftenformen', () => {
  for (const combined of [false, true]) {
    const title = 'Gesetz über ein Prüfverfahren (Prüfverfahrensgesetz – PVG)';
    const intro = combined
      ? `<h1>Artikel 1<br>Einführung eines Prüf- und Verfahrensgesetzes<br>${title}</h1>`
      : `<h1>Artikel 1<br>Einführung eines Prüf- und Verfahrensgesetzes</h1><p>${title}</p>`;
    const html = `<!doctype html><html><body>
      <p>Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland</p>
      <p>Nr. 99</p><p>Ausgegeben zu Dresden am 14. Oktober 2026</p>
      <p>Inhaltsverzeichnis</p><p>14. Oktober 2026 Gesetz zur Einführung einer Prüfregelung Seite 2</p>
      <p>Gesetz<br>zur Einführung einer Prüfregelung<br>vom 14. Oktober 2026</p>
      ${intro}<h2>Abschnitt 1<br>Grundlagen</h2><h3>§ 1<br>Prüfung</h3><p>Die Stelle prüft den Vorgang.</p>
      <h1>Artikel 2<br>Inkrafttreten</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>
      <p>Dresden, den 14. Oktober 2026</p></body></html>`;
    const parsed = parsePublicationHtml('einfuehrung-fixture.html', html);
    assert.equal(parsed.introducedNorms.length, 1);
    assert.equal(parsed.introducedNorms[0].title, 'Gesetz über ein Prüfverfahren');
    assert.equal(parsed.introducedNorms[0].abbr, 'PVG');
    assert.deepEqual(parsed.body.map(b => b.label).filter(Boolean), ['Artikel 1', 'Artikel 2']);
    assert.doesNotMatch(JSON.stringify(parsed.introducedNorms[0].body), /Inkrafttreten/);
    assert.ok(flatten(parsed.body).some(({block, insideQuote}) => block.label === '§ 1' && insideQuote));
  }
});

function introductionFixture(intro, rest) {
  return `<!doctype html><html><body>
    <p>Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland</p>
    <p>Nr. 99</p><p>Ausgegeben zu Dresden am 14. Oktober 2026</p>
    <p>Inhaltsverzeichnis</p><p>14. Oktober 2026 Gesetz zur Einführung einer Prüfregelung Seite 2</p>
    <p>Gesetz<br>zur Einführung einer Prüfregelung<br>vom 14. Oktober 2026</p>
    ${intro}${rest}
    <h1>Artikel 2<br>Inkrafttreten</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>
    <p>Dresden, den 14. Oktober 2026</p></body></html>`;
}

test('ein Einführungsartikel mit einwortigem Gesetzesnamen fasst die Stammnorm als Zitat und lässt den Schlussartikel oben', () => {
  const title = 'Gesetz über ein Prüfverfahren (Prüfverfahrensgesetz – PVG)';
  const sections = '<h2>Abschnitt 1<br>Grundlagen</h2><h3>§ 1<br>Prüfung</h3><p>Die Stelle prüft den Vorgang.</p>' +
    '<h2>Abschnitt 2<br>Schlussbestimmungen</h2><h3>§ 2<br>Bericht</h3><p>Die Stelle berichtet jährlich.</p>';
  for (const intro of [
    `<h1>Artikel 1<br>Einführung eines Prüfverfahrensgesetzes</h1><p>${title}</p>`,
    `<h1>Artikel 1<br>Einführung eines Prüfverfahrensgesetzes<br>${title}</h1>`,
  ]) {
    const parsed = parsePublicationHtml('einfuehrung-kompositum-fixture.html', introductionFixture(intro, sections));
    assert.deepEqual(parsed.body.map((block) => block.label).filter(Boolean), ['Artikel 1', 'Artikel 2']);
    const [article] = parsed.body.filter((block) => block.label === 'Artikel 1');
    assert.equal(article.title, 'Einführung eines Prüfverfahrensgesetzes');
    assert.deepEqual(article.children.map((block) => block.type), ['paragraphText', 'quotedProvision']);
    assert.equal(article.children[0].text, title);
    assert.deepEqual(article.children[1].children, parsed.introducedNorms[0].body);
    assert.equal(parsed.introducedNorms[0].title, 'Gesetz über ein Prüfverfahren');
    assert.doesNotMatch(JSON.stringify(parsed.introducedNorms[0].body), /Inkrafttreten/);
    assert.ok(flatten(parsed.body).some(({ block, insideQuote }) => block.label === '§ 2' && insideQuote));
  }
});

test('gedruckte Buchstaben unter einer HTML-Nummer werden deren Unterpunkte', () => {
  const css = `
    .lst-kix_amend-0>li:before{content:counter(lst-ctn-kix_amend-0,decimal) ". "}
    ol.lst-kix_amend-0.start{counter-reset:lst-ctn-kix_amend-0 0}`;
  const section = hierarchyFixture(`
    <ol class="lst-kix_amend-0 start" start="1"><li style="margin-left:18pt">Die Inhaltsübersicht wird wie folgt geändert:</li></ol>
    <p>a. Nach der Angabe zu § 1 wird die Angabe „§ 1a Prüfung“ eingefügt.</p>
    <p>b. Nach der Angabe zu § 2 wird die Angabe „§ 2a Bericht“ eingefügt.</p>
    <p>2. In § 3 wird das Wort „Stelle“ durch das Wort „Behörde“ ersetzt.</p>`, css);
  const items = section.children.filter((block) => block.type === 'item');
  assert.deepEqual(items.map((block) => block.label), ['1.', '2.']);
  assert.deepEqual(items[0].children.map((block) => [block.label, block.level, block.numberingStyle]), [
    ['a.', 1, 'lower-latin'],
    ['b.', 1, 'lower-latin'],
  ]);
  assert.equal(items[0].children[0].text, 'Nach der Angabe zu § 1 wird die Angabe „§ 1a Prüfung“ eingefügt.');
});

test('gedruckte Buchstaben ohne vorangehende Nummer bleiben Fließtext', () => {
  const section = hierarchyFixture(`
    <p>(1) Die Stelle hat insbesondere das Recht,</p>
    <p>a. Auskunft zu verlangen,</p>
    <p>b. Unterlagen einzusehen.</p>`);
  assert.ok(section.children.every((block) => block.type !== 'item'));
});

// Verschachtelung von Listen in Änderungsbefehlen, Einführungszitaten und zitierten Neufassungen.
// Google Docs legt jede Unterliste als eigene Liste an; maßgeblich sind Einzug, Gliederungsrang
// und gedruckte Gliederungszeichen. Synthetische Fälle ohne reale Norm.
function listCss(id, level, style, before = '', after = '. ') {
  return `.lst-kix_${id}-${level}>li:before{content:"${before}" counter(lst-ctn-kix_${id}-${level},${style}) "${after}"}
    ol.lst-kix_${id}-${level}.start{counter-reset:lst-ctn-kix_${id}-${level} 0}`;
}

function nestingFixture(content, css = '') {
  const html = `<!doctype html><html><head><style>${css}</style></head><body>
    <p>Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland</p>
    <p>Nr. 99</p><p>Ausgegeben zu Dresden am 27. August 2026</p>
    <p>Inhaltsverzeichnis</p><p>27. August 2026 Richtlinie über einen Hierarchietest Seite 2</p>
    <p>Richtlinie<br>über einen Hierarchietest<br>vom 27. August 2026</p>
    <h2>I.<br>Prüfbereich</h2>${content}
    <p>Dresden, den 27. August 2026</p></body></html>`;
  const parsed = parsePublicationHtml('hierarchie-fixture.html', html);
  return { parsed, section: parsed.body.find((block) => block.label === 'I.') };
}

const listItems = (blocks) => (blocks ?? []).filter((block) => block.type === 'item' || block.type === 'subparagraph');
const listLabels = (blocks) => listItems(blocks).map((block) => block.label);
const quoteOf = (block) => block.children?.find((child) => child.type === 'quotedProvision');

function readingOrder(blocks, output = []) {
  for (const block of blocks ?? []) {
    output.push([block.label, block.text].filter(Boolean).join(' '));
    readingOrder(block.children, output);
  }
  return output.join(' ').replace(/\s+/gu, ' ');
}

const CMD = listCss('cmd', 0, 'decimal') + listCss('sub', 0, 'lower-latin', '', ') ') + listCss('sub', 1, 'lower-roman', '', ') ');

test('Buchstaben einer eigenen Liste unter einem Änderungsbefehl „… wird wie folgt geändert:“ werden dessen Unterpunkte', () => {
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li style="margin-left:36pt">§ 1 wird wie folgt geändert:</li></ol>
    <ol class="lst-kix_sub-0 start" start="1"><li style="margin-left:72pt">In Absatz 1 wird das Wort „Stelle“ durch das Wort „Behörde“ ersetzt.</li>
      <li style="margin-left:72pt">In Absatz 2 wird das Wort „unverzüglich“ gestrichen.</li></ol>
    <ol class="lst-kix_cmd-0" start="2"><li style="margin-left:36pt">§ 2 wird aufgehoben.</li></ol>`, CMD);
  assert.deepEqual(listLabels(s.children), ['1.', '2.']);
  assert.deepEqual(listLabels(listItems(s.children)[0].children), ['a)', 'b)']);
});

test('in einer zitierten Neufassung gilt dieselbe Einrückungsregel wie außerhalb des Zitats', () => {
  const css = CMD + listCss('abs', 0, 'decimal', '(', ') ') + listCss('nr', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li style="margin-left:36pt">§ 3 wird wie folgt gefasst:</li></ol>
    <h4>„§ 3<br>Ausnahmen</h4>
    <ol class="lst-kix_abs-0 start" start="1"><li style="margin-left:72pt">Ausgenommen sind:</li></ol>
    <ol class="lst-kix_nr-0 start" start="1"><li style="margin-left:108pt">Aufträge geringen Umfangs,</li><li style="margin-left:108pt">Aufträge im Notfall.</li></ol>
    <ol class="lst-kix_abs-0" start="2"><li style="margin-left:72pt">Das Nähere regelt eine Verordnung.“</li></ol>`, css);
  const paragraph = quoteOf(listItems(s.children)[0]).children.find((block) => block.type === 'paragraph');
  const [one, two] = listItems(paragraph.children);
  assert.deepEqual([one.label, two.label], ['(1)', '(2)']);
  assert.deepEqual(listLabels(one.children), ['1.', '2.']);
});

test('ein Absatz ohne Doppelpunkt behält die gespeicherte Geschwisterkonvention seiner Nummern', () => {
  const css = listCss('abs', 0, 'decimal', '(', ') ') + listCss('nr', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <h4>§ 1<br>Begriffe</h4>
    <ol class="lst-kix_abs-0 start" start="1"><li style="margin-left:36pt">Im Sinne dieser Richtlinie ist</li></ol>
    <ol class="lst-kix_nr-0 start" start="1"><li style="margin-left:72pt">Stelle jede Behörde,</li><li style="margin-left:72pt">Vorgang jede Bearbeitung.</li></ol>`, css);
  const paragraph = s.children.find((block) => block.type === 'paragraph');
  assert.deepEqual(listLabels(paragraph.children), ['(1)', '1.', '2.']);
});

test('ein Zitat endet vor dem nächsten sichtbaren Geschwister seines Änderungsbefehls trotz neuer Listen-ID', () => {
  const css = listCss('cmdA', 0, 'decimal') + listCss('cmdB', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmdA-0 start" start="2"><li style="margin-left:36pt">In § 5 wird nach Nummer 2 folgende Nummer 3 eingefügt:</li></ol>
    <p style="margin-left:72pt">„3. die Prüfung der Unterlagen,“.</p>
    <ol class="lst-kix_cmdB-0 start" start="3"><li style="margin-left:36pt">Die bisherige Nummer 3 wird Nummer 4.</li></ol>`, css);
  assert.deepEqual(listLabels(s.children), ['2.', '3.']);
  assert.equal(quoteOf(listItems(s.children)[0]).children.length, 1);
});

test('ein mit „3.“ beginnender Zitatinhalt beendet das Zitat nicht vorzeitig', () => {
  const css = listCss('cmdA', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmdA-0 start" start="2"><li style="margin-left:36pt">In § 5 werden folgende Nummern 3 und 4 angefügt:</li></ol>
    <p style="margin-left:36pt">„3. die Prüfung,</p>
    <p style="margin-left:36pt">4. die Entscheidung.“</p>
    <ol class="lst-kix_cmdA-0" start="3"><li style="margin-left:36pt">§ 6 wird aufgehoben.</li></ol>`, css);
  assert.deepEqual(listLabels(s.children), ['2.', '3.']);
  assert.deepEqual(listLabels(quoteOf(listItems(s.children)[0]).children), ['3.', '4.']);
});

test('Befehl und Unterbefehle auf zwei Listen-IDs: das Zitat eines Buchstabens endet vor dem nächsten Buchstaben', () => {
  const css = listCss('p', 0, 'decimal') + listCss('q', 7, 'lower-latin') + listCss('r', 1, 'lower-latin', '', ') ') + listCss('s', 0, 'lower-latin');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_p-0 start" start="16"><li style="margin-left:36pt">§ 29 wird wie folgt geändert:</li></ol>
    <ol class="lst-kix_q-7 start" start="1"><li style="margin-left:54pt">Absatz 1 Nummer 2 wird wie folgt neugefasst:</li></ol>
    <p style="margin-left:54pt">„die Leitung über die Beschäftigten,</p>
    <ol class="lst-kix_r-1 start" start="1"><li style="margin-left:75pt">die bei der Stelle und</li><li style="margin-left:75pt">die bei den Außenstellen</li></ol>
    <p style="margin-left:57pt">beschäftigt sind;“</p>
    <ol class="lst-kix_s-0 start" start="2"><li style="margin-left:54pt">In Absatz 2 wird das Wort „Land“ gestrichen.</li></ol>
    <ol class="lst-kix_p-0" start="17"><li style="margin-left:36pt">§ 30 wird aufgehoben.</li></ol>`, css);
  assert.deepEqual(listLabels(s.children), ['16.', '17.']);
  const sixteen = listItems(s.children)[0];
  assert.deepEqual(listLabels(sixteen.children), ['a.', 'b.']);
  assert.deepEqual(listLabels(quoteOf(listItems(sixteen.children)[0]).children), ['a)', 'b)']);
});

test('ein Einfügebefehl ohne Doppelpunkt vor einem öffnenden Anführungszeichen leitet ein Zitat ein', () => {
  const css = listCss('cmd', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li style="margin-left:36pt">Nach § 6 wird folgender § 6a eingefügt</li></ol>
    <h4>“§ 6a<br>Schutz</h4><p style="margin-left:72pt">(1) Erster Satz.</p><p style="margin-left:72pt">(2) Zweiter Satz.”</p>
    <ol class="lst-kix_cmd-0" start="2"><li style="margin-left:36pt">§ 7 wird aufgehoben.</li></ol>`, css);
  assert.deepEqual(listLabels(s.children), ['1.', '2.']);
  assert.equal(quoteOf(listItems(s.children)[0])?.children[0].label, '§ 6a');
  assert.ok(!s.children.some((block) => block.type === 'paragraph'));
});

test('„… wird wie folgt gefasst:“ vor unzitierten Unterpunkten derselben Liste bildet kein Zitat', () => {
  const css = listCss('cmd', 0, 'decimal') + listCss('cmd', 1, 'lower-latin');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li style="margin-left:36pt">§ 2 wird wie folgt gefasst:</li></ol>
    <ol class="lst-kix_cmd-1 start" start="1"><li style="margin-left:72pt">In Absatz 1 wird das Wort „Abs.“ durch das Wort „Absatz“ ersetzt.</li>
      <li style="margin-left:72pt">In Absatz 2 wird das Wort „Nr.“ durch das Wort „Nummer“ ersetzt.</li></ol>`, css);
  const one = listItems(s.children)[0];
  assert.equal(quoteOf(one), undefined);
  assert.deepEqual(listLabels(one.children), ['a.', 'b.']);
});

test('mit Zeilenumbruch gesetzte Buchstaben werden einzelne Unterpunkte der vorangehenden gedruckten Ziffer', () => {
  const { section: s } = nestingFixture(`
    <p>4. Art der Leistung</p>
    <p>4.1 Als Leistung gelten insbesondere</p>
    <p>a) die erste Leistung,<br> b) die zweite Leistung.</p>
    <p>4.2 Weitere Leistungen sind ausgeschlossen.</p>`);
  const four = listItems(s.children)[0];
  assert.deepEqual(listLabels(four.children), ['4.1', '4.2']);
  assert.deepEqual(listLabels(listItems(four.children)[0].children), ['a)', 'b)']);
  assert.equal(listItems(listItems(four.children)[0].children)[0].text, 'die erste Leistung,');
});

test('mit Zeilenumbruch gesetzte Buchstaben in einem Listenpunkt werden dessen Unterpunkte samt Zitat', () => {
  const css = listCss('cmd', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li style="margin-left:36pt">§ 7 Absatz 1 wird wie folgt geändert:<br>a) In Nummer 1 wird das Wort „und“ gestrichen.<br> b) Nach Nummer 1 wird folgende Nummer 2 eingefügt:<br> „2. die Aufsicht und“.<br> c) Die bisherige Nummer 2 wird Nummer 3.</li>
      <li style="margin-left:36pt">§ 8 wird aufgehoben.</li></ol>`, css);
  const one = listItems(s.children)[0];
  assert.equal(one.text, '§ 7 Absatz 1 wird wie folgt geändert:');
  assert.deepEqual(listLabels(one.children), ['a)', 'b)', 'c)']);
  assert.ok(quoteOf(listItems(one.children)[1]));
  assert.deepEqual(listLabels(s.children), ['1.', '2.']);
});

test('gedruckte Buchstaben unter einem tiefer eingerückten Absatz „(n)“ werden dessen Unterpunkte', () => {
  const { section: s } = nestingFixture(`
    <p style="margin-left:36pt">(2) Das Recht umfasst insbesondere das Recht,</p>
    <p style="margin-left:72pt">a. an Wahlen teilzunehmen,</p>
    <p style="margin-left:72pt">b. Eingaben zu richten.</p>
    <p style="margin-left:36pt">(3) Niemand darf benachteiligt werden.</p>`);
  const [two, three] = listItems(s.children);
  assert.deepEqual(listLabels(two.children), ['a.', 'b.']);
  assert.equal(three.label, '(3)');
});

test('Doppelbuchstaben nach einem Buchstabenpunkt werden dessen Unterpunkte, die Buchstabenliste läuft danach weiter', () => {
  const css = CMD;
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li style="margin-left:36pt">§ 13 wird wie folgt geändert:</li></ol>
    <ol class="lst-kix_sub-0 start" start="1"><li style="margin-left:72pt">In Absatz 1 wird das Wort „Land“ ersetzt.</li><li style="margin-left:72pt">Absatz 2 wird wie folgt geändert:</li></ol>
    <p style="margin-left:72pt">aa) In Satz 1 wird das Wort „Schule“ ersetzt.</p>
    <p style="margin-left:72pt">bb) In Satz 2 wird das Wort „Klasse“ ersetzt.</p>
    <ol class="lst-kix_sub-0" start="3"><li style="margin-left:72pt">Absatz 3 wird aufgehoben.</li></ol>`, css);
  const one = listItems(s.children)[0];
  assert.deepEqual(listLabels(one.children), ['a)', 'b)', 'c)']);
  assert.deepEqual(listLabels(listItems(one.children)[1].children), ['aa)', 'bb)']);
});

test('eine tiefer eingerückte, neu bei 1 beginnende Liste nach einer gedruckten Nummer ist deren Unterliste', () => {
  const css = listCss('sub', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <p>1. Ziel</p><p>Der Austausch wird erleichtert.</p>
    <p>2. Pilotberufe</p>
    <ol class="lst-kix_sub-0 start" start="1"><li style="margin-left:36pt">Pflege</li><li style="margin-left:36pt">Rettungsdienst</li></ol>
    <p>3. Koordinierung</p>`, css);
  const [, two, three] = listItems(s.children);
  assert.deepEqual(listLabels(two.children), ['1.', '2.']);
  assert.equal(three.label, '3.');
});

test('eine bei 1 beginnende Liste unmittelbar nach einer mehrstufigen Ziffer ist deren Unterliste', () => {
  const css = listCss('sub', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <p>4. Begutachtung</p>
    <p style="margin-left:36pt">4.1 Ein Gutachten ist vorzulegen.</p>
    <p style="margin-left:36pt">4.2 Das Gutachten enthält Feststellungen zu</p>
    <ol class="lst-kix_sub-0 start" start="1"><li style="margin-left:36pt">dem Hersteller,</li><li style="margin-left:36pt">dem Baujahr.</li></ol>
    <p style="margin-left:36pt">4.3 Unterlagen sind beizufügen.</p>`, css);
  const four = listItems(s.children)[0];
  assert.deepEqual(listLabels(four.children), ['4.1', '4.2', '4.3']);
  assert.deepEqual(listLabels(listItems(four.children)[1].children), ['1.', '2.']);
});

test('eine Buchstabenliste ab „a)“ unmittelbar nach einer Nummer ist deren Unterliste, nach Fließtext nicht', () => {
  const css = listCss('num', 0, 'decimal') + listCss('let', 0, 'lower-latin', '', ') ') + listCss('let2', 0, 'lower-latin', '', ') ');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_num-0 start" start="3"><li style="margin-left:36pt">Klassenstufe 8</li></ol>
    <ol class="lst-kix_let-0 start" start="1"><li style="margin-left:36pt">Der Lernbereich 2 wird gestrichen.</li><li style="margin-left:36pt">Der Lernbereich 3 wird gestrichen.</li></ol>
    <ol class="lst-kix_num-0" start="4"><li style="margin-left:36pt">Klassenstufe 9</li></ol>
    <p style="margin-left:36pt">Eigenständiger Hinweis.</p>
    <ol class="lst-kix_let2-0 start" start="1"><li style="margin-left:36pt">Unabhängiger Punkt.</li></ol>`, css);
  const [three, four] = listItems(s.children);
  assert.deepEqual(listLabels(three.children), ['a)', 'b)']);
  assert.deepEqual(listLabels(four.children), []);
});

test('ein Zitat endet vor dem nächsten römischen Abschnitt der äußeren Gliederung', () => {
  const css = listCss('cmd', 0, 'decimal');
  const { parsed } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li style="margin-left:36pt">Folgende Anlage 8 wird angefügt:</li></ol>
    <p>„Anlage 8</p><p>Muster</p><p>“</p>
    <h2>II.<br>Inkrafttreten</h2><p>Diese Richtlinie tritt am Tag nach der Verkündung in Kraft.</p>`, css);
  assert.deepEqual(parsed.body.filter((block) => block.type === 'section').map((block) => block.label), ['I.', 'II.']);
});

test('„… erhält folgende Fassung:“ leitet eine Neufassung ein', () => {
  const css = listCss('cmd', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li style="margin-left:36pt">Die Präambel erhält folgende Fassung:</li></ol>
    <p style="margin-left:72pt">„Im Bewusstsein der Verantwortung gibt sich das Land diese Ordnung.“</p>
    <ol class="lst-kix_cmd-0" start="2"><li style="margin-left:36pt">§ 1 wird aufgehoben.</li></ol>`, css);
  assert.ok(quoteOf(listItems(s.children)[0]));
  assert.deepEqual(listLabels(s.children), ['1.', '2.']);
});

test('die neue Verschachtelung verändert nie die Lesereihenfolge der Quelle', () => {
  const css = CMD + listCss('let', 0, 'lower-latin', '', ') ');
  const content = `
    <ol class="lst-kix_cmd-0 start" start="3"><li style="margin-left:36pt">Klassenstufe 8</li></ol>
    <ol class="lst-kix_let-0 start" start="1"><li style="margin-left:36pt">Der Lernbereich 2 erhält folgende Fassung:</li></ol>
    <p style="margin-left:30pt">„Lernbereich 2: Neue Fassung</p><p style="margin-left:30pt">Kennen der Grundlagen.“</p>
    <ol class="lst-kix_let-0" start="2"><li style="margin-left:36pt">Im Lernbereich 4 wird ein Satz angefügt.</li></ol>
    <ol class="lst-kix_cmd-0" start="4"><li style="margin-left:36pt">Klassenstufe 9</li></ol>`;
  const { section: s } = nestingFixture(content, css);
  assert.equal(readingOrder(s.children).replace(/„|“/gu, ''),
    '3. Klassenstufe 8 a) Der Lernbereich 2 erhält folgende Fassung: Lernbereich 2: Neue Fassung Kennen der Grundlagen. b) Im Lernbereich 4 wird ein Satz angefügt. 4. Klassenstufe 9');
});
