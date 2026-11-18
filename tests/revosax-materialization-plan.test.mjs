import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyDecision,
  applyPostCutoffRule,
  buildPlan,
  findDuplicateSources,
  normalizeIdentity,
  planEntry,
  postCutoffFacts,
  buildIndexes,
  summarizeExistingNorm,
} from '../scripts/plan-revosax-materialization.mjs';

const BASELINE = '2023-11-01';

function existing(slug, { title, shortTitle = title, abbr, lawId, versions }) {
  const meta = {
    id: slug, slug, title, shortTitle, ...(abbr ? { abbr } : {}), type: 'gesetz',
    sourceReferences: lawId ? [{ kind: 'revosax-snapshot', lawId, url: `https://www.revosax.sachsen.de/vorschrift/${lawId}.1` }] : [],
  };
  return summarizeExistingNorm(slug, meta, versions.map((validFrom, index) => ({
    versionId: validFrom, validFrom, validTo: null, isCurrent: index === versions.length - 1, body: [],
  })));
}

function staged(overrides) {
  return {
    revosaxLawId: '4711',
    versionSuffix: null,
    sourceId: '4711',
    category: 'G',
    sourceUrl: 'https://www.revosax.sachsen.de/vorschrift/4711',
    canonicalVersionUrl: 'https://www.revosax.sachsen.de/vorschrift/4711.1',
    requestedUrl: 'https://www.revosax.sachsen.de/vorschrift/4711',
    sourceTitle: 'Sächsisches Testgesetz',
    sourceAbbr: 'SächsTestG',
    adaptedTitle: 'Ostdeutsches Testgesetz',
    adaptedShortTitle: 'Testgesetz',
    adaptedAbbr: 'OstTestG',
    inferredType: 'gesetz',
    proposedSlug: 'testgesetz',
    reviewFlags: [],
    skipReason: null,
    listing: { label: 'Testgesetz' },
    ...overrides,
  };
}

test('Identität wird zuerst über die REVOSax-lawId bestimmt und schützt spätere Ost-Fassungen', () => {
  const protectedNorm = existing('ostdeutsches-testgesetz', { title: 'Ostdeutsches Testgesetz', lawId: '4711', versions: [BASELINE, '2025-01-01'] });
  const matched = existing('anderes-gesetz', { title: 'Völlig anderer Titel', lawId: '4712', versions: [BASELINE] });
  const withoutBaseline = existing('drittes-gesetz', { title: 'Drittes Gesetz', lawId: '4713', versions: ['2020-01-01'] });
  const laterOnly = existing('viertes-gesetz', { title: 'Viertes Gesetz', lawId: '4714', versions: ['2026-01-01'] });
  const indexes = buildIndexes([protectedNorm, matched, withoutBaseline, laterOnly]);

  const protect = planEntry(staged(), BASELINE, indexes);
  assert.equal(protect.action, 'PROTECT');
  assert.equal(protect.canonicalSlug, 'ostdeutsches-testgesetz');
  assert.equal(protect.matchBasis, 'lawId');
  assert.deepEqual(protect.laterVersionIds, ['2025-01-01']);

  const match = planEntry(staged({ revosaxLawId: '4712', sourceId: '4712', adaptedTitle: 'Neuer Titel', proposedSlug: 'neuer-titel' }), BASELINE, indexes);
  assert.equal(match.action, 'MATCH');
  assert.equal(match.canonicalSlug, 'anderes-gesetz');
  assert.equal(match.baselinePresent, true);

  const reviewed = planEntry(staged({ revosaxLawId: '4713', sourceId: '4713' }), BASELINE, indexes);
  assert.equal(reviewed.action, 'REVIEW');
  assert.match(reviewed.reason, /besitzt keine Ausgangsfassung 2023-11-01/u);
  assert.equal(planEntry(staged({ revosaxLawId: '4714', sourceId: '4714' }), BASELINE, indexes).action, 'PROTECT');
});

test('Titel, Kurzbezeichnung und Abkürzung matchen nur exakt; Abkürzung allein ist REVIEW', () => {
  const byTitle = existing('saechsisches-testgesetz', { title: 'Sächsisches Testgesetz', versions: [BASELINE] });
  const byAbbr = existing('irgendwas', { title: 'Ganz anderes Gesetz', abbr: 'SächsAndG', versions: [BASELINE] });
  const indexes = buildIndexes([byTitle, byAbbr]);

  const titleMatch = planEntry(staged({ revosaxLawId: '9', sourceId: '9' }), BASELINE, indexes);
  assert.equal(titleMatch.action, 'MATCH');
  assert.equal(titleMatch.matchBasis, 'title');
  assert.equal(normalizeIdentity('Sächsisches Testgesetz'), normalizeIdentity('Ostdeutsches Testgesetz'));

  const abbrOnly = planEntry(staged({ revosaxLawId: '10', sourceId: '10', adaptedTitle: 'Neues Gesetz', adaptedShortTitle: 'Neues Gesetz', sourceTitle: 'Neues Gesetz', adaptedAbbr: 'OstAndG', sourceAbbr: 'SächsAndG', proposedSlug: 'neues-gesetz', listing: { label: 'Neues Gesetz' } }), BASELINE, indexes);
  assert.equal(abbrOnly.action, 'REVIEW');
  assert.deepEqual(abbrOnly.candidates, ['irgendwas']);

  const created = planEntry(staged({ revosaxLawId: '11', sourceId: '11', adaptedTitle: 'Neues Gesetz', adaptedShortTitle: 'Neues Gesetz', sourceTitle: 'Neues Gesetz', adaptedAbbr: null, sourceAbbr: null, proposedSlug: 'neues-gesetz', listing: { label: 'Neues Gesetz' } }), BASELINE, indexes);
  assert.equal(created.action, 'CREATE');
  assert.equal(created.canonicalSlug, 'neues-gesetz');

  const collision = planEntry(staged({ revosaxLawId: '12', sourceId: '12', adaptedTitle: 'X', adaptedShortTitle: 'X', sourceTitle: 'X', adaptedAbbr: null, sourceAbbr: null, proposedSlug: 'irgendwas', listing: { label: 'X' } }), BASELINE, indexes);
  assert.equal(collision.action, 'REVIEW');
  assert.match(collision.reason, /Slug irgendwas ist bereits/u);
});

test('gleiche Kurzbezeichnung mit widersprechender REVOSax-lawId ist eine andere Vorschrift', () => {
  // Änderungsvorschriften tragen oft dieselbe Kurzbezeichnung („Änd OstBspVO“);
  // eine bestehende Norm mit anderer lawId darf weder MATCH noch REVIEW auslösen.
  const earlierAmendment = existing('aend-ostbspvo', { title: 'Zweite Verordnung zur Änderung der OstBspVO', shortTitle: 'Änd OstBspVO', lawId: '90011', versions: [BASELINE] });
  const legacyWithoutLawId = existing('aend-ostbspvo-alt', { title: 'Änd OstBspVO (Altbestand)', shortTitle: 'Änd OstBspVO alt', versions: [BASELINE] });
  const indexes = buildIndexes([earlierAmendment, legacyWithoutLawId]);

  const later = planEntry(staged({
    revosaxLawId: '90012', sourceId: '90012', category: 'ÄVO',
    sourceUrl: 'https://www.revosax.sachsen.de/vorschrift/90012', canonicalVersionUrl: 'https://www.revosax.sachsen.de/vorschrift/90012.1', requestedUrl: 'https://www.revosax.sachsen.de/vorschrift/90012',
    adaptedTitle: 'Fünfte Verordnung zur Änderung der OstBspVO', adaptedShortTitle: 'Änd OstBspVO', adaptedAbbr: null, sourceAbbr: null,
    listing: { label: 'Änd OstBspVO' }, proposedSlug: 'aend-ostbspvo-90012',
  }), BASELINE, indexes);
  assert.equal(later.action, 'CREATE');

  // Ohne widersprechende lawId bleibt der exakte Titelabgleich wirksam.
  const legacyMatch = planEntry(staged({
    revosaxLawId: '90013', sourceId: '90013',
    adaptedTitle: 'Änd OstBspVO (Altbestand)', adaptedShortTitle: 'Änd OstBspVO alt', adaptedAbbr: null, sourceAbbr: null,
    listing: { label: 'Änd OstBspVO alt' },
  }), BASELINE, indexes);
  assert.equal(legacyMatch.canonicalSlug, 'aend-ostbspvo-alt');
  assert.notEqual(legacyMatch.action, 'CREATE');

  // Eine spätere Ost-Norm (andere lawId, keine Stichtagsfassung) mit gleichem Titel
  // bleibt ein Widerspruch: PROTECT statt eines stillen Doppels.
  const successor = existing('ost-bsppol', { title: 'Ostdeutsche BspPol', abbr: 'OstBspPol', lawId: '90014', versions: ['2025-09-01'] });
  const predecessor = planEntry(staged({
    revosaxLawId: '90015', sourceId: '90015.3',
    adaptedTitle: 'Ostdeutsche BspPol', adaptedShortTitle: 'Ostdeutsche BspPol', adaptedAbbr: 'OstBspPol', sourceAbbr: 'SächsBspPol',
    listing: { label: 'Ostdeutsche BspPol' },
  }), BASELINE, buildIndexes([successor]));
  assert.equal(predecessor.action, 'PROTECT');
  assert.equal(predecessor.canonicalSlug, 'ost-bsppol');
});

test('mehrdeutige Identitäten, Mehrfachfassungen und Staging-Skips werden nie automatisch geschrieben', () => {
  const first = existing('a', { title: 'Doppeltes Gesetz', versions: [BASELINE] });
  const second = existing('b', { title: 'Doppeltes Gesetz', versions: [BASELINE] });
  const indexes = buildIndexes([first, second]);
  const ambiguous = planEntry(staged({ revosaxLawId: '20', sourceId: '20', adaptedTitle: 'Doppeltes Gesetz', adaptedShortTitle: 'Doppeltes Gesetz', sourceTitle: 'Doppeltes Gesetz', adaptedAbbr: null, sourceAbbr: null }), BASELINE, indexes);
  assert.equal(ambiguous.action, 'REVIEW');
  assert.deepEqual(ambiguous.candidates, ['a', 'b']);

  const skipped = planEntry(staged({ skipReason: 'same-version-alias:4711.1' }), BASELINE, indexes);
  assert.equal(skipped.action, 'SKIP');
  const differing = planEntry(staged({ reviewFlags: ['multi-version-text-differs'] }), BASELINE, indexes);
  assert.equal(differing.action, 'REVIEW');
  const titleMismatchOnly = planEntry(staged({ reviewFlags: ['listing-title-mismatch'] }), BASELINE, indexes);
  assert.equal(titleMismatchOnly.action, 'CREATE');
});

test('dokumentierte Entscheidungen lösen nur REVIEW-Fälle auf und brauchen eine Begründung', () => {
  const reviewed = { action: 'REVIEW', reason: 'unklar' };
  const entry = staged();
  assert.equal(applyDecision(reviewed, entry, {}, BASELINE).action, 'REVIEW');
  assert.equal(applyDecision(reviewed, entry, { 4711: { action: 'CREATE', reason: 'zu kurz' } }, BASELINE).action, 'REVIEW');
  const created = applyDecision(reviewed, entry, { 4711: { action: 'CREATE', reason: 'Redaktionell geprüft: eigenständige neue Norm.', canonicalSlug: 'testgesetz-neu' } }, BASELINE);
  assert.equal(created.action, 'CREATE');
  assert.equal(created.canonicalSlug, 'testgesetz-neu');
  assert.equal(created.decided, true);
  const matched = applyDecision(reviewed, entry, { 4711: { action: 'MATCH', reason: 'Redaktionell geprüft: identisch mit bestehender Norm.', canonicalSlug: 'ostdeutsches-testgesetz' } }, BASELINE);
  assert.equal(matched.action, 'MATCH');
  assert.equal(applyDecision(reviewed, entry, { 4711: { action: 'MATCH', reason: 'Redaktionell geprüft, aber ohne Slug.' } }, BASELINE).action, 'REVIEW');
  const skipped = applyDecision({ action: 'CREATE', reason: 'neu' }, entry, { 4711: { action: 'SKIP', reason: 'Redaktionell geprüft: nicht zu importieren.' } }, BASELINE);
  assert.equal(skipped.action, 'SKIP');
  const contradiction = applyDecision({ action: 'CREATE', reason: 'neu' }, entry, { 4711: { action: 'MATCH', reason: 'Redaktionell geprüft: widerspricht.', canonicalSlug: 'x' } }, BASELINE);
  assert.equal(contradiction.action, 'REVIEW');
});

test('buildPlan zählt Kategorien, blockiert den Schreibmodus bei REVIEW und verhindert doppelte neue Slugs', () => {
  const report = { baselineDate: BASELINE, entries: [
    staged({ revosaxLawId: '1', sourceId: '1', proposedSlug: 'gleich' }),
    staged({ revosaxLawId: '2', sourceId: '2', adaptedTitle: 'Zweites', adaptedShortTitle: 'Zweites', sourceTitle: 'Zweites', adaptedAbbr: null, sourceAbbr: null, proposedSlug: 'gleich' }),
    staged({ revosaxLawId: '3', sourceId: '3', adaptedTitle: 'Drittes', adaptedShortTitle: 'Drittes', sourceTitle: 'Drittes', adaptedAbbr: null, sourceAbbr: null, proposedSlug: 'drittes' }),
  ] };
  const plan = buildPlan({ report, existing: [] });
  assert.equal(plan.counts.CREATE, 1);
  assert.equal(plan.counts.REVIEW, 2);
  assert.equal(plan.writable, false);
  assert.match(plan.entries[0].reason, /Slug gleich würde von 2 neuen Normen belegt/u);

  const clean = buildPlan({ report: { baselineDate: BASELINE, entries: [report.entries[2]] }, existing: [] });
  assert.equal(clean.writable, true);
  assert.deepEqual(clean.counts, { CREATE: 1, MATCH: 0, PROTECT: 0, REVIEW: 0, SKIP: 0, DEFERRED: 0 });
});

import { isInheritedBaselineAct } from '../scripts/audit-consolidation.mjs';

test('übernommene, unveränderte REVOSax-Akte erzeugen keine Konsolidierungsziele', () => {
  const official = { kind: 'revosax-snapshot', sourceRole: 'official-snapshot', lawId: '1', url: 'https://www.revosax.sachsen.de/vorschrift/1.1' };
  const baselineAct = {
    meta: { type: 'aenderungsvorschrift', effectiveDate: '2020-03-26', sourceReferences: [official] },
    history: { entries: [{ type: 'initial', date: '2023-11-01' }] },
    versions: [{ validFrom: '2023-11-01', validTo: null, sourceReferences: [official] }],
  };
  assert.equal(isInheritedBaselineAct(baselineAct), true);
  assert.equal(isInheritedBaselineAct({ ...baselineAct, versions: [...baselineAct.versions, { validFrom: '2026-01-01', validTo: null }] }), false);
  assert.equal(isInheritedBaselineAct({ ...baselineAct, history: { entries: [{ type: 'amendment', date: '2026-02-01' }] } }), false);
  assert.equal(isInheritedBaselineAct({ ...baselineAct, meta: { ...baselineAct.meta, sourceReferences: [official, { kind: 'amendment-source' }] } }), false);
  assert.equal(isInheritedBaselineAct({ ...baselineAct, meta: { ...baselineAct.meta, sourceReferences: [{ kind: 'revosax-snapshot' }] } }), false);
  assert.equal(isInheritedBaselineAct({ ...baselineAct, meta: { ...baselineAct.meta, effectiveDate: '2024-01-01' } }), false);
  assert.equal(isInheritedBaselineAct({ meta: {}, history: { entries: [] }, versions: [{ validFrom: '2023-11-01' }] }), false);
});

test('REVOSax-Doppelerfassungen mit identischem Text und gleicher Zitierung werden nur einmal übernommen', () => {
  const citation = 'Gesetz zur Änderung des Beispielschulgesetzes vom 15. Juli 1994 (SächsGVBl. S. 9014)';
  const entries = [
    staged({ revosaxLawId: '90017', sourceId: '90017', adaptedBodyHash: 'abc', fullCitation: citation, proposedSlug: 'aend-bspschulg-b' }),
    staged({ revosaxLawId: '90016', sourceId: '90016', adaptedBodyHash: 'abc', fullCitation: citation, proposedSlug: 'aend-bspschulg-a' }),
    // gleicher Text, andere Zitierung: eigenständig (z. B. gleichlautende VwV je Beruf)
    staged({ revosaxLawId: '90018', sourceId: '90018', adaptedBodyHash: 'def', fullCitation: 'VwV Beispielberuf A vom 1. Januar 2000 (SächsABl. S. 1)', proposedSlug: 'vwv-beispielberuf-a' }),
    staged({ revosaxLawId: '90019', sourceId: '90019', adaptedBodyHash: 'def', fullCitation: 'VwV Beispielberuf B vom 1. Januar 2000 (SächsABl. S. 2)', proposedSlug: 'vwv-beispielberuf-b' }),
  ];
  const duplicates = findDuplicateSources(entries);
  assert.deepEqual([...duplicates.entries()], [['90017', '90016']]);

  const plan = buildPlan({ report: { baselineDate: BASELINE, entries }, existing: [] });
  const bySource = new Map(plan.entries.map((entry) => [entry.sourceId, entry]));
  assert.equal(bySource.get('90017').action, 'SKIP');
  assert.match(bySource.get('90017').reason, /90016/u);
  assert.equal(bySource.get('90016').action, 'CREATE');
  assert.equal(bySource.get('90018').action, 'CREATE');
  assert.equal(bySource.get('90019').action, 'CREATE');
});

test('ein Artikel mit eigenem Erlassdatum und Fassungsbeginn vor dem Stichtag zählt nicht wegen einer späteren Mantelvorschrift als post-cutoff', () => {
  const entry = staged({ documentDate: '2023-07-06', sourceValidFrom: '2023-08-01' });
  assert.deepEqual(postCutoffFacts(entry, BASELINE, { envelopeValidFrom: '2024-01-01' }), []);
  const planned = { action: 'CREATE', canonicalSlug: 'artikel-a', reason: 'neu' };
  assert.equal(applyPostCutoffRule(planned, entry, {}, BASELINE, '2024-01-01'), planned);
});

test('der Beginn der Mantelvorschrift zählt hilfsweise, wenn eigene Daten fehlen oder nach dem Stichtag liegen', () => {
  assert.deepEqual(
    postCutoffFacts(staged({ documentDate: '2023-07-06', sourceValidFrom: null }), BASELINE, { envelopeValidFrom: '2024-01-01' }),
    ['Mantelvorschrift ab 2024-01-01'],
  );
  assert.deepEqual(
    postCutoffFacts(staged({ documentDate: '2023-07-06', sourceValidFrom: '2024-01-01' }), BASELINE, { envelopeValidFrom: '2024-01-01' }),
    ['Fassungsbeginn 2024-01-01', 'Mantelvorschrift ab 2024-01-01'],
  );
  const skipped = applyPostCutoffRule(
    { action: 'CREATE', canonicalSlug: 'artikel-b', reason: 'neu' },
    staged({ documentDate: null, sourceValidFrom: null }), {}, BASELINE, '2024-01-01',
  );
  assert.equal(skipped.action, 'SKIP');
  assert.equal(skipped.postCutoffResolution, 'undecided');
});
