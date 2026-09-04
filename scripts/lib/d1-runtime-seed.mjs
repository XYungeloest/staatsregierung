// Muss vor allen @ostrecht-Importen stehen (SITE_TARGET=law für die Routenhelfer).
import './law-site-env.mjs';

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { FULL_SCOPE, fixtureScope, hashRoots, projectionIdentity } from './d1-projection-fingerprint.mjs';
import { checkSearchIndexIntegrity, executePlan, openDatabase } from './d1-sqlite.mjs';

/**
 * Lokaler D1-Seed von OstRecht als portabler SQLite-Snapshot.
 *
 * Ein Seed ist die vollständige lokale D1-Projektion (Vollbestand oder Testfixture) als eine
 * SQLite-Datei, erzeugt mit node:sqlite aus demselben Sync-Plan wie die produktive Projektion
 * (scripts/sync-recht-d1.mjs, buildSyncPlan) und den echten Migrationen (data/recht/d1/).
 * Er wird ohne Wrangler gebaut, gegen den Git-Bestand verifiziert und anschließend in den
 * Miniflare-Zustand von `wrangler dev --local` eingesetzt. Der Snapshot ist damit cachebar:
 * derselbe Seed-Fingerabdruck bezeichnet immer denselben reproduzierbaren Datenbankinhalt.
 *
 * Seed-Fingerabdruck (runtime seed fingerprint): SHA-256 über
 *   - die Projektionsidentität (scripts/lib/d1-projection-fingerprint.mjs: Projektionslogik,
 *     Migrationen, Rechtsbestand, Portalgrundlagen, Stichtag, Scope full/fixture),
 *   - den Inhaltshash der Seed-Werkzeuge (SEED_TOOL_FILES, Git-Blob-Kennungen),
 *   - die Versionen von wrangler, miniflare und workerd aus package-lock.json (Format des
 *     Miniflare-Zustands),
 *   - die Formatversion dieses Seeds (SEED_FORMAT_VERSION).
 * Keine Änderungszeiten, keine Laufkennungen, keine Uhrzeit: gleiche Eingaben → gleicher Wert.
 */

export const SEED_FORMAT_VERSION = 1;
export const SEED_MANIFEST_SCHEMA = 'd1-runtime-seed/1';
export const SEED_TOOL_FILES = [
  'scripts/lib/d1-runtime-seed.mjs',
  'scripts/lib/d1-sqlite.mjs',
  'scripts/d1-runtime-seed.mjs',
];
export const SEED_TOOL_PACKAGES = ['wrangler', 'miniflare', 'workerd'];
export const DEFAULT_SEED_CACHE_DIR = join('.cache', 'd1-seed');
export const DEFAULT_PERSIST_DIR = join('.cache', 'wrangler-local');
export const MARKER_FILE_NAME = 'ostrecht-recht.seed.json';
/** Fester Zeitstempel der Projektion, damit der Snapshot deterministisch bleibt. */
export const SEED_PROJECTION_NOW = '2026-01-01T00:00:00.000Z';
export const REQUIRED_TABLES = [
  'law_norms', 'law_versions', 'law_version_blocks', 'law_source_objects', 'law_norm_derived', 'law_publications',
  'law_search_documents', 'law_search_units', 'law_search', 'law_norm_subjects', 'law_norm_history', 'law_norm_keywords', 'law_runtime_meta',
];

const D1_DATABASE_NAME = 'ostrecht-recht';

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

/** Versionen der Werkzeuge, die das Format des Miniflare-Zustands bestimmen (deterministisch aus package-lock.json). */
export async function seedToolVersions(root = process.cwd()) {
  const lock = await readJson(join(root, 'package-lock.json'));
  const versions = {};
  for (const name of SEED_TOOL_PACKAGES) {
    versions[name] = lock.packages?.[`node_modules/${name}`]?.version ?? 'unbekannt';
  }
  return versions;
}

export function combineSeedFingerprint({ projectionFingerprint, seedToolHash, toolVersions, format = SEED_FORMAT_VERSION }) {
  const lines = [
    `format:${format}`,
    `projection:${projectionFingerprint}`,
    `seed-tool:${seedToolHash}`,
    ...SEED_TOOL_PACKAGES.map((name) => `${name}:${toolVersions[name] ?? 'unbekannt'}`),
  ];
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

/**
 * Identität eines Seeds für den Arbeitsbaum: Projektionsidentität im Ziel-Scope plus
 * Seed-Werkzeuge und Werkzeugversionen.
 * @param {{ root?: string, fixture?: string | null }} options
 */
export async function runtimeSeedIdentity({ root = process.cwd(), fixture = null } = {}) {
  const scope = fixture ? await fixtureScope(root, fixture) : FULL_SCOPE;
  const [projection, seedToolHash, toolVersions] = await Promise.all([
    projectionIdentity({ root, scope }),
    hashRoots(root, [], SEED_TOOL_FILES),
    seedToolVersions(root),
  ]);
  return {
    fingerprint: combineSeedFingerprint({ projectionFingerprint: projection.fingerprint, seedToolHash, toolVersions }),
    format: SEED_FORMAT_VERSION,
    scope,
    mode: fixture ? 'fixture' : 'full',
    fixture: fixture ? fixture.replaceAll('\\', '/') : null,
    projection,
    seedToolHash,
    toolVersions,
  };
}

/** Dateiname eines Seeds im Cache-Verzeichnis; der Fingerabdruck ist Teil des Namens. */
export function seedFileName(identity) {
  return `${D1_DATABASE_NAME}-${identity.mode}-${identity.fingerprint.slice(0, 32)}.sqlite`;
}

export function seedManifestPath(snapshotPath) {
  return `${snapshotPath}.json`;
}

/** Erwartete Normzahl im Scope: Verzeichnisse unter content/normen, beim Fixture dessen Slugs. */
export async function expectedNormCount(root, fixture) {
  if (fixture) {
    const parsed = await readJson(resolve(root, fixture));
    const slugs = parsed.slugs.map((entry) => (typeof entry === 'string' ? entry : entry.slug));
    return new Set(slugs).size;
  }
  const entries = await readdir(join(root, 'content', 'normen'), { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).length;
}

/**
 * Baut den Seed als SQLite-Datei: Migrationen, vollständiger Sync-Plan (Vollbestand oder
 * Fixture), FTS5-Integrität, Manifest mit Fingerabdruck und Werkzeugversionen.
 */
export async function buildSeedSnapshot({ root = process.cwd(), fixture = null, out, log = console.log, identity = null } = {}) {
  if (!out) throw new Error('buildSeedSnapshot braucht einen Ausgabepfad (out)');
  const startedAt = Date.now();
  const seedIdentity = identity ?? await runtimeSeedIdentity({ root, fixture });
  const sync = await import(pathToFileURL(join(root, 'scripts', 'sync-recht-d1.mjs')).href);
  const { loadAllNorms } = await import('@ostrecht/shared/lib/norms/loader.ts');
  const { loadAllVerkuendungen } = await import('@ostrecht/shared/lib/norms/publications.ts');
  const { buildDerivedContext } = await import('@ostrecht/shared/lib/norms/derived.ts');
  const { EDITORIAL_REFERENCE_DATE } = await import('@ostrecht/shared/lib/norms/versions.ts');
  const { loadPressReleases, loadTopics } = await import('@ostrecht/shared/lib/portal/content.ts');
  const { getPressReleaseUrl, getTopicUrl } = await import('@ostrecht/shared/lib/portal/routes.ts');

  const [loadedNorms, publications, topics, pressReleases] = await Promise.all([loadAllNorms(), loadAllVerkuendungen(), loadTopics(), loadPressReleases()]);
  const norms = fixture ? sync.applyCorpusFilter(loadedNorms, await readJson(resolve(root, fixture)), fixture) : loadedNorms;
  log(`Seed ${seedIdentity.mode}: ${norms.length} Normen und ${publications.length} Verkündungen geladen (${Math.round((Date.now() - startedAt) / 1000)} s); Seed-Fingerabdruck ${seedIdentity.fingerprint.slice(0, 16)}…`);
  const scope = await sync.resolveScope(['--full'], { norms, publications });
  const context = buildDerivedContext({ norms, publications, topics, pressReleases, topicUrl: getTopicUrl, pressReleaseUrl: getPressReleaseUrl, asOf: EDITORIAL_REFERENCE_DATE });
  const plan = sync.buildSyncPlan({ scope, norms, publications, context, now: SEED_PROJECTION_NOW, fingerprint: seedIdentity.projection, identity: seedIdentity.projection, writeIdentity: true });
  log(`Plan: ${plan.selected.length} Normen, ${plan.publicationCount} Verkündungen, ${plan.statementCount} Anweisungen (${Math.round((Date.now() - startedAt) / 1000)} s)`);

  const target = resolve(root, out);
  await mkdir(dirname(target), { recursive: true });
  const partial = `${target}.partial`;
  await rm(partial, { force: true });
  const db = await openDatabase(partial, { create: true, root });
  let statementCount;
  try {
    statementCount = executePlan(db, plan);
    checkSearchIndexIntegrity(db);
    db.exec('PRAGMA journal_mode = DELETE');
    db.exec('VACUUM');
  } finally {
    db.close();
  }
  await rm(target, { force: true });
  await rm(seedManifestPath(target), { force: true });
  const { rename } = await import('node:fs/promises');
  await rename(partial, target);
  const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
  const manifest = {
    $schema: SEED_MANIFEST_SCHEMA,
    seedFingerprint: seedIdentity.fingerprint,
    format: seedIdentity.format,
    mode: seedIdentity.mode,
    fixture: seedIdentity.fixture,
    scope: seedIdentity.scope,
    projectionFingerprint: seedIdentity.projection.fingerprint,
    projectionLogicHash: seedIdentity.projection.logic,
    corpusContentHash: seedIdentity.projection.corpus,
    portalContentHash: seedIdentity.projection.portal,
    seedToolHash: seedIdentity.seedToolHash,
    toolVersions: seedIdentity.toolVersions,
    normCount: norms.length,
    publicationCount: publications.length,
    statementCount,
    node: process.version,
    sqlite: process.versions.sqlite ?? null,
    createdAt: new Date().toISOString(),
    durationSeconds,
  };
  await writeFile(seedManifestPath(target), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  log(`Seed ${relative(root, target)} geschrieben: ${statementCount} Anweisungen, FTS5-Integrität geprüft (${durationSeconds} s).`);
  return { path: target, manifest, durationSeconds };
}

/**
 * Günstige Identitäts- und Integritätsprüfung eines Snapshots gegen den Arbeitsbaum:
 * Tabellen, projection_fingerprint, Scope, sync_state, Zähler und FTS5-Integrität.
 * Wirft bei jeder Abweichung; ein Cache-Treffer wird nie blind übernommen.
 */
export async function verifySeedSnapshot({ root = process.cwd(), fixture = null, snapshot, identity = null, log = console.log } = {}) {
  if (!snapshot) throw new Error('verifySeedSnapshot braucht einen Snapshot-Pfad');
  const startedAt = Date.now();
  const path = resolve(root, snapshot);
  if (!(await exists(path))) throw new Error(`Seed ${relative(root, path)} fehlt`);
  const seedIdentity = identity ?? await runtimeSeedIdentity({ root, fixture });
  const problems = [];
  const manifestPath = seedManifestPath(path);
  let manifest = null;
  if (await exists(manifestPath)) {
    manifest = await readJson(manifestPath);
    if (manifest.seedFingerprint !== seedIdentity.fingerprint) problems.push(`Manifest: Seed-Fingerabdruck ${String(manifest.seedFingerprint).slice(0, 16)}… ≠ erwartet ${seedIdentity.fingerprint.slice(0, 16)}…`);
    if (manifest.format !== SEED_FORMAT_VERSION) problems.push(`Manifest: Formatversion ${manifest.format} ≠ ${SEED_FORMAT_VERSION}`);
  } else {
    problems.push(`Manifest ${relative(root, manifestPath)} fehlt`);
  }
  const expectedNorms = await expectedNormCount(root, fixture);
  const db = await openDatabase(path, { create: false, root });
  let counts;
  try {
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')").all().map((row) => row.name));
    for (const table of REQUIRED_TABLES) if (!tables.has(table)) problems.push(`Tabelle ${table} fehlt`);
    if (problems.some((problem) => problem.startsWith('Tabelle'))) throw new Error(`Seed unvollständig: ${problems.join('; ')}`);
    const meta = Object.fromEntries(db.prepare('SELECT key, value FROM law_runtime_meta').all().map((row) => [row.key, row.value]));
    if (meta.projection_fingerprint !== seedIdentity.projection.fingerprint) problems.push(`projection_fingerprint ${String(meta.projection_fingerprint ?? '(fehlt)').slice(0, 16)}… ≠ erwartet ${seedIdentity.projection.fingerprint.slice(0, 16)}…`);
    if (meta.projection_scope !== seedIdentity.scope) problems.push(`projection_scope ${meta.projection_scope ?? '(fehlt)'} ≠ erwartet ${seedIdentity.scope}`);
    if (meta.sync_state !== 'complete') problems.push(`sync_state ${meta.sync_state ?? '(fehlt)'} ≠ complete`);
    counts = db.prepare('SELECT (SELECT count(*) FROM law_norms) AS norms, (SELECT count(*) FROM law_versions) AS versions, (SELECT count(*) FROM law_publications) AS publications, (SELECT count(*) FROM law_search_units) AS search_units, (SELECT count(*) FROM law_norm_derived) AS derived').get();
    if (Number(counts.norms) !== expectedNorms) problems.push(`law_norms ${counts.norms} ≠ erwartet ${expectedNorms}`);
    if (Number(meta.norm_count) !== expectedNorms) problems.push(`law_runtime_meta.norm_count ${meta.norm_count ?? '(fehlt)'} ≠ erwartet ${expectedNorms}`);
    if (Number(counts.derived) !== expectedNorms) problems.push(`law_norm_derived ${counts.derived} ≠ Normen ${expectedNorms}`);
    if (Number(counts.search_units) === 0) problems.push('law_search_units ist leer');
    try {
      checkSearchIndexIntegrity(db);
    } catch (error) {
      problems.push(`FTS5-Integrität: ${error instanceof Error ? error.message : String(error)}`);
    }
  } finally {
    db.close();
  }
  const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
  if (problems.length > 0) throw new Error(`Seed ${relative(root, path)} abgelehnt:\n- ${problems.join('\n- ')}`);
  log(`Seed ${relative(root, path)} verifiziert: ${counts.norms} Normen, ${counts.versions} Fassungen, ${counts.publications} Verkündungen, ${counts.search_units} Suchzeilen, Identität ${seedIdentity.projection.fingerprint.slice(0, 16)}… (${seedIdentity.scope}), FTS5-Integrität OK (${durationSeconds} s).`);
  return { path, manifest, counts, durationSeconds };
}

function runCommand(command, args, { cwd, env }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const out = Buffer.concat(stdout).toString('utf8');
      const err = Buffer.concat(stderr).toString('utf8');
      if (code === 0) resolvePromise({ stdout: out, stderr: err });
      else reject(new Error(`${command} ${args.join(' ')} endete mit ${code}: ${(err || out).trim().slice(-600)}`));
    });
  });
}

async function wranglerD1(root, persistTo, sql) {
  const { stdout } = await runCommand('npx', ['wrangler', 'd1', 'execute', D1_DATABASE_NAME, '--local', '--persist-to', persistTo, '--json', '--command', sql], {
    cwd: join(root, 'apps', 'recht'),
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  const start = stdout.indexOf('[');
  if (start < 0) throw new Error(`wrangler d1 execute lieferte kein JSON: ${stdout.trim().slice(-300)}`);
  const payload = JSON.parse(stdout.slice(start));
  if (!Array.isArray(payload) || payload.some((result) => result.success === false)) throw new Error(`wrangler d1 execute meldet einen Fehler: ${stdout.trim().slice(-300)}`);
  return payload[0]?.results ?? [];
}

/** Findet die SQLite-Datei der lokalen D1 im Miniflare-Zustand (genau eine erwartet). */
export async function locateMiniflareDatabase(persistTo) {
  const d1Root = join(persistTo, 'v3', 'd1');
  if (!(await exists(d1Root))) return [];
  const found = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      // Miniflare führt daneben eine eigene metadata.sqlite; die D1-Datei trägt eine Hex-Kennung.
      else if (entry.isFile() && /^[0-9a-f]{32,}\.sqlite$/u.test(entry.name)) found.push(path);
    }
  }
  await walk(d1Root);
  return found.sort();
}

/**
 * Setzt den Snapshot als lokale D1 von `wrangler dev --local` ein: Wrangler legt die
 * Datenbankdatei an, der Snapshot ersetzt sie, und eine Wrangler-Abfrage bestätigt, dass
 * Miniflare die eingesetzte Projektionsidentität liest.
 */
export async function installSeedSnapshot({ root = process.cwd(), snapshot, persistTo = DEFAULT_PERSIST_DIR, identity = null, fixture = null, log = console.log } = {}) {
  if (!snapshot) throw new Error('installSeedSnapshot braucht einen Snapshot-Pfad');
  const startedAt = Date.now();
  const source = resolve(root, snapshot);
  const persistDir = resolve(root, persistTo);
  const seedIdentity = identity ?? await runtimeSeedIdentity({ root, fixture });
  const manifest = (await exists(seedManifestPath(source))) ? await readJson(seedManifestPath(source)) : null;
  // Nur der lokale D1-Zustand wird ersetzt; andere Miniflare-Daten bleiben unberührt.
  await rm(join(persistDir, 'v3', 'd1'), { recursive: true, force: true });
  await mkdir(persistDir, { recursive: true });
  await wranglerD1(root, persistDir, 'SELECT 1 AS ok');
  const databases = await locateMiniflareDatabase(persistDir);
  if (databases.length !== 1) throw new Error(`Miniflare-Zustand unter ${relative(root, persistDir)} enthält ${databases.length} D1-Dateien; erwartet genau eine`);
  const target = databases[0];
  for (const suffix of ['', '-wal', '-shm', '-journal']) await rm(`${target}${suffix}`, { force: true });
  await copyFile(source, target);
  const rows = await wranglerD1(root, persistDir, "SELECT key, value FROM law_runtime_meta WHERE key IN ('projection_fingerprint', 'projection_scope', 'sync_state', 'norm_count')");
  const meta = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  if (meta.projection_fingerprint !== seedIdentity.projection.fingerprint || meta.projection_scope !== seedIdentity.scope || meta.sync_state !== 'complete') {
    throw new Error(`Eingesetzter Seed wird von Miniflare nicht mit der erwarteten Identität gelesen: ${JSON.stringify(meta)}`);
  }
  const marker = {
    fingerprint: seedIdentity.projection.fingerprint,
    seedFingerprint: seedIdentity.fingerprint,
    mode: seedIdentity.scope,
    seededAt: new Date().toISOString(),
    normCount: Number(meta.norm_count),
    snapshot: relative(root, source),
    snapshotCreatedAt: manifest?.createdAt ?? null,
  };
  await writeFile(join(persistDir, MARKER_FILE_NAME), `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
  const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
  log(`Seed in ${relative(root, persistDir)} eingesetzt (${meta.norm_count} Normen, ${seedIdentity.scope}); Miniflare liest Identität ${String(meta.projection_fingerprint).slice(0, 16)}… (${durationSeconds} s).`);
  return { target, marker, durationSeconds };
}

export async function readSeedMarker(persistTo, root = process.cwd()) {
  const path = join(resolve(root, persistTo), MARKER_FILE_NAME);
  return (await exists(path)) ? readJson(path) : null;
}

/**
 * Stellt sicher, dass die lokale D1 unter `persistTo` genau den Seed des Arbeitsbaums trägt:
 * aktueller Marker → nichts tun; vorhandener Snapshot im Cache → verifizieren und einsetzen;
 * sonst genau einmal bauen, verifizieren, einsetzen. Liefert Status und Dauern.
 */
export async function ensureLocalSeed({ root = process.cwd(), fixture = null, persistTo = DEFAULT_PERSIST_DIR, cacheDir = DEFAULT_SEED_CACHE_DIR, force = false, log = console.log } = {}) {
  const startedAt = Date.now();
  const identity = await runtimeSeedIdentity({ root, fixture });
  const timings = { fingerprintSeconds: Math.round((Date.now() - startedAt) / 1000), buildSeconds: 0, verifySeconds: 0, installSeconds: 0 };
  const marker = force ? null : await readSeedMarker(persistTo, root);
  if (marker?.seedFingerprint === identity.fingerprint) {
    log(`Lokale D1-Projektion ist aktuell (Seed ${identity.fingerprint.slice(0, 16)}…, ${marker.normCount ?? '?'} Normen, ${marker.mode ?? identity.scope}, eingesetzt ${marker.seededAt}).`);
    return { status: 'current', identity, marker, timings, totalSeconds: Math.round((Date.now() - startedAt) / 1000) };
  }
  const snapshot = join(resolve(root, cacheDir), seedFileName(identity));
  let status = 'restored';
  let verified = null;
  if (!force && (await exists(snapshot))) {
    try {
      verified = await verifySeedSnapshot({ root, fixture, snapshot, identity, log });
      timings.verifySeconds = verified.durationSeconds;
    } catch (error) {
      log(`Vorhandener Seed wird verworfen: ${error instanceof Error ? error.message : String(error)}`);
      verified = null;
    }
  }
  if (!verified) {
    status = 'built';
    const built = await buildSeedSnapshot({ root, fixture, out: snapshot, identity, log });
    timings.buildSeconds = built.durationSeconds;
    verified = await verifySeedSnapshot({ root, fixture, snapshot, identity, log });
    timings.verifySeconds = verified.durationSeconds;
  }
  const installed = await installSeedSnapshot({ root, snapshot, persistTo, identity, fixture, log });
  timings.installSeconds = installed.durationSeconds;
  return { status, identity, snapshot, marker: installed.marker, timings, totalSeconds: Math.round((Date.now() - startedAt) / 1000) };
}
