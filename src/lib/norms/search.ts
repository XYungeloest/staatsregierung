import { loadAllNorms } from './loader.ts';
import {
  formatDate,
  formatNormStatus,
  formatNormType,
  getBlockAnchorId,
  toDisplayText,
} from './presentation.ts';
import {
  buildNormPublicationReferenceLookup,
  loadAllVerkuendungen,
  type NormPublicationReference,
} from './publications.ts';
import { getNormUrl, getNormVersionUrl, getPublicationUrl } from './routes.ts';
import type { NormBodyBlock, NormRecord, NormVersion } from './schema.ts';

export interface SearchIndexDocument {
  id: string;
  slug: string;
  versionId: string;
  url: string;
  currentUrl: string;
  isCurrent: boolean;
  title: string;
  shortTitle: string;
  abbr: string;
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
  publicationDate?: string;
  publicationIssue?: string;
  publicationEntryTitle?: string;
  changeNote: string;
  validFrom: string;
  validTo: string | null;
  bodyText: string;
  contexts: string[];
  hitUnits: SearchHitUnit[];
  resultLabel: string;
}

export interface SearchHitUnit {
  type: string;
  label: string;
  title: string;
  text: string;
  anchor: string;
}

export interface SearchFilterOptions {
  types: Array<{ value: string; label: string }>;
  ministries: string[];
  subjects: string[];
  statuses: Array<{ value: string; label: string }>;
}

export interface SearchIndexPayload {
  generatedAt: string;
  documentCount: number;
  filters: SearchFilterOptions;
  documents: SearchIndexDocument[];
}

interface CollectedBodyContent {
  textParts: string[];
  contexts: string[];
  hitUnits: SearchHitUnit[];
}

function addText(target: string[], value: string | undefined): void {
  if (!value) {
    return;
  }

  const text = toDisplayText(value).trim();
  if (text) {
    target.push(text);
  }
}

function collectBodyContent(blocks: NormBodyBlock[]): CollectedBodyContent {
  const textParts: string[] = [];
  const contexts: string[] = [];
  const hitUnits: SearchHitUnit[] = [];

  const visit = (
    entries: NormBodyBlock[],
    path: number[] = [],
    currentUnit?: SearchHitUnit & { textParts: string[] },
  ) => {
    for (const [index, block] of entries.entries()) {
      const currentPath = [...path, index];
      const headingParts: string[] = [];
      addText(headingParts, block.label);
      addText(headingParts, block.title);

      if (headingParts.length > 0) {
        const heading = headingParts.join(' ');
        textParts.push(heading);
        currentUnit?.textParts.push(heading);
      }

      const isHitUnit =
        block.type === 'paragraph' ||
        block.type === 'article' ||
        block.type === 'section' ||
        block.type === 'subsection' ||
        block.type === 'annex';
      const nextUnit = isHitUnit
        ? {
            type: block.type,
            label: toDisplayText(block.label ?? ''),
            title: toDisplayText(block.title ?? block.label ?? ''),
            text: '',
            anchor: getBlockAnchorId(currentPath, block),
            textParts: headingParts.length > 0 ? [headingParts.join(' ')] : [],
          }
        : currentUnit;

      if (block.text) {
        const text = toDisplayText(block.text).trim();
        if (text) {
          textParts.push(text);
          contexts.push(text);
          nextUnit?.textParts.push(text);
        }
      }

      if (block.children) {
        visit(block.children, currentPath, nextUnit);
      }

      if (isHitUnit && nextUnit && nextUnit.textParts.length > 0) {
        hitUnits.push({
          type: nextUnit.type,
          label: nextUnit.label,
          title: nextUnit.title,
          text: nextUnit.textParts.join('\n\n'),
          anchor: nextUnit.anchor,
        });
      }
    }
  };

  visit(blocks);

  return {
    textParts,
    contexts,
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

function buildSearchDocument(
  record: NormRecord,
  version: NormVersion,
  publicationReference?: NormPublicationReference,
): SearchIndexDocument {
  const { textParts, contexts, hitUnits } = collectBodyContent(version.body);
  const isApplicableCurrentVersion = version.isCurrent && record.meta.status === 'in-force';
  const resultLabel = version.isCurrent
    ? record.meta.status === 'future-effective'
      ? `Verkündet; tritt am ${formatDate(record.meta.effectiveDate ?? version.validFrom)} in Kraft`
      : record.meta.status === 'pending-effective'
        ? 'Verkündet; Inkrafttreten noch nicht belegt'
      : record.meta.status === 'repealed' || record.meta.status === 'historical'
        ? `Letzte Fassung vom ${formatDate(version.validFrom)}`
        : record.meta.status === 'one-time-act'
          ? 'Abgeschlossener einmaliger Rechtsakt'
          : 'Aktuelle Fassung'
    : `Historische Fassung vom ${formatDate(version.validFrom)}`;

  return {
    id: `${record.meta.slug}:${version.versionId}`,
    slug: record.meta.slug,
    versionId: version.versionId,
    url: version.isCurrent
      ? getNormUrl(record.meta.slug)
      : getNormVersionUrl(record.meta.slug, version.versionId),
    currentUrl: getNormUrl(record.meta.slug),
    isCurrent: isApplicableCurrentVersion,
    title: toDisplayText(record.meta.title),
    shortTitle: toDisplayText(record.meta.shortTitle),
    abbr: toDisplayText(record.meta.abbr),
    type: record.meta.type,
    typeLabel: formatNormType(record.meta.type),
    ministry: toDisplayText(record.meta.ministry),
    subjects: record.meta.subjects.map((subject) => toDisplayText(subject)),
    keywords: record.meta.keywords.map((keyword) => toDisplayText(keyword)),
    status: record.meta.status,
    statusLabel: formatNormStatus(record.meta.status),
    summary: toDisplayText(record.meta.summary),
    initialCitation: toDisplayText(record.meta.initialCitation),
    citation: toDisplayText(version.citation),
    publication: publicationReference
      ? `${publicationReference.publication} ${publicationReference.publicationDate} Nr. ${publicationReference.issue}`
      : extractPublication(version.citation),
    publicationSlug: publicationReference?.publicationSlug,
    publicationUrl: publicationReference ? getPublicationUrl(publicationReference.publicationSlug) : undefined,
    publicationTitle: publicationReference ? toDisplayText(publicationReference.publicationTitle) : undefined,
    publicationDate: publicationReference?.publicationDate,
    publicationIssue: publicationReference?.issue,
    publicationEntryTitle: publicationReference ? toDisplayText(publicationReference.entryTitle) : undefined,
    changeNote: toDisplayText(version.changeNote),
    validFrom: version.validFrom,
    validTo: version.validTo,
    bodyText: textParts.join('\n\n'),
    contexts,
    hitUnits,
    resultLabel,
  };
}

function buildFilterOptions(records: NormRecord[]): SearchFilterOptions {
  const types = new Map<string, string>();
  const ministries = new Set<string>();
  const subjects = new Set<string>();
  const statuses = new Map<string, string>();

  for (const record of records) {
    types.set(record.meta.type, formatNormType(record.meta.type));
    ministries.add(toDisplayText(record.meta.ministry));
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
  };
}

export async function buildSearchIndexPayload(): Promise<SearchIndexPayload> {
  const [records, publications] = await Promise.all([loadAllNorms(), loadAllVerkuendungen()]);
  const publicationReferences = buildNormPublicationReferenceLookup(publications);
  const documents = records
    .flatMap((record) =>
      record.versions.map((version) =>
        buildSearchDocument(
          record,
          version,
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

  return {
    generatedAt: new Date().toISOString(),
    documentCount: documents.length,
    filters: buildFilterOptions(records),
    documents,
  };
}
