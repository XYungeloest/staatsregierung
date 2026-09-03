import assert from 'node:assert/strict';
import test from 'node:test';

import { buildNormRelations, NORM_RELATION_KINDS } from '@ostrecht/shared/lib/norms/relations.ts';
import { parseNormMeta, type NormRecord } from '@ostrecht/shared/lib/norms/schema.ts';

function meta(overrides: Record<string, unknown>) {
  return parseNormMeta({
    id: 'x',
    slug: 'x',
    title: 'Titel',
    shortTitle: 'Titel',
    type: 'gesetz',
    subjects: ['Landesrecht'],
    keywords: ['Titel'],
    initialCitation: 'Titel vom 1. Januar 2000 (OGVBl. S. 1)',
    predecessor: null,
    successor: null,
    summary: 'Enthält die Regelungen der übernommenen Ausgangsfassung.',
    status: 'in-force',
    ...overrides,
  }, 'test/meta.json');
}

function record(slug: string, overrides: Record<string, unknown> = {}): NormRecord {
  return {
    meta: meta({ id: slug, slug, ...overrides }),
    history: { initialVersionId: '2023-11-01', entries: [] },
    versions: [{ versionId: '2023-11-01', validFrom: '2023-11-01', validTo: null, isCurrent: true, citation: 'x', changeNote: 'y', body: [] }],
  } as unknown as NormRecord;
}

test('originEnactingBody und containedIn werden als Provenienz- bzw. Beziehungsfelder gelesen', () => {
  const parsed = meta({ originEnactingBody: 'Sächsischer Landtag', containedIn: 'ostdeutsches-verwaltungsmodernisierungsgesetz' });
  assert.equal(parsed.originEnactingBody, 'Sächsischer Landtag');
  assert.equal(parsed.enactingBody, undefined);
  assert.equal(parsed.containedIn, 'ostdeutsches-verwaltungsmodernisierungsgesetz');
  assert.throws(() => meta({ containedIn: 'Kein Slug!' }), /containedIn/u);
});

test('ein Artikel einer Mantelvorschrift ist part-of, die Mantelvorschrift contains', () => {
  assert.ok(NORM_RELATION_KINDS.includes('part-of'));
  assert.ok(NORM_RELATION_KINDS.includes('contains'));
  const envelope = record('mantel', { type: 'gesetz' });
  const component = record('aend-ostpersvg', { type: 'aenderungsvorschrift', status: 'one-time-act', containedIn: 'mantel' });
  const orphan = record('aend-ohne-mantel', { type: 'aenderungsvorschrift', status: 'one-time-act', containedIn: 'nicht-vorhanden' });
  const relations = buildNormRelations([envelope, component, orphan]);
  assert.deepEqual(relations.get('aend-ostpersvg')!.map((relation) => [relation.kind, relation.norm.meta.slug]), [['part-of', 'mantel']]);
  assert.deepEqual(relations.get('mantel')!.map((relation) => [relation.kind, relation.norm.meta.slug]), [['contains', 'aend-ostpersvg']]);
  assert.deepEqual(relations.get('aend-ohne-mantel'), []);
});
