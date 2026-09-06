import type { APIRoute } from 'astro';

import {
  buildFtsMatch,
  buildSearchQueryPlan,
  buildSearchSnippet,
  buildSearchVariants,
  findPublicationDirectHit,
  getActiveSearchSort,
  groupNormSearchResults,
  levenshteinDistance,
  normalizeSearchText,
  prepareSearchDocuments,
  runNormSearch,
  type NormSearchState,
  type ScoredSearchResult,
  type SearchHit,
  type SearchScope,
  type SortKey,
  type VersionScope,
} from '@ostrecht/recht-search/search-query.ts';
import type { SearchHitUnit, SearchIndexDocument, SearchPublication } from '@ostrecht/recht-search/search.ts';
import { NORM_ORIGIN_KINDS, type NormOriginKind } from '@ostrecht/shared/lib/norms/origin.ts';
import { getSubjectSlug } from '@ostrecht/shared/lib/norms/routes.ts';
import { NORM_STATUSES } from '@ostrecht/shared/lib/norms/schema.ts';
import { EDITORIAL_REFERENCE_DATE, VERSION_TEMPORAL_KINDS } from '@ostrecht/shared/lib/norms/versions.ts';

import { getNormStore } from '../../lib/runtime/context.ts';

/**
 * Trefferseite der Rechtssuche aus der D1-Projektion.
 *
 * Auswahl, Ausschluss, Reihenfolge und Zählung laufen vollständig in SQL: der Suchplan
 * (packages/recht-search/src/search-query.ts) übersetzt Suchbegriffe, Wortfolgen,
 * Ausschlussbegriffe, Strukturadressen und die Regel für Änderungsvorschriften in Bedingungen
 * über den Volltextindex und die schmalen Spalten der Projektion. `total` ist deshalb die
 * genaue Zahl der Treffer, `offset`/`limit` blättern echt.
 *
 * Nur für die Seite von höchstens 100 Vorschriften läuft anschließend dieselbe feldbewusste
 * Bewertung wie bisher (runNormSearch) – sie liefert Trefferart, beste Trefferstelle und weitere
 * passende Fassungen. Die Reihenfolge bleibt die der Abfrage; eine Vorschrift, die die Bewertung
 * nicht wiederfindet, wird als Volltexttreffer geliefert und nie stillschweigend weggelassen.
 */
export const prerender = false;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_OFFSET = 5000;
/** Einheiten je Vorschrift für Trefferstelle und Ausschnitt; der ganze Normtext wird nie geladen. */
const UNITS_PER_NORM = 8;
const SNIPPET_LIMIT = 300;

/** Herkunftsfilter der Anfrage: nur bekannte Herkunftsarten, ohne Duplikate; Unbekanntes wird ignoriert (fail-safe). */
export function parseOriginFilter(values: string[]): NormOriginKind[] {
  const known = new Set<string>(NORM_ORIGIN_KINDS);
  return [...new Set(values.filter((value) => known.has(value)))] as NormOriginKind[];
}

/** Freitextwerte eines Mehrfachfilters: entdoppelt, begrenzt und ohne leere Einträge. */
export function parseListFilter(values: string[], { limit = 40, maxLength = 120 } = {}): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean).map((value) => value.slice(0, maxLength)))].slice(0, limit);
}

/** Kalenderdatum der Anfrage (ISO); alles andere schränkt nicht ein. */
export function parseDateFilter(value: string | null): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : undefined;
}

/** Fassungsart der Anfrage; unbekannte Werte schränken nicht ein. */
export function parseVersionScope(value: string | null): VersionScope | undefined {
  if (value === 'all') return 'all';
  return (VERSION_TEMPORAL_KINDS as readonly string[]).includes(value ?? '') ? value as VersionScope : undefined;
}

/** Suchbereich der Anfrage; unbekannte Werte suchen über alle Inhalte. */
export function parseScope(value: string | null): SearchScope {
  return value === 'title' || value === 'metadata' || value === 'body' ? value : 'all';
}

/** Sortierung der Anfrage; ohne ausdrückliche Wahl entscheidet der Suchzustand. */
export function parseSort(value: string | null): { sort: SortKey; explicit: boolean } {
  const known = ['activity', 'publication', 'relevance', 'title', 'rechtsstand'];
  return known.includes(value ?? '')
    ? { sort: value as SortKey, explicit: true }
    : { sort: 'activity', explicit: false };
}

/** Seitengröße der Anfrage: Standard 20, höchstens 100 (Prüfungen und Werkzeuge). */
export function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

/**
 * Ausgaben, deren Bezeichnung in der Anfrage vorkommt (OGVBl. 2026 Nr. 73, OVertrBl. 2026 Nr. 4,
 * auch ohne Punkte oder als Langtitel). Der Volltextindex enthält die Fundstelle erst mit der
 * Metadateneinheit; die Vorschriften einer zitierten Ausgabe werden deshalb unabhängig davon
 * Treffer (Wortgrenzen, damit „Nr. 4“ nicht „Nr. 40“ trifft).
 */
export function citedPublications(query: string, publications: SearchPublication[]): SearchPublication[] {
  const haystacks = buildSearchVariants(query).filter(Boolean).map((variant) => ` ${variant} `);
  if (haystacks.length === 0) return [];
  return publications.filter((publication) => [publication.designation, ...(publication.aliases ?? [])]
    .flatMap((designation) => buildSearchVariants(designation))
    .some((variant) => variant.length >= 6 && haystacks.some((haystack) => haystack.includes(` ${variant} `))));
}

/** Suchzustand aus den Anfrageparametern; dieselben Namen wie in der Adresse der Suchseite. */
function readState(params: URLSearchParams): NormSearchState {
  const { sort, explicit } = parseSort(params.get('sort'));
  const versionScope = parseVersionScope(params.get('versionScope'));
  const state: NormSearchState = {
    q: (params.get('q') ?? '').slice(0, 200),
    exclude: (params.get('exclude') ?? '').slice(0, 200),
    exact: (params.get('exact') ?? '').slice(0, 200),
    scope: parseScope(params.get('scope')),
    types: params.getAll('type').filter((value) => /^[a-z-]+$/u.test(value)).slice(0, 12),
    ministries: parseListFilter(params.getAll('ministry')),
    subjects: parseListFilter(params.getAll('subject')),
    statuses: params.getAll('status').filter((value) => (NORM_STATUSES as readonly string[]).includes(value)),
    origins: parseOriginFilter(params.getAll('origin')),
    versionScope: versionScope ?? 'current',
    versionScopeExplicit: params.has('versionScope'),
    includeAmendments: params.get('includeAmendments') === '1',
    geltungstag: parseDateFilter(params.get('geltungstag')) ?? '',
    validFrom: parseDateFilter(params.get('validFrom')) ?? '',
    validTo: parseDateFilter(params.get('validTo')) ?? '',
    citation: (params.get('citation') ?? '').slice(0, 120),
    publicationSources: parseListFilter(params.getAll('publicationSource')),
    publicationYears: parseListFilter(params.getAll('publicationYear'), { limit: 60, maxLength: 4 }),
    publicationIssue: (params.get('publicationIssue') ?? '').trim().slice(0, 40),
    publicationPage: (params.get('publicationPage') ?? '').trim().slice(0, 40),
    sort,
    sortExplicit: explicit,
  };
  return { ...state, sort: getActiveSearchSort(state) };
}

/** Treffereinheiten eines Suchdokuments aus den gelieferten Zeilen der Projektion. */
function toSearchDocument(candidate: { document: SearchIndexDocument; units: Array<{ blockType: string; label: string; heading: string; body: string; anchor: string; references?: SearchHitUnit['references'] }> }): SearchIndexDocument {
  return {
    ...candidate.document,
    hitUnits: candidate.units
      // Ergänzungstext und Metadateneinheit sind Suchtext, aber keine Trefferstelle.
      .filter((unit) => unit.blockType !== 'supplement' && unit.blockType !== 'metadata')
      .map((unit): SearchHitUnit => ({
        type: unit.blockType,
        label: unit.label,
        title: unit.heading,
        text: unit.body,
        anchor: unit.anchor,
        ...(unit.references ? { references: unit.references } : {}),
      })),
    bodySupplement: candidate.units.find((unit) => unit.blockType === 'supplement')?.body ?? '',
  };
}

/** Ein Treffer der Antwort: die bestbewertete Fassung einer Vorschrift mit Ausschnitt. */
function toHit(primary: ScoredSearchResult, others: ScoredSearchResult[]): SearchHit {
  const entry = primary.documentEntry;
  const unit = primary.bestHitUnit ?? entry.hitUnits[0];
  const snippet = buildSearchSnippet(unit ?? { text: entry.summary }, SNIPPET_LIMIT) || buildSearchSnippet({ text: entry.summary }, SNIPPET_LIMIT);
  return {
    slug: entry.slug,
    url: entry.url,
    currentUrl: entry.currentUrl,
    versionId: entry.versionId,
    versionKind: entry.versionKind,
    isCurrent: entry.isCurrent,
    isAmendment: entry.isAmendment,
    title: entry.title,
    shortTitle: entry.shortTitle,
    abbr: entry.abbr,
    type: entry.type,
    typeLabel: entry.typeLabel,
    origin: entry.origin,
    status: entry.status,
    statusLabel: entry.statusLabel,
    citation: entry.citation,
    publication: entry.publication,
    ...(entry.publicationSlug ? { publicationSlug: entry.publicationSlug } : {}),
    ...(entry.publicationUrl ? { publicationUrl: entry.publicationUrl } : {}),
    ...(entry.publicationTitle ? { publicationTitle: entry.publicationTitle } : {}),
    ...(entry.publicationIssue ? { publicationIssue: entry.publicationIssue } : {}),
    ...(entry.publicationSource ? { publicationSource: entry.publicationSource } : {}),
    ...(entry.publicationYear ? { publicationYear: entry.publicationYear } : {}),
    ministry: entry.ministry,
    validFrom: entry.validFrom,
    validTo: entry.validTo,
    ...(entry.lastChangeDate ? { lastChangeDate: entry.lastChangeDate } : {}),
    matchKind: primary.matchKind,
    matchLabel: primary.matchLabel,
    snippet,
    ...(unit?.label ? { unitLabel: unit.label } : {}),
    ...(unit?.title ? { unitTitle: unit.title } : {}),
    ...(unit?.anchor ? { unitAnchor: unit.anchor } : {}),
    ...(unit?.type ? { unitType: unit.type } : {}),
    otherVersions: others.map((other) => ({
      versionId: other.documentEntry.versionId,
      versionKind: other.documentEntry.versionKind,
      validFrom: other.documentEntry.validFrom,
      url: other.documentEntry.url,
      matchLabel: other.matchLabel,
    })),
  };
}

/**
 * Ähnliche Titel, wenn die Anfrage keinen Treffer hat: nur bei einem Suchwort ab sechs Zeichen
 * ohne Platzhalter, und nur dann werden die Bezeichnungen des Bestands überhaupt gelesen.
 */
function fuzzySlugs(suggestions: Array<{ slug: string; title: string; shortTitle: string; abbr: string }>, query: string): string[] {
  const tokens = normalizeSearchText(query).split(' ').filter((token) => token.length >= 6 && !token.includes('*'));
  if (tokens.length === 0) return [];
  return suggestions.flatMap((suggestion) => {
    const words = new Set([suggestion.title, suggestion.shortTitle, suggestion.abbr]
      .flatMap((value) => normalizeSearchText(value).split(' ')).filter(Boolean));
    const similar = tokens.every((token) => [...words].some((word) =>
      Math.abs(word.length - token.length) <= 2 && levenshteinDistance(word, token) <= 2));
    return similar ? [suggestion.slug] : [];
    // D1 bindet höchstens 100 Werte je Abfrage; mehr ähnliche Titel wären ohnehin keine Hilfe.
  }).slice(0, 60);
}

export const GET: APIRoute = async ({ url, locals }) => {
  const store = await getNormStore(locals);
  const params = url.searchParams;
  const requested = readState(params);
  const offset = Math.min(Math.max(Number.parseInt(params.get('offset') ?? '0', 10) || 0, 0), MAX_OFFSET);
  const limit = parseLimit(params.get('limit'));
  const wantsFacets = params.get('facets') === '1' && offset === 0;

  // Nennt die Anfrage eine Ausgabe, sind deren Vorschriften unmittelbare Treffer; ohne
  // ausdrückliche Wahl der Fassungsart gilt dafür der volle Fassungsbestand.
  const publications = await store.listSearchPublications();
  const cited = citedPublications([requested.q, requested.citation].filter(Boolean).join(' '), publications).slice(0, 3);
  const citedSlugs = [...new Set((await Promise.all(cited.map((publication) => store.getPublication(publication.slug))))
    .flatMap((publication) => (publication?.entries ?? []).map((entry) => entry.normSlug).filter((slug): slug is string => Boolean(slug))))];
  const state: NormSearchState = citedSlugs.length > 0 && requested.versionScopeExplicit !== true
    ? { ...requested, versionScope: 'all' }
    : requested;
  const plan = buildSearchQueryPlan(state);
  const match = buildFtsMatch(plan);
  // Ohne Suchtext braucht die Trefferstelle keinen Ausdruck; eine Anfrage nach einer
  // Strukturadresse („§ 2a“) liest die Einheiten trotzdem, damit der Ausschnitt sie zeigen kann.
  const unitsMatch = match ?? (plan.references.length > 0 ? null : undefined);
  const query = {
    match,
    limit,
    offset,
    types: state.types,
    origins: state.origins as NormOriginKind[],
    ministries: state.ministries,
    subjectSlugs: state.subjects.map((subject) => getSubjectSlug(subject)),
    statuses: state.statuses,
    publicationSources: state.publicationSources,
    publicationYears: state.publicationYears,
    ...(state.geltungstag ? { validOn: state.geltungstag } : {}),
    ...(state.validFrom ? { validFrom: state.validFrom } : {}),
    ...(state.validTo ? { validTo: state.validTo } : {}),
    ...(state.versionScope !== 'all' ? { versionScope: state.versionScope } : {}),
    includeAmendments: state.includeAmendments,
    plan,
    sort: state.sort,
    ...(state.publicationIssue ? { publicationIssue: state.publicationIssue } : {}),
    ...(state.publicationPage ? { publicationPage: state.publicationPage } : {}),
    citedSlugs,
    state,
  };

  const [page, facets] = await Promise.all([
    store.searchCandidates(query),
    wantsFacets ? store.countSearchFacets(query) : Promise.resolve(undefined),
  ]);

  // Ähnlichkeitsstufe: erst wenn die Anfrage nichts trifft, werden die Bezeichnungen gelesen.
  let { slugs, total } = page;
  let fuzzy = false;
  if (total === 0 && state.q.trim()) {
    const similar = fuzzySlugs(await store.listSearchSuggestions(), state.q);
    if (similar.length > 0) {
      const fallback = await store.searchCandidates({ ...query, match: null, plan: undefined, citedSlugs: [], restrictSlugs: similar });
      slugs = fallback.slugs;
      total = fallback.total;
      fuzzy = total > 0;
    }
  }

  const candidates = await store.getSearchDocuments(slugs, unitsMatch, { unitsPerNorm: UNITS_PER_NORM });
  const documents = candidates.map(toSearchDocument);
  // Bewertung nur über die Seite: Trefferart, beste Trefferstelle und weitere passende Fassungen.
  // Über die Zugehörigkeit hat die Abfrage bereits entschieden; die Bewertung beschriftet nur noch.
  const evaluationState: NormSearchState = { ...state, includeAmendments: true };
  const evaluated = new Map(groupNormSearchResults(runNormSearch(prepareSearchDocuments(documents), evaluationState), evaluationState)
    .map((group) => [group.slug, group.entries]));
  const documentsBySlug = new Map<string, SearchIndexDocument[]>();
  for (const document of documents) documentsBySlug.set(document.slug, [...(documentsBySlug.get(document.slug) ?? []), document]);

  const hits = slugs.flatMap((slug): SearchHit[] => {
    const entries = evaluated.get(slug);
    if (entries && entries.length > 0) {
      const [primary, ...others] = entries;
      return [toHit(fuzzy ? { ...primary, matchKind: 'fuzzy', matchLabel: 'Ähnlicher Titel' } : primary, others)];
    }
    // Fail-safe: weicht die Bewertung von der Abfrage ab, bleibt die Vorschrift ein Treffer.
    const fallback = documentsBySlug.get(slug)?.find((document) => document.isCurrent) ?? documentsBySlug.get(slug)?.[0];
    if (!fallback) return [];
    return [toHit({
      documentEntry: fallback,
      score: 0,
      rank: [5],
      tier: 5,
      matchKind: fuzzy ? 'fuzzy' : 'body',
      matchLabel: fuzzy ? 'Ähnlicher Titel' : 'Volltexttreffer',
      ...(fallback.hitUnits[0] ? { bestHitUnit: fallback.hitUnits[0] } : {}),
    }, [])];
  });

  const directHit = state.q.trim() ? findPublicationDirectHit(publications, state.q) : undefined;
  return new Response(JSON.stringify({
    generatedAt: new Date().toISOString(),
    // Redaktioneller Stichtag der Anzeige: Fassungsbezeichnungen werden erst im Browser gebildet.
    referenceDate: EDITORIAL_REFERENCE_DATE,
    query: {
      q: state.q,
      exact: state.exact,
      exclude: state.exclude,
      citation: state.citation,
      scope: state.scope,
      types: state.types,
      origins: state.origins,
      ministries: state.ministries,
      subjects: state.subjects,
      statuses: state.statuses,
      publicationSources: state.publicationSources,
      publicationYears: state.publicationYears,
      publicationIssue: state.publicationIssue,
      publicationPage: state.publicationPage,
      validOn: state.geltungstag || undefined,
      validFrom: state.validFrom || undefined,
      validTo: state.validTo || undefined,
      versionScope: state.versionScope,
      includeAmendments: state.includeAmendments,
      sort: state.sort,
    },
    total,
    offset,
    limit,
    countExact: true,
    hits,
    ...(facets ? { facets } : {}),
    ...(directHit ? { publicationDirectHit: { slug: directHit.slug, url: directHit.url, designation: directHit.designation, title: directHit.title } } : {}),
    ...(plan.typeIntent ? { typeIntent: { type: plan.typeIntent.type, label: plan.typeIntent.label } } : {}),
  }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=600',
    },
  });
};
