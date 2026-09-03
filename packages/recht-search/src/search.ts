import { loadAllNorms } from '@ostrecht/shared/lib/norms/loader.ts';
import {
  buildNormFullCitation,
  buildNormRecordLookup,
  type NormRecordLookup,
} from '@ostrecht/shared/lib/norms/citation.ts';
import {
  buildNormAnchorMap,
  formatDate,
  formatNormStatus,
  formatNormType,
  getResolvedBlockAnchorId,
  toDisplayText,
} from '@ostrecht/shared/lib/norms/presentation.ts';
import {
  buildNormPublicationReferenceLookup,
  loadAllVerkuendungen,
  type NormPublicationReference,
  type Verkuendung,
} from '@ostrecht/shared/lib/norms/publications.ts';
import { getNormUrl, getNormVersionUrl, getPublicationUrl } from '@ostrecht/shared/lib/norms/routes.ts';
import { getNormVersionIdentity } from '@ostrecht/shared/lib/norms/identity.ts';
import type { NormBodyBlock, NormRecord, NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';
import {
  classifyNormVersion,
  EDITORIAL_REFERENCE_DATE,
  type VersionTemporalKind,
} from '@ostrecht/shared/lib/norms/versions.ts';
import {
  formatNormOriginKind,
  getNormOriginInfo,
  type NormOriginKind,
} from '@ostrecht/shared/lib/norms/origin.ts';

export interface SearchIndexDocument {
  id: string;
  slug: string;
  versionId: string;
  url: string;
  currentUrl: string;
  isCurrent: boolean;
  versionKind: VersionTemporalKind;
  isAmendment: boolean;
  origin: NormOriginKind;
  originLabel: string;
  title: string;
  shortTitle: string;
  abbr: string;
  /** Historische oder alternative öffentliche Bezeichnungen derselben Norm. */
  aliases?: string[];
  type: string;
  typeLabel: string;
  ministry: string;
  subjects: string[];
  keywords: string[];
  status: string;
  statusLabel: string;
  summary: string;
  initialCitation: string;
  citation: string;
  publication: string;
  publicationSlug?: string;
  publicationUrl?: string;
  publicationTitle?: string;
  publicationAliases?: string[];
  publicationDate?: string;
  publicationIssue?: string;
  publicationSource?: string;
  publicationYear?: string;
  publicationPage?: string;
  publicationEntryTitle?: string;
  changeNote: string;
  validFrom: string;
  validTo: string | null;
  bodySupplement: string;
  hitUnits: SearchHitUnit[];
  resultLabel: string;
}

export interface SearchHitUnit {
  type: string;
  label: string;
  title: string;
  text: string;
  anchor: string;
  /** Strukturadressen aus dem kanonischen Normkörper, nicht aus Volltext abgeleitet. */
  references?: {
    paragraph?: string;
    article?: string;
    subsections?: string[];
  };
}

export interface SearchFilterOptions {
  types: Array<{ value: string; label: string }>;
  ministries: string[];
  subjects: string[];
  statuses: Array<{ value: string; label: string }>;
  origins: Array<{ value: NormOriginKind; label: string }>;
  versionKinds: Array<{ value: VersionTemporalKind; label: string }>;
  publications: string[];
  years: string[];
}

export interface SearchIndexPayload {
  generatedAt: string;
  buildCommit: string;
  documentCount: number;
  latestPublication?: {
    slug: string;
    date: string;
    publication: string;
    year: number;
    issue: string;
  };
  filters: SearchFilterOptions;
  documents: SearchIndexDocument[];
  publications: SearchPublication[];
}

/** Kleine, normzentrierte Datenquelle für alle Titel-/Abkürzungsvorschläge. */
export interface SearchSuggestion {
  slug: string;
  url: string;
  title: string;
  shortTitle: string;
  abbr: string;
  aliases: string[];
  typeLabel: string;
}

export interface SearchSuggestionPayload {
  generatedAt: string;
  suggestions: SearchSuggestion[];
}

/** Verkündungsdaten für den einzelnen Direkttreffer oberhalb der Normtreffer. */
export interface SearchPublication {
  slug: string;
  url: string;
  title: string;
  designation: string;
  aliases: string[];
  date: string;
  publication: string;
  year: string;
  issue: string;
}

export interface CollectedBodyContent {
  supplementalTextParts: string[];
  hitUnits: SearchHitUnit[];
}

type MutableSearchHitUnit = SearchHitUnit & { textParts: string[] };

function addText(target: string[], value: string | undefined): void {
  if (!value) {
    return;
  }

  const text = toDisplayText(value).trim();
  if (text) {
    target.push(text);
  }
}

function getStructuralReferenceNumber(value: string | undefined): string | undefined {
  const label = toDisplayText(value ?? '').trim().toLocaleLowerCase('de-DE');
  return label.match(/[0-9]+[a-z]?/u)?.[0];
}

function getSubsectionNumber(block: NormBodyBlock): string | undefined {
  const label = toDisplayText(block.label ?? '').trim();
  return label.match(/^\(\s*([0-9]+[a-z]?)\s*\)$/iu)?.[1]?.toLocaleLowerCase('de-DE');
}

function getHitUnitReferences(block: NormBodyBlock): SearchHitUnit['references'] | undefined {
  const number = getStructuralReferenceNumber(block.label);
  if (!number) return undefined;
  if (block.type === 'paragraph') return { paragraph: number };
  if (block.type === 'article') return { article: number };
  return undefined;
}

export function collectBodyContent(blocks: NormBodyBlock[]): CollectedBodyContent {
  const supplementalTextParts: string[] = [];
  const hitUnits: SearchHitUnit[] = [];
  const anchors = buildNormAnchorMap(blocks);

  const visit = (
    entries: NormBodyBlock[],
    path: number[] = [],
    currentUnit?: MutableSearchHitUnit,
    quoted = false,
  ) => {
    for (const [index, block] of entries.entries()) {
      const currentPath = [...path, index];
      const headingParts: string[] = [];
      addText(headingParts, block.label);
      addText(headingParts, block.title);

      const isHitUnit = !quoted && (
        block.type === 'paragraph' ||
        block.type === 'article' ||
        block.type === 'section' ||
        block.type === 'subsection' ||
        block.type === 'annex');
      const nextUnit = isHitUnit
        ? {
            type: block.type,
            label: toDisplayText(block.label ?? ''),
            title: toDisplayText(block.title ?? block.label ?? ''),
            text: '',
            anchor: getResolvedBlockAnchorId(anchors, currentPath, block),
            references: getHitUnitReferences(block),
            textParts: [],
          }
        : currentUnit;

      if (!quoted && block.type === 'subparagraph' && currentUnit?.references) {
        const subsection = getSubsectionNumber(block);
        if (subsection && !(currentUnit.references.subsections ?? []).includes(subsection)) {
          currentUnit.references.subsections = [...(currentUnit.references.subsections ?? []), subsection];
        }
      }

      if (headingParts.length > 0) {
        const heading = headingParts.join(' ');
        if (nextUnit) nextUnit.textParts.push(heading);
        else supplementalTextParts.push(heading);
      }

      if (block.text) {
        const text = toDisplayText(block.text).trim();
        if (text) {
          if (nextUnit) nextUnit.textParts.push(text);
          else supplementalTextParts.push(text);
        }
      }

      if (block.children) {
        visit(block.children, currentPath, nextUnit, quoted || block.type === 'quotedProvision');
      }

      if (isHitUnit && nextUnit && nextUnit.textParts.length > 0) {
        hitUnits.push({
          type: nextUnit.type,
          label: nextUnit.label,
          title: nextUnit.title,
          text: nextUnit.textParts.join('\n\n'),
          anchor: nextUnit.anchor,
          references: nextUnit.references,
        });
      }
    }
  };

  visit(blocks);

  return {
    supplementalTextParts,
    hitUnits,
  };
}

function extractPublication(value: string): string {
  const displayValue = toDisplayText(value);
  const parenthesized = displayValue.match(/\(([^)]+)\)/u)?.[1]?.trim();

  return parenthesized || displayValue;
}

function compareLabelValuePairs(
  left: { label: string; value: string },
  right: { label: string; value: string },
): number {
  return left.label.localeCompare(right.label, 'de');
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right, 'de');
}

export function isAmendmentRecord(record: Pick<NormRecord, 'meta'>): boolean {
  if (record.meta.type === 'aenderungsvorschrift') return true;
  if (record.meta.enactedNorm || record.meta.enactedNorms?.length) return true;
  return /(?:^|[^\p{L}\p{N}])(?:Änderung|Aenderung|Veränderung|Veraenderung|Bereinigung|Aufhebung)(?:$|[^\p{L}\p{N}])/iu.test(
    record.meta.title,
  );
}

function getNormAliases(record: NormRecord, currentIdentity: ReturnType<typeof getNormVersionIdentity>): string[] {
  const currentValues = new Set([
    currentIdentity.title,
    currentIdentity.shortTitle,
    currentIdentity.abbr ?? '',
  ].map((value) => toDisplayText(value).trim()).filter(Boolean));
  const aliases = new Set<string>();

  for (const version of record.versions) {
    const identity = getNormVersionIdentity(record, version);
    for (const value of [identity.title, identity.shortTitle, identity.abbr]) {
      const alias = toDisplayText(value).trim();
      if (alias && !currentValues.has(alias)) aliases.add(alias);
    }
  }

  return [...aliases].sort(compareStrings);
}

export function buildSearchDocument(
  record: NormRecord,
  version: NormVersion,
  recordsBySlug: NormRecordLookup,
  publicationReference?: NormPublicationReference,
): SearchIndexDocument {
  const identity = getNormVersionIdentity(record, version);
  const aliases = getNormAliases(record, identity);
  const { supplementalTextParts, hitUnits } = collectBodyContent(version.body);
  const agreementText = record.meta.agreementDetails
    ? [
        ...record.meta.agreementDetails.parties.map((party) => party.name),
        ...record.meta.agreementDetails.signatories.flatMap((signatory) => [
          signatory.name,
          signatory.office,
          signatory.representingParty,
        ]),
        ...record.meta.agreementDetails.legalBases.flatMap((basis) => [basis.label, basis.title]),
        record.meta.agreementDetails.signedAt,
      ].map(toDisplayText)
    : [];
  const versionKind = classifyNormVersion(record, version);
  const origin = getNormOriginInfo(record, [...recordsBySlug.values()]);
  const isApplicableCurrentVersion = versionKind === 'current';
  const resultLabel = versionKind === 'future'
    ? `Zukünftige Fassung ab ${formatDate(version.validFrom)}`
    : versionKind === 'unknown-effective'
      ? 'Veröffentlicht; Inkrafttreten noch nicht belegt'
      : versionKind === 'historical'
        ? `Historische Fassung vom ${formatDate(version.validFrom)}`
        : `Geltende Fassung zum ${formatDate(EDITORIAL_REFERENCE_DATE)}`;

  return {
    id: `${record.meta.slug}:${version.versionId}`,
    slug: record.meta.slug,
    versionId: version.versionId,
    url: versionKind === 'current'
      ? getNormUrl(record.meta.slug)
      : getNormVersionUrl(record.meta.slug, version.versionId),
    currentUrl: getNormUrl(record.meta.slug),
    isCurrent: isApplicableCurrentVersion,
    versionKind,
    isAmendment: isAmendmentRecord(record),
    origin: origin.kind,
    originLabel: formatNormOriginKind(origin.kind),
    title: toDisplayText(identity.title),
    shortTitle: toDisplayText(identity.shortTitle),
    abbr: toDisplayText(identity.abbr),
    aliases,
    type: record.meta.type,
    typeLabel: formatNormType(record.meta.type),
    ministry: toDisplayText(record.meta.responsibleMinistry),
    subjects: record.meta.subjects.map((subject) => toDisplayText(subject)),
    keywords: record.meta.keywords.map((keyword) => toDisplayText(keyword)),
    status: record.meta.status,
    statusLabel: formatNormStatus(record.meta.status),
    summary: toDisplayText(identity.summary),
    initialCitation: toDisplayText(record.meta.initialCitation),
    citation: buildNormFullCitation(record, version, recordsBySlug),
    publication: publicationReference
      ? `${publicationReference.publication} ${publicationReference.publicationDate.slice(0, 4)} Nr. ${publicationReference.issue}`
      : extractPublication(version.citation),
    publicationSlug: publicationReference?.publicationSlug,
    publicationUrl: publicationReference ? getPublicationUrl(publicationReference.publicationSlug) : undefined,
    publicationTitle: publicationReference ? toDisplayText(publicationReference.publicationTitle) : undefined,
    publicationAliases: publicationReference?.publicationAliases?.map(toDisplayText),
    publicationDate: publicationReference?.publicationDate,
    publicationIssue: publicationReference?.issue,
    publicationSource: publicationReference?.publication,
    publicationYear: publicationReference?.publicationDate.slice(0, 4),
    publicationPage: publicationReference?.pages ?? publicationReference?.startPage,
    publicationEntryTitle: publicationReference ? toDisplayText(publicationReference.entryTitle) : undefined,
    changeNote: toDisplayText(version.changeNote),
    validFrom: version.validFrom,
    validTo: version.validTo,
    bodySupplement: [...agreementText, ...supplementalTextParts].join('\n\n'),
    hitUnits,
    resultLabel,
  };
}

export function buildSearchSuggestions(records: NormRecord[]): SearchSuggestion[] {
  return records.flatMap((record) => {
    const version = record.versions.find((entry) => classifyNormVersion(record, entry) === 'current');
    if (!version) return [];
    const identity = getNormVersionIdentity(record, version);
    return [{
      slug: record.meta.slug,
      url: getNormUrl(record.meta.slug),
      title: toDisplayText(identity.title),
      shortTitle: toDisplayText(identity.shortTitle),
      abbr: toDisplayText(identity.abbr),
      aliases: getNormAliases(record, identity),
      typeLabel: formatNormType(record.meta.type),
    }];
  }).sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

export function buildSearchPublications(publications: Verkuendung[]): SearchPublication[] {
  return publications.map((publication) => {
    const designation = `${publication.publication} ${publication.year} Nr. ${publication.issue}`;
    const aliases = [
      publication.originalIssueDesignation,
      publication.alternativeIssueDesignation,
      publication.title,
    ].filter((value): value is string => Boolean(value && value !== designation));
    return {
      slug: publication.slug,
      url: getPublicationUrl(publication.slug),
      title: toDisplayText(publication.title),
      designation,
      aliases,
      date: publication.date,
      publication: publication.publication,
      year: String(publication.year),
      issue: publication.issue,
    };
  });
}

export async function buildSearchSuggestionPayload(): Promise<SearchSuggestionPayload> {
  const records = await loadAllNorms();
  return {
    generatedAt: new Date().toISOString(),
    suggestions: buildSearchSuggestions(records),
  };
}

export function buildFilterOptions(records: NormRecord[]): SearchFilterOptions {
  const types = new Map<string, string>();
  const ministries = new Set<string>();
  const subjects = new Set<string>();
  const statuses = new Map<string, string>();

  for (const record of records) {
    types.set(record.meta.type, formatNormType(record.meta.type));
    const responsibility = toDisplayText(record.meta.responsibleMinistry);
    if (responsibility) ministries.add(responsibility);
    statuses.set(record.meta.status, formatNormStatus(record.meta.status));

    for (const subject of record.meta.subjects) {
      subjects.add(toDisplayText(subject));
    }
  }

  return {
    types: [...types.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort(compareLabelValuePairs),
    ministries: [...ministries].sort(compareStrings),
    subjects: [...subjects].sort(compareStrings),
    statuses: [...statuses.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort(compareLabelValuePairs),
    origins: ([
      'ostdeutsch-original',
      'inherited-amended',
      'inherited-unchanged',
      'origin-unresolved',
    ] as NormOriginKind[]).map((value) => ({ value, label: formatNormOriginKind(value) })),
    versionKinds: [
      { value: 'current', label: 'Zum Stichtag geltend' },
      { value: 'future', label: 'Zukünftige Fassungen' },
      { value: 'historical', label: 'Historische Fassungen' },
      { value: 'unknown-effective', label: 'Inkrafttreten nicht belegt' },
    ],
    publications: [],
    years: [],
  };
}

export async function buildSearchIndexPayload(): Promise<SearchIndexPayload> {
  const [records, publications] = await Promise.all([loadAllNorms(), loadAllVerkuendungen()]);
  const recordsBySlug = buildNormRecordLookup(records);
  const publicationReferences = buildNormPublicationReferenceLookup(publications);
  const documents = records
    .flatMap((record) =>
      record.versions.map((version) =>
        buildSearchDocument(
          record,
          version,
          recordsBySlug,
          publicationReferences.get(`${record.meta.slug}:${version.versionId}`),
        ),
      ),
    )
    .sort((left, right) => {
      if (left.title !== right.title) {
        return left.title.localeCompare(right.title, 'de');
      }

      return right.validFrom.localeCompare(left.validFrom);
    });
  const filters = buildFilterOptions(records);
  filters.publications = [...new Set(documents.map((entry) => entry.publicationSource).filter(Boolean) as string[])].sort(compareStrings);
  filters.years = [...new Set(documents.map((entry) => entry.publicationYear).filter(Boolean) as string[])].sort((left, right) => right.localeCompare(left));

  return {
    generatedAt: new Date().toISOString(),
    buildCommit: import.meta.env?.PORTAL_BUILD_COMMIT ?? process.env.PORTAL_BUILD_COMMIT ?? 'development',
    documentCount: documents.length,
    latestPublication: publications[0]
      ? {
          slug: publications[0].slug,
          date: publications[0].date,
          publication: publications[0].publication,
          year: publications[0].year,
          issue: publications[0].issue,
        }
      : undefined,
    filters,
    documents,
    publications: buildSearchPublications(publications),
  };
}
