#!/usr/bin/env node
/**
 * Freigabe-Guard des Haushaltsbereichs: prüft das Build-Ergebnis des Staatsportals
 * (apps/portal/dist) gegen das Periodenregister content/haushalt/perioden.json.
 *
 * Der Guard schützt die ausgelieferte Website, nicht die Vertraulichkeit der Daten: Snapshot und
 * Overlays nicht freigegebener Perioden liegen im Repository und in CI-Artefakten.
 *
 * Modus des Builds: Der Astro-Build schreibt bei gesetztem HAUSHALT_VORSCHAU den Marker
 * apps/portal/dist/haushalt-vorschau.json (außerhalb von dist/client, wird nicht ausgeliefert)
 * und entfernt ihn bei jedem Build ohne Vorschau (scripts/lib/haushalt/vorschau.mjs).
 * Maßgeblich ist allein der Marker, nicht die Umgebung des Prüflaufs; ein ungültiger Marker ist
 * ein Fehler.
 *
 * Ohne Vorschau (Produktionsform) darf von keiner nicht freigegebenen Periode etwas im
 * ausgelieferten Build stehen:
 *   - keine Datei unter /haushalt/<periode>/ (Seiten, Daten, Downloads),
 *   - keine Ausgabedatei Haushalt_<JJJJ>_<JJJJ>.* und keine andere Nicht-HTML-Datei, deren Name
 *     die Periode trägt (z. B. doppelhaushalt-2027-2028.xlsx, haushalt-2027-2028-eckwerte.png),
 *   - keine Erwähnung der Adresse /haushalt/<periode> und keines Dateinamens der Periode in
 *     Textdateien (HTML-Verweise anderer Seiten, sitemap.xml, search-index.json, _redirects,
 *     Skripte, Kalender, GeoJSON, Sourcemaps),
 *   - keine Fingerabdrücke des Snapshots in Textdateien: Eckwerte des Gesamtplans (ab 1 Mrd. €)
 *     roh und mit Tausenderpunkten sowie die Quellversion aus import-manifest.json,
 *   - keine Seite mit Vorschauhinweis (data-haushalt-vorschau).
 * Nicht referenzierte Client-Bundles unter /_astro/ werden als Hinweis gemeldet (sie entstehen
 * auch für Seiten, deren getStaticPaths ohne Vorschau leer ist).
 *
 * Mit Vorschau (lokale Prüfungen und CI-Builds):
 *   - jede HTML-Seite unter /haushalt/<periode>/ einer nicht freigegebenen Periode und jede
 *     Seite mit Vorschauhinweis trägt <meta name="robots" content="noindex…">,
 *   - _headers setzt für /haushalt/<periode>/* „X-Robots-Tag: noindex“ (auch Daten und
 *     Downloads),
 *   - sitemap.xml nennt keine Adresse einer nicht freigegebenen Periode.
 *   Fehlende Seiten sind kein Fehler (die Vorschau zeigt, was gebaut ist).
 *
 * --produktion (Produktions-Deploy, apps/portal „deploy“) und --staging (apps/portal
 * „deploy:staging“; Staging ist über workers.dev öffentlich erreichbar): verweigern jeden
 * Vorschau-Build und prüfen zusätzlich wie ohne Vorschau. Beide werden nie übersprungen.
 *
 * Aufruf:
 *   node scripts/check-haushalt-release.mjs [--dist <dir>] [--content <dir>] [--data <dir>] [--produktion|--staging]
 * Läuft in „npm run deploy:assets:check“ (Teil von „npm run build“); mit DEPLOY_TARGETS ohne
 * „portal“ wird die Prüfung übersprungen (außer mit --produktion oder --staging).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeSiteTargets } from './lib/site-targets.mjs';
import {
  VORSCHAU_MARKER,
  VORSCHAU_SCHEMA,
  nichtFreigegebenePerioden,
  noindexHeaderPfade,
  vorschauHeaderPfad,
} from './lib/haushalt/vorschau.mjs';

export { VORSCHAU_MARKER, nichtFreigegebenePerioden };

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.xml', '.json', '.jsonld', '.geojson', '.txt', '.js', '.mjs', '.cjs', '.map', '.css', '.csv', '.tsv',
  '.svg', '.webmanifest', '.md', '.ics', '.rss', '.atom',
]);
const TEXT_NAMES = new Set(['_redirects', '_headers', '_routes.json']);
const NOINDEX = /<meta\s+name="robots"\s+content="[^"]*\bnoindex\b/iu;
const VORSCHAU_HINWEIS = /data-haushalt-vorschau/u;
const STRIKTE_ZIELE = { produktion: 'die Produktion', staging: 'das öffentlich erreichbare Staging' };

function parseArguments(argv) {
  const options = { dist: null, content: null, data: null, ziel: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) throw new Error(`Option ${argument} erwartet einen Wert.`);
      index += 1;
      return next;
    };
    if (argument === '--dist') options.dist = value();
    else if (argument === '--content') options.content = value();
    else if (argument === '--data') options.data = value();
    else if (argument === '--produktion' || argument === '--staging') {
      const ziel = argument.slice(2);
      if (options.ziel && options.ziel !== ziel) throw new Error('--produktion und --staging schließen sich aus.');
      options.ziel = ziel;
    } else throw new Error(`Unbekannte Option ${argument}.`);
  }
  return options;
}

function listFiles(root) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  walk(root);
  return files.sort();
}

function isTextFile(path) {
  const name = path.split(sep).at(-1) ?? '';
  if (TEXT_NAMES.has(name)) return true;
  const dot = name.lastIndexOf('.');
  return dot >= 0 && TEXT_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

function toUrlPath(clientRoot, file) {
  return `/${relative(clientRoot, file).split(sep).join('/')}`;
}

/**
 * Liest den Vorschau-Marker; null ohne Marker, sonst { schema, vorschau: true }. Ein ungültiger
 * Marker (kein JSON, falsches Schema, vorschau nicht true) ist ein Fehler: Die Integration schreibt
 * nur gültige Vorschau-Marker und entfernt den Marker bei Builds ohne Vorschau.
 */
export function readVorschauMarker(distRoot) {
  const path = join(distRoot, VORSCHAU_MARKER);
  if (!existsSync(path)) return null;
  let marker;
  try {
    marker = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${VORSCHAU_MARKER}: ungültiges JSON (${error.message})`);
  }
  if (!marker || typeof marker !== 'object' || marker.schema !== VORSCHAU_SCHEMA || marker.vorschau !== true) {
    throw new Error(`${VORSCHAU_MARKER}: ungültiger Marker (erwartet schema „${VORSCHAU_SCHEMA}“ und vorschau: true); neu bauen`);
  }
  return marker;
}

function formatDe(betrag) {
  const ziffern = String(Math.abs(betrag));
  const gruppiert = ziffern.replace(/\B(?=(\d{3})+(?!\d))/gu, '.');
  return betrag < 0 ? `-${gruppiert}` : gruppiert;
}

/**
 * Fingerabdrücke eines Snapshots: Eckwerte des Gesamtplans ab 1 Mrd. € (roh und mit
 * Tausenderpunkten) und die Quellversion (Commit) aus import-manifest.json. Fehlt der Snapshot,
 * gibt es keine Fingerabdrücke.
 */
export function snapshotFingerabdruecke(dataRoot, id) {
  const directory = join(dataRoot, id);
  const found = new Set();
  const lies = (name) => {
    const path = join(directory, name);
    if (!existsSync(path)) return undefined;
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return undefined;
    }
  };
  const gesamtplan = lies('gesamtplan.json');
  for (const jahr of Object.values(gesamtplan?.jahre ?? {})) {
    for (const [feld, wert] of Object.entries(jahr ?? {})) {
      if (feld === 'hauptgruppen' || !Number.isSafeInteger(wert) || Math.abs(wert) < 1_000_000_000) continue;
      found.add(String(wert));
      found.add(formatDe(wert));
    }
  }
  const manifest = lies('import-manifest.json');
  const commit = manifest?.quelle?.commit;
  if (typeof commit === 'string' && /^[0-9a-f]{40}$/u.test(commit)) found.add(commit);
  return [...found];
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * Prüft einen Portal-Build. Gibt { modus, problems, hinweise, perioden } zurück; wirft nur bei
 * fehlender Grundlage (kein Build, kein Register, ungültiger Marker).
 * @param {{ distRoot: string, contentRoot: string, dataRoot?: string, ziel?: 'produktion'|'staging'|null, produktion?: boolean }} options
 */
export function checkHaushaltRelease({ distRoot, contentRoot, dataRoot, ziel = null, produktion = false }) {
  const strikt = ziel ?? (produktion ? 'produktion' : null);
  if (strikt !== null && !Object.hasOwn(STRIKTE_ZIELE, strikt)) throw new Error(`Unbekanntes Ziel „${strikt}“.`);
  const clientRoot = join(distRoot, 'client');
  if (!existsSync(clientRoot) || !statSync(clientRoot).isDirectory()) {
    throw new Error(`Portal-Build fehlt: ${clientRoot}`);
  }
  const marker = readVorschauMarker(distRoot);
  const vorschau = marker !== null;
  const perioden = nichtFreigegebenePerioden(contentRoot);
  const datenRoot = dataRoot ?? join(contentRoot, '..', 'data', 'haushalt');
  const problems = [];
  const hinweise = [];

  if (strikt && vorschau) {
    problems.push(`Vorschau-Build (${VORSCHAU_MARKER}) darf nicht in ${STRIKTE_ZIELE[strikt]}; ohne HAUSHALT_VORSCHAU neu bauen.`);
  }

  const files = listFiles(clientRoot);
  const textCache = new Map();
  const textOf = (file) => {
    if (!textCache.has(file)) textCache.set(file, readFileSync(file, 'utf8'));
    return textCache.get(file);
  };
  const textFiles = files.filter(isTextFile);
  const htmlFiles = files.filter((file) => /\.html?$/iu.test(file));
  const melde = (liste, text, weitere) => {
    for (const eintrag of liste.slice(0, 20)) problems.push(text(eintrag));
    if (liste.length > 20) problems.push(`… sowie ${liste.length - 20} ${weitere}.`);
  };

  if (!vorschau || strikt) {
    for (const id of perioden) {
      const prefix = `/haushalt/${id}/`;
      const [jahrA, jahrB] = id.split('-');
      const artefakt = new RegExp(`Haushalt_${jahrA}_${jahrB}\\.|${jahrA}[-_]${jahrB}`, 'iu');
      const adresse = `/haushalt/${id}`;
      const dateiname = new RegExp(`[\\w.-]*(?:${jahrA}[-_]${jahrB})[\\w.-]*\\.(?:csv|tsv|json|xlsx?|ods|pdf|zip|xml|png|jpe?g|svg|webp)\\b`, 'iu');
      const dateien = files.filter((file) => toUrlPath(clientRoot, file).startsWith(prefix));
      if (dateien.length > 0) {
        problems.push(
          `Periode ${id} ist nicht freigegeben, der Build enthält aber ${dateien.length} Datei(en) unter ${prefix} (z. B. ${toUrlPath(clientRoot, dateien[0])}).`,
        );
      }
      const ausgaben = files.filter((file) => !/\.html?$/iu.test(file) && !toUrlPath(clientRoot, file).startsWith(prefix) && artefakt.test(file.split(sep).at(-1) ?? ''));
      melde(ausgaben, (file) => `Periode ${id} ist nicht freigegeben, der Build enthält aber die Ausgabedatei ${toUrlPath(clientRoot, file)}.`, 'weitere Ausgabedateien');
      const erwaehnungen = textFiles.filter((file) => !toUrlPath(clientRoot, file).startsWith(prefix) && textOf(file).includes(adresse));
      melde(erwaehnungen, (file) => `Periode ${id} ist nicht freigegeben, ${toUrlPath(clientRoot, file)} verweist aber auf ${adresse}/.`, `weitere Dateien mit Verweisen auf ${adresse}/`);
      const dateiverweise = textFiles.filter((file) => !toUrlPath(clientRoot, file).startsWith(prefix) && dateiname.test(textOf(file)));
      melde(
        dateiverweise,
        (file) => `Periode ${id} ist nicht freigegeben, ${toUrlPath(clientRoot, file)} nennt aber eine Datei der Periode (${textOf(file).match(dateiname)?.[0]}).`,
        'weitere Dateien mit Dateinamen der Periode',
      );
      const fingerabdruecke = snapshotFingerabdruecke(datenRoot, id);
      if (fingerabdruecke.length > 0) {
        const muster = new RegExp(`(?<![\\d.])(?:${fingerabdruecke.map(escapeRegExp).join('|')})(?![\\d])`, 'u');
        const treffer = textFiles.filter((file) => muster.test(textOf(file)));
        melde(
          treffer,
          (file) => `Periode ${id} ist nicht freigegeben, ${toUrlPath(clientRoot, file)} enthält aber Daten ihres Snapshots (${textOf(file).match(muster)?.[0]}).`,
          'weitere Dateien mit Snapshotdaten',
        );
      } else {
        hinweise.push(`Periode ${id}: kein Snapshot unter ${relative(repositoryRoot, join(datenRoot, id)) || join(datenRoot, id)}, keine Fingerabdrücke geprüft.`);
      }
    }
    const mitHinweis = htmlFiles.filter((file) => VORSCHAU_HINWEIS.test(textOf(file)));
    melde(mitHinweis, (file) => `${toUrlPath(clientRoot, file)} trägt einen Vorschauhinweis, obwohl der Build keine Vorschau ist.`, 'weitere Seiten mit Vorschauhinweis');

    const bundles = files.filter((file) => toUrlPath(clientRoot, file).startsWith('/_astro/') && /\.m?js$/iu.test(file));
    const unreferenziert = bundles.filter((bundle) => {
      const name = bundle.split(sep).at(-1);
      return !textFiles.some((file) => file !== bundle && textOf(file).includes(name));
    });
    if (unreferenziert.length > 0) {
      hinweise.push(
        `${unreferenziert.length} nicht referenzierte Client-Bundles unter /_astro/ (z. B. ${unreferenziert.slice(0, 3).map((file) => file.split(sep).at(-1)).join(', ')}); sie sind auf Snapshotdaten geprüft.`,
      );
    }
  }

  if (vorschau) {
    const sitemapPath = join(clientRoot, 'sitemap.xml');
    const sitemap = existsSync(sitemapPath) ? readFileSync(sitemapPath, 'utf8') : '';
    const headersPath = join(clientRoot, '_headers');
    const noindexPfade = noindexHeaderPfade(existsSync(headersPath) ? readFileSync(headersPath, 'utf8') : '');
    for (const id of perioden) {
      const prefix = `/haushalt/${id}/`;
      if (sitemap.includes(prefix)) problems.push(`sitemap.xml enthält Adressen der nicht freigegebenen Periode ${id}.`);
      if (!noindexPfade.has(vorschauHeaderPfad(id))) {
        problems.push(`_headers setzt für ${vorschauHeaderPfad(id)} kein „X-Robots-Tag: noindex“ (Daten und Downloads der Vorschau wären indexierbar).`);
      }
      const seiten = htmlFiles.filter((file) => toUrlPath(clientRoot, file).startsWith(prefix));
      const ohneNoindex = seiten.filter((file) => !NOINDEX.test(textOf(file)));
      melde(ohneNoindex, (file) => `${toUrlPath(clientRoot, file)}: Vorschauseite der Periode ${id} ohne noindex.`, 'weitere Vorschauseiten ohne noindex');
      hinweise.push(`Periode ${id}: ${seiten.length} Vorschauseite(n) im Build.`);
    }
    const mitHinweis = htmlFiles.filter((file) => VORSCHAU_HINWEIS.test(textOf(file)) && !NOINDEX.test(textOf(file)));
    melde(mitHinweis, (file) => `${toUrlPath(clientRoot, file)}: Seite mit Vorschauhinweis ohne noindex.`, 'weitere Seiten mit Vorschauhinweis ohne noindex');
  }

  return { modus: vorschau ? 'vorschau' : 'freigabe', problems, hinweise, perioden };
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (!options.ziel && process.env.DEPLOY_TARGETS) {
      const targets = normalizeSiteTargets(process.env.DEPLOY_TARGETS);
      if (!targets.includes('portal')) {
        console.log('Haushalts-Freigabeprüfung übersprungen (kein Portal-Build im Ziel).');
        return;
      }
    }
    const distRoot = options.dist ? resolve(options.dist) : join(repositoryRoot, 'apps', 'portal', 'dist');
    const contentRoot = options.content ? resolve(options.content) : join(repositoryRoot, 'content');
    const dataRoot = options.data ? resolve(options.data) : join(repositoryRoot, 'data', 'haushalt');
    const result = checkHaushaltRelease({ distRoot, contentRoot, dataRoot, ziel: options.ziel });
    if (result.problems.length > 0) {
      console.error(`Haushalts-Freigabeprüfung fehlgeschlagen (${result.modus === 'vorschau' ? 'Vorschau-Build' : 'Build ohne Vorschau'}):`);
      for (const problem of result.problems) console.error(`  - ${problem}`);
      process.exitCode = 1;
      return;
    }
    const gesperrt = result.perioden.length > 0 ? result.perioden.join(', ') : 'keine';
    const modus = result.modus === 'vorschau' ? 'Vorschau-Build (noindex, nicht für Produktion und Staging)' : 'Build ohne Vorschau';
    console.log(`Haushalts-Freigabeprüfung bestanden: ${modus}; nicht freigegebene Perioden: ${gesperrt}.`);
    for (const hinweis of result.hinweise) console.log(`  ${hinweis}`);
  } catch (error) {
    console.error(`Haushalts-Freigabeprüfung abgebrochen: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
