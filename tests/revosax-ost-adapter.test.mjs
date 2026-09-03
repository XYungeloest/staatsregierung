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

test('adapts structure labels that carry Saxon abbreviations', () => {
  const parsed = adaptParsedRevosaxSnapshot({
    sourceTitle: 'Sächsische Reisekostenverordnung',
    shortTitle: 'Sächsische Reisekostenverordnung',
    fullCitation: 'Sächsische Reisekostenverordnung (SächsGVBl. S. 1)',
    body: [{ type: 'annex', label: 'Anlage 1 (zu § 8 SächsRKVO)', children: [{ type: 'paragraphText', text: 'Text.' }] }],
  });
  assert.equal(parsed.body[0].label, 'Anlage 1 (zu § 8 OstRKVO)');
  assert.deepEqual(auditAdaptedRevosaxSnapshot(parsed), []);
});

test('adapts the bare adjective, hyphenated compounds and the genitive but not Sachsen-Anhalt', () => {
  assert.equal(adaptSaxonText('Auf das Wort „Sächsisch“ soll verzichtet werden.'), 'Auf das Wort „Ostdeutsch“ soll verzichtet werden.');
  assert.equal(adaptSaxonText('die Sächsisch-Thüringische Apothekerversorgung'), 'die Ostdeutsch-Thüringische Apothekerversorgung');
  assert.equal(adaptSaxonText('im sächsisch-tschechischen Grenzraum'), 'im ostdeutsch-tschechischen Grenzraum');
  assert.equal(adaptSaxonText('sächsisch-anhaltische Behörden in Sachsen-Anhalt'), 'sächsisch-anhaltische Behörden in Sachsen-Anhalt');
  assert.equal(adaptSaxonText('die Haushaltsordnung Sachsens'), 'die Haushaltsordnung Ostdeutschlands');
  assert.deepEqual(auditAdaptedRevosaxSnapshot({ sourceTitle: 'x', shortTitle: 'x', fullCitation: 'x', body: [{ type: 'paragraphText', text: 'Sachsens Landtag' }] }).length, 1);
});
