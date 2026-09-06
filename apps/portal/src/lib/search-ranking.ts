/**
 * Bewertung und Ausschnittbildung der Portalsuche. Die Logik steht hier, damit sie ohne Browser
 * mit synthetischen Datensätzen geprüft werden kann (`tests/portal-search-ranking.test.ts`); die
 * Suchseite bindet dieselben Funktionen ein.
 *
 * Reihenfolge der Relevanz:
 * 1. Gleichheit mit einer Bezeichnung (Seitentitel, Bereichsname, Abkürzung einer Vorschrift),
 * 2. Bezeichnung beginnt mit der Anfrage,
 * 3. Bezeichnung enthält die Anfrage,
 * 4. Kurzbeschreibung,
 * 5. Volltext.
 *
 * Portalseiten erhalten darauf einen Bereichsbonus, Bereichseinstiege einen etwas höheren. Er
 * hebt eine Portalseite über gleich gut passende Vorschriften, ohne eine exakt eingegebene
 * Abkürzung zu verdrängen: „Haushalt“ führt zur Haushaltsseite, „OstSchulG“ zur Vorschrift.
 */

export type SearchArea = 'portal' | 'law';

export interface RankableEntry {
  id: string;
  title: string;
  aliases?: string[];
  description: string;
  url: string;
  text: string;
  typeLabel: string;
  date?: string;
  landing?: boolean;
}

export interface ScoredEntry<T extends RankableEntry = RankableEntry> {
  entry: T;
  area: SearchArea;
  score: number;
  /** Wo der Treffer herkommt; steuert, ob ein Ausschnitt aus dem Volltext gezeigt wird. */
  matchedIn: 'title' | 'description' | 'text';
}

const NAME_EQUAL = 100;
const NAME_PREFIX = 60;
const NAME_CONTAINS = 40;
const TERM_IN_NAME = 20;
const TERM_IN_DESCRIPTION = 8;
const TERM_IN_TEXT = 4;
const PORTAL_BONUS = 12;
const PORTAL_LANDING_BONUS = 18;

export function normalizeSearchValue(value: string): string {
  return value
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/ß/gu, 'ss');
}

export function toSearchTerms(query: string): string[] {
  return normalizeSearchValue(query).split(/\s+/u).filter(Boolean);
}

export function scoreEntry(entry: RankableEntry, area: SearchArea, terms: string[], query: string): ScoredEntry | null {
  const names = [entry.title, ...(entry.aliases ?? [])].map(normalizeSearchValue).filter(Boolean);
  const description = normalizeSearchValue(entry.description);
  const text = normalizeSearchValue(entry.text);
  const normalizedQuery = normalizeSearchValue(query).trim();

  let score = 0;
  let matchedIn: ScoredEntry['matchedIn'] | null = null;

  if (normalizedQuery) {
    if (names.some((name) => name === normalizedQuery)) score += NAME_EQUAL;
    else if (names.some((name) => name.startsWith(normalizedQuery))) score += NAME_PREFIX;
    else if (names.some((name) => name.includes(normalizedQuery))) score += NAME_CONTAINS;
    if (score > 0) matchedIn = 'title';
  }

  for (const term of terms) {
    if (names.some((name) => name.includes(term))) {
      score += TERM_IN_NAME;
      matchedIn ??= 'title';
    }
    if (description.includes(term)) {
      score += TERM_IN_DESCRIPTION;
      matchedIn ??= 'description';
    }
    if (text.includes(term)) {
      score += TERM_IN_TEXT;
      matchedIn ??= 'text';
    }
  }

  if (score <= 0 || !matchedIn) return null;
  if (area === 'portal') score += entry.landing ? PORTAL_LANDING_BONUS : PORTAL_BONUS;
  return { entry, area, score, matchedIn };
}

export function rankEntries(
  portal: RankableEntry[],
  law: RankableEntry[],
  query: string,
  { sort = 'relevance' as 'relevance' | 'latest' } = {},
): ScoredEntry[] {
  const terms = toSearchTerms(query);
  const scored = [
    ...portal.map((entry) => scoreEntry(entry, 'portal', terms, query)),
    ...law.map((entry) => scoreEntry(entry, 'law', terms, query)),
  ].filter((value): value is ScoredEntry => value !== null);

  return scored.sort((left, right) => {
    if (sort === 'latest') {
      const byDate = (right.entry.date ?? '').localeCompare(left.entry.date ?? '');
      if (byDate !== 0) return byDate;
    }
    return right.score - left.score || left.entry.title.localeCompare(right.entry.title, 'de');
  });
}

export interface SearchSnippet {
  text: string;
  /** Zeichenbereiche des Ausschnitts, die einen Suchbegriff enthalten. */
  marks: Array<{ start: number; end: number }>;
}

/**
 * Ausschnitt um die erste Fundstelle im Volltext. Er beginnt und endet an Wortgrenzen, ist auf
 * `limit` Zeichen begrenzt und markiert jeden Suchbegriff darin. Ohne Fundstelle bleibt er leer –
 * die Suchseite zeigt dann die Kurzbeschreibung.
 */
export function buildSnippet(text: string, terms: string[], limit = 220): SearchSnippet | null {
  if (!text || terms.length === 0) return null;
  const haystack = normalizeSearchValue(text);
  let first = -1;
  for (const term of terms) {
    const index = haystack.indexOf(term);
    if (index >= 0 && (first < 0 || index < first)) first = index;
  }
  if (first < 0) return null;

  let start = Math.max(0, first - Math.floor(limit / 3));
  if (start > 0) {
    const space = text.indexOf(' ', start);
    start = space >= 0 && space < first ? space + 1 : start;
  }
  let end = Math.min(text.length, start + limit);
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    end = space > first ? space : end;
  }

  const slice = `${start > 0 ? '… ' : ''}${text.slice(start, end).trim()}${end < text.length ? ' …' : ''}`;
  const normalizedSlice = normalizeSearchValue(slice);
  const marks: Array<{ start: number; end: number }> = [];
  for (const term of terms) {
    let index = normalizedSlice.indexOf(term);
    while (index >= 0) {
      marks.push({ start: index, end: index + term.length });
      index = normalizedSlice.indexOf(term, index + term.length);
    }
  }
  marks.sort((left, right) => left.start - right.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const mark of marks) {
    const last = merged[merged.length - 1];
    if (last && mark.start <= last.end) last.end = Math.max(last.end, mark.end);
    else merged.push({ ...mark });
  }
  return { text: slice, marks: merged };
}
