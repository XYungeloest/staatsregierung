import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { ContentValidationError } from './schema.ts';

export const PUBLICATION_ENTRY_TYPES = [
  'gesetz',
  'verordnung',
  'verwaltungsvorschrift',
  'foerderrichtlinie',
  'bekanntmachung',
  'staatsvertrag',
  'sonstiges',
] as const;

const CONTENT_ROOT = resolve(process.cwd(), 'content', 'verkuendungen');
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export type PublicationEntryType = (typeof PUBLICATION_ENTRY_TYPES)[number];

export type PublicationSourceAvailability = 'versioned' | 'external' | 'not-versioned';

export interface PublicationSourceReference {
  label: string;
  kind: 'original' | 'index' | 'transcription' | 'structured-html-transcription';
  availability: PublicationSourceAvailability;
  localSource?: string;
  url?: string;
  note?: string;
}

export interface VerkuendungEntry {
  id: string;
  title: string;
  type: PublicationEntryType;
  citation: string;
  startPage?: string;
  pages?: string;
  documentDate?: string;
  normSlug?: string;
  versionId?: string;
}

export interface Verkuendung {
  slug: string;
  title: string;
  year: number;
  issue: string;
  date: string;
  publication: string;
  pdf?: string;
  sourceFiles?: string[];
  sourceReferences?: PublicationSourceReference[];
  entries: VerkuendungEntry[];
}

export interface NormPublicationReference {
  publicationSlug: string;
  publicationTitle: string;
  publicationDate: string;
  publication: string;
  issue: string;
  entryId: string;
  entryTitle: string;
  citation: string;
  startPage?: string;
  pages?: string;
}

export interface PublicationEntryRecord {
  publication: Verkuendung;
  entry: VerkuendungEntry;
}

const PUBLICATION_ENTRY_TYPE_LABELS: Record<PublicationEntryType, string> = {
  gesetz: 'Gesetz',
  verordnung: 'Verordnung',
  verwaltungsvorschrift: 'Verwaltungsvorschrift',
  foerderrichtlinie: 'Förderrichtlinie',
  bekanntmachung: 'Bekanntmachung',
  staatsvertrag: 'Staatsvertrag',
  sonstiges: 'Sonstige Veröffentlichung',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new ContentValidationError(`${path}: ${message}`);
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    fail(path, 'muss ein Objekt sein');
  }

  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    fail(path, 'muss ein String sein');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    fail(path, 'darf nicht leer sein');
  }

  return trimmed;
}

function expectOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return expectString(value, path);
}

function expectSlug(value: unknown, path: string): string {
  const slug = expectString(value, path);

  if (!SLUG_PATTERN.test(slug)) {
    fail(path, 'muss ein technischer Slug sein');
  }

  return slug;
}

function expectIsoDate(value: unknown, path: string): string {
  const date = expectString(value, path);

  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    fail(path, 'muss ein Datum im Format YYYY-MM-DD sein');
  }

  return date;
}

function expectYear(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(path, 'muss eine Jahreszahl sein');
  }

  if (value < 1900 || value > 2200) {
    fail(path, 'liegt außerhalb des erwarteten Jahresbereichs');
  }

  return value;
}

function expectEnumValue<T extends readonly string[]>(
  value: unknown,
  path: string,
  allowed: T,
): T[number] {
  const stringValue = expectString(value, path);

  if (!allowed.includes(stringValue)) {
    fail(path, `muss einer dieser Werte sein: ${allowed.join(', ')}`);
  }

  return stringValue as T[number];
}

function parseVerkuendungEntry(value: unknown, path: string): VerkuendungEntry {
  const object = expectObject(value, path);
  const normSlug = expectOptionalString(object.normSlug, `${path}.normSlug`);
  const versionId = expectOptionalString(object.versionId, `${path}.versionId`);

  if (versionId && !normSlug) {
    fail(`${path}.versionId`, 'setzt normSlug voraus');
  }

  return {
    id: expectSlug(object.id, `${path}.id`),
    title: expectString(object.title, `${path}.title`),
    type: expectEnumValue(object.type, `${path}.type`, PUBLICATION_ENTRY_TYPES),
    citation: expectString(object.citation, `${path}.citation`),
    startPage: expectOptionalString(object.startPage, `${path}.startPage`),
    pages: expectOptionalString(object.pages, `${path}.pages`),
    documentDate: object.documentDate === undefined
      ? undefined
      : expectIsoDate(object.documentDate, `${path}.documentDate`),
    normSlug,
    versionId,
  };
}

function parseSourceReference(value: unknown, path: string): PublicationSourceReference {
  const object = expectObject(value, path);
  const availability = expectEnumValue(
    object.availability,
    `${path}.availability`,
    ['versioned', 'external', 'not-versioned'] as const,
  );
  const localSource = expectOptionalString(object.localSource, `${path}.localSource`);
  const url = expectOptionalString(object.url, `${path}.url`);

  if (availability === 'versioned' && !localSource) {
    fail(`${path}.localSource`, 'ist für eine versionierte Quelle erforderlich');
  }
  if (availability === 'external' && !url) {
    fail(`${path}.url`, 'ist für eine externe Quelle erforderlich');
  }
  if (availability === 'not-versioned' && (localSource || url)) {
    fail(path, 'darf für eine nicht mitversionierte Quelle keinen lokalen Pfad oder URL behaupten');
  }

  return {
    label: expectString(object.label, `${path}.label`),
    kind: expectEnumValue(
      object.kind,
      `${path}.kind`,
      ['original', 'index', 'transcription', 'structured-html-transcription'] as const,
    ),
    availability,
    localSource,
    url,
    note: expectOptionalString(object.note, `${path}.note`),
  };
}

export function parseVerkuendung(value: unknown, path = 'verkuendung.json'): Verkuendung {
  const object = expectObject(value, path);
  const entries = object.entries;

  if (!Array.isArray(entries)) {
    fail(`${path}.entries`, 'muss ein Array sein');
  }

  const parsedEntries = entries.map((entry, index) =>
    parseVerkuendungEntry(entry, `${path}.entries[${index}]`),
  );
  const knownEntryIds = new Set<string>();

  for (const [index, entry] of parsedEntries.entries()) {
    if (knownEntryIds.has(entry.id)) {
      fail(`${path}.entries[${index}].id`, 'ist innerhalb der Verkündung doppelt vergeben');
    }

    knownEntryIds.add(entry.id);
  }

  const date = expectIsoDate(object.date, `${path}.date`);
  const year = expectYear(object.year, `${path}.year`);

  if (!date.startsWith(`${year}-`)) {
    fail(`${path}.year`, 'muss zum Verkündungsdatum passen');
  }

  return {
    slug: expectSlug(object.slug, `${path}.slug`),
    title: expectString(object.title, `${path}.title`),
    year,
    issue: expectString(object.issue, `${path}.issue`),
    date,
    publication: expectString(object.publication, `${path}.publication`),
    pdf: expectOptionalString(object.pdf, `${path}.pdf`),
    sourceFiles: object.sourceFiles === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(object.sourceFiles)) fail(`${path}.sourceFiles`, 'muss ein Array sein');
          return object.sourceFiles.map((entry, index) =>
            expectString(entry, `${path}.sourceFiles[${index}]`),
          );
        })(),
    sourceReferences: object.sourceReferences === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(object.sourceReferences)) {
            fail(`${path}.sourceReferences`, 'muss ein Array sein');
          }
          return object.sourceReferences.map((entry, index) =>
            parseSourceReference(entry, `${path}.sourceReferences[${index}]`),
          );
        })(),
    entries: parsedEntries,
  };
}

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ContentValidationError(`${filePath}: enthält ungültiges JSON`);
    }

    throw error;
  }
}

async function listJsonFiles(directoryPath: string): Promise<string[]> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    return entries
      .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry: Dirent) => entry.name)
      .sort((left: string, right: string) => left.localeCompare(right, 'de'));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

function compareIssues(left: string, right: string): number {
  const leftNumber = Number.parseInt(left, 10);
  const rightNumber = Number.parseInt(right, 10);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right, 'de', { numeric: true });
}

export function getPublicationLabel(publication: Verkuendung): string {
  return `${publication.publication} ${publication.year} Nr. ${publication.issue}`;
}

export function formatPublicationEntryType(value: PublicationEntryType): string {
  return PUBLICATION_ENTRY_TYPE_LABELS[value];
}

export function listPublicationEntries(publications: Verkuendung[]): PublicationEntryRecord[] {
  return publications.flatMap((publication) =>
    publication.entries.map((entry) => ({
      publication,
      entry,
    })),
  );
}

export async function loadVerkuendung(slug: string): Promise<Verkuendung> {
  const filePath = join(CONTENT_ROOT, `${slug}.json`);
  const json = await readJsonFile(filePath);
  const publication = parseVerkuendung(json, `content/verkuendungen/${slug}.json`);

  if (publication.slug !== slug) {
    throw new ContentValidationError(
      `content/verkuendungen/${slug}.json.slug: muss dem Dateinamen entsprechen`,
    );
  }

  return publication;
}

export async function loadAllVerkuendungen(): Promise<Verkuendung[]> {
  const fileNames = await listJsonFiles(CONTENT_ROOT);
  const publications = await Promise.all(
    fileNames.map((fileName) => loadVerkuendung(fileName.replace(/\.json$/u, ''))),
  );

  return publications.sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }

    if (left.publication !== right.publication) {
      return left.publication.localeCompare(right.publication, 'de');
    }

    return compareIssues(right.issue, left.issue);
  });
}

export function buildNormPublicationReferenceLookup(
  publications: Verkuendung[],
): Map<string, NormPublicationReference> {
  const references = new Map<string, NormPublicationReference>();

  for (const publication of publications) {
    for (const entry of publication.entries) {
      if (!entry.normSlug || !entry.versionId) {
        continue;
      }

      const key = `${entry.normSlug}:${entry.versionId}`;
      if (references.has(key)) {
        continue;
      }

      references.set(key, {
        publicationSlug: publication.slug,
        publicationTitle: publication.title,
        publicationDate: publication.date,
        publication: publication.publication,
        issue: publication.issue,
        entryId: entry.id,
        entryTitle: entry.title,
        citation: entry.citation,
        startPage: entry.startPage,
        pages: entry.pages,
      });
    }
  }

  return references;
}

export function getNormPublicationReference(
  publications: Verkuendung[],
  normSlug: string,
  versionId: string,
): NormPublicationReference | undefined {
  return buildNormPublicationReferenceLookup(publications).get(`${normSlug}:${versionId}`);
}
