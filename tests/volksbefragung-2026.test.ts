import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { loadAllNorms } from '../src/lib/norms/loader.ts';
import { loadAllVerkuendungen } from '../src/lib/norms/publications.ts';
import { buildSearchIndexPayload } from '../src/lib/norms/search.ts';
import { buildPortalSearchEntries } from '../src/lib/portal/search.ts';
import { parsePublicationHtml } from '../scripts/lib/norm-html-parser.mjs';
import { parsePublicationMarkdown } from '../scripts/lib/norm-markdown-parser.mjs';

const slug = 'volksbefragungsverordnung-2026';
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
type Block = { type: string; label?: string; title?: string; text?: string; children?: Block[] };

const flatten = (blocks: Block[], output: Block[] = []): Block[] => {
  for (const block of blocks) {
    output.push(block);
    flatten(block.children ?? [], output);
  }
  return output;
};

const withoutSourceListIds = (blocks: Block[]): Block[] => blocks.map((block) => {
  const { listId: _listId, ...rest } = block as Block & { listId?: string };
  return {
    ...rest,
    ...(block.children ? { children: withoutSourceListIds(block.children) } : {}),
  };
});

test('OGVBl. 2026 Nr. 59 ist mit PDF und Normfassung vollständig erschlossen', async () => {
  const publication = (await loadAllVerkuendungen()).find((entry) => entry.slug === 'ogvbl-2026-59');
  assert.ok(publication);
  assert.equal(publication.publication, 'OGVBl.');
  assert.equal(publication.date, '2026-08-09');
  assert.equal(publication.place, 'Dresden');
  assert.equal(publication.pdf, '/assets/recht/OGVBl. 2026 Nr. 59.pdf');
  assert.deepEqual(readFileSync('public/assets/recht/OGVBl. 2026 Nr. 59.pdf'), readFileSync('Gesetze/OGVBl. 2026 Nr. 59.pdf'));
  assert.deepEqual(publication.entries.map((entry) => [entry.type, entry.pages, entry.normSlug]), [
    ['verordnung', '2–7', slug],
  ]);
  assert.equal(publication.entries[0].citation, 'Verordnung vom 9. August 2026 (OGVBl. 2026 Nr. 59 S. 2)');
});

test('Volksbefragungsverordnung besitzt belegte Zeitangaben, Befristung und Dokumenttyp', async () => {
  const norm = (await loadAllNorms()).find((entry) => entry.meta.slug === slug);
  assert.ok(norm);
  assert.equal(norm.meta.type, 'verordnung');
  assert.equal(norm.meta.documentDate, '2026-08-09');
  assert.equal(norm.meta.publicationDate, '2026-08-09');
  assert.equal(norm.meta.effectiveDate, '2026-08-09');
  assert.equal(norm.meta.expiryDate, '2026-12-31');
  assert.equal(norm.meta.status, 'in-force');
  assert.equal(norm.versions[0].validTo, '2026-12-31');
  assert.deepEqual(norm.meta.relatedNorms, [
    'staatsverfassung-des-freistaates-ostdeutschland',
    'erstes-gesetz-zur-grossen-staatsreform',
  ]);
});

test('HTML, PDF und Markdown bilden eine gehashte Quellenhierarchie', async () => {
  const norm = (await loadAllNorms()).find((entry) => entry.meta.slug === slug);
  assert.ok(norm);
  assert.deepEqual(norm.meta.sourceReferences?.map((source) => [source.kind, source.sourceRole]), [
    ['structured-html-transcription', 'structure-bearing'],
    ['primary-pdf', 'visual-control'],
    ['supplementary-markdown-transcription', 'supplementary-transcription'],
  ]);
  assert.equal(sha256('Gesetze/OGVBl.2026Nr.59.html'), 'a1d509c069aab78a3e851aed95af09941e2229af10415e2cc0ae3796240beeef');
  assert.equal(sha256('Gesetze/OGVBl. 2026 Nr. 59.pdf'), 'd5ce883378a5b35c5641649e51bf0468632ed6c3e85dbebf4bf507adcfe423b1');
  assert.equal(sha256('Gesetze/OGVBl. 2026 Nr. 59.md'), 'b104ff9399357b22509f17dcb45c479ada909c17562c9f73ed80985f6af15a30');
  assert.equal(sha256('Gesetze/PM-09082026-05.pdf'), '88c8c9aeac8d8df62b13492adacb4cdcee11e1c62fe2051b2e8ca462857ddcf6');
  assert.equal(sha256('Gesetze/PM-09082026-05.md'), 'afe5ffb40ad9bafc404ded078e88d66d160056518fd12e12670140329854a7f6');
  assert.match(readFileSync('.gitignore', 'utf8'), /^temp-neu\/$/mu);
});

test('HTML und Markdown ergeben denselben vollständigen Normtext mit elf Paragraphen', () => {
  const html = parsePublicationHtml('OGVBl.2026Nr.59.html', readFileSync('Gesetze/OGVBl.2026Nr.59.html', 'utf8'));
  const markdown = parsePublicationMarkdown('OGVBl. 2026 Nr. 59.md', readFileSync('Gesetze/OGVBl. 2026 Nr. 59.md', 'utf8'));
  assert.deepEqual(withoutSourceListIds(html.body as Block[]), withoutSourceListIds(markdown.body as Block[]));
  const paragraphs = (html.body as Block[]).filter((block) => block.type === 'paragraph');
  assert.deepEqual(paragraphs.map((block) => block.label), Array.from({ length: 11 }, (_, index) => `§ ${index + 1}`));
  assert.match(JSON.stringify(paragraphs.at(-1)), /Diese Verordnung tritt am Tag ihrer Verkündung in Kraft/u);
  assert.match(JSON.stringify(paragraphs.at(-1)), /Ablauf des 31\. Dezember 2026 außer Kraft/u);
});

test('alle fünf Fragen und die rechtliche Einordnung bleiben quellentreu', async () => {
  const norm = (await loadAllNorms()).find((entry) => entry.meta.slug === slug);
  assert.ok(norm);
  const blocks = flatten(norm.versions[0].body as Block[]);
  const sectionTwo = blocks.find((block) => block.label === '§ 2');
  assert.ok(sectionTwo);
  assert.deepEqual((sectionTwo.children ?? []).filter((block) => block.type === 'item').map((block) => block.text), [
    'Politische Grundrichtung',
    'Große Staatsreform',
    'Öffentliches und gemeinwirtschaftliches Eigentum',
    'Öffentliche Investitionen und wirtschaftliche Entwicklung',
    'Olympische und Paralympische Spiele',
  ]);
  const text = JSON.stringify(norm.versions[0].body);
  assert.match(text, /kein Volksentscheid/u);
  assert.match(text, /keine unmittelbare rechtliche Bindungswirkung/u);
  assert.match(text, /Teilnahme an der Volksbefragung ist freiwillig/u);
  assert.match(text, /Ein Beteiligungs- oder Zustimmungsquorum besteht nicht/u);
  assert.match(text, /spätestens am 22\. August 2026/u);
  assert.match(text, /spätestens am 10\. September 2026/u);
});

test('öffentliche Inhalte und Wissenshub verknüpfen Befragung, Wahl und Rechtsgrundlage', async () => {
  const topic = JSON.parse(readFileSync('content/themen/volksbefragung-2026.json', 'utf8'));
  const press = JSON.parse(readFileSync('content/presse/mitteilungen/staatsrat-ordnet-volksbefragung-2026-an.json', 'utf8'));
  const event = JSON.parse(readFileSync('content/presse/termine/wahl-achte-volkskammer-2026.json', 'utf8'));
  const proceedings = JSON.parse(readFileSync('knowledge/proceedings.json', 'utf8')).proceedings;
  const timeline = JSON.parse(readFileSync('knowledge/timeline.json', 'utf8')).events;
  assert.ok(topic.rechtsgrundlagen.some((entry: { normSlug?: string }) => entry.normSlug === slug));
  assert.match(JSON.stringify(topic), /freiwillig/u);
  assert.match(JSON.stringify(topic), /rechtlich nicht bindend/u);
  assert.equal(press.date, '2026-08-09');
  assert.ok(press.relatedNormSlugs.includes(slug));
  assert.match(JSON.stringify(event), /Volksbefragung/u);
  const proceeding = proceedings.find((entry: { id: string }) => entry.id === 'proceeding-volksbefragung-2026');
  assert.equal(proceeding.legalEffect, 'non-binding');
  assert.equal(proceeding.questions.length, 5);
  assert.ok(timeline.some((entry: { id: string }) => entry.id === 'event-volksbefragung-2026'));

  const [lawSearch, portalSearch] = await Promise.all([buildSearchIndexPayload(), buildPortalSearchEntries()]);
  assert.ok(lawSearch.documents.some((entry) => entry.slug === slug && /Bundeswahlleiter/u.test(entry.bodyText)));
  assert.ok(portalSearch.some((entry) => entry.url === '/themen/volksbefragung-2026/' && /Volksbefragung/u.test(entry.text)));
});
