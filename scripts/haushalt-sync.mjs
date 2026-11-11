#!/usr/bin/env node
/**
 * Reproduzierbarer Import des aktiven Doppelhaushalts aus dem Haushaltsrepo in den
 * versionierten Snapshot data/haushalt/<periode>/.
 *
 *   npm run haushalt:sync -- [--source <pfad>] [--dry-run] [--rueckschritt-erlauben]
 *
 * Ein Snapshot wird nur durch einen Nachfolger seines Quellcommits ersetzt. Ist der bisher
 * importierte Commit kein Vorfahr des aktuellen HEAD (älterer oder abgezweigter Stand), bricht
 * der Import ab; `--rueckschritt-erlauben` lässt das ausdrücklich zu.
 *
 * Ablauf: Repo finden → Git-Stand (sauber) → aktive Fassung → SHA-256 gegen Quellmanifeste →
 * Prüfungen → Transformation → Schreiben in ein temporäres Verzeichnis → erneute Prüfung →
 * atomarer Austausch. Bei jedem Fehler bleibt der bestehende Snapshot unverändert.
 *
 * Ausgabedateien (PDF, Arbeitsmappe) werden zusätzlich gegen die redaktionelle Freitext-
 * Klassifikation content/haushalt/<periode>/freitexte.json geprüft: Ein Titeltext, den das Portal
 * nicht anzeigt, oder eine interne Kennung sperrt die Datei (artefaktZusatzmarken).
 *
 * Testoptionen: --ziel <verzeichnis> ersetzt data/haushalt als Zielwurzel, --content <verzeichnis>
 * ersetzt content als Quelle der redaktionellen Overlays.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { artefaktZusatzmarken, sammleTitelFreitexte, waehleArtefakte } from './lib/haushalt/artefakte.mjs';
import { HaushaltError, SNAPSHOT_SCHEMA, compareCodes, serializeJson, sha256 } from './lib/haushalt/common.mjs';
import { QUELL_REPOSITORY } from './lib/haushalt/legenden.mjs';
import {
  assertCleanPaths,
  compareWithImportedCommit,
  discoverSourceRepository,
  readActiveVersion,
  readGitState,
  readVerifiedSource,
} from './lib/haushalt/source.mjs';
import { transformSource } from './lib/haushalt/transform.mjs';
import { MANIFEST_FILE, validateSnapshotDirectory } from './lib/haushalt/validate.mjs';

const portalRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArguments(argv) {
  const options = { source: null, dryRun: false, ziel: null, content: null, rueckschrittErlauben: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) throw new HaushaltError(`Option ${argument} erwartet einen Wert.`);
      index += 1;
      return next;
    };
    if (argument === '--source') options.source = value();
    else if (argument.startsWith('--source=')) options.source = argument.slice('--source='.length);
    else if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--rueckschritt-erlauben') options.rueckschrittErlauben = true;
    else if (argument === '--ziel' || argument === '--out') options.ziel = value();
    else if (argument.startsWith('--ziel=')) options.ziel = argument.slice('--ziel='.length);
    else if (argument === '--content') options.content = value();
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new HaushaltError(`Unbekannte Option ${argument}. Zulässig: --source <pfad>, --dry-run, --rueckschritt-erlauben.`);
  }
  return options;
}

function writeTree(directory, outputs) {
  for (const [path, content] of outputs) {
    const target = join(directory, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

function listTree(directory, prefix = '') {
  const result = [];
  for (const entry of readdirSync(join(directory, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...listTree(directory, path));
    else result.push(path);
  }
  return result;
}

function describeChange(targetDirectory, outputs) {
  if (!existsSync(targetDirectory)) return 'neu';
  if (listTree(targetDirectory).length !== outputs.size) return 'geändert';
  for (const [path, content] of outputs) {
    const target = join(targetDirectory, path);
    if (!existsSync(target)) return 'geändert';
    if (!readFileSync(target).equals(content)) return 'geändert';
  }
  return 'unverändert';
}

/**
 * Redaktionelle Freitext-Klassifikation der Periode oder null. Fehlt sie, gilt kein Titeltext als
 * freigegeben (fail-closed: jeder Titeltext in PDF oder Arbeitsmappe sperrt die Datei).
 */
function readFreitextOverlay(contentRoot, periode) {
  const path = join(contentRoot, 'haushalt', periode, 'freitexte.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new HaushaltError(`content/haushalt/${periode}/freitexte.json ist kein gültiges JSON: ${error.message}`);
  }
}

/**
 * Die öffentliche Ausgabefassung des Haushaltsrepos wird aus einer unveränderten Kopie von
 * freitexte.json erzeugt (MANIFEST.json, `oeffentliche_freitexte`). Weicht sie vom Portalstand ab,
 * können PDF und Arbeitsmappe überholte öffentliche Fassungen enthalten: Warnung, kein Abbruch,
 * denn nicht freigegebene Titeltexte sperrt die Artefaktprüfung ohnehin.
 */
function pruefeFreitextKopie(repoRoot, active, contentRoot) {
  const portalPfad = join(contentRoot, 'haushalt', active.periode, 'freitexte.json');
  let kopie = null;
  try {
    kopie = JSON.parse(readFileSync(join(repoRoot, active.pfad, 'MANIFEST.json'), 'utf8'))?.oeffentliche_freitexte ?? null;
  } catch {
    kopie = null;
  }
  if (kopie === null || !existsSync(portalPfad)) return null;
  const portalHash = sha256(readFileSync(portalPfad));
  if (kopie.sha256 === portalHash) return null;
  return `Die Ausgabefassung im Haushaltsrepo beruht auf einer anderen Fassung von content/haushalt/${active.periode}/freitexte.json `
    + `(${String(kopie.sha256 ?? 'ohne Prüfsumme').slice(0, 12)}… statt ${portalHash.slice(0, 12)}…); Kopie im Haushaltsrepo aktualisieren, Ausgabe neu erzeugen und erneut synchronisieren.`;
}

export function runSync(options, log = console.log) {
  const dataRoot = options.ziel ? resolve(options.ziel) : join(portalRoot, 'data', 'haushalt');

  const repoRoot = discoverSourceRepository({ source: options.source, portalRoot });
  const verzeichnisname = basename(repoRoot);
  log(`Haushaltsrepo: ${QUELL_REPOSITORY}`);
  const warnungen = [];
  if (verzeichnisname !== QUELL_REPOSITORY) {
    warnungen.push(`Der lokale Klon heißt „${verzeichnisname}“; im import-manifest.json steht unabhängig davon die Quellkennung ${QUELL_REPOSITORY}.`);
  }

  const active = readActiveVersion(repoRoot);
  const tracked = assertCleanPaths(repoRoot, [active.pfad, 'haushalt/VERSIONEN.json']);
  if (!tracked.has('haushalt/VERSIONEN.json')) {
    throw new HaushaltError('haushalt/VERSIONEN.json ist im Haushaltsrepo nicht versioniert.');
  }
  const gitState = readGitState(repoRoot);
  log(`Stand: ${gitState.commitKurz} vom ${gitState.commitdatum}, aktive Fassung ${active.fassung} (${active.pfad})`);
  if (gitState.branch === null) {
    warnungen.push('Das Haushaltsrepo steht auf keinem Branch (losgelöster HEAD); bitte prüfen, ob der gewünschte Stand ausgecheckt ist.');
  }

  // Schutz gegen Rückschritt: nur Nachfolger des bisher importierten Commits übernehmen.
  const bisherigesManifest = join(dataRoot, active.periode, MANIFEST_FILE);
  if (existsSync(bisherigesManifest)) {
    let bisher = null;
    try {
      bisher = JSON.parse(readFileSync(bisherigesManifest, 'utf8'))?.quelle ?? null;
    } catch {
      bisher = null;
    }
    const verhaeltnis = bisher?.commit ? compareWithImportedCommit(repoRoot, bisher.commit, gitState.commit) : 'unbekannt';
    if (verhaeltnis === 'kein-vorfahr' || verhaeltnis === 'unbekannt') {
      const beschreibung = verhaeltnis === 'unbekannt'
        ? `Der bisher importierte Commit ${String(bisher?.commit ?? '(nicht lesbar)').slice(0, 7)} ist im Haushaltsrepo nicht vorhanden oder nicht lesbar`
        : `Der bisher importierte Commit ${bisher.commit.slice(0, 7)} (${bisher.commitdatum ?? 'ohne Datum'}) ist kein Vorfahr des aktuellen Stands ${gitState.commitKurz} (${gitState.commitdatum})`;
      if (!options.rueckschrittErlauben) {
        throw new HaushaltError(
          `${beschreibung}; der Snapshot würde auf einen älteren oder abgezweigten Stand zurückgesetzt. `
            + 'Bitte den neueren Stand im Haushaltsrepo auschecken oder den Rückschritt ausdrücklich mit --rueckschritt-erlauben zulassen.',
        );
      }
      warnungen.push(`${beschreibung}; Rückschritt ausdrücklich zugelassen.`);
    }
  }

  const source = readVerifiedSource(repoRoot, active, tracked);
  log(`Quelldateien gegen die Quellmanifeste geprüft: ${source.quelldateien.length}`);

  const result = transformSource({ active, ...source, gitState });

  // Artefakte: unverändert übernehmen, sofern geprüft und frei von Befunden; eine öffentliche
  // Ausgabefassung hat Vorrang und wird unter dem neutralen Namen veröffentlicht (waehleArtefakte).
  const outputs = new Map();
  for (const [path, value] of result.dateien) outputs.set(path, Buffer.from(serializeJson(value, path), 'utf8'));
  const contentRoot = options.content ? resolve(options.content) : join(portalRoot, 'content');
  const zusatzmarken = artefaktZusatzmarken({
    texte: sammleTitelFreitexte([...result.dateien].filter(([path]) => /^titel\/[^/]+\.json$/u.test(path)).map(([, value]) => value)),
    freitexte: readFreitextOverlay(contentRoot, active.periode),
  });
  const kopieWarnung = pruefeFreitextKopie(repoRoot, active, contentRoot);
  if (kopieWarnung !== null) warnungen.push(kopieWarnung);
  const auswahl = waehleArtefakte(result.artefaktKandidaten, zusatzmarken);
  for (const [path, buffer] of auswahl.dateien) outputs.set(path, buffer);
  const artefakte = auswahl.artefakte;
  const hinweise = [];
  for (const meldung of auswahl.meldungen) (meldung.art === 'warnung' ? warnungen : hinweise).push(meldung.text);

  const snapshotdateien = [...outputs.entries()]
    .map(([path, content]) => ({ pfad: path, sha256: sha256(content), bytes: content.length }))
    .sort((left, right) => compareCodes(left.pfad, right.pfad));

  const importManifest = {
    schema: SNAPSHOT_SCHEMA,
    periode: active.periode,
    quelle: result.quelle,
    quelldateien: source.quelldateien,
    snapshotdateien,
    kontrollsummen: result.kontrollsummen,
    titel_jahresfelder: result.jahresfelder,
    artefakte,
    befunde: result.befunde,
    ausschluesse: result.ausschluesse,
  };
  outputs.set(MANIFEST_FILE, Buffer.from(serializeJson(importManifest, MANIFEST_FILE), 'utf8'));

  // In temporäres Verzeichnis schreiben und erneut prüfen
  mkdirSync(dataRoot, { recursive: true });
  const target = join(dataRoot, active.periode);
  const suffix = `${process.pid}-${randomBytes(4).toString('hex')}`;
  const temporary = join(dataRoot, `.${active.periode}.neu-${suffix}`);
  const previous = join(dataRoot, `.${active.periode}.alt-${suffix}`);
  try {
    writeTree(temporary, outputs);
    const problems = validateSnapshotDirectory(temporary, { periode: active.periode });
    if (problems.length > 0) {
      throw new HaushaltError('Der erzeugte Snapshot besteht die Prüfung nicht:', problems);
    }
    const change = describeChange(target, outputs);
    for (const warning of warnungen) log(`WARNUNG: ${warning}`);
    for (const hinweis of hinweise) log(`Hinweis: ${hinweis}`);
    for (const befund of result.befunde) {
      const count = Array.isArray(befund.abweichungen) ? befund.abweichungen.length : (befund.kapitel ?? []).length;
      log(`Befund ${befund.kennung}: ${count === 0 ? 'keine Abweichungen' : `${count} Einträge (siehe ${MANIFEST_FILE})`}`);
    }
    if (options.dryRun) {
      log(`Prüflauf bestanden: ${snapshotdateien.length + 1} Dateien, Snapshot wäre ${change}. Nichts geschrieben.`);
      rmSync(temporary, { recursive: true, force: true });
      return { periode: active.periode, change, dryRun: true, warnungen };
    }
    if (existsSync(target)) renameSync(target, previous);
    try {
      renameSync(temporary, target);
    } catch (error) {
      if (existsSync(previous)) renameSync(previous, target);
      throw error;
    }
    rmSync(previous, { recursive: true, force: true });
    log(`Snapshot data/haushalt/${active.periode}/ ${change === 'unverändert' ? 'unverändert neu geschrieben' : change === 'neu' ? 'angelegt' : 'aktualisiert'}: ${snapshotdateien.length + 1} Dateien.`);
    return { periode: active.periode, change, dryRun: false, warnungen, target };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log('Aufruf: npm run haushalt:sync -- [--source <pfad zum Haushaltsrepo>] [--dry-run] [--rueckschritt-erlauben]');
      return;
    }
    runSync(options);
  } catch (error) {
    if (error instanceof HaushaltError) {
      console.error(`Haushaltsimport abgebrochen: ${error.message}`);
      for (const detail of error.details ?? []) console.error(`  - ${detail}`);
      console.error('Der bestehende Snapshot wurde nicht verändert.');
    } else {
      console.error('Haushaltsimport abgebrochen (unerwarteter Fehler); der bestehende Snapshot wurde nicht verändert.');
      console.error(error);
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
