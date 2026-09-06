// Muss vor allen @ostrecht-Importen stehen (SITE_TARGET=law für die Routenhelfer).
import './law-site-env.mjs';

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

import { COMPARATOR_VERSION, compareProjections, formatComparison } from './d1-projection-compare.mjs';
import { FULL_SCOPE, projectionIdentity, projectionIdentityAtRef } from './d1-projection-fingerprint.mjs';
import { PROOF_SCHEMA, describeProofResult } from './d1-projection-proof-format.mjs';
import { checkSearchIndexIntegrity, executePlan, openDatabase } from './d1-sqlite.mjs';
import { isEmptyScope, scopeSignature } from './d1-sync-scope.mjs';

export { PROOF_RESULTS, PROOF_SCHEMA, describeProofResult, readProof, validateProof } from './d1-projection-proof-format.mjs';

/**
 * Äquivalenznachweis der D1-Projektion: Ersetzt eine geänderte Projektionsidentität durch
 * Rechnen statt Annehmen.
 *
 * Ändert sich die Projektionslogik (Abschluss, scripts/lib/d1-projection-closure.mjs), kann die
 * Umfangslogik nicht wissen, ob die projizierten Daten anders werden. Der Nachweis projiziert
 * deshalb Basis (Code und Bestand des Basis-Commits) und Ziel (Arbeitsbaum) vollständig in je
 * eine SQLite-Datei und vergleicht sie semantisch (scripts/lib/d1-projection-compare.mjs).
 * Basisprojektion und Zielprojektion kommen, wenn vorhanden, aus dem Seed-Cache
 * (.cache/d1-seed, Manifest mit Projektionsidentität); sonst wird der Basis-Ref in einem
 * temporären Git-Worktree mit seinem eigenen Code projiziert und der Arbeitsbaum mit dem
 * aktuellen.
 *
 * Geprüft wird, ob ein inkrementeller Umfang – genau der, den der Sync für `--git-diff` bestimmen
 * würde – auf die Basis angewendet exakt die Zielprojektion ergibt:
 *   1. `ignore`: die Logikänderung gilt als datenneutral; der Umfang enthält nur die geänderten
 *      Inhalte (ohne Inhaltsänderung ist er leer: nur Identität und Laufzeitmetadaten).
 *   2. `narrow`: zusätzlich werden Suchdokumente und abgeleitete Daten aller Normen neu geschrieben.
 * Ergebnis `identity` (leerer Umfang genügt), `incremental` (Umfang mit Inhalten bzw. enge
 * Logikprojektion genügt) oder `full` (kein inkrementeller Umfang ergibt das Ziel; die
 * abweichenden Tabellen werden genannt). Schemaänderungen sind immer `full`.
 *
 * Der Nachweis ist deterministisch an den geprüften Stand gebunden: Basis- und Ziel-Commit, alte
 * und neue Projektionsidentität (für den
 * Übergang), Scope, Comparator-Version und die Signatur des nachgewiesenen Umfangs
 * (scripts/lib/d1-projection-proof-format.mjs). Der Sync (`--equivalence-proof <Datei>`) prüft
 * jede dieser Bindungen fail-closed, bevor er statt der Vollprojektion den nachgewiesenen Umfang
 * schreibt. Es gibt keinen Weg, das Ergebnis ohne die beiden Projektionen zu setzen.
 *
 * Das Sync-Modul wird injiziert (`sync`), nie dynamisch geladen: so bleibt der Code-Abschluss der
 * Projektion frei von Werkzeugcode und nicht literalen Importen.
 */

export const LOGIC_CHANGE_ATTEMPTS = ['ignore', 'narrow'];
export const DEFAULT_PROOF_DIR = join('.cache', 'd1-equivalence');
export const DEFAULT_SEED_CACHE_DIR = join('.cache', 'd1-seed');
/** Fester Zeitstempel der Nachweisprojektionen (wie der Seed: deterministische Dateien). */
export const PROOF_PROJECTION_NOW = '2026-01-01T00:00:00.000Z';
const SNAPSHOT_TOOL = join('scripts', 'd1-projection-snapshot.mjs');

function run(command, args, { cwd, env = process.env, log = null } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => {
      stdout.push(chunk);
      if (log) for (const line of chunk.toString('utf8').split('\n').filter(Boolean)) log(`  ${line}`);
    });
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(Buffer.concat(stdout).toString('utf8'));
      else reject(new Error(`${command} ${args.slice(0, 4).join(' ')} endete mit ${code}: ${(Buffer.concat(stderr).toString('utf8') || Buffer.concat(stdout).toString('utf8')).trim().slice(-600)}`));
    });
  });
}

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

export async function resolveCommit(root, ref) {
  return (await run('git', ['-C', root, 'rev-parse', '--verify', `${ref}^{commit}`])).trim();
}

/** Lädt Bestand, Verkündungen, Themen und Presse und baut den Ableitungskontext (Code des Arbeitsbaums); `sync` ist das injizierte Sync-Modul. */
export async function loadProjectionInputs(root, { sync }) {
  if (!sync?.buildSyncPlan || !sync?.resolveScope) throw new Error('loadProjectionInputs braucht das Sync-Modul (buildSyncPlan, resolveScope)');
  const { loadAllNorms } = await import('@ostrecht/shared/lib/norms/loader.ts');
  const { loadAllVerkuendungen } = await import('@ostrecht/shared/lib/norms/publications.ts');
  const { buildDerivedContext } = await import('@ostrecht/shared/lib/norms/derived.ts');
  const { EDITORIAL_REFERENCE_DATE } = await import('@ostrecht/shared/lib/norms/versions.ts');
  const { loadPressReleases, loadTopics } = await import('@ostrecht/shared/lib/portal/content.ts');
  const { getPressReleaseUrl, getTopicUrl } = await import('@ostrecht/shared/lib/portal/routes.ts');
  const [norms, publications, topics, pressReleases] = await Promise.all([loadAllNorms(), loadAllVerkuendungen(), loadTopics(), loadPressReleases()]);
  const context = buildDerivedContext({ norms, publications, topics, pressReleases, topicUrl: getTopicUrl, pressReleaseUrl: getPressReleaseUrl, asOf: EDITORIAL_REFERENCE_DATE });
  return { sync, norms, publications, topics, pressReleases, context };
}

/** Vollbestands-Seed mit einer der Projektionsidentitäten im Seed-Cache (Manifest und Datenbank geprüft). */
export async function findSeedProjection({ root, cacheDir = DEFAULT_SEED_CACHE_DIR, fingerprints }) {
  const wanted = new Set(fingerprints.filter(Boolean));
  const directory = resolve(root, cacheDir);
  if (!(await exists(directory))) return null;
  for (const name of (await readdir(directory)).filter((entry) => entry.endsWith('.sqlite.json')).sort()) {
    const manifest = await readJson(join(directory, name));
    if (manifest.mode !== 'full' || manifest.scope !== FULL_SCOPE || !wanted.has(manifest.projectionFingerprint)) continue;
    const snapshot = join(directory, name.replace(/\.json$/u, ''));
    if (!(await exists(snapshot))) continue;
    const db = await openDatabase(snapshot, { create: false, root, readOnly: true });
    try {
      const meta = Object.fromEntries(db.prepare("SELECT key, value FROM law_runtime_meta WHERE key IN ('projection_fingerprint', 'projection_scope', 'sync_state')").all().map((row) => [row.key, row.value]));
      if (wanted.has(meta.projection_fingerprint) && meta.projection_scope === FULL_SCOPE && meta.sync_state === 'complete') return snapshot;
    } finally {
      db.close();
    }
  }
  return null;
}

/** node_modules eines temporären Baums: Pakete des Repositorys verlinkt, Workspace-Pakete auf den Baum selbst. */
export async function linkNodeModules(root, tree) {
  const target = join(tree, 'node_modules');
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(join(root, 'node_modules'))) {
    if (entry === '@ostrecht' || entry.startsWith('.')) continue;
    const link = join(target, entry);
    if (!(await exists(link))) await symlink(join(root, 'node_modules', entry), link, 'dir');
  }
  const scopeDir = join(target, '@ostrecht');
  await mkdir(scopeDir, { recursive: true });
  const packagesDir = join(tree, 'packages');
  if (await exists(packagesDir)) {
    for (const entry of await readdir(packagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !(await exists(join(packagesDir, entry.name, 'package.json')))) continue;
      const manifest = await readJson(join(packagesDir, entry.name, 'package.json'));
      const name = String(manifest.name ?? '').replace(/^@ostrecht\//u, '');
      if (!name) continue;
      const link = join(scopeDir, name);
      if (!(await exists(link))) await symlink(join('..', '..', 'packages', entry.name), link, 'dir');
    }
  }
}

/** Projiziert einen Quellbaum mit seinem eigenen Snapshot-Werkzeug vollständig in `out`. */
export async function projectTree({ tree, out, log = console.log }) {
  if (!(await exists(join(tree, SNAPSHOT_TOOL)))) throw new Error(`${SNAPSHOT_TOOL} fehlt im Baum ${tree}; der Stand kennt kein lokales Projektionswerkzeug (fail-closed: keine Äquivalenz nachweisbar)`);
  await rm(out, { force: true });
  await mkdir(join(out, '..'), { recursive: true });
  await run(process.execPath, ['--experimental-strip-types', SNAPSHOT_TOOL, 'project', '--out', out, '--full', '--now', PROOF_PROJECTION_NOW], { cwd: tree, log });
  return out;
}

/** Projiziert einen Git-Ref in einem temporären Worktree mit dem Code dieses Refs. */
export async function projectRef({ root, ref, out, log = console.log }) {
  const tree = await realpath(await mkdtemp(join(tmpdir(), 'd1-proof-base-')));
  await rm(tree, { recursive: true, force: true });
  await run('git', ['-C', root, 'worktree', 'add', '--detach', tree, ref]);
  try {
    await linkNodeModules(root, tree);
    log(`Basisprojektion: Worktree ${ref} unter ${tree}`);
    return await projectTree({ tree, out, log });
  } finally {
    await run('git', ['-C', root, 'worktree', 'remove', '--force', tree]).catch(() => rm(tree, { recursive: true, force: true }));
  }
}

/** Wendet einen inkrementellen Umfang (Code des Arbeitsbaums) auf eine Kopie der Basisprojektion an. */
export async function applyScopeToCopy({ root, basePath, out, scope, inputs, identity, now = PROOF_PROJECTION_NOW }) {
  await rm(out, { force: true });
  await copyFile(basePath, out);
  const plan = inputs.sync.buildSyncPlan({ scope, norms: inputs.norms, publications: inputs.publications, context: inputs.context, now, fingerprint: identity, identity, writeIdentity: true });
  const db = await openDatabase(out, { create: false, root });
  try {
    executePlan(db, plan);
    checkSearchIndexIntegrity(db);
  } finally {
    db.close();
  }
  return { out, statementCount: plan.statementCount };
}

function proofPath(proofDir, headIdentity) {
  return join(proofDir, `proof-${headIdentity.fingerprint.slice(0, 16)}.json`);
}

function comparisonSummary(comparison) {
  return {
    identical: comparison.identical,
    differingTables: comparison.differingTables,
    tables: Object.fromEntries(Object.entries(comparison.tables).map(([table, entry]) => [table, { rowsLeft: entry.rowsLeft, rowsRight: entry.rowsRight, onlyLeft: entry.onlyLeft, onlyRight: entry.onlyRight, changed: entry.changed, changedColumns: entry.changedColumns, sampleKeys: entry.sampleKeys }])),
    fts: comparison.fts,
  };
}

function identitySummary(identity, commit, ref) {
  return {
    ref,
    commit,
    fingerprint: identity.fingerprint,
    scope: identity.scope,
    logic: identity.logic,
    corpus: identity.corpus,
    portal: identity.portal,
    closureUncertain: Boolean(identity.closureUncertain),
  };
}

/**
 * Führt den Nachweis für Basis-Ref → Arbeitsbaum (= Head-Ref) aus und schreibt die Nachweisdatei.
 * @returns {Promise<{ proof: object, proofPath: string, report: string[] }>}
 */
export async function proveProjectionEquivalence({ root = process.cwd(), sync, baseRef, headRef = 'HEAD', proofDir = DEFAULT_PROOF_DIR, seedCacheDir = DEFAULT_SEED_CACHE_DIR, log = console.log, keepProjections = false } = {}) {
  if (!baseRef) throw new Error('Äquivalenznachweis braucht einen Basis-Ref');
  if (!sync) throw new Error('Äquivalenznachweis braucht das Sync-Modul');
  const startedAt = Date.now();
  const elapsed = () => `${Math.round((Date.now() - startedAt) / 1000)} s`;
  const report = [];
  const note = (line) => {
    report.push(line);
    log(line);
  };
  const workdir = resolve(root, proofDir);
  await mkdir(workdir, { recursive: true });
  const [baseCommit, headCommit] = await Promise.all([resolveCommit(root, baseRef), resolveCommit(root, headRef)]);
  const [headIdentity, headRefIdentity, baseIdentity] = await Promise.all([
    projectionIdentity({ root, scope: FULL_SCOPE }),
    projectionIdentityAtRef(headRef, { root, scope: FULL_SCOPE }),
    projectionIdentityAtRef(baseRef, { root, scope: FULL_SCOPE }),
  ]);
  if (headRefIdentity.fingerprint !== headIdentity.fingerprint) {
    throw new Error(`Der Arbeitsbaum trägt nicht die Projektionsidentität von ${headRef} (${headIdentity.fingerprint.slice(0, 16)}… ≠ ${headRefIdentity.fingerprint.slice(0, 16)}…); nicht committete Änderungen zuerst committen`);
  }
  note(`Basis ${baseRef} (${baseCommit.slice(0, 9)}): Identität ${baseIdentity.fingerprint.slice(0, 16)}…`);
  note(`Ziel ${headRef} (${headCommit.slice(0, 9)}): Identität ${headIdentity.fingerprint.slice(0, 16)}… (Logik ${headIdentity.logic.slice(0, 12)}…, ${headIdentity.logicFiles.length} Abschlussdateien${headIdentity.closureUncertain ? ', Abschluss unsicher' : ''})`);
  const proof = {
    $schema: PROOF_SCHEMA,
    comparator: COMPARATOR_VERSION,
    createdAt: new Date().toISOString(),
    base: identitySummary(baseIdentity, baseCommit, baseRef),
    head: identitySummary(headIdentity, headCommit, headRef),
    result: null,
    logicChange: null,
    scopeSignature: null,
    plan: null,
    projections: { base: null, head: null },
    comparison: null,
    trivial: false,
  };
  const path = proofPath(workdir, headIdentity);
  if (baseIdentity.fingerprint === headIdentity.fingerprint) {
    note('Basis und Ziel tragen dieselbe Projektionsidentität; der Nachweis ist trivial (No-op).');
    const inputs = await loadProjectionInputs(root, { sync });
    const scope = await inputs.sync.resolveScope(['--git-diff', baseRef, headRef], { norms: inputs.norms, publications: inputs.publications, logicPaths: new Set(headIdentity.logicFiles), logicChange: 'ignore' });
    Object.assign(proof, { result: 'identity', logicChange: 'ignore', scopeSignature: scopeSignature(scope), plan: planSummary(scope), trivial: true });
    await writeFile(path, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
    return { proof, proofPath: path, report };
  }

  // Umfänge vor den Projektionen bestimmen: bleibt jeder Versuch eine Vollprojektion (Schema),
  // ist der Nachweis ohne Projektionen entschieden.
  const inputs = await loadProjectionInputs(root, { sync });
  const logicPaths = headIdentity.closureUncertain || baseIdentity.closureUncertain ? null : new Set([...baseIdentity.logicFiles, ...headIdentity.logicFiles]);
  if (!logicPaths) note(`Code-Abschluss unsicher (${[...headIdentity.closureReasons, ...baseIdentity.closureReasons].join('; ')}); Logikänderungen zählen über die konservative Obermenge.`);
  const attempts = [];
  for (const logicChange of LOGIC_CHANGE_ATTEMPTS) {
    const scope = await inputs.sync.resolveScope(['--git-diff', baseRef, headRef], { norms: inputs.norms, publications: inputs.publications, logicPaths, logicChange });
    attempts.push({ logicChange, scope });
  }
  if (attempts.every(({ scope }) => scope.mode === 'full')) {
    const reasons = attempts[0].scope.reasons.slice(0, 4).join('; ');
    note(`Jeder inkrementelle Umfang bleibt eine Vollprojektion (${reasons}); keine Äquivalenz nachweisbar.`);
    Object.assign(proof, { result: 'full', comparison: { identical: false, differingTables: [], reason: reasons } });
    await writeFile(path, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
    return { proof, proofPath: path, report };
  }

  const basePath = join(workdir, `base-${baseIdentity.fingerprint.slice(0, 16)}.sqlite`);
  const headPath = join(workdir, `head-${headIdentity.fingerprint.slice(0, 16)}.sqlite`);
  const baseSeed = await findSeedProjection({ root, cacheDir: seedCacheDir, fingerprints: [baseIdentity.fingerprint] });
  if (baseSeed) {
    await copyFile(baseSeed, basePath);
    proof.projections.base = { source: 'seed-cache', file: relative(root, baseSeed) };
    note(`Basisprojektion aus dem Seed-Cache: ${relative(root, baseSeed)} (${elapsed()})`);
  } else {
    await projectRef({ root, ref: baseRef, out: basePath, log });
    proof.projections.base = { source: 'worktree', ref: baseRef };
    note(`Basisprojektion im Worktree erzeugt (${elapsed()})`);
  }
  const headSeed = await findSeedProjection({ root, cacheDir: seedCacheDir, fingerprints: [headIdentity.fingerprint] });
  if (headSeed) {
    await copyFile(headSeed, headPath);
    proof.projections.head = { source: 'seed-cache', file: relative(root, headSeed) };
    note(`Zielprojektion aus dem Seed-Cache: ${relative(root, headSeed)} (${elapsed()})`);
  } else {
    await projectTree({ tree: root, out: headPath, log });
    proof.projections.head = { source: 'working-tree' };
    note(`Zielprojektion aus dem Arbeitsbaum erzeugt (${elapsed()})`);
  }

  let lastComparison = null;
  for (const { logicChange, scope } of attempts) {
    if (scope.mode === 'full') {
      note(`Umfang bleibt Vollprojektion (${scope.reasons.slice(0, 3).join('; ')}); kein inkrementeller Nachweis möglich.`);
      break;
    }
    const candidatePath = join(workdir, `candidate-${logicChange}-${headIdentity.fingerprint.slice(0, 16)}.sqlite`);
    const applied = await applyScopeToCopy({ root, basePath, out: candidatePath, scope, inputs, identity: headIdentity });
    const comparison = await compareProjections(candidatePath, headPath, { root });
    lastComparison = comparison;
    note(`Versuch „${logicChange}“: ${applied.statementCount} Anweisungen auf die Basis angewendet – ${comparison.identical ? 'identisch mit dem Ziel' : `${comparison.differingTables.length} Tabelle(n) weichen ab: ${comparison.differingTables.join(', ')}`} (${elapsed()})`);
    if (!keepProjections) await rm(candidatePath, { force: true });
    if (comparison.identical) {
      Object.assign(proof, {
        result: isEmptyScope(scope) ? 'identity' : 'incremental',
        logicChange,
        scopeSignature: scopeSignature(scope),
        plan: planSummary(scope),
        comparison: comparisonSummary(comparison),
      });
      break;
    }
  }
  if (!proof.result) {
    const comparison = lastComparison ?? await compareProjections(basePath, headPath, { root });
    Object.assign(proof, { result: 'full', comparison: comparisonSummary(comparison) });
    note(formatComparison(comparison));
  }
  if (!keepProjections) {
    await rm(basePath, { force: true });
    await rm(headPath, { force: true });
  }
  await writeFile(path, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  note(`Nachweis: ${describeProofResult(proof)} → ${relative(root, path)} (${elapsed()})`);
  return { proof, proofPath: path, report };
}

function planSummary(scope) {
  return {
    slugs: scope.slugs,
    deletedSlugs: scope.deletedSlugs,
    publicationSlugs: scope.publicationSlugs,
    deletedPublications: scope.deletedPublications ?? [],
    derivedRebuild: Boolean(scope.derivedRebuild),
    refreshSearchDocuments: Boolean(scope.refreshSearchDocuments),
    reasons: scope.reasons.slice(0, 8),
  };
}

/** SHA-256 einer Nachweisdatei (Protokoll). */
export function proofDigest(proof) {
  return createHash('sha256').update(JSON.stringify(proof)).digest('hex');
}
