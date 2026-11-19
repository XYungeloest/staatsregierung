import type { Verkuendung } from '@ostrecht/shared/lib/norms/publications.ts';

import { formatCount } from './counts.ts';

function pageNumbers(value: string | undefined): number[] {
  if (!value) return [];
  return [...value.matchAll(/\d+/gu)].map((match) => Number.parseInt(match[0], 10)).filter((number) => Number.isFinite(number) && number > 0);
}

function lastPage(value: string | undefined): number | undefined {
  const numbers = pageNumbers(value);
  return numbers.length > 0 ? Math.max(...numbers) : undefined;
}

function formatRange(first: number, last: number): string {
  return first === last ? String(first) : `${first}–${last}`;
}

/**
 * Belegter Seitenumfang der ganzen Ausgabe aus ihren Quellen (amtliches PDF oder
 * strukturtragende Fassung), etwa „2–39“. Die Bereiche der Einzelveröffentlichungen sind
 * kein Umfang der Ausgabe.
 */
function documentedIssueRange(publication: Pick<Verkuendung, 'sourceReferences'>): string | undefined {
  const sources = publication.sourceReferences ?? [];
  const preferred = sources.find((source) => source.kind === 'primary-pdf' && source.pageRange)
    ?? sources.find((source) => source.pageRange);
  const numbers = pageNumbers(preferred?.pageRange);
  return numbers.length > 0 ? formatRange(Math.min(...numbers), Math.max(...numbers)) : undefined;
}

/**
 * Seitenangabe einer Ausgabe („Seiten 2–39“): der belegte Umfang aus den Quellen der Ausgabe,
 * sonst von der ersten Anfangsseite bis zur letzten Endseite, wenn jeder Eintrag einen
 * vollständigen Seitenbereich trägt. Ist nur eine Anfangsseite bekannt, nennt die Angabe sie
 * als Beginn („ab 2“), nie als vollständigen Umfang.
 */
export function formatIssuePageRange(publication: Pick<Verkuendung, 'entries' | 'sourceReferences'>): string | undefined {
  const documented = documentedIssueRange(publication);
  if (documented) return documented;
  const starts = publication.entries.flatMap((entry) => pageNumbers(entry.pages ?? entry.startPage).slice(0, 1));
  if (starts.length === 0) return undefined;
  const first = Math.min(...starts);
  if (publication.entries.every((entry) => pageNumbers(entry.pages).length > 0)) {
    return formatRange(first, Math.max(...publication.entries.flatMap((entry) => pageNumbers(entry.pages))));
  }
  return `ab ${first}`;
}

/**
 * Umfang einer Verkündungsausgabe (sim: „BGBl. I Nr. 75 · 12 Seiten“): die Endseite des belegten
 * Umfangs der Ausgabe, sonst die höchste Endseite aller Einträge, wenn jeder Eintrag `pages` oder
 * `startPage` trägt („2–5“ → 5, „S. 3“ → 3), sonst die Zahl der Einträge. Ohne Einträge nichts.
 */
export function formatPublicationExtent(publication: Pick<Verkuendung, 'entries'> & Partial<Pick<Verkuendung, 'sourceReferences'>>): string {
  if (publication.entries.length === 0) return '';
  const documentedLast = lastPage(documentedIssueRange(publication));
  if (documentedLast !== undefined) return formatCount(documentedLast, 'Seite', 'Seiten');
  const pages = publication.entries.map((entry) => lastPage(entry.pages) ?? lastPage(entry.startPage));
  if (pages.every((page): page is number => page !== undefined)) return formatCount(Math.max(...pages), 'Seite', 'Seiten');
  return formatCount(publication.entries.length, 'Eintrag', 'Einträge');
}
