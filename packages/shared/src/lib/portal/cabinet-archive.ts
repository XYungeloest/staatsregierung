import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  CONTENT_ROOT,
  listJsonFiles,
  readJsonFile,
} from '@ostrecht/shared/lib/portal/json-collection.ts';
import { PortalContentValidationError } from '@ostrecht/shared/lib/portal/schema.ts';

/**
 * Archivstände abgeschlossener Regierungen (`content/regierung/archiv/*.json`) samt der Frage,
 * für welche davon ein Mitgliederverzeichnis vorliegt.
 *
 * Warum eine eigene Datei und nicht schema.ts/collections.ts/json-collection.ts: diese drei
 * liegen im Code-Abschluss der D1-Projektion (`scripts/lib/d1-projection-fingerprint.mjs`
 * hasht ihre Blobs). Jede Byteänderung dort gilt als Logikänderung der Projektion und löst den
 * Äquivalenznachweis samt Release-Gate aus, obwohl Archivstände gar nicht projiziert werden.
 * loader.ts, content.ts und dieses Modul liegen außerhalb des Abschlusses.
 */

const ARCHIVE_SEGMENTS = ['regierung', 'archiv'] as const;

/** Ein Archivstand: die neun Pflichtfelder aus CONTENT.md, ohne optionale Felder. */
export interface Kabinettsarchiv {
  /** Zugleich Verzeichnisname unter `archiv/` und letzter Adressbestandteil der Seite. */
  slug: string;
  title: string;
  cabinetName: string;
  formedOn: string;
  endedOn: string;
  coalition: string;
  headOfGovernment: string;
  deputyHead: string;
  summary: string;
}

function expectString(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PortalContentValidationError(`${path}.${key}: muss ein nichtleerer String sein`);
  }
  return value.trim();
}

function expectDate(record: Record<string, unknown>, key: string, path: string): string {
  const value = expectString(record, key, path);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(value))) {
    throw new PortalContentValidationError(`${path}.${key}: muss im Format JJJJ-MM-TT vorliegen`);
  }
  return value;
}

export function parseKabinettsarchiv(value: unknown, path: string): Kabinettsarchiv {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PortalContentValidationError(`${path}: muss ein Objekt sein`);
  }

  const record = value as Record<string, unknown>;
  const slug = expectString(record, 'slug', path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) {
    throw new PortalContentValidationError(`${path}.slug: muss ein technischer Slug sein`);
  }

  const formedOn = expectDate(record, 'formedOn', path);
  const endedOn = expectDate(record, 'endedOn', path);
  if (endedOn < formedOn) {
    throw new PortalContentValidationError(`${path}.endedOn: darf nicht vor formedOn liegen`);
  }

  return {
    slug,
    title: expectString(record, 'title', path),
    cabinetName: expectString(record, 'cabinetName', path),
    formedOn,
    endedOn,
    coalition: expectString(record, 'coalition', path),
    headOfGovernment: expectString(record, 'headOfGovernment', path),
    deputyHead: expectString(record, 'deputyHead', path),
    summary: expectString(record, 'summary', path),
  };
}

/**
 * Alle Archivstände, der jüngste zuerst. Gelesen werden nur die Dateien unmittelbar unter
 * `archiv/`; die gleichnamigen Unterverzeichnisse mit Mitglieder- und Ressortprofilen
 * überspringt `listJsonFiles`.
 */
export async function loadCabinetArchives(): Promise<Kabinettsarchiv[]> {
  const directoryPath = join(CONTENT_ROOT, ...ARCHIVE_SEGMENTS);
  const fileNames = await listJsonFiles(directoryPath);

  const entries = await Promise.all(
    fileNames.map(async (fileName) => {
      const json = await readJsonFile(join(directoryPath, fileName));
      const archive = parseKabinettsarchiv(json, `content/regierung/archiv/${fileName}`);
      if (`${archive.slug}.json` !== fileName) {
        throw new PortalContentValidationError(
          `content/regierung/archiv/${fileName}: slug "${archive.slug}" passt nicht zum Dateinamen`,
        );
      }
      return archive;
    }),
  );

  return entries.sort((left, right) => right.formedOn.localeCompare(left.formedOn));
}

/**
 * Slugs der Archivstände mit Mitgliederverzeichnis. Nur für diese entsteht eine Detailseite —
 * ein Archivstand ohne Mitgliederprofile bekäme sonst eine leere Seite und die Übersicht einen
 * Link ins Leere. Dieselbe Quelle nutzen Übersicht, Detailseite und Routeninventar.
 */
export async function loadCabinetArchiveDetailSlugs(): Promise<Set<string>> {
  const directoryPath = join(CONTENT_ROOT, ...ARCHIVE_SEGMENTS);

  let directories: string[];
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Set();
    throw error;
  }

  const withMembers = await Promise.all(
    directories.map(async (directory) => {
      const members = await listJsonFiles(join(directoryPath, directory, 'mitglieder'));
      return members.length > 0 ? directory : undefined;
    }),
  );

  return new Set(withMembers.filter((entry): entry is string => entry !== undefined));
}
