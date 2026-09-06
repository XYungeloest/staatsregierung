import type { SearchHitUnit, SearchIndexDocument, SearchPublication } from '@ostrecht/recht-search/search.ts';
import { formatNormOriginKind } from '@ostrecht/shared/lib/norms/origin.ts';
import { formatDate } from '@ostrecht/shared/lib/norms/display.ts';
import { NORM_TYPES, type NormType } from '@ostrecht/shared/lib/norms/schema.ts';
import type { VersionTemporalKind } from '@ostrecht/shared/lib/norms/versions.ts';

/**
 * Bezeichnung der Fassungsart eines Suchtreffers. Sie wird erst bei der Anzeige mit dem
 * redaktionellen Stichtag gebildet (die Such-API liefert `referenceDate`), damit das
 * gespeicherte Suchdokument keinen Stichtag einbettet und eine Stichtagsfortschreibung nur
 * die tatsächlich betroffenen Fassungen berührt. Dieses Modul ist browsertauglich.
 */
export function formatSearchResultLabel(
  entry: Pick<SearchIndexDocument, 'versionKind' | 'validFrom'>,
  referenceDate: string,
): string {
  if (entry.versionKind === 'future') return `Zukünftige Fassung ab ${formatDate(entry.validFrom)}`;
  if (entry.versionKind === 'unknown-effective') return 'Veröffentlicht; Inkrafttreten noch nicht belegt';
  if (entry.versionKind === 'historical') return `Historische Fassung vom ${formatDate(entry.validFrom)}`;
  return `Geltende Fassung zum ${formatDate(referenceDate)}`;
}

export type SearchScope = 'all' | 'title' | 'metadata' | 'body';
export type VersionScope = VersionTemporalKind | 'all';
/** `activity` = jüngstes Rechtsereignis zuerst (Standard ohne Suchbegriff), `publication` = neueste Verkündung. */
export type SortKey = 'activity' | 'publication' | 'relevance' | 'title' | 'rechtsstand';

export interface NormSearchState {
  q: string;
  exclude: string;
  exact: string;
  scope: SearchScope;
  types: string[];
  ministries: string[];
  subjects: string[];
  statuses: string[];
  origins: string[];
  versionScope: VersionScope;
  /** Eine Fundstellensuche erweitert nur den impliziten Standard auf alle Fassungen. */
  versionScopeExplicit?: boolean;
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
  /** Kennzeichnet eine in der URL bzw. vom Menschen ausdrücklich gewählte Sortierung. */
  sortExplicit?: boolean;
}

/**
 * Freitextanteil der Anfrage. Ohne ihn beschreibt die Kandidatenabfrage eine reine Auswahl über
 * die Filterspalten; mit ihm kommt der Volltextindex als Treiber der Reihenfolge hinzu.
 */
export function hasFreeTextQuery(state: Pick<NormSearchState, 'q' | 'exact' | 'citation' | 'exclude'>): boolean {
  return Boolean(state.q.trim() || state.exact.trim() || state.citation.trim() || state.exclude.trim());
}

export type SearchRankTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SearchMatchKind =
  | 'exact-abbr'
  | 'exact-short-title'
  | 'exact-title'
  | 'exact-alias'
  | 'title'
  | 'type'
  | 'reference'
  | 'publication'
  | 'metadata'
  | 'body'
  | 'fuzzy'
  | 'browse';

type ExactIdentityKind = Extract<
  SearchMatchKind,
  'exact-abbr' | 'exact-short-title' | 'exact-title' | 'exact-alias'
>;

export interface ScoredSearchResult {
  documentEntry: SearchIndexDocument;
  /** Kompatibilitätswert; die Sortierung beruht ausschließlich auf rank. */
  score: number;
  rank: readonly number[];
  tier: SearchRankTier;
  matchKind: SearchMatchKind;
  matchLabel: string;
  bestHitUnit?: SearchHitUnit;
}

export interface QueryToken {
  value: string;
  prefix: boolean;
  variants: string[];
}

export interface NormTypeIntent {
  type: NormType;
  label: string;
  matchedText: string;
}

export interface LegalReferenceIntent {
  kind: 'paragraph' | 'article' | 'subsection';
  label: string;
  number: string;
  /** Bei §/Art.-Referenzen gehört der Absatz zur selben Strukturadresse. */
  subsection?: string;
}

export interface ParsedNormSearchQuery {
  raw: string;
  tokens: QueryToken[];
  phrases: string[];
  typeIntent?: NormTypeIntent;
  references: LegalReferenceIntent[];
  hasPublicationReference: boolean;
}

interface PreparedSearchText {
  normalized: string;
  variants: string[];
}

interface PreparedSearchHitUnit {
  unit: SearchHitUnit;
  label: PreparedSearchText;
  heading: PreparedSearchText;
  text: PreparedSearchText;
  all: PreparedSearchText;
}

export interface PreparedSearchDocument {
  documentEntry: SearchIndexDocument;
  fields: Record<SearchScope, PreparedSearchText>;
  title: PreparedSearchText;
  shortTitle: PreparedSearchText;
  abbr: PreparedSearchText;
  aliases: PreparedSearchText;
  metadata: PreparedSearchText;
  publicationDesignations: PreparedSearchText;
  hitUnits: PreparedSearchHitUnit[];
}

const TYPE_INTENTS: Readonly<Record<NormType, { label: string; aliases: readonly string[] }>> = {
  foerderrichtlinie: { label: 'Förderrichtlinie', aliases: ['Förderrichtlinie', 'Förderrichtlinien', 'FRL'] },
  gesetz: { label: 'Gesetz', aliases: ['Gesetz', 'Gesetze'] },
  verordnung: { label: 'Verordnung', aliases: ['Verordnung', 'Verordnungen', 'VO'] },
  verwaltungsvorschrift: { label: 'Verwaltungsvorschrift', aliases: ['Verwaltungsvorschrift', 'Verwaltungsvorschriften', 'VwV', 'Erlass', 'Erlasse'] },
  allgemeinverfuegung: { label: 'Allgemeinverfügung', aliases: ['Allgemeinverfügung', 'Allgemeinverfügungen'] },
  bekanntmachung: { label: 'Bekanntmachung', aliases: ['Bekanntmachung', 'Bekanntmachungen'] },
  berichtigung: { label: 'Berichtigung', aliases: ['Berichtigung', 'Berichtigungen'] },
  staatsvertrag: { label: 'Staatsvertrag', aliases: ['Staatsvertrag', 'Staatsverträge'] },
  verwaltungsabkommen: { label: 'Verwaltungsabkommen', aliases: ['Verwaltungsabkommen'] },
  zustimmungsgesetz: { label: 'Zustimmungsgesetz', aliases: ['Zustimmungsgesetz', 'Zustimmungsgesetze'] },
  aenderungsvorschrift: { label: 'Änderungsvorschrift', aliases: ['Änderungsvorschrift', 'Änderungsvorschriften', 'Änderungsgesetz', 'Änderungsgesetze'] },
};

const TYPE_INTENT_DEFINITIONS = NORM_TYPES.map((type) => ({ type, ...TYPE_INTENTS[type] }));

const REFERENCE_PATTERN = /§{1,2}\s*([0-9]+[a-z]?(?:\s*(?:,|und)\s*[0-9]+[a-z]?)*)(?:\s+(?:Abs(?:atz)?\.?)\s*([0-9]+))?/giu;
const ARTICLE_PATTERN = /(?:Artikel|Art\.)\s*([0-9]+[a-z]?)(?:\s+(?:Abs(?:atz)?\.?)\s*([0-9]+))?/giu;
const SUBSECTION_PATTERN = /(?:Absatz|Abs\.?)\s*([0-9]+)/giu;
/** Fundstellen der eigenen Verkündungsorgane (OGVBl., OABl., StAnzO., OVertrBl., GMBl.) sowie SächsGVBl. und BGBl. */
const PUBLICATION_REFERENCE_PATTERN = /\b(?:OGVBl\.?|OABl\.?|StAnzO\.?|OVertrBl\.?|GMBl\.?|SächsGVBl\.?|BGBl\.?)\s+\d{4}(?:\s+[IVX]+)?\s+Nr\.?\s*[\p{L}\p{N}./\-–—]+(?:\s+S\.?\s*[\p{L}\p{N}./\-–—]+)?/giu;

/**
 * Normiert Interpunktion, Groß-/Kleinschreibung und ß. Umlaut- und
 * Transliterationsvarianten werden zusätzlich über buildSearchVariants behandelt,
 * damit etwa ein natürliches "Steuer" nicht blind zu "Stur" umgeschrieben wird.
 */
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

function transliterateGermanUmlauts(value: string): string {
  return value
    .replace(/ä/giu, 'ae')
    .replace(/ö/giu, 'oe')
    .replace(/ü/giu, 'ue')
    .replace(/ß/giu, 'ss');
}

/**
 * Builds the German spelling variants used consistently by the full search,
 * publication lookup and autocomplete.
 */
export function buildSearchVariants(value: string): string[] {
  return [...new Set([
    normalizeSearchText(value),
    normalizeSearchText(transliterateGermanUmlauts(value)),
  ].filter(Boolean))];
}

function prepareText(values: Array<string | undefined | null>): PreparedSearchText {
  const source = values.filter((value): value is string => Boolean(value)).join(' ');
  return {
    normalized: normalizeSearchText(source),
    variants: buildSearchVariants(source),
  };
}

function words(value: string): string[] {
  return value.split(' ').filter(Boolean);
}

export function parseQueryTokens(value: string): QueryToken[] {
  const rawTokens = value.match(/[\p{L}\p{N}]+\*?/gu) ?? [];
  const result: QueryToken[] = [];
  const known = new Set<string>();

  for (const rawToken of rawTokens) {
    const prefix = rawToken.endsWith('*');
    const tokenValue = rawToken.replace(/\*+$/u, '');
    const variants = buildSearchVariants(tokenValue);
    const normalized = variants[0] ?? '';
    const key = `${normalized}:${prefix}`;
    if (!normalized || known.has(key)) continue;
    known.add(key);
    result.push({ value: normalized, prefix, variants });
  }

  return result;
}

function tokenMatches(text: PreparedSearchText, token: QueryToken): boolean {
  return token.variants.some((tokenVariant) => text.variants.some((textVariant) => {
    if (!token.prefix) return textVariant.includes(tokenVariant);
    return words(textVariant).some((word) => word.startsWith(tokenVariant));
  }));
}

function phraseMatches(text: PreparedSearchText, phrase: string): boolean {
  return buildSearchVariants(phrase).some((phraseVariant) =>
    text.variants.some((textVariant) => textVariant.includes(phraseVariant)),
  );
}

function textMatchesQuery(text: PreparedSearchText, query: ParsedNormSearchQuery): boolean {
  return query.tokens.every((token) => tokenMatches(text, token))
    && query.phrases.every((phrase) => phraseMatches(text, phrase));
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

function publicationDesignations(documentEntry: SearchIndexDocument): string[] {
  return [
    documentEntry.publication ?? '',
    documentEntry.publication && documentEntry.publicationYear && documentEntry.publicationIssue
      ? `${documentEntry.publication} ${documentEntry.publicationYear} Nr. ${documentEntry.publicationIssue}`
      : '',
    documentEntry.publicationTitle ?? '',
    ...(documentEntry.publicationAliases ?? []),
  ].filter(Boolean);
}

function prepareSearchDocument(documentEntry: SearchIndexDocument): PreparedSearchDocument {
  const title = prepareText([documentEntry.title]);
  const shortTitle = prepareText([documentEntry.shortTitle]);
  const abbr = prepareText([documentEntry.abbr]);
  const aliases = prepareText(documentEntry.aliases ?? []);
  const titleFields = [documentEntry.title, documentEntry.shortTitle, documentEntry.abbr, ...(documentEntry.aliases ?? [])];
  const metadataValues = [
    documentEntry.typeLabel,
    documentEntry.ministry,
    ...documentEntry.subjects,
    ...documentEntry.keywords,
    documentEntry.statusLabel,
    formatNormOriginKind(documentEntry.origin),
    documentEntry.summary,
    documentEntry.initialCitation,
    documentEntry.citation,
    documentEntry.publication,
    documentEntry.publicationTitle,
    ...(documentEntry.publicationAliases ?? []),
    documentEntry.publicationDate,
    documentEntry.publicationIssue,
    documentEntry.publicationPage,
    documentEntry.changeNote,
  ];
  const hitUnits = documentEntry.hitUnits.map((unit) => ({
    unit,
    label: prepareText([unit.label]),
    heading: prepareText([unit.label, unit.title]),
    text: prepareText([unit.text]),
    all: prepareText([unit.label, unit.title, unit.text]),
  }));
  const bodyValues = [
    documentEntry.bodySupplement,
    ...documentEntry.hitUnits.flatMap((unit) => [unit.label, unit.title, unit.text]),
  ];
  const titleText = prepareText(titleFields);
  const metadata = prepareText(metadataValues);
  const body = prepareText(bodyValues);

  return {
    documentEntry,
    fields: {
      title: titleText,
      metadata,
      body,
      all: prepareText([...titleFields, ...metadataValues, ...bodyValues]),
    },
    title,
    shortTitle,
    abbr,
    aliases,
    metadata,
    publicationDesignations: prepareText(publicationDesignations(documentEntry)),
    hitUnits,
  };
}

export function prepareSearchDocuments(documents: SearchIndexDocument[]): PreparedSearchDocument[] {
  return documents.map(prepareSearchDocument);
}

function isPreparedDocument(value: SearchIndexDocument | PreparedSearchDocument): value is PreparedSearchDocument {
  return 'fields' in value;
}

function toPreparedDocuments(documents: Array<SearchIndexDocument | PreparedSearchDocument>): PreparedSearchDocument[] {
  return documents.map((documentEntry) => isPreparedDocument(documentEntry)
    ? documentEntry
    : prepareSearchDocument(documentEntry));
}

function removeQuotedPhrases(value: string): { remaining: string; phrases: string[] } {
  const phrases: string[] = [];
  const remaining = value.replace(/"([^"]+)"|„([^“]+)“/gu, (_match, straight, german) => {
    const phrase = String(straight ?? german ?? '').trim();
    if (phrase) phrases.push(phrase);
    return ' ';
  });
  return { remaining, phrases };
}

function normalizeReferenceNumber(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, '');
}

function extractLegalReferences(value: string): { remaining: string; references: LegalReferenceIntent[] } {
  const references: LegalReferenceIntent[] = [];
  let remaining = value.replace(REFERENCE_PATTERN, (_match, list: string, subsection?: string) => {
    const subsectionNumber = subsection ? normalizeReferenceNumber(subsection) : undefined;
    for (const part of list.split(/\s*(?:,|und)\s*/u)) {
      const number = normalizeReferenceNumber(part);
      if (number) references.push({
        kind: 'paragraph',
        number,
        subsection: subsectionNumber,
        label: subsectionNumber ? `§ ${part.trim()} Abs. ${subsectionNumber}` : `§ ${part.trim()}`,
      });
    }
    return ' ';
  });
  remaining = remaining.replace(ARTICLE_PATTERN, (_match, article: string, subsection?: string) => {
    const number = normalizeReferenceNumber(article);
    const subsectionNumber = subsection ? normalizeReferenceNumber(subsection) : undefined;
    if (number) references.push({
      kind: 'article',
      number,
      subsection: subsectionNumber,
      label: subsectionNumber ? `Art. ${article} Abs. ${subsectionNumber}` : `Art. ${article}`,
    });
    return ' ';
  });
  remaining = remaining.replace(SUBSECTION_PATTERN, (_match, subsection: string) => {
    references.push({ kind: 'subsection', number: subsection, label: `Abs. ${subsection}` });
    return ' ';
  });

  const known = new Set<string>();
  return {
    remaining,
    references: references.filter((reference) => {
      const key = `${reference.kind}:${reference.number}:${reference.subsection ?? ''}`;
      if (known.has(key)) return false;
      known.add(key);
      return true;
    }),
  };
}

function findTypeIntent(tokens: QueryToken[], allowTypeIntent: boolean): { intent?: NormTypeIntent; typeToken?: QueryToken } {
  if (!allowTypeIntent) return {};
  for (const token of tokens) {
    for (const definition of TYPE_INTENT_DEFINITIONS) {
      const aliases = definition.aliases.flatMap(buildSearchVariants);
      if (token.variants.some((variant) => aliases.includes(variant))) {
        return {
          intent: { type: definition.type, label: definition.label, matchedText: token.value },
          typeToken: token,
        };
      }
    }
  }
  return {};
}

export function parseNormSearchQuery(
  value: string,
  options: { allowTypeIntent?: boolean } = {},
): ParsedNormSearchQuery {
  const quoted = removeQuotedPhrases(value);
  const referenceExtraction = extractLegalReferences(quoted.remaining);
  const hasPublicationReference = PUBLICATION_REFERENCE_PATTERN.test(referenceExtraction.remaining);
  PUBLICATION_REFERENCE_PATTERN.lastIndex = 0;
  const remaining = referenceExtraction.remaining.replace(PUBLICATION_REFERENCE_PATTERN, ' ');
  const tokens = parseQueryTokens(remaining);
  const { intent, typeToken } = findTypeIntent(tokens, options.allowTypeIntent !== false);

  return {
    raw: value,
    tokens: typeToken ? tokens.filter((token) => token !== typeToken) : tokens,
    phrases: quoted.phrases,
    typeIntent: intent,
    references: referenceExtraction.references,
    hasPublicationReference,
  };
}

export function removeDetectedTypeIntent(value: string, intent: NormTypeIntent): string {
  const definition = TYPE_INTENTS[intent.type];
  const alternatives = definition.aliases
    .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join('|');
  return value.replace(new RegExp(`(?:^|\\s)(?:${alternatives})(?=\\s|$)`, 'iu'), ' ').trim();
}

/**
 * Standardsortierung: mit Suchanfrage nach Relevanz, ohne Suchanfrage (Stöbern, auch mit
 * Filtern) nach jüngstem Rechtsereignis – neue ostdeutsche Gesetze und aktuelle Änderungen
 * stehen vor unverändert übernommenem Recht.
 */
export function getDefaultSearchSort(state: Pick<NormSearchState, 'q' | 'exact' | 'citation' | 'exclude'>): SortKey {
  return state.q.trim() || state.exact.trim() || state.citation.trim() || state.exclude.trim()
    ? 'relevance'
    : 'activity';
}

export function getActiveSearchSort(state: NormSearchState): SortKey {
  return state.sortExplicit === false ? getDefaultSearchSort(state) : state.sort;
}

interface RawFilterOptions {
  ignoreVersionScope?: boolean;
  citationQuery?: ParsedNormSearchQuery;
}

function matchesRawFilters(
  documentEntry: SearchIndexDocument,
  state: NormSearchState,
  prepared: PreparedSearchDocument,
  options: RawFilterOptions = {},
): boolean {
  if (!anySelected(state.types, documentEntry.type)) return false;
  if (!anySelected(state.ministries, documentEntry.ministry)) return false;
  if (!anySubjectSelected(state.subjects, documentEntry.subjects)) return false;
  if (!anySelected(state.statuses, documentEntry.status)) return false;
  if (!anySelected(state.origins, documentEntry.origin)) return false;
  if (!options.ignoreVersionScope && state.versionScope !== 'all' && documentEntry.versionKind !== state.versionScope) return false;
  if (state.geltungstag && !isDateInRange(state.geltungstag, documentEntry.validFrom, documentEntry.validTo)) return false;
  if (state.validFrom && documentEntry.validTo && documentEntry.validTo < state.validFrom) return false;
  if (state.validTo && documentEntry.validFrom > state.validTo) return false;
  if (!anySelected(state.publicationSources, documentEntry.publicationSource ?? '')) return false;
  if (!anySelected(state.publicationYears, documentEntry.publicationYear ?? '')) return false;
  if (state.publicationIssue && normalizeSearchText(documentEntry.publicationIssue ?? '') !== normalizeSearchText(state.publicationIssue)) return false;
  if (state.publicationPage && !normalizeSearchText(documentEntry.publicationPage ?? '').includes(normalizeSearchText(state.publicationPage))) return false;

  if (options.citationQuery) {
    if (!textMatchesQuery(prepared.publicationDesignations, options.citationQuery)
      && !textMatchesQuery(prepared.metadata, options.citationQuery)) return false;
  }

  return true;
}

export function matchesNormSearchFilters(
  documentEntry: SearchIndexDocument,
  state: NormSearchState,
): boolean {
  return matchesRawFilters(documentEntry, state, prepareSearchDocument(documentEntry), {
    citationQuery: state.citation
      ? parseNormSearchQuery(state.citation, { allowTypeIntent: false })
      : undefined,
  });
}

function exactIdentityKind(documentEntry: PreparedSearchDocument, query: string): ExactIdentityKind | undefined {
  const queryText = prepareText([query]);
  if (!queryText.normalized) return undefined;
  const equals = (field: PreparedSearchText) => queryText.variants.some((value) => field.variants.includes(value));
  if (equals(documentEntry.abbr)) return 'exact-abbr';
  if (equals(documentEntry.shortTitle)) return 'exact-short-title';
  if (equals(documentEntry.title)) return 'exact-title';
  if ((documentEntry.documentEntry.aliases ?? []).some((alias) =>
    queryText.variants.some((value) => buildSearchVariants(alias).includes(value)))) return 'exact-alias';
  return undefined;
}

function hasExactIdentity(documents: PreparedSearchDocument[], query: string): boolean {
  return documents.some((documentEntry) => exactIdentityKind(documentEntry, query) !== undefined);
}

function exactPublicationSlug(documents: PreparedSearchDocument[], query: string): string | undefined {
  const queryText = prepareText([query]);
  if (!queryText.normalized) return undefined;
  const matches = new Set(documents
    .filter((documentEntry) => publicationDesignations(documentEntry.documentEntry)
      .some((designation) => queryText.variants.some((value) => buildSearchVariants(designation).includes(value))))
    .map((documentEntry) => documentEntry.documentEntry.publicationSlug)
    .filter((slug): slug is string => Boolean(slug)));
  return matches.size === 1 ? [...matches][0] : undefined;
}

function hasSearchTerms(query: ParsedNormSearchQuery): boolean {
  return query.tokens.length > 0
    || query.phrases.length > 0
    || query.references.length > 0
    || query.hasPublicationReference;
}

function hitMatchesReference(hit: PreparedSearchHitUnit, reference: LegalReferenceIntent): boolean {
  const references = hit.unit.references;
  if (!references) return false;
  const subsectionMatches = !reference.subsection || references.subsections?.includes(reference.subsection) === true;
  if (reference.kind === 'paragraph') return references.paragraph === reference.number && subsectionMatches;
  if (reference.kind === 'article') return references.article === reference.number && subsectionMatches;
  return references.subsections?.includes(reference.number) === true;
}

interface ReferenceHit {
  reference: LegalReferenceIntent;
  hit: PreparedSearchHitUnit;
}

function findReferenceHits(
  documentEntry: PreparedSearchDocument,
  references: LegalReferenceIntent[],
): ReferenceHit[] | undefined {
  if (references.length === 0) return [];
  const matches = references.map((reference) => {
    const hit = documentEntry.hitUnits.find((candidate) => hitMatchesReference(candidate, reference));
    return hit ? { reference, hit } : undefined;
  });
  return matches.every((match): match is ReferenceHit => Boolean(match)) ? matches : undefined;
}

function phraseInTitle(documentEntry: PreparedSearchDocument, query: ParsedNormSearchQuery): boolean {
  return query.phrases.some((phrase) => phraseMatches(documentEntry.fields.title, phrase));
}

function queryTextInTitle(documentEntry: PreparedSearchDocument, query: ParsedNormSearchQuery): boolean {
  return query.tokens.length > 0 && query.tokens.every((token) => tokenMatches(documentEntry.fields.title, token));
}

function queryStartsTitle(documentEntry: PreparedSearchDocument, query: ParsedNormSearchQuery): SearchMatchKind | undefined {
  const source = query.raw.replace(PUBLICATION_REFERENCE_PATTERN, ' ');
  const queryText = prepareText([source]);
  if (!queryText.normalized || query.references.length > 0 || query.phrases.length > 0) return undefined;
  const starts = (field: PreparedSearchText) => queryText.variants.some((value) =>
    field.variants.some((fieldValue) => fieldValue.startsWith(value)));
  if (starts(documentEntry.title) || starts(documentEntry.shortTitle) || starts(documentEntry.abbr)) return 'title';
  return undefined;
}

function hasSpecificRawTitleQuery(query: ParsedNormSearchQuery): boolean {
  const source = query.raw.replace(PUBLICATION_REFERENCE_PATTERN, ' ');
  return words(normalizeSearchText(source)).length > 1;
}

function fullSpecificQueryAppearsInTitle(documentEntry: PreparedSearchDocument, query: ParsedNormSearchQuery): boolean {
  if (!hasSpecificRawTitleQuery(query) || query.references.length > 0 || query.hasPublicationReference) return false;
  const source = query.raw.replace(PUBLICATION_REFERENCE_PATTERN, ' ');
  const queryText = prepareText([source]);
  return queryText.variants.some((value) => [documentEntry.title, documentEntry.shortTitle, documentEntry.abbr]
    .some((field) => field.variants.some((fieldValue) => fieldValue.includes(value))));
}

function tokenPositions(text: string, token: QueryToken): number[] {
  const tokens = words(text);
  const positions: number[] = [];
  tokens.forEach((word, index) => {
    if (token.variants.some((variant) => token.prefix ? word.startsWith(variant) : word.includes(variant))) positions.push(index);
  });
  return positions;
}

function tokenSpan(text: PreparedSearchText, tokens: QueryToken[]): number {
  if (tokens.length < 2) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const variant of text.variants) {
    const positions = tokens.map((token) => tokenPositions(variant, token));
    if (positions.some((entries) => entries.length === 0)) continue;
    const first = positions.map((entries) => entries[0]);
    best = Math.min(best, Math.max(...first) - Math.min(...first));
  }
  return best;
}

function getBestPreparedHitUnit(
  documentEntry: PreparedSearchDocument,
  query: ParsedNormSearchQuery,
  referenceHit?: PreparedSearchHitUnit,
): PreparedSearchHitUnit | undefined {
  if (referenceHit) return referenceHit;
  const candidates = documentEntry.hitUnits
    .map((hit) => {
      const headingPhrase = query.phrases.some((phrase) => phraseMatches(hit.heading, phrase));
      const allTerms = query.tokens.length > 0 && query.tokens.every((token) => tokenMatches(hit.all, token));
      const anyTerms = query.tokens.some((token) => tokenMatches(hit.all, token));
      const phrase = query.phrases.some((entry) => phraseMatches(hit.all, entry));
      if (!headingPhrase && !allTerms && !anyTerms && !phrase) return undefined;
      const rank = headingPhrase ? [0, 0]
        : allTerms ? [1, tokenSpan(hit.all, query.tokens)]
          : phrase ? [2, 0]
            : [3, tokenSpan(hit.all, query.tokens)];
      return { hit, rank };
    })
    .filter((entry): entry is { hit: PreparedSearchHitUnit; rank: number[] } => Boolean(entry))
    .sort((left, right) => compareRank(left.rank, right.rank));
  return candidates[0]?.hit;
}

export function getBestHitUnit(
  documentEntry: SearchIndexDocument | PreparedSearchDocument,
  queryValue: string,
): SearchHitUnit | undefined {
  const prepared = isPreparedDocument(documentEntry) ? documentEntry : prepareSearchDocument(documentEntry);
  const query = parseNormSearchQuery(queryValue, { allowTypeIntent: false });
  return getBestPreparedHitUnit(prepared, query, findReferenceHits(prepared, query.references)?.[0]?.hit)?.unit;
}

/** Editierabstand zweier normalisierter Wörter; Grundlage der Ähnlichkeitsstufe (matchKind `fuzzy`). */
export function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left || !right) return Math.max(left.length, right.length);
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

function fuzzyTitleMatch(documentEntry: PreparedSearchDocument, query: ParsedNormSearchQuery): boolean {
  if (query.phrases.length > 0 || query.references.length > 0 || query.hasPublicationReference || query.tokens.length === 0) return false;
  const titleWords = new Set(documentEntry.fields.title.variants.flatMap(words));
  return query.tokens.every((token) => {
    if (token.prefix || token.value.length < 6) return false;
    return token.variants.some((variant) => [...titleWords].some((word) =>
      Math.abs(word.length - variant.length) <= 2 && levenshteinDistance(word, variant) <= 2,
    ));
  });
}

function referenceMatchLabel(references: LegalReferenceIntent[]): string {
  if (references.length > 1 && references.every((reference) => reference.kind === 'paragraph' && !reference.subsection)) {
    return `§§ ${references.map((reference) => reference.number).join(', ')}`;
  }
  return references[0]?.label ?? 'Vorschrift';
}

function matchLabel(kind: SearchMatchKind, typeIntent?: NormTypeIntent, references: LegalReferenceIntent[] = []): string {
  switch (kind) {
    case 'exact-abbr': return 'Exakte Abkürzung';
    case 'exact-short-title': return 'Exakter Kurztitel';
    case 'exact-title': return 'Exakter Titel';
    case 'exact-alias': return 'Bekannte Bezeichnung';
    case 'title': return 'Treffer im Titel';
    case 'type': return typeIntent ? `Normtyp ${typeIntent.label}` : 'Normtyp';
    case 'reference': return `Treffer in ${referenceMatchLabel(references)}`;
    case 'publication': return 'Fundstelle';
    case 'metadata': return 'Treffer in Metadaten';
    case 'body': return 'Volltexttreffer';
    case 'fuzzy': return 'Ähnlicher Titel';
    default: return 'Vorschrift';
  }
}

function compareRank(left: readonly number[], right: readonly number[]): number {
  const longest = Math.max(left.length, right.length);
  for (let index = 0; index < longest; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

interface SearchEvaluation {
  result: ScoredSearchResult;
  isFuzzy: boolean;
}

interface PreparedSearchRequest {
  query: ParsedNormSearchQuery;
  excludedTokens: QueryToken[];
  exact: PreparedSearchText;
  citationQuery?: ParsedNormSearchQuery;
  publicationSlug?: string;
}

function prepareSearchRequest(
  documents: PreparedSearchDocument[],
  state: NormSearchState,
): PreparedSearchRequest {
  const query = parseNormSearchQuery(state.q, { allowTypeIntent: !hasExactIdentity(documents, state.q) });
  return {
    query,
    excludedTokens: parseQueryTokens(state.exclude),
    exact: prepareText([state.exact.replaceAll('*', '')]),
    citationQuery: state.citation
      ? parseNormSearchQuery(state.citation, { allowTypeIntent: false })
      : undefined,
    publicationSlug: query.hasPublicationReference ? exactPublicationSlug(documents, state.q) : undefined,
  };
}

function evaluateDocument(
  prepared: PreparedSearchDocument,
  state: NormSearchState,
  request: PreparedSearchRequest,
): SearchEvaluation | undefined {
  const {
    query,
    excludedTokens,
    exact,
    citationQuery,
    publicationSlug,
  } = request;
  const documentEntry = prepared.documentEntry;
  if (!matchesRawFilters(documentEntry, state, prepared, {
    citationQuery,
    ignoreVersionScope: Boolean(publicationSlug && state.versionScopeExplicit !== true),
  })) return undefined;
  if (query.hasPublicationReference && !publicationSlug) return undefined;
  if (publicationSlug && documentEntry.publicationSlug !== publicationSlug) return undefined;

  if (excludedTokens.some((token) => tokenMatches(prepared.fields.all, token))) return undefined;

  if (exact.normalized && !exact.variants.some((value) => prepared.fields[state.scope].variants.some((field) => field.includes(value)))) return undefined;

  const identity = query.references.length === 0 && query.phrases.length === 0 && !query.hasPublicationReference
    ? exactIdentityKind(prepared, query.raw)
    : undefined;
  const titleStarts = queryStartsTitle(prepared, query);
  const strongRawTitlePrefix = hasSpecificRawTitleQuery(query) && Boolean(titleStarts);
  const strongRawTitlePhrase = fullSpecificQueryAppearsInTitle(prepared, query);
  // Eine Fundstellensuche trifft die Vorschrift unmittelbar (publicationSlug ist hier bereits
  // auf dieses Dokument geprüft): Änderungsvorschriften der zitierten Ausgabe bleiben sichtbar.
  const amendmentDirectMatch = Boolean(identity || strongRawTitlePrefix || strongRawTitlePhrase || publicationSlug);
  const amendmentExplicitlyRequested = state.types.includes('aenderungsvorschrift')
    || query.typeIntent?.type === 'aenderungsvorschrift';
  if (documentEntry.isAmendment && !state.includeAmendments && !amendmentExplicitlyRequested && !amendmentDirectMatch) return undefined;

  const referenceHits = findReferenceHits(prepared, query.references);
  const referenceHit = referenceHits?.[0]?.hit;
  if (query.references.length > 0 && !referenceHits) return undefined;

  const typeIsExplicitlyFiltered = state.types.length > 0;
  const isTypeMatch = Boolean(query.typeIntent && documentEntry.type === query.typeIntent.type);
  const isTypeOnly = Boolean(query.typeIntent && !hasSearchTerms(query));
  if (isTypeOnly && !typeIsExplicitlyFiltered && !isTypeMatch) return undefined;

  const scopeMatches = textMatchesQuery(prepared.fields[state.scope], query);
  const publicationMatches = Boolean(publicationSlug && documentEntry.publicationSlug === publicationSlug);
  const browse = !hasSearchTerms(query) && !query.typeIntent;
  const fuzzyMatches = fuzzyTitleMatch(prepared, query);
  if (!browse && !publicationMatches && !scopeMatches && !isTypeOnly && !fuzzyMatches) return undefined;

  const titleMatches = queryTextInTitle(prepared, query);
  const titlePhrase = phraseInTitle(prepared, query);
  const hit = getBestPreparedHitUnit(prepared, query, referenceHit);
  const metadataMatches = textMatchesQuery(prepared.metadata, query);
  const bodyMatches = textMatchesQuery(prepared.fields.body, query);

  let tier: SearchRankTier = 7;
  let rank: number[] = [7];
  let kind: SearchMatchKind = 'browse';
  let isFuzzy = false;

  if (identity) {
    const identityOrder: Record<ExactIdentityKind, number> = {
      'exact-abbr': 0,
      'exact-short-title': 1,
      'exact-title': 2,
      'exact-alias': 3,
    };
    tier = 0;
    rank = [tier, identityOrder[identity], documentEntry.isAmendment ? 1 : 0];
    kind = identity;
  } else if (referenceHit && titleMatches) {
    tier = 1;
    rank = [tier, 0, documentEntry.isAmendment ? 1 : 0];
    kind = 'reference';
  } else if (strongRawTitlePrefix) {
    tier = 1;
    rank = [tier, 1, documentEntry.isAmendment ? 1 : 0];
    kind = 'title';
  } else if (strongRawTitlePhrase) {
    tier = 1;
    rank = [tier, 2, documentEntry.isAmendment ? 1 : 0];
    kind = 'title';
  } else if (isTypeMatch && !isTypeOnly && scopeMatches) {
    tier = 1;
    rank = [tier, 3, documentEntry.isAmendment ? 1 : 0];
    kind = 'type';
  } else if (titleStarts) {
    tier = 1;
    rank = [tier, 4, documentEntry.isAmendment ? 1 : 0];
    kind = 'title';
  } else if (titlePhrase || (query.tokens.length > 1 && titleMatches)) {
    tier = 1;
    rank = [tier, 5, documentEntry.isAmendment ? 1 : 0];
    kind = 'title';
  } else if (titleMatches) {
    tier = 2;
    rank = [tier, 0, documentEntry.isAmendment ? 1 : 0];
    kind = 'title';
  } else if (isTypeMatch && (isTypeOnly || scopeMatches)) {
    tier = 3;
    rank = [tier, 0, documentEntry.isAmendment ? 1 : 0];
    kind = 'type';
  } else if (publicationMatches) {
    tier = 3;
    rank = [tier, 1, documentEntry.isAmendment ? 1 : 0];
    kind = 'publication';
  } else if (referenceHit) {
    tier = 3;
    rank = [tier, 2, documentEntry.isAmendment ? 1 : 0];
    kind = 'reference';
  } else if (metadataMatches) {
    tier = 3;
    rank = [tier, 3, documentEntry.isAmendment ? 1 : 0];
    kind = 'metadata';
  } else if (hit && (query.phrases.length > 0 || query.tokens.length > 1)) {
    tier = 4;
    rank = [tier, 0, tokenSpan(hit.all, query.tokens), documentEntry.isAmendment ? 1 : 0];
    kind = 'body';
  } else if (bodyMatches) {
    tier = 5;
    rank = [tier, 0, documentEntry.isAmendment ? 1 : 0];
    kind = 'body';
  } else if (browse) {
    tier = 7;
    rank = [tier, documentEntry.isAmendment ? 1 : 0];
    kind = 'browse';
  } else if (fuzzyMatches) {
    tier = 6;
    rank = [tier, documentEntry.isAmendment ? 1 : 0];
    kind = 'fuzzy';
    isFuzzy = true;
  } else {
    return undefined;
  }

  return {
    isFuzzy,
    result: {
      documentEntry,
      score: 7 - tier,
      rank,
      tier,
      matchKind: kind,
      matchLabel: matchLabel(kind, query.typeIntent, query.references),
      bestHitUnit: hit?.unit,
    },
  };
}

export function compareNormSearchResults(
  left: ScoredSearchResult,
  right: ScoredSearchResult,
  sort: SortKey,
): number {
  if (sort === 'activity') {
    // Fehlt das Feld (ältere Suchdokumente), zählt der Fassungsbeginn.
    const leftDate = left.documentEntry.lastChangeDate ?? left.documentEntry.validFrom;
    const rightDate = right.documentEntry.lastChangeDate ?? right.documentEntry.validFrom;
    return rightDate.localeCompare(leftDate)
      || compareRank(left.rank, right.rank)
      || left.documentEntry.title.localeCompare(right.documentEntry.title, 'de')
      || right.documentEntry.validFrom.localeCompare(left.documentEntry.validFrom)
      || left.documentEntry.slug.localeCompare(right.documentEntry.slug);
  }
  if (sort === 'publication') {
    const leftDate = left.documentEntry.publicationDate ?? left.documentEntry.validFrom;
    const rightDate = right.documentEntry.publicationDate ?? right.documentEntry.validFrom;
    return rightDate.localeCompare(leftDate)
      || compareRank(left.rank, right.rank)
      || left.documentEntry.title.localeCompare(right.documentEntry.title, 'de')
      || right.documentEntry.validFrom.localeCompare(left.documentEntry.validFrom);
  }
  if (sort === 'title') {
    return left.documentEntry.title.localeCompare(right.documentEntry.title, 'de')
      || compareRank(left.rank, right.rank)
      || right.documentEntry.validFrom.localeCompare(left.documentEntry.validFrom);
  }
  if (sort === 'rechtsstand') {
    return right.documentEntry.validFrom.localeCompare(left.documentEntry.validFrom)
      || compareRank(left.rank, right.rank)
      || left.documentEntry.title.localeCompare(right.documentEntry.title, 'de');
  }
  return compareRank(left.rank, right.rank)
    || (right.documentEntry.versionKind === 'current' ? 1 : 0) - (left.documentEntry.versionKind === 'current' ? 1 : 0)
    || left.documentEntry.title.localeCompare(right.documentEntry.title, 'de')
    || right.documentEntry.validFrom.localeCompare(left.documentEntry.validFrom);
}

export interface SearchResultGroup {
  slug: string;
  entries: ScoredSearchResult[];
}

/**
 * Keeps the most relevant matching version in front of its norm group. The
 * current version is only elevated for the default, query-free browse view.
 */
export function groupNormSearchResults(
  results: ScoredSearchResult[],
  state: NormSearchState,
): SearchResultGroup[] {
  const groups = new Map<string, ScoredSearchResult[]>();
  for (const result of results) {
    const entries = groups.get(result.documentEntry.slug);
    if (entries) entries.push(result);
    else groups.set(result.documentEntry.slug, [result]);
  }

  const preferCurrentBrowseVersion = state.versionScope === 'all'
    && getDefaultSearchSort(state) === 'activity'
    && ['activity', 'publication'].includes(getActiveSearchSort(state));

  return [...groups.entries()].map(([slug, entries]) => {
    if (preferCurrentBrowseVersion) {
      const currentIndex = entries.findIndex((entry) => entry.documentEntry.versionKind === 'current');
      if (currentIndex > 0) entries.unshift(...entries.splice(currentIndex, 1));
    }
    return { slug, entries };
  });
}

export function getDetectedNormTypeIntent(
  documents: Array<SearchIndexDocument | PreparedSearchDocument>,
  query: string,
): NormTypeIntent | undefined {
  const prepared = toPreparedDocuments(documents);
  return parseNormSearchQuery(query, { allowTypeIntent: !hasExactIdentity(prepared, query) }).typeIntent;
}

export function runNormSearch(
  documents: Array<SearchIndexDocument | PreparedSearchDocument>,
  state: NormSearchState,
): ScoredSearchResult[] {
  const prepared = toPreparedDocuments(documents);
  const request = prepareSearchRequest(prepared, state);
  const evaluations = prepared
    .map((documentEntry) => evaluateDocument(documentEntry, state, request))
    .filter((entry): entry is SearchEvaluation => Boolean(entry));
  const exactResults = evaluations.filter((entry) => !entry.isFuzzy).map((entry) => entry.result);
  const results = exactResults.length > 0
    ? exactResults
    : evaluations.filter((entry) => entry.isFuzzy).map((entry) => entry.result);
  return results.sort((left, right) => compareNormSearchResults(left, right, getActiveSearchSort(state)));
}

// ---------------------------------------------------------------------------
// Suchplan: reine Funktionen für die serverseitige Auswertung
// ---------------------------------------------------------------------------

/** Eine Begriffsgruppe des Suchplans: alle Schreibvarianten desselben Suchworts. */
export interface SearchPlanGroup {
  variants: string[];
  prefix: boolean;
}

/**
 * Serverseitig auswertbarer Bauplan einer Suchanfrage. Er zerlegt die Anfrage in Bestandteile,
 * die sich als SQL-Bedingung über den Volltextindex, die Strukturadressen und die schmalen
 * Spalten der Projektion ausdrücken lassen. Der Plan ist eine reine Ableitung des Suchzustands
 * und enthält keine Anzeigetexte.
 */
export interface SearchQueryPlan {
  /** Je Suchwort eine Gruppe; alle Gruppen müssen in derselben Vorschrift vorkommen. */
  tokenGroups: SearchPlanGroup[];
  /** Wortfolgen in Anführungszeichen und die Eingabe „Exakte Wortfolge“. */
  phrases: string[];
  /** Begriffe aus „Enthält nicht“; eine Vorschrift mit einem davon fällt heraus. */
  excludeTokens: SearchPlanGroup[];
  /** Strukturadressen (§, Artikel, Absatz) aus der Anfrage. */
  references: LegalReferenceIntent[];
  /** Normtyp als einzige Aussage der Anfrage („Verordnungen“) – wirkt wie ein Typfilter. */
  typeOnly?: NormType;
  /** Erkannter Normtyp (Rangstufe und Hinweis-Chip). */
  typeIntent?: NormTypeIntent;
  /** Rohanfrage für den Gleichheitsvergleich mit Abkürzung, Kurzbezeichnung und Titel. */
  identityValues: string[];
  /** Mehrwortige Anfrage als Wortfolge im Titelbereich (Ausnahme für Änderungsvorschriften). */
  titlePhrase?: string;
  /** Eingabe „Fundstelle“: Wortfolge über alle Felder, unabhängig vom Suchbereich. */
  citationPhrase?: string;
  /** Suchbereich der Anfrage. */
  scope: SearchScope;
  sort: SortKey;
  freeText: boolean;
  /** Die Anfrage nennt eine Fundstelle (OGVBl. 2026 Nr. 73). */
  hasPublicationReference: boolean;
}

/** FTS5-Term mit maskierten Anführungszeichen. */
function ftsTerm(value: string): string {
  return `"${value.replace(/"/gu, '""')}"`;
}

/** ODER-Gruppe aller Schreibvarianten eines Suchworts, als Präfixsuche. */
function ftsGroupExpression(group: SearchPlanGroup): string {
  return `(${group.variants.map((variant) => `${ftsTerm(variant)}*`).join(' OR ')})`;
}

/** Wortfolge als FTS5-Phrase über alle Schreibvarianten. */
function ftsPhraseExpression(phrase: string): string {
  const variants = [...new Set(buildSearchVariants(phrase))].filter(Boolean);
  return variants.length > 0 ? `(${variants.map((variant) => ftsTerm(variant)).join(' OR ')})` : '';
}

/**
 * FTS5-Spaltenfilter eines Suchbereichs. `all` sucht über alle indexierten Spalten; „Nur
 * Metadaten“ trennt der Aufrufer zusätzlich über die Einheitenart (block_type `metadata`).
 */
export function searchScopeColumns(scope: SearchScope): string | null {
  if (scope === 'title') return '{title short_title abbr}';
  if (scope === 'body') return '{label heading body}';
  return null;
}

/** Setzt einen FTS5-Ausdruck in den Spaltenfilter eines Suchbereichs. */
export function buildFtsColumnMatch(columns: string | null, expression: string): string {
  return columns ? `${columns}: ${expression}` : expression;
}

/**
 * Großzügiger Kandidatenausdruck (ODER über alle Wortvarianten und Wortfolgen). Er treibt die
 * Volltextabfrage und stellt `rank` bereit; die verknüpfende Auswahl übernehmen die
 * UND-Bedingungen des Plans. Ohne Suchtext gibt es keinen Ausdruck: eine Anfrage aus Normtyp
 * oder Strukturadresse allein läuft über die Filterspalten, nicht über den Volltextindex.
 */
export function buildFtsMatch(plan: SearchQueryPlan): string | null {
  const groups = [
    ...plan.tokenGroups.map((group) => ftsGroupExpression(group)),
    ...plan.phrases.map((phrase) => ftsPhraseExpression(phrase)),
    ...(plan.citationPhrase ? [ftsPhraseExpression(plan.citationPhrase)] : []),
  ].filter(Boolean);
  return groups.length > 0 ? groups.join(' OR ') : null;
}

/** UND-Bedingung der Eingabe „Fundstelle“: Wortfolge über alle Felder. */
export function planCitationMatch(plan: SearchQueryPlan): string | null {
  if (!plan.citationPhrase) return null;
  return ftsPhraseExpression(plan.citationPhrase) || null;
}

/** UND-Bedingung einer Begriffsgruppe im Suchbereich des Plans. */
export function planGroupMatch(plan: SearchQueryPlan, group: SearchPlanGroup): string {
  return buildFtsColumnMatch(searchScopeColumns(plan.scope), ftsGroupExpression(group));
}

/** UND-Bedingung einer Wortfolge im Suchbereich des Plans. */
export function planPhraseMatch(plan: SearchQueryPlan, phrase: string): string {
  return buildFtsColumnMatch(searchScopeColumns(plan.scope), ftsPhraseExpression(phrase));
}

/** Ausschlussausdruck: eine Vorschrift, die einen dieser Begriffe trägt, fällt heraus. */
export function planExcludeMatch(plan: SearchQueryPlan): string | null {
  if (plan.excludeTokens.length === 0) return null;
  return plan.excludeTokens.map((group) => ftsGroupExpression(group)).join(' OR ');
}

/** Alle Begriffsgruppen in derselben Einheit – Rangstufe „Treffer in einer Vorschrift“. */
export function planUnitMatch(plan: SearchQueryPlan): string | null {
  const parts = [
    ...plan.tokenGroups.map((group) => ftsGroupExpression(group)),
    ...plan.phrases.map((phrase) => ftsPhraseExpression(phrase)).filter(Boolean),
  ];
  if (parts.length < 2) return null;
  return buildFtsColumnMatch(searchScopeColumns(plan.scope), `(${parts.join(' AND ')})`);
}

/** Alle Begriffsgruppen im Titelbereich – Rangstufe „Titel“ und Ausnahme für Änderungsvorschriften. */
export function planTitleMatch(plan: SearchQueryPlan): string | null {
  const parts = [
    ...plan.tokenGroups.map((group) => ftsGroupExpression(group)),
    ...plan.phrases.map((phrase) => ftsPhraseExpression(phrase)).filter(Boolean),
  ];
  if (parts.length === 0) return null;
  return buildFtsColumnMatch('{title short_title abbr}', `(${parts.join(' AND ')})`);
}

function planGroupsOf(tokens: QueryToken[]): SearchPlanGroup[] {
  return tokens.flatMap((token) => {
    const variants = [...new Set([token.value, ...token.variants])].filter((variant) => variant.length >= 2);
    return variants.length > 0 ? [{ variants, prefix: token.prefix }] : [];
  });
}

/**
 * Suchplan aus dem Suchzustand. Reine Funktion ohne Zugriff auf den Bestand: ob eine Anfrage die
 * Bezeichnung einer Vorschrift genau trifft, entscheidet erst die Abfrage über die
 * Bezeichnungsspalten; die Normtyp-Absicht bleibt eine Absicht.
 */
export function buildSearchQueryPlan(state: NormSearchState): SearchQueryPlan {
  const query = parseNormSearchQuery(state.q, { allowTypeIntent: true });
  const exactPhrase = state.exact.replaceAll('*', '').trim();
  const phrases = [...query.phrases, ...(exactPhrase ? [exactPhrase] : [])];
  const raw = normalizeSearchText(state.q.replace(PUBLICATION_REFERENCE_PATTERN, ' '));
  PUBLICATION_REFERENCE_PATTERN.lastIndex = 0;
  const typeOnly = query.typeIntent && !hasSearchTerms(query) ? query.typeIntent.type : undefined;
  return {
    tokenGroups: planGroupsOf(query.tokens),
    phrases,
    excludeTokens: planGroupsOf(parseQueryTokens(state.exclude)),
    references: query.references,
    ...(typeOnly ? { typeOnly } : {}),
    ...(query.typeIntent ? { typeIntent: query.typeIntent } : {}),
    identityValues: state.q.trim() ? [state.q.trim()] : [],
    ...(words(raw).length > 1 ? { titlePhrase: raw } : {}),
    ...(state.citation.trim() ? { citationPhrase: state.citation.trim() } : {}),
    scope: state.scope,
    sort: getActiveSearchSort(state),
    freeText: hasFreeTextQuery(state),
    hasPublicationReference: query.hasPublicationReference,
  };
}

/**
 * Textausschnitt eines Treffers: ohne die eigene Überschrift, ohne Zeilenumbrüche, an einer
 * Wortgrenze gekürzt. Der Überschriftvorspann wird als Übergangsregel abgeschnitten, solange
 * gespeicherte Einheiten ihn noch im Text führen (collectBodyContent schreibt ihn nicht mehr).
 */
export function buildSearchSnippet(
  unit: { label?: string; title?: string; text?: string },
  limit = 300,
): string {
  const collapse = (value: string | undefined): string => (value ?? '').replace(/\s+/gu, ' ').trim();
  let text = collapse(unit.text);
  const label = collapse(unit.label);
  const title = collapse(unit.title);
  for (const prefix of [[label, title].filter(Boolean).join(' '), title, label]) {
    if (!prefix || text.length <= prefix.length) continue;
    if (text.slice(0, prefix.length).toLocaleLowerCase('de-DE') !== prefix.toLocaleLowerCase('de-DE')) continue;
    text = text.slice(prefix.length).replace(/^[\s:.–—-]+/u, '');
    break;
  }
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const boundary = cut.lastIndexOf(' ');
  return `${(boundary > limit / 2 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}

/**
 * Ausgabe, deren Bezeichnung die Anfrage wörtlich nennt („OGVBl. 2026 Nr. 73“). Sie steht als
 * Direkttreffer über der Trefferliste.
 */
export function findPublicationDirectHit(publications: SearchPublication[], query: string): SearchPublication | undefined {
  const queryForms = buildSearchVariants(query);
  if (queryForms.length === 0) return undefined;
  return publications.find((publication) => [publication.designation, ...publication.aliases]
    .some((designation) => buildSearchVariants(designation).some((value) => queryForms.includes(value))));
}

export const SEARCH_FACETS = ['type', 'origin', 'ministry', 'subject', 'status', 'publicationSource', 'publicationYear'] as const;
export type SearchFacet = typeof SEARCH_FACETS[number];

/** Facettenzähler der Suche: je Facette die Zahl passender Vorschriften nach Facettenwert. */
export type SearchFacetCounts = Record<SearchFacet, Record<string, number>>;

/** Ein Treffer der Such-API: eine Vorschrift mit ihrer bestbewerteten Fassung. */
export interface SearchHit {
  slug: string;
  url: string;
  currentUrl: string;
  versionId: string;
  versionKind: VersionTemporalKind;
  isCurrent: boolean;
  isAmendment: boolean;
  title: string;
  shortTitle: string;
  abbr: string;
  type: string;
  typeLabel: string;
  origin: string;
  status: string;
  statusLabel: string;
  citation: string;
  publication: string;
  publicationSlug?: string;
  publicationUrl?: string;
  publicationTitle?: string;
  publicationIssue?: string;
  publicationSource?: string;
  publicationYear?: string;
  ministry: string;
  validFrom: string;
  validTo: string | null;
  lastChangeDate?: string;
  matchKind: SearchMatchKind;
  matchLabel: string;
  /** Textausschnitt der Trefferstelle, höchstens 300 Zeichen, ohne die eigene Überschrift. */
  snippet: string;
  unitLabel?: string;
  unitTitle?: string;
  unitAnchor?: string;
  unitType?: string;
  /** Weitere passende Fassungen derselben Vorschrift. */
  otherVersions: Array<{ versionId: string; versionKind: VersionTemporalKind; validFrom: string; url: string; matchLabel: string }>;
}
