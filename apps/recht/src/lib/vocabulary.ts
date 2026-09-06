// apps/recht/src/lib/vocabulary.ts – Anzeigehelfer über der zentralen Wortliste (außerhalb des D1-Abschlusses).
import { lawSiteConfig } from '@ostrecht/shared/config/site.ts';
import { formatDate } from '@ostrecht/shared/lib/norms/display.ts';
import type { NormStatus } from '@ostrecht/shared/lib/norms/schema.ts';
import { EDITORIAL_REFERENCE_DATE, type VersionTemporalKind } from '@ostrecht/shared/lib/norms/versions.ts';

const vocabulary = lawSiteConfig.vocabulary;

export const VALIDITY_FIELD_LABEL = vocabulary.validity.label;
export const VERSION_FIELD_LABEL = vocabulary.version.label;
export const LEGAL_STATUS_FIELD_LABEL = vocabulary.legalStatus.label;
export const NORM_HISTORY_LABEL = vocabulary.normHistory;
export const NORM_COMPARE_LABEL = vocabulary.normCompare;
export const NORM_CURRENT_LABEL = vocabulary.normCurrent;

/** Geltung einer Vorschrift als Wort der Wortliste. */
export function validityLabel(status: NormStatus): string {
  return vocabulary.validity.byStatus[status];
}

export interface ValidityOption {
  value: string;
  label: string;
  statuses: NormStatus[];
}

/** Optionen eines Geltungsfilters: gleiche Wörter werden zu einer Option zusammengefasst, feste Reihenfolge. */
export function validityOptions(statuses: readonly NormStatus[]): ValidityOption[] {
  const order = ['in Kraft', 'künftig in Kraft', 'außer Kraft', 'einmaliger Rechtsakt', 'Inkrafttreten nicht belegt', 'nicht verkündet'];
  const groups = new Map<string, NormStatus[]>();
  for (const status of statuses) {
    const label = validityLabel(status);
    const list = groups.get(label) ?? [];
    if (!list.includes(status)) list.push(status);
    groups.set(label, list);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => order.indexOf(left) - order.indexOf(right))
    .map(([label, members]) => ({ value: members[0], label, statuses: members }));
}

/** Fassungsart als Wort der Wortliste (Singular, Plural oder Adjektiv). */
export function versionKindLabel(kind: VersionTemporalKind, form: 'one' | 'many' | 'adjective' = 'one'): string {
  return vocabulary.version.byKind[kind][form];
}

export const VERSION_SCOPE_OPTIONS: ReadonlyArray<{ value: VersionTemporalKind | 'all'; label: string }> = [
  { value: 'current', label: vocabulary.version.byKind.current.many },
  { value: 'future', label: vocabulary.version.byKind.future.many },
  { value: 'historical', label: vocabulary.version.byKind.historical.many },
  { value: 'unknown-effective', label: vocabulary.version.byKind['unknown-effective'].many },
  { value: 'all', label: vocabulary.version.any },
];

/** „Rechtsstand vom 4. September 2026“ – an jedem Aufruftag zutreffend, keine Tagesaussage. */
export function referenceDateLabel(referenceDate: string = EDITORIAL_REFERENCE_DATE): string {
  return `${vocabulary.legalStatus.asOf} ${formatDate(referenceDate)}`;
}
