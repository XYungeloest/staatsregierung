import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPatchRecipe, sha256, repealStatusAt } from '../scripts/lib/consolidation-engine.mjs';
import { applyCorrectionToRecord, applyCorrectionsToRecord } from '../scripts/lib/correction-engine.mjs';

/**
 * Konsolidierungs- und Berichtigungsmaschine auf synthetischen Vorschriften: Patch-Rezepte sind
 * fail-closed (Ziel und Ausgangstext müssen passen), Bezeichnungsersetzungen zählen jeden Treffer,
 * Berichtigungen ändern den Wortlaut ohne künstlichen Fassungswechsel. Ob der reale Bestand
 * deterministisch aus Quellen und Rezepten entsteht, prüft scripts/audit-consolidation.mjs --check.
 */

test('Patch-Rezepte brechen bei fehlendem Ziel oder verändertem Ausgangstext ab', () => {
  const state = {
    title: 'Testgesetz',
    body: [{ type: 'paragraph', label: '§ 1', title: 'Test', children: [] }],
  };
  const contract = {
    amendmentAct: 'test-aenderung',
    effectiveDate: '2026-01-02',
    operations: [{
      op: 'replaceProvision',
      target: { type: 'paragraph', label: '§ 2' },
      expectedHash: sha256(state.body[0]),
      expectedMatches: 1,
      value: state.body[0],
      source: 'Gesetze/Test.html',
      sourceProvision: 'Artikel 1',
      effectiveDate: '2026-01-02',
    }],
  };
  assert.throws(() => applyPatchRecipe(state, contract), /0 statt genau einem Treffer/u);
  contract.operations[0].target.label = '§ 1';
  contract.operations[0].expectedHash = '0'.repeat(64);
  assert.throws(() => applyPatchRecipe(state, contract), /Zielhash weicht ab/u);
});

test('eine amtlich angeordnete Neufassung ersetzt den Normkörper nur mit passender Vollkörper-Assertion', () => {
  const state = {
    title: 'Testgesetz',
    body: [{ type: 'paragraph', label: '§ 1', title: 'Alt', children: [] }],
  };
  const operation = {
    op: 'replaceBody',
    expectedHash: sha256(state.body),
    expectedMatches: 1,
    value: [{ type: 'paragraph', label: '§ 1', title: 'Neu', children: [] }],
    source: 'Gesetze/Test.html',
    sourceProvision: 'Artikel 1 (Neufassung)',
    effectiveDate: '2026-01-02',
  };
  const result = applyPatchRecipe(state, { amendmentAct: 'test-neufassung', effectiveDate: '2026-01-02', operations: [operation] });
  assert.equal(result.body[0].title, 'Neu');
  assert.throws(() => applyPatchRecipe(state, {
    amendmentAct: 'test-neufassung',
    effectiveDate: '2026-01-02',
    operations: [{ ...operation, expectedHash: '0'.repeat(64) }],
  }), /Zielhash weicht ab/u);
});

test('normkörperweite Bezeichnungsersetzungen zählen und prüfen jeden Treffer', () => {
  const state = {
    title: 'Testgesetz',
    body: [{
      type: 'paragraph',
      label: '§ 1',
      title: 'Behörden in Sachsen',
      children: [{ type: 'paragraphText', text: 'Sachsen handelt. Sachsen berichtet.' }],
    }],
  };
  const operation = {
    op: 'designationReplacementBody',
    expectedOld: 'Sachsen',
    expectedMatches: 3,
    value: 'Ostdeutschland',
    source: 'Gesetze/Test.html',
    sourceProvision: 'Artikel 1 Nummer 1',
    effectiveDate: '2026-01-02',
  };
  const result = applyPatchRecipe(state, { amendmentAct: 'test-bezeichnungsersetzung', effectiveDate: '2026-01-02', operations: [operation] });
  assert.equal(result.body[0].title, 'Behörden in Ostdeutschland');
  assert.equal(result.body[0].children[0].text, 'Ostdeutschland handelt. Ostdeutschland berichtet.');
  assert.throws(() => applyPatchRecipe(state, {
    amendmentAct: 'test-bezeichnungsersetzung',
    effectiveDate: '2026-01-02',
    operations: [{ ...operation, expectedMatches: 2 }],
  }), /3 statt 2 Treffer/u);
});

test('Patch-Ziele können gleich bezeichnete Absätze über ihre Elternvorschrift unterscheiden', () => {
  const state = {
    title: 'Testgesetz',
    body: [
      { type: 'paragraph', label: '§ 1', children: [{ type: 'subparagraph', label: '(2)', text: 'eins', children: [] }] },
      { type: 'paragraph', label: '§ 2', children: [{ type: 'subparagraph', label: '(2)', text: 'zwei', children: [] }] },
    ],
  };
  const recipe = {
    amendmentAct: 'test-aenderung',
    effectiveDate: '2026-01-02',
    operations: [{
      op: 'replaceText',
      target: { type: 'subparagraph', label: '(2)', parentType: 'paragraph', parentLabel: '§ 2' },
      expectedOld: 'zwei',
      expectedMatches: 1,
      value: 'geändert',
      source: 'Gesetze/Test.html',
      sourceProvision: 'Artikel 1',
      effectiveDate: '2026-01-02',
    }],
  };
  const result = applyPatchRecipe(state, recipe);
  assert.equal(result.body[0].children[0].text, 'eins');
  assert.equal(result.body[1].children[0].text, 'geändert');
});

test('amtliche Berichtigungen ändern den Wortlaut ohne künstlichen Fassungswechsel und sind idempotent', () => {
  const record = {
    meta: { slug: 'testgesetz', title: 'Testgesetz', sourceReferences: [] },
    history: { initialVersionId: '2026-01-01', entries: [] },
    versions: [{
      versionId: '2026-01-01',
      validFrom: '2026-01-01',
      validTo: null,
      body: [{ type: 'paragraphText', text: 'unrichtiger Wortlaut' }],
    }],
  };
  const correctionMeta = {
    sourceReferences: [{
      kind: 'structured-html-transcription',
      label: 'Amtliche Berichtigung',
      availability: 'versioned',
      localSource: 'Gesetze/Test-Berichtigung.html',
    }],
  };
  const recipe = {
    correctionAct: 'test-berichtigung',
    correctionCitation: 'Berichtigung vom 2. Februar 2026 (TestBl. S. 1)',
    correctionPublicationDate: '2026-02-02',
    legalEffect: 'declaratory-correction',
    targetSlug: 'testgesetz',
    targetVersionId: '2026-01-01',
    effectiveDate: '2026-01-01',
    changeNote: 'Der Wortlaut wurde berichtigt.',
    resultAssertions: [{ target: { type: 'paragraphText', text: 'richtiger Wortlaut' }, equals: 'richtiger Wortlaut' }],
    operations: [{
      op: 'replaceText',
      target: { type: 'paragraphText', text: 'unrichtiger Wortlaut' },
      field: 'text',
      expectedOld: 'unrichtiger Wortlaut',
      value: 'richtiger Wortlaut',
      expectedMatches: 1,
      source: 'Gesetze/Test-Berichtigung.html',
      sourceProvision: 'Nummer 1',
      effectiveDate: '2026-01-01',
    }],
  };
  const first = applyCorrectionToRecord(record, recipe, correctionMeta);
  assert.equal(first.applied, true);
  assert.equal(first.alreadyCorrect, false);
  assert.equal(first.record.versions.length, 1);
  assert.equal(first.record.versions[0].validFrom, '2026-01-01');
  assert.equal(first.record.versions[0].body[0].text, 'richtiger Wortlaut');
  assert.deepEqual(first.record.history.entries.map((entry) => entry.type), ['notice']);

  const second = applyCorrectionToRecord(first.record, recipe, correctionMeta);
  assert.equal(second.alreadyCorrect, true);
  assert.equal(second.record.versions.length, 1);
  assert.equal(second.record.history.entries.length, 1);

  // Eine berichtigte Fundstelle im Rezept ersetzt Hinweis und Quellenvermerk des früheren Laufs.
  const amended = { ...recipe, correctionCitation: 'Berichtigung vom 2. Februar 2026 (TestBl. S. 1–2)' };
  const third = applyCorrectionToRecord(second.record, amended, correctionMeta);
  assert.deepEqual(third.record.history.entries.map((entry) => entry.citation), [amended.correctionCitation]);
  const notes = third.record.versions[0].sourceNotes.filter((note) => note.label === 'Amtliche Berichtigung');
  assert.equal(notes.length, 1);
  assert.match(notes[0].text, /TestBl\. S\. 1–2\)/u);
});

test('mehrere Rezepte derselben Berichtigung für dieselbe Fassung behalten je ihren Hinweis', () => {
  const record = {
    meta: { slug: 'testgesetz', title: 'Testgesetz', sourceReferences: [] },
    history: { initialVersionId: '2026-01-01', entries: [] },
    versions: [{
      versionId: '2026-01-01',
      validFrom: '2026-01-01',
      validTo: null,
      body: [{ type: 'paragraphText', text: 'falsch eins' }, { type: 'paragraphText', text: 'falsch zwei' }],
    }],
  };
  const correctionMeta = { sourceReferences: [{ kind: 'primary-pdf', label: 'TestBl.', localSource: 'Gesetze/Test.pdf' }] };
  const recipeFor = (from, to, changeNote) => ({
    correctionAct: 'test-berichtigung',
    correctionCitation: 'Berichtigung vom 2. Februar 2026 (TestBl. S. 1)',
    correctionPublicationDate: '2026-02-02',
    legalEffect: 'declaratory-correction',
    targetSlug: 'testgesetz',
    targetVersionId: '2026-01-01',
    effectiveDate: '2026-01-01',
    changeNote,
    resultAssertions: [{ target: { type: 'paragraphText', text: to }, equals: to }],
    operations: [{
      op: 'replaceText', target: { type: 'paragraphText', text: from }, field: 'text', expectedOld: from, value: to,
      expectedMatches: 1, source: 'Gesetze/Test.html', sourceProvision: 'Nummer 1', effectiveDate: '2026-01-01',
    }],
  });
  const eins = recipeFor('falsch eins', 'richtig eins', 'Satz eins berichtigt.');
  const zwei = recipeFor('falsch zwei', 'richtig zwei', 'Satz zwei berichtigt.');
  const bundles = [eins, zwei].map((recipe) => ({ recipe, correctionMeta }));
  const berichtigungsHinweise = (result) => ({
    history: result.history.entries.map((entry) => entry.title),
    notes: result.versions[0].sourceNotes.filter((note) => note.label === 'Amtliche Berichtigung').length,
  });

  // Einzeln angewandt (ohne Kenntnis der übrigen Rezepte) und als Bündel: beide Hinweise bleiben.
  const einzeln = applyCorrectionToRecord(applyCorrectionToRecord(record, eins, correctionMeta).record, zwei, correctionMeta);
  assert.deepEqual(berichtigungsHinweise(einzeln.record), { history: ['Satz eins berichtigt.', 'Satz zwei berichtigt.'], notes: 2 });
  const gebuendelt = applyCorrectionsToRecord(record, bundles);
  assert.deepEqual(berichtigungsHinweise(gebuendelt.record), { history: ['Satz eins berichtigt.', 'Satz zwei berichtigt.'], notes: 2 });
  // Ein erneuter Lauf bleibt idempotent.
  assert.deepEqual(berichtigungsHinweise(applyCorrectionsToRecord(gebuendelt.record, bundles).record), berichtigungsHinweise(gebuendelt.record));

  // Ein geänderter Hinweistext eines Rezepts ersetzt nur dessen früheren Hinweis.
  const zweiNeu = { ...zwei, changeNote: 'Satz zwei sprachlich berichtigt.' };
  const geaendert = applyCorrectionsToRecord(gebuendelt.record, [eins, zweiNeu].map((recipe) => ({ recipe, correctionMeta })));
  assert.deepEqual(berichtigungsHinweise(geaendert.record), { history: ['Satz eins berichtigt.', 'Satz zwei sprachlich berichtigt.'], notes: 2 });
});

test('die Rechtsüberleitung gilt nur für Ziele mit REVOSax-Provenienz', async () => {
  const { usesRechtsueberleitung } = await import('../scripts/consolidate-norms.mjs');
  assert.equal(usesRechtsueberleitung({ snapshot: 'data/recht/sources/revosax/x/1.html', sourceSha256: 'a' }), true);
  assert.equal(usesRechtsueberleitung({ adoptedSources: [{ id: 'a', snapshot: 'data/recht/sources/revosax/x/2.html' }] }), true);
  assert.equal(usesRechtsueberleitung({ existingVersionSeed: { versionId: '2026-07-21' } }), false);
  assert.equal(usesRechtsueberleitung({ title: 'Eigene Vorschrift', aliases: [] }), false);
});

test('eine verkündete Aufhebung lässt die Norm am letzten Geltungstag in Kraft', () => {
  assert.equal(repealStatusAt('2030-06-02', '2030-06-01'), 'in-force');
  assert.equal(repealStatusAt('2030-06-02', '2030-06-02'), 'repealed');
  assert.equal(repealStatusAt('2030-06-02', '2030-06-03'), 'repealed');
});

import { completeIntervals } from '../scripts/audit-consolidation.mjs';

test('das Konsolidierungsaudit verlangt für jeden gestaffelten Änderungstermin eine Fassung', () => {
  const record = { history: { entries: [] }, versions: [
    { validFrom: '2030-01-01', validTo: '2030-02-28' },
    { validFrom: '2030-03-01', validTo: '2030-03-31' },
    { validFrom: '2030-04-01', validTo: null },
  ] };
  assert.equal(completeIntervals(record, ['2030-03-01', '2030-04-01'], '2030-01-01'), true);
  assert.equal(completeIntervals(record, ['2030-02-01', '2030-04-01'], '2030-01-01'), false);
});

test('ein zitierter Eintrag der Inhaltsübersicht darf keine vollständige Vorschrift ersetzen', () => {
  const state = { body: [{ type: 'paragraph', label: '§ 1', title: 'Aufgaben', children: [] }] };
  const operation = {
    op: 'insertProvisionAfter', target: { type: 'paragraph', label: '§ 1' },
    expectedHash: sha256(state.body[0]), expectedMatches: 1,
    value: { type: 'paragraph', label: '§ 1a', title: 'Förderung“.', children: [] },
    source: 'Gesetze/Test.html', sourceProvision: 'Artikel 1 Nummer 2', effectiveDate: '2026-01-02',
  };
  const recipe = { amendmentAct: 'test-aenderung', effectiveDate: '2026-01-02', operations: [operation] };
  assert.throws(() => applyPatchRecipe(state, recipe), /Inhaltsübersicht statt vollständiger Vorschrift/u);
  operation.value = { type: 'paragraph', label: '§ 1a', title: 'Förderung', children: [
    { type: 'subparagraph', label: '(1)', text: 'Die Förderung wird ermöglicht.', children: [] },
  ] };
  assert.deepEqual(applyPatchRecipe(state, recipe).body[1], operation.value);
});

test('gespeicherte Fassungsbezeichnung: feste Schlüsselreihenfolge und kein Kurztitel, der den Titel wiederholt', async () => {
  const { mergeStoredVersionIdentity } = await import('../scripts/consolidate-norms.mjs');
  const generated = {
    versionId: '2031-01-01', validFrom: '2031-01-01', validTo: null, isCurrent: true, citation: 'Beispielgesetz',
    sourceReferences: [{ kind: 'amendment-source', localSource: 'Gesetze/Beispiel.html' }],
    title: 'Gesetz über ein Beispiel im Freistaat (Beispielgesetz – BspG)', shortTitle: 'Beispielgesetz', body: [],
  };
  const fresh = mergeStoredVersionIdentity(generated, {}, generated.sourceReferences);
  assert.deepEqual(Object.keys(fresh).slice(0, 3), ['versionId', 'title', 'shortTitle']);
  const rerun = mergeStoredVersionIdentity(generated, { title: fresh.title, shortTitle: fresh.shortTitle }, generated.sourceReferences);
  assert.deepEqual(Object.keys(rerun), Object.keys(fresh), 'ein zweiter Schreiblauf ordnet nichts um');
  const kept = mergeStoredVersionIdentity(generated, { title: 'Beispielgesetz' }, generated.sourceReferences);
  assert.equal(kept.title, 'Beispielgesetz');
  assert.equal('shortTitle' in kept, false, 'der berechnete Kurztitel wiederholt den gespeicherten Titel');
  const redaktionell = mergeStoredVersionIdentity(generated, { title: 'Beispielgesetz', shortTitle: 'Kurzform' }, generated.sourceReferences);
  assert.deepEqual([redaktionell.title, redaktionell.shortTitle], ['Beispielgesetz', 'Kurzform']);
});

test('Fassungsbezeichnung nach amtlicher Neufassung: Klammerform wird in Titel, Kurzbezeichnung und Abkürzung zerlegt', async () => {
  const { versionIdentityFields } = await import('../scripts/consolidate-norms.mjs');
  const verkuendet = 'Gesetz über ein Beispiel im Freistaat (Beispielgesetz – BspG)';
  assert.deepEqual(versionIdentityFields(verkuendet, { renamed: true }), {
    title: 'Gesetz über ein Beispiel im Freistaat', shortTitle: 'Beispielgesetz', abbr: 'BspG',
  });
  // Die Konfiguration ergänzt nur, was die Klammer nicht nennt.
  assert.deepEqual(
    versionIdentityFields('Gesetz über ein Beispiel im Freistaat', { renamed: true, resultShortTitle: 'Beispielgesetz' }),
    { title: 'Gesetz über ein Beispiel im Freistaat', shortTitle: 'Beispielgesetz', abbr: undefined },
  );
  // Eine einteilige Klammer bleibt Titelbestandteil; ohne Neufassung bleibt der Titel unberührt.
  assert.equal(versionIdentityFields('Verwaltungsvorschrift über Beispiele (VwV Beispiele)', { renamed: true }).title,
    'Verwaltungsvorschrift über Beispiele (VwV Beispiele)');
  assert.equal(versionIdentityFields(verkuendet).title, verkuendet);
});

test('Folgefassung ohne Neufassung: Ergebnistitel aus bloßer Kurzbezeichnung führt den Langtitel', async () => {
  const { followUpVersionIdentity } = await import('../scripts/consolidate-norms.mjs');
  const snapshotIdentity = { title: 'Gesetz über ein Beispiel im Freistaat', shortTitle: 'Beispielgesetz', abbr: 'BspG' };
  // Konfiguration nennt als Ergebnistitel nur die Kurzbezeichnung: Der Titel der vorangehenden
  // (gespeicherten) Fassung bleibt, ohne sie der Langtitel der übernommenen Fassung.
  assert.deepEqual(
    followUpVersionIdentity('Beispielgesetz', {
      snapshotIdentity, previousTitle: 'Gesetz über das Beispielwesen im Freistaat',
      resultTitle: 'Beispielgesetz', resultShortTitle: 'Beispielgesetz',
    }),
    { title: 'Gesetz über das Beispielwesen im Freistaat', shortTitle: 'Beispielgesetz', abbr: undefined },
  );
  assert.deepEqual(
    followUpVersionIdentity('Beispielgesetz', {
      snapshotIdentity, resultTitle: 'Beispielgesetz', resultShortTitle: 'Beispielgesetz',
    }),
    { title: 'Gesetz über ein Beispiel im Freistaat', shortTitle: 'Beispielgesetz', abbr: undefined },
  );
  // Ein konfigurierter Langtitel bleibt maßgeblich.
  assert.deepEqual(
    followUpVersionIdentity('Gesetz über das Beispielwesen', {
      snapshotIdentity, previousTitle: 'Beispielgesetz',
      resultTitle: 'Gesetz über das Beispielwesen', resultShortTitle: 'Beispielgesetz', resultAbbr: 'BspG',
    }),
    { title: 'Gesetz über das Beispielwesen', shortTitle: 'Beispielgesetz', abbr: 'BspG' },
  );
  // Ohne Ergebnistitel gilt die Bezeichnung der zuletzt übernommenen Fassung.
  assert.equal(followUpVersionIdentity('Beispielgesetz', { snapshotIdentity }), snapshotIdentity);
  // Nach einer amtlichen Neufassung gilt der verkündete Titel.
  assert.deepEqual(
    followUpVersionIdentity('Gesetz über ein neues Beispiel (Neues Beispielgesetz – NBspG)', {
      renamed: true, snapshotIdentity, resultTitle: 'Beispielgesetz', resultShortTitle: 'Beispielgesetz',
    }),
    { title: 'Gesetz über ein neues Beispiel', shortTitle: 'Neues Beispielgesetz', abbr: 'NBspG' },
  );
  // Eine Neufassung allein der Kurzbezeichnung lässt den Langtitel der vorangehenden Fassung stehen.
  assert.deepEqual(
    followUpVersionIdentity('Neues Beispielgesetz', {
      renamed: true, snapshotIdentity, previousTitle: 'Gesetz über ein Beispiel im Freistaat',
      resultTitle: 'Neues Beispielgesetz', resultShortTitle: 'Neues Beispielgesetz',
    }),
    { title: 'Gesetz über ein Beispiel im Freistaat', shortTitle: 'Neues Beispielgesetz', abbr: undefined },
  );
});

test('Außerkrafttretensregel: „am <Datum>“ endet mit dem Vortag, „mit Ablauf des <Datum>“ mit dem Datum; die Historie steht am ersten Tag ohne Geltung', async () => {
  const { resolveSunsetDates, sunsetStatusAt, sunsetWording } = await import('../scripts/lib/consolidation-engine.mjs');
  assert.deepEqual(sunsetWording('Sie tritt am 31. Dezember 2030 außer Kraft.'), { kind: 'on-day', date: '2030-12-31' });
  assert.deepEqual(sunsetWording('Sie tritt am Tage nach ihrer Verkündung in Kraft und mit Ablauf des 31. Dezember 2030 außer Kraft.'), { kind: 'end-of-day', date: '2030-12-31' });
  assert.deepEqual(sunsetWording('bis zum Außerkrafttreten am 1. Januar 2031'), { kind: 'on-day', date: '2031-01-01' });
  assert.deepEqual(sunsetWording('Die Anordnung tritt am 20.01.2031 außer Kraft.'), { kind: 'on-day', date: '2031-01-20' });
  assert.deepEqual(sunsetWording('Aussetzung bis einschließlich 2. Juni 2030'), { kind: 'end-of-day', date: '2030-06-02' });
  assert.equal(sunsetWording('gilt vom 31. Dezember 2030, 18:00 Uhr, bis zum 1. Januar 2031, 06:00 Uhr'), null);
  assert.throws(() => sunsetWording('tritt am 1. Januar 2031 außer Kraft; § 2 tritt mit Ablauf des 30. Juni 2031 außer Kraft'), /mehrdeutige Außerkrafttretensformel/u);

  assert.deepEqual(resolveSunsetDates({ ceasesOn: '2031-01-01', basis: 'Sie tritt am 1. Januar 2031 außer Kraft.' }), { expiryDate: '2030-12-31', historyDate: '2031-01-01' });
  assert.deepEqual(resolveSunsetDates({ expiryDate: '2030-12-31', basis: 'mit Ablauf des 31. Dezember 2030' }), { expiryDate: '2030-12-31', historyDate: '2031-01-01' });
  assert.deepEqual(resolveSunsetDates({ expiryDate: '2030-06-02', basis: 'Aussetzung bis einschließlich 2. Juni 2030' }), { expiryDate: '2030-06-02', historyDate: '2030-06-03' });
  // Ohne erkennbare Datumsformel (Uhrzeit) gilt dieselbe Regel: Historie am Folgetag des letzten Geltungstags.
  assert.deepEqual(resolveSunsetDates({ expiryDate: '2031-01-01', basis: 'bis zum 1. Januar 2031, 06:00 Uhr' }), { expiryDate: '2031-01-01', historyDate: '2031-01-02' });
  assert.deepEqual(resolveSunsetDates({ expiryDate: '2030-02-28' }), { expiryDate: '2030-02-28', historyDate: '2030-03-01' });
  assert.throws(() => resolveSunsetDates({ expiryDate: '2031-01-01', basis: 'Sie tritt am 1. Januar 2031 außer Kraft.' }), /verlangt ceasesOn 2031-01-01 und expiryDate 2030-12-31/u);
  assert.throws(() => resolveSunsetDates({ ceasesOn: '2031-01-01', expiryDate: '2031-01-01' }), /verlangt expiryDate 2030-12-31/u);
  assert.throws(() => resolveSunsetDates({ ceasesOn: '2031-01-01', basis: 'mit Ablauf des 1. Januar 2031' }), /ohne ceasesOn/u);
  assert.throws(() => resolveSunsetDates({}), /ohne expiryDate oder ceasesOn/u);

  // Am letzten Geltungstag gilt die Norm noch; aufgehoben ist sie ab dem Folgetag.
  assert.equal(sunsetStatusAt('2030-12-31', '2030-12-31'), 'in-force');
  assert.equal(sunsetStatusAt('2030-12-31', '2031-01-01'), 'repealed');
});

test('Konsolidierungsziele übernehmen eine Befristung aus dem übernommenen Text in die letzte Folgefassung', async () => {
  const { applyConsolidationSunset, isSunsetHistoryEntry, targetSunsetDecision } = await import('../scripts/consolidate-norms.mjs');
  const source = { baselineUrl: 'https://www.revosax.sachsen.de/vorschrift/900.2', adoptedSources: [] };
  const decision = { slug: 'beispielgesetz', resolution: 'sunset-applies', ceasesOn: '2031-01-01', expiryDate: '2030-12-31', status: 'in-force', basis: 'Es tritt am 1. Januar 2031 außer Kraft.', basisLocation: '§ 9 Satz 2' };
  assert.equal(targetSunsetDecision('beispielgesetz', source, {}), null);
  assert.equal(targetSunsetDecision('beispielgesetz', source, { '900.2': decision }).key, '900.2');
  assert.throws(() => targetSunsetDecision('beispielgesetz', source, { '901.1': decision }), /bezeichnet keine REVOSax-Fassung/u);
  assert.equal(targetSunsetDecision('anderes-gesetz', source, { '900.2': decision }), null);

  const body = [{ type: 'paragraph', label: '§ 9', title: 'Inkrafttreten und Außerkrafttreten', children: [
    { type: 'paragraphText', text: 'Dieses Gesetz tritt am Tage nach seiner Verkündung in Kraft. Es tritt am  1. Januar 2031 außer Kraft.' },
  ] }];
  const versions = () => [
    { versionId: '2030-01-01', validFrom: '2030-01-01', validTo: '2030-06-30', isCurrent: false, citation: 'Ausgangsfassung' },
    { versionId: '2030-07-01', validFrom: '2030-07-01', validTo: null, isCurrent: true, citation: 'Beispielgesetz, zuletzt geändert durch Gesetz vom 1. Juli 2030' },
  ];
  const keyed = { key: '900.2', ...decision };
  const current = versions();
  const before = applyConsolidationSunset({ versions: current, finalBody: body }, keyed, { referenceDate: '2030-12-31', slug: 'beispielgesetz' });
  assert.equal(current[0].validTo, '2030-06-30', 'frühere Fassungen bleiben unberührt');
  assert.deepEqual([current[1].validTo, current[1].isCurrent], ['2030-12-31', true]);
  assert.deepEqual([before.status, before.expiryDate, before.historyEntry.date], ['in-force', '2030-12-31', '2031-01-01']);
  assert.equal(before.historyEntry.citation, current[1].citation);
  assert.equal(isSunsetHistoryEntry(before.historyEntry), true, 'der Eintrag wird bei jedem Lauf neu gebildet');
  assert.equal(isSunsetHistoryEntry({ ...before.historyEntry, relatedNorm: 'aufhebungsgesetz' }), false);

  const after = versions();
  const expired = applyConsolidationSunset({ versions: after, finalBody: body }, keyed, { referenceDate: '2031-01-01', slug: 'beispielgesetz' });
  assert.deepEqual([expired.status, after[1].isCurrent], ['repealed', false]);
  assert.match(expired.historyEntry.title, /^Außer Kraft getreten/u);

  // Fail-closed: gestrichene oder geänderte Befristung, Änderung nach dem Außerkrafttreten.
  const amendedBody = [{ ...body[0], children: [{ type: 'paragraphText', text: 'Dieses Gesetz tritt am Tage nach seiner Verkündung in Kraft.' }] }];
  assert.throws(() => applyConsolidationSunset({ versions: versions(), finalBody: amendedBody }, keyed, { referenceDate: '2030-12-31', slug: 'beispielgesetz' }), /steht nicht wörtlich im Text der letzten Fassung/u);
  assert.throws(() => applyConsolidationSunset({ versions: versions(), finalBody: body, recipes: [{ amendmentAct: 'spaete-aenderung', effectiveDate: '2031-02-01' }] }, keyed, { referenceDate: '2030-12-31', slug: 'beispielgesetz' }), /nach dem Außerkrafttreten/u);
  assert.throws(() => applyConsolidationSunset({ versions: versions(), finalBody: body }, { ...keyed, ceasesOn: '2030-05-01', expiryDate: '2030-04-30', basis: 'Es tritt am 1. Mai 2030 außer Kraft.' }, { referenceDate: '2030-12-31', slug: 'beispielgesetz' }), /endet vor dem Beginn der letzten Fassung/u);
});

test('Ausgangs- und Zusatzfassungen tragen den Langtitel der Kennzeile, gespeicherte Fassungen ihre eigene Bezeichnung', async () => {
  const { mergeStoredVersionIdentity, snapshotVersionIdentity } = await import('../scripts/consolidate-norms.mjs');
  // Die Seitenüberschrift ist nur die Kurzbezeichnung; die Kennzeile nennt Langtitel und Abkürzung.
  const parsed = { sourceTitle: 'Beispielgesetz', longTitle: 'Gesetz über ein Beispiel im Freistaat', shortTitle: 'Beispielgesetz', abbr: 'BspG' };
  assert.deepEqual(snapshotVersionIdentity(parsed), { title: 'Gesetz über ein Beispiel im Freistaat', shortTitle: 'Beispielgesetz', abbr: 'BspG' });
  assert.deepEqual(snapshotVersionIdentity({ sourceTitle: 'Gesetz über ein Beispiel im Freistaat', shortTitle: 'Gesetz über ein Beispiel im Freistaat' }), {
    title: 'Gesetz über ein Beispiel im Freistaat', shortTitle: undefined, abbr: undefined,
  });
  assert.equal(snapshotVersionIdentity(parsed, { resultShortTitle: 'Beispielgesetz neu' }).shortTitle, 'Beispielgesetz neu');

  const generated = { versionId: '2031-01-01', validFrom: '2031-01-01', title: 'Gesetz über ein Beispiel im Freistaat', shortTitle: 'Beispielgesetz', abbr: 'BspG', body: [] };
  const stored = mergeStoredVersionIdentity(generated, { title: 'Beispielgesetz' }, undefined, { stored: true });
  assert.deepEqual([stored.title, 'shortTitle' in stored, 'abbr' in stored], ['Beispielgesetz', false, false], 'kein Schreiblauf ergänzt eine gespeicherte Fassung');
  assert.deepEqual(Object.keys(stored).slice(0, 2), ['versionId', 'title']);
  const fresh = mergeStoredVersionIdentity(generated, {}, undefined, { stored: false });
  assert.deepEqual([fresh.title, fresh.shortTitle, fresh.abbr], ['Gesetz über ein Beispiel im Freistaat', 'Beispielgesetz', 'BspG']);
});

test('eine reine Aufhebung lässt den Normtyp der aufhebenden Stammvorschrift unberührt', async () => {
  const { affectingActMetadata } = await import('../scripts/consolidate-norms.mjs');
  const act = { slug: 'neue-vorschrift', type: 'verwaltungsvorschrift', affectedNorms: ['andere-norm'] };
  const repealed = affectingActMetadata(act, 'alte-vorschrift', { amendmentAct: 'neue-vorschrift', repealsLaw: true });
  assert.equal(repealed.type, 'verwaltungsvorschrift');
  assert.deepEqual(repealed.affectedNorms, ['andere-norm', 'alte-vorschrift']);
  const amended = affectingActMetadata(act, 'alte-vorschrift', { amendmentAct: 'neue-vorschrift' });
  assert.equal(amended.type, 'aenderungsvorschrift');
  assert.deepEqual(affectingActMetadata(amended, 'alte-vorschrift', { repealsLaw: true }).affectedNorms, ['andere-norm', 'alte-vorschrift']);
  // Teilaufhebung durch die Schlussbestimmung einer Stammvorschrift („gleichzeitig treten die
  // Ziffern … außer Kraft“): Normtyp bleibt, andere Operationen sind ausgeschlossen.
  const partial = affectingActMetadata(act, 'alte-vorschrift', {
    amendmentAct: 'neue-vorschrift',
    partialRepeal: true,
    operations: [{ op: 'repealProvision' }, { op: 'deleteProvision' }],
  });
  assert.equal(partial.type, 'verwaltungsvorschrift');
  assert.deepEqual(partial.affectedNorms, ['andere-norm', 'alte-vorschrift']);
  assert.throws(
    () => affectingActMetadata(act, 'alte-vorschrift', { amendmentAct: 'neue-vorschrift', partialRepeal: true, operations: [{ op: 'replaceText' }] }),
    /Teilaufhebung \(partialRepeal\) darf nur/u,
  );
});

test('eine übernommene Zusatzfassung mit gleicher Kennzeile führt die Bezeichnung der Vorfassung fort', async () => {
  const { adoptedVersionIdentity } = await import('../scripts/consolidate-norms.mjs');
  const kennzeile = { sourceTitle: 'Testgesetz', longTitle: 'Bekanntmachung der Neufassung des Testgesetzes', shortTitle: 'Testgesetz' };
  const snapshotIdentity = { title: 'Bekanntmachung der Neufassung des Testgesetzes', shortTitle: 'Testgesetz' };
  assert.deepEqual(adoptedVersionIdentity({
    previousParsed: kennzeile,
    adoptedParsed: { ...kennzeile },
    previousIdentity: { title: 'Testgesetz' },
    snapshotIdentity,
  }), { title: 'Testgesetz' });
  assert.deepEqual(adoptedVersionIdentity({
    previousParsed: kennzeile,
    adoptedParsed: { ...kennzeile, longTitle: 'Gesetz über Testfälle' },
    previousIdentity: { title: 'Testgesetz' },
    snapshotIdentity,
  }), snapshotIdentity);
  assert.deepEqual(adoptedVersionIdentity({ previousParsed: null, adoptedParsed: kennzeile, previousIdentity: { title: 'Testgesetz' }, snapshotIdentity }), snapshotIdentity);
});
