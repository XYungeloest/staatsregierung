import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPatchRecipe, sha256 } from '../scripts/lib/consolidation-engine.mjs';
import { applyCorrectionToRecord } from '../scripts/lib/correction-engine.mjs';

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
});
