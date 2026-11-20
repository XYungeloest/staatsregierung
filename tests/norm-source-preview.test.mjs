import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { inspectSource, renderSourcePreview } from '../scripts/lib/norm-source-preview.mjs';

const name = 'Prüfausgabe.html';
const html = `<html><body><p>Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland</p>
<p>Nr. 99</p><p>Ausgegeben zu Dresden am 21. Juli 2026</p><p>Inhaltsverzeichnis</p><p>20. Juli 2026 Testgesetz Seite 2</p>
<p>Gesetz<br>über eine Prüfregelung<br>vom 20. Juli 2026</p><h2>§ 1<br>Gegenstand</h2><p>Eine Regel.</p>
<h2>§ 2<br>Inkrafttreten</h2><p>Dieses Gesetz tritt am Tag nach seiner Verkündung in Kraft.</p></body></html>`;

test('Quellenprüfung nutzt den Importparser und vergleicht nur eine eindeutig bezeichnete Fassung', () => {
  const review = inspectSource(name, html);
  assert.deepEqual(review.warnings, []);
  assert.equal(review.norms.length, 1);
  const norm = review.norms[0];
  const saved = [{ entry: { title: norm.title, normSlug: 'pruefung', versionId: '2026-07-22', citation: 'S. 2' },
    version: { versionId: '2026-07-22', body: norm.body } }];
  const render = (records) => renderSourcePreview({ name, digest: '123', review, saved: records });
  assert.match(render(saved), /0 abweichende Texteinheiten/u);
  assert.match(render([{ ...saved[0], version: { ...saved[0].version, body: [] } }]), /Hinzugekommen/u);
  assert.match(render([{ ...saved[0], version: undefined }]), /bezeichnete Fassung fehlt/u);
  assert.match(render([...saved, ...saved]), /keine eindeutige gespeicherte Vergleichsfassung/u);
  assert.equal(render(saved), render(saved));
});

test('Gespeicherte Vorschau übernimmt nur Text, zeigt Parserbefunde und lehnt beliebige Pfade ab', () => {
  const source = '<html><head><style>@import "https://beispiel.invalid";</style></head><body><p>Pressemitteilung</p>'
    + '<script>anweisung()</script><img src="https://beispiel.invalid"><p>&lt;script&gt;Zitat&lt;/script&gt;</p></body></html>';
  const review = inspectSource(name, source);
  const rendered = renderSourcePreview({ name, digest: '123', review, warnings: ['Offene <Frage>'] });
  assert.doesNotMatch(rendered, /<script>|https:\/\/beispiel|anweisung\(\)/u);
  assert.match(rendered, /&lt;script&gt;Zitat/u);
  assert.match(rendered, /Offene &lt;Frage&gt;/u);
  assert.match(rendered, /default-src 'none'/u);
  assert.equal(review.norms.length, 0);
  const command = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/preview-norm-source.mjs', '--file', '../ausgabe.html']);
  assert.equal(command.status, 2);
});
