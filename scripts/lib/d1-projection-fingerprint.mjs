import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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
 * Gezählt werden nur Dateien, die Git kennt oder kennen würde (`git ls-files --cached
 * --others --exclude-standard`): getrackte Dateien und noch nicht eingecheckte Arbeits-
 * kopien, aber keine ignorierten Dateien wie `.DS_Store`. Nur so liefern ein lokaler
 * Arbeitsbaum und der CI-Checkout denselben Wert. Außerhalb eines Git-Repositorys wird
 * das Dateisystem ohne Punktdateien durchlaufen.
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
    // Punktdateien (.DS_Store, Editor-Reste) gehören nie zur Projektion.
    if (entry.name.startsWith('.')) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walkFiles(path, output);
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

/** Dateien, die Git für die Pfadangaben kennt (getrackt oder ungetrackt, nicht ignoriert); null außerhalb von Git. */
async function gitListedFiles(root, pathspecs) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...pathspecs], { maxBuffer: 256 * 1024 * 1024 });
    return stdout.split('\0').filter(Boolean).map((path) => resolve(root, path));
  } catch {
    return null;
  }
}

/** Sortierte, eindeutige Liste der Dateien einer Fingerabdruckmenge. */
export async function listFingerprintFiles(root, roots, files = []) {
  const listed = await gitListedFiles(root, [...roots, ...files]);
  const collected = listed ?? [...files.map((file) => resolve(root, file))];
  if (listed === null) for (const directory of roots) await walkFiles(resolve(root, directory), collected);
  return [...new Set(collected)].sort();
}

async function hashFileSet(root, files) {
  const lines = [];
  for (const path of files) {
    let bytes;
    try {
      bytes = await readFile(path);
    } catch (error) {
      // Getrackt, aber im Arbeitsbaum gelöscht: zählt nicht zum Inhalt.
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    lines.push(`${relative(root, path).replaceAll('\\', '/')}\t${createHash('sha256').update(bytes).digest('hex')}`);
  }
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

export async function hashRoots(root, roots, files = []) {
  return hashFileSet(root, await listFingerprintFiles(root, roots, files));
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
