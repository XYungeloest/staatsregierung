import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

/**
 * Deterministischer Fingerabdruck der D1-Projektion von OstRecht.
 *
 * Er hängt ausschließlich von Dateiinhalten ab (SHA-256 je Datei, sortierte Pfade),
 * nie von Änderungszeiten oder Buildzeitpunkten, und setzt sich zusammen aus
 *   - der Projektionslogik (Migrationen unter data/recht/d1/, Sync und Umfangsbestimmung,
 *     die korpusweiten Ableitungen unter packages/shared/src/lib/norms/, die
 *     Portalbezüge, die Konfiguration und die Suchprojektion in packages/recht-search/src/),
 *   - dem Rechtsbestand (content/normen, content/verkuendungen) und
 *   - den korpusweiten Portalgrundlagen (content/themen, content/presse).
 *
 * Der Sync legt den Wert als projection_fingerprint in law_runtime_meta ab und
 * beendet sich ohne Schreibzugriff, wenn D1 bereits denselben Fingerabdruck trägt;
 * scripts/serve-law-worker.mjs nutzt ihn für die lokale Seed-Entscheidung.
 */

export const PROJECTION_LOGIC_ROOTS = [
  'data/recht/d1',
  'packages/shared/src/lib/norms',
  'packages/shared/src/config',
  'packages/recht-search/src',
];
export const PROJECTION_LOGIC_FILES = [
  'scripts/sync-recht-d1.mjs',
  'scripts/lib/d1-sync-scope.mjs',
  'scripts/lib/d1-search-schema.mjs',
  'scripts/lib/d1-projection-fingerprint.mjs',
  'packages/shared/src/lib/portal/content.ts',
  'packages/shared/src/lib/portal/routes.ts',
  'packages/shared/src/lib/portal/loader.ts',
  'packages/shared/src/lib/portal/legislation.ts',
];
export const CORPUS_ROOTS = ['content/normen', 'content/verkuendungen'];
export const PORTAL_CONTENT_ROOTS = ['content/themen', 'content/presse'];

async function walkFiles(directory, output) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return output;
    throw error;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walkFiles(path, output);
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

async function hashFileSet(root, files) {
  const lines = await Promise.all([...files].sort().map(async (path) => {
    const digest = createHash('sha256').update(await readFile(path)).digest('hex');
    return `${relative(root, path).replaceAll('\\', '/')}\t${digest}`;
  }));
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

async function hashRoots(root, roots, files = []) {
  const collected = [...files.map((file) => resolve(root, file))];
  for (const directory of roots) await walkFiles(resolve(root, directory), collected);
  return hashFileSet(root, collected);
}

/** Inhaltshash des Rechtsbestands (alle Dateien unter content/normen und content/verkuendungen). */
export async function corpusContentHash(root = process.cwd()) {
  return hashRoots(root, CORPUS_ROOTS);
}

/** Inhaltshash der Projektionslogik (Schema, Sync, Ableitungen, Suche, Konfiguration). */
export async function projectionLogicHash(root = process.cwd()) {
  return hashRoots(root, PROJECTION_LOGIC_ROOTS, PROJECTION_LOGIC_FILES);
}

/** Inhaltshash der Portalgrundlagen (Themen, Presse), die in law_norm_derived einfließen. */
export async function portalContentHash(root = process.cwd()) {
  return hashRoots(root, PORTAL_CONTENT_ROOTS);
}

export function combineFingerprint({ logic, corpus, portal }) {
  return createHash('sha256').update(`logic:${logic}\ncorpus:${corpus}\nportal:${portal}`).digest('hex');
}

/** Vollständiger Fingerabdruck samt Bestandteilen. */
export async function projectionFingerprint(root = process.cwd()) {
  const [logic, corpus, portal] = await Promise.all([projectionLogicHash(root), corpusContentHash(root), portalContentHash(root)]);
  return { fingerprint: combineFingerprint({ logic, corpus, portal }), logic, corpus, portal };
}
