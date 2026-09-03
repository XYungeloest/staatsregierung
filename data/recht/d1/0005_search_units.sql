-- 0005: Suchindex mit indexierbarer Löschstrategie und schlanke Übersichtsspalten.
--
-- Bisher war law_search eine eigenständige FTS5-Tabelle; norm_id/slug waren
-- UNINDEXED, sodass „DELETE FROM law_search WHERE norm_id = ?“ je Norm den gesamten
-- Volltextindex scannte (EXPLAIN QUERY PLAN: SCAN law_search VIRTUAL TABLE INDEX 0:,
-- rund 38.000 Zeilen je Norm, bei einer Vollprojektion ≈ 195 Mio. gelesene Zeilen).
--
-- Neu: law_search_units hält die Provisionen relational mit Indizes auf norm_id,
-- slug und (norm_id, version_id); law_search ist ein FTS5-Index mit externem Inhalt
-- über diese Tabelle. Trigger halten den Volltextindex zeilengenau (rowid) synchron.
-- Bestehende Suchzeilen werden einmalig übernommen, der Index wird neu aufgebaut.
--
-- Zusätzlich erhalten law_norms schmale Spalten für Übersichtsseiten (Sachgebiete,
-- Schlagwörter, Herkunft, Fassungszahl, letzte Änderung, Aliasse), eine Sachgebiets-
-- Zuordnungstabelle und eine Tabelle der Historieneinträge, damit Start-, Listen-,
-- Sachgebiets-, Sitemap- und Vorschlagsrouten keine JSON-Volltexte laden müssen.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS law_search_units (
  id INTEGER PRIMARY KEY,
  norm_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  provision_path TEXT NOT NULL,
  anchor TEXT NOT NULL,
  block_type TEXT NOT NULL,
  references_json TEXT,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  short_title TEXT NOT NULL,
  abbr TEXT NOT NULL,
  label TEXT NOT NULL,
  heading TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_law_search_units_norm ON law_search_units(norm_id);
CREATE INDEX IF NOT EXISTS idx_law_search_units_slug ON law_search_units(slug);
CREATE INDEX IF NOT EXISTS idx_law_search_units_norm_version ON law_search_units(norm_id, version_id);

-- Übernahme der bisherigen Suchzeilen (Migration 0004) in die relationale Tabelle.
INSERT INTO law_search_units (norm_id, version_id, provision_path, anchor, block_type, references_json, slug, title, short_title, abbr, label, heading, body)
  SELECT norm_id, version_id, provision_path, anchor, block_type, references_json, slug, title, short_title, abbr, label, heading, body
  FROM law_search
  ORDER BY norm_id, version_id, CAST(provision_path AS INTEGER);

DROP TABLE IF EXISTS law_search;
CREATE VIRTUAL TABLE IF NOT EXISTS law_search USING fts5(
  norm_id UNINDEXED,
  version_id UNINDEXED,
  provision_path UNINDEXED,
  anchor UNINDEXED,
  block_type UNINDEXED,
  references_json UNINDEXED,
  slug UNINDEXED,
  title,
  short_title,
  abbr,
  label,
  heading,
  body,
  content='law_search_units',
  content_rowid='id',
  tokenize = 'unicode61 remove_diacritics 2'
);
INSERT INTO law_search(law_search) VALUES ('rebuild');

CREATE TRIGGER IF NOT EXISTS law_search_units_ai AFTER INSERT ON law_search_units BEGIN
  INSERT INTO law_search(rowid, norm_id, version_id, provision_path, anchor, block_type, references_json, slug, title, short_title, abbr, label, heading, body)
  VALUES (new.id, new.norm_id, new.version_id, new.provision_path, new.anchor, new.block_type, new.references_json, new.slug, new.title, new.short_title, new.abbr, new.label, new.heading, new.body);
END;
CREATE TRIGGER IF NOT EXISTS law_search_units_ad AFTER DELETE ON law_search_units BEGIN
  INSERT INTO law_search(law_search, rowid, norm_id, version_id, provision_path, anchor, block_type, references_json, slug, title, short_title, abbr, label, heading, body)
  VALUES ('delete', old.id, old.norm_id, old.version_id, old.provision_path, old.anchor, old.block_type, old.references_json, old.slug, old.title, old.short_title, old.abbr, old.label, old.heading, old.body);
END;
CREATE TRIGGER IF NOT EXISTS law_search_units_au AFTER UPDATE ON law_search_units BEGIN
  INSERT INTO law_search(law_search, rowid, norm_id, version_id, provision_path, anchor, block_type, references_json, slug, title, short_title, abbr, label, heading, body)
  VALUES ('delete', old.id, old.norm_id, old.version_id, old.provision_path, old.anchor, old.block_type, old.references_json, old.slug, old.title, old.short_title, old.abbr, old.label, old.heading, old.body);
  INSERT INTO law_search(rowid, norm_id, version_id, provision_path, anchor, block_type, references_json, slug, title, short_title, abbr, label, heading, body)
  VALUES (new.id, new.norm_id, new.version_id, new.provision_path, new.anchor, new.block_type, new.references_json, new.slug, new.title, new.short_title, new.abbr, new.label, new.heading, new.body);
END;

-- Schmale Übersichtsspalten (werden vom Sync gefüllt; Standardwerte für Altzeilen).
ALTER TABLE law_norms ADD COLUMN subjects_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE law_norms ADD COLUMN primary_subject TEXT;
ALTER TABLE law_norms ADD COLUMN keywords_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE law_norms ADD COLUMN aliases_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE law_norms ADD COLUMN origin_kind TEXT;
ALTER TABLE law_norms ADD COLUMN origin_baseline_version_id TEXT;
ALTER TABLE law_norms ADD COLUMN origin_last_own_change_date TEXT;
ALTER TABLE law_norms ADD COLUMN version_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE law_norms ADD COLUMN last_change_date TEXT;

CREATE TABLE IF NOT EXISTS law_norm_subjects (
  norm_id TEXT NOT NULL REFERENCES law_norms(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  subject_slug TEXT NOT NULL,
  PRIMARY KEY (norm_id, subject_slug)
);
CREATE INDEX IF NOT EXISTS idx_law_norm_subjects_subject ON law_norm_subjects(subject_slug, norm_id);

CREATE TABLE IF NOT EXISTS law_norm_history (
  norm_id TEXT NOT NULL REFERENCES law_norms(id) ON DELETE CASCADE,
  entry_index INTEGER NOT NULL,
  change_date TEXT NOT NULL,
  change_type TEXT NOT NULL,
  title TEXT NOT NULL,
  citation TEXT NOT NULL,
  note TEXT,
  affecting_version_id TEXT,
  related_norm TEXT,
  PRIMARY KEY (norm_id, entry_index)
);
CREATE INDEX IF NOT EXISTS idx_law_norm_history_date ON law_norm_history(change_type, change_date DESC);
