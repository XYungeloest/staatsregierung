import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  amendmentDatesFromCitation,
  futureAmendmentDates,
  historicalBaselineCitation,
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

test('echter § 4 SächsPVDG erhält 3 -> a/b und 4.b -> aa/bb/cc', () => {
  const source = readFileSync(
    'data/recht/sources/revosax/ostdeutsches-polizeivollzugsdienstgesetz/18193.1.html',
    'utf8',
  );
  const parsed = parseRevosaxSnapshot(source, { url: 'https://www.revosax.sachsen.de/vorschrift/18193.1' });
  const paragraph = findLabel(parsed.body, '§ 4');
  assert.deepEqual(findLabel(paragraph.children, '3.').children.slice(0, 3).map((item) => item.label), [
    'a)', 'b)', 'c)',
  ]);
  assert.deepEqual(findLabel(findLabel(paragraph.children, '4.').children, 'b)').children.map((item) => item.label), [
    'aa)', 'bb)', 'cc)',
  ]);
  const isolatedMarkers = [];
  (function collect(blocks) {
    for (const block of blocks ?? []) {
      if (block.type === 'paragraphText' && /^(?:[a-z]+\)|\(\d+\)|\([a-z]+\))$/u.test(block.text)) {
        isolatedMarkers.push(block.text);
      }
      collect(block.children);
    }
  }(paragraph.children));
  assert.deepEqual(isolatedMarkers, []);
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
  const currentPageCitation = 'Sächsisches Verwaltungsorganisationsgesetz vom 25. November 2003 (SächsGVBl. S. 899), das zuletzt durch Artikel 8 des Gesetzes vom 24. Juni 2026 (SächsGVBl. S. 190) geändert worden ist';
  assert.deepEqual(amendmentDatesFromCitation(currentPageCitation), ['2026-06-24']);
  assert.deepEqual(futureAmendmentDates(currentPageCitation, '2025-07-09'), ['2026-06-24']);
  assert.equal(historicalBaselineCitation({
    pageFullCitation: currentPageCitation,
    sourceValidTo: '2025-07-09',
    citationValidAt: '2023-11-01',
    context: 'SächsVwOrgG',
  }), 'Sächsisches Verwaltungsorganisationsgesetz vom 25. November 2003 (SächsGVBl. S. 899)');
  assert.throws(() => historicalBaselineCitation({
    pageFullCitation: currentPageCitation,
    sourceValidTo: '2025-07-09',
    citationValidAt: '2023-11-01',
    baselineCitation: currentPageCitation,
    context: 'SächsVwOrgG',
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
    <h1>Änderung der Alarmierungsrichtlinie</h1>
    <p>Vollzitat: Änderung der Alarmierungsrichtlinie vom 1. Dezember 2000 (SächsABl. 2001 S. 4)</p>
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
    <h1>VwV Religion und Ethik</h1><p>Vollzitat: VwV Religion und Ethik vom 26. März 2026 (MBl. SMK S. 38)</p>
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
  assert.equal(modern.sourceValidFrom, '2026-08-01');
});

test('unbetitelte technische Abschnitte werden auf die aktuelle Ebene gehoben', () => {
  const parsed = parseRevosaxSnapshot(snapshot(`
    <section title="Artikel 1 Grundsätze"><h4>Artikel 1 Grundsätze</h4><p>(1) Der Freistaat ist ein Land.</p></section>
    <section data-satzzahl="manuell" id="x1"><p>(2) Ergänzender Absatz ohne eigene Gliederung.</p></section>`), { url: 'https://www.revosax.sachsen.de/vorschrift/3975' });
  const article = parsed.body.find((block) => block.type === 'article');
  assert.deepEqual(article.children.map((block) => block.label), ['(1)', '(2)']);
  assert.deepEqual(parsed.structureNotes, [{ kind: 'untitled-wrapper' }]);
});
