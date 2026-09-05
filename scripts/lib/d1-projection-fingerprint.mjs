import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Projektionsidentität der D1-Projektion von OstRecht.
 *
 * Eine Identität besteht aus
 *   - dem Inhaltshash der Projektionslogik (Migrationen unter data/recht/d1/, Sync und
 *     Umfangsbestimmung, korpusweite Ableitungen unter packages/shared/src/lib/norms/,
 *     Portalbezüge, Konfiguration, Suchprojektion in packages/recht-search/src/),
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
 * Der Sync legt fingerprint und scope in law_runtime_meta ab und beendet sich ohne
 * Schreibzugriff, wenn D1 dieselbe Identität (Fingerabdruck und Scope) trägt;
 * scripts/serve-law-worker.mjs nutzt sie für die lokale Seed-Entscheidung.
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
  'scripts/lib/d1-reference-date.mjs',
  'scripts/lib/d1-search-schema.mjs',
  'scripts/lib/d1-projection-fingerprint.mjs',
  'packages/shared/src/lib/portal/content.ts',
  'packages/shared/src/lib/portal/routes.ts',
  'packages/shared/src/lib/portal/loader.ts',
  'packages/shared/src/lib/portal/legislation.ts',
];
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
  const stdout = await git(root, ['ls-tree', '-r', '-z', ref, '--', ...roots, ...files]);
  return stdout.split('\0').filter(Boolean).map((entry) => {
    const [meta, path] = entry.split('\t');
    const blob = meta.split(' ')[2];
    return `${path}\t${blob}`;
  });
}

export async function hashRoots(root, roots, files = [], { ref = null } = {}) {
  const lines = ref ? await refLines(root, ref, roots, files) : await workingTreeLines(root, roots, files);
  return hashLines(lines);
}

/** Inhaltshash des Rechtsbestands (alle Dateien unter content/normen und content/verkuendungen). */
export async function corpusContentHash(root = process.cwd(), options = {}) {
  return hashRoots(root, CORPUS_ROOTS, [], options);
}

/** Inhaltshash der Projektionslogik (Schema, Sync, Ableitungen, Suche, Konfiguration, Budgets). */
export async function projectionLogicHash(root = process.cwd(), options = {}) {
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
  const paths = ref
    ? (await refLines(root, ref, PORTAL_CONTENT_ROOTS, [])).map((line) => line.split('\t')[0])
    : (await workingTreeLines(root, PORTAL_CONTENT_ROOTS, [])).map((line) => line.split('\t')[0]);
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

/** Scope-Kennung eines Testfixtures: Pfad und Inhaltshash der Fixture-Datei. */
export async function fixtureScope(root, fixturePath) {
  const bytes = await readFile(resolve(root, fixturePath));
  return `fixture:${fixturePath.replaceAll('\\', '/')}@${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}`;
}

export function combineFingerprint({ logic, corpus, portal, scope = FULL_SCOPE }) {
  return createHash('sha256').update(`logic:${logic}\ncorpus:${corpus}\nportal:${portal}\nscope:${scope}`).digest('hex');
}

/**
 * Vollständige Projektionsidentität des Arbeitsbaums (oder eines Git-Refs) für einen Scope.
 * `fingerprint` ist der Vergleichswert; `scope` wird zusätzlich gespeichert und geprüft.
 */
export async function projectionIdentity({ root = process.cwd(), scope = FULL_SCOPE, ref = null } = {}) {
  const options = { ref };
  const [logic, corpus, portal] = await Promise.all([
    projectionLogicHash(root, options), corpusContentHash(root, options), portalContentHash(root, options),
  ]);
  return {
    fingerprint: combineFingerprint({ logic, corpus, portal, scope }),
    scope,
    logic,
    corpus,
    portal,
    ref,
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
