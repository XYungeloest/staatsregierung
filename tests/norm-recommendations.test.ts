import assert from 'node:assert/strict';
import test from 'node:test';

import { loadAllNorms } from '../src/lib/norms/loader.ts';
import {
  getRelatedNormRecommendations,
  type NormRelationKind,
} from '../src/lib/norms/references.ts';
import type { NormRecord, NormType } from '../src/lib/norms/schema.ts';

function norm(
  slug: string,
  options: {
    abbr?: string;
    body?: string;
    ministry?: string;
    subjects?: string[];
    type?: NormType;
    relatedNorm?: string;
  } = {},
): NormRecord {
  return {
    meta: {
      id: slug,
      slug,
      title: `Gesetz ${slug}`,
      shortTitle: `Gesetz ${slug}`,
      abbr: options.abbr ?? slug.toUpperCase(),
      type: options.type ?? 'gesetz',
      ministry: options.ministry ?? 'Testressort',
      subjects: options.subjects ?? ['Allgemeines Testgebiet'],
      keywords: [],
      initialCitation: 'Testfundstelle',
      predecessor: null,
      successor: null,
      summary: 'Testzusammenfassung',
      status: 'in-force',
    },
    history: {
      initialVersionId: '2026-01-01',
      entries: [
        {
          date: '2026-01-01',
          type: 'initial',
          title: 'Stammfassung',
          citation: 'Testfundstelle',
          relatedNorm: options.relatedNorm,
        },
      ],
    },
    versions: [
      {
        versionId: '2026-01-01',
        validFrom: '2026-01-01',
        validTo: null,
        isCurrent: true,
        citation: 'Testfundstelle',
        changeNote: 'Stammfassung',
        body: [{ type: 'paragraphText', text: options.body ?? 'Eigenständige Regelung.' }],
      },
    ],
  };
}

test('eine bloße Ressort- oder allgemeine Sachgebietsübereinstimmung reicht nicht aus', () => {
  const source = norm('quelle');
  const unrelated = norm('unabhaengig');
  const sameBroadSubject = [1, 2, 3, 4].map((index) => norm(`vergleich-${index}`));
  const ministryOnly = norm('nur-ressort', { subjects: ['Anderes Testgebiet'] });

  assert.deepEqual(
    getRelatedNormRecommendations(source, [source, unrelated, ...sameBroadSubject, ministryOnly]),
    [],
  );
});

test('ausdrückliche und textliche Beziehungen werden nachvollziehbar bezeichnet', () => {
  const source = norm('quelle', { abbr: 'QuellG' });
  const amendment = norm('aenderung', {
    abbr: 'ÄndG',
    type: 'aenderungsvorschrift',
    relatedNorm: source.meta.slug,
  });
  const ordinance = norm('ausfuehrung', {
    abbr: 'QuellV',
    type: 'verordnung',
    body: 'Diese Verordnung führt das QuellG aus.',
  });

  const relations = new Map<string, NormRelationKind>(
    getRelatedNormRecommendations(source, [source, amendment, ordinance]).map((entry) => [
      entry.norm.meta.slug,
      entry.relation,
    ]),
  );

  assert.equal(relations.get('aenderung'), 'ändert');
  assert.equal(relations.get('ausfuehrung'), 'führt aus');
});

test('beim Bildungsfreistellungsgesetz erscheinen keine zufälligen Ressortempfehlungen', async () => {
  const norms = await loadAllNorms();
  const source = norms.find(
    (entry) =>
      entry.meta.slug ===
      'gesetz-uber-den-anspruch-auf-bildungsfreistellung-im-freistaat-ostdeutschland',
  );
  assert.ok(source);

  const slugs = getRelatedNormRecommendations(source, norms).map((entry) => entry.norm.meta.slug);
  assert.ok(!slugs.some((slug) => /auszeichnung|familienstartdarlehen|meisterkredit/u.test(slug)));
});
