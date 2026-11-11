import { parseCsv } from './csv.mjs';
import {
  AUSGABE_HAUPTGRUPPEN,
  EINNAHME_HAUPTGRUPPEN,
  HAUPTGRUPPEN,
  HaushaltError,
  ProblemCollector,
  SNAPSHOT_SCHEMA,
  compareCodes,
  decimalText,
  deepEqual,
  formatValue,
  parseBooleanField,
  parseDecimalField,
  parseIntegerField,
  requireInteger,
  sumBy,
} from './common.mjs';
import {
  fehlendeFondsEinnahmetitel,
  projektsummenAbweichungen,
  pruefeQuerbezuege,
  pruefeRechenidentitaeten,
} from './invarianten.mjs';
import {
  BESOLDUNG_RECHTSSTAENDE,
  GESETZ_DOKUMENT_REGELN,
  HERKUNFT_LEGENDE,
  QUALITAET_LEGENDE,
  QUELL_REPOSITORY,
} from './legenden.mjs';

/**
 * Prüft die Quelldaten der aktiven Fassung und überführt sie in das Snapshot-Schema
 * „haushalt-snapshot/1“. Es wird nichts neu berechnet: Summen dienen ausschließlich der
 * Prüfung; jeder übernommene Betrag stammt unverändert aus der Quelle.
 */

const TITEL_QUELLFELDER = [
  'id', 'konzept_id', 'jahr', 'einzelplan', 'kapitel', 'kapitel_bezeichnung', 'titel', 'titelgruppe',
  'zweckbestimmung', 'hauptgruppe', 'gruppe', 'gruppe_bezeichnung', 'funktion', 'seite', 'betrag_eur',
  'herkunft', 'qualitaet', 'datenstatus', 'bindung', 'rechtsgrundlage', 'finanzierung', 'projekt_id',
  've_eur', 'menge', 'einheit', 'satz_eur', 'berechnungsmethode', 'erlaeuterung', 'vermerk',
  'ursprung_konzept', 'ursprung_id', 'ursprung_betrag_eur', 'sn_vorbild', 'kennung',
];
/**
 * Interne Arbeitsfelder, die nicht übernommen werden. `berechnungsmethode` enthält
 * Modellierungs- und Arbeitsnotizen der Haushaltsaufstellung (Gewichte, Solver- und
 * Nachweisvermerke) und ist auch in der amtlichen Druckausgabe der Quelle nicht enthalten.
 */
const TITEL_INTERN = new Set(['ursprung_konzept', 'ursprung_id', 'ursprung_betrag_eur', 'sn_vorbild', 'kennung', 'berechnungsmethode']);
/** Strukturfelder, die zwischen den Jahren eines Titelkonzepts nicht abweichen dürfen. */
const TITEL_STRUKTUR = ['konzept_id', 'einzelplan', 'kapitel', 'kapitel_bezeichnung', 'titel', 'seite', 'hauptgruppe', 'gruppe', 'gruppe_bezeichnung'];
/** Beschreibende Felder (Reihenfolge der Ausgabe); variieren sie, wandern sie nach `jahre`. */
const TITEL_BESCHREIBEND = [
  'titelgruppe', 'zweckbestimmung', 'funktion', 'herkunft', 'qualitaet', 'bindung', 'rechtsgrundlage',
  'finanzierung', 'projekt_id', 'einheit', 'erlaeuterung', 'vermerk',
];
/** Stets jahresbezogene Felder mit ihren Snapshot-Namen. */
const TITEL_JAHRESWERTE = [
  ['id', 'id'],
  ['betrag_eur', 'betrag'],
  ['ve_eur', 've'],
  ['menge', 'menge'],
  ['satz_eur', 'satz'],
];

const PROJEKT_FELDER = new Set([
  'id', 'name', 'art', 'einzelplan', 'traeger', 'rechtsgrundlage', 'status', 'beschreibung', 'suchbegriffe',
  'titel', 'kapitel', 'folgejahre', 'folgejahre_investiv', 'gegenstand', 'hinweis_kredit', 'stueckzahl',
  'gesamtkosten_eur', 'bisher_gezahlt', 'unternehmensinvestition', 'projektkredit',
]);

function header(periode) {
  return { schema: SNAPSHOT_SCHEMA, periode };
}

function yearMap(years, build) {
  const result = {};
  for (const year of years) result[String(year)] = build(year);
  return result;
}

function isEmpty(value) {
  return value === null || value === undefined || value === '';
}

function sameAsCsv(jsonValue, csvValue) {
  if (jsonValue === null || jsonValue === undefined) return csvValue === '';
  if (typeof jsonValue === 'boolean') return csvValue === (jsonValue ? 'True' : 'False');
  if (typeof jsonValue === 'number') {
    if (Number.isInteger(jsonValue)) return csvValue === String(jsonValue);
    return csvValue !== '' && Number(csvValue) === jsonValue;
  }
  if (typeof jsonValue === 'string') return csvValue === jsonValue;
  try {
    return deepEqual(jsonValue, JSON.parse(csvValue));
  } catch {
    return false;
  }
}

/** Vergleicht eine JSON-Liste mit der gleichnamigen CSV-Fassung Zeile für Zeile. */
function compareJsonWithCsv(problems, jsonRows, csv, label, fields) {
  if (!Array.isArray(jsonRows)) {
    problems.add(`${label}: JSON-Fassung ist keine Liste`);
    return;
  }
  if (jsonRows.length !== csv.records.length) {
    problems.add(`${label}: JSON-Fassung hat ${jsonRows.length}, CSV-Fassung ${csv.records.length} Zeilen`);
    return;
  }
  const columns = fields ?? csv.header;
  let reported = 0;
  jsonRows.forEach((row, index) => {
    for (const column of columns) {
      if (!sameAsCsv(row?.[column], csv.records[index][column])) {
        if (reported < 10) {
          problems.add(
            `${label}: Zeile ${index + 1}, Feld „${column}“: JSON ${formatValue(row?.[column])}, CSV ${JSON.stringify(csv.records[index][column])}`,
          );
        }
        reported += 1;
      }
    }
  });
  if (reported > 10) problems.add(`${label}: insgesamt ${reported} abweichende Felder`);
}

function requireColumns(csv, expected, label, { allowExtra = false } = {}) {
  const missing = expected.filter((column) => !csv.header.includes(column));
  if (missing.length > 0) {
    throw new HaushaltError(`${label}: Spalten fehlen: ${missing.join(', ')}`);
  }
  if (!allowExtra) {
    const extra = csv.header.filter((column) => !expected.includes(column));
    if (extra.length > 0) {
      throw new HaushaltError(`${label}: unbekannte Spalten ${extra.join(', ')} – der Import muss erst um ihre Einordnung ergänzt werden`);
    }
  }
}

function yearColumns(header, prefix) {
  const pattern = new RegExp(`^${prefix}_(\\d{4})$`, 'u');
  return header
    .map((column) => column.match(pattern))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((left, right) => left - right);
}

function splitHauptgruppen(record, suffix, label) {
  const result = {};
  for (const hg of HAUPTGRUPPEN) {
    result[hg] = parseIntegerField(record[`hg${hg}${suffix}`], `${label} hg${hg}${suffix}`);
  }
  return result;
}

function titleReference(reference, label) {
  const match = /^(\d{4})\/(\d{3}) (\d{2})$/u.exec(reference);
  if (!match) throw new HaushaltError(`${label}: Titelbezug „${reference}“ hat nicht die Form KKKK/GGG NN`);
  return { kapitel: match[1], titel: `${match[2]}${match[3]}` };
}

/**
 * @param {object} context
 * @returns {{ dateien: Map<string, string|Buffer>, artefaktKandidaten: any[], befunde: any[], kontrollsummen: any, quelle: any, ausschluesse: any[], jahresfelder: string[] }}
 */
export function transformSource(context) {
  const { active, files, manifest, datenManifest, baseline, gitState } = context;
  const periode = active.periode;
  const years = active.jahre;
  const yearKeys = years.map(String);
  const problems = new ProblemCollector();
  const befunde = [];
  const ausschluesse = [];

  const sourceLabel = (relative) => `${active.pfad}/${relative}`;
  const raw = (relative) => {
    const entry = files.get(relative);
    if (!entry) {
      throw new HaushaltError(`Benötigte Quelldatei ${sourceLabel(relative)} ist in MANIFEST.json nicht verzeichnet.`);
    }
    return entry.buffer;
  };
  const json = (relative) => {
    try {
      return JSON.parse(raw(relative).toString('utf8'));
    } catch (error) {
      if (error instanceof HaushaltError) throw error;
      throw new HaushaltError(`${sourceLabel(relative)}: ungültiges JSON (${error.message})`);
    }
  };
  const csv = (relative) => parseCsv(raw(relative).toString('utf8'), sourceLabel(relative));

  // -----------------------------------------------------------------------------------------
  // Metadaten und Fassungskennungen

  const meta = json('daten/meta.json');
  const korrekturen = json('daten/korrekturen.json');
  problems.equal(meta.fassung, 'daten/meta.json fassung', active.fassung, 'haushalt/VERSIONEN.json aktiv', 'Fassung');
  problems.equal(manifest.fassung, 'MANIFEST.json fassung', active.fassung, 'haushalt/VERSIONEN.json aktiv', 'Fassung');
  problems.equal(datenManifest.fassung, 'daten/manifest.json fassung', active.fassung, 'haushalt/VERSIONEN.json aktiv', 'Fassung');
  problems.equal(manifest.basisrun, 'MANIFEST.json basisrun', meta.basisrun, 'daten/meta.json basisrun', 'Finanzrahmen');
  problems.equal(datenManifest.basisrun, 'daten/manifest.json basisrun', meta.basisrun, 'daten/meta.json basisrun', 'Finanzrahmen');
  if (active.finanzrahmen !== null) {
    problems.equal(active.finanzrahmen, 'haushalt/VERSIONEN.json finanzrahmen', meta.basisrun, 'daten/meta.json basisrun', 'Finanzrahmen');
  }
  problems.equal(manifest.stand, 'MANIFEST.json stand', meta.stand, 'daten/meta.json stand', 'Datenstand');
  if (typeof meta.stand !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(meta.stand)) {
    problems.add(`daten/meta.json: stand „${meta.stand}“ ist kein Datum JJJJ-MM-TT`);
  }
  for (const [label, map] of [['daten/meta.json haushaltsvolumen', meta.haushaltsvolumen], ['MANIFEST.json haushaltsvolumen', manifest.haushaltsvolumen]]) {
    const keys = map && typeof map === 'object' ? Object.keys(map).sort() : [];
    if (!deepEqual(keys, yearKeys)) problems.add(`${label}: Jahre ${keys.join(', ')} statt ${yearKeys.join(', ')}`);
  }
  for (const year of yearKeys) {
    problems.equal(manifest.haushaltsvolumen?.[year], 'MANIFEST.json', meta.haushaltsvolumen?.[year], 'daten/meta.json', `Haushaltsvolumen ${year}`);
  }

  const quellstatusMatch = /(Regierungsentwurf|Arbeitsentwurf|Beschlussfassung|beschlossen)/u.exec(String(meta.bezeichnung ?? ''));
  if (!quellstatusMatch) {
    problems.add(`daten/meta.json: Aus der Bezeichnung „${meta.bezeichnung}“ lässt sich kein Quellstatus ablesen`);
  }

  if (!Array.isArray(korrekturen)) throw new HaushaltError('daten/korrekturen.json: keine Liste von Korrekturvorlagen');
  const aktiveKorrekturen = korrekturen.filter((entry) => entry.aktiv === true);
  problems.check(
    deepEqual(aktiveKorrekturen.map((entry) => entry.id), meta.korrekturvorlagen),
    () => `Korrekturvorlagen: daten/meta.json nennt ${JSON.stringify(meta.korrekturvorlagen)}, daten/korrekturen.json als aktiv ${JSON.stringify(aktiveKorrekturen.map((entry) => entry.id))}`,
  );

  const pruefstandMatch = /^(\d+)\/(\d+)$/u.exec(String(manifest.pruefungen ?? ''));
  if (!pruefstandMatch) problems.add(`MANIFEST.json: Prüfstand „${manifest.pruefungen}“ hat nicht die Form bestanden/gesamt`);

  // -----------------------------------------------------------------------------------------
  // Gesamtplan

  const gesamtplanQuelle = json('daten/gesamtplan.json');
  if (!Array.isArray(gesamtplanQuelle)) throw new HaushaltError('daten/gesamtplan.json: keine Liste von Jahreszeilen');
  const gesamtplanJahre = {};
  const gesamtplanJahreQuelle = gesamtplanQuelle.map((row) => row?.jahr);
  if (!deepEqual(gesamtplanJahreQuelle, years)) {
    throw new HaushaltError(`daten/gesamtplan.json: Jahre ${JSON.stringify(gesamtplanJahreQuelle)} statt ${JSON.stringify(years)}`);
  }
  for (const row of gesamtplanQuelle) {
    const year = String(row.jahr);
    const values = {};
    const hauptgruppen = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === 'jahr') continue;
      requireInteger(value, `daten/gesamtplan.json ${year}.${key}`);
      const hg = /^hg(\d)$/u.exec(key);
      if (hg) hauptgruppen[hg[1]] = value;
      else values[key] = value;
    }
    if (!deepEqual(Object.keys(hauptgruppen).sort(), HAUPTGRUPPEN)) {
      problems.add(`daten/gesamtplan.json ${year}: Hauptgruppen 0–9 unvollständig`);
    }
    for (const required of ['einnahmen', 'ausgaben', 'haushaltsvolumen']) {
      if (!(required in values)) problems.add(`daten/gesamtplan.json ${year}: Feld ${required} fehlt`);
    }
    values.hauptgruppen = hauptgruppen;
    gesamtplanJahre[year] = values;

    problems.equal(values.haushaltsvolumen, 'daten/gesamtplan.json', meta.haushaltsvolumen?.[year], 'daten/meta.json', `Haushaltsvolumen ${year}`);
    problems.equal(sumBy(EINNAHME_HAUPTGRUPPEN, (hg) => hauptgruppen[hg]), 'Summe der Hauptgruppen 0–3', values.einnahmen, 'daten/gesamtplan.json einnahmen', `Gesamtplan ${year}`);
    problems.equal(sumBy(AUSGABE_HAUPTGRUPPEN, (hg) => hauptgruppen[hg]), 'Summe der Hauptgruppen 4–9', values.ausgaben, 'daten/gesamtplan.json ausgaben', `Gesamtplan ${year}`);
    problems.equal(values.ausgaben, 'daten/gesamtplan.json ausgaben', values.haushaltsvolumen, 'daten/gesamtplan.json haushaltsvolumen', `Gesamtplan ${year}`);
    problems.equal(values.einnahmen + (values.ungedeckt ?? 0), 'Einnahmen + ausgewiesene Deckungslücke', values.ausgaben, 'Ausgaben', `Gesamtplan ${year}`);
    if (values.haushaltsvolumen_baseline !== undefined) {
      problems.equal(values.haushaltsvolumen_baseline, 'daten/gesamtplan.json haushaltsvolumen_baseline', meta.haushaltsvolumen_baseline?.[year], 'daten/meta.json haushaltsvolumen_baseline', `Basisvolumen ${year}`);
    }
    if (baseline?.haushaltsvolumen_eur) {
      problems.equal(meta.haushaltsvolumen_baseline?.[year], 'daten/meta.json haushaltsvolumen_baseline', baseline.haushaltsvolumen_eur[year], 'BASELINE.json haushaltsvolumen_eur', `Basisvolumen ${year}`);
    }
  }

  // Gruppierung und Funktionen
  const gruppierungCsv = csv('daten/gruppierung.csv');
  requireColumns(gruppierungCsv, ['hauptgruppe', 'obergruppe', 'gruppe', 'bezeichnung', ...years.map((year) => `betrag_${year}`)], 'daten/gruppierung.csv');
  const gruppierung = gruppierungCsv.records.map((record, index) => {
    const label = `daten/gruppierung.csv Zeile ${index + 1}`;
    if (!/^\d$/u.test(record.hauptgruppe) || !/^\d{2}$/u.test(record.obergruppe) || !/^\d{3}$/u.test(record.gruppe)) {
      problems.add(`${label}: Gliederungsschlüssel ${record.hauptgruppe}/${record.obergruppe}/${record.gruppe} ungültig`);
    }
    if (!record.gruppe.startsWith(record.obergruppe) || !record.obergruppe.startsWith(record.hauptgruppe)) {
      problems.add(`${label}: Gruppe ${record.gruppe} passt nicht zu Obergruppe ${record.obergruppe} bzw. Hauptgruppe ${record.hauptgruppe}`);
    }
    return {
      hauptgruppe: record.hauptgruppe,
      obergruppe: record.obergruppe,
      gruppe: record.gruppe,
      bezeichnung: record.bezeichnung,
      jahre: yearMap(years, (year) => parseIntegerField(record[`betrag_${year}`], `${label} betrag_${year}`)),
    };
  });
  const gruppenIndex = new Map();
  for (const row of gruppierung) {
    if (gruppenIndex.has(row.gruppe)) problems.add(`daten/gruppierung.csv: Gruppe ${row.gruppe} doppelt`);
    gruppenIndex.set(row.gruppe, row);
  }
  for (const year of yearKeys) {
    for (const hg of HAUPTGRUPPEN) {
      problems.equal(
        sumBy(gruppierung.filter((row) => row.hauptgruppe === hg), (row) => row.jahre[year]),
        `Summe daten/gruppierung.csv`,
        gesamtplanJahre[year].hauptgruppen[hg],
        'daten/gesamtplan.json',
        `Hauptgruppe ${hg} ${year}`,
      );
    }
  }

  const funktionenCsv = csv('daten/funktionen.csv');
  requireColumns(funktionenCsv, ['hauptfunktion', 'hauptfunktion_bezeichnung', 'funktion', 'bezeichnung', ...years.map((year) => `ausgaben_${year}`)], 'daten/funktionen.csv');
  const funktionen = funktionenCsv.records.map((record, index) => {
    const label = `daten/funktionen.csv Zeile ${index + 1}`;
    if (!/^\d{3}$/u.test(record.funktion) || !record.funktion.startsWith(record.hauptfunktion)) {
      problems.add(`${label}: Funktion ${record.funktion} passt nicht zur Hauptfunktion ${record.hauptfunktion}`);
    }
    return {
      hauptfunktion: record.hauptfunktion,
      hauptfunktion_bezeichnung: record.hauptfunktion_bezeichnung,
      funktion: record.funktion,
      bezeichnung: record.bezeichnung,
      jahre: yearMap(years, (year) => parseIntegerField(record[`ausgaben_${year}`], `${label} ausgaben_${year}`)),
    };
  });
  const funktionIndex = new Map();
  for (const row of funktionen) {
    if (funktionIndex.has(row.funktion)) problems.add(`daten/funktionen.csv: Funktion ${row.funktion} doppelt`);
    funktionIndex.set(row.funktion, row);
  }
  for (const year of yearKeys) {
    problems.equal(sumBy(funktionen, (row) => row.jahre[year]), 'Summe daten/funktionen.csv', gesamtplanJahre[year].ausgaben, 'daten/gesamtplan.json ausgaben', `Funktionenplan ${year}`);
  }

  // -----------------------------------------------------------------------------------------
  // Einzelpläne und Kapitel

  const epCsv = csv('daten/einzelplaene.csv');
  const epColumns = ['ep', 'bezeichnung', 'ressort', 'kapitel', 'titel'];
  for (const year of years) epColumns.push(`einnahmen_${year}`, `ausgaben_${year}`, ...HAUPTGRUPPEN.map((hg) => `hg${hg}_${year}`));
  requireColumns(epCsv, epColumns, 'daten/einzelplaene.csv');

  const kapitelCsv = csv('daten/kapitel.csv');
  const kapitelColumns = ['kapitel', 'einzelplan', 'bezeichnung', 'funktion', 'funktion_bezeichnung', 'titel'];
  for (const year of years) kapitelColumns.push(`einnahmen_${year}`, `ausgaben_${year}`, `rest_${year}`, ...HAUPTGRUPPEN.map((hg) => `hg${hg}_${year}`));
  requireColumns(kapitelCsv, kapitelColumns, 'daten/kapitel.csv');

  const kapitel = kapitelCsv.records.map((record, index) => {
    const label = `daten/kapitel.csv Kapitel ${record.kapitel}`;
    if (!/^\d{4}$/u.test(record.kapitel) || record.kapitel.slice(0, 2) !== record.einzelplan) {
      problems.add(`daten/kapitel.csv Zeile ${index + 1}: Kapitel ${record.kapitel} gehört nicht zu Einzelplan ${record.einzelplan}`);
    }
    const entry = {
      kapitel: record.kapitel,
      einzelplan: record.einzelplan,
      bezeichnung: record.bezeichnung,
      funktion: record.funktion,
      funktion_bezeichnung: record.funktion_bezeichnung,
      titelanzahl: parseIntegerField(record.titel, `${label} titel`),
      jahre: yearMap(years, (year) => ({
        einnahmen: parseIntegerField(record[`einnahmen_${year}`], `${label} einnahmen_${year}`),
        ausgaben: parseIntegerField(record[`ausgaben_${year}`], `${label} ausgaben_${year}`),
        rest: parseIntegerField(record[`rest_${year}`], `${label} rest_${year}`),
        hauptgruppen: splitHauptgruppen(record, `_${year}`, label),
      })),
    };
    const funktion = funktionIndex.get(record.funktion);
    if (!funktion) problems.add(`${label}: Funktion ${record.funktion} fehlt im Funktionenplan`);
    else problems.equal(record.funktion_bezeichnung, 'daten/kapitel.csv', funktion.bezeichnung, 'daten/funktionen.csv', `${label} Funktionsbezeichnung`);
    return entry;
  });
  kapitel.sort((left, right) => compareCodes(left.kapitel, right.kapitel));
  const kapitelIndex = new Map();
  for (const entry of kapitel) {
    if (kapitelIndex.has(entry.kapitel)) problems.add(`daten/kapitel.csv: Kapitel ${entry.kapitel} doppelt`);
    kapitelIndex.set(entry.kapitel, entry);
  }

  const einzelplaene = epCsv.records.map((record) => {
    const label = `daten/einzelplaene.csv Einzelplan ${record.ep}`;
    if (!/^\d{2}$/u.test(record.ep)) problems.add(`${label}: Einzelplannummer ist nicht zweistellig`);
    const planKapitel = kapitel.filter((entry) => entry.einzelplan === record.ep);
    const entry = {
      ep: record.ep,
      bezeichnung: record.bezeichnung,
      ressort: record.ressort,
      kapitel: planKapitel.map((item) => item.kapitel),
      kapitelanzahl: parseIntegerField(record.kapitel, `${label} kapitel`),
      titelanzahl: parseIntegerField(record.titel, `${label} titel`),
      jahre: yearMap(years, (year) => ({
        einnahmen: parseIntegerField(record[`einnahmen_${year}`], `${label} einnahmen_${year}`),
        ausgaben: parseIntegerField(record[`ausgaben_${year}`], `${label} ausgaben_${year}`),
        hauptgruppen: splitHauptgruppen(record, `_${year}`, label),
      })),
    };
    problems.equal(entry.kapitelanzahl, 'daten/einzelplaene.csv kapitel', planKapitel.length, 'Kapitel laut daten/kapitel.csv', label);
    problems.equal(entry.titelanzahl, 'daten/einzelplaene.csv titel', sumBy(planKapitel, (item) => item.titelanzahl), 'Summe der Kapitel-Titelanzahlen', label);
    for (const year of yearKeys) {
      const values = entry.jahre[year];
      problems.equal(sumBy(EINNAHME_HAUPTGRUPPEN, (hg) => values.hauptgruppen[hg]), 'Summe HG 0–3', values.einnahmen, 'einnahmen', `${label} ${year}`);
      problems.equal(sumBy(AUSGABE_HAUPTGRUPPEN, (hg) => values.hauptgruppen[hg]), 'Summe HG 4–9', values.ausgaben, 'ausgaben', `${label} ${year}`);
      for (const field of ['einnahmen', 'ausgaben']) {
        problems.equal(sumBy(planKapitel, (item) => item.jahre[year][field]), 'Summe der Kapitel', values[field], `daten/einzelplaene.csv ${field}`, `${label} ${year}`);
      }
      for (const hg of HAUPTGRUPPEN) {
        problems.equal(sumBy(planKapitel, (item) => item.jahre[year].hauptgruppen[hg]), 'Summe der Kapitel', values.hauptgruppen[hg], 'daten/einzelplaene.csv', `${label} ${year} Hauptgruppe ${hg}`);
      }
    }
    return entry;
  });
  einzelplaene.sort((left, right) => compareCodes(left.ep, right.ep));
  const epIndex = new Map();
  for (const entry of einzelplaene) {
    if (epIndex.has(entry.ep)) problems.add(`daten/einzelplaene.csv: Einzelplan ${entry.ep} doppelt`);
    epIndex.set(entry.ep, entry);
  }
  for (const entry of kapitel) {
    if (!epIndex.has(entry.einzelplan)) problems.add(`daten/kapitel.csv: Kapitel ${entry.kapitel} verweist auf unbekannten Einzelplan ${entry.einzelplan}`);
    for (const year of yearKeys) {
      const values = entry.jahre[year];
      problems.equal(sumBy(EINNAHME_HAUPTGRUPPEN, (hg) => values.hauptgruppen[hg]), 'Summe HG 0–3', values.einnahmen, 'einnahmen', `Kapitel ${entry.kapitel} ${year}`);
      problems.equal(sumBy(AUSGABE_HAUPTGRUPPEN, (hg) => values.hauptgruppen[hg]), 'Summe HG 4–9', values.ausgaben, 'ausgaben', `Kapitel ${entry.kapitel} ${year}`);
    }
  }
  for (const year of yearKeys) {
    for (const field of ['einnahmen', 'ausgaben']) {
      problems.equal(sumBy(einzelplaene, (item) => item.jahre[year][field]), 'Summe der Einzelpläne', gesamtplanJahre[year][field], `daten/gesamtplan.json ${field}`, `Gesamtplan ${year}`);
    }
    for (const hg of HAUPTGRUPPEN) {
      problems.equal(sumBy(einzelplaene, (item) => item.jahre[year].hauptgruppen[hg]), 'Summe der Einzelpläne', gesamtplanJahre[year].hauptgruppen[hg], 'daten/gesamtplan.json', `Gesamtplan ${year} Hauptgruppe ${hg}`);
    }
  }

  problems.throwIfAny('Gesamtplan, Einzelpläne und Kapitel sind nicht widerspruchsfrei:');

  // -----------------------------------------------------------------------------------------
  // Titel

  const titelJson = json('daten/titel.json');
  const titelCsv = csv('daten/titel.csv');
  if (!Array.isArray(titelJson)) throw new HaushaltError('daten/titel.json: keine Liste von Titeln');
  if (!deepEqual(titelCsv.header, TITEL_QUELLFELDER)) {
    const unknown = titelCsv.header.filter((field) => !TITEL_QUELLFELDER.includes(field));
    const missing = TITEL_QUELLFELDER.filter((field) => !titelCsv.header.includes(field));
    throw new HaushaltError(`daten/titel.csv: Spalten weichen vom bekannten Titelschema ab (unbekannt: ${unknown.join(', ') || '–'}; fehlend: ${missing.join(', ') || '–'})`);
  }
  titelJson.forEach((row, index) => {
    const keys = Object.keys(row ?? {});
    if (!deepEqual(keys, TITEL_QUELLFELDER)) {
      throw new HaushaltError(`daten/titel.json: Eintrag ${index + 1} (${row?.id}) weicht vom bekannten Titelschema ab`);
    }
  });
  compareJsonWithCsv(problems, titelJson, titelCsv, 'daten/titel.json ↔ daten/titel.csv');
  problems.throwIfAny('daten/titel.json und daten/titel.csv stimmen nicht überein:');

  const legendeHerkunft = new Set(HERKUNFT_LEGENDE.map((entry) => entry.kennung));
  const legendeQualitaet = new Set(QUALITAET_LEGENDE.map((entry) => entry.kennung));
  const titelIds = new Set();
  const konzepte = new Map();
  const datenstatus = new Set();
  for (const row of titelJson) {
    const label = `Titel ${row.id}`;
    if (titelIds.has(row.id)) problems.add(`${label}: ID doppelt`);
    titelIds.add(row.id);
    if (!years.includes(row.jahr)) problems.add(`${label}: Jahr ${row.jahr} liegt außerhalb der Periode ${periode}`);
    if (row.id !== `${row.konzept_id}@${row.jahr}`) problems.add(`${label}: ID entspricht nicht <konzept_id>@<jahr>`);
    if (!/^\d{5}$/u.test(row.titel)) problems.add(`${label}: Titelnummer „${row.titel}“ ist nicht fünfstellig`);
    if (row.kapitel.slice(0, 2) !== row.einzelplan) problems.add(`${label}: Kapitel ${row.kapitel} gehört nicht zu Einzelplan ${row.einzelplan}`);
    if (String(row.hauptgruppe) !== row.gruppe[0] || row.titel.slice(0, 3) !== row.gruppe) {
      problems.add(`${label}: Titel ${row.titel}, Gruppe ${row.gruppe} und Hauptgruppe ${row.hauptgruppe} passen nicht zusammen`);
    }
    const einnahme = EINNAHME_HAUPTGRUPPEN.includes(String(row.hauptgruppe));
    if (row.seite !== (einnahme ? 'Einnahme' : 'Ausgabe')) problems.add(`${label}: Seite „${row.seite}“ passt nicht zur Hauptgruppe ${row.hauptgruppe}`);
    try {
      requireInteger(row.betrag_eur, `${label} betrag_eur`);
      if (row.ve_eur !== null) requireInteger(row.ve_eur, `${label} ve_eur`);
    } catch (error) {
      problems.add(error.message);
    }
    if (row.betrag_eur < 0) problems.add(`${label}: negativer Ansatz ${formatValue(row.betrag_eur)}`);
    if (!legendeHerkunft.has(row.herkunft)) problems.add(`${label}: Herkunft „${row.herkunft}“ ist nicht eingeordnet`);
    if (!legendeQualitaet.has(row.qualitaet)) problems.add(`${label}: Qualitätsklasse „${row.qualitaet}“ ist nicht eingeordnet`);
    const kapitelEntry = kapitelIndex.get(row.kapitel);
    if (!kapitelEntry) problems.add(`${label}: Kapitel ${row.kapitel} fehlt in daten/kapitel.csv`);
    else problems.equal(row.kapitel_bezeichnung, 'daten/titel.json', kapitelEntry.bezeichnung, 'daten/kapitel.csv', `${label} Kapitelbezeichnung`);
    const gruppe = gruppenIndex.get(row.gruppe);
    if (!gruppe) problems.add(`${label}: Gruppe ${row.gruppe} fehlt in daten/gruppierung.csv`);
    else problems.equal(row.gruppe_bezeichnung, 'daten/titel.json', gruppe.bezeichnung, 'daten/gruppierung.csv', `${label} Gruppenbezeichnung`);
    if (!funktionIndex.has(row.funktion)) problems.add(`${label}: Funktion ${row.funktion} fehlt in daten/funktionen.csv`);
    datenstatus.add(row.datenstatus);
    const group = konzepte.get(row.konzept_id) ?? new Map();
    if (group.has(row.jahr)) problems.add(`Titelkonzept ${row.konzept_id}: Jahr ${row.jahr} doppelt`);
    group.set(row.jahr, row);
    konzepte.set(row.konzept_id, group);
  }
  problems.throwIfAny('Die Titeldaten sind nicht widerspruchsfrei:');

  // Jedes Konzept in beiden Jahren; Kapitel/Titel-Nummer je Jahr eindeutig.
  const titelNummern = new Map();
  for (const [konzeptId, group] of konzepte) {
    for (const year of years) {
      if (!group.has(year)) problems.add(`Titelkonzept ${konzeptId}: Jahr ${year} fehlt`);
    }
    const first = group.get(years[0]);
    if (!first) continue;
    for (const field of TITEL_STRUKTUR) {
      for (const year of years.slice(1)) {
        const other = group.get(year);
        if (other && other[field] !== first[field]) {
          problems.add(`Titelkonzept ${konzeptId}: Strukturfeld ${field} weicht zwischen ${years[0]} (${formatValue(first[field])}) und ${year} (${formatValue(other[field])}) ab`);
        }
      }
    }
    const key = `${first.kapitel}/${first.titel}`;
    if (titelNummern.has(key)) problems.add(`Titelnummer ${key} gehört zu mehreren Titelkonzepten (${titelNummern.get(key)}, ${konzeptId})`);
    titelNummern.set(key, konzeptId);
  }
  if (datenstatus.size !== 1) problems.add(`daten/titel.json: uneinheitlicher Datenstatus ${JSON.stringify([...datenstatus])}`);
  problems.throwIfAny('Die Titelkonzepte sind nicht widerspruchsfrei:');

  // Σ Titel = Kapitel (je Jahr, Seite, Hauptgruppe), Rest = Σ S_rest-Ausgaben
  const titelSummen = new Map();
  const add = (key, value) => titelSummen.set(key, (titelSummen.get(key) ?? 0) + value);
  for (const row of titelJson) {
    add(`k|${row.kapitel}|${row.jahr}|${row.seite}`, row.betrag_eur);
    add(`k|${row.kapitel}|${row.jahr}|hg${row.hauptgruppe}`, row.betrag_eur);
    if (row.qualitaet === 'S_rest' && row.seite === 'Ausgabe') add(`k|${row.kapitel}|${row.jahr}|rest`, row.betrag_eur);
    add(`g|${row.gruppe}|${row.jahr}`, row.betrag_eur);
    if (row.seite === 'Ausgabe') add(`f|${row.funktion}|${row.jahr}`, row.betrag_eur);
    add(`q|${row.qualitaet}|${row.jahr}|${row.seite}`, row.betrag_eur);
    add(`kg|${row.kapitel}|${row.gruppe}|${row.jahr}`, row.betrag_eur);
  }
  const sum = (key) => titelSummen.get(key) ?? 0;
  for (const entry of kapitel) {
    const konzeptAnzahl = [...konzepte.values()].filter((group) => group.get(years[0])?.kapitel === entry.kapitel).length;
    problems.equal(konzeptAnzahl, 'Titelkonzepte in daten/titel.json', entry.titelanzahl, 'daten/kapitel.csv titel', `Kapitel ${entry.kapitel}`);
    for (const year of years) {
      const values = entry.jahre[String(year)];
      problems.equal(sum(`k|${entry.kapitel}|${year}|Einnahme`), 'Summe der Einnahmetitel', values.einnahmen, 'daten/kapitel.csv', `Kapitel ${entry.kapitel} ${year} Einnahmen`);
      problems.equal(sum(`k|${entry.kapitel}|${year}|Ausgabe`), 'Summe der Ausgabetitel', values.ausgaben, 'daten/kapitel.csv', `Kapitel ${entry.kapitel} ${year} Ausgaben`);
      problems.equal(sum(`k|${entry.kapitel}|${year}|rest`), 'Summe der Restansätze (S_rest)', values.rest, 'daten/kapitel.csv rest', `Kapitel ${entry.kapitel} ${year}`);
      for (const hg of HAUPTGRUPPEN) {
        problems.equal(sum(`k|${entry.kapitel}|${year}|hg${hg}`), 'Summe der Titel', values.hauptgruppen[hg], 'daten/kapitel.csv', `Kapitel ${entry.kapitel} ${year} Hauptgruppe ${hg}`);
      }
    }
  }
  for (const row of gruppierung) {
    for (const year of years) {
      problems.equal(sum(`g|${row.gruppe}|${year}`), 'Summe der Titel', row.jahre[String(year)], 'daten/gruppierung.csv', `Gruppe ${row.gruppe} ${year}`);
    }
  }
  for (const row of funktionen) {
    for (const year of years) {
      problems.equal(sum(`f|${row.funktion}|${year}`), 'Summe der Ausgabetitel', row.jahre[String(year)], 'daten/funktionen.csv', `Funktion ${row.funktion} ${year}`);
    }
  }
  problems.throwIfAny('Die Titelsummen stimmen nicht mit Kapiteln, Gruppierung oder Funktionen überein:');

  // Jahresabhängige Felder bestimmen
  const variierend = new Set();
  for (const group of konzepte.values()) {
    const first = group.get(years[0]);
    for (const year of years.slice(1)) {
      const other = group.get(year);
      for (const field of TITEL_BESCHREIBEND) {
        if (!deepEqual(first[field], other[field])) variierend.add(field);
      }
    }
  }
  const jahresfelder = [
    ...TITEL_JAHRESWERTE.map(([, target]) => target),
    ...TITEL_BESCHREIBEND.filter((field) => variierend.has(field)),
  ];
  const kopfFelder = TITEL_BESCHREIBEND.filter((field) => !variierend.has(field));
  ausschluesse.push(
    { quelle: 'daten/titel.json', felder: ['berechnungsmethode'], grund: 'interne Berechnungs- und Modellierungsnotizen' },
    { quelle: 'daten/titel.json', felder: ['ursprung_konzept', 'ursprung_id', 'ursprung_betrag_eur', 'sn_vorbild', 'kennung'], grund: 'interne Arbeitsfelder der Haushaltsaufstellung' },
  );

  const titelNachPlan = new Map();
  for (const [konzeptId, group] of konzepte) {
    const first = group.get(years[0]);
    const entry = {
      konzept_id: konzeptId,
      kapitel: first.kapitel,
      titel: first.titel,
    };
    const put = (target, key, value) => {
      if (!isEmpty(value)) target[key] = value;
    };
    put(entry, 'titelgruppe', kopfFelder.includes('titelgruppe') ? first.titelgruppe : undefined);
    if (kopfFelder.includes('zweckbestimmung')) entry.zweckbestimmung = first.zweckbestimmung;
    entry.seite = first.seite;
    entry.hauptgruppe = String(first.hauptgruppe);
    entry.obergruppe = gruppenIndex.get(first.gruppe).obergruppe;
    entry.gruppe = first.gruppe;
    entry.gruppe_bezeichnung = first.gruppe_bezeichnung;
    for (const field of kopfFelder.filter((name) => !['titelgruppe', 'zweckbestimmung'].includes(name))) {
      put(entry, field, first[field]);
    }
    entry.jahre = yearMap(years, (year) => {
      const row = group.get(year);
      const values = { id: row.id, betrag: row.betrag_eur };
      if (row.ve_eur !== null) values.ve = row.ve_eur;
      if (row.menge !== null) {
        let menge = row.menge;
        if (menge && typeof menge === 'object' && !Array.isArray(menge)) {
          const keys = Object.keys(menge).sort();
          if (!deepEqual(keys, yearKeys)) {
            throw new HaushaltError(`Titel ${row.id}: Mengenangabe nach Jahren ${JSON.stringify(menge)} passt nicht zur Periode`);
          }
          menge = menge[String(year)];
        }
        values.menge = decimalText(menge, `Titel ${row.id} menge`);
      }
      if (row.satz_eur !== null) values.satz = decimalText(row.satz_eur, `Titel ${row.id} satz_eur`);
      for (const field of TITEL_BESCHREIBEND.filter((name) => variierend.has(name))) put(values, field, row[field]);
      return values;
    });
    const list = titelNachPlan.get(first.einzelplan) ?? [];
    list.push(entry);
    titelNachPlan.set(first.einzelplan, list);
  }
  for (const list of titelNachPlan.values()) {
    list.sort((left, right) => compareCodes(left.kapitel, right.kapitel) || compareCodes(left.titel, right.titel) || compareCodes(left.konzept_id, right.konzept_id));
  }
  for (const ep of titelNachPlan.keys()) {
    if (!epIndex.has(ep)) problems.add(`daten/titel.json: Titel verweisen auf unbekannten Einzelplan ${ep}`);
  }

  // -----------------------------------------------------------------------------------------
  // Projekte

  const projekteQuelle = json('daten/projekte.json');
  if (!Array.isArray(projekteQuelle)) throw new HaushaltError('daten/projekte.json: keine Liste von Projekten');
  const projektIds = new Set();
  const titelZuProjekt = new Map();
  const projekte = projekteQuelle.map((source) => {
    const label = `Projekt ${source.id}`;
    const unknown = Object.keys(source).filter((key) => !PROJEKT_FELDER.has(key) && !/^(kernhaushalt|einnahmen)_\d{4}$/u.test(key));
    if (unknown.length > 0) throw new HaushaltError(`${label}: unbekannte Felder ${unknown.join(', ')} – der Import muss erst um ihre Einordnung ergänzt werden`);
    if (typeof source.id !== 'string' || source.id === '') throw new HaushaltError('daten/projekte.json: Projekt ohne Kennung');
    if (projektIds.has(source.id)) problems.add(`${label}: Kennung doppelt`);
    projektIds.add(source.id);
    if (!epIndex.has(source.einzelplan)) problems.add(`${label}: Einzelplan ${source.einzelplan} unbekannt`);
    const titel = (source.titel ?? []).map((reference) => titleReference(reference, label));
    const titelBezuege = titel.map((reference) => {
      const konzeptId = titelNummern.get(`${reference.kapitel}/${reference.titel}`);
      if (!konzeptId) {
        problems.add(`${label}: Titel ${reference.kapitel}/${reference.titel} existiert nicht`);
      } else {
        if (titelZuProjekt.has(konzeptId)) problems.add(`${label}: Titel ${reference.kapitel}/${reference.titel} ist bereits Projekt ${titelZuProjekt.get(konzeptId)} zugeordnet`);
        titelZuProjekt.set(konzeptId, source.id);
      }
      return { kapitel: reference.kapitel, titel: reference.titel, konzept_id: konzeptId ?? null };
    });
    const kapitelListe = [...(source.kapitel ?? [])];
    const referenzKapitel = [...new Set(titel.map((reference) => reference.kapitel))].sort();
    if (!deepEqual([...kapitelListe].sort(), referenzKapitel)) {
      problems.add(`${label}: Kapitelliste ${JSON.stringify(kapitelListe)} entspricht nicht den Kapiteln der Titelbezüge ${JSON.stringify(referenzKapitel)}`);
    }
    const jahre = yearMap(years, (year) => ({
      kernhaushalt: requireInteger(source[`kernhaushalt_${year}`], `${label} kernhaushalt_${year}`),
      einnahmen: requireInteger(source[`einnahmen_${year}`], `${label} einnahmen_${year}`),
    }));
    const integerMap = (value, field) => {
      const result = {};
      for (const [key, amount] of Object.entries(value ?? {})) {
        if (!/^\d{4}$/u.test(key)) throw new HaushaltError(`${label} ${field}: Schlüssel ${key} ist kein Jahr`);
        result[key] = requireInteger(amount, `${label} ${field}.${key}`);
      }
      return result;
    };
    const entry = {
      id: source.id,
      name: source.name,
      art: source.art,
      einzelplan: source.einzelplan,
      status: source.status,
      traeger: source.traeger,
      rechtsgrundlage: source.rechtsgrundlage,
      beschreibung: source.beschreibung,
      suchbegriffe: [...(source.suchbegriffe ?? [])],
      kapitel: kapitelListe,
      titel: titelBezuege,
      jahre,
      folgejahre: integerMap(source.folgejahre, 'folgejahre'),
      folgejahre_investiv: integerMap(source.folgejahre_investiv, 'folgejahre_investiv'),
    };
    const zusatz = {};
    if (!isEmpty(source.gegenstand)) zusatz.gegenstand = source.gegenstand;
    if (source.stueckzahl !== undefined) zusatz.stueckzahl = requireInteger(source.stueckzahl, `${label} stueckzahl`);
    if (source.gesamtkosten_eur !== undefined) zusatz.gesamtkosten = requireInteger(source.gesamtkosten_eur, `${label} gesamtkosten_eur`);
    if (!isEmpty(source.bisher_gezahlt)) zusatz.bisher_gezahlt = source.bisher_gezahlt;
    if (!isEmpty(source.hinweis_kredit)) zusatz.hinweis_kredit = source.hinweis_kredit;
    if (source.unternehmensinvestition !== undefined) zusatz.unternehmensinvestition = integerMap(source.unternehmensinvestition, 'unternehmensinvestition');
    if (source.projektkredit !== undefined) zusatz.projektkredit = integerMap(source.projektkredit, 'projektkredit');
    if (Object.keys(zusatz).length > 0) entry.zusatz = zusatz;
    for (const field of ['name', 'art', 'status', 'traeger', 'rechtsgrundlage', 'beschreibung']) {
      if (typeof entry[field] !== 'string') problems.add(`${label}: Feld ${field} fehlt`);
    }
    return entry;
  });
  projekte.sort((left, right) => compareCodes(left.id, right.id));
  // Titel-seitige Projektkennung muss mit den Projektbezügen übereinstimmen.
  for (const [konzeptId, group] of konzepte) {
    const row = group.get(years[0]);
    const viaTitel = row.projekt_id || null;
    const viaProjekt = titelZuProjekt.get(konzeptId) ?? null;
    if (viaTitel !== viaProjekt) {
      problems.add(`Titel ${row.kapitel}/${row.titel}: projekt_id in daten/titel.json = ${formatValue(viaTitel)}, Bezug in daten/projekte.json = ${formatValue(viaProjekt)}`);
    }
    if (viaTitel && !projektIds.has(viaTitel)) problems.add(`Titel ${row.kapitel}/${row.titel}: Projekt ${viaTitel} existiert nicht`);
  }
  // Befund (keine Korrektur): Projektbeträge gegen die referenzierten Titel
  const projektsummenBefunde = projektsummenAbweichungen(projekte, years, (konzeptId, year) => {
    const row = konzepte.get(konzeptId)?.get(year);
    return row ? { seite: row.seite, betrag: row.betrag_eur } : null;
  });
  befunde.push({
    kennung: 'projektsummen',
    beschreibung: 'Abgleich der Projektbeträge (kernhaushalt_<jahr>, einnahmen_<jahr>) mit der Summe der referenzierten Ausgabe- bzw. Einnahmetitel; Abweichungen werden nicht korrigiert.',
    geprueft: projekte.length,
    abweichungen: projektsummenBefunde,
  });
  problems.throwIfAny('Projekte und Titel sind nicht widerspruchsfrei:');

  // -----------------------------------------------------------------------------------------
  // Finanzierung, Kreditfinanzierungsplan, Finanzplan, Verpflichtungen

  const finanzierungQuelle = json('daten/finanzierung.json');
  const massnahmenCsv = csv('daten/massnahmen.csv');
  requireColumns(massnahmenCsv, ['id', 'bezeichnung', 'jahr', 'einnahmen', 'einsparungen', 'kosten', 'nettoentlastung', 'bedingung', 'rechtsgrundlage', 'risiko', 'status'], 'daten/massnahmen.csv');
  compareJsonWithCsv(problems, finanzierungQuelle.massnahmen, massnahmenCsv, 'daten/finanzierung.json massnahmen ↔ daten/massnahmen.csv');
  const kfpCsv = csv('daten/kreditfinanzierungsplan.csv');
  compareJsonWithCsv(problems, finanzierungQuelle.kreditfinanzierungsplan, kfpCsv, 'daten/finanzierung.json kreditfinanzierungsplan ↔ daten/kreditfinanzierungsplan.csv');
  const finanzplanDateien = [...files.keys()].filter((path) => /^daten\/finanzplan_\d{4}_\d{4}\.csv$/u.test(path));
  if (finanzplanDateien.length !== 1) {
    throw new HaushaltError(`Erwartet genau eine Datei daten/finanzplan_JJJJ_JJJJ.csv, gefunden: ${finanzplanDateien.join(', ') || 'keine'}`);
  }
  const finanzplanCsv = csv(finanzplanDateien[0]);
  compareJsonWithCsv(problems, finanzierungQuelle.finanzplan, finanzplanCsv, `daten/finanzierung.json finanzplan ↔ ${finanzplanDateien[0]}`);
  problems.throwIfAny('Die Finanzierungsdaten liegen in JSON- und CSV-Fassung widersprüchlich vor:');

  const massnahmenGruppen = new Map();
  for (const row of finanzierungQuelle.massnahmen) {
    const list = massnahmenGruppen.get(row.id) ?? [];
    list.push(row);
    massnahmenGruppen.set(row.id, list);
  }
  const massnahmen = [...massnahmenGruppen.entries()].map(([id, rows]) => {
    const label = `Finanzierungsmaßnahme ${id}`;
    for (const field of ['bezeichnung', 'bedingung', 'rechtsgrundlage', 'status']) {
      if (new Set(rows.map((row) => row[field])).size !== 1) problems.add(`${label}: Feld ${field} weicht zwischen den Jahren ab`);
    }
    const seen = new Set();
    const jahre = {};
    for (const row of [...rows].sort((left, right) => left.jahr - right.jahr)) {
      if (seen.has(row.jahr)) problems.add(`${label}: Jahr ${row.jahr} doppelt`);
      seen.add(row.jahr);
      jahre[String(row.jahr)] = {
        einnahmen: requireInteger(row.einnahmen, `${label} ${row.jahr} einnahmen`),
        einsparungen: requireInteger(row.einsparungen, `${label} ${row.jahr} einsparungen`),
        kosten: requireInteger(row.kosten, `${label} ${row.jahr} kosten`),
        nettoentlastung: requireInteger(row.nettoentlastung, `${label} ${row.jahr} nettoentlastung`),
      };
    }
    for (const year of years) if (!seen.has(year)) problems.add(`${label}: Haushaltsjahr ${year} fehlt`);
    return {
      id,
      bezeichnung: rows[0].bezeichnung,
      bedingung: rows[0].bedingung,
      rechtsgrundlage: rows[0].rechtsgrundlage,
      status: rows[0].status,
      jahre,
    };
  }).sort((left, right) => compareCodes(left.id, right.id));

  const planJahre = (rows, label) => {
    const list = rows.map((row) => row.jahr);
    const expected = list.length > 0 ? Array.from({ length: list.length }, (_, index) => years[0] + index) : [];
    if (!deepEqual(list, expected) || list.length < years.length) {
      problems.add(`${label}: Jahre ${JSON.stringify(list)} sind nicht lückenlos ab ${years[0]}`);
    }
  };
  const kreditfinanzierungsplan = finanzierungQuelle.kreditfinanzierungsplan.map((row) => {
    const entry = {};
    for (const [key, value] of Object.entries(row)) entry[key] = requireInteger(value, `Kreditfinanzierungsplan ${row.jahr} ${key}`);
    return entry;
  });
  planJahre(kreditfinanzierungsplan, 'daten/kreditfinanzierungsplan.csv');
  const finanzplan = finanzierungQuelle.finanzplan.map((row) => {
    const entry = {};
    for (const [key, value] of Object.entries(row)) {
      entry[key] = key === 'status' ? String(value) : requireInteger(value, `Finanzplan ${row.jahr} ${key}`);
    }
    const haushaltsjahr = years.includes(row.jahr);
    if (haushaltsjahr && !/Haushaltsjahr/u.test(entry.status)) problems.add(`Finanzplan ${row.jahr}: Status „${entry.status}“ für ein Haushaltsjahr`);
    if (!haushaltsjahr && !/Projektion/u.test(entry.status)) problems.add(`Finanzplan ${row.jahr}: Folgejahr ohne Kennzeichnung als Projektion („${entry.status}“)`);
    return entry;
  });
  planJahre(finanzplan, finanzplanDateien[0]);

  const verpflichtungenCsv = csv('daten/verpflichtungen.csv');
  const veJahre = yearColumns(verpflichtungenCsv.header, 've');
  const faelligJahre = yearColumns(verpflichtungenCsv.header, 'faellig');
  requireColumns(
    verpflichtungenCsv,
    ['projekt', 'bezeichnung', 'kapitel', 'titel', 'quote', 'begruendung', 'herkunft', 'hinweis', ...veJahre.map((year) => `ve_${year}`), ...faelligJahre.map((year) => `faellig_${year}`)],
    'daten/verpflichtungen.csv',
  );
  if (!deepEqual(veJahre, years)) problems.add(`daten/verpflichtungen.csv: Verpflichtungsermächtigungen für ${JSON.stringify(veJahre)} statt ${JSON.stringify(years)}`);
  const verpflichtungen = verpflichtungenCsv.records.map((record, index) => {
    const label = `daten/verpflichtungen.csv Zeile ${index + 1}`;
    if (!titelNummern.has(`${record.kapitel}/${record.titel}`)) problems.add(`${label}: Titel ${record.kapitel}/${record.titel} existiert nicht`);
    if (record.projekt && !projektIds.has(record.projekt)) problems.add(`${label}: Projekt ${record.projekt} existiert nicht`);
    const ve = {};
    for (const year of veJahre) ve[String(year)] = parseIntegerField(record[`ve_${year}`], `${label} ve_${year}`);
    const faelligkeiten = {};
    for (const year of faelligJahre) faelligkeiten[String(year)] = parseIntegerField(record[`faellig_${year}`], `${label} faellig_${year}`);
    return {
      projekt: record.projekt,
      bezeichnung: record.bezeichnung,
      kapitel: record.kapitel,
      titel: record.titel,
      quote: parseDecimalField(record.quote, `${label} quote`),
      begruendung: record.begruendung,
      ve,
      faelligkeiten,
      herkunft: record.herkunft,
      hinweis: record.hinweis,
    };
  });
  ausschluesse.push(
    { quelle: 'daten/finanzierung.json', felder: ['vergleich', 'bruecke', 'entscheidungen'], grund: 'interne Optionsvergleiche, Lückenbrücke und Konsolidierungsfragen' },
    { quelle: 'daten/massnahmen.csv', felder: ['risiko'], grund: 'interne Risikobewertung' },
  );
  problems.throwIfAny('Finanzierung und Finanzplanung sind nicht widerspruchsfrei:');

  // -----------------------------------------------------------------------------------------
  // Rücklagen, Fonds, Wirtschaftspläne

  const ruecklagenQuelle = json('daten/ruecklagen.json');
  const gegenpostenCsv = csv('daten/fonds_gegenposten.csv');
  const gegenpostenFelder = ['asset_id', 'year', 'chapter', 'hg', 'title', 'amount_eur', 'name', 'kind', 'origin', 'counterparty', 'fund_expense_type', 'core_revenue_title', 'consolidation_elimination_eur', 'certificate', 'legal_change', 'new_target_chapters'];
  requireColumns(gegenpostenCsv, gegenpostenFelder, 'daten/fonds_gegenposten.csv');
  compareJsonWithCsv(problems, ruecklagenQuelle.gegenposten, gegenpostenCsv, 'daten/ruecklagen.json gegenposten ↔ daten/fonds_gegenposten.csv');
  const allgemeineRuecklage = (ruecklagenQuelle.allgemeine_ruecklage ?? []).map((row) => {
    const entry = {};
    for (const [key, value] of Object.entries(row)) entry[key] = requireInteger(value, `Allgemeine Rücklage ${row.jahr} ${key}`);
    return entry;
  });
  planJahre(allgemeineRuecklage, 'daten/ruecklagen.json allgemeine_ruecklage');
  const unbekannteKapitel = new Set();
  const fondsGegenposten = gegenpostenCsv.records.map((record, index) => {
    const label = `daten/fonds_gegenposten.csv Zeile ${index + 1}`;
    const zielkapitel = record.new_target_chapters === '' ? [] : record.new_target_chapters.split(/[,/]/u).map((code) => code.trim());
    for (const code of zielkapitel) {
      if (!/^\d{4}$/u.test(code)) problems.add(`${label}: Zielkapitel „${code}“ ist kein Kapitelschlüssel`);
      else if (!kapitelIndex.has(code)) unbekannteKapitel.add(code);
    }
    if (!kapitelIndex.has(record.chapter)) unbekannteKapitel.add(record.chapter);
    return {
      fonds_id: record.asset_id,
      jahr: parseIntegerField(record.year, `${label} year`),
      kapitel: record.chapter,
      hauptgruppe: record.hg,
      titelgruppe: record.title,
      betrag: parseIntegerField(record.amount_eur, `${label} amount_eur`),
      bezeichnung: record.name,
      art: record.kind,
      herkunft: record.origin,
      gegenpartei: record.counterparty,
      verwendungsart: record.fund_expense_type,
      einnahmetitel_kernhaushalt: record.core_revenue_title,
      konsolidierungseliminierung: parseIntegerField(record.consolidation_elimination_eur, `${label} consolidation_elimination_eur`),
      rechtsaenderung_erforderlich: parseBooleanField(record.legal_change, `${label} legal_change`),
      zielkapitel,
    };
  });
  if (unbekannteKapitel.size > 0) {
    befunde.push({
      kennung: 'fonds-kapitelbezuege',
      beschreibung: 'Fondsgegenposten verweisen auf Kapitel, die im Kapitelplan der Periode nicht vorkommen; die Angaben werden unverändert übernommen.',
      kapitel: [...unbekannteKapitel].sort(),
    });
  }
  const titelnummernAlle = new Set([...titelNummern.keys()].map((key) => key.split('/')[1]));
  const fehlendeEinnahmetitel = fehlendeFondsEinnahmetitel(fondsGegenposten, years, titelnummernAlle);
  if (fehlendeEinnahmetitel.length > 0) {
    befunde.push({
      kennung: 'fonds-einnahmetitel',
      beschreibung: 'Fondsgegenposten der Haushaltsjahre nennen Einnahmetitel des Kernhaushalts, die im Titelplan in keinem Kapitel vorkommen; einnahmetitel_kernhaushalt ist daher kein auflösbarer Titelbezug. Die Angaben werden unverändert übernommen.',
      abweichungen: fehlendeEinnahmetitel,
    });
  }

  const wpCsv = csv('daten/wirtschaftsplaene.csv');
  requireColumns(wpCsv, ['unternehmen', 'id', 'jahr', 'umsatz', 'investitionen', 'kernhaushalt', 'neue_kredite', 'schuldenstand', 'ausschuettung', 'status', 'rechtsgrundlage', 'statistik'], 'daten/wirtschaftsplaene.csv');
  const wpSeen = new Set();
  const wirtschaftsplaene = wpCsv.records.map((record, index) => {
    const label = `daten/wirtschaftsplaene.csv Zeile ${index + 1}`;
    const key = `${record.id}|${record.jahr}`;
    if (wpSeen.has(key)) problems.add(`${label}: Unternehmen ${record.id} im Jahr ${record.jahr} doppelt`);
    wpSeen.add(key);
    return {
      id: record.id,
      unternehmen: record.unternehmen,
      jahr: parseIntegerField(record.jahr, `${label} jahr`),
      umsatz: parseIntegerField(record.umsatz, `${label} umsatz`),
      investitionen: parseIntegerField(record.investitionen, `${label} investitionen`),
      kernhaushalt: parseIntegerField(record.kernhaushalt, `${label} kernhaushalt`),
      neue_kredite: parseIntegerField(record.neue_kredite, `${label} neue_kredite`),
      schuldenstand: parseIntegerField(record.schuldenstand, `${label} schuldenstand`),
      ausschuettung: parseIntegerField(record.ausschuettung, `${label} ausschuettung`),
      rechtsgrundlage: record.rechtsgrundlage,
    };
  });
  ausschluesse.push(
    { quelle: 'daten/ruecklagen.json', felder: ['lose'], grund: 'interne Finanzierungslose' },
    { quelle: 'daten/fonds_gegenposten.csv', felder: ['certificate'], grund: 'interner Nachweisstatus' },
    { quelle: 'daten/wirtschaftsplaene.csv', felder: ['status', 'statistik'], grund: 'interne Status- und Statistiknotizen' },
  );
  problems.throwIfAny('Rücklagen, Fonds und Wirtschaftspläne sind nicht widerspruchsfrei:');

  // -----------------------------------------------------------------------------------------
  // Personal (nur aggregierte, öffentlich geeignete Teile)

  const stellenCsv = csv('daten/stellen.csv');
  const stellenFelder = ['beamte_bestand', 'anwaerter', 'auszubildende', 'beamte_neu_o_r', 'arbeitnehmer', 'beamte', 'summe', 'beamte_bisheriges_recht', 'kostenaequivalent_beamte', 'kostenaequivalent_arbeitnehmer'];
  requireColumns(stellenCsv, ['kapitel', 'einzelplan', 'bezeichnung', 'bereich', 'herkunft', ...years.flatMap((year) => stellenFelder.map((field) => `${field}_${year}`))], 'daten/stellen.csv');
  const stellenKapitel = new Set();
  const stellen = stellenCsv.records.map((record) => {
    const label = `daten/stellen.csv Kapitel ${record.kapitel}`;
    if (stellenKapitel.has(record.kapitel)) problems.add(`${label}: doppelt`);
    stellenKapitel.add(record.kapitel);
    const kapitelEntry = kapitelIndex.get(record.kapitel);
    if (!kapitelEntry) problems.add(`${label}: Kapitel existiert nicht`);
    else if (kapitelEntry.einzelplan !== record.einzelplan) problems.add(`${label}: Einzelplan ${record.einzelplan} passt nicht zum Kapitel`);
    return {
      kapitel: record.kapitel,
      einzelplan: record.einzelplan,
      bezeichnung: record.bezeichnung,
      bereich: record.bereich,
      herkunft: record.herkunft,
      jahre: yearMap(years, (year) => {
        const values = {};
        for (const field of stellenFelder) values[field] = parseIntegerField(record[`${field}_${year}`], `${label} ${field}_${year}`);
        return values;
      }),
    };
  }).sort((left, right) => compareCodes(left.kapitel, right.kapitel));

  const kapitelwirkungCsv = csv('daten/personal/kapitelwirkung.csv');
  const kapitelwirkungFelder = ['vorher', 'basisbereinigung', 'reformwirkung', 'finanzfolge', 'nachher'];
  requireColumns(kapitelwirkungCsv, ['jahr', 'einzelplan', 'kapitel', 'kapitel_bezeichnung', 'bereich', 'gruppe', ...kapitelwirkungFelder.map((field) => `${field}_eur`)], 'daten/personal/kapitelwirkung.csv');
  const kapitelwirkungSchluessel = new Set();
  const kapitelwirkung = kapitelwirkungCsv.records.map((record, index) => {
    const label = `daten/personal/kapitelwirkung.csv Zeile ${index + 1}`;
    const jahr = parseIntegerField(record.jahr, `${label} jahr`);
    if (!years.includes(jahr)) problems.add(`${label}: Jahr ${jahr} liegt außerhalb der Periode ${periode}`);
    const key = `${jahr}|${record.kapitel}|${record.gruppe}`;
    if (kapitelwirkungSchluessel.has(key)) problems.add(`${label}: Kapitel ${record.kapitel}, Gruppe ${record.gruppe}, Jahr ${jahr} doppelt`);
    kapitelwirkungSchluessel.add(key);
    const kapitelEntry = kapitelIndex.get(record.kapitel);
    if (!kapitelEntry) problems.add(`${label}: Kapitel ${record.kapitel} fehlt in daten/kapitel.csv`);
    else {
      problems.equal(record.einzelplan, 'daten/personal/kapitelwirkung.csv einzelplan', kapitelEntry.einzelplan, 'daten/kapitel.csv', label);
      problems.equal(record.kapitel_bezeichnung, 'daten/personal/kapitelwirkung.csv kapitel_bezeichnung', kapitelEntry.bezeichnung, 'daten/kapitel.csv', label);
    }
    if (!gruppenIndex.has(record.gruppe)) problems.add(`${label}: Gruppe ${record.gruppe} fehlt in daten/gruppierung.csv`);
    const entry = { jahr, einzelplan: record.einzelplan, kapitel: record.kapitel, bereich: record.bereich, gruppe: record.gruppe };
    for (const field of kapitelwirkungFelder) entry[field] = parseIntegerField(record[`${field}_eur`], `${label} ${field}_eur`);
    problems.equal(entry.nachher, 'daten/personal/kapitelwirkung.csv nachher_eur', sum(`kg|${record.kapitel}|${record.gruppe}|${jahr}`), 'Summe der Titel der Gruppe (daten/titel.json)', `Kapitelwirkung ${record.kapitel}/${record.gruppe} ${jahr}`);
    return entry;
  }).sort((left, right) => left.jahr - right.jahr || compareCodes(left.kapitel, right.kapitel) || compareCodes(left.gruppe, right.gruppe));

  const reformJahreCsv = csv('daten/personal/reformwirkung_jahre.csv');
  const reformJson = json('daten/personal/reformwirkung.json');
  const reformJahre = reformJahreCsv.records.map((record, index) => {
    const entry = {};
    for (const column of reformJahreCsv.header) entry[column] = parseIntegerField(record[column], `daten/personal/reformwirkung_jahre.csv Zeile ${index + 1} ${column}`);
    const { jahr, ...rest } = entry;
    if (!deepEqual(rest, reformJson.jahreswerte?.[String(jahr)])) {
      problems.add(`Reformwirkung ${jahr}: daten/personal/reformwirkung_jahre.csv weicht von daten/personal/reformwirkung.json (jahreswerte) ab`);
    }
    return entry;
  });
  planJahre(reformJahre, 'daten/personal/reformwirkung_jahre.csv');
  const komponentenCsv = csv('daten/personal/reformwirkung_komponenten.csv');
  requireColumns(komponentenCsv, ['jahr', 'komponente', 'bezeichnung', 'gruppe', 'seite', 'betrag_eur'], 'daten/personal/reformwirkung_komponenten.csv');
  const komponenten = komponentenCsv.records.map((record, index) => ({
    jahr: parseIntegerField(record.jahr, `daten/personal/reformwirkung_komponenten.csv Zeile ${index + 1} jahr`),
    komponente: record.komponente,
    bezeichnung: record.bezeichnung,
    gruppe: record.gruppe,
    seite: record.seite,
    betrag: parseIntegerField(record.betrag_eur, `daten/personal/reformwirkung_komponenten.csv Zeile ${index + 1} betrag_eur`),
  }));
  const seriesCsv = (relative, keyColumns) => {
    const table = csv(relative);
    const jahrSpalten = table.header.filter((column) => /^\d{4}$/u.test(column));
    requireColumns(table, [...keyColumns, ...jahrSpalten], relative);
    return table.records.map((record, index) => {
      const entry = {};
      for (const column of keyColumns) entry[column] = record[column];
      entry.jahre = {};
      for (const column of jahrSpalten) entry.jahre[column] = parseIntegerField(record[column], `${relative} Zeile ${index + 1} ${column}`);
      return entry;
    });
  };
  const versorgungsreihen = seriesCsv('daten/personal/versorgung_reihen.csv', ['rechtsstand', 'teil']);

  // Rechtsstände der Vergleichs- und Versorgungsreihen: Legende aus daten/personal/regimevergleich.csv
  const regimeCsv = csv('daten/personal/regimevergleich.csv');
  const regimeJahre = regimeCsv.header.filter((column) => /^\d{4}$/u.test(column));
  requireColumns(regimeCsv, ['block', 'rechtsstand', 'code', ...regimeJahre], 'daten/personal/regimevergleich.csv');
  compareJsonWithCsv(problems, reformJson.regimevergleich, regimeCsv, 'daten/personal/reformwirkung.json regimevergleich ↔ daten/personal/regimevergleich.csv');
  const rechtsstaende = [];
  const rechtsstandIndex = new Map();
  const regimeSchluessel = new Set();
  const regimevergleich = regimeCsv.records.map((record, index) => {
    const label = `daten/personal/regimevergleich.csv Zeile ${index + 1}`;
    if (!/^[A-Z][A-Z0-9]*$/u.test(record.code)) problems.add(`${label}: Rechtsstandskennung „${record.code}“ ist ungültig`);
    if (record.rechtsstand === '') problems.add(`${label}: Bezeichnung des Rechtsstands fehlt`);
    const bekannt = rechtsstandIndex.get(record.code);
    if (bekannt === undefined) {
      rechtsstandIndex.set(record.code, record.rechtsstand);
      rechtsstaende.push({ code: record.code, bezeichnung: record.rechtsstand });
    } else if (bekannt !== record.rechtsstand) {
      problems.add(`${label}: Rechtsstand ${record.code} heißt hier „${record.rechtsstand}“, zuvor „${bekannt}“`);
    }
    const key = `${record.block}|${record.code}`;
    if (regimeSchluessel.has(key)) problems.add(`${label}: Block „${record.block}“ mit Rechtsstand ${record.code} doppelt`);
    regimeSchluessel.add(key);
    const jahre = {};
    for (const column of regimeJahre) jahre[column] = parseIntegerField(record[column], `${label} ${column}`);
    return { block: record.block, rechtsstand: record.code, jahre };
  });
  for (const reihe of versorgungsreihen) {
    if (!rechtsstandIndex.has(reihe.rechtsstand)) {
      problems.add(`daten/personal/versorgung_reihen.csv: Rechtsstand ${reihe.rechtsstand} hat keine Bezeichnung in daten/personal/regimevergleich.csv`);
    }
  }
  const versorgungQuelle = reformJson.versorgung ?? {};
  const vorbuchung = {};
  for (const [year, value] of Object.entries(versorgungQuelle.vorbuchung ?? {})) {
    if (!/^\d{4}$/u.test(year)) problems.add(`daten/personal/reformwirkung.json versorgung.vorbuchung: Schlüssel ${year} ist kein Jahr`);
    vorbuchung[year] = requireInteger(value, `daten/personal/reformwirkung.json versorgung.vorbuchung.${year}`);
  }
  const barwerteQuelle = versorgungQuelle.barwerte;
  if (!barwerteQuelle || typeof barwerteQuelle !== 'object') throw new HaushaltError('daten/personal/reformwirkung.json: versorgung.barwerte fehlt');
  const barwertBetraege = ['laufend_b', 'laufend_c', 'anwartschaften_b', 'anwartschaften_c', 'gesamt_b', 'gesamt_c', 'minderung'];
  const barwertUnbekannt = Object.keys(barwerteQuelle).filter((key) => ![...barwertBetraege, 'rechnungszins', 'dynamik', 'hinweis'].includes(key));
  if (barwertUnbekannt.length > 0) throw new HaushaltError(`daten/personal/reformwirkung.json versorgung.barwerte: unbekannte Felder ${barwertUnbekannt.join(', ')} – der Import muss erst um ihre Einordnung ergänzt werden`);
  const barwerte = {
    rechnungszins: decimalText(barwerteQuelle.rechnungszins, 'versorgung.barwerte.rechnungszins'),
    dynamik: decimalText(barwerteQuelle.dynamik, 'versorgung.barwerte.dynamik'),
  };
  for (const key of barwertBetraege) barwerte[key] = requireInteger(barwerteQuelle[key], `daten/personal/reformwirkung.json versorgung.barwerte.${key}`);
  barwerte.hinweis = String(barwerteQuelle.hinweis ?? '');
  problems.equal(barwerte.laufend_b + barwerte.anwartschaften_b, 'laufend + Anwartschaften (B)', barwerte.gesamt_b, 'versorgung.barwerte gesamt_b', 'Barwerte');
  problems.equal(barwerte.laufend_c + barwerte.anwartschaften_c, 'laufend + Anwartschaften (C)', barwerte.gesamt_c, 'versorgung.barwerte gesamt_c', 'Barwerte');
  problems.equal(barwerte.gesamt_b - barwerte.gesamt_c, 'gesamt B − gesamt C', barwerte.minderung, 'versorgung.barwerte minderung', 'Barwerte');

  const fondsErstattungCsv = csv('daten/personal/versorgungsfonds_erstattung.csv');
  requireColumns(fondsErstattungCsv, ['jahr', 'geplant', 'tatsaechlich', 'minderung'], 'daten/personal/versorgungsfonds_erstattung.csv');
  const versorgungsfondsErstattung = fondsErstattungCsv.records.map((record, index) => {
    const entry = {};
    for (const column of fondsErstattungCsv.header) entry[column] = parseIntegerField(record[column], `daten/personal/versorgungsfonds_erstattung.csv Zeile ${index + 1} ${column}`);
    return entry;
  });

  const kennzahlenCsv = csv('daten/personal/kennzahlen.csv');
  requireColumns(kennzahlenCsv, ['kennzahl', 'jahr', 'wert'], 'daten/personal/kennzahlen.csv');
  const kennzahlen = kennzahlenCsv.records.map((record, index) => ({
    kennzahl: record.kennzahl,
    jahr: parseIntegerField(record.jahr, `daten/personal/kennzahlen.csv Zeile ${index + 1} jahr`),
    wert: parseIntegerField(record.wert, `daten/personal/kennzahlen.csv Zeile ${index + 1} wert`),
  }));

  const besoldungQuelle = json('daten/personal/besoldungstabellen.json');
  const besoldungstabellen = {};
  for (const key of BESOLDUNG_RECHTSSTAENDE) {
    const table = besoldungQuelle[key];
    if (!table || typeof table !== 'object') {
      problems.add(`daten/personal/besoldungstabellen.json: Rechtsstand ${key} fehlt`);
      continue;
    }
    const { meta: tableMeta, ...rest } = table;
    besoldungstabellen[key] = {
      bezeichnung: tableMeta?.bezeichnung ?? null,
      gueltig_ab: tableMeta?.gueltig_ab ?? null,
      herkunft: tableMeta?.herkunft ?? null,
      tabellen: rest,
    };
  }
  ausschluesse.push({
    quelle: 'daten/personal/besoldungstabellen.json',
    felder: ['*.meta.quellen', ...Object.keys(besoldungQuelle).filter((key) => !BESOLDUNG_RECHTSSTAENDE.includes(key))],
    grund: 'interne Quellpfade und überholte Vergleichsfassungen',
  });

  const strukturCsv = csv('daten/personal/personalstruktur.csv');
  const strukturZahlen = strukturCsv.header.filter((column) => !['bereich', 'bezeichnung', 'jahr', 'herkunft', 'funktionsvorbehalt_anteil'].includes(column));
  requireColumns(strukturCsv, ['bereich', 'bezeichnung', 'jahr', 'herkunft', 'funktionsvorbehalt_anteil', ...strukturZahlen], 'daten/personal/personalstruktur.csv');
  const personalstruktur = strukturCsv.records.map((record, index) => {
    const label = `daten/personal/personalstruktur.csv Zeile ${index + 1}`;
    const entry = { bereich: record.bereich, bezeichnung: record.bezeichnung, jahr: parseIntegerField(record.jahr, `${label} jahr`) };
    for (const column of strukturZahlen) entry[column] = parseIntegerField(record[column], `${label} ${column}`);
    entry.funktionsvorbehalt_anteil = parseDecimalField(record.funktionsvorbehalt_anteil, `${label} funktionsvorbehalt_anteil`);
    entry.herkunft = record.herkunft;
    return entry;
  });

  const normenCsv = csv('daten/personal/normen.csv');
  requireColumns(normenCsv, ['norm', 'inhalt', 'betroffen', 'modellkomponente', 'status'], 'daten/personal/normen.csv');
  const personalNormen = normenCsv.records.map((record) => ({ ...record }));

  ausschluesse.push(
    { quelle: 'daten/personal/k02_journal.csv', grund: 'internes Buchungsjournal' },
    { quelle: 'daten/personal/auffaelligkeiten.csv', grund: 'interne Auffälligkeitenliste' },
    { quelle: 'daten/personal/quellen.csv', grund: 'Quellenliste mit internen Dateipfaden' },
    { quelle: 'daten/politische_entscheidungen.csv', grund: 'interne Konsolidierungsentscheidungen' },
    { quelle: 'daten/ueberleitungsbruecke.csv', grund: 'interne Überleitungsrechnung' },
  );
  problems.throwIfAny('Die Personaldaten sind nicht widerspruchsfrei:');

  pruefeRechenidentitaeten(problems, { massnahmen, kreditfinanzierungsplan, allgemeineRuecklage, stellen, reformwirkungJahre: reformJahre, kapitelwirkung }, {
    massnahmen: 'daten/massnahmen.csv',
    kreditfinanzierungsplan: 'daten/kreditfinanzierungsplan.csv',
    ruecklage: 'daten/ruecklagen.json allgemeine_ruecklage',
    stellen: 'daten/stellen.csv',
    reformwirkung: 'daten/personal/reformwirkung_jahre.csv',
    kapitelwirkung: 'daten/personal/kapitelwirkung.csv',
  });
  problems.throwIfAny('Rechnerische Identitäten der Quelldaten sind verletzt (es wird nichts korrigiert):');
  pruefeQuerbezuege(problems, { years, gesamtplanJahre, finanzplan, kreditfinanzierungsplan, allgemeineRuecklage, reformwirkungJahre: reformJahre, komponenten }, {
    gesamtplan: 'daten/gesamtplan.json',
    finanzplan: finanzplanDateien[0],
    kreditfinanzierungsplan: 'daten/kreditfinanzierungsplan.csv',
    ruecklage: 'daten/ruecklagen.json allgemeine_ruecklage',
    reformwirkung: 'daten/personal/reformwirkung_jahre.csv',
    komponenten: 'daten/personal/reformwirkung_komponenten.csv',
  });
  problems.throwIfAny('Gesamtplan, Finanzplanung, Rücklagen und Personalreform sind nicht widerspruchsfrei:');

  // -----------------------------------------------------------------------------------------
  // Qualität und Prüfungen

  const qualitaetQuelle = json('daten/qualitaet.json');
  const klassen = {};
  for (const year of yearKeys) {
    const source = qualitaetQuelle.nachher?.[year];
    if (!source) {
      problems.add(`daten/qualitaet.json: Qualitätsklassen für ${year} fehlen`);
      continue;
    }
    const ordered = {};
    for (const { kennung } of QUALITAET_LEGENDE) {
      if (kennung in source) ordered[kennung] = requireInteger(source[kennung], `daten/qualitaet.json ${year}.${kennung}`);
    }
    for (const kennung of Object.keys(source)) {
      if (!legendeQualitaet.has(kennung)) problems.add(`daten/qualitaet.json: Qualitätsklasse „${kennung}“ ist nicht eingeordnet`);
    }
    for (const { kennung } of QUALITAET_LEGENDE) {
      problems.equal(ordered[kennung] ?? 0, 'daten/qualitaet.json', sum(`q|${kennung}|${year}|Ausgabe`), 'Summe der Ausgabetitel', `Qualitätsklasse ${kennung} ${year}`);
    }
    klassen[year] = ordered;
  }
  const groessteReste = (qualitaetQuelle.groesste_reste ?? []).map((row, index) => {
    const label = `daten/qualitaet.json groesste_reste[${index}]`;
    const yearMatch = Object.keys(row).map((key) => /^betrag_(\d{4})$/u.exec(key)).filter(Boolean);
    if (yearMatch.length !== 1) throw new HaushaltError(`${label}: genau ein Jahresbetrag erwartet`);
    const year = Number(yearMatch[0][1]);
    const betrag = requireInteger(row[yearMatch[0][0]], `${label} ${yearMatch[0][0]}`);
    const konzeptId = titelNummern.get(`${row.kapitel}/${row.titel}`);
    const titelRow = konzeptId ? konzepte.get(konzeptId)?.get(year) : null;
    if (!titelRow) problems.add(`${label}: Titel ${row.kapitel}/${row.titel} existiert nicht`);
    else {
      problems.equal(betrag, 'daten/qualitaet.json', titelRow.betrag_eur, 'daten/titel.json', `Restansatz ${row.kapitel}/${row.titel} ${year}`);
      problems.equal(titelRow.qualitaet, 'Qualitätsklasse', 'S_rest', 'erwartet', `Restansatz ${row.kapitel}/${row.titel}`);
    }
    return { kapitel: row.kapitel, titel: row.titel, zweckbestimmung: row.zweckbestimmung, jahr: year, betrag };
  });

  const pruefungenCsv = csv('daten/pruefungen.csv');
  requireColumns(pruefungenCsv, ['pruefung', 'ok', 'ist', 'soll', 'erlaeuterung'], 'daten/pruefungen.csv');
  const pruefungen = pruefungenCsv.records.map((record, index) => ({
    name: record.pruefung,
    ok: parseBooleanField(record.ok, `daten/pruefungen.csv Zeile ${index + 1} ok`),
  }));
  const fehlgeschlagen = pruefungen.filter((entry) => !entry.ok);
  for (const entry of fehlgeschlagen) problems.add(`daten/pruefungen.csv: Prüfung „${entry.name}“ ist nicht bestanden`);
  if (pruefstandMatch) {
    problems.equal(pruefungen.filter((entry) => entry.ok).length, 'bestandene Prüfungen in daten/pruefungen.csv', Number(pruefstandMatch[1]), 'MANIFEST.json pruefungen (bestanden)', 'Prüfstand');
    problems.equal(pruefungen.length, 'Prüfungen in daten/pruefungen.csv', Number(pruefstandMatch[2]), 'MANIFEST.json pruefungen (gesamt)', 'Prüfstand');
  }
  problems.throwIfAny('Qualitäts- und Prüfangaben sind nicht widerspruchsfrei:');

  // -----------------------------------------------------------------------------------------
  // Gesetzgebungspaket (nur Metadaten)

  const gesetzReadme = raw('gesetze/README.md').toString('utf8');
  const dokumente = [];
  for (const line of gesetzReadme.split('\n')) {
    const match = /^\|\s*(\d{2})\s*\|\s*\[(.+)\]\(([^)]+)\)\s*\|\s*$/u.exec(line);
    if (match) dokumente.push({ nr: match[1], titel: match[2].trim(), datei: match[3].trim() });
  }
  if (dokumente.length === 0) throw new HaushaltError('gesetze/README.md: keine Dokumententabelle gefunden');
  const gesetze = [];
  for (const dokument of dokumente) {
    const label = `gesetze/${dokument.datei}`;
    if (!/^[\w.-]+\.md$/u.test(dokument.datei)) {
      problems.add(`gesetze/README.md: Dokumentverweis „${dokument.datei}“ ist unzulässig`);
      continue;
    }
    const text = raw(`gesetze/${dokument.datei}`).toString('utf8');
    const heading = /^# (.+)$/mu.exec(text)?.[1]?.trim();
    problems.equal(heading, `Überschrift in ${label}`, dokument.titel, 'Titel in gesetze/README.md', `Dokument ${dokument.nr}`);
    if (!/^> \*\*Entwurf\*\*/u.test(text)) problems.add(`${label}: Kopfvermerk „Entwurf“ fehlt; das Paket darf nicht als geltendes Recht übernommen werden`);
    const regel = GESETZ_DOKUMENT_REGELN.find((entry) => entry.muster.test(dokument.titel));
    if (!regel) {
      problems.add(`${label}: Dokument „${dokument.titel}“ ist keiner Veröffentlichungsregel zugeordnet`);
      continue;
    }
    if (regel.oeffentlich) {
      gesetze.push({ nr: dokument.nr, titel: dokument.titel, art: regel.art, status: regel.status });
    } else {
      ausschluesse.push({ quelle: `gesetze/${dokument.datei}`, grund: regel.grund });
    }
  }
  problems.throwIfAny('Das Gesetzgebungspaket ist nicht eindeutig einzuordnen:');

  // -----------------------------------------------------------------------------------------
  // Ausgabe der Snapshot-Dateien

  const dateien = new Map();
  dateien.set('periode.json', {
    ...header(periode),
    jahre: years,
    quellbezeichnung: meta.bezeichnung,
    quellstatus: quellstatusMatch[1],
    stand: meta.stand,
    titel_datenstatus: [...datenstatus][0],
    haushaltsvolumen: yearMap(years, (year) => meta.haushaltsvolumen[String(year)]),
    haushaltsvolumen_basis: meta.haushaltsvolumen_baseline
      ? yearMap(years, (year) => requireInteger(meta.haushaltsvolumen_baseline[String(year)], `daten/meta.json haushaltsvolumen_baseline ${year}`))
      : null,
    basis: meta.basisrun,
    korrekturvorlagen: aktiveKorrekturen.map((entry) => ({ id: entry.id, kurzbeschreibung: entry.bezeichnung, art: entry.art })),
    legenden: {
      herkunft: HERKUNFT_LEGENDE.map((entry) => ({ ...entry })),
      qualitaet: QUALITAET_LEGENDE.map((entry) => ({ ...entry })),
    },
  });
  dateien.set('gesamtplan.json', { ...header(periode), jahre: gesamtplanJahre, gruppierung, funktionen });
  dateien.set('einzelplaene.json', { ...header(periode), einzelplaene });
  dateien.set('kapitel.json', { ...header(periode), kapitel });
  for (const entry of einzelplaene) {
    dateien.set(`titel/${entry.ep}.json`, {
      ...header(periode),
      einzelplan: entry.ep,
      jahresfelder,
      titel: titelNachPlan.get(entry.ep) ?? [],
    });
  }
  dateien.set('projekte.json', { ...header(periode), projekte });
  dateien.set('finanzierung.json', { ...header(periode), massnahmen, kreditfinanzierungsplan, finanzplan, verpflichtungen });
  dateien.set('ruecklagen.json', {
    ...header(periode),
    allgemeine_ruecklage: allgemeineRuecklage,
    fonds_gegenposten: fondsGegenposten,
    wirtschaftsplaene,
  });
  dateien.set('personal.json', {
    ...header(periode),
    stellen: { art: 'modellierte-planaequivalente', kapitel: stellen },
    rechtsstaende,
    reformwirkung: { jahre: reformJahre, komponenten },
    kapitelwirkung,
    regimevergleich,
    versorgung: { reihen: versorgungsreihen, vorbuchung, barwerte, versorgungsfonds_erstattung: versorgungsfondsErstattung },
    kennzahlen,
    besoldungstabellen,
    personalstruktur,
    normen: personalNormen,
  });
  dateien.set('qualitaet.json', {
    ...header(periode),
    klassen,
    groesste_restansaetze: groessteReste,
    pruefungen,
    pruefstand: { bestanden: pruefungen.filter((entry) => entry.ok).length, gesamt: pruefungen.length },
  });
  dateien.set('gesetze.json', { ...header(periode), stand: meta.stand, dokumente: gesetze });

  const kontrollsummen = yearMap(years, (year) => ({
    einnahmen: gesamtplanJahre[String(year)].einnahmen,
    ausgaben: gesamtplanJahre[String(year)].ausgaben,
    einzelplaene: einzelplaene.length,
    kapitel: kapitel.length,
    titel: konzepte.size,
  }));

  const artefaktKandidaten = [...files.keys()]
    .filter((path) => path.startsWith('ausgabe/'))
    .sort()
    .map((path) => ({ quelle: path, datei: path.slice('ausgabe/'.length), buffer: files.get(path).buffer, sha256: files.get(path).sha256 }));

  const quelle = {
    repository: QUELL_REPOSITORY,
    commit: gitState.commit,
    commit_kurz: gitState.commit.slice(0, 7),
    commitdatum: gitState.commitdatum,
    fassung: active.fassung,
    pfad: active.pfad,
    basisrun: meta.basisrun,
    stand: meta.stand,
    korrekturvorlagen: aktiveKorrekturen.map((entry) => entry.id),
    pruefstand: { bestanden: pruefungen.filter((entry) => entry.ok).length, gesamt: pruefungen.length },
  };

  const ausschluesseMitPfad = ausschluesse.map((entry) => ({ ...entry, quelle: `${active.pfad}/${entry.quelle}` }));

  return { dateien, artefaktKandidaten, befunde, kontrollsummen, quelle, ausschluesse: ausschluesseMitPfad, jahresfelder };
}
