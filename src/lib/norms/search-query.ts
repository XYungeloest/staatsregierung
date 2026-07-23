import type { SearchIndexDocument } from './search.ts';
import type { VersionTemporalKind } from './versions.ts';

export type SearchScope = 'all' | 'title' | 'metadata' | 'body';
export type VersionScope = VersionTemporalKind | 'all';
export type SortKey = 'relevance' | 'title' | 'rechtsstand';

export interface NormSearchState {
  q: string;
  exclude: string;
  exact: string;
  scope: SearchScope;
  types: string[];
  ministries: string[];
  subjects: string[];
  statuses: string[];
  versionScope: VersionScope;
  includeAmendments: boolean;
  geltungstag: string;
  validFrom: string;
  validTo: string;
  citation: string;
  publicationSources: string[];
  publicationYears: string[];
  publicationIssue: string;
  publicationPage: string;
  sort: SortKey;
}

export interface ScoredSearchResult {
  documentEntry: SearchIndexDocument;
  score: number;
}

export function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9*]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export interface QueryToken {
  value: string;
  prefix: boolean;
}

export function parseQueryTokens(value: string): QueryToken[] {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];
  return [...new Set(normalized.split(' '))]
    .map((token) => ({
      value: token.replace(/\*+$/u, ''),
      prefix: token.endsWith('*'),
    }))
    .filter((token) => token.value.length > 0);
}

function tokenMatches(text: string, token: QueryToken): boolean {
  if (!token.prefix) return text.includes(token.value);
  return text.split(' ').some((word) => word.startsWith(token.value));
}

function normalizedFields(documentEntry: SearchIndexDocument): Record<SearchScope, string> {
  const title = normalizeSearchText(
    [documentEntry.title, documentEntry.shortTitle, documentEntry.abbr].join(' '),
  );
  const metadata = normalizeSearchText(
    [
      documentEntry.typeLabel,
      documentEntry.ministry,
      ...documentEntry.subjects,
      ...documentEntry.keywords,
      documentEntry.statusLabel,
      documentEntry.summary,
      documentEntry.initialCitation,
      documentEntry.citation,
      documentEntry.publication,
      documentEntry.publicationTitle,
      documentEntry.publicationDate,
      documentEntry.publicationIssue,
      documentEntry.publicationPage,
      documentEntry.changeNote,
    ].join(' '),
  );
  const body = normalizeSearchText(documentEntry.bodyText);
  return { all: `${title} ${metadata} ${body}`.trim(), title, metadata, body };
}

function anySelected(selected: string[], value: string): boolean {
  return selected.length === 0 || selected.includes(value);
}

function anySubjectSelected(selected: string[], values: string[]): boolean {
  return selected.length === 0 || selected.some((value) => values.includes(value));
}

function isDateInRange(date: string, start: string, end: string | null): boolean {
  return start <= date && (!end || date <= end);
}

export function matchesNormSearchFilters(
  documentEntry: SearchIndexDocument,
  state: NormSearchState,
): boolean {
  if (!state.includeAmendments && documentEntry.isAmendment) return false;
  if (!anySelected(state.types, documentEntry.type)) return false;
  if (!anySelected(state.ministries, documentEntry.ministry)) return false;
  if (!anySubjectSelected(state.subjects, documentEntry.subjects)) return false;
  if (!anySelected(state.statuses, documentEntry.status)) return false;
  if (state.versionScope !== 'all' && documentEntry.versionKind !== state.versionScope) return false;
  if (state.geltungstag && !isDateInRange(state.geltungstag, documentEntry.validFrom, documentEntry.validTo)) return false;
  if (state.validFrom && documentEntry.validTo && documentEntry.validTo < state.validFrom) return false;
  if (state.validTo && documentEntry.validFrom > state.validTo) return false;
  if (!anySelected(state.publicationSources, documentEntry.publicationSource ?? '')) return false;
  if (!anySelected(state.publicationYears, documentEntry.publicationYear ?? '')) return false;
  if (state.publicationIssue && normalizeSearchText(documentEntry.publicationIssue ?? '') !== normalizeSearchText(state.publicationIssue)) return false;
  if (state.publicationPage && !normalizeSearchText(documentEntry.publicationPage ?? '').includes(normalizeSearchText(state.publicationPage))) return false;

  if (state.citation) {
    const citation = normalizeSearchText([
      documentEntry.citation,
      documentEntry.initialCitation,
      documentEntry.publication,
      documentEntry.publicationTitle,
      documentEntry.publicationDate,
      documentEntry.publicationIssue,
      documentEntry.publicationPage,
    ].join(' '));
    if (!parseQueryTokens(state.citation).every((token) => tokenMatches(citation, token))) return false;
  }

  return true;
}

export function scoreNormSearchDocument(
  documentEntry: SearchIndexDocument,
  state: NormSearchState,
): number {
  const fields = normalizedFields(documentEntry);
  const searchable = fields[state.scope];
  const tokens = parseQueryTokens(state.q);
  if (!tokens.every((token) => tokenMatches(searchable, token))) return -1;

  const exact = normalizeSearchText(state.exact).replaceAll('*', '');
  if (exact && !searchable.includes(exact)) return -1;
  const excluded = parseQueryTokens(state.exclude);
  if (excluded.some((token) => tokenMatches(fields.all, token))) return -1;

  let score = 0;
  for (const token of tokens) {
    if (tokenMatches(normalizeSearchText(documentEntry.abbr), token)) score += 18;
    if (tokenMatches(fields.title, token)) score += 14;
    if (tokenMatches(fields.metadata, token)) score += 6;
    if (tokenMatches(fields.body, token)) score += 2;
  }
  if (documentEntry.versionKind === 'current') score += 2;
  return score;
}

export function compareNormSearchResults(
  left: ScoredSearchResult,
  right: ScoredSearchResult,
  sort: SortKey,
): number {
  if (sort === 'title') {
    return left.documentEntry.title.localeCompare(right.documentEntry.title, 'de')
      || right.documentEntry.validFrom.localeCompare(left.documentEntry.validFrom);
  }
  if (sort === 'rechtsstand') {
    return right.documentEntry.validFrom.localeCompare(left.documentEntry.validFrom)
      || left.documentEntry.title.localeCompare(right.documentEntry.title, 'de');
  }
  return right.score - left.score
    || left.documentEntry.title.localeCompare(right.documentEntry.title, 'de')
    || right.documentEntry.validFrom.localeCompare(left.documentEntry.validFrom);
}

export function runNormSearch(
  documents: SearchIndexDocument[],
  state: NormSearchState,
): ScoredSearchResult[] {
  return documents
    .filter((entry) => matchesNormSearchFilters(entry, state))
    .map((documentEntry) => ({
      documentEntry,
      score: scoreNormSearchDocument(documentEntry, state),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => compareNormSearchResults(left, right, state.sort));
}
