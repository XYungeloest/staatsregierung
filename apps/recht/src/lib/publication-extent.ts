import type { Verkuendung } from '@ostrecht/shared/lib/norms/publications.ts';

import { formatCount } from './counts.ts';

/**
 * Umfang einer Verkündungsausgabe (sim: „BGBl. I Nr. 75 · 12 Seiten“): die höchste Endseite aller
 * Einträge, wenn jeder Eintrag `pages` oder `startPage` trägt („2–5“ → 5, „S. 3“ → 3), sonst die
 * Zahl der Einträge. Ohne Einträge nichts.
 */
function lastPage(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const numbers = [...value.matchAll(/\d+/gu)].map((match) => Number.parseInt(match[0], 10)).filter((number) => Number.isFinite(number) && number > 0);
  return numbers.length > 0 ? Math.max(...numbers) : undefined;
}

export function formatPublicationExtent(publication: Pick<Verkuendung, 'entries'>): string {
  if (publication.entries.length === 0) return '';
  const pages = publication.entries.map((entry) => lastPage(entry.pages) ?? lastPage(entry.startPage));
  if (pages.every((page): page is number => page !== undefined)) return formatCount(Math.max(...pages), 'Seite', 'Seiten');
  return formatCount(publication.entries.length, 'Eintrag', 'Einträge');
}
