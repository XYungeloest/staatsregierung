import assert from 'node:assert/strict';
import test from 'node:test';

import {
  amendmentDatesFromCitation,
  containmentDatesFromCitation,
  futureAmendmentDates,
  futureContainmentDates,
  historicalBaselineCitation,
  stripFutureContainmentClause,
} from '../scripts/lib/revosax-citation.mjs';
import { parseRevosaxSnapshot } from '../scripts/lib/revosax-parser.mjs';

function snapshot(sections) {
  return `<!doctype html><html><body><div id="content"><div class="law_show">
    <h1>Testgesetz</h1>
    <p>Vollzitat: Testgesetz vom 1. Januar 2020 (OGVBl. 2020 Nr. 1)</p>
    <article id="lesetext">
      <header><h3>Testgesetz (TestG)</h3><p>1. Januar 2020</p></header>
      <div class="sections">${sections}</div>
    </article>
    <div id="quickbar"><div class="box"><h3>Gültigkeitszeitraum</h3><p>Fassung gültig ab: 1. Januar 2020</p></div></div>
  </div></div></body></html>`;
}

function parsedBody(html) {
  return parseRevosaxSnapshot(snapshot(html), { url: 'https://www.revosax.sachsen.de/vorschrift/1' }).body;
}

function findBlock(blocks, type) {
  for (const block of blocks) {
    if (block.type === type) return block;
    const nested = findBlock(block.children ?? [], type);
    if (nested) return nested;
  }
  return undefined;
}

function findLabel(blocks, label) {
  for (const block of blocks) {
    if (block.label === label) return block;
    const nested = findLabel(block.children ?? [], label);
    if (nested) return nested;
  }
  return undefined;
}

function definitionBody(rows) {
  return parsedBody(`
    <section title="§ 1 Begriffe"><h3>§ 1 Begriffe</h3>
      <dl>${rows}</dl>
    </section>`);
}

test('REVOSax-Metadaten bleiben für die Stammnormmaterialisierung vollständig', () => {
  const parsed = parseRevosaxSnapshot(snapshot(`
    <section title="§ 1 Zweck"><h3>§ 1 Zweck</h3>
      <p>(1) Das Gesetz regelt seinen Zweck.</p>
    </section>`), { url: 'https://www.revosax.sachsen.de/vorschrift/1' });

  assert.equal(parsed.sourceTitle, 'Testgesetz');
  assert.equal(parsed.shortTitle, 'Testgesetz');
  assert.equal(parsed.fullCitation, 'Testgesetz vom 1. Januar 2020 (OGVBl. 2020 Nr. 1)');
  assert.equal(parsed.documentDate, '2020-01-01');
  assert.equal(parsed.sourceValidFrom, '2020-01-01');
  assert.equal(parsed.sourceValidTo, null);
  assert.equal(parsed.sourceUrl, 'https://www.revosax.sachsen.de/vorschrift/1');
  assert.ok(findBlock(parsed.body, 'paragraph'));
});

test('REVOSax-Satznummern werden semantisch verworfen und korrekt getrennt', () => {
  const body = parsedBody(`
    <section title="§ 1 Aufgaben"><h3>§ 1 Aufgaben</h3>
      <p>(1) <sup class="satzzahl">1</sup>Die Gemeinde erfüllt Aufgaben.<sup class="satzzahl">2</sup>Sie handelt.</p>
      <p>(2) <sup class="satzzahl">12</sup>Der zweite Satz folgt unmittelbar.</p>
    </section>`);
  const paragraph = findBlock(body, 'paragraph');
  assert.equal(paragraph.children[0].label, '(1)');
  assert.equal(paragraph.children[0].text, 'Die Gemeinde erfüllt Aufgaben. Sie handelt.');
  assert.equal(paragraph.children[1].label, '(2)');
  assert.equal(paragraph.children[1].text, 'Der zweite Satz folgt unmittelbar.');
  assert.doesNotMatch(JSON.stringify(body), /[⁰¹²³⁴⁵⁶⁷⁸⁹]/u);
});

test('manuell gesetzte REVOSax-Satznummern werden wie automatische verworfen', () => {
  const body = parsedBody(`
    <section title="§ 1 Fristen"><h3>§ 1 Fristen</h3>
      <p data-satzzahl="manuell">(1) <sup class="satzzahl_manuell">1</sup>Abweichend von Satz 2 gilt eine Frist.<sup class="satzzahl_manuell">2</sup>Sie beträgt einen Monat. <sup class="satzzahl_manuell">13</sup>Das Nähere regelt die Behörde.</p>
      <p data-satzzahl="manuell">(2) <sup class="satzzahl">1</sup>Gemischte Kennzeichnung. <sup class="satzzahl_manuell">2</sup>Der Rest folgt. <sup class="satzzahl satzzahl_manuell">3</sup>Die Doppelklasse zählt ebenso.</p>
      <dl class="cf"><dt class="td_1">1.</dt><dd class="last">für die Straßen (§§ 2 bis 4). <sup class="satzzahl_manuell">2</sup>Die Summe ergibt sich aus Absatz 1,</dd></dl>
    </section>`);
  const paragraph = findBlock(body, 'paragraph');
  assert.equal(paragraph.children[0].label, '(1)');
  assert.equal(paragraph.children[0].text, 'Abweichend von Satz 2 gilt eine Frist. Sie beträgt einen Monat. Das Nähere regelt die Behörde.');
  assert.equal(paragraph.children[1].text, 'Gemischte Kennzeichnung. Der Rest folgt. Die Doppelklasse zählt ebenso.');
  assert.match(JSON.stringify(body), /für die Straßen \(§§ 2 bis 4\)\. Die Summe ergibt sich aus Absatz 1,/u);
  assert.doesNotMatch(JSON.stringify(body), /(?:^|[\s.])\d{1,2}(?:Abweichend|Sie|Das|Der|Die)\b/u);
});

test('normale Hochstellungen bleiben erhalten und Satznummern in Tabellen werden entfernt', () => {
  const body = parsedBody(`
    <section title="§ 1 Maße"><h3>§ 1 Maße</h3>
      <p><sup class="satzzahl">1</sup>Die Fläche beträgt m<sup>2</sup>.</p>
      <table><tbody><tr><th>Wert</th><th>Beschreibung</th></tr>
        <tr><td><sup class="satzzahl">1</sup>1</td><td><sup class="satzzahl">2</sup>Erste Angabe.</td></tr>
      </tbody></table>
    </section>`);
  const paragraph = findBlock(body, 'paragraph');
  assert.equal(paragraph.children[0].text, 'Die Fläche beträgt m2.');
  const table = findBlock(body, 'table');
  assert.equal(table.children[1].children[1].text, 'Erste Angabe.');
  assert.match(paragraph.children[0].text, /m2/u);
});

test('Satznummern aus Fußnotenlinks werden nicht mit dem Normtext vermischt', () => {
  const body = parsedBody(`
    <section title="§ 1 Verweis"><h3>§ 1 Verweis</h3>
      <p><sup class="satzzahl">1</sup>Der Wortlaut bleibt erhalten.<a href="#FNID_1"><sup>1</sup></a></p>
    </section>`);
  const paragraph = findBlock(body, 'paragraph');
  assert.equal(paragraph.children[0].text, 'Der Wortlaut bleibt erhalten.');
});

test('REVOSax-Definitionslisten erhalten Unterpunkte und kehren zur Elternebene zurück', () => {
  const body = definitionBody(`
    <dt class="td_1">1.</dt><dd class="last">Erstens</dd>
    <dt class="td_1">2.</dt><dd class="last">Zweitens</dd>
    <dt class="td_1">3.</dt><dd class="td_2">a)</dd><dd class="last">Unterpunkt A</dd>
    <dt class="td_1"></dt><dd class="td_2">b)</dd><dd class="last">Unterpunkt B</dd>
    <dt class="td_1">4.</dt><dd class="last">Viertens</dd>`);
  const paragraph = findBlock(body, 'paragraph');
  assert.deepEqual(paragraph.children.filter((block) => block.type === 'item').map((item) => item.label), [
    '1.', '2.', '3.', '4.',
  ]);
  assert.deepEqual(findLabel(paragraph.children, '3.').children.map((item) => item.label), ['a)', 'b)']);
});

test('REVOSax-Definitionslisten bauen beliebig tiefe td_N-Ebenen auf', () => {
  const body = definitionBody(`
    <dt class="td_1">4.</dt><dd class="last">Oberpunkt</dd>
    <dt class="td_1"></dt><dd class="td_2">a)</dd><dd class="last">A</dd>
    <dt class="td_1"></dt><dd class="td_2">b)</dd><dd class="last">B</dd>
    <dt class="td_1"></dt><dd class="td_2"></dd><dd class="td_3">aa)</dd><dd class="last">AA</dd>
    <dt class="td_1"></dt><dd class="td_2"></dd><dd class="td_3">bb)</dd><dd class="last">BB</dd>
    <dt class="td_1"></dt><dd class="td_2"></dd><dd class="td_3">cc)</dd><dd class="last">CC</dd>
    <dt class="td_1">5.</dt><dd class="last">Nächster Oberpunkt</dd>`);
  const paragraph = findBlock(body, 'paragraph');
  assert.deepEqual(findLabel(paragraph.children, '4.').children.map((item) => item.label), ['a)', 'b)']);
  assert.deepEqual(findLabel(paragraph.children, 'b)').children.map((item) => item.label), ['aa)', 'bb)', 'cc)']);
  assert.equal(findLabel(paragraph.children, '5.').text, 'Nächster Oberpunkt');
});

test('leere REVOSax-Zellen sind Hierarchieplatzhalter und kein eigener Inhalt', () => {
  const body = definitionBody(`
    <dt class="td_1">1.</dt><dd class="td_2">a)</dd><dd class="last">A</dd>
    <dt class="td_1"></dt><dd class="td_2"></dd><dd class="td_3">aa)</dd><dd class="last">AA</dd>
    <dt class="td_1"></dt><dd class="td_2"></dd><dd class="last">Fortsetzung zu a)</dd>`);
  const paragraph = findBlock(body, 'paragraph');
  const itemA = findLabel(paragraph.children, 'a)');
  assert.deepEqual(itemA.children.map((item) => item.label ?? item.type), ['aa)', 'paragraphText']);
  assert.equal(itemA.children[1].text, 'Fortsetzung zu a)');
  assert.equal(JSON.stringify(body).includes('"label":""'), false);
});

test('REVOSax-Tabellenparser erhält leere Zellen und die Spaltenzahl', () => {
  const parsed = parseRevosaxSnapshot(snapshot(`
    <section title="§ 1 Tabelle"><h4>§ 1 Tabelle</h4>
      <table><tr><th scope="col">A</th><th scope="col">B</th></tr>
      <tr><td></td><td>längerer Inhalt</td></tr></table>
    </section>`), { url: 'https://www.revosax.sachsen.de/vorschrift/1' });
  const table = findBlock(parsed.body, 'table');
  assert.equal(table.columns, 2);
  assert.equal(table.children[0].children[0].type, 'tableHeaderCell');
  assert.deepEqual(table.children.map((row) => row.children.map((cell) => cell.text)), [
    ['A', 'B'],
    ['', 'längerer Inhalt'],
  ]);
});

test('die Tabellenbeschriftung wird Tabellentitel, weder Zeile noch Fließtext', () => {
  const body = parsedBody(`
    <section title="§ 1 Tabellen"><h4>§ 1 Tabellen</h4>
      <p>(1) Es gilt:</p>
      <table><caption>Stufen  der <a class="fussnote_link" href="#FNID_1"><sup>1</sup></a>Bewertung
      </caption><tr><th scope="col">A</th></tr><tr><td>1</td></tr></table>
      <table><caption>   </caption><tr><td>ohne Beschriftung</td></tr></table>
      <table><tr><td>ohne caption<table><caption>innen</caption><tr><td>x</td></tr></table></td></tr></table>
    </section>`);
  const tables = findLabel(body, '§ 1').children.filter((block) => block.type === 'table');
  assert.equal(tables.length, 3);
  assert.equal(tables[0].title, 'Stufen der Bewertung');
  assert.deepEqual(tables[0].children.map((row) => row.children.map((cell) => cell.text)), [['A'], ['1']]);
  assert.equal(Object.hasOwn(tables[1], 'title'), false);
  assert.equal(Object.hasOwn(tables[2], 'title'), false);
  assert.equal(JSON.stringify(body).split('Stufen').length - 1, 1);
});

test('historische Zitierungen verwerfen spätere Änderungsfundstellen im REVOSax-Seitenkopf', () => {
  const currentPageCitation = 'VwV vom 20. Juni 2018, die zuletzt durch Ziffer II der Verwaltungsvorschrift vom 23. Juli 2026 geändert worden ist, zuletzt enthalten in der Verwaltungsvorschrift vom 9. Dezember 2025';
  assert.deepEqual(amendmentDatesFromCitation(currentPageCitation), ['2026-07-23']);
  assert.deepEqual(futureAmendmentDates(currentPageCitation, '2024-07-31'), ['2026-07-23']);
  assert.equal(historicalBaselineCitation({
    pageFullCitation: currentPageCitation,
    sourceValidTo: '2024-07-31',
    context: 'Testfassung',
  }), 'VwV vom 20. Juni 2018');
  assert.equal(historicalBaselineCitation({
    pageFullCitation: currentPageCitation,
    sourceValidTo: '2024-07-31',
    baselineCitation: 'VwV vom 20. Juni 2018, geändert durch Verwaltungsvorschrift vom 17. August 2021',
  }), 'VwV vom 20. Juni 2018, geändert durch Verwaltungsvorschrift vom 17. August 2021');
});

test('historische Zitierungen erkennen Abkürzungspunkte und trennen spätere Seitenkopfänderungen ab', () => {
  const currentPageCitation = 'Sächsisches Beispielorganisationsgesetz vom 25. November 2003 (SächsGVBl. S. 9899), das zuletzt durch Artikel 8 des Gesetzes vom 24. Juni 2026 (SächsGVBl. S. 190) geändert worden ist';
  assert.deepEqual(amendmentDatesFromCitation(currentPageCitation), ['2026-06-24']);
  assert.deepEqual(futureAmendmentDates(currentPageCitation, '2025-07-09'), ['2026-06-24']);
  assert.equal(historicalBaselineCitation({
    pageFullCitation: currentPageCitation,
    sourceValidTo: '2025-07-09',
    citationValidAt: '2023-11-01',
    context: 'SächsBspOrgG',
  }), 'Sächsisches Beispielorganisationsgesetz vom 25. November 2003 (SächsGVBl. S. 9899)');
  assert.throws(() => historicalBaselineCitation({
    pageFullCitation: currentPageCitation,
    sourceValidTo: '2025-07-09',
    citationValidAt: '2023-11-01',
    baselineCitation: currentPageCitation,
    context: 'SächsBspOrgG',
  }), /historischem Rechtsstand/u);
});

test('Buchstabengliederung, generische Wrapper und betitelte Abschnitte werden strukturtreu erfasst', () => {
  const parsed = parseRevosaxSnapshot(snapshot(`
    <section title="Verwaltungsvorschrift"><h3>Verwaltungsvorschrift</h3>
      <p>Die VwV Test wird wie folgt geändert:</p>
    </section>
    <section title="A. Geltungsbereich"><h3>A. Geltungsbereich</h3>
      <p>Diese Verwaltungsvorschrift gilt für alle Behörden.</p>
    </section>
    <section title="I. Begriffe"><h3>I. Begriffe</h3>
      <p>Behörde ist jede Stelle.</p>
    </section>
    <section title="1. Sachliche Zuständigkeit"><h3>1. Sachliche Zuständigkeit</h3>
      <p>(1) Zuständig ist die Landesdirektion.</p>
    </section>
    <section title="B Inkrafttreten"><h3>B Inkrafttreten</h3>
      <p>Diese Vorschrift tritt am 1. Januar 2020 in Kraft.</p>
    </section>
    <section title="Übereinkommen"><h3>Übereinkommen</h3>
      <p>Das Übereinkommen wird nachstehend veröffentlicht.</p>
    </section>`), { url: 'https://www.revosax.sachsen.de/vorschrift/1' });

  // Der erste Block stammt aus dem Seitenkopf der Testvorlage; danach folgt der
  // aus dem Wrapper „Verwaltungsvorschrift“ auf die Dokumentebene gehobene Einleitungssatz.
  const body = parsed.body.slice(1);
  assert.deepEqual(body.map((block) => [block.type, block.label ?? null, block.title ?? null]), [
    ['paragraphText', null, null],
    ['section', 'A.', 'Geltungsbereich'],
    ['section', 'B.', 'Inkrafttreten'],
    ['section', null, 'Übereinkommen'],
  ]);
  assert.equal(body[0].text, 'Die VwV Test wird wie folgt geändert:');
  const letterA = body[1];
  assert.deepEqual(letterA.children.map((block) => [block.type, block.label ?? null]), [['paragraphText', null], ['section', 'I.']]);
  const roman = letterA.children[1];
  assert.deepEqual(roman.children.map((block) => [block.type, block.label ?? null]), [['paragraphText', null], ['section', '1.']]);
  assert.equal(roman.children[1].children[0].type, 'subparagraph');
  assert.deepEqual(parsed.structureNotes, [
    { kind: 'hoisted-wrapper', title: 'Verwaltungsvorschrift' },
    { kind: 'generic-section', title: 'Übereinkommen' },
  ]);
});

test('bekannte Gliederungen bleiben ohne Strukturhinweise und ohne Buchstabenfehlinterpretation', () => {
  const parsed = parseRevosaxSnapshot(snapshot(`
    <section title="Erster Teil Allgemeines"><h3>Erster Teil<br>Allgemeines</h3></section>
    <section title="§ 1 Zweck"><h3>§ 1 Zweck</h3><p>(1) Zweck.</p></section>
    <section title="Anlage 1"><h3>Anlage 1</h3><p>Muster.</p></section>`), { url: 'https://www.revosax.sachsen.de/vorschrift/1' });
  assert.equal(parsed.structureNotes, undefined);
  const body = parsed.body.filter((block) => block.type !== 'paragraphText');
  assert.deepEqual(body.map((block) => block.type), ['part']);
  assert.deepEqual(body[0].children.map((block) => [block.type, block.label]), [['paragraph', '§ 1'], ['annex', 'Anlage 1']]);
});

test('Alt-Layout ohne Gliederungscontainer, HTML-Listen und Wrapper mit alleinigem Text werden erfasst', () => {
  const legacy = parseRevosaxSnapshot(`<!doctype html><html><body><div id="content"><div class="law_show">
    <h1>Änderung der Beispielalarmrichtlinie</h1>
    <p>Vollzitat: Änderung der Beispielalarmrichtlinie vom 1. Dezember 2000 (SächsABl. 2001 S. 4)</p>
    <article id="lesetext"><nav data-level="1" title="Verwaltungsvorschrift"><div id="lesetext">
      <h3 class="centre">Verwaltungsvorschrift</h3>
      <p class="centre"><strong>Vom 1. Dezember 2000</strong></p>
      <ol><li>In Nr. 1.3 wird der 2. Halbsatz ersetzt.<ol><li>Unterpunkt.</li></ol></li><li>Diese Verwaltungsvorschrift tritt am 1. Januar 2001 in Kraft.</li></ol>
      <p class="gauche">Dresden, 1. Dezember 2000</p>
      <p class="gauche"><strong>Sächsisches Staatsministerium des Innern</strong></p>
    </div></nav></article>
    <div id="quickbar"><p>Fassung gültig ab: 1. Januar 2001</p></div>
  </div></div></body></html>`, { url: 'https://www.revosax.sachsen.de/vorschrift/1643' });
  assert.deepEqual(legacy.body.map((block) => [block.type, block.label, block.text.slice(0, 20)]), [
    ['item', '1.', 'In Nr. 1.3 wird der '],
    ['item', '2.', 'Diese Verwaltungsvor'],
  ]);
  assert.deepEqual(legacy.body[0].children, [{ type: 'item', label: '1.', text: 'Unterpunkt.', level: 1, numberingStyle: 'decimal', children: [] }]);
  assert.deepEqual(legacy.structureNotes, [{ kind: 'legacy-layout' }, { kind: 'no-provisions' }]);

  const consent = parseRevosaxSnapshot(snapshot(`
    <section title="Gesetz"><h2 class="centre">Gesetz</h2><h4 class="centre">= Artikel 1 des Gesetzes</h4>
      <p class="gauche">Dem Fünften Staatsvertrag wird zugestimmt.</p>
    </section>`), { url: 'https://www.revosax.sachsen.de/vorschrift/1894' });
  assert.deepEqual(consent.body.at(-1), { type: 'paragraphText', text: 'Dem Fünften Staatsvertrag wird zugestimmt.' });
  assert.deepEqual(consent.structureNotes, [{ kind: 'hoisted-wrapper', title: 'Gesetz' }, { kind: 'no-provisions' }]);

  const numbered = parseRevosaxSnapshot(snapshot(`
    <section title="Teil A Aufnahme"><h3>Teil A Aufnahme</h3></section>
    <section title="1."><h3>1.</h3><p>Erster Punkt.</p></section>
    <section title="Inhaltsverzeichnis"><h3>Inhaltsverzeichnis</h3><p>§ 1 Zweck</p></section>`), { url: 'https://www.revosax.sachsen.de/vorschrift/2' });
  const structural = numbered.body.filter((block) => block.type !== 'paragraphText');
  assert.deepEqual(structural.map((block) => [block.type, block.label, block.title]), [['part', 'Teil A', 'Aufnahme']]);
  assert.deepEqual(structural[0].children.map((block) => [block.type, block.label]), [['section', '1.']]);
  assert.equal(numbered.structureNotes, undefined);
  // Ein Wrapper „Gesetz“ neben echten Gliederungseinheiten bleibt wie bisher unberücksichtigt.
  const mixed = parseRevosaxSnapshot(snapshot(`
    <section title="Gesetz"><h2>Gesetz</h2><p>Präsentationstext.</p></section>
    <section title="§ 1 Zweck"><h3>§ 1 Zweck</h3><p>(1) Zweck.</p></section>`), { url: 'https://www.revosax.sachsen.de/vorschrift/3' });
  assert.doesNotMatch(JSON.stringify(mixed.body), /Präsentationstext/u);
});

test('Bekanntmachungen als eigene Vorschrift und Abschnitte außerhalb von .sections werden gelesen', () => {
  const notice = parseRevosaxSnapshot(snapshot(`
    <section title="Bekanntmachung"><h3 class="centre">Bekanntmachung</h3><p class="centre"><strong>Vom 14. Juni 2005</strong></p>
      <p class="gauche">Das Staatsministerium gibt bekannt, dass die Aufgabe übertragen wurde.</p>
    </section>`), { url: 'https://www.revosax.sachsen.de/vorschrift/1266' });
  assert.deepEqual(notice.body.at(-1), { type: 'paragraphText', text: 'Das Staatsministerium gibt bekannt, dass die Aufgabe übertragen wurde.' });
  assert.deepEqual(notice.structureNotes, [{ kind: 'hoisted-wrapper', title: 'Bekanntmachung' }, { kind: 'no-provisions' }]);

  const modern = parseRevosaxSnapshot(`<!doctype html><html><body><div id="content"><div class="law_show">
    <h1>VwV Beispielunterricht</h1><p>Vollzitat: VwV Beispielunterricht vom 26. März 2026 (MBl. SMK S. 9038)</p>
    <article id="lesetext"><header title="Eingangsformel"><h3 class="centre">Verwaltungsvorschrift</h3><p class="centre"><b>Vom 26. März 2026</b></p></header>
      <div id="_idContainer000" class="Einfacher-Textrahmen">
        <section data-level="1" title="I. Geltungsbereich"><h4 class="centre">I.<br>Geltungsbereich</h4><p class="FLIESSTEXT">Diese Verwaltungsvorschrift gilt für alle Schulen.</p></section>
        <section data-level="1" title="II. Religionsunterricht"><h4 class="centre">II.<br>Religionsunterricht</h4></section>
        <section data-level="2" title="1. Rechtsgrundlagen"><dl class="cf"><dt class="td_1">1.</dt><dd class="last">Rechtsgrundlagen</dd></dl></section>
      </div></article>
    <div id="quickbar"><p>Fassung gültig ab: 1. August 2026</p></div>
  </div></div></body></html>`, { url: 'https://www.revosax.sachsen.de/vorschrift/2405' });
  const sections = modern.body.filter((block) => block.type === 'section');
  assert.deepEqual(sections.map((block) => [block.label, block.title]), [['I.', 'Geltungsbereich'], ['II.', 'Religionsunterricht']]);
  assert.deepEqual(sections[1].children.map((block) => [block.type, block.label, block.title]), [['section', '1.', 'Rechtsgrundlagen']]);
  // Die Nummer wiederholt nur die Überschrift ihrer Einheit; sie entfällt in der Lesefassung.
  assert.deepEqual(sections[1].children[0].children, []);
  assert.equal(modern.sourceValidFrom, '2026-08-01');
});

test('die Überschrift einer Gliederungseinheit steht genau einmal im Normtext', () => {
  const parsed = parseRevosaxSnapshot(snapshot(`
    <section title="1. Vorbehalt des Begnadigungsrechts"><h4>1. Vorbehalt des Begnadigungsrechts</h4>
      <dl class="cf"><dt class="td_1">1.</dt><dd class="td_last_1"><strong>Vorbehalt des Begnadigungsrechts</strong><br>Die Ausübung bleibt vorbehalten.
        </dd></dl></section>
    <section title="2. Übertragung"><h4>2. Übertragung</h4>
      <dl class="cf"><dt class="td_1">2.</dt><dd class="td_last_1">2. Übertragung</dd>
        <dt class="td_2">a)</dt><dd class="td_last_2">Erste Möglichkeit.</dd></dl></section>
    <section title="3. Begründung"><h4>3. Begründung</h4>
      <p>Begründungen sind schriftlich zu geben.</p></section>`), { url: 'https://www.revosax.sachsen.de/vorschrift/4058' });
  const sections = parsed.body.filter((block) => block.type === 'section');
  assert.deepEqual(sections[0].children.map((block) => [block.type, block.label, block.text]), [
    ['item', '1.', 'Die Ausübung bleibt vorbehalten.'],
  ]);
  // Bleibt kein Text übrig, rücken die Unterpunkte an die Stelle des leeren Punktes.
  assert.deepEqual(sections[1].children.map((block) => [block.type, block.label, block.text]), [
    ['item', 'a)', 'Erste Möglichkeit.'],
  ]);
  // Ein Text, der lediglich mit demselben Wort beginnt, bleibt unverändert.
  assert.deepEqual(sections[2].children.map((block) => [block.type, block.text]), [
    ['paragraphText', 'Begründungen sind schriftlich zu geben.'],
  ]);
});

test('Überschriften aus Gliederungszeichen- und Titelzeile werden nur bei vollständiger Übereinstimmung entfernt', () => {
  const parsed = parseRevosaxSnapshot(snapshot(`
    <section title="Artikel 12 Inkrafttreten"><h4>Artikel 12 Inkrafttreten</h4>
      <p>Artikel 12<br>Inkrafttreten<br>Dieses Gesetz tritt in Kraft.</p></section>
    <section title="§ 2 Ausgliederungsgegenstand"><h4>§ 2 Ausgliederungsgegenstand</h4>
      <p>Ausgliederungsgegenstand ist das Flurstück 12.</p></section>`), { url: 'https://www.revosax.sachsen.de/vorschrift/3734' });
  const article = parsed.body.find((block) => block.label === 'Artikel 12');
  assert.deepEqual(article.children.map((block) => [block.type, block.text]), [
    ['paragraphText', 'Dieses Gesetz tritt in Kraft.'],
  ]);
  const paragraph = parsed.body.find((block) => block.label === '§ 2');
  assert.deepEqual(paragraph.children.map((block) => [block.type, block.text]), [
    ['paragraphText', 'Ausgliederungsgegenstand ist das Flurstück 12.'],
  ]);
});

test('die sichtbare Überschrift geht einem abweichenden oder maskierten title-Attribut vor', () => {
  const body = parsedBody(`
    <section title="§ 1 Zuschuss für Betreuung nach dem Gesetz über Einrichtungen"><h4>§ 1<br>Zuschuss für Einrichtungen nach dem Gesetz über Betreuung</h4>
      <p>(1) Der Zuschuss wird jährlich gezahlt.</p></section>
    <section title="§ 2 Voraussetzungen&lt;br&gt;für Prüfungen"><h4>§ 2<br>Voraussetzungen<br>für Prüfungen</h4>
      <p>(1) Erforderlich ist ein Abschluss.</p></section>
    <section title="§ 3 Übergangsregelungen"><h4>§ 3 <br><i>(aufgehoben)</i></h4></section>
    <section title="§ 4 Voraussetzungen&lt;br&gt;für Ausnahmen"><p>(1) Ausnahmen sind zulässig.</p></section>
    <section title="Anlage 1 Gebührensätze"><h4>Anlage 1</h4><p>Gebühren nach Stufen.</p></section>
    <section title="Anlage 2 Gebührenstufen"><h4>Anlage 3<br>Abweichende Zählung</h4><p>Stufen.</p></section>`);
  const units = body.filter((block) => block.label);
  assert.deepEqual(units.map((block) => [block.type, block.label, block.title]), [
    // Sichtbare Überschrift statt veralteter Metadaten, Zeilenumbrüche als Leerzeichen.
    ['paragraph', '§ 1', 'Zuschuss für Einrichtungen nach dem Gesetz über Betreuung'],
    ['paragraph', '§ 2', 'Voraussetzungen für Prüfungen'],
    ['paragraph', '§ 3', '(aufgehoben)'],
    // Ohne sichtbare Überschrift bleibt das Attribut maßgeblich, ein maskierter Umbruch wird Leerzeichen.
    ['paragraph', '§ 4', 'Voraussetzungen für Ausnahmen'],
    // Nennt die sichtbare Überschrift keinen eigenen Titel oder ein anderes Kennzeichen, bleibt das Attribut.
    ['annex', 'Anlage 1', 'Gebührensätze'],
    ['annex', 'Anlage 2', 'Gebührenstufen'],
  ]);
  assert.ok(units.every((block) => !/<br/iu.test(block.title ?? '')));
});

test('nennt die Kopfzeile nur Kennzeichen und Bezug, gilt die folgende sichtbare Überschriftenzeile', () => {
  const body = parsedBody(`
    <section title="Anlage 1 Übersicht über die Sätze nach Teilnehmern"><h4>Anlage 1<br>(zu § 2 Absatz 1)<a class="fussnote_link" href="#FNID_1"><sup>1</sup></a></h4>
      <h5>Übersicht über die Sätze<br>nach Teilnehmerinnen und Teilnehmern</h5><p>Sätze nach Stufen.</p></section>
    <section title="Anlage 2"><h4>Anlage 2 (zu § 3)</h4><h5>Verfahrensstufen</h5><p>Stufen.</p></section>
    <section title="Anlage 3 (zu § 4)"><h4>Anlage 3 (zu § 4)</h4><h5>Prüfpunkte</h5><p>Punkte.</p></section>
    <section title="Anlage 4 Zuordnung"><h4>Anlage 4<br>(zu § 5)</h4><p>Ohne eigene Überschriftenzeile.</p></section>
    <section title="Anlage 5 Grenzwerte"><h4>Anlage 6<br>(zu § 6)</h4><h5>Abweichende Zählung</h5><p>Werte.</p></section>
    <section title="Anlage 7 Tabellen"><h4>Anlage 7</h4><h5>Anlage 8</h5><p>Tabellen.</p></section>`);
  const units = body.filter((block) => block.label);
  assert.deepEqual(units.map((block) => [block.type, block.label, block.title]), [
    // Sichtbare Überschrift aus der folgenden Zeile statt des veralteten Attributs; der Bezug
    // bleibt beim Kennzeichen so, wie das Attribut ihn führt.
    ['annex', 'Anlage 1', 'Übersicht über die Sätze nach Teilnehmerinnen und Teilnehmern'],
    ['annex', 'Anlage 2', 'Verfahrensstufen'],
    ['annex', 'Anlage 3 (zu § 4)', 'Prüfpunkte'],
    // Ohne folgende Überschriftenzeile, bei abweichendem Kennzeichen oder wenn die folgende Zeile
    // selbst ein Gliederungskennzeichen ist, bleibt das Attribut maßgeblich.
    ['annex', 'Anlage 4', 'Zuordnung'],
    ['annex', 'Anlage 5', 'Grenzwerte'],
    ['annex', 'Anlage 7', 'Tabellen'],
  ]);
  // Die Überschriftenzeile wird nicht zusätzlich als Normtext übernommen.
  assert.deepEqual(units[0].children.map((block) => block.text), ['Sätze nach Stufen.']);
});

test('eine Tabelle in einem Listeneintrag bleibt als Tabellenblock des Eintrags erhalten', () => {
  const body = definitionBody(`
    <dt class="td_1">1.</dt><dd class="last">Die Angabe wird gestrichen.</dd>
    <dt class="td_1">2.</dt><dd class="last">Folgende Stufe wird angefügt:
      <table><caption>Stufe 3</caption>
        <thead><tr><th scope="col">Nr.</th><th scope="col">Betrag<br>EUR</th></tr></thead>
        <tbody><tr><td>„3.</td><td>10 bis 20“</td></tr></tbody>
      </table>
    </dd>`);
  const paragraph = findLabel(body, '§ 1');
  const item = paragraph.children.find((block) => block.label === '2.');
  assert.equal(item.text, 'Folgende Stufe wird angefügt:');
  assert.equal(item.children.length, 1);
  const [table] = item.children;
  assert.equal(table.type, 'table');
  assert.equal(table.title, 'Stufe 3');
  assert.equal(table.columns, 2);
  assert.deepEqual(table.children.map((row) => row.children.map((cell) => [cell.type, cell.text])), [
    [['tableHeaderCell', 'Nr.'], ['tableHeaderCell', 'Betrag\nEUR']],
    [['tableCell', '„3.'], ['tableCell', '10 bis 20“']],
  ]);
  assert.equal(paragraph.children.find((block) => block.label === '1.').children.length, 0);
});

test('unbetitelte technische Abschnitte werden auf die aktuelle Ebene gehoben', () => {
  const parsed = parseRevosaxSnapshot(snapshot(`
    <section title="Artikel 1 Grundsätze"><h4>Artikel 1 Grundsätze</h4><p>(1) Der Freistaat ist ein Land.</p></section>
    <section data-satzzahl="manuell" id="x1"><p>(2) Ergänzender Absatz ohne eigene Gliederung.</p></section>`), { url: 'https://www.revosax.sachsen.de/vorschrift/3975' });
  const article = parsed.body.find((block) => block.type === 'article');
  assert.deepEqual(article.children.map((block) => block.label), ['(1)', '(2)']);
  assert.deepEqual(parsed.structureNotes, [{ kind: 'untitled-wrapper' }]);
});

test('historische Zitierung entfernt spätere Änderungsklauseln auch bei gleichem Erlassjahr', () => {
  const citation = 'RL Beispielwohnraum vom 31. Mai 2023 (SächsABl. S. 9677), die durch Großbuchstabe B der Richtlinie vom 20. Dezember 2023 (SächsABl. 2024 S. 110) geändert worden ist, zuletzt enthalten in der Verwaltungsvorschrift vom 5. Dezember 2025 (SächsABl. SDr. S. S 286)';
  assert.equal(
    historicalBaselineCitation({ pageFullCitation: citation, sourceValidTo: '2023-11-30' }),
    'RL Beispielwohnraum vom 31. Mai 2023 (SächsABl. S. 9677)',
  );
  assert.equal(
    historicalBaselineCitation({
      pageFullCitation: 'Förderrichtlinie Beispielzucht vom 27. Juni 2023 (SächsABl. S. 9931), die durch die Richtlinie vom 27.11.2023 (SächsABl. S. 1568) geändert worden ist',
      sourceValidTo: '2023-12-14',
      citationValidAt: '2023-11-01',
    }),
    'Förderrichtlinie Beispielzucht vom 27. Juni 2023 (SächsABl. S. 9931)',
  );
});

function identitySnapshot(heading, pageTitle = 'Testgesetz') {
  return `<!doctype html><html><body><div id="content"><div class="law_show">
    <h1>${pageTitle}</h1>
    <p>Vollzitat: Testgesetz vom 1. Januar 2020 (OGVBl. 2020 Nr. 1)</p>
    <article id="lesetext">
      <header><h3>${heading}</h3><p>1. Januar 2020</p></header>
      <div class="sections"><section title="§ 1 Zweck"><h3>§ 1 Zweck</h3><p>(1) Das Gesetz regelt seinen Zweck.</p></section></div>
    </article>
    <div id="quickbar"><div class="box"><h3>Gültigkeitszeitraum</h3><p>Fassung gültig ab: 1. Januar 2020</p></div></div>
  </div></div></body></html>`;
}

function parsedIdentity(heading, pageTitle) {
  const parsed = parseRevosaxSnapshot(identitySnapshot(heading, pageTitle), { url: 'https://www.revosax.sachsen.de/vorschrift/1' });
  return { sourceTitle: parsed.sourceTitle, longTitle: parsed.longTitle, shortTitle: parsed.shortTitle, abbr: parsed.abbr };
}

test('die Kennzeile trennt Langtitel, Kurzbezeichnung und Abkürzung', () => {
  assert.deepEqual(
    parsedIdentity('Gesetz über die Prüfung von Testfällen (Testprüfgesetz – TestPrG)', 'Testprüfgesetz'),
    {
      sourceTitle: 'Testprüfgesetz',
      longTitle: 'Gesetz über die Prüfung von Testfällen',
      shortTitle: 'Testprüfgesetz',
      abbr: 'TestPrG',
    },
  );
});

test('ein einteiliger Klammerzusatz wird als Abkürzung oder als Kurzbezeichnung eingeordnet', () => {
  assert.deepEqual(parsedIdentity('Gesetz über Testfälle (TestG)'), {
    sourceTitle: 'Testgesetz',
    longTitle: 'Gesetz über Testfälle',
    shortTitle: 'Testgesetz',
    abbr: 'TestG',
  });
  assert.deepEqual(parsedIdentity('Gesetz über Testfälle (VwV Formblätter Testwesen)'), {
    sourceTitle: 'Testgesetz',
    longTitle: 'Gesetz über Testfälle',
    shortTitle: 'VwV Formblätter Testwesen',
    abbr: undefined,
  });
});

test('Gedankenstriche ohne Leerzeichen trennen ebenfalls, Jahresspannen bleiben Titelbestandteil', () => {
  assert.deepEqual(parsedIdentity('Gesetz über Testfälle (Testprüfgesetz –TestPrG)'), {
    sourceTitle: 'Testgesetz',
    longTitle: 'Gesetz über Testfälle',
    shortTitle: 'Testprüfgesetz',
    abbr: 'TestPrG',
  });
  assert.deepEqual(parsedIdentity('Förderrichtlinie Testförderung 2014–2020'), {
    sourceTitle: 'Testgesetz',
    longTitle: 'Förderrichtlinie Testförderung 2014–2020',
    shortTitle: 'Testgesetz',
    abbr: undefined,
  });
  assert.deepEqual(parsedIdentity('Förderrichtlinie Testförderung (Testprogramm 2014–2020)'), {
    sourceTitle: 'Testgesetz',
    longTitle: 'Förderrichtlinie Testförderung (Testprogramm 2014–2020)',
    shortTitle: 'Testgesetz',
    abbr: undefined,
  });
});

test('die amtliche Fundstellennummer wird aus der Marginalspalte gelesen', () => {
  const withFsn = `<!doctype html><html><body><div id="content"><div class="law_show">
    <h1>Testgesetz</h1>
    <p>Vollzitat: Testgesetz vom 1. Januar 2020 (OGVBl. 2020 Nr. 1)</p>
    <article id="lesetext">
      <header><h3>Testgesetz (TestG)</h3><p>1. Januar 2020</p></header>
      <div class="sections"><section title="§ 1 Zweck"><h4>§ 1 Zweck</h4><p>(1) Testinhalt.</p></section></div>
    </article>
    <div id="quickbar">
      <div class="box"><h3>Fundstelle und systematische Gliederungsnummer</h3><p>
        OGVBl. 2020 Nr. 1, S. 2
        <br>
        Fsn-Nr.: 612-3.10/2
      </p></div>
      <div class="box"><h3>Gültigkeitszeitraum</h3><p>Fassung gültig ab: 1. Januar 2020</p></div>
    </div>
  </div></div></body></html>`;
  assert.equal(parseRevosaxSnapshot(withFsn, { url: 'https://www.revosax.sachsen.de/vorschrift/1' }).fsnNumber, '612-3.10/2');

  // Ältere Fassungsseiten führen den Kasten ohne Gliederungsnummer.
  const withoutFsn = withFsn.replace('Fsn-Nr.: 612-3.10/2', '');
  assert.equal(parseRevosaxSnapshot(withoutFsn, { url: 'https://www.revosax.sachsen.de/vorschrift/1' }).fsnNumber, null);
  assert.equal(parseRevosaxSnapshot(snapshot('<section title="§ 1 Zweck"><h4>§ 1 Zweck</h4><p>(1) Testinhalt.</p></section>'), { url: 'https://www.revosax.sachsen.de/vorschrift/1' }).fsnNumber, null);
});

test('sächsische Fundstellenpflege nach dem Stichtag gehört nicht in die übernommene Zitierung', () => {
  const citation = 'Anordnung über die Ausübung des Beispielrechts vom 8. Oktober 1997 (SächsABl. S. 9124), zuletzt enthalten in der Verwaltungsvorschrift vom 27. November 2025 (SächsABl. SDr. S. S 209)';
  assert.deepEqual(containmentDatesFromCitation(citation), ['2025-11-27']);
  assert.deepEqual(futureContainmentDates(citation, '2023-11-01'), ['2025-11-27']);
  assert.equal(
    stripFutureContainmentClause(citation, '2023-11-01'),
    'Anordnung über die Ausübung des Beispielrechts vom 8. Oktober 1997 (SächsABl. S. 9124)',
  );
  assert.equal(
    historicalBaselineCitation({ pageFullCitation: citation, sourceValidTo: null, citationValidAt: '2023-11-01', context: 'Test' }),
    'Anordnung über die Ausübung des Beispielrechts vom 8. Oktober 1997 (SächsABl. S. 9124)',
  );
});

test('Aufnahmeklauseln vor dem Stichtag und spätere Änderungen bleiben unterscheidbar', () => {
  const before = 'Testvorschrift vom 1. Januar 2015 (SächsABl. S. 5), zuletzt enthalten in der Verwaltungsvorschrift vom 2. Dezember 2020 (SächsABl. SDr. S. S 1)';
  assert.deepEqual(futureContainmentDates(before, '2023-11-01'), []);
  assert.equal(historicalBaselineCitation({ pageFullCitation: before, sourceValidTo: null, citationValidAt: '2023-11-01', context: 'Test' }), before);
  const both = 'Testvorschrift vom 1. Januar 2015 (SächsABl. S. 5), die durch die Verwaltungsvorschrift vom 4. Mai 2024 (SächsABl. S. 9) geändert worden ist, zuletzt enthalten in der Verwaltungsvorschrift vom 2. Dezember 2025 (SächsABl. SDr. S. S 1)';
  assert.equal(
    historicalBaselineCitation({ pageFullCitation: both, sourceValidTo: null, citationValidAt: '2023-11-01', context: 'Test' }),
    'Testvorschrift vom 1. Januar 2015 (SächsABl. S. 5)',
  );
});

test('der Ablauftag einer außer Kraft getretenen Vorschrift beendet die Quellgültigkeit', () => {
  const html = snapshot('<section title="§ 1 Zweck"><h3>§ 1 Zweck</h3><p>Text.</p></section>').replace(
    '<p>Fassung gültig ab: 1. Januar 2020</p>',
    '<p>Fassung gültig ab: 1. Januar 2020</p><p>Vorschrift außer Kraft mit Ablauf des: 31. August 2024</p>',
  );
  const parsed = parseRevosaxSnapshot(html, { url: 'https://www.revosax.sachsen.de/vorschrift/1' });
  assert.equal(parsed.sourceValidFrom, '2020-01-01');
  assert.equal(parsed.sourceValidTo, '2024-08-31');
});

test('die historische Zitierung misst spätere Änderungen am Tag der Ausgangsfassung', () => {
  const pageFullCitation = 'Testgesetz vom 1. Januar 2020 (SächsGVBl. S. 1), das zuletzt durch Artikel 2 des Gesetzes vom 22. Juli 2024 (SächsGVBl. S. 706) geändert worden ist';
  // Bis zum Ende des Fassungszeitraums gemessen bliebe die Änderung von 2024 stehen.
  assert.equal(historicalBaselineCitation({ pageFullCitation, sourceValidTo: '2024-09-30' }), pageFullCitation);
  assert.equal(
    historicalBaselineCitation({ pageFullCitation, sourceValidTo: '2024-09-30', citationValidAt: '2023-11-01' }),
    'Testgesetz vom 1. Januar 2020 (SächsGVBl. S. 1)',
  );
});

test('REVOSax-Seiten im neueren Layout ohne #content und #quickbar werden gleich gelesen', () => {
  const html = `<!doctype html><html><body><div id="main" class="main"><main class="content" id="main-content">
    <div class="law_show" data-controller="law-version">
      <h1 id="page-title">Testverordnung</h1><p class="vollzitat">Vollzitat: Testverordnung vom 1. Januar 2020 (OGVBl. 2020 Nr. 1)</p>
      <article id="lesetext">
        <header><h3 class="centre">Verordnung über Testfälle<br> (Testverordnung – TestVO)</h3><p class="centre"><strong>Vom 1. Januar 2020</strong></p></header>
        <div class="sections"><section title="§ 1 Zweck"><h3>§ 1 Zweck</h3><p>(1) Die Verordnung regelt ihren Zweck.</p></section></div>
      </article>
    </div>
  </main>
  <div class="sidebar sidebar-right" id="main-sidebar-right">
    <div class="box"><div class="box-header">Fundstelle und systematische Gliederungsnummer</div><div class="box-body"><p>OGVBl. 2020 Nr. 1, S. 1<br>Fsn-Nr.: 123-4.5</p></div></div>
    <div class="box"><div class="box-header">Gültigkeitszeitraum</div><div class="box-body"><p>Fassung gültig ab: 2. Januar 2020</p><p>Fassung gültig bis: 31. Dezember 2023</p></div></div>
  </div></div></body></html>`;
  const parsed = parseRevosaxSnapshot(html, { url: 'https://www.revosax.sachsen.de/vorschrift/1.1' });
  assert.equal(parsed.sourceTitle, 'Testverordnung');
  assert.equal(parsed.fullCitation, 'Testverordnung vom 1. Januar 2020 (OGVBl. 2020 Nr. 1)');
  assert.equal(parsed.fsnNumber, '123-4.5');
  assert.equal(parsed.documentDate, '2020-01-01');
  assert.equal(parsed.sourceValidFrom, '2020-01-02');
  assert.equal(parsed.sourceValidTo, '2023-12-31');
  assert.equal(findLabel(parsed.body, '§ 1')?.title, 'Zweck');
});
