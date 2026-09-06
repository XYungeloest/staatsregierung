import { ContentValidationError } from '@ostrecht/shared/lib/norms/schema.ts';

/**
 * Redaktionelles Stichwortregister (`content/stichwortregister.json`): Stichwörter in
 * Bürgersprache, die auf eine oder mehrere Vorschriften führen. Es ergänzt die aus Titeln
 * abgeleiteten Schlagwörter, ersetzt sie aber im A–Z: dort erscheinen nur noch redaktionelle
 * Stichwörter sowie Abkürzungen und Kurztitel.
 *
 * Das Register ist eine Eingabe der D1-Projektion (law_norm_keywords mit `kind` = register);
 * der Dateizugriff wird wie in publications.ts erst bei Bedarf geladen, weil dieses Modul auch
 * im Worker gebündelt wird, wo es kein Repository gibt.
 */

export const REGISTER_SCHEMA = 'stichwortregister/1';
/** Pfad der Registerdatei relativ zum Repositorystamm (Projektionsumfang, Fingerabdruck, QA). */
export const REGISTER_PATH = 'content/stichwortregister.json';

export interface RegisterEntry {
  /** Stichwort in Bürgersprache. */
  stichwort: string;
  /** Vorschriften, auf die das Stichwort führt (Slugs unter content/normen). */
  normen: string[];
  /** Verweise auf andere Stichwörter desselben Registers. */
  siehe?: string[];
}

export interface KeywordRegister {
  entries: RegisterEntry[];
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

async function fileSystem() {
  const [{ readFile }, { join }, { resolveRepositoryRoot }] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
    import('@ostrecht/shared/lib/repository-root.ts'),
  ]);
  return { readFile, registerFile: join(resolveRepositoryRoot(), 'content', 'stichwortregister.json') };
}

function fail(path: string, message: string): never {
  throw new ContentValidationError(`${path} ${message}`);
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(path, 'muss ein nicht leerer Text sein');
  return (value as string).trim();
}

/** Vergleichsform eines Stichworts: Doppelte werden groß-/kleinschreibungsunabhängig erkannt. */
export function registerKeywordKey(value: string): string {
  return value.trim().toLocaleLowerCase('de').replace(/\s+/gu, ' ');
}

export function parseKeywordRegister(value: unknown, path = REGISTER_PATH): KeywordRegister {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'muss ein Objekt sein');
  const object = value as Record<string, unknown>;
  if (object.$schema !== REGISTER_SCHEMA) fail(`${path}.$schema`, `muss ${REGISTER_SCHEMA} sein`);
  if (!Array.isArray(object.eintraege)) fail(`${path}.eintraege`, 'muss ein Array sein');
  const seen = new Set<string>();
  const entries = object.eintraege.map((raw, index): RegisterEntry => {
    const where = `${path}.eintraege[${index}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(where, 'muss ein Objekt sein');
    const entry = raw as Record<string, unknown>;
    const stichwort = expectString(entry.stichwort, `${where}.stichwort`);
    const key = registerKeywordKey(stichwort);
    if (seen.has(key)) fail(`${where}.stichwort`, `ist doppelt vergeben: ${stichwort}`);
    seen.add(key);
    if (!Array.isArray(entry.normen) || entry.normen.length === 0) fail(`${where}.normen`, 'muss mindestens eine Vorschrift nennen');
    const normen = entry.normen.map((slug, slugIndex) => {
      const parsed = expectString(slug, `${where}.normen[${slugIndex}]`);
      if (!SLUG_PATTERN.test(parsed)) fail(`${where}.normen[${slugIndex}]`, 'ist kein Slug');
      return parsed;
    });
    if (new Set(normen).size !== normen.length) fail(`${where}.normen`, 'nennt eine Vorschrift doppelt');
    if (entry.siehe === undefined) return { stichwort, normen };
    if (!Array.isArray(entry.siehe)) fail(`${where}.siehe`, 'muss ein Array sein');
    const siehe = entry.siehe.map((target, targetIndex) => expectString(target, `${where}.siehe[${targetIndex}]`));
    return { stichwort, normen, ...(siehe.length > 0 ? { siehe } : {}) };
  });
  // „Siehe“-Verweise zeigen immer auf ein Stichwort desselben Registers.
  for (const [index, entry] of entries.entries()) {
    for (const target of entry.siehe ?? []) {
      if (!seen.has(registerKeywordKey(target))) fail(`${path}.eintraege[${index}].siehe`, `nennt ein unbekanntes Stichwort: ${target}`);
    }
  }
  entries.sort((left, right) => left.stichwort.localeCompare(right.stichwort, 'de'));
  return { entries };
}

/** Register aus dem Repository lesen; fehlt die Datei, gilt ein leeres Register. */
export async function loadKeywordRegister(): Promise<KeywordRegister> {
  const { readFile, registerFile } = await fileSystem();
  let raw: string;
  try {
    raw = await readFile(registerFile, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { entries: [] };
    throw error;
  }
  return parseKeywordRegister(JSON.parse(raw));
}

/** Stichwörter je Vorschrift (Slug → Stichwörter in Registerreihenfolge) für die Projektion. */
export function registerKeywordsBySlug(register: KeywordRegister): Map<string, string[]> {
  const bySlug = new Map<string, string[]>();
  for (const entry of register.entries) {
    for (const slug of entry.normen) {
      const keywords = bySlug.get(slug) ?? [];
      if (!keywords.includes(entry.stichwort)) keywords.push(entry.stichwort);
      bySlug.set(slug, keywords);
    }
  }
  return bySlug;
}
