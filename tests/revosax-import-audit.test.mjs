import assert from 'node:assert/strict';
import test from 'node:test';

import { buildImportAudit, classifySourceEnding, sunsetDatesFromBody } from '../scripts/build-revosax-import-audit.mjs';

test('Befristungen im übernommenen Text werden als Datum erkannt', () => {
  const body = [
    { type: 'paragraph', label: '§ 9', title: 'Inkrafttreten, Außerkrafttreten', children: [
      { type: 'paragraphText', text: 'Diese Verordnung tritt am 1. Januar 2020 in Kraft. Sie tritt mit Ablauf des 31. Dezember 2025 außer Kraft.' },
    ] },
  ];
  assert.deepEqual(sunsetDatesFromBody(body), ['2025-12-31']);
  assert.deepEqual(sunsetDatesFromBody([{ type: 'paragraphText', text: 'Diese Richtlinie tritt am Tag nach ihrer Veröffentlichung in Kraft.' }]), []);
});

test('Quellenende wird nach Nachfolgefassung (A), eigener Befristung (B) oder unklar eingeordnet', () => {
  assert.equal(classifySourceEnding({ sourceValidTo: '2024-05-31', laterVersions: ['2024-06-01'], sunsetDates: [] }).type, 'A');
  assert.equal(classifySourceEnding({ sourceValidTo: '2025-12-31', laterVersions: [], sunsetDates: ['2025-12-31'] }).type, 'B');
  assert.equal(classifySourceEnding({ sourceValidTo: '2025-12-31', laterVersions: [], sunsetDates: ['2026-01-01'] }).type, 'B');
  // Ende nach dem Stichtag ohne Befristung im Text: spätere sächsische Rechtsänderung (A).
  assert.equal(classifySourceEnding({ sourceValidTo: '2025-12-31', laterVersions: [], sunsetDates: [] }).type, 'A');
  // Befristungsdaten, die nicht zum Ende passen, bleiben unklar.
  assert.equal(classifySourceEnding({ sourceValidTo: '2025-12-31', laterVersions: [], sunsetDates: ['2030-12-31'] }).type, 'unclear');
  assert.equal(classifySourceEnding({ sourceValidTo: '2023-06-30', laterVersions: [], sunsetDates: [], baselineDate: '2023-11-01' }).type, 'unclear');
  assert.equal(classifySourceEnding({ sourceValidTo: null, laterVersions: [], sunsetDates: [] }).type, null);
});

test('der Import-Audit ist deterministisch und seine Bilanz geht exakt auf', async () => {
  const manifest = { reportedCount: 6, hits: [{ lawId: 1 }, { lawId: 2 }, { lawId: 3 }, { lawId: 4 }, { lawId: 5 }, { lawId: 6 }], duplicateListings: 0, passes: 2 };
  const entries = [
    { sourceId: '1', revosaxLawId: '1', category: 'G', inferredType: 'gesetz', adaptedTitle: 'A', sourceUrl: 'u1', proposedSlug: 'a', reviewFlags: ['missing-document-date'], listing: { documentDate: '2001-01-01' } },
    { sourceId: '2', revosaxLawId: '2', category: 'ÄG', inferredType: 'aenderungsvorschrift', adaptedTitle: 'B', sourceUrl: 'u2', proposedSlug: 'b', reviewFlags: [], attachments: [{ url: 'https://www.revosax.sachsen.de/attachments/9', label: 'Anlage' }] },
    { sourceId: '3', revosaxLawId: '3', category: 'ÄG', sourceUrl: 'u3', skipReason: 'part-of-envelope:1', envelope: { envelopeLawId: '1', envelopeUrl: 'e1' }, listing: {} },
    { sourceId: '4', revosaxLawId: '4', category: 'VwV', sourceUrl: 'u4', skipReason: 'same-version-alias:4.1' },
    { sourceId: '5', revosaxLawId: '5', category: 'VwV', sourceUrl: 'u5', proposedSlug: 'e', reviewFlags: ['attachment-only-content'] },
    { sourceId: '6.1', revosaxLawId: '6', category: 'VwV', inferredType: 'foerderrichtlinie', adaptedTitle: 'F', sourceUrl: 'u6', proposedSlug: 'f', reviewFlags: ['source-ended-without-successor'], sourceValidFrom: '2020-01-01', sourceValidTo: '2023-12-31', rawCacheFile: '/nicht/vorhanden/raw.html', parsedCacheFile: '/nicht/vorhanden/parsed.json' },
  ];
  const report = { baselineDate: '2023-11-01', generatedAt: 't', total: 6, successful: 6, failed: 0, reviewCases: 3, failureCounts: {}, entries };
  const plan = {
    generatedAt: 't', writable: true,
    counts: { CREATE: 3, MATCH: 0, PROTECT: 0, REVIEW: 1, SKIP: 2, DEFERRED: 1 },
    entries: [
      { sourceId: '1', action: 'CREATE', canonicalSlug: 'a' },
      { sourceId: '2', action: 'CREATE', canonicalSlug: 'b' },
      { sourceId: '6.1', action: 'CREATE', canonicalSlug: 'f' },
      { sourceId: '3', action: 'REVIEW', reason: 'zurückgestellt: x', deferred: true },
      { sourceId: '4', action: 'SKIP', reason: 'Staging: same-version-alias:4.1' },
      { sourceId: '5', action: 'SKIP', reason: 'Entscheidung: nur PDF' },
    ],
  };
  const envelopes = { generatedAt: 't', counts: { A: 0, B: 0, C: 0, D: 1 }, fetchedEnvelopes: [], components: [{ sourceId: '3', lawId: '3', class: 'D', reason: 'Anker fehlt', envelopeLawId: '1', envelopeUrl: 'e1', anchor: 'a2', sourceUrl: 'u3' }] };
  const attachmentsManifest = { attachments: { 9: { sourceId: '2', url: 'https://www.revosax.sachsen.de/attachments/9', objectKey: 'k', verified: true, fileName: 'x.pdf', kind: 'pdf' } } };
  const sunsetDecisions = { decisions: { '6.1': { slug: 'f', resolution: 'sunset-applies', expiryDate: '2023-12-31', status: 'repealed', basis: 'Sie tritt mit Ablauf des 31. Dezember 2023 außer Kraft.', reason: 'Typ B' } } };
  const input = { cacheDir: '/nicht/vorhanden', manifest, report, plan, envelopes, decisions: { decisions: { 5: { action: 'SKIP', reason: 'nur PDF' } } }, sunsetDecisions, r2Manifest: { objects: {} }, attachmentsManifest, materializationReport: { protectedCount: 0 }, residualBacklog: null, preexistingMatches: 0 };
  const first = await buildImportAudit(input);
  const second = await buildImportAudit(input);
  assert.deepEqual(first, second);
  assert.equal(first.summary.balance.sums, 6);
  assert.equal(first.summary.balance.uniqueHits, 6);
  assert.equal(first.summary.balance.reviewDeferred, 1);
  assert.deepEqual(first.skips.byCategory, { 'same-version-alias': 1, 'manual-decision': 1 });
  assert.equal(first.reviewFlags.entries.find((entry) => entry.sourceId === '1').documentDate.source, 'listing');
  assert.equal(first.reviewFlags.entries.find((entry) => entry.sourceId === '2').attachments[0].verified, true);
  assert.equal(first.summary.attachments.referenced, 1);
  assert.equal(first.envelopes.components[0].deferred, true);
  // Befristungsentscheidung: der Quellenendefall trägt die Entscheidung, die Bilanz zählt sie als aufgelöst.
  const ended = first.reviewFlags.entries.find((entry) => entry.sourceId === '6.1');
  assert.equal(ended.sourceEnding.type, 'A', 'ohne Cache keine Befristungsdaten → wie spätere Rechtsänderung eingeordnet');
  assert.deepEqual(ended.sunsetDecision, { resolution: 'sunset-applies', expiryDate: '2023-12-31', status: 'repealed', basis: 'Sie tritt mit Ablauf des 31. Dezember 2023 außer Kraft.', reason: 'Typ B' });
  assert.deepEqual(first.summary.sunsetDecisions, { '6.1': { slug: 'f', resolution: 'sunset-applies', expiryDate: '2023-12-31', status: 'repealed' } });
  // Sachgebiete gelten als amtlich belegt, sobald die Fundstellennummer der Quelle sie trägt;
  // abgeleitet bleibt nur die Zuordnung ohne Fundstellennummer. Schlagwörter tragen die amtliche
  // Bezeichnung der Trefferliste, Kurzfassungen schreibt der Massenimport keine mehr.
  assert.deepEqual(first.summary.derivedMetadata.fields, ['subjects']);
  assert.equal(first.summary.derivedMetadata.norms, 3);
  assert.deepEqual(first.summary.derivedMetadata.subjects, { official: 0, derived: 0 }, 'ohne lesbare meta.json zählt der Audit keine Zuordnung');
  // Ohne nachstichtaglichen Rechtsakt bleiben alle Zähler auf null.
  assert.deepEqual(first.summary.postCutoff, {
    baselineDate: '2023-11-01',
    sourcesAfterCutoff: 0,
    citationsWithContainmentClauseStripped: 0,
    decisions: { discard: 0, adopted: 0, open: 0 },
    skipped: 0,
    unchangedTargetsOfPostCutoffAmends: 0,
  });
});

test('Rechtsakte nach dem Überleitungsstichtag werden gezählt, gekennzeichnet und als eigene SKIP-Kategorie geführt', async () => {
  const manifest = { reportedCount: 2, hits: [{ lawId: 1 }, { lawId: 2 }], duplicateListings: 0, passes: 1 };
  const entries = [
    {
      sourceId: '1', revosaxLawId: '1', category: 'ÄVO', inferredType: 'aenderungsvorschrift', adaptedTitle: 'A',
      sourceUrl: 'u1', proposedSlug: 'a', reviewFlags: [], listing: { documentDate: '2024-07-08' },
      fullCitation: 'Testvorschrift vom 1. Januar 2020 (SächsABl. S. 1), zuletzt enthalten in der Verwaltungsvorschrift vom 27. November 2025 (SächsABl. SDr. S. S 209)',
    },
    {
      sourceId: '2', revosaxLawId: '2', category: 'G', inferredType: 'gesetz', adaptedTitle: 'B',
      sourceUrl: 'u2', proposedSlug: 'b', reviewFlags: [], listing: { documentDate: '2020-01-01' },
      fullCitation: 'Zweites Testgesetz vom 1. Januar 2020 (SächsGVBl. S. 2)',
    },
  ];
  const report = { baselineDate: '2023-11-01', generatedAt: 't', total: 2, successful: 2, failed: 0, reviewCases: 0, failureCounts: {}, entries };
  const plan = {
    generatedAt: 't', writable: true,
    counts: { CREATE: 1, MATCH: 0, PROTECT: 0, REVIEW: 0, SKIP: 1, DEFERRED: 0 },
    entries: [
      { sourceId: '1', action: 'SKIP', canonicalSlug: 'a', inferredType: 'aenderungsvorschrift', reason: 'post-cutoff-saxon-act: Erlassdatum 2024-07-08 liegt nach dem Rechtsüberleitungsstichtag 2023-11-01', postCutoff: ['Erlassdatum 2024-07-08'], postCutoffResolution: 'discard' },
      { sourceId: '2', action: 'CREATE', canonicalSlug: 'b' },
    ],
  };
  const postCutoffDecisions = { decisions: { a: { slug: 'a', resolution: 'discard', adoptingNorm: null, basis: 'Erlassdatum 8. Juli 2024', reason: 'Einmaliger Rechtsakt nach dem Stichtag' } } };
  const audit = await buildImportAudit({
    cacheDir: '/nicht/vorhanden', manifest, report, plan, envelopes: null,
    decisions: { decisions: {} }, sunsetDecisions: null, postCutoffDecisions,
    r2Manifest: { objects: {} }, attachmentsManifest: null, materializationReport: null, residualBacklog: null, preexistingMatches: 0,
  });
  assert.deepEqual(audit.summary.postCutoff, {
    baselineDate: '2023-11-01',
    sourcesAfterCutoff: 1,
    citationsWithContainmentClauseStripped: 1,
    decisions: { discard: 1, adopted: 0, open: 0 },
    skipped: 1,
    unchangedTargetsOfPostCutoffAmends: 0,
  });
  assert.deepEqual(audit.skips.byCategory, { 'post-cutoff-saxon-act': 1 });
  const flagged = audit.reviewFlags.entries.find((entry) => entry.sourceId === '1');
  assert.ok(flagged.flags.includes('post-cutoff-source'));
  assert.equal(flagged.postCutoff.resolution, 'discard');
  assert.equal(flagged.postCutoff.adoptingNorm, null);
});
