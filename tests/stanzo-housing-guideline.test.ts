import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { loadAllNorms } from '../src/lib/norms/loader.ts';
import { loadAllVerkuendungen } from '../src/lib/norms/publications.ts';
import { parsePublicationHtml } from '../scripts/lib/norm-html-parser.mjs';

const slug = 'bekanntmachung-gemeingut-wohnen-mietpreisbildung';
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
type ParsedBlock = { type: string; label?: string; title?: string; children?: ParsedBlock[] };

test('StAnzO. 2026 Nr. 15 erschließt die Bekanntmachung samt amtlichem PDF', async () => {
  const publication = (await loadAllVerkuendungen()).find((entry) => entry.slug === 'stanzo-2026-15');
  assert.ok(publication);
  assert.equal(publication.publication, 'StAnzO.');
  assert.equal(publication.date, '2026-08-08');
  assert.equal(publication.place, 'Dresden');
  assert.equal(publication.entries[0].type, 'bekanntmachung');
  assert.equal(publication.entries[0].citation, 'Bekanntmachung vom 8. August 2026 (StAnzO. 2026 Nr. 15 S. 2)');
  assert.equal(publication.entries[0].pages, '2–3');
  assert.equal(publication.entries[0].normSlug, slug);
  assert.equal(publication.pdf, '/assets/recht/StAnzO. 2026 Nr. 15.pdf');
  assert.deepEqual(readFileSync('public/assets/recht/StAnzO. 2026 Nr. 15.pdf'), readFileSync('Gesetze/StAnzO. 2026 Nr. 15.pdf'));
});

test('Leitlinie bleibt eine Bekanntmachung und tritt erst am 1. September in Kraft', async () => {
  const norm = (await loadAllNorms()).find((entry) => entry.meta.slug === slug);
  assert.ok(norm);
  assert.equal(norm.meta.type, 'bekanntmachung');
  assert.notEqual(norm.meta.type, 'gesetz');
  assert.equal(norm.meta.documentDate, '2026-08-08');
  assert.equal(norm.meta.publicationDate, '2026-08-08');
  assert.equal(norm.meta.effectiveDate, '2026-09-01');
  assert.equal(norm.meta.status, 'future-effective');
  assert.deepEqual(norm.meta.relatedNorms, ['gemeingut-wohnen-gesetz']);
});

test('alle fünf Gliederungspunkte und die sechs Kostenpositionen sind quellentreu strukturiert', () => {
  const html = readFileSync('Gesetze/StAnzO. 2026 Nr. 15.html', 'utf8');
  const parsed = parsePublicationHtml('StAnzO. 2026 Nr. 15.html', html);
  const sections = (parsed.body as ParsedBlock[]).filter((block) => block.type === 'section');
  assert.deepEqual(sections.map((block) => [block.label, block.title]), [
    ['1.', 'Gemeinwirtschaftliche Mietpreisbildung'],
    ['2.', 'Absenkung der Bestandsmieten'],
    ['3.', 'Gemeinwirtschaftliche Kostenmiete'],
    ['4.', 'Zielwert'],
    ['5.', 'Inkrafttreten'],
  ]);
  const costs = (sections[2].children ?? []).filter((block) => block.type === 'item');
  assert.deepEqual(costs.map((block) => block.label), ['1.', '2.', '3.', '4.', '5.', '6.']);
  assert.match(JSON.stringify(sections[1]), /um 25 Prozent abgesenkt/u);
  assert.match(JSON.stringify(sections[4]), /1\. September 2026 in Kraft/u);
});

test('HTML und PDF sind unveränderte, gehashte Quellen; temp-neu bleibt ausgeschlossen', () => {
  assert.equal(sha256('Gesetze/StAnzO. 2026 Nr. 15.html'), '5eff7d2526fd8b17e458bb8badcc1c9ee7c1ee712562b77e56ad1d8e86226fe7');
  assert.equal(sha256('Gesetze/StAnzO. 2026 Nr. 15.pdf'), '13c5e0932e90647e64ff850b0f1c0f84521c77f4343e8bd7f099a0afdfa4ac5c');
  assert.equal(sha256('Gesetze/PM-08082026-04.html'), 'ca87b72c23d4c16d8e0b855d95078575fada4339ff0b162e72d60d514e8a73ef');
  assert.equal(sha256('Gesetze/PM-08082026-04.pdf'), 'cc25f3c59ffc1d3c4eff83489d80431819f101cfccefee5797a7f5a24bd67f72');
  assert.match(readFileSync('.gitignore', 'utf8'), /^temp-neu\/$/mu);
});

test('Pressemitteilung, Themenseite und Wissenshub geben die gesicherten Maßnahmen wieder', () => {
  const press = JSON.parse(readFileSync('content/presse/mitteilungen/gemeingut-wohnen-senkt-bestandsmieten.json', 'utf8'));
  const topic = JSON.parse(readFileSync('content/themen/wohnen-und-vergesellschaftung.json', 'utf8'));
  const projects = JSON.parse(readFileSync('knowledge/projects.json', 'utf8')).projects;
  const timeline = JSON.parse(readFileSync('knowledge/timeline.json', 'utf8')).events;
  assert.equal(press.date, '2026-08-08');
  assert.match(JSON.stringify(press), /25 Prozent/u);
  assert.match(JSON.stringify(press), /5,50 Euro/u);
  assert.ok(topic.rechtsgrundlagen.some((entry: { normSlug?: string }) => entry.normSlug === slug));
  assert.ok(projects.find((entry: { id: string }) => entry.id === 'project-wohnen').normRefs.some((entry: { normSlug: string }) => entry.normSlug === slug));
  assert.deepEqual(
    timeline.filter((entry: { id: string }) => entry.id.startsWith('event-gemeingut-wohnen-')).map((entry: { date: string }) => entry.date),
    ['2026-08-08', '2026-09-01'],
  );
});

test('bestehende Staatsanzeiger- und Normtypen bleiben erhalten', async () => {
  const publications = await loadAllVerkuendungen();
  const norms = await loadAllNorms();
  for (const publicationSlug of ['stanzo-2026-13', 'stanzo-2026-14']) {
    assert.ok(publications.some((entry) => entry.slug === publicationSlug));
  }
  for (const type of ['gesetz', 'verordnung', 'verwaltungsvorschrift', 'bekanntmachung']) {
    assert.ok(norms.some((entry) => entry.meta.type === type), type);
  }
});
