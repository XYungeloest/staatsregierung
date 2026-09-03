import { getGermanIndexLetter, getSubjectSlug } from '@ostrecht/shared/lib/norms/routes.ts';

import { compareSummaryTitles, type NormSummary } from './store.ts';

/**
 * Gruppierungen für Übersichtsseiten auf Basis von NormSummary-Zeilen. Sie ersetzen
 * getIndexGroups/getSubjectGroups aus der Shared-Bibliothek, die vollständige
 * NormRecord-Datensätze erwarten; die Sortierung nach dem Titel der geltenden
 * Fassung ist identisch.
 */

export interface SummaryLetterGroup {
  letter: string;
  norms: NormSummary[];
}

export interface SummarySubjectGroup {
  name: string;
  slug: string;
  norms: NormSummary[];
}

export function groupSummariesByLetter(summaries: NormSummary[]): SummaryLetterGroup[] {
  const groups = new Map<string, NormSummary[]>();
  for (const summary of summaries) {
    const key = getGermanIndexLetter(summary.title);
    const list = groups.get(key) ?? [];
    list.push(summary);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([letter, norms]) => ({ letter, norms: [...norms].sort(compareSummaryTitles) }));
}

export function groupSummariesBySubject(summaries: NormSummary[]): SummarySubjectGroup[] {
  const groups = new Map<string, SummarySubjectGroup>();
  for (const summary of summaries) {
    for (const subject of summary.subjects) {
      const slug = getSubjectSlug(subject);
      const existing = groups.get(slug);
      if (existing) {
        existing.norms.push(summary);
        continue;
      }
      groups.set(slug, { name: subject, slug, norms: [summary] });
    }
  }
  return [...groups.values()]
    .map((group) => ({ ...group, norms: [...group.norms].sort(compareSummaryTitles) }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
