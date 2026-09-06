import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { CLOSURE_FORMAT, externalPackageVersions, projectionClosure } from './d1-projection-closure.mjs';

/**
 * Projektionsidentität der D1-Projektion von OstRecht.
 *
 * Eine Identität besteht aus
 *   - dem Inhaltshash der Projektionslogik: genau die Dateien, die die Projektion vom
 *     Einstiegspunkt scripts/sync-recht-d1.mjs aus erreicht (transitiver Code-Abschluss,
 *     scripts/lib/d1-projection-closure.mjs), plus das Schema unter data/recht/d1/ und die
 *     Versionen externer Pakete im Abschluss. Reine Darstellungslogik in denselben Verzeichnissen
 *     (z. B. norms/diff-render.ts, recht-search/search-query.ts) gehört nicht dazu. Ist der
 *     Abschluss nicht sicher bestimmbar, zählt fail-closed die konservative Obermenge
 *     (PROJECTION_LOGIC_ROOTS und PROJECTION_LOGIC_FILES),
 *   - dem Inhaltshash des Rechtsbestands (content/normen, content/verkuendungen),
 *   - dem Inhaltshash der projektionsrelevanten Portalgrundlagen (content/themen,
 *     content/presse: nur die Felder, die in law_norm_derived einfließen – Slug, Titel,
 *     Rechtsgrundlagen bzw. Datum und Normbezüge; Hervorhebungen, Teaser, Prioritäten und
 *     andere reine Portalfelder ändern die Identität nicht),
 *   - dem Projektionsumfang (Scope): `full` für den gesamten Bestand oder
 *     `fixture:<Pfad>@<Inhaltshash>` für ein Testfixture (--corpus-filter).
 * Der Fingerabdruck ist der SHA-256 über diese vier Bestandteile; ein Fixture kann deshalb
 * nie dieselbe Identität wie der Vollbestand behaupten, und zwei Fixtures unterscheiden sich.
 *
 * Alle Hashes beruhen auf Git-Blob-Kennungen (SHA-1 über Größe und Inhalt jeder Datei),
 * nie auf Änderungszeiten: der Arbeitsbaum wird über `git ls-files --cached --others
 * --exclude-standard` (getrackt und ungetrackt, nicht ignoriert – keine .DS_Store) und
 * `git hash-object --stdin-paths` erfasst, ein Git-Ref über `git ls-tree -r`. Dadurch
 * lässt sich die erwartete Identität eines Basis-Commits (Ausgangszustand eines
 * inkrementellen Syncs) bestimmen, ohne den Arbeitsbaum umzuschalten.
 *
 * Eine Identität, die sich nur durch Code ändert, bedeutet nicht zwingend andere Daten: der
 * Äquivalenznachweis (scripts/lib/d1-projection-proof.mjs) vergleicht dann Basis- und
 * Zielprojektion vollständig und erlaubt bei Gleichheit die Übernahme der neuen Identität ohne
 * Daten-Rebuild.
 *
 * Der Sync legt fingerprint und scope in law_runtime_meta ab und beendet sich ohne
 * Schreibzugriff, wenn D1 dieselbe Identität (Fingerabdruck und Scope) trägt;
 * scripts/serve-law-worker.mjs nutzt sie für die lokale Seed-Entscheidung.
 */

/** Konservative Obermenge der Projektionslogik: Rückfall bei unsicherem Abschluss. */
export const PROJECTION_LOGIC_ROOTS = [
  'data/recht/d1',
  'packages/shared/src/lib/norms',
  'packages/shared/src/config',
  'packages/recht-search/src',
];
export const PROJECTION_LOGIC_FILES = [
  'scripts/sync-recht-d1.mjs',
  'scripts/lib/d1-sync-scope.mjs',
  'scripts/lib/d1-reference-date.mjs',
  'scripts/lib/d1-search-schema.mjs',
  'scripts/lib/d1-projection-fingerprint.mjs',
  'scripts/lib/d1-projection-closure.mjs',
  'packages/shared/src/lib/portal/content.ts',
  'packages/shared/src/lib/portal/routes.ts',
  'packages/shared/src/lib/portal/loader.ts',
  'packages/shared/src/lib/portal/legislation.ts',
];
/** Schema der Projektion: immer Teil der Logik, jede Änderung ist eine Vollprojektion. */
export const SCHEMA_ROOTS = ['data/recht/d1'];
export const CORPUS_ROOTS = ['content/normen', 'content/verkuendungen'];
export const PORTAL_CONTENT_ROOTS = ['content/themen', 'content/presse'];
export const FULL_SCOPE = 'full';

/** Git ausführen; `input` wird auf stdin geschrieben (hash-object --stdin-paths). */
function git(root, args, input = null) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', ['-C', root, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(Buffer.concat(stdout).toString('utf8'));
      else reject(new Error(`git ${args[0]} schlug fehl (${code}): ${Buffer.concat(stderr).toString('utf8').trim()}`));
    });
    if (input !== null) child.stdin.end(input);
    else child.stdin.end();
  });
}

function hashLines(lines) {
  return createHash('sha256').update([...lines].sort().join('\n')).digest('hex');
}

/** Dateien des Arbeitsbaums, die Git für die Pfadangaben kennt (getrackt oder ungetrackt, nicht ignoriert). */
export async function listFingerprintFiles(root, roots, files = []) {
  const stdout = await git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...roots, ...files]);
  return [...new Set(stdout.split('\0').filter(Boolean))].sort();
}

/** Zeilen „Pfad\tBlob“ des Arbeitsbaums; im Arbeitsbaum gelöschte getrackte Dateien zählen nicht. */
async function workingTreeLines(root, roots, files) {
  const listed = await listFingerprintFiles(root, roots, files);
  const present = [];
  for (const path of listed) {
    try {
      await access(resolve(root, path));
      present.push(path);
    } catch {
      // getrackt, aber im Arbeitsbaum entfernt
    }
  }
  if (present.length === 0) return [];
  const stdout = await git(root, ['hash-object', '--stdin-paths'], `${present.join('\n')}\n`);
  const ids = stdout.split('\n').filter(Boolean);
  if (ids.length !== present.length) throw new Error(`git hash-object lieferte ${ids.length} Kennungen für ${present.length} Dateien`);
  return ids.map((id, index) => `${present[index]}\t${id}`);
}

/** Zeilen „Pfad\tBlob“ eines Git-Refs für die Pfadangaben. */
async function refLines(root, ref, roots, files) {
  if (roots.length === 0 && files.length === 0) return [];
  const stdout = await git(root, ['ls-tree', '-r', '-z', ref, '--', ...roots, ...files]);
  return stdout.split('\0').filter(Boolean).map((entry) => {
    const [meta, path] = entry.split('\t');
    const blob = meta.split(' ')[2];
    return `${path}\t${blob}`;
  });
}

async function blobLines(root, roots, files, { ref = null } = {}) {
  return ref ? refLines(root, ref, roots, files) : workingTreeLines(root, roots, files);
}

export async function hashRoots(root, roots, files = [], { ref = null } = {}) {
  return hashLines(await blobLines(root, roots, files, { ref }));
}

/** Inhaltshash des Rechtsbestands (alle Dateien unter content/normen und content/verkuendungen). */
export async function corpusContentHash(root = process.cwd(), options = {}) {
  return hashRoots(root, CORPUS_ROOTS, [], options);
}

/**
 * Zeilen des Logikhashes: Abschlussdateien und Schema mit Blob-Kennungen, Abschlussformat,
 * externe Paketversionen; bei unsicherem Abschluss die konservative Obermenge mit Markierung.
 */
export async function projectionLogicLines(root = process.cwd(), { ref = null, closure = null } = {}) {
  const resolved = closure ?? await projectionClosure({ root, ref });
  const lines = [`closure-format:${CLOSURE_FORMAT}`];
  if (resolved.uncertain) {
    lines.push('closure:uncertain');
    lines.push(...await blobLines(root, PROJECTION_LOGIC_ROOTS, PROJECTION_LOGIC_FILES, { ref }));
  } else {
    lines.push(...await blobLines(root, SCHEMA_ROOTS, resolved.files, { ref }));
  }
  const versions = await externalPackageVersions(root, resolved.externals, { ref });
  for (const [name, version] of Object.entries(versions)) lines.push(`external:${name}@${version}`);
  return lines;
}

/** Inhaltshash der Projektionslogik (Abschluss des Sync-Einstiegs, Schema, externe Pakete). */
export async function projectionLogicHash(root = process.cwd(), options = {}) {
  return hashLines(await projectionLogicLines(root, options));
}

/**
 * Früherer Logikhash über ganze Verzeichnisse (Obermenge). Nur für den Übergang des
 * Base-State-Guards: eine vor dem Abschluss-Algorithmus geschriebene D1 trägt diesen Wert
 * (TODO.md); danach entfällt die Funktion.
 */
export async function legacyProjectionLogicHash(root = process.cwd(), options = {}) {
  return hashRoots(root, PROJECTION_LOGIC_ROOTS, PROJECTION_LOGIC_FILES, options);
}

/**
 * Projektionsrelevanter Auszug einer Portaldatei – genau die Felder, die
 * packages/shared/src/lib/norms/derived.ts (PortalTopicLike, PortalPressReleaseLike) liest.
 * Themen: Slug, Titel (bestimmt auch die Reihenfolge der Themenliste) und die Normbezüge der
 * Rechtsgrundlagen; Presse: Slug, Titel, Datum (Reihenfolge) und Normbezüge. Alles andere
 * (Hervorhebungen, Teaser, Prioritäten, Module, Texte) ist reine Portaldarstellung.
 * Wird derived.ts um weitere Portalfelder erweitert, muss dieser Auszug mitziehen.
 */
export function portalProjectionOf(path, json) {
  if (!json || typeof json !== 'object') return null;
  if (path.startsWith('content/themen/')) {
    const normSlugs = [...new Set((Array.isArray(json.rechtsgrundlagen) ? json.rechtsgrundlagen : [])
      .map((reference) => (reference && typeof reference === 'object' ? reference.normSlug : null))
      .filter((slug) => typeof slug === 'string' && slug))].sort();
    return { kind: 'thema', slug: json.slug ?? null, title: json.title ?? null, normSlugs };
  }
  if (path.startsWith('content/presse/')) {
    const normSlugs = Array.isArray(json.relatedNormSlugs) ? json.relatedNormSlugs.filter((slug) => typeof slug === 'string') : [];
    return { kind: 'presse', slug: json.slug ?? null, title: json.title ?? null, date: json.date ?? null, normSlugs };
  }
  return null;
}

async function readPortalJson(root, path, ref) {
  const text = ref ? await git(root, ['show', `${ref}:${path}`]) : await readFile(resolve(root, path), 'utf8');
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Projektionsauszüge aller Portaldateien als Zeilen „Pfad\tJSON“ (Arbeitsbaum oder Git-Ref). */
export async function portalProjectionLines(root = process.cwd(), { ref = null } = {}) {
  const paths = (await blobLines(root, PORTAL_CONTENT_ROOTS, [], { ref })).map((line) => line.split('\t')[0]);
  const lines = [];
  for (const path of paths.filter((entry) => entry.endsWith('.json')).sort()) {
    const projection = portalProjectionOf(path, await readPortalJson(root, path, ref));
    // Nicht lesbare oder unbekannte Dateien zählen konservativ mit ihrem vollständigen Inhalt.
    lines.push(`${path}\t${projection ? JSON.stringify(projection) : createHash('sha256').update(ref ? await git(root, ['show', `${ref}:${path}`]) : await readFile(resolve(root, path), 'utf8')).digest('hex')}`);
  }
  return lines;
}

/** Inhaltshash der projektionsrelevanten Portalgrundlagen (Themen, Presse), die in law_norm_derived einfließen. */
export async function portalContentHash(root = process.cwd(), options = {}) {
  return hashLines(await portalProjectionLines(root, options));
}

/** Vergleicht den Projektionsauszug einer Portaldatei zwischen einem Git-Ref und dem Arbeitsbaum. */
export async function portalProjectionChangedSince(root, ref, path) {
  const [previous, current] = await Promise.all([
    readPortalJson(root, path, ref).catch(() => null),
    readPortalJson(root, path, null).catch(() => null),
  ]);
  return JSON.stringify(portalProjectionOf(path, previous)) !== JSON.stringify(portalProjectionOf(path, current));
}

/**
 * Fixture-Manifest (Bytes und geparster Inhalt) aus dem Arbeitsbaum oder einem Git-Ref; fehlt die
 * Datei im Ref oder ist sie kein JSON, gilt sie als nicht synthetisch.
 */
async function readFixtureFile(root, fixturePath, { ref = null } = {}) {
  const normalized = fixturePath.replaceAll('\\', '/');
  const bytes = ref ? Buffer.from(await git(root, ['show', `${ref}:${normalized}`]), 'utf8') : await readFile(resolve(root, fixturePath));
  let manifest = null;
  try {
    manifest = JSON.parse(bytes.toString('utf8'));
  } catch {
    manifest = null;
  }
  return { bytes, manifest };
}

function isSyntheticManifest(manifest) {
  return Boolean(manifest) && typeof manifest === 'object' && manifest.source === 'synthetic' && typeof manifest.builder === 'string';
}

/**
 * Inhaltshash eines synthetischen Fixtures: Manifestbytes und Git-Blob des Builders
 * (tests/helpers/fixture-corpus.ts). Der Builder wird nur gehasht, nie importiert – die
 * Fixture-Daten sind Testdatum, keine Projektionslogik.
 */
async function syntheticFixtureHash(root, fixturePath, { ref = null, file = null } = {}) {
  const { bytes, manifest } = file ?? await readFixtureFile(root, fixturePath, { ref });
  const builder = await hashRoots(root, [], [manifest.builder], { ref });
  return createHash('sha256').update(`manifest:${createHash('sha256').update(bytes).digest('hex')}\nbuilder:${builder}`).digest('hex');
}

/** Fixture-Pfad aus einer Scope-Kennung `fixture:<Pfad>@<Hash>`; null für den Vollbestand. */
function fixturePathOfScope(scope) {
  if (typeof scope !== 'string' || !scope.startsWith('fixture:')) return null;
  const rest = scope.slice('fixture:'.length);
  const at = rest.lastIndexOf('@');
  return at > 0 ? rest.slice(0, at) : rest;
}

/**
 * Scope-Kennung eines Testfixtures: Pfad und Inhaltshash der Fixture-Datei; bei einem synthetischen
 * Manifest (source "synthetic") zusätzlich der Git-Blob des Builders, damit sich der Scope mit dem
 * Fixture-Bestand ändert.
 */
export async function fixtureScope(root, fixturePath) {
  const file = await readFixtureFile(root, fixturePath);
  const hash = isSyntheticManifest(file.manifest)
    ? await syntheticFixtureHash(root, fixturePath, { file })
    : createHash('sha256').update(file.bytes).digest('hex');
  return `fixture:${fixturePath.replaceAll('\\', '/')}@${hash.slice(0, 16)}`;
}

export function combineFingerprint({ logic, corpus, portal, scope = FULL_SCOPE }) {
  return createHash('sha256').update(`logic:${logic}\ncorpus:${corpus}\nportal:${portal}\nscope:${scope}`).digest('hex');
}

/**
 * Vollständige Projektionsidentität des Arbeitsbaums (oder eines Git-Refs) für einen Scope.
 * `fingerprint` ist der Vergleichswert; `scope` wird zusätzlich gespeichert und geprüft.
 * `logicFiles` nennt die Dateien des Abschlusses (Umfangsbestimmung, Dokumentation);
 * `legacyFingerprint` ist die Identität derselben Eingaben mit dem früheren Logikhash (Übergang).
 * Im Scope eines synthetischen Fixtures treten Manifest und Builder an die Stelle von Rechtsbestand
 * und Portalgrundlagen (`corpus` = `portal` = ihr Hash): redaktionelle Änderungen unter content/
 * bewegen die Fixture-Identität nicht. Der Vollbestands-Scope bleibt unverändert.
 */
export async function projectionIdentity({ root = process.cwd(), scope = FULL_SCOPE, ref = null } = {}) {
  const options = { ref };
  const closure = await projectionClosure({ root, ref });
  const fixturePath = fixturePathOfScope(scope);
  const fixtureFile = fixturePath ? await readFixtureFile(root, fixturePath, options).catch(() => null) : null;
  const synthetic = fixtureFile && isSyntheticManifest(fixtureFile.manifest) ? await syntheticFixtureHash(root, fixturePath, { ref, file: fixtureFile }) : null;
  const [logic, legacyLogic, corpus, portal] = await Promise.all([
    projectionLogicHash(root, { ref, closure }),
    legacyProjectionLogicHash(root, options),
    synthetic ?? corpusContentHash(root, options),
    synthetic ?? portalContentHash(root, options),
  ]);
  return {
    fingerprint: combineFingerprint({ logic, corpus, portal, scope }),
    scope,
    logic,
    corpus,
    portal,
    ref,
    logicFiles: closure.files,
    closureUncertain: closure.uncertain,
    closureReasons: closure.reasons,
    // Übergang: Identität derselben Eingaben mit dem früheren Logikhash über ganze Verzeichnisse.
    // Eine D1, die vor dem Abschluss-Algorithmus geschrieben wurde, trägt diesen Wert als
    // Basiszustand; der Base-State-Guard akzeptiert ihn, bis alle Datenbanken die neue Identität
    // tragen (TODO.md).
    legacyFingerprint: combineFingerprint({ logic: legacyLogic, corpus, portal, scope }),
  };
}

/** Kompatibler Kurzzugriff: Identität des Arbeitsbaums im Vollbestands-Scope. */
export async function projectionFingerprint(root = process.cwd()) {
  return projectionIdentity({ root, scope: FULL_SCOPE });
}

/** Erwartete Identität eines Git-Refs (Basis eines inkrementellen Syncs), ohne Checkout. */
export async function projectionIdentityAtRef(ref, { root = process.cwd(), scope = FULL_SCOPE } = {}) {
  return projectionIdentity({ root, scope, ref });
}
