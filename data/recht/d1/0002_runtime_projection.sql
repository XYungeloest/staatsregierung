-- Runtime-Projektion für OstRecht: vollständige Metadaten, Fassungen ohne Körper,
-- blockweise (und bei Bedarf in Teile zerlegte) Normkörper, abgeleitete Beziehungen,
-- Verkündungen und ein provisionsgenauer Suchindex der jeweils geltenden Fassung.
-- Git bleibt fachlicher Source of Truth; diese Tabellen werden ausschließlich vom
-- Sync (scripts/sync-recht-d1.mjs) befüllt.

PRAGMA foreign_keys = ON;

ALTER TABLE law_norms ADD COLUMN meta_json TEXT;
ALTER TABLE law_norms ADD COLUMN history_json TEXT;
ALTER TABLE law_norms ADD COLUMN sort_title TEXT;
ALTER TABLE law_norms ADD COLUMN current_valid_from TEXT;

ALTER TABLE law_versions ADD COLUMN version_json TEXT;
ALTER TABLE law_versions ADD COLUMN full_citation TEXT;
ALTER TABLE law_versions ADD COLUMN publication_ref_json TEXT;
ALTER TABLE law_versions ADD COLUMN temporal_kind TEXT;

-- D1 begrenzt die Länge einer einzelnen Anweisung; sehr große äußere Blöcke
-- (etwa umfangreiche Anlagentabellen) werden deshalb in Teile zerlegt und beim
-- Lesen in Reihenfolge wieder zusammengesetzt.
DROP TABLE IF EXISTS law_version_blocks;
CREATE TABLE law_version_blocks (
  norm_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  block_index INTEGER NOT NULL,
  part_index INTEGER NOT NULL DEFAULT 0,
  part_count INTEGER NOT NULL DEFAULT 1,
  block_json TEXT NOT NULL,
  PRIMARY KEY (norm_id, version_id, block_index, part_index),
  FOREIGN KEY (norm_id, version_id)
    REFERENCES law_versions(norm_id, version_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS law_norm_derived (
  norm_id TEXT PRIMARY KEY REFERENCES law_norms(id) ON DELETE CASCADE,
  relations_json TEXT NOT NULL,
  recommendations_json TEXT NOT NULL,
  origin_json TEXT NOT NULL,
  text_references_json TEXT NOT NULL,
  portal_links_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS law_publications (
  slug TEXT PRIMARY KEY,
  publication_date TEXT NOT NULL,
  publication TEXT NOT NULL,
  year INTEGER NOT NULL,
  issue TEXT NOT NULL,
  publication_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_law_publications_date ON law_publications(publication_date);
CREATE INDEX IF NOT EXISTS idx_law_norms_sort_title ON law_norms(sort_title);

DROP TABLE IF EXISTS law_search;
CREATE VIRTUAL TABLE law_search USING fts5(
  norm_id UNINDEXED,
  version_id UNINDEXED,
  provision_path UNINDEXED,
  anchor UNINDEXED,
  block_type UNINDEXED,
  slug UNINDEXED,
  title,
  short_title,
  abbr,
  label,
  heading,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);
