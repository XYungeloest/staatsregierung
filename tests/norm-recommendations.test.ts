import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRelatedNormRecommendationIndex,
  getRelatedNormRecommendations,
  type NormRelationKind,
} from '@ostrecht/shared/lib/norms/references.ts';
import type { NormRecord, NormType } from '@ostrecht/shared/lib/norms/schema.ts';

function norm(
  slug: string,
  options: {
    abbr?: string;
    body?: string;
    ministry?: string;
    subjects?: string[];
    type?: NormType;
    relatedNorm?: string;
    earlierAbbr?: string;
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
      ...(options.earlierAbbr
        ? [{
            versionId: '2025-01-01',
            validFrom: '2025-01-01',
            validTo: '2025-12-31',
            isCurrent: false,
            citation: 'Testfundstelle',
            changeNote: 'Frühere Fassung',
            abbr: options.earlierAbbr,
            body: [{ type: 'paragraphText' as const, text: 'Frühere Regelung.' }],
          }]
        : []),
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

test('Abkürzungen gelten nur als ganzes Wort als Erwähnung, auch in früherer Fassung', () => {
  const target = norm('ziel', { abbr: 'ZielG', earlierAbbr: 'OstZielG', subjects: ['Zielgebiet'] });
  const inWord = norm('wortteil', { subjects: ['Wortgebiet A'], body: 'Die Prüfung erfasst die Gesamtzielgruppe und die Netzwerk-OstZielGruppe.' });
  const asWord = norm('ganzes-wort', { subjects: ['Wortgebiet B'], body: 'Zuständig ist die Stelle nach § 2 ZielG.' });
  const earlier = norm('fruehere-bezeichnung', { subjects: ['Wortgebiet C'], body: 'Die Frist richtet sich nach § 3 Abs. 1 OstZielG.' });
  const norms = [target, inWord, asWord, earlier];

  assert.deepEqual(getRelatedNormRecommendations(inWord, norms), []);
  assert.deepEqual(
    getRelatedNormRecommendations(asWord, norms).map((entry) => [entry.norm.meta.slug, entry.relation]),
    [['ziel', 'verweist auf']],
  );
  assert.deepEqual(
    getRelatedNormRecommendations(earlier, norms).map((entry) => [entry.norm.meta.slug, entry.relation]),
    [['ziel', 'verweist auf']],
  );
  const index = buildRelatedNormRecommendationIndex(norms);
  for (const entry of norms) {
    assert.deepEqual(
      (index.get(entry.meta.slug) ?? []).map((item) => [item.slug, item.relation, item.score]),
      getRelatedNormRecommendations(entry, norms).map((item) => [item.norm.meta.slug, item.relation, item.score]),
      entry.meta.slug,
    );
  }
});
