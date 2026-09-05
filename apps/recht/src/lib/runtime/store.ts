import {
  parseNormHistory,
  parseNormMeta,
  parseNormVersion,
  validateNormRecord,
  type HistoryEntryType,
  type NormRecord,
  type NormStatus,
  type NormType,
  type NormVersion,
} from '@ostrecht/shared/lib/norms/schema.ts';
import { classifyNormVersion, getApplicableVersion, getNormLastActivityDate, validateVersionIntervals } from '@ostrecht/shared/lib/norms/versions.ts';
import {
  buildDerivedContext,
  deriveNorm,
  fullCitationFor,
  identityFor,
  type DerivedContext,
  type NormDerivedData,
} from '@ostrecht/shared/lib/norms/derived.ts';
import { getNormVersionIdentity } from '@ostrecht/shared/lib/norms/identity.ts';
import { getNormOriginInfo, type NormOriginKind } from '@ostrecht/shared/lib/norms/origin.ts';
import { getGermanIndexLetter, getNormUrl, getSubjectAreaGroups, getSubjectGroups, getSubjectSlug } from '@ostrecht/shared/lib/norms/routes.ts';
import { formatNormType, toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';
import type { NormPublicationReference, Verkuendung } from '@ostrecht/shared/lib/norms/publications.ts';
import {
  buildFilterOptions,
  buildSearchPublications,
  getNormAliases,
  type SearchFilterOptions,
  type SearchIndexDocument,
  type SearchPublication,
  type SearchSuggestion,
} from '@ostrecht/recht-search/search.ts';

import type { D1Database } from './d1-types.ts';

/**
 * Datenzugriff von OstRecht zur Laufzeit.
 *
 * Die produktive Implementierung liest ausschließlich aus Cloudflare D1, der aus
 * `content/normen` abgeleiteten Runtime-Projektion (Schema data/recht/d1/*.sql,
 * Sync scripts/sync-recht-d1.mjs). Für lokale Entwicklung, Prerendering und Tests
 * ohne Binding steht eine Dateivariante bereit, die denselben Ableitungscode nutzt.
 * Git bleibt fachlicher Source of Truth; D1 ist die Projektion.
 *
 * Kostenregel: keine Route lädt den vollständigen Korpus. Übersichten arbeiten mit
 * NormSummary-Zeilen (schmale Spalten von law_norms, SQL-Filter über Indizes),
 * korpusweite Zähler und Gruppierungen liest der Store als einzelne Metadatenzeilen,
 * die der Sync vorberechnet; Normkörper werden nur für die angefragte Norm und
 * Fassung gelesen. D1 zählt gelesene Zeilen – jede Methode dokumentiert deshalb,
 * welche Zeilen sie liest.
 */

export type BodySelection = 'none' | 'current' | 'all' | string[];

/** Schmale Übersichtsdaten einer Norm (Bezeichnungen der geltenden Fassung). */
export interface NormSummary {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  abbr?: string;
  summary: string;
  type: NormType;
  status: NormStatus;
  subjects: string[];
  primarySubject?: string;
  keywords: string[];
  /** Bezeichnungen anderer Fassungen (Autovervollständigung, Stichwortindex). */
  aliases: string[];
  responsibleMinistry?: string;
  currentVersionId: string;
  currentValidFrom: string;
  documentDate?: string;
  originKind?: NormOriginKind;
  originBaselineVersionId?: string;
  originLastOwnChangeDate?: string;
  versionCount: number;
  lastChangeDate?: string;
}

export interface NormSummaryQuery {
  types?: string[];
  statuses?: string[];
  subjectSlug?: string;
}

/**
 * Sortierung von Übersichten: `activity` = jüngstes Rechtsereignis zuerst
 * (law_norms.last_change_date, dann Titel), `title` = alphabetisch (A–Z-Index).
 */
export type NormSummarySort = 'activity' | 'title';

/** Seitenweise Übersichtsabfrage (A–Z, Rechtsentwicklung): alle Filter laufen serverseitig. */
export interface NormPageQuery extends NormSummaryQuery {
  /** Buchstabengruppe des Titels (A–Z oder '#', siehe getGermanIndexLetter). */
  letter?: string;
  /** Freitext über Titel, Kurzbezeichnung, Abkürzung und Stichwörter (Teilstring, groß/klein egal). */
  q?: string;
  originKind?: NormOriginKind;
  /** Sachgebiet (Anzeigename). */
  subject?: string;
  /** 1-basierte Seite. */
  page?: number;
  pageSize?: number;
  /** Standard `title` (A–Z); Übersichten ohne Buchstabenbezug sortieren nach `activity`. */
  sort?: NormSummarySort;
}

export interface NormPage {
  items: NormSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface IndexLetterCount {
  letter: string;
  count: number;
}

/** Eingrenzung der Buchstabenzähler auf ein Verzeichnis (Normtyp, Sachgebiet, Herkunft). */
export type IndexLetterQuery = Pick<NormPageQuery, 'types' | 'subjectSlug' | 'originKind'>;

export interface KeywordIndexEntry {
  keyword: string;
  norms: Array<{ slug: string; shortTitle: string }>;
}

/** Seitenweise Abfrage des Stichwortindex einer Buchstabengruppe (Filter als Teilstring, Seiten über Stichwörter). */
export interface KeywordIndexQuery {
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface KeywordIndexPage {
  entries: KeywordIndexEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export const DEFAULT_PAGE_SIZE = 50;
/** Stichwortseiten des A–Z: dieselbe Seitengröße wie die Vorschriften, damit ein Aufruf nie mehr als
 *  50 Einträge je Liste rendert (Befund P4); beide Paginierungen bleiben unabhängig. */
export const KEYWORD_PAGE_SIZE = DEFAULT_PAGE_SIZE;
export const MAX_PAGE_SIZE = 100;

/** Seitenparameter absichern: ganze Zahlen, Seite ≥ 1, Größe 1–MAX_PAGE_SIZE. */
export function normalizePage(page: unknown, pageSize: unknown = DEFAULT_PAGE_SIZE): { page: number; pageSize: number } {
  const parsedPage = Number.parseInt(String(page ?? '1'), 10);
  const parsedSize = Number.parseInt(String(pageSize ?? DEFAULT_PAGE_SIZE), 10);
  return {
    page: Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1,
    pageSize: Number.isFinite(parsedSize) && parsedSize >= 1 ? Math.min(parsedSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE,
  };
}

/** Freitext für den Vergleich: getrimmt, deutsch kleingeschrieben, Mehrfachleerraum reduziert. */
export function normalizeQueryText(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('de-DE').replace(/\s+/gu, ' ');
}

export interface SubjectSummary {
  name: string;
  slug: string;
  normCount: number;
}

export interface SubjectAreaSummary {
  name: string;
  description: string;
  normCount: number;
  subjects: SubjectSummary[];
}

export interface CorpusStats {
  normCount: number;
  inForceCount: number;
  publicationCount: number;
  types: NormType[];
  statuses: NormStatus[];
}

export interface NormVersionSummary {
  slug: string;
  versionId: string;
  validFrom: string;
  temporalKind: ReturnType<typeof classifyNormVersion>;
}

/** Historieneintrag samt Bezeichnung der Norm (Startseite, Rechtsentwicklung). */
export interface NormChange {
  slug: string;
  normTitle: string;
  normShortTitle: string;
  type: NormType;
  /** Rechtsherkunft der geänderten Norm (law_norms.origin_kind). */
  originKind?: NormOriginKind;
  date: string;
  changeType: HistoryEntryType;
  title: string;
  citation: string;
  note?: string;
  affectingVersionId?: string | null;
  relatedNorm?: string | null;
}

export interface ChangeQuery {
  changeTypes: HistoryEntryType[];
  /** Nur Einträge bis einschließlich dieses Datums. */
  until?: string;
  /** Nur Einträge nach diesem Datum. */
  after?: string;
  order: 'asc' | 'desc';
  limit: number;
  /** Je Norm nur das jeweils jüngste (desc) bzw. nächste (asc) Ereignis der gewählten Typen. */
  distinctNorms?: boolean;
}

export interface SearchUnitRow {
  normId: string;
  versionId: string;
  unitIndex: number;
  anchor: string;
  blockType: string;
  label: string;
  heading: string;
  body: string;
  references?: { paragraph?: string; article?: string; subsections?: string[] };
}

export interface SearchCandidate {
  document: SearchIndexDocument;
  units: SearchUnitRow[];
}

export interface NormStore {
  readonly kind: 'd1' | 'files';
  /** Übersichtszeilen; Filter laufen als SQL (Typ, Status, Sachgebiet). Liest nur law_norms(+aktuelle Fassungszeile). */
  listNormSummaries(query?: NormSummaryQuery): Promise<NormSummary[]>;
  listNormSummariesByType(type: NormType): Promise<NormSummary[]>;
  /** Eine Seite Übersichtszeilen mit Gesamtzahl; Filter (Buchstabe, Freitext, Herkunft, Typ, Status, Sachgebiet) laufen als SQL mit LIMIT/OFFSET. */
  queryNormSummaries(query: NormPageQuery): Promise<NormPage>;
  /**
   * Buchstabengruppen mit Zählern (GROUP BY index_letter; höchstens 27 Zeilen). Ohne Filter aus
   * der Metadatenzeile; mit Filter (Normtyp, Sachgebiet, Herkunft) die Zähler des jeweiligen
   * Verzeichnisses, damit die Buchstabenleiste nur belegte Gruppen als Sprungziel anbietet.
   */
  listIndexLetters(query?: IndexLetterQuery): Promise<IndexLetterCount[]>;
  /** Stichwortindex einer Buchstabengruppe (Abkürzungen, Kurzbezeichnungen, Schlagwörter), seitenweise über Stichwörter. */
  listKeywordIndex(letter: string, query?: KeywordIndexQuery): Promise<KeywordIndexPage>;
  /** Normen je Herkunftsart (GROUP BY origin_kind; vier Zeilen). */
  countByOriginKind(): Promise<Partial<Record<NormOriginKind, number>>>;
  /** Übersichtszeilen einer Slug-Liste (Verkündungs- und Fundstellenseiten). */
  getNormSummaries(slugs: string[]): Promise<Map<string, NormSummary>>;
  /** Fassungsübersicht (Slug, Fassung, Beginn, zeitliche Einordnung); optional auf Slugs eingeschränkt. */
  listVersionSummaries(options?: { slugs?: string[] }): Promise<NormVersionSummary[]>;
  /** Historieneinträge korpusweit, nach Datum über Index; nur die angeforderte Anzahl. */
  listChanges(query: ChangeQuery): Promise<NormChange[]>;
  /** Sachgebiete mit Zählern (eine Metadatenzeile). */
  listSubjectSummaries(): Promise<SubjectSummary[]>;
  /** Hauptbereiche mit Sachgebieten und Zählern (eine Metadatenzeile). */
  listSubjectAreas(): Promise<SubjectAreaSummary[]>;
  /** Bestandszahlen (eine Metadatenzeile). */
  getCorpusStats(): Promise<CorpusStats>;
  /** Autovervollständigung: Bezeichnungen und Aliasse der geltenden Fassungen aus law_norms. */
  listSearchSuggestions(): Promise<SearchSuggestion[]>;
  /** Filteroptionen und Dokumentzahl der Suche (Metadatenzeilen). */
  getSearchFilters(): Promise<{ filters: SearchFilterOptions; documentCount: number }>;
  /** Verkündungsdaten für die Suche (eine Metadatenzeile statt aller Verkündungs-JSONs). */
  listSearchPublications(): Promise<SearchPublication[]>;
  /** Eine Norm; Normkörper nur für die gewünschten Fassungen. */
  getNorm(slug: string, bodies?: BodySelection): Promise<NormRecord | null>;
  getDerived(slug: string): Promise<NormDerivedData | null>;
  getFullCitation(slug: string, versionId: string): Promise<string | undefined>;
  getPublicationReference(slug: string, versionId: string): Promise<NormPublicationReference | undefined>;
  /** Verkündungen, neueste zuerst (nur law_publications; lädt keine Normen); optional begrenzt. */
  listPublications(options?: { limit?: number }): Promise<Verkuendung[]>;
  getPublication(slug: string): Promise<Verkuendung | null>;
  /** Suchdokumente der gewünschten Normen (alle Fassungen) samt Provisionen der geltenden Fassung. */
  /** `unitsMatch`: FTS-Ausdruck, auf den die gelieferten Provisionen eingeschränkt werden; null = alle Provisionen; undefined = keine. */
  getSearchDocuments(slugs: string[], unitsMatch: string | null | undefined): Promise<SearchCandidate[]>;
  /** Kandidatenmenge der Suche; Normtyp und Rechtsherkunft (`origins`, law_norms.origin_kind) filtern bereits serverseitig, damit total und Pagination den Filter berücksichtigen. */
  searchCandidates(query: { match: string | null; limit: number; offset: number; types?: string[]; origins?: NormOriginKind[] }): Promise<{ slugs: string[]; total: number }>;
  getRuntimeMeta(key: string): Promise<string | null>;
  /** Anzeigebezeichnungen (geltende Fassung) für eine Slug-Liste, z. B. Bezüge in Historieneinträgen. */
  getNormLabels(slugs: string[]): Promise<Map<string, { title: string; shortTitle: string }>>;
}

// ---------------------------------------------------------------------------
// Gemeinsame Hilfen
// ---------------------------------------------------------------------------

export function selectedVersionIds(record: NormRecord, bodies: BodySelection): Set<string> {
  if (bodies === 'none') return new Set();
  if (bodies === 'all') return new Set(record.versions.map((version) => version.versionId));
  if (bodies === 'current') {
    const current = getCurrentVersionId(record);
    return new Set(current ? [current] : []);
  }
  return new Set(bodies);
}

function getCurrentVersionId(record: NormRecord): string | undefined {
  // Die geltende Fassung bestimmt zentral versions.ts; hier nur der Zugriffspfad.
  return record.versions.find((version) => version.isCurrent)?.versionId ?? record.versions.at(-1)?.versionId;
}

/** ORDER BY einer Übersicht: jüngstes Rechtsereignis zuerst (fehlende Werte zuletzt) oder Titel. */
export function summaryOrderBy(sort: NormSummarySort = 'title'): string {
  return sort === 'activity'
    ? '(n.last_change_date IS NULL), n.last_change_date DESC, n.sort_title, n.slug'
    : 'n.sort_title, n.slug';
}

/** Vergleich für `activity`-Sortierung in der Dateivariante (identische Reihenfolge wie summaryOrderBy). */
export function compareByActivity(left: NormSummary, right: NormSummary): number {
  const leftDate = left.lastChangeDate ?? '';
  const rightDate = right.lastChangeDate ?? '';
  return (leftDate === '' ? 1 : 0) - (rightDate === '' ? 1 : 0)
    || rightDate.localeCompare(leftDate)
    || left.title.toLocaleLowerCase('de').localeCompare(right.title.toLocaleLowerCase('de'), 'de')
    || left.slug.localeCompare(right.slug);
}

/** Übersichtszeile aus einem vollständigen Datensatz (Dateivariante, Tests, Sync-Vergleich). */
export function summarizeNormRecord(record: NormRecord, records: NormRecord[] = [record]): NormSummary {
  const current = getApplicableVersion(record);
  const identity = getNormVersionIdentity(record, current);
  const origin = getNormOriginInfo(record, records);
  // Jüngstes Rechtsereignis bis zum Stichtag (dieselbe Definition wie law_norms.last_change_date).
  const lastChangeDate = getNormLastActivityDate(record);
  return {
    id: record.meta.id,
    slug: record.meta.slug,
    title: identity.title,
    shortTitle: identity.shortTitle,
    ...(identity.abbr ? { abbr: identity.abbr } : {}),
    summary: identity.summary,
    type: record.meta.type,
    status: record.meta.status,
    subjects: [...record.meta.subjects],
    ...(record.meta.primarySubject ? { primarySubject: record.meta.primarySubject } : {}),
    keywords: [...record.meta.keywords],
    aliases: getNormAliases(record, identity),
    ...(record.meta.responsibleMinistry ?? record.meta.ministry ? { responsibleMinistry: record.meta.responsibleMinistry ?? record.meta.ministry } : {}),
    currentVersionId: current.versionId,
    currentValidFrom: current.validFrom,
    ...(record.meta.documentDate ? { documentDate: record.meta.documentDate } : {}),
    originKind: origin.kind,
    ...(origin.baselineVersionId ? { originBaselineVersionId: origin.baselineVersionId } : {}),
    ...(origin.lastOwnChangeDate ? { originLastOwnChangeDate: origin.lastOwnChangeDate } : {}),
    versionCount: record.versions.length,
    ...(lastChangeDate ? { lastChangeDate } : {}),
  };
}

export function suggestionFromSummary(summary: NormSummary): SearchSuggestion {
  return {
    slug: summary.slug,
    url: getNormUrl(summary.slug),
    title: toDisplayText(summary.title),
    shortTitle: toDisplayText(summary.shortTitle),
    abbr: toDisplayText(summary.abbr ?? ''),
    aliases: summary.aliases,
    typeLabel: formatNormType(summary.type),
  };
}

export function compareSummaryTitles(left: NormSummary, right: NormSummary): number {
  return left.title.localeCompare(right.title, 'de') || left.slug.localeCompare(right.slug);
}

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// D1-Implementierung
// ---------------------------------------------------------------------------

interface NormRow {
  id: string;
  slug: string;
  meta_json: string;
  history_json: string;
}

interface VersionRow {
  norm_id: string;
  version_id: string;
  version_json: string;
  full_citation: string | null;
  publication_ref_json: string | null;
}

interface SummaryRow {
  id: string;
  slug: string;
  title: string;
  short_title: string;
  abbr: string | null;
  summary: string;
  current_summary: string | null;
  type: NormType;
  status: NormStatus;
  subjects_json: string;
  primary_subject: string | null;
  keywords_json: string;
  aliases_json: string;
  responsible_ministry: string | null;
  current_version_id: string;
  current_valid_from: string;
  document_date: string | null;
  origin_kind: NormOriginKind | null;
  origin_baseline_version_id: string | null;
  origin_last_own_change_date: string | null;
  version_count: number;
  last_change_date: string | null;
}

export interface BlockRow {
  block_index: number;
  part_index: number;
  block_json: string;
}

const SUMMARY_SELECT = `SELECT n.id, n.slug, n.title, n.short_title, n.abbr, n.summary, v.summary AS current_summary, n.type, n.status,
  n.subjects_json, n.primary_subject, n.keywords_json, n.aliases_json, n.responsible_ministry, n.current_version_id, n.current_valid_from,
  n.document_date, n.origin_kind, n.origin_baseline_version_id, n.origin_last_own_change_date, n.version_count, n.last_change_date
  FROM law_norms n LEFT JOIN law_versions v ON v.norm_id = n.id AND v.version_id = n.current_version_id`;

function summaryFromRow(row: SummaryRow): NormSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortTitle: row.short_title,
    ...(row.abbr ? { abbr: row.abbr } : {}),
    summary: row.current_summary ?? row.summary,
    type: row.type,
    status: row.status,
    subjects: parseJsonArray(row.subjects_json),
    ...(row.primary_subject ? { primarySubject: row.primary_subject } : {}),
    keywords: parseJsonArray(row.keywords_json),
    aliases: parseJsonArray(row.aliases_json),
    ...(row.responsible_ministry ? { responsibleMinistry: row.responsible_ministry } : {}),
    currentVersionId: row.current_version_id,
    currentValidFrom: row.current_valid_from,
    ...(row.document_date ? { documentDate: row.document_date } : {}),
    ...(row.origin_kind ? { originKind: row.origin_kind } : {}),
    ...(row.origin_baseline_version_id ? { originBaselineVersionId: row.origin_baseline_version_id } : {}),
    ...(row.origin_last_own_change_date ? { originLastOwnChangeDate: row.origin_last_own_change_date } : {}),
    versionCount: Number(row.version_count ?? 0),
    ...(row.last_change_date ? { lastChangeDate: row.last_change_date } : {}),
  };
}

/** Isolate-weiter Cache korpusweiter Metadaten, gültig für einen Sync-Stand (last_sync_at). */
const metaCache: { syncedAt: string | null; entries: Map<string, unknown> } = { syncedAt: null, entries: new Map() };

function assembleRecord(row: NormRow, versionRows: VersionRow[], bodies: Map<string, unknown[]>): NormRecord {
  const meta = parseNormMeta(JSON.parse(row.meta_json), `${row.slug}/meta.json`);
  const history = parseNormHistory(JSON.parse(row.history_json), `${row.slug}/history.json`);
  const versions = versionRows.map((versionRow) => {
    const version = JSON.parse(versionRow.version_json) as Omit<NormVersion, 'body'>;
    return parseNormVersion({ ...version, body: bodies.get(versionRow.version_id) ?? [] }, `${row.slug}/versions/${versionRow.version_id}.json`);
  });
  const record = validateNormRecord({ meta, history, versions }, row.slug);
  validateVersionIntervals(record);
  return record;
}

export function assembleBlocks(rows: BlockRow[]): unknown[] {
  const parts = new Map<number, string[]>();
  for (const row of rows) {
    const list = parts.get(row.block_index) ?? [];
    list[row.part_index] = row.block_json;
    parts.set(row.block_index, list);
  }
  return [...parts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, pieces]) => JSON.parse(pieces.join('')));
}

export function createD1NormStore(db: D1Database): NormStore {
  const readMeta = async (key: string): Promise<string | null> =>
    (await db.prepare('SELECT value FROM law_runtime_meta WHERE key = ?').bind(key).first<{ value: string }>())?.value ?? null;

  /** Kleine korpusweite Metadaten je Sync-Stand zwischenspeichern (eine Zeile Prüfaufwand je Zugriff). */
  const cachedMeta = async <T>(key: string, loader: () => Promise<T>): Promise<T> => {
    const syncedAt = await readMeta('last_sync_at');
    if (metaCache.syncedAt !== syncedAt) {
      metaCache.syncedAt = syncedAt;
      metaCache.entries.clear();
    }
    if (metaCache.entries.has(key)) return metaCache.entries.get(key) as T;
    const value = await loader();
    metaCache.entries.set(key, value);
    return value;
  };

  const metaJson = async <T>(key: string, fallback: () => Promise<T>): Promise<T> =>
    cachedMeta(key, async () => {
      const raw = await readMeta(key);
      return raw ? (JSON.parse(raw) as T) : fallback();
    });

  const loadVersionRows = async (normId: string): Promise<VersionRow[]> =>
    (await db.prepare('SELECT norm_id, version_id, version_json, full_citation, publication_ref_json FROM law_versions WHERE norm_id = ? ORDER BY valid_from').bind(normId).all<VersionRow>()).results;

  const listSummaries = async (query: NormSummaryQuery = {}): Promise<NormSummary[]> => {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (query.types?.length) {
      conditions.push(`n.type IN (${query.types.map(() => '?').join(', ')})`);
      params.push(...query.types);
    }
    if (query.statuses?.length) {
      conditions.push(`n.status IN (${query.statuses.map(() => '?').join(', ')})`);
      params.push(...query.statuses);
    }
    if (query.subjectSlug) {
      conditions.push('n.id IN (SELECT s.norm_id FROM law_norm_subjects s WHERE s.subject_slug = ?)');
      params.push(query.subjectSlug);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = await db.prepare(`${SUMMARY_SELECT}${where} ORDER BY n.sort_title, n.slug`).bind(...params).all<SummaryRow>();
    return rows.results.map(summaryFromRow);
  };

  /** WHERE-Klausel einer Seitenabfrage; alle Bedingungen sind indexgestützt oder scannen nur law_norms (schmale Zeilen). */
  const pageConditions = (query: NormPageQuery): { where: string; params: unknown[] } => {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (query.letter) {
      conditions.push('n.index_letter = ?');
      params.push(query.letter);
    }
    if (query.types?.length) {
      conditions.push(`n.type IN (${query.types.map(() => '?').join(', ')})`);
      params.push(...query.types);
    }
    if (query.statuses?.length) {
      conditions.push(`n.status IN (${query.statuses.map(() => '?').join(', ')})`);
      params.push(...query.statuses);
    }
    if (query.originKind) {
      conditions.push('n.origin_kind = ?');
      params.push(query.originKind);
    }
    if (query.subjectSlug) {
      conditions.push('n.id IN (SELECT s.norm_id FROM law_norm_subjects s WHERE s.subject_slug = ?)');
      params.push(query.subjectSlug);
    }
    if (query.subject) {
      conditions.push('n.id IN (SELECT s.norm_id FROM law_norm_subjects s WHERE s.subject = ?)');
      params.push(query.subject);
    }
    const text = normalizeQueryText(query.q);
    if (text) {
      const pattern = `%${text.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
      conditions.push("(n.sort_title LIKE ? ESCAPE '\\' OR lower(n.short_title) LIKE ? ESCAPE '\\' OR lower(n.abbr) LIKE ? ESCAPE '\\' OR n.id IN (SELECT k.norm_id FROM law_norm_keywords k WHERE lower(k.keyword) LIKE ? ESCAPE '\\'))");
      params.push(pattern, pattern, pattern, pattern);
    }
    return { where: conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '', params };
  };

  const pageSummaries = async (query: NormPageQuery): Promise<NormPage> => {
    const { page, pageSize } = normalizePage(query.page, query.pageSize);
    const { where, params } = pageConditions(query);
    const total = Number((await db.prepare(`SELECT COUNT(*) AS total FROM law_norms n${where}`).bind(...params).first<{ total: number }>())?.total ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(page, pageCount);
    const rows = await db.prepare(`${SUMMARY_SELECT}${where} ORDER BY ${summaryOrderBy(query.sort)} LIMIT ? OFFSET ?`).bind(...params, pageSize, (current - 1) * pageSize).all<SummaryRow>();
    return { items: rows.results.map(summaryFromRow), total, page: current, pageSize, pageCount };
  };

  return {
    kind: 'd1',
    listNormSummaries: listSummaries,
    async listNormSummariesByType(type) {
      return listSummaries({ types: [type] });
    },
    queryNormSummaries: pageSummaries,
    async listIndexLetters(query = {}) {
      const mapRows = (rows: Array<{ letter: string; count: number }>): IndexLetterCount[] => rows.map((row) => ({ letter: row.letter, count: Number(row.count) }));
      if (!query.types?.length && !query.subjectSlug && !query.originKind) {
        return cachedMeta('index_letters', async () =>
          mapRows((await db.prepare('SELECT index_letter AS letter, COUNT(*) AS count FROM law_norms GROUP BY index_letter ORDER BY index_letter').all<{ letter: string; count: number }>()).results));
      }
      // Zähler eines Verzeichnisses: dieselben indexgestützten Bedingungen wie die Seitenabfrage.
      const { where, params } = pageConditions({ types: query.types, subjectSlug: query.subjectSlug, originKind: query.originKind });
      return mapRows((await db.prepare(`SELECT n.index_letter AS letter, COUNT(*) AS count FROM law_norms n${where} GROUP BY n.index_letter ORDER BY n.index_letter`).bind(...params).all<{ letter: string; count: number }>()).results);
    },
    async listKeywordIndex(letter, query = {}) {
      const { page, pageSize } = normalizePage(query.page, query.pageSize ?? KEYWORD_PAGE_SIZE);
      const text = normalizeQueryText(query.q);
      const conditions = ['k.index_letter = ?'];
      const params: unknown[] = [letter];
      if (text) {
        conditions.push("lower(k.keyword) LIKE ? ESCAPE '\\'");
        params.push(`%${text.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
      }
      const where = conditions.join(' AND ');
      const total = Number((await db.prepare(`SELECT COUNT(DISTINCT k.keyword) AS total FROM law_norm_keywords k WHERE ${where}`).bind(...params).first<{ total: number }>())?.total ?? 0);
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      const current = Math.min(page, pageCount);
      const keywordRows = await db.prepare(`SELECT k.keyword FROM law_norm_keywords k WHERE ${where} GROUP BY k.keyword ORDER BY k.keyword LIMIT ? OFFSET ?`).bind(...params, pageSize, (current - 1) * pageSize).all<{ keyword: string }>();
      const keywords = keywordRows.results.map((row) => row.keyword);
      const entries = new Map<string, KeywordIndexEntry>(keywords.map((keyword) => [keyword, { keyword, norms: [] }]));
      if (keywords.length > 0) {
        // Die Seite ist in SQL-Sortierung ein zusammenhängender Bereich: BETWEEN statt einer
        // IN-Liste (D1 erlaubt höchstens 100 Parameter); der Filter gilt erneut, damit
        // zwischenliegende Stichwörter ohne Treffer nicht mitgelesen werden.
        const rows = await db.prepare(`SELECT k.keyword, n.slug, n.short_title FROM law_norm_keywords k JOIN law_norms n ON n.id = k.norm_id WHERE ${where} AND k.keyword BETWEEN ? AND ? ORDER BY k.keyword, n.sort_title, n.slug`).bind(...params, keywords[0], keywords[keywords.length - 1]).all<{ keyword: string; slug: string; short_title: string }>();
        for (const row of rows.results) {
          const entry = entries.get(row.keyword);
          if (entry && !entry.norms.some((norm) => norm.slug === row.slug)) entry.norms.push({ slug: row.slug, shortTitle: row.short_title });
        }
      }
      return { entries: [...entries.values()].sort((left, right) => left.keyword.localeCompare(right.keyword, 'de')), total, page: current, pageSize, pageCount };
    },
    async countByOriginKind() {
      return cachedMeta('origin_counts', async () =>
        Object.fromEntries((await db.prepare('SELECT origin_kind, COUNT(*) AS count FROM law_norms GROUP BY origin_kind').all<{ origin_kind: NormOriginKind | null; count: number }>()).results
          .filter((row) => row.origin_kind)
          .map((row) => [row.origin_kind as NormOriginKind, Number(row.count)])) as Partial<Record<NormOriginKind, number>>);
    },
    async getNormSummaries(slugs) {
      const summaries = new Map<string, NormSummary>();
      for (const chunk of chunked([...new Set(slugs)], 80)) {
        const rows = await db.prepare(`${SUMMARY_SELECT} WHERE n.slug IN (${chunk.map(() => '?').join(', ')})`).bind(...chunk).all<SummaryRow>();
        for (const row of rows.results) summaries.set(row.slug, summaryFromRow(row));
      }
      return summaries;
    },
    async listVersionSummaries({ slugs } = {}) {
      const select = 'SELECT n.slug, v.version_id, v.valid_from, v.temporal_kind FROM law_versions v JOIN law_norms n ON n.id = v.norm_id';
      const map = (rows: Array<{ slug: string; version_id: string; valid_from: string; temporal_kind: string }>): NormVersionSummary[] =>
        rows.map((row) => ({ slug: row.slug, versionId: row.version_id, validFrom: row.valid_from, temporalKind: row.temporal_kind as NormVersionSummary['temporalKind'] }));
      if (!slugs) return map((await db.prepare(`${select} ORDER BY n.slug, v.valid_from`).all<{ slug: string; version_id: string; valid_from: string; temporal_kind: string }>()).results);
      const summaries: NormVersionSummary[] = [];
      for (const chunk of chunked([...new Set(slugs)], 80)) {
        const rows = await db.prepare(`${select} WHERE n.slug IN (${chunk.map(() => '?').join(', ')}) ORDER BY n.slug, v.valid_from`).bind(...chunk).all<{ slug: string; version_id: string; valid_from: string; temporal_kind: string }>();
        summaries.push(...map(rows.results));
      }
      return summaries;
    },
    async listChanges({ changeTypes, until, after, order, limit, distinctNorms = false }) {
      if (changeTypes.length === 0 || limit <= 0) return [];
      const conditions = [`h.change_type IN (${changeTypes.map(() => '?').join(', ')})`];
      const params: unknown[] = [...changeTypes];
      if (until) {
        conditions.push('h.change_date <= ?');
        params.push(until);
      }
      if (after) {
        conditions.push('h.change_date > ?');
        params.push(after);
      }
      const direction = order === 'asc' ? 'ASC' : 'DESC';
      const select = `SELECT n.slug, n.title, n.short_title, n.type, n.origin_kind, n.sort_title, h.change_date, h.change_type, h.title AS entry_title, h.citation, h.note, h.affecting_version_id, h.related_norm
        FROM law_norm_history h JOIN law_norms n ON n.id = h.norm_id WHERE ${conditions.join(' AND ')}`;
      // Je Norm nur ein Ereignis: Fensterfunktion über den Datumsindex, deterministisch nach
      // Datum, Ereignistyp und Titel; die Liste bleibt nach Ereignisdatum und Titel sortiert.
      const sql = distinctNorms
        ? `SELECT * FROM (${select.replace('h.related_norm', `h.related_norm, row_number() OVER (PARTITION BY h.norm_id ORDER BY h.change_date ${direction}, h.change_type, h.title) AS rn`)}) WHERE rn = 1 ORDER BY change_date ${direction}, sort_title, slug LIMIT ?`
        : `${select} ORDER BY h.change_date ${direction}, n.sort_title, n.slug LIMIT ?`;
      const rows = await db.prepare(sql).bind(...params, limit).all<Record<string, string | null>>();
      return rows.results.map((row) => ({
        slug: row.slug as string,
        normTitle: row.title as string,
        normShortTitle: row.short_title as string,
        type: row.type as NormType,
        ...(row.origin_kind ? { originKind: row.origin_kind as NormOriginKind } : {}),
        date: row.change_date as string,
        changeType: row.change_type as HistoryEntryType,
        title: row.entry_title as string,
        citation: row.citation as string,
        ...(row.note ? { note: row.note } : {}),
        affectingVersionId: row.affecting_version_id,
        relatedNorm: row.related_norm,
      }));
    },
    async listSubjectSummaries() {
      return metaJson<SubjectSummary[]>('subject_groups_json', async () => {
        const rows = await db.prepare('SELECT subject, subject_slug, COUNT(*) AS norm_count FROM law_norm_subjects GROUP BY subject_slug, subject ORDER BY subject').all<{ subject: string; subject_slug: string; norm_count: number }>();
        return rows.results.map((row) => ({ name: row.subject, slug: row.subject_slug, normCount: Number(row.norm_count) }));
      });
    },
    async listSubjectAreas() {
      return metaJson<SubjectAreaSummary[]>('subject_areas_json', async () => []);
    },
    async getCorpusStats() {
      return metaJson<CorpusStats>('corpus_stats_json', async () => {
        const row = await db.prepare(`SELECT (SELECT COUNT(*) FROM law_norms) AS norm_count, (SELECT COUNT(*) FROM law_norms WHERE status = 'in-force') AS in_force, (SELECT COUNT(*) FROM law_publications) AS publication_count`).first<{ norm_count: number; in_force: number; publication_count: number }>();
        const types = await db.prepare('SELECT DISTINCT type FROM law_norms ORDER BY type').all<{ type: NormType }>();
        const statuses = await db.prepare('SELECT DISTINCT status FROM law_norms ORDER BY status').all<{ status: NormStatus }>();
        return {
          normCount: Number(row?.norm_count ?? 0),
          inForceCount: Number(row?.in_force ?? 0),
          publicationCount: Number(row?.publication_count ?? 0),
          types: types.results.map((entry) => entry.type),
          statuses: statuses.results.map((entry) => entry.status),
        };
      });
    },
    async listSearchSuggestions() {
      const rows = await db.prepare('SELECT slug, title, short_title, abbr, aliases_json, type FROM law_norms ORDER BY title, slug').all<{ slug: string; title: string; short_title: string; abbr: string | null; aliases_json: string; type: NormType }>();
      return rows.results.map((row) => ({
        slug: row.slug,
        url: getNormUrl(row.slug),
        title: toDisplayText(row.title),
        shortTitle: toDisplayText(row.short_title),
        abbr: toDisplayText(row.abbr ?? ''),
        aliases: parseJsonArray(row.aliases_json),
        typeLabel: formatNormType(row.type),
      })).sort((left, right) => left.title.localeCompare(right.title, 'de'));
    },
    async getSearchFilters() {
      const filters = await metaJson<SearchFilterOptions>('search_filters_json', async () =>
        buildFilterOptions((await listSummaries()).map((summary) => ({ meta: { type: summary.type, status: summary.status, subjects: summary.subjects, responsibleMinistry: summary.responsibleMinistry } })) as NormRecord[]));
      const documentCount = await cachedMeta('search_document_count', async () => {
        const raw = await readMeta('search_document_count');
        if (raw) return Number(raw);
        return Number((await db.prepare('SELECT COUNT(*) AS total FROM law_versions').first<{ total: number }>())?.total ?? 0);
      });
      return { filters, documentCount };
    },
    async listSearchPublications() {
      return metaJson<SearchPublication[]>('search_publications_json', async () => buildSearchPublications(await this.listPublications()));
    },
    async getNorm(slug, bodies = 'current') {
      const row = await db.prepare('SELECT id, slug, meta_json, history_json FROM law_norms WHERE slug = ?').bind(slug).first<NormRow>();
      if (!row) return null;
      const versionRows = await loadVersionRows(row.id);
      const skeleton = assembleRecord(row, versionRows, new Map());
      const wanted = selectedVersionIds(skeleton, bodies);
      const bodyMap = new Map<string, unknown[]>();
      for (const versionId of wanted) {
        const rows = await db.prepare('SELECT block_index, part_index, block_json FROM law_version_blocks WHERE norm_id = ? AND version_id = ? ORDER BY block_index, part_index').bind(row.id, versionId).all<BlockRow>();
        bodyMap.set(versionId, assembleBlocks(rows.results));
      }
      return assembleRecord(row, versionRows, bodyMap);
    },
    async getDerived(slug) {
      const row = await db.prepare(`SELECT d.relations_json, d.recommendations_json, d.origin_json, d.text_references_json, d.portal_links_json
        FROM law_norm_derived d JOIN law_norms n ON n.id = d.norm_id WHERE n.slug = ?`).bind(slug).first<Record<string, string>>();
      if (!row) return null;
      return {
        relations: JSON.parse(row.relations_json),
        recommendations: JSON.parse(row.recommendations_json),
        origin: JSON.parse(row.origin_json),
        textReferences: JSON.parse(row.text_references_json),
        portalLinks: JSON.parse(row.portal_links_json),
      };
    },
    async getFullCitation(slug, versionId) {
      const row = await db.prepare('SELECT v.full_citation FROM law_versions v JOIN law_norms n ON n.id = v.norm_id WHERE n.slug = ? AND v.version_id = ?').bind(slug, versionId).first<{ full_citation: string | null }>();
      return row?.full_citation ?? undefined;
    },
    async getPublicationReference(slug, versionId) {
      const row = await db.prepare('SELECT v.publication_ref_json FROM law_versions v JOIN law_norms n ON n.id = v.norm_id WHERE n.slug = ? AND v.version_id = ?').bind(slug, versionId).first<{ publication_ref_json: string | null }>();
      return row?.publication_ref_json ? JSON.parse(row.publication_ref_json) as NormPublicationReference : undefined;
    },
    async listPublications({ limit } = {}) {
      // Nur law_publications; der Normenbestand wird dafür nicht gelesen.
      const statement = limit
        ? db.prepare('SELECT publication_json FROM law_publications ORDER BY publication_date DESC, issue DESC LIMIT ?').bind(limit)
        : db.prepare('SELECT publication_json FROM law_publications ORDER BY publication_date DESC, issue DESC');
      const rows = await statement.all<{ publication_json: string }>();
      return rows.results.map((row) => JSON.parse(row.publication_json) as Verkuendung);
    },
    async getPublication(slug) {
      const row = await db.prepare('SELECT publication_json FROM law_publications WHERE slug = ?').bind(slug).first<{ publication_json: string }>();
      return row ? JSON.parse(row.publication_json) as Verkuendung : null;
    },
    async getSearchDocuments(slugs, unitsMatch) {
      if (slugs.length === 0) return [];
      // D1 erlaubt höchstens 100 gebundene Parameter je Anfrage (lokale SQLite-
      // Builds teils weniger); Kandidatenlisten werden deshalb in Blöcken abgefragt.
      const documents: Array<{ norm_id: string; version_id: string; document_json: string }> = [];
      const units: Array<Record<string, string>> = [];
      const unitColumns = 'norm_id, version_id, provision_path, anchor, block_type, references_json, label, heading, body';
      for (const chunk of chunked(slugs, 80)) {
        const placeholders = chunk.map(() => '?').join(', ');
        documents.push(...(await db.prepare(`SELECT d.norm_id, d.version_id, d.document_json FROM law_search_documents d JOIN law_norms n ON n.id = d.norm_id WHERE n.slug IN (${placeholders})`).bind(...chunk).all<{ norm_id: string; version_id: string; document_json: string }>()).results);
        if (unitsMatch === undefined) continue;
        units.push(...(unitsMatch === null
          // Ohne Suchausdruck über die relationale Tabelle und ihren Slug-Index, nicht über den FTS-Index.
          ? (await db.prepare(`SELECT ${unitColumns} FROM law_search_units WHERE slug IN (${placeholders})`).bind(...chunk).all<Record<string, string>>()).results
          : (await db.prepare(`SELECT ${unitColumns} FROM law_search WHERE law_search MATCH ? AND slug IN (${placeholders})`).bind(unitsMatch, ...chunk).all<Record<string, string>>()).results));
      }
      const unitsByKey = new Map<string, SearchUnitRow[]>();
      for (const unit of units) {
        const key = `${unit.norm_id}:${unit.version_id}`;
        const list = unitsByKey.get(key) ?? [];
        list.push({
          normId: unit.norm_id,
          versionId: unit.version_id,
          unitIndex: Number(unit.provision_path),
          anchor: unit.anchor,
          blockType: unit.block_type,
          label: unit.label,
          heading: unit.heading,
          body: unit.body,
          ...(unit.references_json ? { references: JSON.parse(unit.references_json) } : {}),
        });
        unitsByKey.set(key, list);
      }
      return documents.map((row) => ({
        document: JSON.parse(row.document_json) as SearchIndexDocument,
        units: (unitsByKey.get(`${row.norm_id}:${row.version_id}`) ?? []).sort((left, right) => left.unitIndex - right.unitIndex),
      }));
    },
    async searchCandidates({ match, limit, offset, types = [], origins = [] }) {
      // Typ- und Herkunftsfilter laufen über die schmalen, indizierten Spalten von law_norms.
      const typeFilter = types.length > 0 ? ` AND n.type IN (${types.map(() => '?').join(', ')})` : '';
      const originFilter = origins.length > 0 ? ` AND n.origin_kind IN (${origins.map(() => '?').join(', ')})` : '';
      const filterParams = [...types, ...origins];
      if (match) {
        const rows = await db.prepare(`SELECT s.slug, min(s.rank) AS best FROM law_search s JOIN law_norms n ON n.id = s.norm_id WHERE law_search MATCH ?${typeFilter}${originFilter} GROUP BY s.slug ORDER BY best LIMIT ? OFFSET ?`).bind(match, ...filterParams, limit, offset).all<{ slug: string }>();
        const total = await db.prepare(`SELECT count(DISTINCT s.slug) AS total FROM law_search s JOIN law_norms n ON n.id = s.norm_id WHERE law_search MATCH ?${typeFilter}${originFilter}`).bind(match, ...filterParams).first<{ total: number }>();
        return { slugs: rows.results.map((row) => row.slug), total: total?.total ?? rows.results.length };
      }
      // Ohne Suchausdruck: jüngstes Rechtsereignis zuerst (law_norms.last_change_date), dann Titel.
      const rows = await db.prepare(`SELECT n.slug FROM law_norms n WHERE 1 = 1${typeFilter}${originFilter} ORDER BY ${summaryOrderBy('activity')} LIMIT ? OFFSET ?`).bind(...filterParams, limit, offset).all<{ slug: string }>();
      const total = await db.prepare(`SELECT count(*) AS total FROM law_norms n WHERE 1 = 1${typeFilter}${originFilter}`).bind(...filterParams).first<{ total: number }>();
      return { slugs: rows.results.map((row) => row.slug), total: total?.total ?? rows.results.length };
    },
    async getRuntimeMeta(key) {
      return readMeta(key);
    },
    async getNormLabels(slugs) {
      const labels = new Map<string, { title: string; shortTitle: string }>();
      const unique = [...new Set(slugs)];
      for (let index = 0; index < unique.length; index += 50) {
        const chunk = unique.slice(index, index + 50);
        const rows = await db.prepare(`SELECT slug, title, short_title FROM law_norms WHERE slug IN (${chunk.map(() => '?').join(', ')})`).bind(...chunk).all<{ slug: string; title: string; short_title: string }>();
        for (const row of rows.results) labels.set(row.slug, { title: row.title, shortTitle: row.short_title });
      }
      return labels;
    },
  };
}

// ---------------------------------------------------------------------------
// Dateivariante (Entwicklung, Prerendering, Tests)
// ---------------------------------------------------------------------------

export interface FileStoreSources {
  loadAllNorms(): Promise<NormRecord[]>;
  loadAllVerkuendungen(): Promise<Verkuendung[]>;
  loadTopics?(): Promise<Array<{ slug: string; title: string; rechtsgrundlagen?: Array<{ normSlug?: string }> }>>;
  loadPressReleases?(): Promise<Array<{ slug: string; title: string; date: string; relatedNormSlugs?: string[] }>>;
  topicUrl?(slug: string): string;
  pressReleaseUrl?(slug: string): string;
  buildSearchDocument?(record: NormRecord, version: NormVersion, lookup: DerivedContext['lookup'], reference?: NormPublicationReference): SearchIndexDocument;
}

export function createFileNormStore(sources: FileStoreSources): NormStore {
  let contextPromise: Promise<DerivedContext> | null = null;
  let summariesPromise: Promise<NormSummary[]> | null = null;
  const context = (): Promise<DerivedContext> => {
    contextPromise ??= (async () => {
      const [norms, publications, topics, pressReleases] = await Promise.all([
        sources.loadAllNorms(),
        sources.loadAllVerkuendungen(),
        sources.loadTopics?.() ?? Promise.resolve([]),
        sources.loadPressReleases?.() ?? Promise.resolve([]),
      ]);
      return buildDerivedContext({ norms, publications, topics, pressReleases, topicUrl: sources.topicUrl, pressReleaseUrl: sources.pressReleaseUrl });
    })();
    return contextPromise;
  };
  const summaries = (): Promise<NormSummary[]> => {
    summariesPromise ??= (async () => {
      const { norms } = await context();
      return norms.map((record) => summarizeNormRecord(record, norms)).sort(compareSummaryTitles);
    })();
    return summariesPromise;
  };
  const find = async (slug: string): Promise<NormRecord | null> => (await context()).lookup.get(slug) ?? null;

  const filterSummaries = async (query: NormSummaryQuery = {}): Promise<NormSummary[]> =>
    (await summaries()).filter((summary) =>
      (!query.types?.length || query.types.includes(summary.type))
      && (!query.statuses?.length || query.statuses.includes(summary.status))
      && (!query.subjectSlug || summary.subjects.some((subject) => getSubjectSlug(subject) === query.subjectSlug)));

  const keywordEntriesOf = (summary: NormSummary): string[] =>
    [...new Set([summary.abbr, summary.shortTitle, ...summary.keywords].map((value) => (typeof value === 'string' ? value.trim() : '')).filter((value) => value.length >= 2))];
  const matchesText = (summary: NormSummary, text: string): boolean =>
    [summary.title, summary.shortTitle, summary.abbr ?? '', ...keywordEntriesOf(summary)].some((value) => value.toLocaleLowerCase('de-DE').includes(text));

  return {
    kind: 'files',
    listNormSummaries: filterSummaries,
    async listNormSummariesByType(type) {
      return filterSummaries({ types: [type] });
    },
    async queryNormSummaries(query) {
      const { page, pageSize } = normalizePage(query.page, query.pageSize);
      const text = normalizeQueryText(query.q);
      const all = (await filterSummaries(query)).filter((summary) =>
        (!query.letter || getGermanIndexLetter(summary.title) === query.letter)
        && (!query.originKind || summary.originKind === query.originKind)
        && (!query.subject || summary.subjects.includes(query.subject))
        && (!text || matchesText(summary, text)));
      if (query.sort === 'activity') all.sort(compareByActivity);
      const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
      const current = Math.min(page, pageCount);
      return { items: all.slice((current - 1) * pageSize, current * pageSize), total: all.length, page: current, pageSize, pageCount };
    },
    async listIndexLetters(query = {}) {
      const counts = new Map<string, number>();
      const scoped = (await filterSummaries({ types: query.types, subjectSlug: query.subjectSlug }))
        .filter((summary) => !query.originKind || summary.originKind === query.originKind);
      for (const summary of scoped) {
        const letter = getGermanIndexLetter(summary.title);
        counts.set(letter, (counts.get(letter) ?? 0) + 1);
      }
      return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([letter, count]) => ({ letter, count }));
    },
    async listKeywordIndex(letter, query = {}) {
      const { page, pageSize } = normalizePage(query.page, query.pageSize ?? KEYWORD_PAGE_SIZE);
      const text = normalizeQueryText(query.q);
      const entries = new Map<string, KeywordIndexEntry>();
      for (const summary of await summaries()) {
        for (const keyword of keywordEntriesOf(summary)) {
          if (getGermanIndexLetter(keyword) !== letter || (text && !keyword.toLocaleLowerCase('de-DE').includes(text))) continue;
          const entry = entries.get(keyword) ?? { keyword, norms: [] };
          if (!entry.norms.some((norm) => norm.slug === summary.slug)) entry.norms.push({ slug: summary.slug, shortTitle: summary.shortTitle });
          entries.set(keyword, entry);
        }
      }
      const all = [...entries.values()].sort((left, right) => left.keyword.localeCompare(right.keyword, 'de'));
      const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
      const current = Math.min(page, pageCount);
      return { entries: all.slice((current - 1) * pageSize, current * pageSize), total: all.length, page: current, pageSize, pageCount };
    },
    async countByOriginKind() {
      const counts: Partial<Record<NormOriginKind, number>> = {};
      for (const summary of await summaries()) {
        if (summary.originKind) counts[summary.originKind] = (counts[summary.originKind] ?? 0) + 1;
      }
      return counts;
    },
    async getNormSummaries(slugs) {
      const wanted = new Set(slugs);
      return new Map((await summaries()).filter((summary) => wanted.has(summary.slug)).map((summary) => [summary.slug, summary]));
    },
    async listVersionSummaries({ slugs } = {}) {
      const wanted = slugs ? new Set(slugs) : null;
      return (await context()).norms
        .filter((record) => !wanted || wanted.has(record.meta.slug))
        .flatMap((record) => record.versions.map((version) => ({ slug: record.meta.slug, versionId: version.versionId, validFrom: version.validFrom, temporalKind: classifyNormVersion(record, version) })));
    },
    async listChanges({ changeTypes, until, after, order, limit, distinctNorms = false }) {
      const wanted = new Set(changeTypes);
      const originBySlug = new Map((await summaries()).map((summary) => [summary.slug, summary.originKind]));
      const entries = (await context()).norms.flatMap((record) => {
        const identity = identityFor(record);
        const originKind = originBySlug.get(record.meta.slug);
        return record.history.entries
          .filter((entry) => wanted.has(entry.type) && (!until || entry.date <= until) && (!after || entry.date > after))
          .map((entry): NormChange => ({
            slug: record.meta.slug,
            normTitle: identity.title,
            normShortTitle: identity.shortTitle,
            type: record.meta.type,
            ...(originKind ? { originKind } : {}),
            date: entry.date,
            changeType: entry.type,
            title: entry.title,
            citation: entry.citation,
            ...(entry.note ? { note: entry.note } : {}),
            affectingVersionId: entry.affectingVersionId ?? null,
            relatedNorm: entry.relatedNorm ?? null,
          }));
      });
      entries.sort((left, right) => (order === 'asc' ? left.date.localeCompare(right.date) : right.date.localeCompare(left.date))
        || left.changeType.localeCompare(right.changeType)
        || left.title.localeCompare(right.title, 'de')
        || left.normTitle.localeCompare(right.normTitle, 'de')
        || left.slug.localeCompare(right.slug));
      const selected = distinctNorms ? entries.filter((entry, index) => entries.findIndex((candidate) => candidate.slug === entry.slug) === index) : entries;
      selected.sort((left, right) => (order === 'asc' ? left.date.localeCompare(right.date) : right.date.localeCompare(left.date))
        || left.normTitle.localeCompare(right.normTitle, 'de')
        || left.slug.localeCompare(right.slug));
      return selected.slice(0, limit);
    },
    async listSubjectSummaries() {
      return getSubjectGroups((await context()).norms).map((group) => ({ name: group.name, slug: group.slug, normCount: group.norms.length }));
    },
    async listSubjectAreas() {
      return getSubjectAreaGroups((await context()).norms).map((area) => ({
        name: area.name,
        description: area.description,
        normCount: area.normCount,
        subjects: area.subjects.map((group) => ({ name: group.name, slug: group.slug, normCount: group.norms.length })),
      }));
    },
    async getCorpusStats() {
      const { norms, publications } = await context();
      return {
        normCount: norms.length,
        inForceCount: norms.filter((record) => record.meta.status === 'in-force').length,
        publicationCount: publications.length,
        types: [...new Set(norms.map((record) => record.meta.type))].sort(),
        statuses: [...new Set(norms.map((record) => record.meta.status))].sort(),
      };
    },
    async listSearchSuggestions() {
      return (await summaries()).map(suggestionFromSummary).sort((left, right) => left.title.localeCompare(right.title, 'de'));
    },
    async getSearchFilters() {
      const { norms } = await context();
      return { filters: buildFilterOptions(norms), documentCount: norms.reduce((sum, record) => sum + record.versions.length, 0) };
    },
    async listSearchPublications() {
      return buildSearchPublications((await context()).publications);
    },
    async getNorm(slug, bodies = 'current') {
      const record = await find(slug);
      if (!record) return null;
      const wanted = selectedVersionIds(record, bodies);
      return { ...record, versions: record.versions.map((version) => (wanted.has(version.versionId) ? version : { ...version, body: [] })) };
    },
    async getDerived(slug) {
      const record = await find(slug);
      return record ? deriveNorm(record, await context()) : null;
    },
    async getFullCitation(slug, versionId) {
      const record = await find(slug);
      const version = record?.versions.find((entry) => entry.versionId === versionId);
      return record && version ? fullCitationFor(record, version, await context()) : undefined;
    },
    async getPublicationReference(slug, versionId) {
      return (await context()).publicationReferences.get(`${slug}:${versionId}`);
    },
    async listPublications({ limit } = {}) {
      const publications = [...(await context()).publications].sort((left, right) => right.date.localeCompare(left.date) || right.issue.localeCompare(left.issue, 'de'));
      return limit ? publications.slice(0, limit) : publications;
    },
    async getPublication(slug) {
      return (await context()).publications.find((publication) => publication.slug === slug) ?? null;
    },
    async getSearchDocuments(slugs, unitsMatch) {
      const ctx = await context();
      if (!sources.buildSearchDocument) return [];
      const build = sources.buildSearchDocument;
      const includeUnits = unitsMatch !== undefined;
      return slugs.flatMap((slug) => {
        const record = ctx.lookup.get(slug);
        if (!record) return [];
        return record.versions.map((version) => {
          const document = build(record, version, ctx.lookup, ctx.publicationReferences.get(`${slug}:${version.versionId}`));
          const { hitUnits, bodySupplement, ...metadata } = document;
          const isCurrent = version.versionId === getCurrentVersionId(record);
          const units: SearchUnitRow[] = includeUnits && isCurrent
            ? [
                ...hitUnits.map((unit, index) => ({ normId: record.meta.id, versionId: version.versionId, unitIndex: index, anchor: unit.anchor, blockType: unit.type, label: unit.label, heading: unit.title, body: unit.text, ...(unit.references ? { references: unit.references } : {}) })),
                ...(bodySupplement ? [{ normId: record.meta.id, versionId: version.versionId, unitIndex: hitUnits.length, anchor: '', blockType: 'supplement', label: '', heading: '', body: bodySupplement }] : []),
              ]
            : [];
          return { document: metadata as SearchIndexDocument, units };
        });
      });
    },
    async searchCandidates({ match, limit, offset, types = [], origins = [] }) {
      const ctx = await context();
      const originBySlug = origins.length > 0 ? new Map((await summaries()).map((summary) => [summary.slug, summary.originKind])) : null;
      const terms = (match ?? '').toLocaleLowerCase('de').replace(/[()"*]/gu, '').split(/\s+(?:OR|AND)\s+|\s+/u).filter(Boolean);
      const matching = ctx.norms.filter((record) => {
        if (types.length > 0 && !types.includes(record.meta.type)) return false;
        if (originBySlug && !origins.includes(originBySlug.get(record.meta.slug) as NormOriginKind)) return false;
        if (terms.length === 0) return true;
        const haystack = [record.meta.title, record.meta.shortTitle, record.meta.abbr ?? '', ...record.versions.flatMap((version) => [version.title ?? '', version.shortTitle ?? ''])].join(' ').toLocaleLowerCase('de');
        return terms.some((term) => haystack.includes(term));
      });
      if (terms.length === 0) {
        // Ohne Suchausdruck wie die D1-Variante: jüngstes Rechtsereignis zuerst, dann Titel.
        const summaryBySlug = new Map((await summaries()).map((summary) => [summary.slug, summary]));
        matching.sort((left, right) => compareByActivity(summaryBySlug.get(left.meta.slug) as NormSummary, summaryBySlug.get(right.meta.slug) as NormSummary));
      }
      return { slugs: matching.slice(offset, offset + limit).map((record) => record.meta.slug), total: matching.length };
    },
    async getRuntimeMeta() {
      return null;
    },
    async getNormLabels(slugs) {
      const ctx = await context();
      const labels = new Map<string, { title: string; shortTitle: string }>();
      for (const slug of new Set(slugs)) {
        const record = ctx.lookup.get(slug);
        if (record) labels.set(slug, identityFor(record));
      }
      return labels;
    },
  };
}
