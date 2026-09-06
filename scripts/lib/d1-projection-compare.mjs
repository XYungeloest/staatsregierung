import { createHash } from 'node:crypto';

import { COMPARATOR_VERSION } from './d1-projection-proof-format.mjs';
import { openDatabase } from './d1-sqlite.mjs';

export { COMPARATOR_VERSION };

/**
 * Vollständiger semantischer Vergleich zweier D1-Projektionen (SQLite-Dateien).
 *
 * Verglichen werden alle Projektionstabellen zeilenweise über ihren Primärschlüssel – nicht nur
 * Zähler. Normalisiert wird ausschließlich, was nachweislich nicht semantisch ist
 * (kleine, explizite Allowlist):
 *   - Spalte `updated_at` (Zeitstempel des Laufs),
 *   - law_runtime_meta: `last_sync_at`, `sync_mode`, `sync_state` und die Identitätszeilen
 *     (projection_fingerprint, projection_scope, projection_logic_hash, corpus_content_hash,
 *     portal_content_hash) – der Vergleich soll ja gerade sagen, ob zwei Identitäten dieselben
 *     Daten bedeuten,
 *   - law_search_units: die fortlaufende rowid `id` (der Volltextindex folgt ihr per Trigger;
 *     die Provisionen werden über norm_id, version_id und provision_path verglichen).
 * Der FTS5-Index selbst ist über law_search_units deterministisch abgeleitet; zusätzlich werden
 * einige Volltextabfragen als Stichprobe verglichen.
 *
 * Ausgabe je Tabelle: Zeilenzahlen, Anzahl nur links / nur rechts / geändert und wenige
 * Beispielschlüssel – nie ganze Zeilen oder Dumps.
 *
 * `narrowEligible` sagt, ob sich zwei Projektionen nur in den Zeilen unterscheiden, die eine enge
 * Logikprojektion neu schreibt (abgeleitete Daten, Suchdokumente, abgeleitete Spalten von
 * law_norms, Laufzeitmetadaten). Das ist nur eine Vorprüfung; der Nachweis der engen Projektion
 * führt sie tatsächlich aus und vergleicht erneut (scripts/lib/d1-projection-proof.mjs).
 */

export const VOLATILE_COLUMNS = new Set(['updated_at']);
export const VOLATILE_META_KEYS = new Set(['last_sync_at', 'sync_mode', 'sync_state', 'projection_fingerprint', 'projection_scope', 'projection_logic_hash', 'corpus_content_hash', 'portal_content_hash']);
export const SEARCH_UNIT_KEY = ['norm_id', 'version_id', 'provision_path'];
export const FTS_SAMPLE_TERMS = ['Interflug', 'Zinnwald', 'Daseinsvorsorge', 'Hoheitszeichen', 'Gemeindeordnung'];
const FTS_SHADOW_TABLE = /^law_search(?:_(?:data|idx|docsize|config|content))?$/u;
/** Spalten von law_norms, die derivedQueries (scripts/sync-recht-d1.mjs) neu schreibt. */
export const NARROW_NORM_COLUMNS = new Set(['origin_kind', 'origin_baseline_version_id', 'origin_last_own_change_date', 'last_change_date', 'last_activity_date']);
export const NARROW_TABLES = new Set(['law_norm_derived', 'law_search_documents', 'law_runtime_meta']);
const SAMPLE_KEYS = 5;

function projectionTables(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'law\\_%' ESCAPE '\\' ORDER BY name").all()
    .map((row) => row.name)
    .filter((name) => !FTS_SHADOW_TABLE.test(name));
}

function keyColumns(db, table) {
  if (table === 'law_search_units') return SEARCH_UNIT_KEY;
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const keys = columns.filter((column) => column.pk > 0).sort((left, right) => left.pk - right.pk).map((column) => column.name);
  if (keys.length === 0) throw new Error(`Tabelle ${table} hat keinen Primärschlüssel; Vergleich nicht möglich`);
  return keys;
}

/** Zeilen einer Tabelle als Map Schlüssel → { hash, row } (Zeile ohne volatile Spalten). */
function tableRows(db, table, { keepRows = false } = {}) {
  const keys = keyColumns(db, table);
  const rows = new Map();
  for (const row of db.prepare(`SELECT * FROM ${table}`).all()) {
    if (table === 'law_runtime_meta' && VOLATILE_META_KEYS.has(row.key)) continue;
    const entry = {};
    for (const [column, value] of Object.entries(row)) {
      if (VOLATILE_COLUMNS.has(column)) continue;
      if (table === 'law_search_units' && column === 'id') continue;
      entry[column] = value;
    }
    const key = keys.map((column) => String(row[column])).join('|');
    if (rows.has(key)) throw new Error(`Tabelle ${table}: Schlüssel ${key} ist nicht eindeutig`);
    rows.set(key, { hash: createHash('sha256').update(JSON.stringify(entry)).digest('hex'), row: keepRows ? entry : null });
  }
  return rows;
}

function changedColumns(left, right) {
  const columns = new Set();
  for (const column of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (JSON.stringify(left[column] ?? null) !== JSON.stringify(right[column] ?? null)) columns.add(column);
  }
  return [...columns].sort();
}

function ftsHits(db, term) {
  return JSON.stringify(db.prepare('SELECT norm_id, version_id, provision_path FROM law_search WHERE law_search MATCH ? ORDER BY norm_id, version_id, provision_path').all(term));
}

/**
 * @returns {Promise<{ identical: boolean, comparator: number, tables: Record<string, object>, fts: Record<string, boolean>, differingTables: string[] }>}
 */
export async function compareProjections(leftPath, rightPath, { root = process.cwd() } = {}) {
  const left = await openDatabase(leftPath, { create: false, root, readOnly: true });
  const right = await openDatabase(rightPath, { create: false, root, readOnly: true });
  try {
    const tables = {};
    const names = [...new Set([...projectionTables(left), ...projectionTables(right)])].sort();
    for (const table of names) {
      const inLeft = projectionTables(left).includes(table);
      const inRight = projectionTables(right).includes(table);
      if (!inLeft || !inRight) {
        tables[table] = { missing: inLeft ? 'rechts' : 'links', rowsLeft: 0, rowsRight: 0, onlyLeft: 0, onlyRight: 0, changed: 0, sampleKeys: [], changedColumns: [] };
        continue;
      }
      const rowsLeft = tableRows(left, table, { keepRows: table === 'law_norms' });
      const rowsRight = tableRows(right, table, { keepRows: table === 'law_norms' });
      const onlyLeft = [...rowsLeft.keys()].filter((key) => !rowsRight.has(key));
      const onlyRight = [...rowsRight.keys()].filter((key) => !rowsLeft.has(key));
      const changed = [...rowsLeft.keys()].filter((key) => rowsRight.has(key) && rowsRight.get(key).hash !== rowsLeft.get(key).hash);
      const columns = new Set();
      if (table === 'law_norms') for (const key of changed) for (const column of changedColumns(rowsLeft.get(key).row, rowsRight.get(key).row)) columns.add(column);
      tables[table] = {
        rowsLeft: rowsLeft.size,
        rowsRight: rowsRight.size,
        onlyLeft: onlyLeft.length,
        onlyRight: onlyRight.length,
        changed: changed.length,
        sampleKeys: [...onlyLeft, ...onlyRight, ...changed].slice(0, SAMPLE_KEYS),
        changedColumns: [...columns].sort(),
      };
    }
    const fts = {};
    for (const term of FTS_SAMPLE_TERMS) fts[term] = ftsHits(left, term) === ftsHits(right, term);
    const differingTables = Object.entries(tables).filter(([, entry]) => entry.missing || entry.onlyLeft + entry.onlyRight + entry.changed > 0).map(([table]) => table);
    const identical = differingTables.length === 0 && Object.values(fts).every(Boolean);
    return { identical, comparator: COMPARATOR_VERSION, tables, fts, differingTables };
  } finally {
    left.close();
    right.close();
  }
}

/** Unterscheiden sich die Projektionen nur dort, wo eine enge Logikprojektion schreibt? */
export function narrowEligible(comparison) {
  if (comparison.identical) return false;
  if (!Object.values(comparison.fts).every(Boolean)) return false;
  for (const table of comparison.differingTables) {
    const entry = comparison.tables[table];
    if (entry.missing) return false;
    if (NARROW_TABLES.has(table)) continue;
    if (table === 'law_norms' && entry.onlyLeft === 0 && entry.onlyRight === 0 && entry.changedColumns.every((column) => NARROW_NORM_COLUMNS.has(column))) continue;
    return false;
  }
  return true;
}

/** Lesbare Zusammenfassung (Tabelle, Zeilen, Abweichungen, Beispielschlüssel). */
export function formatComparison(comparison) {
  const lines = [];
  for (const [table, entry] of Object.entries(comparison.tables)) {
    if (entry.missing) {
      lines.push(`DIFF ${table}: fehlt ${entry.missing}`);
      continue;
    }
    const differs = entry.onlyLeft + entry.onlyRight + entry.changed > 0;
    lines.push(`${differs ? 'DIFF' : 'OK  '} ${table}: ${entry.rowsLeft} vs ${entry.rowsRight} Zeilen${differs ? ` – nur links ${entry.onlyLeft}, nur rechts ${entry.onlyRight}, geändert ${entry.changed}${entry.changedColumns.length ? ` (Spalten ${entry.changedColumns.join(', ')})` : ''}; Beispiele: ${entry.sampleKeys.join(', ')}` : ''}`);
  }
  for (const [term, equal] of Object.entries(comparison.fts)) lines.push(`${equal ? 'OK  ' : 'DIFF'} Volltextsuche „${term}“`);
  lines.push(comparison.identical
    ? `Beide Projektionen sind tabellenweise identisch (Comparator ${comparison.comparator}; ohne Zeitstempel, Laufmodus, Identitätszeilen und Suchzeilen-rowid).`
    : `${comparison.differingTables.length} Tabelle(n) weichen ab: ${comparison.differingTables.join(', ')}${narrowEligible(comparison) ? ' – nur Zeilen der engen Logikprojektion' : ''}.`);
  return lines.join('\n');
}
