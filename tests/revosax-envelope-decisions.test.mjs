import assert from 'node:assert/strict';
import test from 'node:test';

import { applyEnvelopeDecision, describeBlockPath, listArticleBlocks, openingText } from '../scripts/classify-revosax-envelopes.mjs';
import { componentBodyAtPath } from '../scripts/materialize-revosax-baseline.mjs';
import { anchorLabel, articleFromTitle, decide, recall, scoreCandidates, stems, targetNameFromTitle } from '../scripts/resolve-revosax-envelope-defers.mjs';

const envelopeBody = [
  { type: 'article', label: 'Artikel 1', title: 'Gesetz zur Regelung des Verwaltungsverfahrens', children: [{ type: 'paragraph', label: '§ 1', title: 'Anwendungsbereich', children: [{ type: 'paragraphText', text: 'Dieses Gesetz gilt für die Behörden.' }] }] },
  { type: 'article', label: 'Artikel 2', title: 'Folgeänderungen', children: [
    { type: 'subparagraph', label: '(1)', text: '§ 46 Abs. 3 des Sächsischen Wahlgesetzes (SächsWahlG) wird aufgehoben.', children: [] },
    { type: 'subparagraph', label: '(2)', text: 'In § 3 des Sächsischen Disziplinargesetzes (SächsDG) vom 10. April 2007 wird die Angabe „§ 5“ durch „§ 6“ ersetzt.', children: [] },
    { type: 'subparagraph', label: '(3)', text: 'Die Sächsische Bauordnung (SächsBO) vom 28. Mai 2004 wird wie folgt geändert:', children: [{ type: 'item', label: '1.', text: 'In § 2 wird das Wort „Land“ gestrichen.', children: [] }] },
  ] },
  { type: 'article', label: 'Artikel 3', title: 'Inkrafttreten', children: [{ type: 'paragraphText', text: 'Dieses Gesetz tritt am Tag nach seiner Verkündung in Kraft.' }] },
];
const envelope = { body: envelopeBody, sourceId: 'envelope-1' };

test('Zielgesetz, Artikelbezeichnung und Ankerkennzeichen werden aus Komponentendaten abgeleitet', () => {
  assert.equal(targetNameFromTitle('Änderung des Sächsischen Disziplinargesetzes'), 'Sächsischen Disziplinargesetzes');
  assert.equal(targetNameFromTitle('Ändeurng des Landeseisenbahngesetzes'), 'Landeseisenbahngesetzes');
  assert.equal(targetNameFromTitle('Änderung der RLWohnraumanpassung'), 'RL Wohnraumanpassung');
  assert.equal(targetNameFromTitle('Artikel 2 [Änderung des Sparkassengesetzes]'), 'Artikel 2');
  assert.equal(articleFromTitle('Artikel 2 [Änderung des Sparkassengesetzes]'), 'Artikel 2');
  assert.equal(anchorLabel('a2'), 'Artikel 2');
  assert.equal(anchorLabel('roemIII'), 'III.');
  assert.equal(anchorLabel('p55'), '§ 55');
  assert.equal(anchorLabel('abs2'), null, 'Absatzanker sind ohne Artikelbezug kein Beleg');
  assert.deepEqual([...stems('Sächsischen Disziplinargesetzes')], ['disziplinargesetz']);
  assert.ok([...stems('Abendgymnasien- und Kollegverordnung')].includes('kollegverordnung'));
  assert.equal(recall('Sächsischen Bauordnung', 'Die Sächsische Bauordnung (SächsBO) wird geändert'), 1);
});

test('Absätze eines Folgeänderungsartikels werden als präzisere Fundstelle vor dem Sammelartikel gewählt', () => {
  const scored = scoreCandidates({ sourceTitle: 'Änderung des Sächsischen Disziplinargesetzes', anchor: 'a2', listing: { label: 'Änd. SächsDG' } }, envelope);
  const decision = decide(scored);
  assert.equal(decision.action, 'MAP');
  assert.equal(decision.article, 'Artikel 2 Absatz 2');
  assert.deepEqual(decision.blockPath, [1, 1]);
  assert.match(decision.reason, /Zielgesetz/u);
  // Ohne eindeutigen Treffer bleibt die Komponente zurückgestellt.
  const vague = decide(scoreCandidates({ sourceTitle: 'Änderung des Gesetzes', anchor: null, listing: {} }, envelope));
  assert.equal(vague.action, 'DEFER');
  // Bereits zugeordnete Einheiten derselben Mantelvorschrift werden ausgeschlossen.
  const excluded = scoreCandidates({ sourceTitle: 'Änderung des Sächsischen Disziplinargesetzes', anchor: 'a2', listing: {} }, envelope, { excludedPaths: new Set([JSON.stringify([1, 1])]) });
  assert.notEqual(decide(excluded).article, 'Artikel 2 Absatz 2');
});

test('Entscheidungen werden fail-closed gegen den Artikeltext verifiziert', () => {
  const record = { envelopeLawId: '1' };
  const applied = applyEnvelopeDecision({ action: 'MAP', envelopeLawId: '1', article: 'Artikel 2 Absatz 2', blockPath: [1, 1], method: 'opening-sentence', evidence: { openingText: 'des Sächsischen Disziplinargesetzes (SächsDG)' } }, envelope, record);
  assert.equal(applied.section.label, 'Artikel 2 Absatz 2');
  assert.equal(applied.resolution, 'decision:opening-sentence');
  assert.throws(() => applyEnvelopeDecision({ action: 'MAP', envelopeLawId: '1', article: 'Artikel 2 Absatz 2', blockPath: [1, 1], evidence: { openingText: 'Bauordnung' } }, envelope, record), /Eröffnungsbeleg/u);
  assert.throws(() => applyEnvelopeDecision({ action: 'MAP', envelopeLawId: '1', article: 'Artikel 2 Absatz 1', blockPath: [1, 1], evidence: { openingText: 'Disziplinargesetz' } }, envelope, record), /heißt/u);
  assert.throws(() => applyEnvelopeDecision({ action: 'MAP', envelopeLawId: '2', article: 'Artikel 3', evidence: { heading: 'Inkrafttreten' } }, envelope, record), /Mantelvorschrift 2/u);
  assert.throws(() => applyEnvelopeDecision({ action: 'MAP', envelopeLawId: '1', article: 'Artikel 9', evidence: { heading: 'x' } }, envelope, record), /0 statt genau einem/u);
  const byHeading = applyEnvelopeDecision({ action: 'MAP', envelopeLawId: '1', article: 'Artikel 3', evidence: { heading: 'Inkrafttreten' } }, envelope, record);
  assert.equal(byHeading.located.blocks[0].path.join('/'), '2');
  assert.equal(applyEnvelopeDecision({ action: 'DEFER' }, envelope, record), null);
  // Textträger: eine Entscheidung darf die tatsächlich textführende Vorschrift nennen.
  assert.equal(applyEnvelopeDecision({ action: 'MAP', envelopeLawId: '4371', article: 'Artikel 3', evidence: { heading: 'Inkrafttreten' } }, envelope, { envelopeLawId: '3382', envelopeParentLawId: '4371' }).section.label, 'Artikel 3');
});

test('verschachtelte Fundstellen werden lesbar bezeichnet und mit ihrem Rahmen materialisiert', () => {
  assert.equal(describeBlockPath(envelopeBody, [1, 2]), 'Artikel 2 Absatz 3');
  assert.equal(describeBlockPath(envelopeBody, [1, 2, 0]), 'Artikel 2 Absatz 3 Nummer 1');
  assert.equal(describeBlockPath(envelopeBody, [0, 0]), 'Artikel 1 § 1');
  assert.equal(listArticleBlocks(envelopeBody).length, 3);
  assert.equal(openingText(envelopeBody[1], 40), '§ 46 Abs. 3 des Sächsischen Wahlgesetzes');
  const body = componentBodyAtPath(envelopeBody, [1, 1]);
  assert.equal(body.length, 1);
  assert.equal(body[0].label, 'Artikel 2');
  assert.equal(body[0].title, 'Folgeänderungen');
  assert.equal(body[0].children.length, 1);
  assert.equal(body[0].children[0].label, '(2)');
  assert.deepEqual(componentBodyAtPath(envelopeBody, [2]), [envelopeBody[2]]);
});
