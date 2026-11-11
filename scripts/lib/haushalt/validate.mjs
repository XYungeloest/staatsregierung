import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import { istOeffentlicheFassung, oeffentlicheFassungVon, scanArtifact, veroeffentlichterName } from './artefakte.mjs';
import {
  AUSGABE_HAUPTGRUPPEN,
  EINNAHME_HAUPTGRUPPEN,
  HAUPTGRUPPEN,
  ProblemCollector,
  SHARE_KEYS,
  SNAPSHOT_SCHEMA,
  collectStrings,
  deepEqual,
  findLocalPathPatterns,
  formatValue,
  sha256,
  sumBy,
} from './common.mjs';
import { fehlendeFondsEinnahmetitel, projektsummenAbweichungen, pruefeQuerbezuege, pruefeRechenidentitaeten } from './invarianten.mjs';

/**
 * Gemeinsame Prüflogik für `haushalt:sync` (vor dem Ersetzen) und `haushalt:check` (ohne
 * Haushaltsrepo). Geprüft wird ausschließlich der Snapshot selbst: Hashes laut
 * import-manifest.json, Schema-Kennung, Summen- und Eindeutigkeitsinvarianten, Projektbezüge,
 * Jahre und lokale Pfade.
 */

export const MANIFEST_FILE = 'import-manifest.json';

/** Dateien, die Betriebssysteme beim Ansehen eines Ordners selbst anlegen; nie Teil des Snapshots. */
export const BETRIEBSSYSTEM_DATEIEN = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

function listFiles(directory, base = directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && BETRIEBSSYSTEM_DATEIEN.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(path, base));
    else if (entry.isFile()) result.push(relative(base, path).split('\\').join('/'));
    else result.push(`${relative(base, path)} (kein reguläres Objekt)`);
  }
  return result.sort();
}

function checkNumbers(problems, value, path, file) {
  if (typeof value === 'number') {
    const key = path.split('.').pop();
    if (!Number.isFinite(value)) problems.add(`${file}: ${path} ist keine endliche Zahl`);
    else if (!Number.isSafeInteger(value) && !SHARE_KEYS.has(key)) {
      problems.add(`${file}: ${path} = ${value} ist kein ganzzahliger Betrag`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => checkNumbers(problems, entry, `${path}[${index}]`, file));
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) checkNumbers(problems, entry, path ? `${path}.${key}` : key, file);
  }
}

function yearKeysOf(periode) {
  const match = /^(\d{4})-(\d{4})$/u.exec(periode);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return null;
  return [Number(match[1]), Number(match[2])];
}

/**
 * Prüft ein Snapshot-Verzeichnis data/haushalt/<periode>/.
 * @param {string} directory
 * @param {{ periode?: string }} [options]
 * @returns {string[]} Liste der Befunde (leer = bestanden)
 */
export function validateSnapshotDirectory(directory, options = {}) {
  const problems = new ProblemCollector();
  const periode = options.periode ?? basename(directory);
  const years = yearKeysOf(periode);
  if (!years) {
    problems.add(`Periodenkennung ${periode} hat nicht die Form JJJJ-JJJJ zweier aufeinanderfolgender Jahre`);
    return problems.problems;
  }
  const yearKeys = years.map(String);
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    problems.add('Snapshot-Verzeichnis fehlt');
    return problems.problems;
  }

  const manifestPath = join(directory, MANIFEST_FILE);
  if (!existsSync(manifestPath)) {
    problems.add(`${MANIFEST_FILE} fehlt`);
    return problems.problems;
  }
  const manifestText = readFileSync(manifestPath, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    problems.add(`${MANIFEST_FILE}: ungültiges JSON (${error.message})`);
    return problems.problems;
  }
  problems.equal(manifest.schema, `${MANIFEST_FILE} schema`, SNAPSHOT_SCHEMA, 'erwartete Schema-Kennung', periode);
  problems.equal(manifest.periode, `${MANIFEST_FILE} periode`, periode, 'Verzeichnisname', periode);
  const hits = new Set([...findLocalPathPatterns(manifestText), ...findLocalPathPatterns(collectStrings(manifest).join('\n'))]);
  if (hits.size > 0) problems.add(`${MANIFEST_FILE}: enthält lokale Pfade (${[...hits].join(', ')})`);
  if (/https?:\/\//u.test(JSON.stringify(manifest.quelle ?? {}))) {
    problems.add(`${MANIFEST_FILE}: Quellangaben enthalten eine Netzadresse`);
  }

  // Dateibestand und Hashes
  const listed = new Map();
  for (const entry of manifest.snapshotdateien ?? []) {
    if (listed.has(entry.pfad)) problems.add(`${MANIFEST_FILE}: Datei ${entry.pfad} doppelt verzeichnet`);
    listed.set(entry.pfad, entry);
  }
  const present = listFiles(directory).filter((path) => path !== MANIFEST_FILE);
  for (const path of present) {
    if (!listed.has(path)) problems.add(`${path}: Datei ist nicht im ${MANIFEST_FILE} verzeichnet`);
  }
  const buffers = new Map();
  for (const [path, entry] of listed) {
    const absolute = join(directory, path);
    if (!existsSync(absolute)) {
      problems.add(`${path}: im ${MANIFEST_FILE} verzeichnet, Datei fehlt`);
      continue;
    }
    const buffer = readFileSync(absolute);
    buffers.set(path, buffer);
    const hash = sha256(buffer);
    if (hash !== entry.sha256) problems.add(`${path}: SHA-256 ${hash} weicht vom ${MANIFEST_FILE} ab (${entry.sha256})`);
    if (entry.bytes !== undefined && entry.bytes !== buffer.length) problems.add(`${path}: Größe ${buffer.length} weicht vom ${MANIFEST_FILE} ab (${entry.bytes})`);
  }

  // Artefakte: jede Ausgabedatei der Quelle ist mit Herkunft (quelldatei), Quell-Hash und Status
  // verzeichnet; übernommen wird nur unter dem veröffentlichten Namen, eine vorhandene öffentliche
  // Ausgabefassung hat Vorrang vor der Standardausgabe, und kein gesperrter Inhalt liegt im Snapshot.
  const quellHashes = new Map((manifest.quelldateien ?? []).map((entry) => [entry.pfad, entry.sha256]));
  const ausgabePrefix = `${manifest.quelle?.pfad}/ausgabe/`;
  const artefakte = Array.isArray(manifest.artefakte) ? manifest.artefakte : [];
  if (!Array.isArray(manifest.artefakte)) problems.add(`${MANIFEST_FILE}: Liste „artefakte“ fehlt`);
  const quellnamen = new Set();
  const ziele = new Set();
  const gueltig = [];
  for (const [index, artefakt] of artefakte.entries()) {
    const quelldatei = artefakt?.quelldatei;
    if (typeof quelldatei !== 'string' || quelldatei === '' || /[/\\]/u.test(quelldatei) || quelldatei.includes('..')) {
      problems.add(`${MANIFEST_FILE}: artefakte[${index}] ohne gültige Herkunftsdatei (quelldatei)`);
      continue;
    }
    if (quellnamen.has(quelldatei)) problems.add(`${MANIFEST_FILE}: Artefakt ${quelldatei} doppelt verzeichnet`);
    quellnamen.add(quelldatei);
    gueltig.push(artefakt);
    const quellPfad = `${ausgabePrefix}${quelldatei}`;
    if (!quellHashes.has(quellPfad)) problems.add(`${MANIFEST_FILE}: Artefakt ${quelldatei} ist nicht als Quelldatei ${quellPfad} verzeichnet`);
    else problems.equal(artefakt.sha256, `${MANIFEST_FILE} artefakte ${quelldatei} sha256`, quellHashes.get(quellPfad), `${MANIFEST_FILE} quelldateien ${quellPfad}`, `Artefakt ${quelldatei}`);
    if (artefakt.status === 'uebernommen') {
      const erwartet = veroeffentlichterName(quelldatei);
      if (artefakt.datei !== erwartet) {
        problems.add(`${MANIFEST_FILE}: Artefakt ${quelldatei} ist als „${String(artefakt.datei)}“ verzeichnet, veröffentlicht wird es als ${erwartet}`);
        continue;
      }
      if (ziele.has(artefakt.datei)) problems.add(`${MANIFEST_FILE}: Ausgabedatei ${artefakt.datei} mehrfach als übernommen verzeichnet`);
      ziele.add(artefakt.datei);
      const path = `ausgabe/${artefakt.datei}`;
      const buffer = buffers.get(path);
      if (!buffer) {
        problems.add(`${path}: als übernommen verzeichnet, fehlt aber`);
        continue;
      }
      if (sha256(buffer) !== artefakt.sha256) problems.add(`${path}: weicht vom Quell-Hash der Herkunftsdatei ${quelldatei} ab`);
      if (artefakt.bytes !== buffer.length) problems.add(`${path}: Größe ${buffer.length} weicht vom Artefakteintrag ab (${artefakt.bytes})`);
    } else if (artefakt.status === 'gesperrt' || artefakt.status === 'ersetzt') {
      if (artefakt.datei !== undefined) problems.add(`${MANIFEST_FILE}: nicht übernommenes Artefakt ${quelldatei} nennt eine Zieldatei`);
      if (typeof artefakt.grund !== 'string' || artefakt.grund.trim() === '') problems.add(`${MANIFEST_FILE}: Artefakt ${quelldatei} ohne Grund`);
      if (artefakt.status === 'gesperrt') {
        for (const [path, buffer] of buffers) {
          if (path.startsWith('ausgabe/') && sha256(buffer) === artefakt.sha256) problems.add(`${path}: Inhalt des gesperrten Artefakts ${quelldatei} liegt im Snapshot`);
        }
      }
    } else {
      problems.add(`${MANIFEST_FILE}: Artefakt ${quelldatei} hat unbekannten Status „${artefakt.status}“`);
    }
  }
  for (const artefakt of gueltig) {
    if (istOeffentlicheFassung(artefakt.quelldatei)) continue;
    const oeffentlich = oeffentlicheFassungVon(artefakt.quelldatei);
    if (artefakt.status === 'uebernommen' && quellnamen.has(oeffentlich)) {
      problems.add(`${MANIFEST_FILE}: Standardausgabe ${artefakt.quelldatei} übernommen, obwohl die öffentliche Ausgabefassung ${oeffentlich} vorliegt`);
    }
    if (artefakt.status === 'ersetzt' && !quellnamen.has(oeffentlich)) {
      problems.add(`${MANIFEST_FILE}: Artefakt ${artefakt.quelldatei} als ersetzt verzeichnet, die öffentliche Ausgabefassung ${oeffentlich} fehlt aber`);
    }
  }
  for (const pfad of quellHashes.keys()) {
    if (pfad.startsWith(ausgabePrefix) && !quellnamen.has(pfad.slice(ausgabePrefix.length))) {
      problems.add(`${MANIFEST_FILE}: Ausgabedatei ${pfad} der Quelle ohne Artefakteintrag`);
    }
  }
  for (const [path, buffer] of buffers) {
    if (path.startsWith('ausgabe/')) {
      const scan = scanArtifact(path, buffer);
      for (const finding of scan.findings) problems.add(`${path}: ${finding}`);
      if (scan.inhaltsbefunde.length > 0) problems.add(`${path}: enthält nicht öffentliche Abschnitte (${scan.inhaltsbefunde.join(', ')})`);
      if (!(manifest.artefakte ?? []).some((entry) => `ausgabe/${entry.datei}` === path && entry.status === 'uebernommen')) {
        problems.add(`${path}: Artefakt ohne Freigabevermerk im ${MANIFEST_FILE}`);
      }
    }
  }

  // JSON-Dateien: Schema, Periode, Zahlen, lokale Pfade
  const data = new Map();
  for (const [path, buffer] of buffers) {
    if (!path.endsWith('.json')) continue;
    const text = buffer.toString('utf8');
    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      problems.add(`${path}: ungültiges JSON (${error.message})`);
      continue;
    }
    // Im Rohtext (maskierte Form) und in allen dekodierten Schlüsseln und Zeichenketten suchen
    const pathHits = new Set([...findLocalPathPatterns(text), ...findLocalPathPatterns(collectStrings(json).join('\n'))]);
    if (pathHits.size > 0) problems.add(`${path}: enthält lokale Pfade (${[...pathHits].join(', ')})`);
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      problems.add(`${path}: Top-Level ist kein Objekt`);
      continue;
    }
    if (json.schema !== SNAPSHOT_SCHEMA) problems.add(`${path}: Schema-Kennung ${formatValue(json.schema)} statt ${SNAPSHOT_SCHEMA}`);
    if (json.periode !== periode) problems.add(`${path}: Periode ${formatValue(json.periode)} statt ${periode}`);
    if (!text.endsWith('\n') || text !== `${JSON.stringify(json, null, 2)}\n`) {
      problems.add(`${path}: nicht in der kanonischen Formatierung (2 Leerzeichen, abschließender Zeilenumbruch)`);
    }
    checkNumbers(problems, json, '', `${path}`);
    data.set(path, json);
  }
  checkNumbers(problems, manifest, '', `${MANIFEST_FILE}`);

  const required = ['periode.json', 'gesamtplan.json', 'einzelplaene.json', 'kapitel.json', 'projekte.json', 'finanzierung.json', 'ruecklagen.json', 'personal.json', 'qualitaet.json', 'gesetze.json'];
  for (const path of required) {
    if (!data.has(path)) problems.add(`${path}: Pflichtdatei fehlt oder ist nicht lesbar`);
  }
  if (required.some((path) => !data.has(path))) return problems.problems;

  const periodeJson = data.get('periode.json');
  const gesamtplan = data.get('gesamtplan.json');
  const { einzelplaene } = data.get('einzelplaene.json');
  const { kapitel } = data.get('kapitel.json');
  const { projekte } = data.get('projekte.json');
  const qualitaet = data.get('qualitaet.json');

  problems.check(deepEqual(periodeJson.jahre, years), `periode.json: Jahre ${JSON.stringify(periodeJson.jahre)} statt ${JSON.stringify(years)}`);
  const checkYearMap = (map, label) => {
    if (!map || typeof map !== 'object' || !deepEqual(Object.keys(map), yearKeys)) {
      problems.add(`${label}: Jahre ${JSON.stringify(map && typeof map === 'object' ? Object.keys(map) : map)} statt ${JSON.stringify(yearKeys)}`);
      return false;
    }
    return true;
  };

  // Gesamtplan
  if (!checkYearMap(gesamtplan.jahre, 'gesamtplan.json jahre')) return problems.problems;
  for (const year of yearKeys) {
    const gp = gesamtplan.jahre[year];
    problems.equal(periodeJson.haushaltsvolumen?.[year], 'periode.json haushaltsvolumen', gp.haushaltsvolumen, 'gesamtplan.json', `Haushaltsvolumen ${year}`);
    problems.equal(sumBy(EINNAHME_HAUPTGRUPPEN, (hg) => gp.hauptgruppen[hg]), 'Summe HG 0–3', gp.einnahmen, 'gesamtplan.json einnahmen', `Gesamtplan ${year}`);
    problems.equal(sumBy(AUSGABE_HAUPTGRUPPEN, (hg) => gp.hauptgruppen[hg]), 'Summe HG 4–9', gp.ausgaben, 'gesamtplan.json ausgaben', `Gesamtplan ${year}`);
    for (const hg of HAUPTGRUPPEN) {
      problems.equal(
        sumBy(gesamtplan.gruppierung.filter((row) => row.hauptgruppe === hg), (row) => row.jahre[year]),
        'Summe der Gruppierung', gp.hauptgruppen[hg], 'gesamtplan.json', `Hauptgruppe ${hg} ${year}`,
      );
    }
    problems.equal(sumBy(gesamtplan.funktionen, (row) => row.jahre[year]), 'Summe der Funktionen', gp.ausgaben, 'gesamtplan.json ausgaben', `Funktionenplan ${year}`);
    const manifestSums = manifest.kontrollsummen?.[year];
    problems.equal(manifestSums?.einnahmen, `${MANIFEST_FILE} Kontrollsumme einnahmen`, gp.einnahmen, 'gesamtplan.json', `Kontrollsumme ${year}`);
    problems.equal(manifestSums?.ausgaben, `${MANIFEST_FILE} Kontrollsumme ausgaben`, gp.ausgaben, 'gesamtplan.json', `Kontrollsumme ${year}`);
    problems.equal(manifestSums?.einzelplaene, `${MANIFEST_FILE} Anzahl Einzelpläne`, einzelplaene.length, 'einzelplaene.json', `Kontrollsumme ${year}`);
    problems.equal(manifestSums?.kapitel, `${MANIFEST_FILE} Anzahl Kapitel`, kapitel.length, 'kapitel.json', `Kontrollsumme ${year}`);
  }

  // Einzelpläne und Kapitel
  const strukturBefunde = problems.problems.length;
  const epCodes = new Set();
  for (const ep of einzelplaene) {
    if (epCodes.has(ep.ep)) problems.add(`einzelplaene.json: Einzelplan ${ep.ep} doppelt`);
    epCodes.add(ep.ep);
    checkYearMap(ep.jahre, `einzelplaene.json ${ep.ep}`);
  }
  const kapitelCodes = new Map();
  for (const entry of kapitel) {
    if (kapitelCodes.has(entry.kapitel)) problems.add(`kapitel.json: Kapitel ${entry.kapitel} doppelt`);
    kapitelCodes.set(entry.kapitel, entry);
    if (!epCodes.has(entry.einzelplan) || entry.kapitel.slice(0, 2) !== entry.einzelplan) {
      problems.add(`kapitel.json: Kapitel ${entry.kapitel} gehört zu keinem gültigen Einzelplan`);
    }
    checkYearMap(entry.jahre, `kapitel.json ${entry.kapitel}`);
  }
  if (problems.problems.length > strukturBefunde) return problems.problems;
  for (const year of yearKeys) {
    for (const field of ['einnahmen', 'ausgaben']) {
      problems.equal(sumBy(einzelplaene, (ep) => ep.jahre[year][field]), 'Summe der Einzelpläne', gesamtplan.jahre[year][field], 'gesamtplan.json', `${field} ${year}`);
    }
    for (const hg of HAUPTGRUPPEN) {
      problems.equal(sumBy(einzelplaene, (ep) => ep.jahre[year].hauptgruppen[hg]), 'Summe der Einzelpläne', gesamtplan.jahre[year].hauptgruppen[hg], 'gesamtplan.json', `Hauptgruppe ${hg} ${year}`);
    }
  }
  for (const ep of einzelplaene) {
    const planKapitel = kapitel.filter((entry) => entry.einzelplan === ep.ep);
    problems.check(deepEqual(ep.kapitel, planKapitel.map((entry) => entry.kapitel)), `einzelplaene.json ${ep.ep}: Kapitelliste stimmt nicht mit kapitel.json überein`);
    problems.equal(ep.kapitelanzahl, 'einzelplaene.json kapitelanzahl', planKapitel.length, 'kapitel.json', `Einzelplan ${ep.ep}`);
    problems.equal(ep.titelanzahl, 'einzelplaene.json titelanzahl', sumBy(planKapitel, (entry) => entry.titelanzahl), 'Summe kapitel.json titelanzahl', `Einzelplan ${ep.ep}`);
    for (const year of yearKeys) {
      for (const field of ['einnahmen', 'ausgaben']) {
        problems.equal(sumBy(planKapitel, (entry) => entry.jahre[year][field]), 'Summe der Kapitel', ep.jahre[year][field], 'einzelplaene.json', `Einzelplan ${ep.ep} ${field} ${year}`);
      }
      for (const hg of HAUPTGRUPPEN) {
        problems.equal(sumBy(planKapitel, (entry) => entry.jahre[year].hauptgruppen[hg]), 'Summe der Kapitel', ep.jahre[year].hauptgruppen[hg], 'einzelplaene.json', `Einzelplan ${ep.ep} Hauptgruppe ${hg} ${year}`);
      }
    }
  }

  // Titel: genau eine Datei je Einzelplan, keine Doppelzählung
  const titelFiles = [...data.keys()].filter((path) => /^titel\/[^/]+\.json$/u.test(path));
  const fileCodes = titelFiles.map((path) => path.slice('titel/'.length, -'.json'.length)).sort();
  problems.check(deepEqual(fileCodes, [...epCodes].sort()), `titel/: Dateien ${JSON.stringify(fileCodes)} entsprechen nicht den Einzelplänen ${JSON.stringify([...epCodes].sort())}`);
  const konzeptIds = new Set();
  const titelIds = new Set();
  const nummern = new Map();
  const sums = new Map();
  const addSum = (key, value) => sums.set(key, (sums.get(key) ?? 0) + value);
  const sumOf = (key) => sums.get(key) ?? 0;
  const titelProjekt = new Map();
  const titelEintraege = new Map();
  let jahresfelder = null;
  for (const path of titelFiles) {
    const file = data.get(path);
    const ep = path.slice('titel/'.length, -'.json'.length);
    problems.equal(file.einzelplan, `${path} einzelplan`, ep, 'Dateiname', path);
    if (jahresfelder === null) jahresfelder = file.jahresfelder;
    else if (!deepEqual(jahresfelder, file.jahresfelder)) problems.add(`${path}: Liste der jahresabhängigen Felder weicht von anderen Titeldateien ab`);
    for (const entry of file.titel ?? []) {
      const label = `${path} ${entry.konzept_id}`;
      if (konzeptIds.has(entry.konzept_id)) problems.add(`${label}: Titelkonzept mehrfach im Snapshot (Doppelzählung)`);
      konzeptIds.add(entry.konzept_id);
      if (entry.kapitel?.slice(0, 2) !== ep) problems.add(`${label}: Kapitel ${entry.kapitel} gehört nicht zu Einzelplan ${ep}`);
      if (!kapitelCodes.has(entry.kapitel)) problems.add(`${label}: Kapitel ${entry.kapitel} fehlt in kapitel.json`);
      const nummer = `${entry.kapitel}/${entry.titel}`;
      if (nummern.has(nummer)) problems.add(`${label}: Titelnummer ${nummer} doppelt`);
      nummern.set(nummer, entry.konzept_id);
      if (entry.seite !== (EINNAHME_HAUPTGRUPPEN.includes(entry.hauptgruppe) ? 'Einnahme' : 'Ausgabe')) {
        problems.add(`${label}: Seite ${entry.seite} passt nicht zur Hauptgruppe ${entry.hauptgruppe}`);
      }
      if (entry.gruppe?.[0] !== entry.hauptgruppe || entry.titel?.slice(0, 3) !== entry.gruppe || entry.obergruppe !== entry.gruppe?.slice(0, 2)) {
        problems.add(`${label}: Titel, Gruppe, Obergruppe und Hauptgruppe passen nicht zusammen`);
      }
      if (entry.projekt_id) titelProjekt.set(entry.konzept_id, entry.projekt_id);
      titelEintraege.set(entry.konzept_id, entry);
      if (!checkYearMap(entry.jahre, label)) continue;
      for (const year of yearKeys) {
        const values = entry.jahre[year];
        if (values.id !== `${entry.konzept_id}@${year}`) problems.add(`${label}: Jahres-ID ${values.id} passt nicht zu ${year}`);
        if (titelIds.has(values.id)) problems.add(`${label}: Titel-ID ${values.id} doppelt`);
        titelIds.add(values.id);
        if (!Number.isSafeInteger(values.betrag) || values.betrag < 0) problems.add(`${label}: Betrag ${year} ungültig`);
        const qualitaetsklasse = values.qualitaet ?? entry.qualitaet;
        addSum(`k|${entry.kapitel}|${year}|${entry.seite}`, values.betrag);
        addSum(`k|${entry.kapitel}|${year}|hg${entry.hauptgruppe}`, values.betrag);
        if (entry.seite === 'Ausgabe' && qualitaetsklasse === 'S_rest') addSum(`k|${entry.kapitel}|${year}|rest`, values.betrag);
        addSum(`g|${entry.gruppe}|${year}`, values.betrag);
        addSum(`kg|${entry.kapitel}|${entry.gruppe}|${year}`, values.betrag);
        if (entry.seite === 'Ausgabe') addSum(`f|${values.funktion ?? entry.funktion}|${year}`, values.betrag);
        if (entry.seite === 'Ausgabe') addSum(`q|${qualitaetsklasse}|${year}`, values.betrag);
      }
    }
  }
  for (const year of yearKeys) {
    problems.equal(manifest.kontrollsummen?.[year]?.titel, `${MANIFEST_FILE} Anzahl Titel`, konzeptIds.size, 'Titeldateien', `Kontrollsumme ${year}`);
  }
  for (const entry of kapitel) {
    const count = [...nummern.keys()].filter((key) => key.startsWith(`${entry.kapitel}/`)).length;
    problems.equal(count, 'Titel in den Titeldateien', entry.titelanzahl, 'kapitel.json titelanzahl', `Kapitel ${entry.kapitel}`);
    for (const year of yearKeys) {
      const values = entry.jahre[year];
      problems.equal(sumOf(`k|${entry.kapitel}|${year}|Einnahme`), 'Summe der Einnahmetitel', values.einnahmen, 'kapitel.json', `Kapitel ${entry.kapitel} ${year}`);
      problems.equal(sumOf(`k|${entry.kapitel}|${year}|Ausgabe`), 'Summe der Ausgabetitel', values.ausgaben, 'kapitel.json', `Kapitel ${entry.kapitel} ${year}`);
      problems.equal(sumOf(`k|${entry.kapitel}|${year}|rest`), 'Summe der Restansätze', values.rest, 'kapitel.json rest', `Kapitel ${entry.kapitel} ${year}`);
      for (const hg of HAUPTGRUPPEN) {
        problems.equal(sumOf(`k|${entry.kapitel}|${year}|hg${hg}`), 'Summe der Titel', values.hauptgruppen[hg], 'kapitel.json', `Kapitel ${entry.kapitel} ${year} Hauptgruppe ${hg}`);
      }
    }
  }
  for (const row of gesamtplan.gruppierung) {
    for (const year of yearKeys) problems.equal(sumOf(`g|${row.gruppe}|${year}`), 'Summe der Titel', row.jahre[year], 'gesamtplan.json gruppierung', `Gruppe ${row.gruppe} ${year}`);
  }
  for (const row of gesamtplan.funktionen) {
    for (const year of yearKeys) problems.equal(sumOf(`f|${row.funktion}|${year}`), 'Summe der Ausgabetitel', row.jahre[year], 'gesamtplan.json funktionen', `Funktion ${row.funktion} ${year}`);
  }
  if (checkYearMap(qualitaet.klassen, 'qualitaet.json klassen')) {
    for (const year of yearKeys) {
      const classes = new Set([...Object.keys(qualitaet.klassen[year]), ...[...sums.keys()].filter((key) => key.startsWith('q|') && key.endsWith(`|${year}`)).map((key) => key.split('|')[1])]);
      for (const klasse of classes) {
        problems.equal(qualitaet.klassen[year][klasse] ?? 0, 'qualitaet.json', sumOf(`q|${klasse}|${year}`), 'Summe der Ausgabetitel', `Qualitätsklasse ${klasse} ${year}`);
      }
    }
  }
  problems.equal(qualitaet.pruefstand?.bestanden, 'qualitaet.json bestanden', (qualitaet.pruefungen ?? []).filter((entry) => entry.ok === true).length, 'Prüfungsliste', 'Prüfstand');
  problems.equal(qualitaet.pruefstand?.gesamt, 'qualitaet.json gesamt', (qualitaet.pruefungen ?? []).length, 'Prüfungsliste', 'Prüfstand');
  for (const entry of qualitaet.pruefungen ?? []) {
    if (entry.ok !== true) problems.add(`qualitaet.json: Prüfung „${entry.name}“ ist nicht bestanden`);
  }

  // Projekte ↔ Titel
  const projektIds = new Set();
  const projektVonTitel = new Map();
  for (const projekt of projekte) {
    if (projektIds.has(projekt.id)) problems.add(`projekte.json: Projekt ${projekt.id} doppelt`);
    projektIds.add(projekt.id);
    checkYearMap(projekt.jahre, `projekte.json ${projekt.id}`);
    for (const reference of projekt.titel ?? []) {
      const konzeptId = nummern.get(`${reference.kapitel}/${reference.titel}`);
      if (!konzeptId || konzeptId !== reference.konzept_id) {
        problems.add(`projekte.json ${projekt.id}: Titel ${reference.kapitel}/${reference.titel} existiert nicht im Snapshot`);
        continue;
      }
      if (projektVonTitel.has(konzeptId)) problems.add(`projekte.json: Titel ${reference.kapitel}/${reference.titel} ist mehreren Projekten zugeordnet`);
      projektVonTitel.set(konzeptId, projekt.id);
    }
  }
  for (const [konzeptId, projektId] of titelProjekt) {
    if (projektVonTitel.get(konzeptId) !== projektId) problems.add(`Titel ${konzeptId}: projekt_id ${projektId} ohne passenden Bezug in projekte.json`);
  }
  for (const [konzeptId, projektId] of projektVonTitel) {
    if (titelProjekt.get(konzeptId) !== projektId) problems.add(`projekte.json ${projektId}: Titel ${konzeptId} trägt keine passende projekt_id`);
  }

  // Jahre in Finanzierung
  const finanzierung = data.get('finanzierung.json');
  for (const massnahme of finanzierung.massnahmen ?? []) {
    for (const year of yearKeys) {
      if (!massnahme.jahre?.[year]) problems.add(`finanzierung.json ${massnahme.id}: Haushaltsjahr ${year} fehlt`);
    }
  }
  for (const row of finanzierung.finanzplan ?? []) {
    const haushaltsjahr = years.includes(row.jahr);
    if (!haushaltsjahr && !/Projektion/u.test(String(row.status))) problems.add(`finanzierung.json finanzplan ${row.jahr}: Folgejahr ohne Kennzeichnung als Projektion`);
  }

  pruefeQuerverweise(problems, { manifest, years, gesamtplan, projekte, finanzierung, data, nummern, titelEintraege, sumOf });
  return problems.problems;
}

/**
 * Querbezüge, die der Import gegen die Quelle prüft, hier allein aus dem Snapshot: rechnerische
 * Identitäten, Gesamtplan ↔ Finanzplanung ↔ Rücklagen ↔ Personalreform, Projektsummen und
 * Fondsbezüge gegen die Befunde im import-manifest.json, Verpflichtungen, Restansätze und die
 * Kapitelwirkung der Personalreform gegen die Titel.
 */
function pruefeQuerverweise(problems, context) {
  const { manifest, years, gesamtplan, projekte, finanzierung, data, nummern, titelEintraege, sumOf } = context;
  const ruecklagen = data.get('ruecklagen.json');
  const personal = data.get('personal.json');
  const qualitaet = data.get('qualitaet.json');
  const reformwirkungJahre = personal.reformwirkung?.jahre ?? [];
  const kapitelwirkung = personal.kapitelwirkung ?? [];

  pruefeRechenidentitaeten(problems, {
    massnahmen: finanzierung.massnahmen,
    kreditfinanzierungsplan: finanzierung.kreditfinanzierungsplan,
    allgemeineRuecklage: ruecklagen.allgemeine_ruecklage,
    stellen: personal.stellen?.kapitel,
    reformwirkungJahre,
    kapitelwirkung,
  }, {
    massnahmen: 'finanzierung.json massnahmen',
    kreditfinanzierungsplan: 'finanzierung.json kreditfinanzierungsplan',
    ruecklage: 'ruecklagen.json allgemeine_ruecklage',
    stellen: 'personal.json stellen',
    reformwirkung: 'personal.json reformwirkung',
    kapitelwirkung: 'personal.json kapitelwirkung',
  });
  pruefeQuerbezuege(problems, {
    years,
    gesamtplanJahre: gesamtplan.jahre,
    finanzplan: finanzierung.finanzplan,
    kreditfinanzierungsplan: finanzierung.kreditfinanzierungsplan,
    allgemeineRuecklage: ruecklagen.allgemeine_ruecklage,
    reformwirkungJahre,
    komponenten: personal.reformwirkung?.komponenten,
  }, {
    gesamtplan: 'gesamtplan.json',
    finanzplan: 'finanzierung.json finanzplan',
    kreditfinanzierungsplan: 'finanzierung.json kreditfinanzierungsplan',
    ruecklage: 'ruecklagen.json allgemeine_ruecklage',
    reformwirkung: 'personal.json reformwirkung',
    komponenten: 'personal.json reformwirkung.komponenten',
  });

  // Projektsummen: Abweichungen müssen exakt den im Manifest verzeichneten Befunden entsprechen.
  const befund = (kennung) => (manifest.befunde ?? []).find((entry) => entry.kennung === kennung);
  const projektsummen = projektsummenAbweichungen(projekte, years, (konzeptId, year) => {
    const entry = titelEintraege.get(konzeptId);
    const values = entry?.jahre?.[String(year)];
    return values ? { seite: entry.seite, betrag: values.betrag } : null;
  });
  const projektBefund = befund('projektsummen');
  if (!projektBefund) problems.add(`${MANIFEST_FILE}: Befund „projektsummen“ fehlt`);
  else {
    problems.check(
      deepEqual(projektBefund.abweichungen, projektsummen),
      () => `projekte.json: Projektbeträge weichen von der Summe der referenzierten Titel ab, ohne dass ${MANIFEST_FILE} (Befund „projektsummen“) dies verzeichnet: ${JSON.stringify(projektsummen.slice(0, 5))}`,
    );
    problems.equal(projektBefund.geprueft, `${MANIFEST_FILE} projektsummen geprueft`, projekte.length, 'Anzahl der Projekte in projekte.json', 'Projektsummen');
  }

  // Fondsgegenposten: nicht auflösbare Einnahmetitel müssen als Befund verzeichnet sein.
  const titelnummern = new Set([...nummern.keys()].map((key) => key.split('/')[1]));
  const fehlend = fehlendeFondsEinnahmetitel(ruecklagen.fonds_gegenposten ?? [], years, titelnummern);
  const fondsBefund = befund('fonds-einnahmetitel');
  problems.check(
    deepEqual(fondsBefund?.abweichungen ?? [], fehlend),
    () => `ruecklagen.json: nicht auflösbare Einnahmetitel der Fondsgegenposten ${JSON.stringify(fehlend)} entsprechen nicht dem Befund „fonds-einnahmetitel“ im ${MANIFEST_FILE}`,
  );

  // Verpflichtungsermächtigungen verweisen auf vorhandene Titel und Projekte.
  const projektIds = new Set(projekte.map((projekt) => projekt.id));
  for (const [index, row] of (finanzierung.verpflichtungen ?? []).entries()) {
    if (!nummern.has(`${row.kapitel}/${row.titel}`)) problems.add(`finanzierung.json verpflichtungen[${index}]: Titel ${row.kapitel}/${row.titel} existiert nicht im Snapshot`);
    if (row.projekt && !projektIds.has(row.projekt)) problems.add(`finanzierung.json verpflichtungen[${index}]: Projekt ${row.projekt} existiert nicht`);
    for (const year of years) {
      if (!Number.isSafeInteger(row.ve?.[String(year)])) problems.add(`finanzierung.json verpflichtungen[${index}]: Verpflichtungsermächtigung ${year} fehlt`);
    }
  }

  // Größte Restansätze entsprechen den Titeln.
  for (const [index, row] of (qualitaet.groesste_restansaetze ?? []).entries()) {
    const entry = titelEintraege.get(nummern.get(`${row.kapitel}/${row.titel}`));
    const values = entry?.jahre?.[String(row.jahr)];
    if (!values) {
      problems.add(`qualitaet.json groesste_restansaetze[${index}]: Titel ${row.kapitel}/${row.titel} ${row.jahr} existiert nicht im Snapshot`);
      continue;
    }
    problems.equal(row.betrag, 'qualitaet.json groesste_restansaetze', values.betrag, `titel/${entry.kapitel.slice(0, 2)}.json`, `Restansatz ${row.kapitel}/${row.titel} ${row.jahr}`);
    problems.equal(values.qualitaet ?? entry.qualitaet, 'Qualitätsklasse', 'S_rest', 'erwartet', `Restansatz ${row.kapitel}/${row.titel}`);
  }

  // Kapitelwirkung der Personalreform: Nachher-Wert = Summe der Titel der Gruppe im Kapitel.
  for (const row of kapitelwirkung) {
    problems.equal(row.nachher, 'personal.json kapitelwirkung nachher', sumOf(`kg|${row.kapitel}|${row.gruppe}|${row.jahr}`), 'Summe der Titel der Gruppe', `Kapitelwirkung ${row.kapitel}/${row.gruppe} ${row.jahr}`);
  }

  // Rechtsstände: jede verwendete Kennung hat eine Bezeichnung.
  const rechtsstaende = new Set((personal.rechtsstaende ?? []).map((entry) => entry.code));
  for (const reihe of [...(personal.versorgung?.reihen ?? []), ...(personal.regimevergleich ?? [])]) {
    if (!rechtsstaende.has(reihe.rechtsstand)) problems.add(`personal.json: Rechtsstand ${reihe.rechtsstand} ohne Bezeichnung in rechtsstaende`);
  }
}
