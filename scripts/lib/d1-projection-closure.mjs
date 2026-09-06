import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

import * as esbuild from 'esbuild';

/**
 * Transitiver Code-Abschluss der D1-Projektion.
 *
 * Die Projektionsidentität soll nur Code enthalten, den die Projektion tatsächlich ausführt.
 * Dieser Abschluss wird nicht aus Verzeichnissen geraten, sondern mit dem vorhandenen Bundler
 * (esbuild, Metafile) vom Einstiegspunkt scripts/sync-recht-d1.mjs aus aufgelöst: statische und
 * literale dynamische Imports, Re-Exports (`export *`, Sammeldateien), JSON-Imports und die
 * Workspace-Pakete `@ostrecht/*` über ihre package.json-Exports. Ergebnis ist die sortierte Liste
 * der erreichbaren Repositorydateien.
 *
 * Fail-closed: Jede Unsicherheit macht den Abschluss unbrauchbar (`uncertain`), und der
 * Fingerabdruck fällt auf die konservative Obermenge zurück (scripts/lib/d1-projection-fingerprint.mjs):
 *   - esbuild meldet eine Warnung (nicht auflösbare oder mehrdeutige Importe);
 *   - eine erreichte Datei enthält einen dynamischen Import oder ein `require` mit nicht
 *     literalem Argument (esbuild lässt solche Aufrufe stumm stehen; geprüft wird der von esbuild
 *     kommentarbereinigte Code mit einer Regex – ein eigener Importparser wird bewusst nicht
 *     gebaut, die Regex ist nur ein Sicherheitsnetz für diesen einen Fall);
 *   - eine erreichte Datei liegt außerhalb des Repositorys;
 *   - der Einstiegspunkt fehlt im Baum (z. B. ein Ref vor der D1-Projektion).
 * Ein Syntax- oder Auflösungsfehler von esbuild wird nie stillschweigend geglättet, sondern
 * geworfen.
 *
 * Externe npm-Pakete im Abschluss werden mit ihrer Version aus package-lock.json Teil der
 * Identität; ausgenommen ist der Resolver selbst (esbuild, RESOLVER_PACKAGES): er bestimmt, wie
 * der Abschluss gefunden wird, nicht, welche Daten projiziert werden – ändert eine neue Version
 * die Auflösung, ändert sich der Abschluss und damit der Hash ohnehin.
 *
 * Der Abschluss lässt sich für einen Git-Ref ohne Checkout bestimmen: die Quellbäume (scripts/,
 * packages/, package.json) werden mit `git archive` in ein temporäres Verzeichnis extrahiert und
 * dort aufgelöst. Dadurch kennt der Sync die Logikdateien des Basis-Commits genauso wie die des
 * Arbeitsbaums.
 */

export const PROJECTION_ENTRY_POINTS = ['scripts/sync-recht-d1.mjs'];
export const CLOSURE_FORMAT = 1;
/** Bäume, die den Code der Projektion enthalten (für die Extraktion eines Git-Refs). */
export const CLOSURE_TREE_PATHS = ['scripts', 'packages', 'package.json'];
const WORKSPACE_SCOPE = '@ostrecht/';
/** Werkzeuge der Identitätsberechnung selbst (Resolver): erreichbar über die Fingerprint-Module, aber keine Datenabhängigkeit. */
export const RESOLVER_PACKAGES = new Set(['esbuild']);
const NON_LITERAL_DYNAMIC_IMPORT = /\b(?:import|require)\s*\(\s*(?!['"])/u;
const BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

function run(command, args, { cwd, input = null } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(Buffer.concat(stdout));
      else reject(new Error(`${command} ${args.slice(0, 3).join(' ')} schlug fehl (${code}): ${Buffer.concat(stderr).toString('utf8').trim().slice(-400)}`));
    });
    if (input !== null) child.stdin.end(input);
    else child.stdin.end();
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

/** Workspace-Pakete (packages/*) mit ihren Export-Mustern; nur `./*`-Muster werden unterstützt. */
async function workspacePackages(tree) {
  const packages = new Map();
  const packagesDir = join(tree, 'packages');
  if (!(await exists(packagesDir))) return packages;
  for (const entry of await readdir(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(packagesDir, entry.name, 'package.json');
    if (!(await exists(manifestPath))) continue;
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (typeof manifest.name !== 'string') continue;
    packages.set(manifest.name, { dir: join(packagesDir, entry.name), exports: manifest.exports ?? null });
  }
  return packages;
}

function resolveWorkspaceSpecifier(specifier, packages) {
  const match = specifier.match(/^(@[^/]+\/[^/]+)(?:\/(.*))?$/u);
  if (!match) return { error: `Workspace-Import ${specifier} hat keine Paketform` };
  const [, name, rest = ''] = match;
  const entry = packages.get(name);
  if (!entry) return { error: `Workspace-Paket ${name} nicht gefunden (${specifier})` };
  const subpath = rest ? `./${rest}` : '.';
  const exportsMap = entry.exports && typeof entry.exports === 'object' ? entry.exports : null;
  if (!exportsMap) return { error: `Workspace-Paket ${name} deklariert keine Exports` };
  if (Object.hasOwn(exportsMap, subpath) && typeof exportsMap[subpath] === 'string') return { path: resolve(entry.dir, exportsMap[subpath]) };
  for (const [pattern, target] of Object.entries(exportsMap)) {
    if (typeof target !== 'string' || !pattern.endsWith('/*')) continue;
    const prefix = pattern.slice(0, -1);
    if (subpath.startsWith(prefix)) return { path: resolve(entry.dir, target.replace('*', subpath.slice(prefix.length))) };
  }
  return { error: `Workspace-Import ${specifier} passt zu keinem Exportmuster von ${name}` };
}

function workspacePlugin(packages, externals) {
  return {
    name: 'ostrecht-workspace',
    setup(build) {
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        if (BUILTINS.has(args.path)) return { path: args.path, external: true };
        if (args.path.startsWith(WORKSPACE_SCOPE)) {
          const resolved = resolveWorkspaceSpecifier(args.path, packages);
          if (resolved.error) return { errors: [{ text: resolved.error }] };
          return { path: resolved.path };
        }
        const packageName = args.path.startsWith('@') ? args.path.split('/').slice(0, 2).join('/') : args.path.split('/')[0];
        if (!RESOLVER_PACKAGES.has(packageName)) externals.add(packageName);
        return { path: args.path, external: true };
      });
    },
  };
}

/**
 * Abschluss eines Quellbaums (Arbeitsbaum oder extrahierter Ref).
 * @returns {Promise<{ files: string[], externals: string[], uncertain: boolean, reasons: string[] }>}
 */
export async function computeProjectionClosure({ tree: requestedTree, entryPoints = PROJECTION_ENTRY_POINTS }) {
  // Realpfad: esbuild vergleicht Realpfade (unter macOS ist /var ein Symlink auf /private/var).
  const tree = await realpath(requestedTree);
  const missing = [];
  for (const entry of entryPoints) if (!(await exists(join(tree, entry)))) missing.push(entry);
  if (missing.length > 0) return { files: [], externals: [], uncertain: true, reasons: missing.map((entry) => `Einstiegspunkt ${entry} fehlt`) };
  const packages = await workspacePackages(tree);
  const externals = new Set();
  const result = await esbuild.build({
    entryPoints: entryPoints.map((entry) => join(tree, entry)),
    absWorkingDir: tree,
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    logLevel: 'silent',
    treeShaking: false,
    plugins: [workspacePlugin(packages, externals)],
  });
  const reasons = result.warnings.map((warning) => `esbuild: ${warning.text}${warning.location ? ` (${warning.location.file}:${warning.location.line})` : ''}`);
  const files = [];
  for (const input of Object.keys(result.metafile.inputs)) {
    const normalized = input.replaceAll('\\', '/');
    if (isAbsolute(normalized) || normalized.startsWith('../')) {
      reasons.push(`Datei außerhalb des Repositorys erreicht: ${normalized}`);
      continue;
    }
    files.push(normalized);
  }
  files.sort();
  for (const file of files) {
    if (file.endsWith('.json')) continue;
    // Kommentare entfernen (esbuild), damit nur Code und nicht Dokumentation geprüft wird.
    const { code } = await esbuild.transform(await readFile(join(tree, file), 'utf8'), { loader: file.endsWith('.ts') ? 'ts' : 'js', format: 'esm', target: 'esnext' });
    if (NON_LITERAL_DYNAMIC_IMPORT.test(code)) reasons.push(`${file}: dynamischer Import oder require mit nicht literalem Argument`);
  }
  return { files, externals: [...externals].sort(), uncertain: reasons.length > 0, reasons };
}

/** Abschluss eines Git-Refs ohne Checkout: Quellbäume extrahieren, auflösen, aufräumen. */
export async function projectionClosureAtRef(root, ref, options = {}) {
  const entryPoints = options.entryPoints ?? PROJECTION_ENTRY_POINTS;
  // Nur vorhandene Bäume extrahieren; fehlt der Einstiegspunkt im Ref, ist der Abschluss unsicher.
  const present = (await run('git', ['-C', root, 'ls-tree', '--name-only', ref, '--', ...CLOSURE_TREE_PATHS])).toString('utf8').split('\n').filter(Boolean);
  const missing = [];
  for (const entry of entryPoints) {
    const ok = await run('git', ['-C', root, 'cat-file', '-e', `${ref}:${entry}`]).then(() => true, () => false);
    if (!ok) missing.push(entry);
  }
  if (missing.length > 0 || present.length === 0) return { files: [], externals: [], uncertain: true, reasons: missing.map((entry) => `Einstiegspunkt ${entry} fehlt in ${ref}`) };
  const tree = await realpath(await mkdtemp(join(tmpdir(), 'd1-closure-')));
  try {
    const archive = await run('git', ['-C', root, 'archive', '--format=tar', ref, '--', ...present]);
    await run('tar', ['-x', '-C', tree], { input: archive });
    return await computeProjectionClosure({ tree, entryPoints });
  } finally {
    await rm(tree, { recursive: true, force: true });
  }
}

/** Abschluss des Arbeitsbaums (ref = null) oder eines Git-Refs. */
export async function projectionClosure({ root = process.cwd(), ref = null, entryPoints = PROJECTION_ENTRY_POINTS } = {}) {
  if (ref) return projectionClosureAtRef(root, ref, { entryPoints });
  return computeProjectionClosure({ tree: resolve(root), entryPoints });
}

/** Versionen externer Pakete aus package-lock.json (Arbeitsbaum oder Ref); unbekannt → 'unbekannt'. */
export async function externalPackageVersions(root, externals, { ref = null } = {}) {
  if (externals.length === 0) return {};
  const text = ref
    ? (await run('git', ['-C', root, 'show', `${ref}:package-lock.json`])).toString('utf8')
    : await readFile(join(root, 'package-lock.json'), 'utf8');
  const lock = JSON.parse(text);
  return Object.fromEntries(externals.map((name) => [name, lock.packages?.[`node_modules/${name}`]?.version ?? 'unbekannt']));
}

/** Relativer Repositorypfad einer Datei (für Aufrufer, die absolute Pfade halten). */
export function repositoryPath(root, path) {
  return relative(root, path).replaceAll('\\', '/');
}
