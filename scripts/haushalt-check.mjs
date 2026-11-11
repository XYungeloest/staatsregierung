#!/usr/bin/env node
/**
 * Prüft die Haushaltsdaten des Staatsportals ohne Zugriff auf das Haushaltsrepo:
 * Snapshots unter data/haushalt/<periode>/ (Hashes laut import-manifest.json, Summen-,
 * Eindeutigkeits- und Projektinvarianten, Jahre, Schema-Kennung, lokale Pfade) sowie das
 * Periodenregister content/haushalt/perioden.json und die redaktionellen Overlays.
 *
 *   npm run haushalt:check
 *
 * Testoptionen: --ziel <verzeichnis> (statt data/haushalt), --content <verzeichnis> (statt content),
 * --nur-snapshot (ohne Register- und Overlayprüfung).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { artefaktZusatzmarken, scanArtifact } from './lib/haushalt/artefakte.mjs';
import { HaushaltError } from './lib/haushalt/common.mjs';
import { collectTitelFreitexte, validateEditorial } from './lib/haushalt/editorial.mjs';
import { BETRIEBSSYSTEM_DATEIEN, validateSnapshotDirectory } from './lib/haushalt/validate.mjs';

const portalRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArguments(argv) {
  const options = { ziel: null, content: null, nurSnapshot: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) throw new HaushaltError(`Option ${argument} erwartet einen Wert.`);
      index += 1;
      return next;
    };
    if (argument === '--ziel' || argument === '--out') options.ziel = value();
    else if (argument === '--content') options.content = value();
    else if (argument === '--nur-snapshot') options.nurSnapshot = true;
    else throw new HaushaltError(`Unbekannte Option ${argument}.`);
  }
  return options;
}

export function runCheck(options = {}) {
  const dataRoot = options.ziel ? resolve(options.ziel) : join(portalRoot, 'data', 'haushalt');
  const contentRoot = options.content ? resolve(options.content) : join(portalRoot, 'content');
  const problems = [];
  const perioden = [];

  if (existsSync(dataRoot)) {
    for (const name of readdirSync(dataRoot).sort()) {
      if (BETRIEBSSYSTEM_DATEIEN.has(name)) continue;
      if (/^\.\d{4}-\d{4}\.(?:neu|alt)-/u.test(name)) {
        problems.push(`data/haushalt/${name}: Rest eines abgebrochenen Imports; bitte entfernen`);
        continue;
      }
      if (name.startsWith('.')) {
        problems.push(`data/haushalt/${name}: unerwarteter Eintrag`);
        continue;
      }
      if (!statSync(join(dataRoot, name)).isDirectory()) {
        problems.push(`data/haushalt/${name}: unerwartete Datei`);
        continue;
      }
      perioden.push(name);
      for (const problem of validateSnapshotDirectory(join(dataRoot, name), { periode: name })) {
        problems.push(`data/haushalt/${name}: ${problem}`);
      }
    }
  }
  for (const periode of perioden) {
    for (const problem of pruefeArtefakteGegenFreitexte({ snapshotDirectory: join(dataRoot, periode), contentRoot, periode })) {
      problems.push(`data/haushalt/${periode}: ${problem}`);
    }
  }
  if (!options.nurSnapshot) {
    const editorial = validateEditorial({ contentRoot, dataRoot });
    problems.push(...editorial.problems);
  }
  return { problems, perioden };
}

/**
 * Kreuzprüfung der übernommenen Ausgabedateien (PDF, Arbeitsmappe) gegen die redaktionelle
 * Freitext-Klassifikation und die Muster interner Kennungen – dieselbe Prüfung wie beim Import.
 * So fällt auch ein manuell eingespielter Snapshot auf, dessen Ausgabedateien Titeltexte
 * enthalten, die das Portal nicht anzeigt.
 */
export function pruefeArtefakteGegenFreitexte({ snapshotDirectory, contentRoot, periode }) {
  const problems = [];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(snapshotDirectory, 'import-manifest.json'), 'utf8'));
  } catch {
    return problems; // fehlendes oder ungültiges Manifest meldet validateSnapshotDirectory
  }
  const uebernommen = (Array.isArray(manifest?.artefakte) ? manifest.artefakte : []).filter((entry) => entry?.status === 'uebernommen' && typeof entry.datei === 'string');
  if (uebernommen.length === 0) return problems;
  const freitextPfad = join(contentRoot, 'haushalt', periode, 'freitexte.json');
  let freitexte = null;
  if (existsSync(freitextPfad)) {
    try {
      freitexte = JSON.parse(readFileSync(freitextPfad, 'utf8'));
    } catch {
      freitexte = null; // ungültiges Overlay meldet validateEditorial; hier gilt nichts als freigegeben
    }
  }
  const zusatzmarken = artefaktZusatzmarken({ texte: collectTitelFreitexte(snapshotDirectory), freitexte });
  for (const artefakt of uebernommen) {
    const path = join(snapshotDirectory, 'ausgabe', artefakt.datei);
    if (!existsSync(path)) continue; // fehlende Datei meldet validateSnapshotDirectory
    const scan = scanArtifact(artefakt.datei, readFileSync(path), zusatzmarken);
    if (scan.inhaltsbefunde.length > 0) {
      const zeigen = scan.inhaltsbefunde.slice(0, 8).join('; ');
      const rest = scan.inhaltsbefunde.length > 8 ? ` … sowie ${scan.inhaltsbefunde.length - 8} weitere` : '';
      problems.push(`ausgabe/${artefakt.datei} ist als übernommen verzeichnet, enthält aber nicht öffentliche Inhalte: ${zeigen}${rest}`);
    }
  }
  return problems;
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const { problems, perioden } = runCheck(options);
    if (problems.length > 0) {
      console.error(`Haushaltsprüfung fehlgeschlagen (${problems.length} Befunde):`);
      for (const problem of problems.slice(0, 200)) console.error(`  - ${problem}`);
      if (problems.length > 200) console.error(`  … sowie ${problems.length - 200} weitere`);
      process.exitCode = 1;
      return;
    }
    const umfang = options.nurSnapshot ? 'nur Snapshots' : 'Periodenregister und Overlays geprüft';
    console.log(`Haushaltsprüfung bestanden (${perioden.length === 0 ? 'kein Snapshot' : `Snapshots: ${perioden.join(', ')}`}; ${umfang}).`);
  } catch (error) {
    console.error(`Haushaltsprüfung abgebrochen: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
