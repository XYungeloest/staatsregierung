import {
  parseNormHistory,
  parseNormMeta,
  parseNormVersion,
  validateNormRecord,
  type NormRecord,
  type NormVersion,
} from '@ostrecht/shared/lib/norms/schema.ts';
import { validateVersionIntervals } from '@ostrecht/shared/lib/norms/versions.ts';
import {
  buildDerivedContext,
  deriveNorm,
  fullCitationFor,
  identityFor,
  type DerivedContext,
  type NormDerivedData,
} from '@ostrecht/shared/lib/norms/derived.ts';
import type { NormPublicationReference, Verkuendung } from '@ostrecht/shared/lib/norms/publications.ts';
import type { SearchIndexDocument } from '@ostrecht/recht-search/search.ts';

import type { D1Database } from './d1-types.ts';

/**
 * Datenzugriff von OstRecht zur Laufzeit.
 *
 * Die produktive Implementierung liest ausschließlich aus Cloudflare D1, der aus
 * `content/normen` abgeleiteten Runtime-Projektion (Schema data/recht/d1/*.sql,
 * Sync scripts/sync-recht-d1.mjs). Für lokale Entwicklung, Prerendering und Tests
 * ohne Binding steht eine Dateivariante bereit, die denselben Ableitungscode nutzt.
 * Git bleibt fachlicher Source of Truth; D1 ist die Projektion.
 */

export type BodySelection = 'none' | 'current' | 'all' | string[];

export interface NormListEntry {
  record: NormRecord;
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
  /** Alle Normen ohne Normkörper (Metadaten, Historie, Fassungsdaten). */
  listNorms(): Promise<NormRecord[]>;
  /** Eine Norm; Normkörper nur für die gewünschten Fassungen. */
  getNorm(slug: string, bodies?: BodySelection): Promise<NormRecord | null>;
  getDerived(slug: string): Promise<NormDerivedData | null>;
  getFullCitation(slug: string, versionId: string): Promise<string | undefined>;
  getPublicationReference(slug: string, versionId: string): Promise<NormPublicationReference | undefined>;
  listPublications(): Promise<Verkuendung[]>;
  getPublication(slug: string): Promise<Verkuendung | null>;
  /** Suchdokumente der gewünschten Normen (alle Fassungen) samt Provisionen der geltenden Fassung. */
  /** `unitsMatch`: FTS-Ausdruck, auf den die gelieferten Provisionen eingeschränkt werden; null = alle Provisionen; undefined = keine. */
  getSearchDocuments(slugs: string[], unitsMatch: string | null | undefined): Promise<SearchCandidate[]>;
  searchCandidates(query: { match: string | null; limit: number; offset: number; types?: string[] }): Promise<{ slugs: string[]; total: number }>;
  getRuntimeMeta(key: string): Promise<string | null>;
  /** Anzeigebezeichnungen (geltende Fassung) für eine Slug-Liste, z. B. Bezüge in Historieneinträgen. */
  getNormLabels(slugs: string[]): Promise<Map<string, { title: string; shortTitle: string }>>;
}

// ---------------------------------------------------------------------------
// Gemeinsame Hilfen
// ---------------------------------------------------------------------------

function selectedVersionIds(record: NormRecord, bodies: BodySelection): Set<string> {
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

function withoutBodies(record: NormRecord): NormRecord {
  return { ...record, versions: record.versions.map((version) => ({ ...version, body: [] })) };
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

interface BlockRow {
  block_index: number;
  part_index: number;
  block_json: string;
}

const corpusCache: { syncedAt: string | null; records: NormRecord[] | null; publications: Verkuendung[] | null } = {
  syncedAt: null,
  records: null,
  publications: null,
};

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

function assembleBlocks(rows: BlockRow[]): unknown[] {
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
  const loadCorpus = async (): Promise<{ records: NormRecord[]; publications: Verkuendung[] }> => {
    const syncedAt = (await db.prepare("SELECT value FROM law_runtime_meta WHERE key = 'last_sync_at'").first<{ value: string }>())?.value ?? null;
    if (corpusCache.records && corpusCache.publications && corpusCache.syncedAt === syncedAt) {
      return { records: corpusCache.records, publications: corpusCache.publications };
    }
    const [normRows, versionRows, publicationRows] = await Promise.all([
      db.prepare('SELECT id, slug, meta_json, history_json FROM law_norms ORDER BY sort_title, slug').all<NormRow>(),
      db.prepare('SELECT norm_id, version_id, version_json, full_citation, publication_ref_json FROM law_versions ORDER BY norm_id, valid_from').all<VersionRow>(),
      db.prepare('SELECT publication_json FROM law_publications ORDER BY publication_date DESC, issue DESC').all<{ publication_json: string }>(),
    ]);
    const versionsByNorm = new Map<string, VersionRow[]>();
    for (const row of versionRows.results) {
      const list = versionsByNorm.get(row.norm_id) ?? [];
      list.push(row);
      versionsByNorm.set(row.norm_id, list);
    }
    const records = normRows.results.map((row) => assembleRecord(row, versionsByNorm.get(row.id) ?? [], new Map()));
    const publications = publicationRows.results.map((row) => JSON.parse(row.publication_json) as Verkuendung);
    corpusCache.records = records;
    corpusCache.publications = publications;
    corpusCache.syncedAt = syncedAt;
    return { records, publications };
  };

  const loadVersionRows = async (normId: string): Promise<VersionRow[]> =>
    (await db.prepare('SELECT norm_id, version_id, version_json, full_citation, publication_ref_json FROM law_versions WHERE norm_id = ? ORDER BY valid_from').bind(normId).all<VersionRow>()).results;

  return {
    kind: 'd1',
    async listNorms() {
      return (await loadCorpus()).records;
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
    async listPublications() {
      return (await loadCorpus()).publications;
    },
    async getPublication(slug) {
      const row = await db.prepare('SELECT publication_json FROM law_publications WHERE slug = ?').bind(slug).first<{ publication_json: string }>();
      return row ? JSON.parse(row.publication_json) as Verkuendung : null;
    },
    async getSearchDocuments(slugs, unitsMatch) {
      if (slugs.length === 0) return [];
      const placeholders = slugs.map(() => '?').join(', ');
      const documents = await db.prepare(`SELECT d.norm_id, d.version_id, d.document_json FROM law_search_documents d JOIN law_norms n ON n.id = d.norm_id WHERE n.slug IN (${placeholders})`).bind(...slugs).all<{ norm_id: string; version_id: string; document_json: string }>();
      const unitColumns = 'norm_id, version_id, provision_path, anchor, block_type, references_json, label, heading, body';
      const units = unitsMatch === undefined
        ? []
        : unitsMatch === null
          ? (await db.prepare(`SELECT ${unitColumns} FROM law_search WHERE slug IN (${placeholders})`).bind(...slugs).all<Record<string, string>>()).results
          : (await db.prepare(`SELECT ${unitColumns} FROM law_search WHERE law_search MATCH ? AND slug IN (${placeholders})`).bind(unitsMatch, ...slugs).all<Record<string, string>>()).results;
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
      return documents.results.map((row) => ({
        document: JSON.parse(row.document_json) as SearchIndexDocument,
        units: (unitsByKey.get(`${row.norm_id}:${row.version_id}`) ?? []).sort((left, right) => left.unitIndex - right.unitIndex),
      }));
    },
    async searchCandidates({ match, limit, offset, types = [] }) {
      const typeFilter = types.length > 0 ? ` AND n.type IN (${types.map(() => '?').join(', ')})` : '';
      if (match) {
        const rows = await db.prepare(`SELECT s.slug, min(s.rank) AS best FROM law_search s JOIN law_norms n ON n.id = s.norm_id WHERE law_search MATCH ?${typeFilter} GROUP BY s.slug ORDER BY best LIMIT ? OFFSET ?`).bind(match, ...types, limit, offset).all<{ slug: string }>();
        const total = await db.prepare(`SELECT count(DISTINCT s.slug) AS total FROM law_search s JOIN law_norms n ON n.id = s.norm_id WHERE law_search MATCH ?${typeFilter}`).bind(match, ...types).first<{ total: number }>();
        return { slugs: rows.results.map((row) => row.slug), total: total?.total ?? rows.results.length };
      }
      const rows = await db.prepare(`SELECT n.slug FROM law_norms n WHERE 1 = 1${typeFilter} ORDER BY n.current_valid_from DESC, n.sort_title LIMIT ? OFFSET ?`).bind(...types, limit, offset).all<{ slug: string }>();
      const total = await db.prepare(`SELECT count(*) AS total FROM law_norms n WHERE 1 = 1${typeFilter}`).bind(...types).first<{ total: number }>();
      return { slugs: rows.results.map((row) => row.slug), total: total?.total ?? rows.results.length };
    },
    async getRuntimeMeta(key) {
      return (await db.prepare('SELECT value FROM law_runtime_meta WHERE key = ?').bind(key).first<{ value: string }>())?.value ?? null;
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
  const find = async (slug: string): Promise<NormRecord | null> => (await context()).lookup.get(slug) ?? null;

  return {
    kind: 'files',
    async listNorms() {
      return (await context()).norms.map(withoutBodies);
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
    async listPublications() {
      return (await context()).publications;
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
    async searchCandidates({ match, limit, offset, types = [] }) {
      const ctx = await context();
      const terms = (match ?? '').toLocaleLowerCase('de').replace(/[()"*]/gu, '').split(/\s+(?:OR|AND)\s+|\s+/u).filter(Boolean);
      const matching = ctx.norms.filter((record) => {
        if (types.length > 0 && !types.includes(record.meta.type)) return false;
        if (terms.length === 0) return true;
        const haystack = [record.meta.title, record.meta.shortTitle, record.meta.abbr ?? '', ...record.versions.flatMap((version) => [version.title ?? '', version.shortTitle ?? ''])].join(' ').toLocaleLowerCase('de');
        return terms.some((term) => haystack.includes(term));
      });
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
