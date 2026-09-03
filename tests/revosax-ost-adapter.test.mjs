import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptParsedRevosaxSnapshot,
  adaptSaxonText,
  auditAdaptedRevosaxSnapshot,
} from '../scripts/lib/revosax-ost-adapter.mjs';

test('adapts state names, adjectives and abbreviations', () => {
  assert.equal(adaptSaxonText('Freistaat Sachsen'), 'Freistaat Ostdeutschland');
  assert.equal(adaptSaxonText('Sächsisches Beamtengesetz (SächsBG)'), 'Ostdeutsches Beamtengesetz (OstBG)');
  assert.equal(adaptSaxonText('nach sächsischem Recht'), 'nach ostdeutschem Recht');
});

test('keeps historical publication abbreviations and Sachsen-Anhalt intact', () => {
  assert.equal(
    adaptSaxonText('Sächsisches Gesetz vom 1. Januar 2020 (SächsGVBl. S. 1) und Sachsen-Anhalt'),
    'Ostdeutsches Gesetz vom 1. Januar 2020 (SächsGVBl. S. 1) und Sachsen-Anhalt',
  );
});

test('adapts normative body but leaves source notes unchanged', () => {
  const parsed = adaptParsedRevosaxSnapshot({
    sourceTitle: 'Sächsisches Testgesetz',
    shortTitle: 'Sächsisches Testgesetz',
    abbr: 'SächsTestG',
    fullCitation: 'Sächsisches Testgesetz (SächsGVBl. S. 1)',
    pageFullCitation: 'Sächsisches Testgesetz (SächsGVBl. S. 1)',
    body: [{ type: 'paragraph', label: '§ 1', title: 'Sachsen', children: [{ type: 'paragraphText', text: 'Im Freistaat Sachsen gilt sächsisches Recht.' }] }],
    sourceNotes: [{ label: 'Quelle', text: 'Sachsen, SächsGVBl.' }],
  });

  assert.equal(parsed.sourceTitle, 'Ostdeutsches Testgesetz');
  assert.equal(parsed.abbr, 'OstTestG');
  assert.equal(parsed.body[0].title, 'Ostdeutschland');
  assert.match(parsed.body[0].children[0].text, /Freistaat Ostdeutschland/);
  assert.equal(parsed.sourceNotes[0].text, 'Sachsen, SächsGVBl.');
  assert.deepEqual(auditAdaptedRevosaxSnapshot(parsed), []);
});
