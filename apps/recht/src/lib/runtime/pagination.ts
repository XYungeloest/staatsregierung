/**
 * Seitennavigation für Übersichten, die serverseitig filtern und paginieren (A–Z,
 * Rechtsentwicklung). Reine Funktionen; die URLs tragen alle Filter als Query-Parameter,
 * damit Seiten ohne JavaScript, mit Vor/Zurück und als Lesezeichen funktionieren.
 */

export interface PaginationEntry {
  kind: 'page' | 'gap';
  page: number;
  href: string;
  current: boolean;
}

export interface Pagination {
  page: number;
  pageCount: number;
  prev: string | undefined;
  next: string | undefined;
  pages: PaginationEntry[];
}

export const DEFAULT_PAGE_PARAM = 'seite';

/**
 * URL mit Query-Parametern; leere Werte entfallen. Die erste Seite wird nicht geschrieben –
 * für jeden Seitenparameter (`seite`, `stichwortseite`, `abkuerzungsseite`), damit unabhängige
 * Paginierungen derselben Seite ihren jeweiligen Zustand behalten.
 */
export function pageUrl(basePath: string, params: Record<string, string | number | undefined>, pageParams: readonly string[] = [DEFAULT_PAGE_PARAM, 'stichwortseite', 'abkuerzungsseite']): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const text = value === undefined ? '' : String(value).trim();
    if (!text || (pageParams.includes(key) && text === '1')) continue;
    search.set(key, text);
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * Seitenliste mit Auslassungen: erste, letzte, aktuelle ± 2 Seiten. `pageParam` benennt den
 * Query-Parameter dieser Paginierung; alle übrigen Parameter (auch eine zweite Paginierung
 * wie `stichwortseite`) bleiben in `params` unverändert erhalten.
 */
export function buildPagination({ page, pageCount, basePath, params = {}, pageParam = DEFAULT_PAGE_PARAM }: { page: number; pageCount: number; basePath: string; params?: Record<string, string | number | undefined>; pageParam?: string }): Pagination {
  const total = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), total);
  const href = (target: number): string => pageUrl(basePath, { ...params, [pageParam]: target });
  const wanted = new Set<number>([1, total]);
  for (let offset = -2; offset <= 2; offset += 1) {
    const candidate = current + offset;
    if (candidate >= 1 && candidate <= total) wanted.add(candidate);
  }
  const pages: PaginationEntry[] = [];
  let previous = 0;
  for (const number of [...wanted].sort((left, right) => left - right)) {
    if (number - previous > 1) pages.push({ kind: 'gap', page: previous + 1, href: href(previous + 1), current: false });
    pages.push({ kind: 'page', page: number, href: href(number), current: number === current });
    previous = number;
  }
  return {
    page: current,
    pageCount: total,
    prev: current > 1 ? href(current - 1) : undefined,
    next: current < total ? href(current + 1) : undefined,
    pages,
  };
}
