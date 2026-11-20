import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNormTextLinkReferences, buildNormTextReferenceIndex } from '@ostrecht/shared/lib/norms/references.ts';
import { getNormUrl } from '@ostrecht/shared/lib/norms/routes.ts';
import { fixtureCorpus } from './helpers/fixture-corpus.ts';

test('Der gemeinsame Textindex löst Gleichnamen erst nach Ausschluss der eigenen Vorschrift auf', () => {
  const federal = buildNormTextLinkReferences([], '')[0];
  function norm(slug: string, abbr: string, shortTitle: string) {
    const norm = structuredClone(fixtureCorpus().norms[0]);
    norm.meta.slug = slug;
    Object.assign(norm.meta, { abbr, shortTitle });
    for (const version of norm.versions) Object.assign(version, { abbr, shortTitle });
    return norm;
  }

  const index = buildNormTextReferenceIndex([
    norm('erstes', 'ABC', federal.label),
    norm('zweites', 'ABC', 'Zweites Muster'),
    norm('drittes', 'DDD', 'DDD'),
  ]);
  assert.deepEqual(index.matching('drittes', ['ABC DDD']), []);
  assert.deepEqual(index.matching('zweites', ['ABC, ABC, ABCD und DDD']), [{ label: 'ABC', url: getNormUrl('erstes') }]);
  assert.deepEqual(index.matching('erstes', ['xABC']), []);
  assert.deepEqual(index.matching('erstes', [federal.label]), [federal]);
  assert.deepEqual(index.matching('zweites', [federal.label]), [{ label: federal.label, url: getNormUrl('erstes') }, federal]);
});
