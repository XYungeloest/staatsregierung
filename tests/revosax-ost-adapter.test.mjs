import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptParsedRevosaxSnapshot,
  adaptSaxonText,
  auditAdaptedRevosaxSnapshot,
  findSaxonResidual,
  hasSaxonResidual,
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

test('Gesetzes- und Institutionskürzel mit Sächs-Präfix werden übergeleitet, Fundstellen nicht', () => {
  assert.equal(adaptSaxonText('SächsVerfGHG'), 'OstVerfGHG');
  assert.equal(adaptSaxonText('Änd. SächsVerfGHG'), 'Änd. OstVerfGHG');
  assert.equal(adaptSaxonText('nach dem SächsVerfGHG'), 'nach dem OstVerfGHG');
  assert.equal(adaptSaxonText('Entscheidung des SächsVerfGH vom 1. Januar 2000'), 'Entscheidung des OstVerfGH vom 1. Januar 2000');
  assert.equal(
    adaptSaxonText('Gesetz über den Verfassungsgerichtshof (SächsVerfGHG) vom 18. Februar 1993 (SächsGVBl. S. 177), SächsABl. S. 5, SächsJMBl. S. 7, SächsSMBl. S. 9, SächsMBl. S. 11'),
    'Gesetz über den Verfassungsgerichtshof (OstVerfGHG) vom 18. Februar 1993 (SächsGVBl. S. 177), SächsABl. S. 5, SächsJMBl. S. 7, SächsSMBl. S. 9, SächsMBl. S. 11',
  );
});

test('Reststellen-Audit findet absichtlich verbliebene normative Sachsen-Bezüge', () => {
  // Ein nicht angepasster Text darf den Audit nie passieren – auch nicht neben geschützten Fundstellen.
  const stale = {
    sourceTitle: 'Gesetz zur Änderung des Gesetzes über den Verfassungsgerichtshof',
    shortTitle: 'Änd. SächsVerfGHG',
    fullCitation: 'Änd. SächsVerfGHG vom 1. Januar 2000 (SächsGVBl. S. 1)',
    body: [{ type: 'paragraphText', text: 'Das SächsVerfGHG wird wie folgt geändert:' }],
  };
  const residuals = auditAdaptedRevosaxSnapshot(stale);
  assert.deepEqual(residuals.map((entry) => entry.path).sort(), ['$.body[0].text', '$.fullCitation', '$.shortTitle']);
  assert.equal(hasSaxonResidual('Fundstelle (SächsGVBl. S. 1) ohne weiteren Bezug'), false);
  assert.equal(hasSaxonResidual('zuständig ist der Sächsische Landtag'), true);
  assert.equal(hasSaxonResidual('Behörden in Sachsen-Anhalt'), false);
  assert.deepEqual(findSaxonResidual('nach dem SächsVerfGHG'), { token: 'SächsV', context: 'nach dem SächsVerfGHG' });
  // Nach der Anpassung ist derselbe Datensatz reststellenfrei.
  assert.deepEqual(auditAdaptedRevosaxSnapshot(adaptParsedRevosaxSnapshot(stale)), []);
});

test('zusammengesetzte Kürzel und Schreibvarianten werden erfasst', () => {
  assert.equal(adaptSaxonText('DVOSächsBO und VwVSächsLZPolB'), 'DVOOstBO und VwVOstLZPolB');
  assert.equal(adaptSaxonText('Lebensmittelkontrolldienst (SächsmLkdAPVO)'), 'Lebensmittelkontrolldienst (OstmLkdAPVO)');
  assert.equal(adaptSaxonText('Verordnung der Sächsichen Staatsregierung'), 'Verordnung der Ostdeutschen Staatsregierung');
  assert.equal(adaptSaxonText('Gesetz zur Änderung sächsicher Rechtsvorschriften'), 'Gesetz zur Änderung ostdeutscher Rechtsvorschriften');
  assert.equal(adaptSaxonText('Niedersächsisches Recht und Niedersachsen bleiben unberührt'), 'Niedersächsisches Recht und Niedersachsen bleiben unberührt');
  assert.equal(hasSaxonResidual('DVOSächsBO'), true);
  assert.equal(hasSaxonResidual('sächsicher Rechtsvorschriften'), true);
  assert.equal(hasSaxonResidual('Niedersächsisches Recht'), false);
});

test('gesperrter Satz im übernommenen Normkörper wird als gewöhnliches Wort übergeleitet', () => {
  const parsed = {
    sourceTitle: 'Sächsisches Besoldungsgesetz',
    shortTitle: 'Sächsisches Besoldungsgesetz',
    fullCitation: 'Sächsisches Besoldungsgesetz vom 1. Januar 2020 (SächsGVBl. S. 1)',
    body: [
      { type: 'paragraphText', text: 'Die Vorschrift s o l l im Freistaat Sachsen gelten.' },
      { type: 'section', label: '1.', title: 'A m t s r a t', children: [
        { type: 'item', label: 'a)', text: 'Der Antrag bleibt u n v e r ä n d e r t bestehen.' },
      ] },
    ],
  };
  const adapted = adaptParsedRevosaxSnapshot(parsed);
  assert.equal(adapted.body[0].text, 'Die Vorschrift soll im Freistaat Ostdeutschland gelten.');
  assert.equal(adapted.body[1].title, 'Amtsrat');
  assert.equal(adapted.body[1].children[0].text, 'Der Antrag bleibt unverändert bestehen.');
  assert.deepEqual(auditAdaptedRevosaxSnapshot(adapted), []);
});
