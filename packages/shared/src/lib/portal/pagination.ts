/**
 * Seitenrechnung der langen Datenansichten des Staatsportals. Beteiligungsnavigator und
 * Kreis-/Bezirkstabelle blättern dieselbe Art Daten und teilen sich deshalb Rechnung, Wortlaut
 * und Zustand der Schaltflächen; die Darstellung liegt in `DataPagination.astro`.
 */

export const DEFAULT_PORTAL_PAGE_SIZE = 25;

export interface PageState {
  page: number;
  pageCount: number;
  /** Nullbasierter Index der ersten Zeile dieser Seite. */
  start: number;
  /** Exklusiver Index hinter der letzten Zeile dieser Seite. */
  end: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  /** „26–50“ beziehungsweise „0“, wenn nichts passt. */
  rangeLabel: string;
  /** „Seite 2 von 5“. */
  pageLabel: string;
}

export function getPageState(total: number, page: number, perPage = DEFAULT_PORTAL_PAGE_SIZE): PageState {
  const size = Math.max(1, Math.floor(perPage));
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * size;
  const end = Math.min(start + size, Math.max(0, total));
  return {
    page: current,
    pageCount,
    start,
    end,
    total: Math.max(0, total),
    hasPrevious: current > 1,
    hasNext: current < pageCount,
    rangeLabel: total === 0 ? '0' : `${start + 1}–${end}`,
    pageLabel: `Seite ${current} von ${pageCount}`,
  };
}
