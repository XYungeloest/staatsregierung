import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  ContentValidationError,
  parseNormHistory,
  parseNormMeta,
  parseNormVersion,
  validateNormRecord,
  type NormHistory,
  type NormMeta,
  type NormRecord,
  type NormVersion,
} from './schema.ts';

const CONTENT_ROOT = resolve(process.cwd(), 'content', 'normen');

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

async function listDirectories(directoryPath: string): Promise<string[]> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    return entries
      .filter((entry: Dirent) => entry.isDirectory())
      .map((entry: Dirent) => entry.name)
      .sort((left: string, right: string) => left.localeCompare(right));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return [];
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
      .sort((left: string, right: string) => left.localeCompare(right));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

export function getNormContentRoot(): string {
  return CONTENT_ROOT;
}

export async function listNormSlugs(): Promise<string[]> {
  return listDirectories(CONTENT_ROOT);
}

export async function loadNormMeta(slug: string): Promise<NormMeta> {
  const filePath = join(CONTENT_ROOT, slug, 'meta.json');
  const json = await readJsonFile(filePath);
  const meta = parseNormMeta(json, `content/normen/${slug}/meta.json`);

  if (meta.slug !== slug) {
    throw new ContentValidationError(
      `content/normen/${slug}/meta.json.slug: muss dem Verzeichnisnamen entsprechen`,
    );
  }

  return meta;
}

export async function loadNormHistory(slug: string): Promise<NormHistory> {
  const filePath = join(CONTENT_ROOT, slug, 'history.json');
  const json = await readJsonFile(filePath);
  return parseNormHistory(json, `content/normen/${slug}/history.json`);
}

export async function loadNormVersions(slug: string): Promise<NormVersion[]> {
  const versionsDirectory = join(CONTENT_ROOT, slug, 'versions');
  const fileNames = await listJsonFiles(versionsDirectory);

  const versions = await Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = join(versionsDirectory, fileName);
      const json = await readJsonFile(filePath);
      const version = parseNormVersion(json, `content/normen/${slug}/versions/${fileName}`);
      const versionIdFromFile = fileName.replace(/\.json$/u, '');

      if (version.versionId !== versionIdFromFile) {
        throw new ContentValidationError(
          `content/normen/${slug}/versions/${fileName}.versionId: muss dem Dateinamen entsprechen`,
        );
      }

      return version;
    }),
  );

  return versions.sort((left, right) => left.validFrom.localeCompare(right.validFrom));
}

export async function loadNorm(slug: string): Promise<NormRecord> {
  const [meta, history, versions] = await Promise.all([
    loadNormMeta(slug),
    loadNormHistory(slug),
    loadNormVersions(slug),
  ]);

  return validateNormRecord({ meta, history, versions }, slug);
}

export async function loadAllNorms(): Promise<NormRecord[]> {
  const slugs = await listNormSlugs();
  const records = await Promise.all(slugs.map((slug) => loadNorm(slug)));

  return records.sort((left, right) => left.meta.title.localeCompare(right.meta.title));
}

export function getCurrentVersion(record: NormRecord): NormVersion {
  const version = record.versions.find((entry) => entry.isCurrent);

  if (!version) {
    throw new ContentValidationError(`${record.meta.slug}: enthält keine aktuelle Fassung`);
  }

  return version;
}

export function getVersionById(record: NormRecord, versionId: string): NormVersion | undefined {
  return record.versions.find((version) => version.versionId === versionId);
}
