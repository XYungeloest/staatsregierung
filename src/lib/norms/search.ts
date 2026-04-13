import { loadAllNorms } from './loader.ts';
import { formatNormStatus, formatNormType, toDisplayText } from './presentation.ts';
import { getNormUrl, getNormVersionUrl } from './routes.ts';
import type { NormBodyBlock, NormRecord, NormVersion } from './schema.ts';

export interface SearchIndexDocument {
  id: string;
  slug: string;
  versionId: string;
  url: string;
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
  changeNote: string;
  validFrom: string;
  validTo: string | null;
  bodyText: string;
  contexts: string[];
  resultLabel: string;
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

  const visit = (entries: NormBodyBlock[]) => {
    for (const block of entries) {
      const headingParts: string[] = [];
      addText(headingParts, block.label);
      addText(headingParts, block.title);

      if (headingParts.length > 0) {
        textParts.push(headingParts.join(' '));
      }

      if (block.text) {
        const text = toDisplayText(block.text).trim();
        if (text) {
          textParts.push(text);
          contexts.push(text);
        }
      }

      if (block.children) {
        visit(block.children);
      }
    }
  };

  visit(blocks);

  return {
    textParts,
    contexts,
  };
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

function buildSearchDocument(record: NormRecord, version: NormVersion): SearchIndexDocument {
  const { textParts, contexts } = collectBodyContent(version.body);
  const isRepealed = record.meta.status === 'repealed';
  const resultLabel = isRepealed
    ? `Letzte Fassung ${version.versionId}`
    : 'Aktuelle Fassung';

  return {
    id: `${record.meta.slug}:${version.versionId}`,
    slug: record.meta.slug,
    versionId: version.versionId,
    url: version.isCurrent
      ? getNormUrl(record.meta.slug)
      : getNormVersionUrl(record.meta.slug, version.versionId),
    isCurrent: version.isCurrent,
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
    changeNote: toDisplayText(version.changeNote),
    validFrom: version.validFrom,
    validTo: version.validTo,
    bodyText: textParts.join('\n\n'),
    contexts,
    resultLabel,
  };
}

function getLatestVersion(record: NormRecord): NormVersion {
  return [...record.versions].sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0];
}

function getSearchVersionForRecord(record: NormRecord): NormVersion {
  if (record.meta.status === 'repealed') {
    return getLatestVersion(record);
  }

  const currentVersion = record.versions.find((version) => version.isCurrent);

  if (!currentVersion) {
    return getLatestVersion(record);
  }

  return currentVersion;
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
  const records = await loadAllNorms();
  const documents = records
    .map((record) => buildSearchDocument(record, getSearchVersionForRecord(record)))
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
