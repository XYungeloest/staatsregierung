import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptBodyBlocks,
  adaptParsedRevosaxSnapshot,
  adaptSaxonText,
  lettersOnly,
  literalAmendmentStrings,
  auditAdaptedRevosaxSnapshot,
  findSaxonResidual,
  hasSaxonResidual,
} from '../scripts/lib/revosax-ost-adapter.mjs';

test('adapts state names, adjectives and abbreviations', () => {
  assert.equal(adaptSaxonText('Freistaat Sachsen'), 'Freistaat Ostdeutschland');
  assert.equal(adaptSaxonText('Sächsisches Beispielbeamtengesetz (SächsBspBG)'), 'Ostdeutsches Beispielbeamtengesetz (OstBspBG)');
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
    sourceTitle: 'Sächsische Beispielkostenverordnung',
    shortTitle: 'Sächsische Beispielkostenverordnung',
    fullCitation: 'Sächsische Beispielkostenverordnung (SächsGVBl. S. 1)',
    body: [{ type: 'annex', label: 'Anlage 1 (zu § 8 SächsBspKVO)', children: [{ type: 'paragraphText', text: 'Text.' }] }],
  });
  assert.equal(parsed.body[0].label, 'Anlage 1 (zu § 8 OstBspKVO)');
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
  assert.equal(adaptSaxonText('SächsBspGHG'), 'OstBspGHG');
  assert.equal(adaptSaxonText('Änd. SächsBspGHG'), 'Änd. OstBspGHG');
  assert.equal(adaptSaxonText('nach dem SächsBspGHG'), 'nach dem OstBspGHG');
  assert.equal(adaptSaxonText('Entscheidung des SächsVerfGH vom 1. Januar 2000'), 'Entscheidung des OstVerfGH vom 1. Januar 2000');
  assert.equal(
    adaptSaxonText('Gesetz über den Beispielgerichtshof (SächsBspGHG) vom 18. Februar 1993 (SächsGVBl. S. 9177), SächsABl. S. 5, SächsJMBl. S. 7, SächsSMBl. S. 9, SächsMBl. S. 11'),
    'Gesetz über den Beispielgerichtshof (OstBspGHG) vom 18. Februar 1993 (SächsGVBl. S. 9177), SächsABl. S. 5, SächsJMBl. S. 7, SächsSMBl. S. 9, SächsMBl. S. 11',
  );
});

test('Reststellen-Audit findet absichtlich verbliebene normative Sachsen-Bezüge', () => {
  // Ein nicht angepasster Text darf den Audit nie passieren – auch nicht neben geschützten Fundstellen.
  const stale = {
    sourceTitle: 'Gesetz zur Änderung des Gesetzes über den Verfassungsgerichtshof',
    shortTitle: 'Änd. SächsBspGHG',
    fullCitation: 'Änd. SächsBspGHG vom 1. Januar 2000 (SächsGVBl. S. 1)',
    body: [{ type: 'paragraphText', text: 'Das SächsBspGHG wird wie folgt geändert:' }],
  };
  const residuals = auditAdaptedRevosaxSnapshot(stale);
  assert.deepEqual(residuals.map((entry) => entry.path).sort(), ['$.body[0].text', '$.fullCitation', '$.shortTitle']);
  assert.equal(hasSaxonResidual('Fundstelle (SächsGVBl. S. 1) ohne weiteren Bezug'), false);
  assert.equal(hasSaxonResidual('zuständig ist der Sächsische Landtag'), true);
  assert.equal(hasSaxonResidual('Behörden in Sachsen-Anhalt'), false);
  assert.deepEqual(findSaxonResidual('nach dem SächsBspGHG'), { token: 'SächsB', context: 'nach dem SächsBspGHG' });
  // Nach der Anpassung ist derselbe Datensatz reststellenfrei.
  assert.deepEqual(auditAdaptedRevosaxSnapshot(adaptParsedRevosaxSnapshot(stale)), []);
});

test('zusammengesetzte Kürzel und Schreibvarianten werden erfasst', () => {
  assert.equal(adaptSaxonText('DVOSächsBspO und VwVSächsBspPolB'), 'DVOOstBspO und VwVOstBspPolB');
  assert.equal(adaptSaxonText('Lebensmittelkontrolldienst (SächsmLkdAPVO)'), 'Lebensmittelkontrolldienst (OstmLkdAPVO)');
  assert.equal(adaptSaxonText('Verordnung der Sächsichen Staatsregierung'), 'Verordnung der Ostdeutschen Staatsregierung');
  assert.equal(adaptSaxonText('Gesetz zur Änderung sächsicher Rechtsvorschriften'), 'Gesetz zur Änderung ostdeutscher Rechtsvorschriften');
  assert.equal(adaptSaxonText('Niedersächsisches Recht und Niedersachsen bleiben unberührt'), 'Niedersächsisches Recht und Niedersachsen bleiben unberührt');
  assert.equal(hasSaxonResidual('DVOSächsBspO'), true);
  assert.equal(hasSaxonResidual('sächsicher Rechtsvorschriften'), true);
  assert.equal(hasSaxonResidual('Niedersächsisches Recht'), false);
});

test('gesperrter Satz im übernommenen Normkörper wird als gewöhnliches Wort übergeleitet', () => {
  const parsed = {
    sourceTitle: 'Sächsisches Beispielbesoldungsgesetz',
    shortTitle: 'Sächsisches Beispielbesoldungsgesetz',
    fullCitation: 'Sächsisches Beispielbesoldungsgesetz vom 1. Januar 2020 (SächsGVBl. S. 1)',
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

test('Landschafts-, Kreis- und Ortsnamen mit „Sachsen“ bleiben Eigennamen und keine Reststelle', () => {
  const names = [
    'im Landkreis Sächsische Schweiz-Osterzgebirge',
    'der Nationalpark Sächsische Schweiz und die Nationalparkregion Sächsische Schweiz',
    'Wanderwege in der Sächsischen Schweiz',
    'Kulturraum Meißen-Sächsische Schweiz-Osterzgebirge',
    'im Sächsischen Elbsandsteingebirge',
    'die Sächsisch-Böhmische Schweiz und die Entwicklung der Sächsisch-Böhmischen-Schweiz',
    'Königstein/Sächs. Schw., Stadt',
    'Neustadt in Sachsen, Stadt',
    'Mittelsachsen, Nordsachsen, Niedersachsen und Sachsen-Anhalt',
    'Mitglied bei Silicon Saxony e. V.',
  ];
  for (const text of names) {
    assert.equal(adaptSaxonText(text), text);
    assert.equal(hasSaxonResidual(text), false, text);
  }
  assert.equal(
    adaptSaxonText('Der Freistaat Sachsen und der Landkreis Sächsische Schweiz-Osterzgebirge'),
    'Der Freistaat Ostdeutschland und der Landkreis Sächsische Schweiz-Osterzgebirge',
  );
});

test('Zeitungstitel, Vereins-, Naturraum- und Verkehrswegnamen bleiben Eigennamen und keine Reststelle', () => {
  const names = [
    'Musterbeschluss vom 2. März 1960 (Amtliche Bekanntmachungen der Sächsischen Zeitung Nr. 9 vom 9. März 1960)',
    'veröffentlicht in der Sächsische Zeitung, Ausgabe Musterstadt',
    'nach den Sächsischen Kletterregeln, bestimmt durch den Sächsischen Bergsteigerbund',
    'nach Maßgabe der sächsischen Kletterregeln; Satzung des Sächsischer Bergsteigerbund e. V.',
    'des Tourismusverbandes „Sächsisches Burgen- und Heideland“',
    'im Sächsischen Lösshügelland und im Sächsischen Lößhügelland',
    'entlang der Sachsen-Franken-Magistrale',
    'Radfernweg Sächsische Mittelgebirge, Fernradweges „Sächsische Mittelgebirge“ und Sächsische Städteroute',
  ];
  for (const text of names) {
    assert.equal(adaptSaxonText(text), text);
    assert.equal(hasSaxonResidual(text), false, text);
  }
  // Außerhalb des Eigennamens wird weiterhin übergeleitet.
  assert.equal(
    adaptSaxonText('Die Sächsische Musterbehörde und die sächsischen Mittelgebirge entlang der Sachsen-Franken-Magistrale in Sachsen'),
    'Die Ostdeutsche Musterbehörde und die ostdeutschen Mittelgebirge entlang der Sachsen-Franken-Magistrale in Ostdeutschland',
  );
  assert.equal(adaptSaxonText('Die Sächsische Mittelgebirgsregion'), 'Die Ostdeutsche Mittelgebirgsregion');
  assert.equal(adaptSaxonText('Sächsische Mittelgebirge'), 'Ostdeutsche Mittelgebirge');
  assert.equal(hasSaxonResidual('die Sächsische Musterzeitung'), true);
});

test('Fußnotenziffern, fehlende Leerzeichen und Abkürzungskomposita verhindern die Überleitung nicht', () => {
  assert.equal(adaptSaxonText('Präsident der Landesdirektion Sachsen3)'), 'Präsident der Landesdirektion Ostdeutschland3)');
  assert.equal(adaptSaxonText('Musterbetrieb Musterland Sachsens2)'), 'Musterbetrieb Musterland Ostdeutschlands2)');
  assert.equal(adaptSaxonText('MusterverbandSachsen (OstMG)'), 'MusterverbandOstdeutschland (OstMG)');
  assert.equal(adaptSaxonText('SachsenMBUmwG'), 'OstdeutschlandMBUmwG');
  // Komposita mit Kleinbuchstaben und Eigennamen bleiben unverändert.
  assert.equal(adaptSaxonText('Staatsbetrieb Sachsenforst1)'), 'Staatsbetrieb Sachsenforst1)');
  assert.equal(adaptSaxonText('das SachsenMusterNetz'), 'das SachsenMusterNetz');
  assert.equal(adaptSaxonText('SachsenAnhalts'), 'SachsenAnhalts');
  for (const text of ['Landesdirektion Sachsen3)', 'MusterverbandSachsen (OstMG)', 'SachsenMBUmwG']) assert.equal(hasSaxonResidual(text), true, text);
});

test('Kürzelvarianten mit Sä-, Säch-, Bindestrich-, Ziffern- und Trennzeichenform werden übergeleitet', () => {
  assert.equal(adaptSaxonText('Ostdeutsche Musterordnung (SäMO) und VwV-SäMO, SäMusterG'), 'Ostdeutsche Musterordnung (OstMO) und VwV-OstMO, OstMusterG');
  assert.equal(adaptSaxonText('Änd. SächMusterG'), 'Änd. OstMusterG');
  assert.equal(adaptSaxonText('des Säch­sischen Musterrates'), 'des Ostdeutschen Musterrates');
  assert.equal(adaptSaxonText('(Sächs­MusterG)'), '(OstMusterG)');
  assert.equal(adaptSaxonText('§ 2 Sächs-\nMusterG und (Sächs-MusterAG)'), '§ 2 OstMusterG und (OstMusterAG)');
  assert.equal(adaptSaxonText('nach § 7 Abs. 1SächsMO.'), 'nach § 7 Abs. 1OstMO.');
  assert.equal(adaptSaxonText('Das Wort „Ostdeutsches“ wird mit „Sächs“ abgekürzt.'), 'Das Wort „Ostdeutsches“ wird mit „Ost“ abgekürzt.');
  // Fundstellenkürzel, auch mit Leerzeichen, bleiben Provenienz.
  assert.equal(adaptSaxonText('(Sächs GVBl. S. 2, Sächs-GVBl. S. 3, SächsGVBl. S. 4)'), '(Sächs GVBl. S. 2, Sächs-GVBl. S. 3, SächsGVBl. S. 4)');
  for (const text of ['(SäMO)', 'SächMusterG', 'Säch­sischen', 'Sächs-MusterAG', 'Abs. 1SächsMO', 'mit „Sächs“ abgekürzt']) {
    assert.equal(hasSaxonResidual(text), true, text);
  }
  assert.equal(hasSaxonResidual('(Sächs GVBl. S. 2)'), false);
});

test('Schreibvarianten der Blattkürzel bleiben Fundstellen, gleich beginnende Gesetzeskürzel nicht', () => {
  const variants = [
    '(SächGVBl. S. 1)',
    '(SächABl. S. 2)',
    '(SächsGVBI. S. 3)',
    '(SächsGVBl S. 4, 5)',
    '(SächsABl S. 6)',
    '(SächsABI. SDr. S. S 7)',
    '(SächsJMBI. S. 8)',
    '(SächsGVB1. S. 9)',
    '(SächsVB1.S. 10)',
    '(SächsVBl. S. 11)',
    '(SächsBVBl. S. 12)',
    '(SächsMinBl. Nr. 1, S. 13)',
  ];
  for (const text of variants) {
    assert.equal(adaptSaxonText(text), text, text);
    assert.equal(hasSaxonResidual(text), false, text);
  }
  assert.equal(adaptSaxonText('SächsGVBlMusterG, SächABlMusterVO'), 'OstGVBlMusterG, OstABlMusterVO');
});

test('Versalsatz und englische Amtsbezeichnungen werden übergeleitet', () => {
  assert.equal(adaptSaxonText('mit der Aufschrift „FREISTAAT SACHSEN“'), 'mit der Aufschrift „FREISTAAT OSTDEUTSCHLAND“');
  assert.equal(adaptSaxonText('SÄCHSISCHES MUSTERAMT FÜR DIE SÄCHSISCHE MUSTERPFLEGE SACHSENS'), 'OSTDEUTSCHES MUSTERAMT FÜR DIE OSTDEUTSCHE MUSTERPFLEGE OSTDEUTSCHLANDS');
  assert.equal(adaptSaxonText('STAATSBETRIEB SACHSENFORST, NIEDERSACHSEN, SACHSEN-ANHALT'), 'STAATSBETRIEB SACHSENFORST, NIEDERSACHSEN, SACHSEN-ANHALT');
  assert.equal(adaptSaxonText('Plenipotentiary of the Free State of Saxony'), 'Plenipotentiary of the Free State of East Germany');
  assert.equal(adaptSaxonText('Saxon State Ministry of Testing; Saxony State Ministry of Samples'), 'East German State Ministry of Testing; East German State Ministry of Samples');
  assert.equal(adaptSaxonText('State Chancellery of Saxony; Police President of Saxony'), 'State Chancellery of East Germany; Police President of East Germany');
  for (const text of ['FREISTAAT SACHSEN', 'SÄCHSISCHES MUSTERAMT', 'Free State of Saxony', 'Saxon State Ministry of Testing']) assert.equal(hasSaxonResidual(text), true, text);
});

test('wörtlich verkündete ostdeutsche Rezepttexte werden nicht übergeleitet', async () => {
  const sourceText = 'Artikel 1 § 2 wird wie folgt gefasst: „mit Zuständigkeit für die Bezirke Sachsen und Musterland“ und im Gebiet des früheren Freistaates Sachsen. § 3: Der Freistaat Ostdeutschland unterhält Musterstellen.';
  const recipe = {
    operations: [
      { op: 'replaceBody', source: 'Gesetze/Musterblatt.html', value: [
        { type: 'paragraph', label: '§ 2', children: [
          { type: 'paragraphText', text: 'mit Zuständigkeit für die Bezirke Sachsen und Musterland' },
          { type: 'paragraphText', text: 'im Gebiet des früheren Freistaates Sachsen' },
        ] },
      ] },
      // Rezeptwert in sächsischer Ausgangsform: steht so nicht in der Quelle und wird übergeleitet.
      { op: 'replaceText', source: 'Gesetze/Musterblatt.html', value: 'Der Freistaat Sachsen unterhält Musterstellen.' },
      // Ohne Quelle unter Gesetze/ gibt es keinen Wortlautschutz.
      { op: 'replaceText', source: 'data/recht/sources/revosax/x.html', value: 'im Gebiet des früheren Freistaates Sachsen' },
    ],
  };
  const preserve = await literalAmendmentStrings(recipe, async (path) => (path === 'Gesetze/Musterblatt.html' ? lettersOnly(sourceText) : null));
  assert.deepEqual([...preserve].sort(), ['im Gebiet des früheren Freistaates Sachsen', 'mit Zuständigkeit für die Bezirke Sachsen und Musterland']);
  const body = [{ type: 'paragraph', label: '§ 2', children: [
    { type: 'paragraphText', text: 'mit Zuständigkeit für die Bezirke Sachsen und Musterland' },
    { type: 'paragraphText', text: 'Der Freistaat Sachsen unterhält Musterstellen.' },
  ] }];
  const adapted = adaptBodyBlocks(body, { preserve });
  assert.equal(adapted[0].children[0].text, 'mit Zuständigkeit für die Bezirke Sachsen und Musterland');
  assert.equal(adapted[0].children[1].text, 'Der Freistaat Ostdeutschland unterhält Musterstellen.');
  assert.equal(adaptBodyBlocks(body)[0].children[0].text, 'mit Zuständigkeit für die Bezirke Ostdeutschland und Musterland');
});

test('Konsolidierung: wörtlich verkündeter Text bleibt nur ab seiner Fassung erhalten', async () => {
  const { applyRechtsueberleitung } = await import('../scripts/consolidate-norms.mjs');
  const text = 'im Gebiet des früheren Freistaates Sachsen';
  const version = (versionId) => ({ versionId, citation: 'Zitat', changeNote: 'Hinweis', body: [{ type: 'paragraphText', text }] });
  const result = applyRechtsueberleitung(
    { meta: { title: 'Sächsisches Mustergesetz', shortTitle: 'Mustergesetz', keywords: [] }, history: { entries: [] }, versions: [version('2023-11-01'), version('2026-03-01')] },
    { preserveByVersion: new Map([['2026-03-01', new Set([text])]]) },
  );
  assert.equal(result.versions[0].body[0].text, 'im Gebiet des früheren Freistaates Ostdeutschland');
  assert.equal(result.versions[1].body[0].text, text);
  assert.equal(result.meta.title, 'Ostdeutsches Mustergesetz');
});
