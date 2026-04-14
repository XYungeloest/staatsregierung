import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { portalCollections } from './collections.ts';
import {
  PortalContentValidationError,
  parseMinisterium,
  parsePressemitteilung,
  parseRegierungMitglied,
  parseSeite,
  parseStellenangebot,
  type Ministerium,
  type Pressemitteilung,
  type RegierungMitglied,
  type Seite,
  type Stellenangebot,
} from './schema.ts';

const CONTENT_ROOT = resolve(process.cwd(), 'content');

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new PortalContentValidationError(`${filePath}: enthält ungültiges JSON`);
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

async function loadCollection<T>(
  directorySegments: string[],
  parser: (value: unknown, path: string) => T,
): Promise<T[]> {
  const directoryPath = join(CONTENT_ROOT, ...directorySegments);
  const fileNames = await listJsonFiles(directoryPath);

  const entries = await Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = join(directoryPath, fileName);
      const json = await readJsonFile(filePath);
      return parser(json, `content/${directorySegments.join('/')}/${fileName}`);
    }),
  );

  return entries;
}

export async function loadGovernmentMembers(): Promise<RegierungMitglied[]> {
  const entries = await loadCollection(
    portalCollections.regierungMitglied.directorySegments,
    parseRegierungMitglied,
  );
  return entries.sort((left, right) => left.reihenfolge - right.reihenfolge);
}

export async function loadGovernmentMemberBySlug(
  slug: string,
): Promise<RegierungMitglied | undefined> {
  const entries = await loadGovernmentMembers();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadMinistries(): Promise<Ministerium[]> {
  const entries = await loadCollection(portalCollections.ressort.directorySegments, parseMinisterium);
  return entries.sort((left, right) => left.name.localeCompare(right.name, 'de'));
}

export async function loadMinistryBySlug(slug: string): Promise<Ministerium | undefined> {
  const entries = await loadMinistries();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadPressReleases(): Promise<Pressemitteilung[]> {
  const entries = await loadCollection(
    portalCollections.pressemitteilung.directorySegments,
    parsePressemitteilung,
  );
  return entries.sort((left, right) => right.date.localeCompare(left.date));
}

export async function loadPressReleaseBySlug(
  slug: string,
): Promise<Pressemitteilung | undefined> {
  const entries = await loadPressReleases();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadJobOffers(): Promise<Stellenangebot[]> {
  const entries = await loadCollection(
    portalCollections.stellenangebot.directorySegments,
    parseStellenangebot,
  );
  return entries.sort((left, right) => right.datePosted.localeCompare(left.datePosted));
}

export async function loadJobOfferBySlug(slug: string): Promise<Stellenangebot | undefined> {
  const entries = await loadJobOffers();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadPages(): Promise<Seite[]> {
  const entries = await loadCollection(
    portalCollections.statischeSeite.directorySegments,
    parseSeite,
  );
  return entries.sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

export async function loadPageBySlug(slug: string): Promise<Seite | undefined> {
  const entries = await loadPages();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadFeaturedPressReleases(limit = 3): Promise<Pressemitteilung[]> {
  const entries = await loadPressReleases();
  return entries.filter((entry) => entry.isFeatured).slice(0, limit);
}

export async function loadRecentPressReleases(limit = 3): Promise<Pressemitteilung[]> {
  const entries = await loadPressReleases();
  return entries.slice(0, limit);
}

export async function loadCurrentJobOffers(limit = 3): Promise<Stellenangebot[]> {
  const entries = await loadJobOffers();
  return entries.slice(0, limit);
}
