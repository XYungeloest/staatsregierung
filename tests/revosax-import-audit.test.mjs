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
  const manifest = { reportedCount: 5, hits: [{ lawId: 1 }, { lawId: 2 }, { lawId: 3 }, { lawId: 4 }, { lawId: 5 }], duplicateListings: 0, passes: 2 };
  const entries = [
    { sourceId: '1', revosaxLawId: '1', category: 'G', inferredType: 'gesetz', adaptedTitle: 'A', sourceUrl: 'u1', proposedSlug: 'a', reviewFlags: ['missing-document-date'], listing: { documentDate: '2001-01-01' } },
    { sourceId: '2', revosaxLawId: '2', category: 'ÄG', inferredType: 'aenderungsvorschrift', adaptedTitle: 'B', sourceUrl: 'u2', proposedSlug: 'b', reviewFlags: [], attachments: [{ url: 'https://www.revosax.sachsen.de/attachments/9', label: 'Anlage' }] },
    { sourceId: '3', revosaxLawId: '3', category: 'ÄG', sourceUrl: 'u3', skipReason: 'part-of-envelope:1', envelope: { envelopeLawId: '1', envelopeUrl: 'e1' }, listing: {} },
    { sourceId: '4', revosaxLawId: '4', category: 'VwV', sourceUrl: 'u4', skipReason: 'same-version-alias:4.1' },
    { sourceId: '5', revosaxLawId: '5', category: 'VwV', sourceUrl: 'u5', proposedSlug: 'e', reviewFlags: ['attachment-only-content'] },
  ];
  const report = { baselineDate: '2023-11-01', generatedAt: 't', total: 5, successful: 5, failed: 0, reviewCases: 3, failureCounts: {}, entries };
  const plan = {
    generatedAt: 't', writable: true,
    counts: { CREATE: 2, MATCH: 0, PROTECT: 0, REVIEW: 1, SKIP: 2, DEFERRED: 1 },
    entries: [
      { sourceId: '1', action: 'CREATE', canonicalSlug: 'a' },
      { sourceId: '2', action: 'CREATE', canonicalSlug: 'b' },
      { sourceId: '3', action: 'REVIEW', reason: 'zurückgestellt: x', deferred: true },
      { sourceId: '4', action: 'SKIP', reason: 'Staging: same-version-alias:4.1' },
      { sourceId: '5', action: 'SKIP', reason: 'Entscheidung: nur PDF' },
    ],
  };
  const envelopes = { generatedAt: 't', counts: { A: 0, B: 0, C: 0, D: 1 }, fetchedEnvelopes: [], components: [{ sourceId: '3', lawId: '3', class: 'D', reason: 'Anker fehlt', envelopeLawId: '1', envelopeUrl: 'e1', anchor: 'a2', sourceUrl: 'u3' }] };
  const attachmentsManifest = { attachments: { 9: { sourceId: '2', url: 'https://www.revosax.sachsen.de/attachments/9', objectKey: 'k', verified: true, fileName: 'x.pdf', kind: 'pdf' } } };
  const input = { cacheDir: '/nicht/vorhanden', manifest, report, plan, envelopes, decisions: { decisions: { 5: { action: 'SKIP', reason: 'nur PDF' } } }, r2Manifest: { objects: {} }, attachmentsManifest, materializationReport: { protectedCount: 0 }, residualBacklog: null, preexistingMatches: 0 };
  const first = await buildImportAudit(input);
  const second = await buildImportAudit(input);
  assert.deepEqual(first, second);
  assert.equal(first.summary.balance.sums, 5);
  assert.equal(first.summary.balance.uniqueHits, 5);
  assert.equal(first.summary.balance.reviewDeferred, 1);
  assert.deepEqual(first.skips.byCategory, { 'same-version-alias': 1, 'manual-decision': 1 });
  assert.equal(first.reviewFlags.entries.find((entry) => entry.sourceId === '1').documentDate.source, 'listing');
  assert.equal(first.reviewFlags.entries.find((entry) => entry.sourceId === '2').attachments[0].verified, true);
  assert.equal(first.summary.attachments.referenced, 1);
  assert.equal(first.envelopes.components[0].deferred, true);
});
