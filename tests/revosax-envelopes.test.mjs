import assert from 'node:assert/strict';
import test from 'node:test';

import { findAnchorSection, headingSimilarity, locateArticleBlocks, locateBlocksByTitle } from '../scripts/classify-revosax-envelopes.mjs';
import { extractEnvelopeComponentPage } from '../scripts/lib/revosax-discovery.mjs';
import { applyDecision, buildIndexes, buildPlan, planEntry, summarizeExistingNorm } from '../scripts/plan-revosax-materialization.mjs';

const BASELINE = '2023-11-01';

const envelopeHtml = `<html><body><div class="law_show">
<section data-anchor="1" data-level="1" data-link="a1" id="a1" title="Artikel 1  Änderung des Sächsischen Beispielbeamtengesetzes"><h4>Artikel 1</h4></section>
<section data-anchor="2" data-level="1" data-link="a2" id="a2" title="Artikel 2  Inkrafttreten"><h4>Artikel 2</h4></section>
<section data-anchor="1" data-level="1" data-link="romII" id="romII" title="II. Änderung der VwV Beispiel"><h4>II.</h4></section>
</div></body></html>`;

const body = [
  { type: 'section', title: 'Gesetz', children: [
    { type: 'article', label: 'Artikel 1', title: 'Änderung des Sächsischen Beispielbeamtengesetzes', children: [{ type: 'paragraphText', text: 'Das Sächsische Beispielbeamtengesetz wird wie folgt geändert:' }] },
    { type: 'article', label: 'Artikel 2', title: 'Inkrafttreten', children: [{ type: 'paragraphText', text: 'Dieses Gesetz tritt am Tag nach seiner Verkündung in Kraft.' }] },
  ] },
  { type: 'section', label: 'II.', title: 'Änderung der VwV Beispiel', children: [{ type: 'paragraphText', text: 'Text.' }] },
];

test('Anker werden über id, data-anchor und die rom/roem-Schreibweise aufgelöst', () => {
  assert.equal(findAnchorSection(envelopeHtml, 'a1').label, 'Artikel 1');
  assert.equal(findAnchorSection(envelopeHtml, 'a2').heading, 'Inkrafttreten');
  assert.equal(findAnchorSection(envelopeHtml, 'roemII').label, 'II.');
  assert.equal(findAnchorSection(envelopeHtml, 'a9'), null);
});

test('Artikelblöcke werden in beliebiger Tiefe genau einmal gefunden', () => {
  const located = locateArticleBlocks(body, { label: 'Artikel 1' });
  assert.equal(located.reason, null);
  assert.deepEqual(located.blocks[0].path, [0, 0]);
  assert.match(locateArticleBlocks(body, { label: 'Artikel 3' }).reason, /kein Block/u);
  assert.match(locateArticleBlocks([...body, { type: 'article', label: 'Artikel 1' }], { label: 'Artikel 1' }).reason, /2 Blöcke/u);
  assert.equal(locateBlocksByTitle(body, 'Änderung des Sächsischen Beispielbeamtengesetzes').blocks.length, 1);
  assert.equal(locateBlocksByTitle(body, 'Unbekannt').blocks.length, 0);
});

test('Überschriften werden über Wortstämme verglichen: Flexion, Umbrüche und Klammern stören nicht', () => {
  assert.ok(headingSimilarity('Änderung des Sächsisches Beispielvertretungsgesetzes', 'Änderung des Sächsischen Beispielvertretungsgesetz') >= 0.75);
  assert.ok(headingSimilarity('Änderung des Sächsischen Beispielberaterversorgungsgesetzes', 'Änderung des Sächsischen Beispielberater- versorgungsgesetzes (SächsBspBVG)') >= 0.75);
  assert.ok(headingSimilarity('Änderung der Beispielkreisordnung für den Freistaat Sachsen', 'Zweites Gesetz des Freistaates Sachsen zur Bereinigung des Beispielrechts') < 0.6);
  // Ein Anker, der auf einen anderen Artikel zeigt, wird verworfen; der passende Artikel wird über den Titel gefunden.
  const envelope = [
    { type: 'article', label: 'Artikel 1', title: 'Zweites Gesetz zur Bereinigung des Beispielrechts', children: [] },
    { type: 'article', label: 'Artikel 5', title: 'Änderung der Beispielkreisordnung für den Freistaat Sachsen', children: [] },
    { type: 'article', label: 'Artikel 6', title: 'Änderung der Beispielgemeindeordnung für den Freistaat Sachsen', children: [] },
  ];
  const located = locateBlocksByTitle(envelope, 'Änderung der Beispielkreisordnung für den Freistaat Sachsen');
  assert.equal(located.blocks.length, 1);
  assert.equal(located.blocks[0].block.label, 'Artikel 5');
  assert.match(locateBlocksByTitle(envelope, 'Änderung der Ordnung für den Freistaat Sachsen').reason, /mehrere|keine/u);
});

test('Komponentenseiten liefern eigenen Titel und eigenes Vollzitat', () => {
  const html = '<html><body><div class="law_show"><h1>Änderung des Sächsischen Beispielbeamtengesetzes</h1><p>Vollzitat: Änderung des Sächsischen Beispielbeamtengesetzes vom 5. Mai 2004 (SächsGVBl. S. 9006, 9010)</p> Bestandteil der Vorschrift <a href="/vorschrift/90007-Test#a1">Test</a></div></body></html>';
  assert.deepEqual(extractEnvelopeComponentPage(html), {
    title: 'Änderung des Sächsischen Beispielbeamtengesetzes',
    fullCitation: 'Änderung des Sächsischen Beispielbeamtengesetzes vom 5. Mai 2004 (SächsGVBl. S. 9006, 9010)',
  });
});

function componentEntry(overrides = {}) {
  return {
    revosaxLawId: '90006',
    versionSuffix: null,
    sourceId: '90006',
    category: 'ÄG',
    inferredType: 'aenderungsvorschrift',
    sourceUrl: 'https://www.revosax.sachsen.de/vorschrift/90006',
    listing: { label: 'Änd. SächsBspVG', title: 'Änderung des Sächsischen Beispielvertretungsgesetzes' },
    envelope: { envelopeLawId: '90007', envelopeUrl: 'https://www.revosax.sachsen.de/vorschrift/90007-Test#a44', envelopeAnchor: 'a44' },
    reviewFlags: [],
    skipReason: 'part-of-envelope:90007',
    proposedSlug: null,
    ...overrides,
  };
}

function classification(components) {
  return { components, counts: {}, fetchedEnvelopes: [] };
}

test('Mantelbestandteile werden nach Klassifizierung als eigene Normen geplant, Aliasse übersprungen, Unklares geprüft', () => {
  const envelopeNorm = summarizeExistingNorm('ostdeutsches-beispielmodernisierungsgesetz', {
    id: 'x', slug: 'ostdeutsches-beispielmodernisierungsgesetz', title: 'Ostdeutsches Beispielmodernisierungsgesetz', shortTitle: 'OstBspModG', type: 'gesetz',
    sourceReferences: [{ kind: 'revosax-snapshot', lawId: '90007', url: 'https://www.revosax.sachsen.de/vorschrift/90007' }],
  }, [{ versionId: BASELINE, validFrom: BASELINE, validTo: null, isCurrent: true, body: [] }]);
  const indexes = buildIndexes([envelopeNorm]);
  const componentA = { sourceId: '90006', lawId: '90006', class: 'A', reason: 'Artikel 44 eindeutig', envelopeLawId: '90007', proposedSlug: 'aend-ostbspvg', articleLabel: 'Artikel 44' };
  indexes.envelopeComponents = new Map([
    ['90006', componentA],
    ['90008', { sourceId: '90008', lawId: '90008', class: 'B', reason: 'Alias', envelopeLawId: '90007' }],
    ['90009', { sourceId: '90009', lawId: '90009', class: 'D', reason: 'Anker fehlt', envelopeLawId: '90007' }],
  ]);

  const created = planEntry(componentEntry(), BASELINE, indexes);
  assert.equal(created.action, 'CREATE');
  assert.equal(created.canonicalSlug, 'aend-ostbspvg');
  assert.equal(created.containedIn, 'ostdeutsches-beispielmodernisierungsgesetz');
  assert.equal(created.envelope, componentA);

  const alias = planEntry(componentEntry({ sourceId: '90008', revosaxLawId: '90008', skipReason: 'part-of-envelope:90007' }), BASELINE, indexes);
  assert.equal(alias.action, 'SKIP');
  assert.match(alias.reason, /^envelope-alias-of:90007/u);

  const unclear = planEntry(componentEntry({ sourceId: '90009', revosaxLawId: '90009' }), BASELINE, indexes);
  assert.equal(unclear.action, 'REVIEW');

  const unclassified = planEntry(componentEntry({ sourceId: '9999', revosaxLawId: '9999', skipReason: 'part-of-envelope:90007' }), BASELINE, indexes);
  assert.equal(unclassified.action, 'REVIEW');
  assert.match(unclassified.reason, /ohne Klassifizierung/u);
});

test('eine bereits materialisierte Komponente wird per lawId als MATCH erkannt, die Mantelvorschrift zählt nicht zur Identität', () => {
  const component = summarizeExistingNorm('aend-ostbspvg', {
    id: 'aend-ostbspvg', slug: 'aend-ostbspvg', title: 'Änderung des Ostdeutschen Beispielvertretungsgesetzes', shortTitle: 'Änd. OstBspVG', type: 'aenderungsvorschrift',
    sourceReferences: [
      { kind: 'revosax-snapshot', lawId: '90006', url: 'https://www.revosax.sachsen.de/vorschrift/90006', sourceRole: 'official-snapshot' },
      { kind: 'revosax-snapshot', lawId: '90007', url: 'https://www.revosax.sachsen.de/vorschrift/90007#a44', sourceRole: 'envelope-snapshot' },
    ],
  }, [{ versionId: BASELINE, validFrom: BASELINE, validTo: null, isCurrent: true, body: [] }]);
  assert.deepEqual(component.lawIds, ['90006']);
  const indexes = buildIndexes([component]);
  indexes.envelopeComponents = new Map([['90006', { sourceId: '90006', lawId: '90006', class: 'A', reason: 'x', envelopeLawId: '90007', proposedSlug: 'aend-ostbspvg' }]]);
  const planned = planEntry(componentEntry(), BASELINE, indexes);
  assert.equal(planned.action, 'MATCH');
  assert.equal(planned.canonicalSlug, 'aend-ostbspvg');
});

test('zurückgestellte Reviewfälle bleiben REVIEW, blockieren den Schreibmodus aber nicht', () => {
  const indexes = buildIndexes([]);
  indexes.envelopeComponents = new Map([['90009', { sourceId: '90009', lawId: '90009', class: 'D', reason: 'Anker fehlt', envelopeLawId: '90007' }]]);
  const entry = componentEntry({ sourceId: '90009', revosaxLawId: '90009' });
  const deferred = applyDecision(planEntry(entry, BASELINE, indexes), entry, { 90009: { action: 'DEFER', reason: 'Anker nicht auflösbar; redaktionell klären.' } }, BASELINE);
  assert.equal(deferred.action, 'REVIEW');
  assert.equal(deferred.deferred, true);
  assert.match(deferred.reason, /^zurückgestellt/u);
  const rejected = applyDecision({ action: 'CREATE', reason: 'x', canonicalSlug: 'y' }, entry, { 90009: { action: 'DEFER', reason: 'Widerspricht CREATE, muss REVIEW ergeben.' } }, BASELINE);
  assert.equal(rejected.action, 'REVIEW');

  const plan = buildPlan({
    report: { baselineDate: BASELINE, entries: [entry] },
    existing: [],
    decisions: { 90009: { action: 'DEFER', reason: 'Anker nicht auflösbar; redaktionell klären.' } },
    envelopeComponents: classification([{ sourceId: '90009', lawId: '90009', class: 'D', reason: 'Anker fehlt', envelopeLawId: '90007' }]),
  });
  assert.equal(plan.counts.REVIEW, 1);
  assert.equal(plan.counts.DEFERRED, 1);
  assert.equal(plan.writable, true);
  const open = buildPlan({ report: { baselineDate: BASELINE, entries: [entry] }, existing: [], decisions: {}, envelopeComponents: plan.entries && classification([{ sourceId: '90009', lawId: '90009', class: 'D', reason: 'Anker fehlt', envelopeLawId: '90007' }]) });
  assert.equal(open.writable, false);
});
