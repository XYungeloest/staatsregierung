/**
 * Suchindex-Schema von OstRecht ab Migration 0005: die Provisionen der geltenden
 * Fassungen liegen relational in law_search_units (INTEGER PRIMARY KEY, Indizes auf
 * norm_id, slug und (norm_id, version_id)); law_search ist ein FTS5-Index mit
 * externem Inhalt (content='law_search_units', content_rowid='id').
 *
 * Damit laufen alle Löschungen über einen echten Index: „DELETE FROM law_search_units
 * WHERE norm_id = ?“ trifft nur die Zeilen der Norm (SEARCH … USING COVERING INDEX),
 * und der AFTER-DELETE-Trigger entfernt genau diese rowids per FTS5-„delete“-Befehl
 * aus dem Volltextindex. Ein Vollscan des FTS-Index wie bei der bisherigen
 * UNINDEXED-Spalte norm_id (SCAN law_search VIRTUAL TABLE, ≈38.000 Zeilen je Norm)
 * findet nicht mehr statt.
 *
 * Die Trigger-Definitionen werden hier zentral geführt, weil der Vollsync sie für den
 * einmaligen, günstigen Leerlauf des Index (delete-all + DELETE ohne Trigger) kurz
 * entfernt und wieder anlegt; tests/recht-d1-sync.test.mjs prüft, dass die Migration
 * exakt dieselben Definitionen enthält.
 */

export const SEARCH_UNIT_COLUMNS = [
  'norm_id', 'version_id', 'provision_path', 'anchor', 'block_type', 'references_json', 'slug',
  'title', 'short_title', 'abbr', 'label', 'heading', 'body',
];

const columnList = SEARCH_UNIT_COLUMNS.join(', ');

export const SEARCH_UNITS_INSERT_TRIGGER = `CREATE TRIGGER IF NOT EXISTS law_search_units_ai AFTER INSERT ON law_search_units BEGIN
  INSERT INTO law_search(rowid, ${columnList})
  VALUES (new.id, ${SEARCH_UNIT_COLUMNS.map((column) => `new.${column}`).join(', ')});
END`;

export const SEARCH_UNITS_DELETE_TRIGGER = `CREATE TRIGGER IF NOT EXISTS law_search_units_ad AFTER DELETE ON law_search_units BEGIN
  INSERT INTO law_search(law_search, rowid, ${columnList})
  VALUES ('delete', old.id, ${SEARCH_UNIT_COLUMNS.map((column) => `old.${column}`).join(', ')});
END`;

export const SEARCH_UNITS_UPDATE_TRIGGER = `CREATE TRIGGER IF NOT EXISTS law_search_units_au AFTER UPDATE ON law_search_units BEGIN
  INSERT INTO law_search(law_search, rowid, ${columnList})
  VALUES ('delete', old.id, ${SEARCH_UNIT_COLUMNS.map((column) => `old.${column}`).join(', ')});
  INSERT INTO law_search(rowid, ${columnList})
  VALUES (new.id, ${SEARCH_UNIT_COLUMNS.map((column) => `new.${column}`).join(', ')});
END`;

export const SEARCH_TRIGGERS = [SEARCH_UNITS_INSERT_TRIGGER, SEARCH_UNITS_DELETE_TRIGGER, SEARCH_UNITS_UPDATE_TRIGGER];

/**
 * Leert den Suchindex einmalig und günstig: der FTS5-Befehl „delete-all“ verwirft den
 * Volltextindex ohne Zeilenlauf, das anschließende DELETE ohne Trigger nutzt die
 * Truncate-Optimierung von SQLite. Danach werden die Trigger wieder angelegt, damit
 * die folgenden Einfügungen den Index normal aufbauen.
 */
export function searchIndexResetStatements() {
  return [
    'DROP TRIGGER IF EXISTS law_search_units_ad',
    'DROP TRIGGER IF EXISTS law_search_units_au',
    'DROP TRIGGER IF EXISTS law_search_units_ai',
    "INSERT INTO law_search(law_search) VALUES ('delete-all')",
    'DELETE FROM law_search_units',
    ...SEARCH_TRIGGERS,
  ];
}
