import {
  applyCabinetReshuffle,
  parseGovernmentAssignments,
  parseGovernmentOffices,
  parseGovernments,
  type CabinetReshuffleInput,
} from '../lib/portal/organization.ts';
import { parseMinisteriumProfil, parseRegierungProfil } from '../lib/portal/schema.ts';
import type { EditorialFileChange, EditorialRepository } from './github.ts';
import {
  editorialRegistry,
  getEditorialFilePath,
  resolveEditorialRoutes,
  serializeEditorialDocument,
  type EditorialContentTypeId,
} from './registry.ts';

export interface PreparedEditorialChange {
  type: EditorialContentTypeId;
  slug: string;
  baseSha: string;
  changes: EditorialFileChange[];
  routes: string[];
  diff: string;
  workflowPreview?: unknown;
}

function parseJson(raw: string | undefined, path: string): unknown {
  if (raw === undefined) throw new Error(`${path}: Datei wurde nicht gefunden.`);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`${path}: enthält ungültiges JSON.`);
  }
}

function unifiedDiff(path: string, before: string, after: string): string {
  if (before === after) return `--- a/${path}\n+++ b/${path}\n (keine Änderung)`;
  const oldLines = before.replace(/\n$/u, '').split('\n');
  const newLines = after.replace(/\n$/u, '').split('\n');
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix
    && suffix < newLines.length - prefix
    && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) suffix += 1;
  const contextBefore = Math.max(0, prefix - 3);
  const oldEnd = Math.min(oldLines.length, oldLines.length - suffix + 3);
  const newEnd = Math.min(newLines.length, newLines.length - suffix + 3);
  const lines = [
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -${contextBefore + 1},${oldEnd - contextBefore} +${contextBefore + 1},${newEnd - contextBefore} @@`,
    ...oldLines.slice(contextBefore, prefix).map((line) => ` ${line}`),
    ...oldLines.slice(prefix, oldLines.length - suffix).map((line) => `-${line}`),
    ...newLines.slice(prefix, newLines.length - suffix).map((line) => `+${line}`),
    ...newLines.slice(newLines.length - suffix, newEnd).map((line) => ` ${line}`),
  ];
  if (lines.length > 600) return `${lines.slice(0, 600).join('\n')}\n… Diff nach 600 Zeilen gekürzt`;
  return lines.join('\n');
}

async function parseCollection<T>(
  repository: EditorialRepository,
  prefix: string,
  parser: (value: unknown, path: string) => T,
  revision: string,
): Promise<T[]> {
  const paths = (await repository.listFiles(prefix, revision)).filter((path) => path.endsWith('.json'));
  const files = await repository.readFiles(paths, revision);
  return paths.map((path) => parser(parseJson(files[path], path), path));
}

async function assertReferences(
  repository: EditorialRepository,
  type: EditorialContentTypeId,
  value: unknown,
  revision: string,
): Promise<void> {
  if (!value || typeof value !== 'object') return;
  const document = value as Record<string, unknown>;
  const referenceFields = editorialRegistry[type].fields.filter((field) => field.referenceTarget);
  const targets = new Map<string, Set<string>>();
  async function knownReferences(target: NonNullable<(typeof referenceFields)[number]['referenceTarget']>): Promise<Set<string>> {
    const existing = targets.get(target);
    if (existing) return existing;
    const prefixes = { person: 'content/regierung/mitglieder/', ministry: 'content/ressorts/', topic: 'content/themen/' } as const;
    let known: Set<string>;
    if (target === 'government') {
      const governments = parseGovernments(parseJson(await repository.readFile('content/organisation/governments.json', revision), 'content/organisation/governments.json'));
      known = new Set(governments.map((entry) => entry.slug));
    } else if (target === 'norm') {
      const paths = await repository.listFiles('content/normen/', revision);
      known = new Set(paths.filter((path) => path.endsWith('/meta.json')).map((path) => path.split('/')[2]));
    } else {
      const paths = await repository.listFiles(prefixes[target], revision);
      known = new Set(paths.filter((path) => path.endsWith('.json')).map((path) => path.split('/').pop()!.replace(/\.json$/u, '')));
    }
    targets.set(target, known);
    return known;
  }
  function valueAtPath(path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => current && typeof current === 'object' && !Array.isArray(current) ? (current as Record<string, unknown>)[key] : undefined, document);
  }
  const targetLabels = { person: 'Personen', ministry: 'Ressort', government: 'Regierung', topic: 'Themen', norm: 'Norm' } as const;
  for (const field of referenceFields) {
    const target = field.referenceTarget!;
    const raw = valueAtPath(field.name);
    const values = Array.isArray(raw) ? raw : raw === undefined || raw === '' ? [] : [raw];
    const known = await knownReferences(target);
    for (const reference of values) {
      if (typeof reference !== 'string' || !known.has(reference)) {
        throw new Error(`Unbekannte ${targetLabels[target]}referenz in „${field.label}“: ${String(reference)}`);
      }
    }
  }
  if (type === 'home') {
    const governments = parseGovernments(parseJson(await repository.readFile('content/organisation/governments.json', revision), 'content/organisation/governments.json'));
    const known = new Set(governments.map((government) => government.slug));
    for (const item of Array.isArray(document.importantItems) ? document.importantItems : []) {
      const slug = item && typeof item === 'object' ? (item as Record<string, unknown>).governmentSlug : undefined;
      if (typeof slug === 'string' && !known.has(slug)) throw new Error(`Unbekannte Regierungsreferenz: ${slug}`);
    }
  }
}

export async function prepareDocumentChange(
  repository: EditorialRepository,
  type: Exclude<EditorialContentTypeId, 'cabinet-reshuffle'>,
  value: unknown,
  slug?: string,
  expectedBaseSha?: string,
): Promise<PreparedEditorialChange> {
  const baseSha = await repository.getBaseRevision();
  if (expectedBaseSha && expectedBaseSha !== baseSha) throw new Error('Der Hauptbranch wurde zwischenzeitlich geändert. Bitte neu laden.');
  const inferredSlug = slug ?? (value && typeof value === 'object' && 'slug' in value ? String(value.slug) : type);
  const path = getEditorialFilePath(type, inferredSlug);
  const before = await repository.readFile(path, baseSha) ?? '';
  await assertReferences(repository, type, value, baseSha);
  const after = serializeEditorialDocument(type, value, path);
  return {
    type,
    slug: inferredSlug,
    baseSha,
    changes: [{ path, content: after, mediaType: 'application/json' }],
    routes: resolveEditorialRoutes(type, inferredSlug),
    diff: unifiedDiff(path, before, after),
  };
}

export async function prepareCabinetReshuffle(
  repository: EditorialRepository,
  input: CabinetReshuffleInput,
  expectedBaseSha?: string,
): Promise<PreparedEditorialChange> {
  const baseSha = await repository.getBaseRevision();
  if (expectedBaseSha && expectedBaseSha !== baseSha) throw new Error('Der Hauptbranch wurde zwischenzeitlich geändert. Bitte neu laden.');
  const [governmentsRaw, officesRaw, assignmentsRaw, profiles, ministries] = await Promise.all([
    repository.readFile('content/organisation/governments.json', baseSha),
    repository.readFile('content/organisation/offices.json', baseSha),
    repository.readFile('content/organisation/assignments.json', baseSha),
    parseCollection(repository, 'content/regierung/mitglieder/', parseRegierungProfil, baseSha),
    parseCollection(repository, 'content/ressorts/', parseMinisteriumProfil, baseSha),
  ]);
  const organization = {
    governments: parseGovernments(parseJson(governmentsRaw, 'content/organisation/governments.json')),
    offices: parseGovernmentOffices(parseJson(officesRaw, 'content/organisation/offices.json')),
    assignments: parseGovernmentAssignments(parseJson(assignmentsRaw, 'content/organisation/assignments.json')),
  };
  const result = applyCabinetReshuffle(organization, profiles, ministries, input);
  const path = 'content/organisation/assignments.json';
  const before = assignmentsRaw!;
  const after = `${JSON.stringify({ assignments: result.organization.assignments }, null, 2)}\n`;
  return {
    type: 'cabinet-reshuffle',
    slug: input.governmentSlug,
    baseSha,
    changes: [{ path, content: after, mediaType: 'application/json' }],
    routes: result.affectedRoutes,
    diff: unifiedDiff(path, before, after),
    workflowPreview: result.preview,
  };
}

export function appendMediaChanges(prepared: PreparedEditorialChange, media: EditorialFileChange[]): PreparedEditorialChange {
  const paths = new Set(prepared.changes.map((change) => change.path));
  for (const change of media) {
    if (paths.has(change.path)) throw new Error(`Dateipfad ist doppelt: ${change.path}`);
    paths.add(change.path);
  }
  return { ...prepared, changes: [...prepared.changes, ...media] };
}
