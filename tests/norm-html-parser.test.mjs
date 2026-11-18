import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyHtmlSource,
  inferEffectiveDate,
  normalizeOfficeTitle,
  parseStructureMarker,
  parsePublicationHtml,
  sourceFindingIssues,
  validateListSequences,
} from '../scripts/lib/norm-html-parser.mjs';
import {
  filesWithoutSourceNote,
  withSourceNotes,
} from '../scripts/lib/norm-parser-contract.mjs';

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

test('eine Ausgabe mit zugelassenem Quellbefund braucht einen Quellhinweis; Hinweise verdoppeln sich nicht', () => {
  const accepted = { 'A.html': { issues: ['x'] }, 'B.html': { issues: ['y'] }, 'C.html': { issues: ['z'] } };
  const note = { label: 'Nummerierung in der Originalquelle', text: 'Die Zählung bleibt unverändert.' };
  assert.deepEqual(filesWithoutSourceNote({
    'A.html': { 'norm-a': [note] },
    'B.html': { 'norm-b': [] },
    'D.html': { 'norm-d': [note] },
  }, accepted), ['B.html', 'C.html']);
  assert.deepEqual(filesWithoutSourceNote({ 'A.html': { 'norm-a': [{ label: 'ohne Text' }] } }, { 'A.html': { issues: ['x'] } }), ['A.html']);

  const other = { label: 'Inkrafttreten', text: 'Gilt ab Verkündung.' };
  const stale = { label: note.label, text: 'Älterer Wortlaut.' };
  assert.deepEqual(withSourceNotes([other, stale], [note]), [other, note]);
  assert.deepEqual(withSourceNotes(withSourceNotes([other], [note]), [note]), [other, note]);
  assert.deepEqual(withSourceNotes(undefined, [note]), [note]);
  assert.deepEqual(withSourceNotes([other], []), [other]);
  assert.equal(withSourceNotes(undefined, undefined), undefined);
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
  // Die zitierte Angabe der Inhaltsübersicht ist Text, keine Gliederungseinheit mit Überschrift.
  assert.deepEqual(items[0].children[0].children, [{ type: 'paragraphText', text: '„§ 1a Förderung“.' }]);
  const provision = items[1].children[0].children[0];
  assert.equal(provision.label, '§ 1a');
  assert.equal(provision.title, 'Förderung');
  assert.deepEqual(provision.children.map(block => block.label), ['(1)', '(2)']);
});

test('ein Befehl „wird ersetzt durch:“ leitet den folgenden Wortlaut als Zitat ein', () => {
  const section = hierarchyFixture(`
    <ol start="1"><li>Die Bezeichnung des Prüfabschnitts „Altes Verfahren“ wird ersetzt durch:</li></ol>
    <p>„Prüfabschnitt 2: Neues Verfahren“</p>
    <ol start="2"><li>In Nummer 3 wird das Wort „Stelle“ durch das Wort „Behörde“ ersetzt.</li></ol>
  `);
  const items = section.children.filter(block => block.type === 'item');
  assert.deepEqual(items.map(block => block.label), ['1.', '2.']);
  assert.deepEqual(items[0].children, [{
    type: 'quotedProvision',
    children: [{ type: 'paragraphText', text: '„Prüfabschnitt 2: Neues Verfahren“' }],
  }]);
  assert.ok(!flatten(items[1].children).some(({ block }) => block.type === 'quotedProvision'));
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

test('ein ganzer Satz hinter einer römischen Ordnungszahl wird erster Absatz, keine Überschrift', () => {
  const html = `<!doctype html><html><head><style></style></head><body>
    <p>Amtsblatt für den Freistaat Ostdeutschland</p>
    <p>Nr. 99</p><p>Ausgegeben zu Dresden am 27. August 2026</p>
    <p>Inhaltsverzeichnis</p><p>27. August 2026 Allgemeinverfügung über einen Ordnungstest Seite 2</p>
    <p>Allgemeinverfügung<br>über einen Ordnungstest<br>vom 27. August 2026</p>
    <p>Gemäß § 1 des Prüfgesetzes ergeht folgende Allgemeinverfügung:</p>
    <p><span style="font-weight:700">I.</span> Im Prüfzeitraum wird im bezeichneten Bereich das Mitführen von Prüfgegenständen in folgenden Grenzen untersagt:</p>
    <p>Nordbereich</p>
    <p><span style="font-weight:700">II.</span> Bei Zuwiderhandlung gegen I. kann die Prüfstelle mitgeführte Prüfgegenstände sicherstellen.</p>
    <p><span style="font-weight:700">III.</span><br>Kurze Überschrift</p>
    <p>Der Abschnitt enthält einen gewöhnlichen Satz.</p>
    <p>Dresden, den 27. August 2026</p></body></html>`;
  const sections = parsePublicationHtml('roemische-ordnungszahl-fixture.html', html).body
    .filter((block) => block.type === 'section');
  assert.deepEqual(sections.map((block) => [block.label, block.title]), [
    ['I.', undefined],
    ['II.', undefined],
    ['III.', 'Kurze Überschrift'],
  ]);
  assert.deepEqual(sections[0].children.map((block) => [block.type, block.text]), [
    ['paragraphText', 'Im Prüfzeitraum wird im bezeichneten Bereich das Mitführen von Prüfgegenständen in folgenden Grenzen untersagt:'],
    ['paragraphText', 'Nordbereich'],
  ]);
  assert.deepEqual(sections[1].children.map((block) => block.text), [
    'Bei Zuwiderhandlung gegen I. kann die Prüfstelle mitgeführte Prüfgegenstände sicherstellen.',
  ]);
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
  assert.deepEqual(listLabels(quoteOf(listItems(s.children)[0]).children), ['„3.', '4.']);
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

test('Inkrafttreten am Tag nach der Verkündung, Veröffentlichung oder Bekanntmachung', () => {
  const issued = '2026-03-24';
  assert.equal(inferEffectiveDate('§ 9 Dieses Gesetz tritt am Tage nach der Verkündung in Kraft.', issued), '2026-03-25');
  assert.equal(inferEffectiveDate('Die Verordnung tritt am Tag nach ihrer Verkündung in Kraft.', issued), '2026-03-25');
  assert.equal(inferEffectiveDate('Diese Förderrichtlinie tritt am Tag nach der Veröffentlichung in Kraft.', issued), '2026-03-25');
  assert.equal(inferEffectiveDate('Diese Verwaltungsvorschrift tritt am Tage nach ihrer Bekanntmachung in Kraft.', issued), '2026-03-25');
  assert.equal(inferEffectiveDate('Diese Richtlinie tritt am Tag nach der Bekanntgabe in Kraft.', '2026-12-31'), '2027-01-01');
  assert.equal(inferEffectiveDate('Diese Verwaltungsvorschrift tritt am Tag ihrer Veröffentlichung in Kraft.', issued), issued);
  // Ein „Tag nach …“ an anderer Stelle des Normtextes verschiebt das Inkrafttreten nicht.
  assert.equal(
    inferEffectiveDate('Anträge sind bis zum zehnten Tag nach Zugang zu stellen. Dieses Gesetz tritt am Tag seiner Verkündung in Kraft.', issued),
    issued,
  );
  assert.equal(inferEffectiveDate('Die Verordnung tritt am 1. Mai 2026 in Kraft.', issued), '2026-05-01');
  assert.equal(inferEffectiveDate('Keine Inkrafttretensregel.', issued), null);
});

// Synthetische Strukturregeln eigener HTML-Ausgaben.

function articleFixture(content, css = '') {
  const html = `<!doctype html><html><head><style>${css}</style></head><body>
    <p>Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland</p>
    <p>Nr. 99</p><p>Ausgegeben zu Dresden am 14. Oktober 2026</p>
    <p>Inhaltsverzeichnis</p><p>14. Oktober 2026 Gesetz zur Änderung eines Prüfgesetzes Seite 2</p>
    <p>Gesetz<br>zur Änderung eines Prüfgesetzes<br>vom 14. Oktober 2026</p>
    ${content}
    <p>Dresden, den 14. Oktober 2026</p></body></html>`;
  return parsePublicationHtml('artikel-fixture.html', html);
}

test('Silbentrennung am Zeilenende einer Überschrift wird verbunden, Ergänzungsstriche bleiben', () => {
  const parsed = articleFixture(`<h1>Artikel 1<br>Änderung des Prüfstellen-<br>gesetzes</h1><p>Das Gesetz wird aufgehoben.</p>
    <h1>Artikel 2<br>Daten-<br>und Prüfstandards</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>`);
  assert.deepEqual(parsed.body.filter((block) => block.type === 'article').map((block) => block.title),
    ['Änderung des Prüfstellengesetzes', 'Daten- und Prüfstandards']);
});

test('ein zitierter Absatz hinter dem öffnenden Anführungszeichen bleibt Absatz; das Zeichen steht wie bei zitierten Punkten in der Bezeichnung', () => {
  const css = listCss('cmd', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li style="margin-left:36pt">Die Absätze 3 und 4 werden wie folgt gefasst:</li></ol>
    <p>„(3) Die Kosten trägt die Stelle.</p><p>(4) Das Nähere regelt eine Verordnung.“</p>
    <ol class="lst-kix_cmd-0" start="2"><li style="margin-left:36pt">§ 5 wird aufgehoben.</li></ol>`, css);
  const quote = quoteOf(listItems(s.children)[0]);
  assert.deepEqual(quote.children.map((block) => [block.type, block.label]), [['subparagraph', '„(3)'], ['subparagraph', '(4)']]);
  assert.equal(quote.children[0].text, 'Die Kosten trägt die Stelle.');
  assert.equal(quote.children[1].text, 'Das Nähere regelt eine Verordnung.“');
});

test('eine Ordnungszahl als Namensbestandteil in einer ungezählten Aufzählung bleibt Text', () => {
  const css = listCss('cmd', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li>Absatz 1 wird wie folgt gefasst:</li></ol>
    <p>„(1) Festtage sind:</p><p>Tag der Einheit (3. Oktober),</p><p>1. Festtag (25. Dezember),</p><p>2. Festtag (26. Dezember).“</p>`, css);
  const quote = quoteOf(listItems(s.children)[0]);
  assert.deepEqual(quote.children.slice(1).map((block) => [block.type, block.text]), [
    ['paragraphText', 'Tag der Einheit (3. Oktober),'], ['paragraphText', '1. Festtag (25. Dezember),'], ['paragraphText', '2. Festtag (26. Dezember).“'],
  ]);
});

test('„… vorangestellt:“ leitet ein Zitat ein; ein vorzeitig geschlossenes Zitat läuft bis zum nächsten Befehl', () => {
  const css = listCss('cmd', 0, 'decimal') + listCss('cmd', 1, 'lower-latin');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li style="margin-left:36pt">§ 1 wird wie folgt geändert:</li></ol>
    <ol class="lst-kix_cmd-1 start" start="1"><li style="margin-left:72pt">Der Nummer 1 werden folgende Nummern 1 und 2 vorangestellt:</li></ol>
    <p style="margin-left:108pt">„1. für Prüfzwecke,</p><p style="margin-left:108pt">2. für Lehrzwecke,“</p>
    <ol class="lst-kix_cmd-0" start="2"><li style="margin-left:36pt">§ 4 wird wie folgt gefasst:</li></ol>
    <p>„§ 4</p><p>Auskunft</p><p>(1) Auskunft ist zu erteilen.“</p><p>§ 4a</p><p>Betreten</p><p>(1) Das Betreten ist zu dulden.“</p>
    <ol class="lst-kix_cmd-0" start="3"><li style="margin-left:36pt">§ 6 wird aufgehoben.</li></ol>`, css);
  const [one, two, three] = listItems(s.children);
  assert.deepEqual(listLabels(quoteOf(listItems(one.children)[0]).children), ['„1.', '2.']);
  assert.deepEqual(quoteOf(two).children.map((block) => [block.label, block.title]), [['§ 4', 'Auskunft'], ['§ 4a', 'Betreten']]);
  assert.equal(three.label, '3.');
});

test('zitierte Angaben einer Inhaltsübersicht sind Textzeilen ohne Gliederungseinheit', () => {
  const css = listCss('cmd', 0, 'decimal') + listCss('cmd', 1, 'lower-latin');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li style="margin-left:36pt">Die Inhaltsübersicht wird wie folgt geändert:</li></ol>
    <ol class="lst-kix_cmd-1 start" start="1"><li style="margin-left:72pt">Die Angabe zu Abschnitt 2 wird wie folgt gefasst:</li></ol>
    <p>„Abschnitt 2</p><p>Prüfstellen“</p>
    <ol class="lst-kix_cmd-1" start="2"><li style="margin-left:72pt">Nach der Angabe zu § 4 werden folgende Angaben eingefügt:</li></ol>
    <p>„§ 4a Prüfung<br>§ 4b Bericht“.</p>
    <ol class="lst-kix_cmd-0" start="2"><li style="margin-left:36pt">Nach § 4 wird folgender § 4a eingefügt:</li></ol>
    <h4>„§ 4a<br>Prüfung</h4><p>Die Stelle prüft.“</p>`, css);
  const [one, two] = listItems(s.children);
  const [a, b] = listItems(one.children);
  assert.deepEqual(quoteOf(a).children, [{ type: 'paragraphText', text: '„Abschnitt 2 Prüfstellen“' }]);
  assert.deepEqual(quoteOf(b).children.map((block) => block.text), ['„§ 4a Prüfung', '§ 4b Bericht“.']);
  assert.equal(quoteOf(two).children[0].label, '§ 4a');
});

test('ein angefügter Satz, der mit einer Artikelverweisung beginnt, ist Text und kein Artikel', () => {
  const parsed = articleFixture(`<h1>Artikel 1<br>Änderung des Prüfgesetzes</h1>
    <p>Dem § 5 Absatz 1 wird folgender Satz angefügt:</p><p>Artikel 9a der Verfassung bleibt unberührt.“</p>
    <h1>Artikel 2<br>Inkrafttreten</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>`);
  const article = parsed.body.find((block) => block.label === 'Artikel 1');
  assert.deepEqual(article.children[1].children, [{ type: 'paragraphText', text: 'Artikel 9a der Verfassung bleibt unberührt.“' }]);
});

test('die in eigener Zeile gleich gesetzte Überschrift einer römischen Gliederung oder Anlage wird deren Überschrift', () => {
  const html = `<!doctype html><html><head><style>.z{text-align:center}</style></head><body>
    <p>Staatsanzeiger für den Freistaat Ostdeutschland</p><p>Nr. 99</p><p>Ausgegeben zu Dresden am 14. Oktober 2026</p>
    <p>Inhaltsverzeichnis</p><p>14. Oktober 2026 Förderrichtlinie über einen Prüfzuschuss Seite 2</p>
    <p class="z">Förderrichtlinie<br>über einen Prüfzuschuss<br>vom 14. Oktober 2026</p>
    <p class="z">I.</p><p class="z">Zuwendungszweck</p><p>Gefördert wird die Prüfung.</p>
    <h3>Anlage 1<br>(zu Nummer 1)</h3><h3>Prüfmuster</h3><p>Muster.</p>
    <p>Dresden, den 14. Oktober 2026</p></body></html>`;
  const parsed = parsePublicationHtml('ueberschrift-fixture.html', html);
  assert.deepEqual(parsed.body.map((block) => [block.label, block.title]), [['I.', 'Zuwendungszweck'], ['Anlage 1 (zu Nummer 1)', 'Prüfmuster']]);
  assert.deepEqual(parsed.body[0].children.map((block) => block.text), ['Gefördert wird die Prüfung.']);
});

test('eine mit Ordnungswort bezeichnete zitierte Gliederung („Dritter Abschnitt“) ist ein Abschnitt', () => {
  const parsed = articleFixture(`<h1>Artikel 1<br>Änderung des Prüfgesetzes</h1>
    <p>Nach § 9 wird folgender Abschnitt eingefügt:</p><p>„Dritter Abschnitt<br>Prüfstellen</p><p>§ 9a<br>Prüfstellen</p><p>Die Stellen werden errichtet.“</p>
    <h1>Artikel 2<br>Inkrafttreten</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>`);
  const quote = parsed.body.find((block) => block.label === 'Artikel 1').children[1];
  assert.equal(quote.children[0].type, 'section');
  assert.deepEqual([quote.children[0].label, quote.children[0].title, quote.children[0].children[0].label], ['Dritter Abschnitt', 'Prüfstellen', '§ 9a']);
});

test('ein nach Zeilenumbruch im Listenpunkt gesetztes Zitat wird vom Befehl getrennt', () => {
  const css = listCss('cmd', 0, 'decimal');
  const parsed = articleFixture(`<h1>Artikel 1<br>Änderung der Verfassung</h1>
    <ol class="lst-kix_cmd-0 start" start="1"><li>Artikel 2 wird wie folgt gefasst:<br>„Artikel 2<br>Grundsatz</li>
    <li>Absatz 3 wird wie folgt gefasst:<br>„(3) Das Nähere regelt ein Gesetz.“</li></ol>
    <p>Der Freistaat ist ein Rechtsstaat.“</p>
    <ol class="lst-kix_cmd-0" start="3"><li>Artikel 4 wird aufgehoben.</li></ol>
    <h1>Artikel 2<br>Inkrafttreten</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>`, css);
  const [one, two] = listItems(parsed.body.find((block) => block.label === 'Artikel 1').children);
  assert.equal(one.text, 'Artikel 2 wird wie folgt gefasst:');
  assert.equal(two.text, 'Absatz 3 wird wie folgt gefasst:');
  assert.deepEqual([quoteOf(two).children[0].type, quoteOf(two).children[0].label], ['subparagraph', '„(3)']);
});

test('mit Zeilenumbruch in einem Absatz gesetzte Absätze bleiben eigene Absätze', () => {
  const parsed = articleFixture(`<h1>Artikel 1<br>Änderung der Verfassung</h1>
    <p>Nach Absatz 1 werden folgende Absätze 1a und 1b eingefügt:</p><p>„(1a) Erster Satz.<br>(1b) Zweiter Satz.“</p>
    <h1>Artikel 2<br>Inkrafttreten</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>`);
  const quote = parsed.body.find((block) => block.label === 'Artikel 1').children[1];
  assert.deepEqual(quote.children.map((block) => [block.label, block.text]), [['„(1a)', 'Erster Satz.'], ['(1b)', 'Zweiter Satz.“']]);
});

test('ein untergliederter Neufassungsbefehl im Einleitungssatz eines Punkts: Buchstaben darunter, je mit eigener Neufassung', () => {
  const css = listCss('num', 0, 'decimal') + listCss('sub', 0, 'lower-latin', '', ') ');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_num-0 start" start="4"><li style="margin-left:36pt">Stufe 9</li></ol>
    <ol class="lst-kix_num-0" start="5"><li style="margin-left:36pt">Stufe 10</li></ol>
    <p style="margin-left:36pt">Die Bereiche 1 und 2 erhalten folgende Fassung:</p>
    <ol class="lst-kix_sub-0 start" start="1"><li style="margin-left:36pt">Bereich 1</li></ol>
    <p style="margin-left:30pt">„Bereich 1: Erster Inhalt</p><p style="margin-left:30pt">Erläuterung.“</p>
    <ol class="lst-kix_sub-0" start="2"><li style="margin-left:36pt">Bereich 2</li></ol>
    <p style="margin-left:30pt">„Bereich 2: Zweiter Inhalt.“</p>
    <ol class="lst-kix_num-0" start="6"><li style="margin-left:36pt">Stufe 11</li></ol>`, css);
  const items = listItems(s.children);
  assert.deepEqual(listLabels(items), ['4.', '5.', '6.']);
  const five = items[1];
  assert.deepEqual(five.children.map((block) => [block.type, block.label ?? null]), [['paragraphText', null], ['item', 'a)'], ['item', 'b)']]);
  const [a, b] = listItems(five.children);
  assert.deepEqual(quoteOf(a).children.map((block) => block.text), ['„Bereich 1: Erster Inhalt', 'Erläuterung.“']);
  assert.deepEqual(quoteOf(b).children.map((block) => block.text), ['„Bereich 2: Zweiter Inhalt.“']);
});

test('mehrstufige Gliederungszeichen zeigen die Nummer der übergeordneten Ebene', () => {
  const css = `.lst-kix_ml-0>li:before{content:"" counter(lst-ctn-kix_ml-0,decimal) ". "}
    .lst-kix_ml-1>li:before{content:"" counter(lst-ctn-kix_ml-0,decimal) "." counter(lst-ctn-kix_ml-1,decimal) ". "}
    ol.lst-kix_ml-0.start{counter-reset:lst-ctn-kix_ml-0 0} ol.lst-kix_ml-1.start{counter-reset:lst-ctn-kix_ml-1 0}`;
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_ml-0 start"><li style="margin-left:36pt">Grundbedarf.</li><li style="margin-left:36pt">Hinzu treten Stunden für:</li></ol>
    <ol class="lst-kix_ml-1 start"><li style="margin-left:72pt">Förderung,</li><li style="margin-left:72pt">Sprachkurse.</li></ol>`, css);
  assert.deepEqual(listLabels(listItems(s.children)[1].children), ['2.1.', '2.2.']);
});

test('ein Schlussteil hinter Unterpunkten vollendet den Satz des übergeordneten Punkts', () => {
  const css = listCss('cmd', 0, 'decimal') + listCss('cmd', 1, 'lower-latin', '', ') ');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li style="margin-left:36pt">In der Überschrift wird</li></ol>
    <ol class="lst-kix_cmd-1 start" start="1"><li style="margin-left:72pt">die Angabe „II.“ durch die Angabe „IV.“ und</li><li style="margin-left:72pt">das Wort „Recht“ durch das Wort „Rechte“</li></ol>
    <p>ersetzt.</p>
    <ol class="lst-kix_cmd-0" start="2"><li style="margin-left:36pt">Die Prüfung ist so festzulegen, dass</li></ol>
    <ol class="lst-kix_cmd-1 start" start="1"><li style="margin-left:72pt">ein Gegenstand und</li><li style="margin-left:72pt">ein weiterer Gegenstand</li></ol>
    <p style="margin-left:36pt">Bestandteil der Anforderungen ist.</p>`, css);
  const [one, two] = listItems(s.children);
  assert.equal(one.children.at(-1).text, 'ersetzt.');
  assert.equal(two.children.at(-1).text, 'Bestandteil der Anforderungen ist.');
  assert.equal(s.children.length, 2);
});

test('eine einfache Zahl ohne Punkt ist eine Mengenangabe und keine Nummer', () => {
  const { section: s } = nestingFixture(`<p>Bis zu einem Verbrauch von</p><p>70 Kilowattstunden je Quadratmeter</p><p>gilt der Grundtarif.</p>`);
  assert.deepEqual(s.children.map((block) => block.type), ['paragraphText', 'paragraphText', 'paragraphText']);
});

test('ein zitierter gedruckter Buchstabe bleibt im Zitat seines Befehls und behält das öffnende Anführungszeichen', () => {
  const { section: s } = nestingFixture(`<p>1. Nummer 3 Buchstabe e wird wie folgt gefasst:</p><p>„e) Für Abkürzungen gilt die Liste.“</p><p>2. Nummer 4 wird aufgehoben.</p>`);
  const [one, two] = listItems(s.children);
  assert.deepEqual(quoteOf(one).children.map((block) => [block.label, block.text]), [['„e)', 'Für Abkürzungen gilt die Liste.“']]);
  assert.equal(two.label, '2.');
});

test('ein Absatz mit dem Texteinzug eines überschriftartigen Punkts ist dessen Inhalt', () => {
  const css = listCss('num', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_num-0 start" start="1"><li style="margin-left:36pt">Grundschule</li></ol>
    <p style="margin-left:36pt">An allen Grundschulen gilt Anlage 1.</p>
    <ol class="lst-kix_num-0" start="2"><li style="margin-left:36pt">Förderschule</li></ol>
    <p style="margin-left:36pt">An allen Förderschulen gilt Anlage 2.</p>`, css);
  assert.deepEqual(listItems(s.children).map((item) => item.children.map((block) => block.text)), [['An allen Grundschulen gilt Anlage 1.'], ['An allen Förderschulen gilt Anlage 2.']]);
});

test('ein kleingeschriebener Absatz mit dem Einzug des offenen Einleitungssatzes vollendet diesen und nicht den letzten Punkt', () => {
  const css = listCss('sum', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <p style="margin-left:36pt">Der Plan wird in Einnahmen und Ausgaben auf</p>
    <ol class="lst-kix_sum-0 start" start="1"><li style="margin-left:36pt">100 Euro für das erste Jahr und</li><li style="margin-left:36pt">200 Euro für das zweite Jahr</li></ol>
    <p style="margin-left:36pt">festgestellt. Die Übersicht ist beigefügt.</p>`, css);
  assert.deepEqual(s.children.map((block) => block.type), ['paragraphText', 'item', 'item', 'paragraphText']);
  assert.deepEqual(listItems(s.children).map((item) => item.children.length), [0, 0]);
});

test('ein kleingeschriebener Absatz mit tieferem Einzug setzt den Punkt nach offenem Einleitungssatz fort', () => {
  const css = listCss('sitz', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <p style="margin-left:36pt">Die Stellen haben ihren Sitz</p>
    <ol class="lst-kix_sitz-0 start" start="1"><li style="margin-left:72pt">in Nordstadt</li></ol>
    <p style="margin-left:72pt">mit Zuständigkeit für den Norden;</p>
    <ol class="lst-kix_sitz-0" start="2"><li style="margin-left:72pt">in Südstadt</li></ol>
    <p style="margin-left:72pt">mit Zuständigkeit für den Süden.</p>`, css);
  assert.deepEqual(listItems(s.children).map((item) => item.children.map((block) => block.text)),
    [['mit Zuständigkeit für den Norden;'], ['mit Zuständigkeit für den Süden.']]);
});

test('ein satzbeendender Schlussteil hinter verschachtelten Unterpunkten gehört zum offenen Punkt der obersten Ebene', () => {
  const css = listCss('ueb', 0, 'decimal') + listCss('ueb', 1, 'lower-latin') + listCss('ueb', 2, 'lower-roman');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_ueb-0 start" start="1"><li style="margin-left:36pt">Der Stelle A wird aus dem Bereich</li></ol>
    <ol class="lst-kix_ueb-1 start" start="1"><li style="margin-left:72pt">der Stelle B die Aufgabe X</li><li style="margin-left:72pt">der Stelle C die Aufgaben</li></ol>
    <ol class="lst-kix_ueb-2 start" start="1"><li style="margin-left:108pt">Y und</li><li style="margin-left:108pt">Z</li></ol>
    <p>übertragen.</p>`, css);
  const [one] = listItems(s.children);
  assert.equal(one.children.at(-1).text, 'übertragen.');
  assert.equal(listItems(one.children)[1].children.every((block) => block.type === 'item'), true);
});

test('Paragraphen innerhalb eines Artikels gliedern diesen Artikel weiter', () => {
  const parsed = articleFixture(`<h1>Artikel 1<br>Änderung des Prüfgesetzes</h1><p>§ 3 wird aufgehoben.</p>
    <h1>Artikel 2<br>Übergangsbestimmungen</h1><h3>§ 1<br>Errichtung</h3><p>Die Stelle wird errichtet.</p><h3>§ 2<br>Bericht</h3><p>Die Stelle berichtet.</p>
    <h1>Artikel 3<br>Inkrafttreten</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>`);
  assert.deepEqual(parsed.body.filter((block) => block.type === 'article').map((block) => [block.label, block.children.filter((child) => child.type === 'paragraph').map((child) => child.label)]),
    [['Artikel 1', []], ['Artikel 2', ['§ 1', '§ 2']], ['Artikel 3', []]]);
});

test('„… wird wie folgt geändert:“ vor ungegliedertem zitiertem Wortlaut ist eine Neufassung; Standardlisten laufen fort', () => {
  const parsed = articleFixture(`<h1>Artikel 1<br>Änderung der Prüfordnung</h1>
    <ol type="1"><li>Die Bezeichnung der Verordnung wird wie folgt geändert:</li></ol><p>„Prüfordnung“</p>
    <ol type="1" start="2"><li>§ 2 wird aufgehoben.</li></ol>
    <h1>Artikel 2<br>Inkrafttreten</h1><p>Diese Verordnung tritt am Tag nach der Verkündung in Kraft.</p>`);
  const [one, two] = listItems(parsed.body.find((block) => block.label === 'Artikel 1').children);
  assert.deepEqual(quoteOf(one).children, [{ type: 'paragraphText', text: '„Prüfordnung“' }]);
  assert.equal(one.listId, two.listId);
});

test('Adjektive einer Ressortbezeichnung im Unterschriftenblock werden klein geschrieben', () => {
  assert.equal(normalizeOfficeTitle('D e r  S T A A T S M I N I S T E R  F Ü R  B I L D U N G\nU N D  S P O R T L I C H E  E R T Ü C H T I G U N G'),
    'Der Staatsminister für Bildung und sportliche Ertüchtigung');
  assert.equal(normalizeOfficeTitle('D I E  S T A A T S M I N I S T E R I N  F Ü R  D I E  B E W A F F N E T E N  O R G A N E'),
    'Die Staatsministerin für die bewaffneten Organe');
  assert.equal(normalizeOfficeTitle('F Ü R  D E N  S E N A T  D E R  F R E I E N  U N D  H A N S E S T A D T  H A M B U R G'),
    'Für den Senat der Freien und Hansestadt Hamburg');
});

function treatyFixture(content) {
  const html = `<!doctype html><html><body>
    <p>Vertragsblatt für den Freistaat Ostdeutschland</p><p>Nr. 99</p><p>Ausgegeben zu Dresden am 14. Oktober 2026</p>
    <p>Inhaltsverzeichnis</p><p>14. Oktober 2026 Abkommen über eine Prüfpartnerschaft Seite 2</p>
    <p>Abkommen<br>über eine Prüfpartnerschaft<br>vom 14. Oktober 2026</p>${content}</body></html>`;
  return parsePublicationHtml('vertrag-fixture.html', html);
}

test('Präambel, Schlussformel und Anlagenverzeichnis eines Vertrags umschließen keine Artikel und erzeugen keine Anlagen', () => {
  const parsed = treatyFixture(`<h2>Präambel</h2><p>Die Vertragsparteien schließen folgenden Vertrag:</p>
    <h2>Artikel 1<br>Zweck</h2><p>(1) Der Vertrag regelt die Prüfung.</p><p>(2) Er gilt im Grenzraum.</p>
    <h2>Abschnitt I<br>Prüfung</h2><h2>Artikel 2<br>Inkrafttreten</h2><p>Der Vertrag tritt in Kraft.</p>
    <p>Zu Urkund dessen haben die Vertreter diesen Vertrag unterzeichnet.</p>
    <p>Geschehen zu Prag am 7. März 2026</p><p>in zwei Urschriften, wobei jeder Wortlaut</p><p>gleichermaßen verbindlich ist.</p>
    <p>Für den<br>Freistaat Ostdeutschland<br>Erste Person</p><p>Für die</p><p>Republik Muster</p><p>Zweite Person</p>
    <p>Anlagen:</p><p>Anhang 1: Prüfplan</p><p>Anhang 2: Prüfliste</p>
    <p>Anhang 1 – Prüfplan</p><p>1. Ziel</p><p>Anhang 2 – Prüfliste</p><p>1. Liste</p>`);
  assert.deepEqual(parsed.body.filter((block) => block.type !== 'paragraphText').map((block) => [block.type, block.label]), [
    ['section', 'Präambel'], ['article', 'Artikel 1'], ['section', 'Abschnitt I'], ['annex', 'Anhang 1'], ['annex', 'Anhang 2'],
  ]);
  assert.deepEqual(parsed.body.filter((block) => block.type === 'paragraphText').map((block) => block.text), [
    'Zu Urkund dessen haben die Vertreter diesen Vertrag unterzeichnet.',
    'Geschehen zu Prag am 7. März 2026 in zwei Urschriften, wobei jeder Wortlaut gleichermaßen verbindlich ist.',
    'Für den Freistaat Ostdeutschland', 'Erste Person', 'Für die Republik Muster', 'Zweite Person',
    'Anlagen:', 'Anhang 1: Prüfplan', 'Anhang 2: Prüfliste',
  ]);
  assert.equal(parsed.body.find((block) => block.label === 'Anhang 1').title, 'Prüfplan');
});

test('römisch bezeichnete Anlagen tragen die Nummer im Label und umschließen ihre Teile', () => {
  const parsed = treatyFixture(`<h2>Artikel 1<br>Zweck</h2><p>Der Vertrag regelt die Prüfung.</p>
    <p>ANLAGE I<br>STOFFE</p><p>TEIL 1<br>GRUNDSÄTZE</p><p>Text.</p><p>TEIL 2<br>VERBOTE</p><p>Text.</p><p>ANLAGE II<br>KRITERIEN</p><p>Text.</p>`);
  const annexes = parsed.body.filter((block) => block.type === 'annex');
  assert.deepEqual(annexes.map((block) => [block.label, block.title]), [['ANLAGE I', 'STOFFE'], ['ANLAGE II', 'KRITERIEN']]);
  assert.deepEqual(annexes[0].children.map((block) => block.label), ['TEIL 1', 'TEIL 2']);
});

test('gedruckte römische Ziffern bilden Unterpunkte in ihrer Reihenfolge; Einzelbuchstaben C. und D. sind keine römischen Zahlen', () => {
  const { section: s } = nestingFixture(`<p>C. Kontrollen</p><p>1. Schiffe unterliegen Kontrollen:</p><p>a) einer ersten Kontrolle, die gewährleistet:</p>
    <p>i) die Anlage ist geprüft,</p><p>ii) der Tank ist geeignet,</p><p>iii) die Leitung ist vorhanden,</p><p>iv) die Pumpe arbeitet;</p>
    <p>D. Ausnahmen</p><p>Abschnitt C gilt nicht</p>`);
  assert.ok(!s.children.some((block) => block.type === 'section'));
  const letter = listItems(listItems(s.children)[0].children)[0] ?? listItems(s.children).find((block) => block.label === 'a)');
  assert.deepEqual(listLabels(letter.children), ['i)', 'ii)', 'iii)', 'iv)']);
  assert.deepEqual(s.children.filter((block) => block.type === 'paragraphText').map((block) => block.text), ['C. Kontrollen', 'D. Ausnahmen', 'Abschnitt C gilt nicht']);
});

test('gleich gebaute Zeilen mit laufender Kennung bleiben getrennte Zeilen', () => {
  const { section: s } = nestingFixture(`<p>Modul M1 Sprache<br>Modul M2 Recht<br>Modul M3 Praxis</p>`);
  assert.deepEqual(s.children.map((block) => block.text), ['Modul M1 Sprache', 'Modul M2 Recht', 'Modul M3 Praxis']);
});

test('ein mit Zeilenumbruch gesetzter Absatz unter einer Punktüberschrift bleibt zeilenweise getrennt', () => {
  const { section: s } = nestingFixture(`<p>1. Aufgaben</p><p>Beratung: Termine, Unterlagen<br>Begleitung bei Anträgen<br>digitale Akte (pseudonymisiert)</p>
    <p>2. Ziele</p><p>Wartezeit unter 7 Tagen<br>Zufriedenheit über 80 %</p>`);
  assert.deepEqual(s.children.filter((block) => block.type === 'paragraphText').map((block) => block.text), [
    'Beratung: Termine, Unterlagen', 'Begleitung bei Anträgen', 'digitale Akte (pseudonymisiert)',
    'Wartezeit unter 7 Tagen', 'Zufriedenheit über 80 %',
  ]);
});

test('ein Zeilenumbruch nach einem offenen Satz eines Punkts teilt den fortsetzenden Absatz nicht', () => {
  const { section: s } = nestingFixture(`<p>1. Zuständig ist die</p><p>Prüfstelle Mitte<br>Hauptstraße 1<br>01000 Musterstadt.</p>`);
  const texts = [];
  const collect = (blocks) => (blocks ?? []).forEach((block) => { if (block.type === 'paragraphText') texts.push(block.text); collect(block.children); });
  collect(s.children);
  assert.deepEqual(texts, ['Prüfstelle Mitte Hauptstraße 1 01000 Musterstadt.']);
});

test('Beschriftung und Hinweis als Zeilen über alle Spalten stehen außerhalb der Tabelle; eine farbige Kopfzeile ist Kopf', () => {
  const { section: s } = nestingFixture(`<table>
    <tr><td colspan="3">Stundentafel</td></tr>
    <tr><td style="background-color:#6fa8dc">Fach</td><td style="background-color:#6fa8dc">Kl. 1</td><td style="background-color:#6fa8dc">Kl. 2</td></tr>
    <tr><td>Deutsch</td><td>7</td><td>7</td></tr>
    <tr><td colspan="3">Hinweis:</td></tr></table>`);
  assert.deepEqual(s.children.map((block) => block.type), ['paragraphText', 'table', 'paragraphText']);
  assert.deepEqual(s.children[1].children[0].children.map((cell) => cell.type), ['tableHeaderCell', 'tableHeaderCell', 'tableHeaderCell']);
  assert.equal(s.children[1].children.length, 2);
});

test('Anlagen hinter dem Mantel, die auf Paragraphen verweisen, gehören zur einzigen eingeführten Stammnorm', () => {
  const html = introductionFixture(
    '<h1>Artikel 1<br>Einführung eines Prüfverfahrensgesetzes</h1><p>Gesetz über ein Prüfverfahren (Prüfverfahrensgesetz – PVG)</p>',
    '<h2>Abschnitt 1<br>Grundlagen</h2><h3>§ 1<br>Prüfung</h3><p>Das Muster ergibt sich aus Anlage 1.</p>',
  ).replace('<p>Dresden, den 14. Oktober 2026</p>', '<p>Dresden, den 14. Oktober 2026</p><h2>Anlage 1 (Muster, § 1)</h2><p>Muster.</p>');
  const parsed = parsePublicationHtml('mantel-anlage-fixture.html', html);
  assert.equal(parsed.introducedNorms[0].body.at(-1).label, 'Anlage 1 (Muster, § 1)');
  assert.equal(parsed.body.at(-1).label, 'Anlage 1 (Muster, § 1)');
});

test('die exportierte Gliederungserkennung bleibt für die REVOSax-Snapshots unverändert', () => {
  assert.equal(parseStructureMarker('Dritter Abschnitt\nPrüfstellen'), null);
  assert.deepEqual(parseStructureMarker('C. Kontrollen'), { type: 'section', label: 'C.', title: 'Kontrollen' });
  assert.deepEqual(parseStructureMarker('Anlage 2 (zu § 3)\nMuster'), { type: 'annex', label: 'Anlage 2 (zu § 3)', title: 'Muster' });
  assert.deepEqual(parseStructureMarker('§ 8\nBeschreibung und führungs-\nberechtigte Stellen'), { type: 'paragraph', label: '§ 8', title: 'Beschreibung und führungs- berechtigte Stellen' });
});

test('hochgestellte Ziffern bleiben hochgestellt; andere Hochstellungen bleiben unverändert', () => {
  const parsed = articleFixture(`<h1>Artikel 1<br>Änderung des Prüfgesetzes</h1>
    <p>In § 2 werden die Wörter „100 m<span class="c9">2</span>“ durch die Wörter „150 m<sup>3</sup>“ ersetzt; Fußnote<span class="c9">a</span>.</p>
    <h1>Artikel 2<br>Inkrafttreten</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>`, '.c9{vertical-align:super}');
  assert.equal(parsed.body[0].children[0].text, 'In § 2 werden die Wörter „100 m²“ durch die Wörter „150 m³“ ersetzt; Fußnotea.');
});

test('eine Tabellenzelle nur mit Abbildung übernimmt die Textalternative oder wird als Quellbefund gemeldet', () => {
  const table = (cell) => articleFixture(`<h1>Artikel 1<br>Kennzeichnung</h1>
    <table><tr><td>Stufe 1</td><td>${cell}</td></tr><tr><td>Stufe 2</td><td>Text</td></tr></table>
    <h1>Artikel 2<br>Inkrafttreten</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>`);
  const withAlt = table('<p><span><img alt="Kennzeichen Stufe 1" src="images/a.png"></span></p>');
  assert.equal(flatten(withAlt.body).find(({ block }) => block.type === 'table').block.children[0].children[1].text, 'Kennzeichen Stufe 1');
  assert.throws(() => table('<p><span><img alt="" src="images/a.png"></span></p>'),
    /needs-review: Artikel 1 > table\[0\] > Zeile 1, Zelle 2: Abbildung ohne Textalternative/u);
  const issue = 'Artikel 1 > table[0] > Zeile 1, Zelle 2: Abbildung ohne Textalternative';
  const html = `<!doctype html><html><head><style></style></head><body>
    <p>Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland</p>
    <p>Nr. 99</p><p>Ausgegeben zu Dresden am 14. Oktober 2026</p>
    <p>Inhaltsverzeichnis</p><p>14. Oktober 2026 Gesetz zur Änderung eines Prüfgesetzes Seite 2</p>
    <p>Gesetz<br>zur Änderung eines Prüfgesetzes<br>vom 14. Oktober 2026</p>
    <h1>Artikel 1<br>Kennzeichnung</h1><table><tr><td>Stufe 1</td><td><img alt="" src="images/a.png"></td></tr></table>
    <h1>Artikel 2<br>Inkrafttreten</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>
    <p>Dresden, den 14. Oktober 2026</p></body></html>`;
  const accepted = parsePublicationHtml('abbildung-fixture.html', html, { acceptedSequenceIssues: [issue] });
  assert.deepEqual(sourceFindingIssues(accepted.body), [issue]);
});

test('eine unzitierte Neufassung aus Paragraphen endet vor dem Artikel, der die Mantelzählung fortsetzt', () => {
  const parsed = articleFixture(`<h1>Artikel 3<br>Neufassung des Prüfgesetzes</h1>
    <p>Das Prüfgesetz wird wie folgt gefasst:</p>
    <h2>§ 1<br>Zuständigkeit</h2><p>Zuständig ist die Prüfstelle.</p>
    <h2>§ 2<br>Schlussbestimmung</h2><p>Bezugnahmen gelten als Bezugnahmen auf dieses Gesetz.</p>
    <h1>Artikel 4<br>Fortgeltung</h1><p>Das bisherige Recht gilt fort.</p>
    <h1>Artikel 5<br>Inkrafttreten</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>`);
  assert.deepEqual(parsed.body.filter((block) => block.type === 'article').map((block) => block.label), ['Artikel 3', 'Artikel 4', 'Artikel 5']);
  assert.deepEqual(quoteOf(parsed.body[0]).children.map((block) => block.label), ['§ 1', '§ 2']);
});

test('ein vollständiger Satz unter einem zitierten Paragraphen ohne Überschrift ist Normtext', () => {
  const parsed = articleFixture(`<h1>Artikel 2<br>Gesetz zu dem Prüfstaatsvertrag</h1>
    <p>§ 1</p><p>Dem am 1. März 2026 unterzeichneten Prüfstaatsvertrag wird zugestimmt.</p>
    <p>§ 2</p><p>Inkrafttreten</p><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>
    <h1>Artikel 3<br>Inkrafttreten</h1><p>Dieses Gesetz tritt am Tag nach der Verkündung in Kraft.</p>`);
  const [first, second] = quoteOf(parsed.body[0]).children;
  assert.equal(first.title, undefined);
  assert.equal(first.children[0].text, 'Dem am 1. März 2026 unterzeichneten Prüfstaatsvertrag wird zugestimmt.');
  assert.equal(second.title, 'Inkrafttreten');
});

test('eine Unterebene nach einem Punkt der übergeordneten Ebene beginnt trotz fortgezähltem Startwert neu', () => {
  const css = listCss('cmd', 0, 'decimal') + listCss('cmd', 1, 'lower-latin', '', ') ');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_cmd-0 start" start="1"><li style="margin-left:36pt">§ 1 wird wie folgt geändert:</li></ol>
    <ol class="lst-kix_cmd-1 start" start="1"><li style="margin-left:72pt">Absatz 1 wird aufgehoben.</li><li style="margin-left:72pt">Absatz 2 wird aufgehoben.</li></ol>
    <ol class="lst-kix_cmd-0" start="2"><li style="margin-left:36pt">§ 2 wird wie folgt geändert:</li></ol>
    <ol class="lst-kix_cmd-1" start="3"><li style="margin-left:72pt">Absatz 1 wird aufgehoben.</li><li style="margin-left:72pt">Absatz 2 wird aufgehoben.</li></ol>
    <ol class="lst-kix_cmd-0" start="3"><li style="margin-left:36pt">§ 3 wird wie folgt geändert:</li></ol>
    <ol class="lst-kix_cmd-1" start="5"><li style="margin-left:72pt">Absatz 1 wird aufgehoben.</li></ol>
    <ol class="lst-kix_cmd-1" start="2"><li style="margin-left:72pt">Absatz 2 wird aufgehoben.</li></ol>`, css);
  assert.deepEqual(listItems(s.children).map((item) => listLabels(item.children)), [['a)', 'b)'], ['a)', 'b)'], ['a)', 'b)']]);
});

test('eine ausdrücklich gesetzte Wiederholung der vorangehenden Nummer bleibt als Quellbefund sichtbar', () => {
  const css = listCss('one', 0, 'decimal') + listCss('two', 0, 'decimal');
  const content = `
    <ol class="lst-kix_one-0 start" start="1"><li style="margin-left:36pt">§ 1 wird aufgehoben.</li><li style="margin-left:36pt">§ 2 wird aufgehoben.</li>
      <li style="margin-left:36pt">Nach § 2 wird folgender § 2a eingefügt:</li></ol>
    <p>„§ 2a<br>Prüfung</p><p>Die Prüfung ist jährlich durchzuführen.“</p>
    <ol class="lst-kix_two-0 start" start="3"><li style="margin-left:36pt">§ 3 wird aufgehoben.</li></ol>`;
  assert.throws(() => nestingFixture(content, css), /doppeltes Gliederungszeichen \(3\. → 3\.\)/u);
});

test('ein Absatz mit dem Texteinzug eines Punkts hinter dessen Unterpunkten ist dessen nächster Satz', () => {
  const css = listCss('abs', 0, 'decimal', '(', ') ') + listCss('num', 0, 'decimal');
  const { section: s } = nestingFixture(`
    <ol class="lst-kix_abs-0 start" start="1"><li style="margin-left:36pt">Die Vorgaben können enthalten:</li></ol>
    <ol class="lst-kix_num-0 start" start="1"><li style="margin-left:72pt">Vorgaben zur Verwendung;</li><li style="margin-left:72pt">Vorgaben zur Prüfung.</li></ol>
    <p style="margin-left:36pt">Weitere Vorgaben regelt eine Verordnung.</p>
    <ol class="lst-kix_abs-0" start="2"><li style="margin-left:36pt">Die Prüfstelle berichtet jährlich.</li></ol>`, css);
  const [first, second] = listItems(s.children);
  assert.deepEqual([first.label, second.label], ['(1)', '(2)']);
  assert.deepEqual(first.children.map((block) => block.label ?? block.text), ['1.', '2.', 'Weitere Vorgaben regelt eine Verordnung.']);
});

test('Absätze und Listen hinter einer gedruckten Gliederungsnummer mit Überschrift sind deren Inhalt', () => {
  const css = listCss('buch', 0, 'lower-latin', '', ') ');
  const { section: s } = nestingFixture(`
    <p>1. Grundlagen</p><p>1.1 Zuständigkeit</p><p>(1) Die Prüfstelle ist befugt,</p>
    <ol class="lst-kix_buch-0 start" start="1"><li style="margin-left:36pt">Prüfungen anzuordnen,</li><li style="margin-left:36pt">Berichte anzufordern.</li></ol>
    <p>(2) Die Befugnis ist nicht übertragbar.</p><p>1.2 Verfahren</p><p>Das Verfahren ist schriftlich.</p>
    <p>2. Schlussbestimmung</p><p>Die Richtlinie gilt unbefristet.</p>`, css);
  const [one, two] = listItems(s.children);
  assert.deepEqual(listItems(s.children).map((item) => item.label), ['1.', '2.']);
  const [first, second] = listItems(one.children);
  assert.deepEqual(first.children.map((block) => block.label), ['(1)', '(2)']);
  assert.deepEqual(listLabels(first.children[0].children), ['a)', 'b)']);
  assert.equal(second.children[0].text, 'Das Verfahren ist schriftlich.');
  assert.equal(two.children[0].text, 'Die Richtlinie gilt unbefristet.');
  assert.match(readingOrder(s.children), /^1\. Grundlagen 1\.1 Zuständigkeit \(1\) Die Prüfstelle ist befugt, a\) .* \(2\) .* 1\.2 Verfahren Das Verfahren ist schriftlich\. 2\. Schlussbestimmung Die Richtlinie gilt unbefristet\.$/u);
});

test('als Überschrift gesetzte Nummern unter einer römischen Gliederung gliedern diese weiter; ohne römische Gliederung bleiben sie oberste Ebene', () => {
  const css = listCss('lb', 0, 'lower-latin', '', ') ');
  const { parsed, section: s } = nestingFixture(`
    <p>Die Prüfordnung wird wie folgt geändert:</p>
    <h3>1. Allgemeine Ziele</h3><p>Nach den Zielen wird folgender Absatz angefügt:</p>
    <p style="margin-left:30pt">„Die Prüfung ist nachvollziehbar zu gestalten.“</p>
    <h2>2. Prüfbereich Nord</h2>
    <ol class="lst-kix_lb-0 start" start="1"><li style="margin-left:36pt">Bereich 1</li></ol>
    <p style="margin-left:36pt">Im Bereich 1 wird folgender Satz angefügt:</p>
    <p style="margin-left:30pt">„Die Ergebnisse werden veröffentlicht.“</p>
    <h1>3. Prüfbereich Süd</h1><p>Der Bereich bleibt unverändert.</p>
    <h2>II.<br>Schlussbestimmung</h2><p>Die Richtlinie gilt unbefristet.</p>`, css);
  assert.deepEqual(parsed.body.filter((block) => block.type === 'section').map((block) => block.label), ['I.', 'II.']);
  const numbered = s.children.filter((block) => block.type === 'section');
  assert.deepEqual(numbered.map((block) => block.label), ['1.', '2.', '3.']);
  assert.equal(s.children[0].text, 'Die Prüfordnung wird wie folgt geändert:');
  assert.ok(quoteOf(numbered[0]), 'die Neufassung steht unter Nummer 1');
  const [area] = listItems(numbered[1].children);
  assert.equal(area.label, 'a)');
  assert.ok(quoteOf(area), 'Befehl und Zitat stehen unter dem Buchstaben');
  assert.equal(numbered[2].children[0].text, 'Der Bereich bleibt unverändert.');
  assert.equal(parsed.body.find((block) => block.label === 'II.').children[0].text, 'Die Richtlinie gilt unbefristet.');

  const flat = parsePublicationHtml('nummern-fixture.html', `<!doctype html><html><head></head><body>
    <p>Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland</p>
    <p>Nr. 99</p><p>Ausgegeben zu Dresden am 27. August 2026</p>
    <p>Inhaltsverzeichnis</p><p>27. August 2026 Richtlinie über einen Nummerntest Seite 2</p>
    <p>Richtlinie<br>über einen Nummerntest<br>vom 27. August 2026</p>
    <h3>1. Zweck</h3><p>Die Richtlinie regelt die Prüfung.</p>
    <h3>2. Verfahren</h3><p>Das Verfahren ist schriftlich.</p>
    <p>Dresden, den 27. August 2026</p></body></html>`);
  assert.deepEqual(flat.body.filter((block) => block.type === 'section').map((block) => block.label), ['1.', '2.']);
});
