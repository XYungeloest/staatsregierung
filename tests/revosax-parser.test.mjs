import assert from 'node:assert/strict';
import test from 'node:test';

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
