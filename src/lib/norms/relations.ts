import type { NormRecord } from './schema.ts';

export const NORM_RELATION_KINDS = [
  'amends',
  'amended-by',
  'enacts',
  'enacted-by',
  'repeals',
  'repealed-by',
  'predecessor',
  'successor',
] as const;

export type NormRelationKind = (typeof NORM_RELATION_KINDS)[number];

export interface NormRelation {
  kind: NormRelationKind;
  norm: NormRecord;
  date?: string;
  citation?: string;
  resultingNorm?: NormRecord;
  resultingVersionId?: string;
}

export type NormRelationLookup = Map<string, NormRelation[]>;

function relationKey(relation: NormRelation): string {
  return [
    relation.kind,
    relation.norm.meta.slug,
    relation.date,
    relation.resultingNorm?.meta.slug,
    relation.resultingVersionId,
  ].join(':');
}

export function buildNormRelations(records: NormRecord[]): NormRelationLookup {
  const recordsBySlug = new Map(records.map((record) => [record.meta.slug, record]));
  const relations: NormRelationLookup = new Map(records.map((record) => [record.meta.slug, []]));
  const knownRelations = new Map(records.map((record) => [record.meta.slug, new Set<string>()]));

  const add = (owner: NormRecord, relation: NormRelation): void => {
    if (owner.meta.slug === relation.norm.meta.slug) return;
    const key = relationKey(relation);
    const known = knownRelations.get(owner.meta.slug)!;
    if (known.has(key)) return;
    known.add(key);
    relations.get(owner.meta.slug)!.push(relation);
  };

  const addPair = (
    left: NormRecord,
    leftKind: NormRelationKind,
    right: NormRecord,
    rightKind: NormRelationKind,
    details: Omit<NormRelation, 'kind' | 'norm'> = {},
  ): void => {
    add(left, { kind: leftKind, norm: right, ...details });
    add(right, { kind: rightKind, norm: left, ...details });
  };

  for (const record of records) {
    if (record.meta.enactingNorm) {
      const parent = recordsBySlug.get(record.meta.enactingNorm);
      if (parent) addPair(record, 'enacted-by', parent, 'enacts', { resultingNorm: record });
    }

    for (const targetSlug of [record.meta.enactedNorm, ...(record.meta.enactedNorms ?? [])].filter(Boolean) as string[]) {
      const target = recordsBySlug.get(targetSlug);
      if (target) addPair(record, 'enacts', target, 'enacted-by', { resultingNorm: target });
    }

    if (record.meta.predecessorSlug) {
      const predecessor = recordsBySlug.get(record.meta.predecessorSlug);
      if (predecessor) addPair(record, 'predecessor', predecessor, 'successor');
    }
    if (record.meta.successorSlug) {
      const successor = recordsBySlug.get(record.meta.successorSlug);
      if (successor) addPair(record, 'successor', successor, 'predecessor');
    }
  }

  for (const target of records) {
    for (const entry of target.history.entries) {
      if (!entry.relatedNorm || (entry.type !== 'amendment' && entry.type !== 'repeal')) continue;
      const act = recordsBySlug.get(entry.relatedNorm);
      if (!act) continue;
      const details = {
        date: entry.date,
        citation: entry.citation,
        resultingNorm: target,
        resultingVersionId: entry.affectingVersionId ?? undefined,
      };
      addPair(
        target,
        entry.type === 'repeal' ? 'repealed-by' : 'amended-by',
        act,
        entry.type === 'repeal' ? 'repeals' : 'amends',
        details,
      );
    }
  }

  for (const act of records) {
    for (const targetSlug of act.meta.affectedNorms ?? []) {
      const target = recordsBySlug.get(targetSlug);
      if (!target) continue;
      const historyEntry = target.history.entries.find((entry) =>
        entry.relatedNorm === act.meta.slug
        && (entry.type === 'amendment' || entry.type === 'repeal'),
      );
      if (historyEntry) continue;
      addPair(act, 'amends', target, 'amended-by', { resultingNorm: target });
    }
    for (const actSlug of act.meta.affectedByNorms ?? []) {
      const affectingAct = recordsBySlug.get(actSlug);
      if (!affectingAct) continue;
      const historyEntry = act.history.entries.find((entry) =>
        entry.relatedNorm === affectingAct.meta.slug
        && (entry.type === 'amendment' || entry.type === 'repeal'),
      );
      if (historyEntry) continue;
      addPair(act, 'amended-by', affectingAct, 'amends', { resultingNorm: act });
    }
  }

  for (const entries of relations.values()) {
    entries.sort((left, right) =>
      (left.date ?? '').localeCompare(right.date ?? '')
      || left.norm.meta.title.localeCompare(right.norm.meta.title, 'de'),
    );
  }

  return relations;
}
