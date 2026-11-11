import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { HaushaltError, ProblemCollector, sha256 } from './common.mjs';

/**
 * Auffinden, Git-Prüfung und Hashprüfung des Haushaltsrepos. Gelesen wird aus dem Arbeitsbaum
 * eines sauberen Git-Stands; jede gelesene Datei wird gegen ihr Git-Objekt im Commit HEAD
 * verifiziert (damit weder skip-worktree noch assume-unchanged einen abweichenden Arbeitsbaum
 * verbergen) und zusätzlich gegen die Quellmanifeste (daten/manifest.json bzw. MANIFEST.json).
 */

const VERSIONS_FILE = join('haushalt', 'VERSIONEN.json');

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim() : error.message;
    throw new HaushaltError(`Git-Aufruf „git ${args.join(' ')}“ im Haushaltsrepo fehlgeschlagen: ${stderr}`);
  }
}

function gitToplevel(path) {
  try {
    return realpathSync(
      execFileSync('git', ['rev-parse', '--show-toplevel'], {
        cwd: path,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim(),
    );
  } catch {
    return null;
  }
}

/**
 * Ermittelt das Haushaltsrepo. Mit `source` wird genau dieses Verzeichnis (bzw. sein
 * Git-Wurzelverzeichnis) verwendet; ohne Angabe werden die Geschwisterverzeichnisse des
 * Staatsportal-Repos nach haushalt/VERSIONEN.json durchsucht.
 */
export function discoverSourceRepository({ source, portalRoot }) {
  if (source) {
    const absolute = resolve(source);
    if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
      throw new HaushaltError(`Das angegebene Haushaltsrepo existiert nicht oder ist kein Verzeichnis: ${absolute}`);
    }
    const toplevel = gitToplevel(absolute);
    if (!toplevel) {
      throw new HaushaltError(`${absolute} liegt in keinem Git-Repository; das Haushaltsrepo muss ein Git-Arbeitsbaum sein.`);
    }
    if (!existsSync(join(toplevel, VERSIONS_FILE))) {
      throw new HaushaltError(`${toplevel} enthält keine Versionsdatei ${VERSIONS_FILE} und ist daher kein Haushaltsrepo.`);
    }
    return toplevel;
  }

  const portal = realpathSync(portalRoot);
  const parent = dirname(portal);
  const candidates = [];
  for (const entry of readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = join(parent, entry.name);
    if (realpathSync(candidate) === portal) continue;
    if (!existsSync(join(candidate, VERSIONS_FILE))) continue;
    const toplevel = gitToplevel(candidate);
    if (toplevel && toplevel === realpathSync(candidate)) candidates.push(toplevel);
  }
  candidates.sort();
  if (candidates.length === 0) {
    throw new HaushaltError(
      'Kein Haushaltsrepo gefunden: Neben dem Staatsportal-Repo liegt kein Git-Repository mit '
        + `${VERSIONS_FILE}. Bitte den Pfad mit --source <pfad> angeben.`,
    );
  }
  if (candidates.length > 1) {
    throw new HaushaltError(
      `Mehrere mögliche Haushaltsrepos gefunden (${candidates.map((path) => basename(path)).join(', ')}). `
        + 'Bitte das gewünschte Repo mit --source <pfad> angeben.',
    );
  }
  return candidates[0];
}

/** Git-Stand des Haushaltsrepos: voller Commit, Kurzhash (die ersten 7 Zeichen), Commitdatum, Branch. */
export function readGitState(repoRoot) {
  const commit = git(repoRoot, ['rev-parse', 'HEAD']);
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(commit)) {
    throw new HaushaltError(`Unerwarteter Commit-Hash im Haushaltsrepo: ${commit}`);
  }
  const symbolic = spawnSync('git', ['symbolic-ref', '-q', '--short', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  return {
    commit,
    commitKurz: commit.slice(0, 7),
    commitdatum: git(repoRoot, ['show', '-s', '--format=%cI', 'HEAD']),
    branch: symbolic.status === 0 ? symbolic.stdout.trim() : null,
  };
}

/**
 * Verhältnis eines früher importierten Commits zum aktuellen HEAD:
 * 'gleich', 'vorfahr' (HEAD ist neuer), 'kein-vorfahr' (älter oder abgezweigt) oder
 * 'unbekannt' (Commit fehlt im Objektbestand des Haushaltsrepos).
 */
export function compareWithImportedCommit(repoRoot, importedCommit, headCommit) {
  if (importedCommit === headCommit) return 'gleich';
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(String(importedCommit))) return 'unbekannt';
  const exists = spawnSync('git', ['cat-file', '-e', `${importedCommit}^{commit}`], { cwd: repoRoot, encoding: 'utf8' });
  if (exists.status !== 0) return 'unbekannt';
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', importedCommit, headCommit], { cwd: repoRoot, encoding: 'utf8' });
  if (ancestor.status === 0) return 'vorfahr';
  if (ancestor.status === 1) return 'kein-vorfahr';
  throw new HaushaltError(`Git-Aufruf „git merge-base --is-ancestor“ im Haushaltsrepo fehlgeschlagen: ${String(ancestor.stderr).trim()}`);
}

/** Git-Objektkennung einer Datei (wie `git hash-object`), passend zum Hashformat des Repos. */
function gitBlobId(buffer, length) {
  const algorithm = length === 64 ? 'sha256' : 'sha1';
  return createHash(algorithm).update(`blob ${buffer.length}\0`).update(buffer).digest('hex');
}

/**
 * Bricht ab, wenn die gelesenen Pfade uncommittete oder nicht versionierte Änderungen haben.
 * Liefert die Menge der versionierten Dateien unterhalb der Pfade.
 */
export function assertCleanPaths(repoRoot, relativePaths) {
  const status = git(repoRoot, ['status', '--porcelain', '--untracked-files=all', '--', ...relativePaths]);
  if (status !== '') {
    const lines = status.split('\n').slice(0, 20);
    throw new HaushaltError(
      `Das Haushaltsrepo hat uncommittete Änderungen in ${relativePaths.join(', ')}. `
        + 'Übernommen wird nur ein committeter Stand; bitte die Änderungen im Haushaltsrepo committen oder verwerfen.',
      lines,
    );
  }
  // Versioniert heißt: im Commit HEAD enthalten. Ergebnis: Pfad → Git-Objektkennung.
  const tree = git(repoRoot, ['ls-tree', '-r', '-z', '--full-tree', 'HEAD', '--', ...relativePaths]);
  const committed = new Map();
  for (const line of tree.split('\0').filter(Boolean)) {
    const match = /^\d+ blob ([0-9a-f]+)\t(.+)$/su.exec(line);
    if (match) committed.set(match[2], match[1]);
  }
  return committed;
}

/**
 * Bricht ab, wenn eine gelesene Datei nicht dem Git-Objekt im Commit entspricht (z. B. weil
 * skip-worktree oder assume-unchanged eine Änderung im Arbeitsbaum verbirgt).
 */
export function assertMatchesCommit(committed, repoRelative, buffer) {
  const expected = committed.get(repoRelative);
  if (!expected) {
    throw new HaushaltError(`${repoRelative}: Datei ist nicht im Commit HEAD des Haushaltsrepos enthalten.`);
  }
  const actual = gitBlobId(buffer, expected.length);
  if (actual !== expected) {
    throw new HaushaltError(
      `${repoRelative}: Inhalt im Arbeitsbaum weicht vom Commit HEAD ab (Git-Objekt ${actual} statt ${expected}). `
        + 'Vermutlich verbirgt skip-worktree oder assume-unchanged eine Änderung; übernommen wird nur der committete Stand.',
    );
  }
}

function readJsonFile(path, label) {
  if (!existsSync(path)) throw new HaushaltError(`${label} fehlt.`);
  const buffer = readFileSync(path);
  try {
    return { buffer, json: JSON.parse(buffer.toString('utf8')) };
  } catch (error) {
    throw new HaushaltError(`${label}: ungültiges JSON (${error.message})`);
  }
}

/** Liest VERSIONEN.json und bestimmt die aktive Fassung. */
export function readActiveVersion(repoRoot) {
  const { buffer, json } = readJsonFile(join(repoRoot, VERSIONS_FILE), VERSIONS_FILE);
  if (!json || typeof json !== 'object' || typeof json.aktiv !== 'string' || !Array.isArray(json.versionen)) {
    throw new HaushaltError(`${VERSIONS_FILE}: Felder „aktiv“ und „versionen“ fehlen oder sind ungültig.`);
  }
  const matches = json.versionen.filter((entry) => entry?.run_id === json.aktiv);
  if (matches.length !== 1) {
    throw new HaushaltError(
      `${VERSIONS_FILE}: Die aktive Fassung „${json.aktiv}“ ist ${matches.length === 0 ? 'nicht' : 'mehrfach'} in „versionen“ verzeichnet.`,
    );
  }
  const [version] = matches;
  if (version.status !== 'aktiv') {
    throw new HaushaltError(`${VERSIONS_FILE}: Die Fassung „${json.aktiv}“ hat den Status „${version.status}“ statt „aktiv“.`);
  }
  const otherActive = json.versionen.filter((entry) => entry !== version && entry?.status === 'aktiv');
  if (otherActive.length > 0) {
    throw new HaushaltError(`${VERSIONS_FILE}: Mehr als eine Fassung trägt den Status „aktiv“.`);
  }
  if (typeof version.pfad !== 'string' || !/^haushalt\/\d{4}-\d{4}$/u.test(version.pfad)) {
    throw new HaushaltError(`${VERSIONS_FILE}: Pfad der aktiven Fassung „${version.pfad}“ hat nicht die Form haushalt/JJJJ-JJJJ.`);
  }
  const periode = basename(version.pfad);
  const [start, end] = periode.split('-').map(Number);
  if (end !== start + 1) {
    throw new HaushaltError(`${VERSIONS_FILE}: Die Fassung ${periode} ist kein Doppelhaushalt zweier aufeinanderfolgender Jahre.`);
  }
  return {
    buffer,
    json,
    fassung: json.aktiv,
    finanzrahmen: typeof json.finanzrahmen === 'string' ? json.finanzrahmen : null,
    pfad: version.pfad,
    periode,
    jahre: [start, end],
  };
}

/**
 * Liest alle Dateien der aktiven Fassung, die in den Quellmanifesten verzeichnet sind und
 * benötigt bzw. geprüft werden, und verifiziert ihre SHA-256-Werte.
 *
 * @returns {{ files: Map<string, { buffer: Buffer, sha256: string, manifest: string }>, manifest: any, datenManifest: any, baseline: any, quelldateien: any[] }}
 */
export function readVerifiedSource(repoRoot, active, tracked) {
  const base = join(repoRoot, active.pfad);
  const problems = new ProblemCollector();

  const manifestPath = 'MANIFEST.json';
  const { buffer: manifestBuffer, json: manifest } = readJsonFile(join(base, manifestPath), `${active.pfad}/${manifestPath}`);
  if (!manifest || typeof manifest.dateien !== 'object' || manifest.dateien === null) {
    throw new HaushaltError(`${active.pfad}/MANIFEST.json: Verzeichnis „dateien“ fehlt.`);
  }
  const datenManifestPath = 'daten/manifest.json';
  const manifestHashes = manifest.dateien;

  const files = new Map();
  const quelldateien = [];
  const requireTracked = (relative) => {
    const repoRelative = `${active.pfad}/${relative}`;
    if (!tracked.has(repoRelative)) {
      problems.add(`${repoRelative}: Datei ist nicht im Git-Stand des Haushaltsrepos versioniert`);
      return false;
    }
    return true;
  };

  if (requireTracked(manifestPath)) assertMatchesCommit(tracked, `${active.pfad}/${manifestPath}`, manifestBuffer);
  quelldateien.push({ pfad: `${active.pfad}/${manifestPath}`, sha256: sha256(manifestBuffer), pruefung: 'git' });

  // daten/manifest.json muss selbst in MANIFEST.json stehen.
  if (!existsSync(join(base, datenManifestPath))) {
    throw new HaushaltError(`${active.pfad}/${datenManifestPath} fehlt; ohne Datenmanifest ist keine Hashprüfung möglich.`);
  }
  const datenManifestBuffer = readFileSync(join(base, datenManifestPath));
  const datenManifestHash = sha256(datenManifestBuffer);
  if (requireTracked(datenManifestPath)) assertMatchesCommit(tracked, `${active.pfad}/${datenManifestPath}`, datenManifestBuffer);
  problems.equal(
    datenManifestHash,
    'SHA-256 der Datei',
    manifestHashes[datenManifestPath],
    'MANIFEST.json',
    `${active.pfad}/${datenManifestPath}`,
  );
  let datenManifest;
  try {
    datenManifest = JSON.parse(datenManifestBuffer.toString('utf8'));
  } catch (error) {
    throw new HaushaltError(`${active.pfad}/${datenManifestPath}: ungültiges JSON (${error.message})`);
  }
  quelldateien.push({ pfad: `${active.pfad}/${datenManifestPath}`, sha256: datenManifestHash, pruefung: 'MANIFEST.json' });
  const datenHashes = datenManifest?.dateien ?? {};

  // Jede in daten/manifest.json verzeichnete Datei muss mit demselben Hash in MANIFEST.json stehen.
  for (const [name, hash] of Object.entries(datenHashes)) {
    const key = `daten/${name}`;
    if (!(key in manifestHashes)) {
      problems.add(`${key}: in daten/manifest.json verzeichnet, fehlt aber in MANIFEST.json`);
    } else if (manifestHashes[key] !== hash) {
      problems.add(`${key}: daten/manifest.json nennt SHA-256 ${hash}, MANIFEST.json dagegen ${manifestHashes[key]}`);
    }
  }

  const readable = Object.keys(manifestHashes)
    .filter((path) => path.startsWith('daten/') || path.startsWith('gesetze/') || path.startsWith('ausgabe/'))
    .filter((path) => path !== datenManifestPath)
    .sort();

  for (const relative of readable) {
    if (relative.includes('..') || relative.startsWith('/')) {
      problems.add(`MANIFEST.json: unzulässiger Pfad ${relative}`);
      continue;
    }
    const absolute = join(base, relative);
    if (!existsSync(absolute)) {
      problems.add(`${active.pfad}/${relative}: in MANIFEST.json verzeichnet, Datei fehlt`);
      continue;
    }
    if (!requireTracked(relative)) continue;
    const buffer = readFileSync(absolute);
    assertMatchesCommit(tracked, `${active.pfad}/${relative}`, buffer);
    const hash = sha256(buffer);
    const expected = manifestHashes[relative];
    const datenName = relative.startsWith('daten/') ? relative.slice('daten/'.length) : null;
    const manifestName = datenName && datenName in datenHashes ? 'daten/manifest.json' : 'MANIFEST.json';
    if (hash !== expected) {
      problems.add(`${active.pfad}/${relative}: SHA-256 ${hash} weicht vom Quellmanifest ab (${manifestName}: ${expected})`);
      continue;
    }
    files.set(relative, { buffer, sha256: hash, manifest: manifestName });
    quelldateien.push({ pfad: `${active.pfad}/${relative}`, sha256: hash, pruefung: manifestName });
  }

  // BASELINE.json ist nicht erzeugt und daher in keinem Manifest; abgesichert über den sauberen Git-Stand.
  const baselinePath = 'BASELINE.json';
  let baseline = null;
  if (existsSync(join(base, baselinePath)) && requireTracked(baselinePath)) {
    const { buffer, json } = readJsonFile(join(base, baselinePath), `${active.pfad}/${baselinePath}`);
    assertMatchesCommit(tracked, `${active.pfad}/${baselinePath}`, buffer);
    baseline = json;
    quelldateien.push({ pfad: `${active.pfad}/${baselinePath}`, sha256: sha256(buffer), pruefung: 'git' });
  }

  const versionsPath = VERSIONS_FILE.split('\\').join('/');
  assertMatchesCommit(tracked, versionsPath, active.buffer);
  quelldateien.push({ pfad: versionsPath, sha256: sha256(active.buffer), pruefung: 'git' });
  problems.throwIfAny('Die Quelldateien stimmen nicht mit den Quellmanifesten des Haushaltsrepos überein:');

  quelldateien.sort((left, right) => (left.pfad < right.pfad ? -1 : left.pfad > right.pfad ? 1 : 0));
  return { files, manifest, datenManifest, baseline, quelldateien };
}
