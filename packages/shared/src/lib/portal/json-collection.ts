import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PortalContentValidationError } from '@ostrecht/shared/lib/portal/schema.ts';
import { resolveRepositoryRoot } from '@ostrecht/shared/lib/repository-root.ts';

/**
 * Dateizugriff auf die JSON-Sammlungen unter content/: gemeinsame Grundlage des Portal-Loaders
 * (loader.ts) und der schmalen Themen-/Presse-Loader (norm-portal-content.ts), die der D1-Sync
 * erreicht. Bewusst ohne Organisations- und Stichtagslogik.
 */

export const CONTENT_ROOT = join(resolveRepositoryRoot(), 'content');

export async function readJsonFile(filePath: string): Promise<unknown> {
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

export async function listJsonFiles(directoryPath: string): Promise<string[]> {
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

export async function loadCollection<T>(
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
