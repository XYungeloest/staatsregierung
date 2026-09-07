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

/**
 * Normalisierter Text mit Rückabbildung auf den Originaltext.
 *
 * `normalizeSearchValue` ändert die Länge: `ß` wird zu `ss`, ein zerlegter Umlaut verliert sein
 * kombinierendes Zeichen. Wer eine Fundstelle im normalisierten Text sucht und ihren Index auf den
 * Originaltext anwendet, markiert deshalb die falsche Stelle. Diese Abbildung nennt zu jedem
 * normalisierten Zeichen den Originalbereich, aus dem es entstanden ist.
 *
 * `starts[i]` ist der Beginn dieses Bereichs, `ends[i]` sein Ende (ausschließlich). Beide sind
 * nötig, weil die Abbildung in beide Richtungen mehrstellig ist: `ß` → `ss` ist eins zu zwei,
 * `u` + U+0308 → `u` ist zwei zu eins. Ein normalisierter Bereich [a, b) wird deshalb zu
 * `{ start: starts[a], end: ends[b - 1] }` – nie zu `starts[b]`, das wäre der Anfang des
 * folgenden Bereichs. Der zusätzliche letzte Eintrag beider Felder ist die Textlänge.
 */
export interface NormalizedIndex {
  value: string;
  starts: number[];
  ends: number[];
}

const COMBINING_MARK = /^\p{M}$/u;
/**
 * Kleiner Zwischenspeicher der Clusternormalisierung. Deutscher Fließtext besteht aus wenigen
 * hundert verschiedenen Zeichen; ohne ihn kostete jede Fundstelle vier String-Operationen je
 * Zeichen statt je Zeichenart.
 */
const clusterCache = new Map<string, string>();

function codePointWidth(text: string, at: number): number {
  return (text.codePointAt(at) ?? 0) > 0xffff ? 2 : 1;
}

function codePointAt(text: string, at: number): string {
  return String.fromCodePoint(text.codePointAt(at) ?? 0);
}

function normalizeCluster(cluster: string): string {
  const cached = clusterCache.get(cluster);
  if (cached !== undefined) return cached;
  const value = normalizeSearchValue(cluster);
  if (clusterCache.size < 4096) clusterCache.set(cluster, value);
  return value;
}

/**
 * Normalisiert zeichenweise und merkt sich dabei die Herkunft. Ein Cluster ist eine Basis mit
 * allen unmittelbar folgenden kombinierenden Zeichen: Die kanonische Ordnung von NFD sortiert nur
 * innerhalb einer solchen Folge um, deshalb liefert die Normalisierung eines Clusters dasselbe
 * Ergebnis wie die Normalisierung des ganzen Textes. Wo das ausnahmsweise nicht gilt (die
 * kontextabhängige Kleinschreibung des griechischen Schluss-Sigma), fällt es dem Vergleich mit
 * `normalizeSearchValue` in `findTermRanges` auf.
 */
export function normalizeWithIndex(original: string): NormalizedIndex {
  const pieces: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let at = 0;
  while (at < original.length) {
    let next = at;
    // Verwaiste kombinierende Zeichen am Textanfang gehören zum folgenden Cluster.
    while (next < original.length && COMBINING_MARK.test(codePointAt(original, next))) next += codePointWidth(original, next);
    if (next < original.length) next += codePointWidth(original, next);
    while (next < original.length && COMBINING_MARK.test(codePointAt(original, next))) next += codePointWidth(original, next);
    const piece = normalizeCluster(original.slice(at, next));
    for (let index = 0; index < piece.length; index += 1) {
      starts.push(at);
      ends.push(next);
    }
    pieces.push(piece);
    at = next;
  }
  starts.push(original.length);
  ends.push(original.length);
  return { value: pieces.join(''), starts, ends };
}

/**
 * Alle Fundstellen der Begriffe als Bereiche im **Originaltext**, sortiert und verschmolzen.
 * Weicht die clusterweise Normalisierung ausnahmsweise von der Normalisierung des ganzen Textes
 * ab, gibt es keine Bereiche: eine fehlende Markierung ist besser als eine falsche.
 */
export function findTermRanges(text: string, terms: string[]): Array<{ start: number; end: number }> {
  if (!text || terms.length === 0) return [];
  const index = normalizeWithIndex(text);
  if (index.value !== normalizeSearchValue(text)) return [];
  const found: Array<{ start: number; end: number }> = [];
  for (const term of terms) {
    if (!term) continue;
    let at = index.value.indexOf(term);
    while (at >= 0) {
      found.push({ start: index.starts[at], end: index.ends[at + term.length - 1] });
      at = index.value.indexOf(term, at + term.length);
    }
  }
  found.sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of found) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
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
 *
 * Alle Indexrechnungen laufen in den Koordinaten des Originaltextes (`findTermRanges`). Nur so
 * stimmen Fenstergrenzen und Markierungen zusammen: Fundstellen im normalisierten Text und
 * Wortgrenzen im Original sind zwei verschiedene Koordinatensysteme, sobald ein `ß` oder ein
 * zerlegter Umlaut im Spiel ist.
 */
export function buildSnippet(text: string, terms: string[], limit = 220): SearchSnippet | null {
  if (!text || terms.length === 0) return null;
  const hits = findTermRanges(text, terms);
  if (hits.length === 0) return null;
  const first = hits[0];

  let start = Math.max(0, first.start - Math.floor(limit / 3));
  let end = Math.min(text.length, start + limit);
  // Passt die erste Fundstelle nicht mehr ins Fenster, wird das Fenster an ihr Ende gelegt;
  // die Länge bleibt dabei begrenzt.
  if (first.end > end && first.end - first.start <= limit) {
    end = Math.min(text.length, first.end);
    start = Math.max(0, end - limit);
  }
  if (start > 0) {
    const space = text.indexOf(' ', start);
    if (space >= 0 && space < first.start) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > first.end) end = space;
  }
  const cutLeft = start > 0;
  const cutRight = end < text.length;
  // Randweißraum gehört aus dem Fenster genommen, nicht nachträglich abgeschnitten: ein Schnitt
  // am fertigen Ausschnitt verschöbe jede Markierung.
  while (start < end && /\s/u.test(text[start])) start += 1;
  while (end > start && /\s/u.test(text[end - 1])) end -= 1;

  const prefix = cutLeft ? '… ' : '';
  const suffix = cutRight ? ' …' : '';
  const marks: Array<{ start: number; end: number }> = [];
  for (const hit of hits) {
    // Nur vollständig sichtbare Fundstellen werden markiert; ein halbes Wort am Rand nicht.
    if (hit.start < start || hit.end > end) continue;
    marks.push({ start: prefix.length + hit.start - start, end: prefix.length + hit.end - start });
  }
  return { text: `${prefix}${text.slice(start, end)}${suffix}`, marks };
}
