PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS law_norms (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  short_title TEXT NOT NULL,
  abbr TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  revosax_law_id TEXT,
  current_version_id TEXT,
  document_date TEXT,
  publication_date TEXT,
  effective_date TEXT,
  expiry_date TEXT,
  initial_citation TEXT NOT NULL,
  summary TEXT NOT NULL,
  responsible_ministry TEXT,
  enacting_body TEXT,
  source_kind TEXT NOT NULL DEFAULT 'repository',
  updated_at TEXT NOT NULL,
  CHECK (source_kind IN ('repository', 'revosax-baseline'))
);

CREATE INDEX IF NOT EXISTS idx_law_norms_type ON law_norms(type);
CREATE INDEX IF NOT EXISTS idx_law_norms_status ON law_norms(status);
CREATE INDEX IF NOT EXISTS idx_law_norms_revosax_id ON law_norms(revosax_law_id);
CREATE INDEX IF NOT EXISTS idx_law_norms_current_version ON law_norms(current_version_id);

CREATE TABLE IF NOT EXISTS law_versions (
  norm_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  is_current INTEGER NOT NULL CHECK (is_current IN (0, 1)),
  title TEXT,
  short_title TEXT,
  abbr TEXT,
  summary TEXT,
  citation TEXT NOT NULL,
  change_note TEXT NOT NULL,
  source_sha256 TEXT,
  source_url TEXT,
  source_retrieved_at TEXT,
  source_object_key TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (norm_id, version_id),
  FOREIGN KEY (norm_id) REFERENCES law_norms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_law_versions_current ON law_versions(norm_id, is_current);
CREATE INDEX IF NOT EXISTS idx_law_versions_validity ON law_versions(norm_id, valid_from, valid_to);

-- Der Normkörper wird absichtlich nicht als eine einzige große JSON-Zeile gespeichert.
-- Jeder äußere Body-Block ist separat. Dadurch bleibt die D1-Zeilengröße auch bei
-- sehr umfangreichen Vorschriften und Anlagen beherrschbar und der Normkörper kann
-- in seiner originalen Reihenfolge deterministisch rekonstruiert werden.
CREATE TABLE IF NOT EXISTS law_version_blocks (
  norm_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  block_index INTEGER NOT NULL,
  block_json TEXT NOT NULL,
  PRIMARY KEY (norm_id, version_id, block_index),
  FOREIGN KEY (norm_id, version_id)
    REFERENCES law_versions(norm_id, version_id)
    ON DELETE CASCADE
);

-- Quellenobjekte bilden die Brücke zum unveränderten R2-Archiv. Die eigentlichen
-- Rohbytes liegen nicht in D1. Für reine Repository-Quellen darf object_key NULL sein.
CREATE TABLE IF NOT EXISTS law_source_objects (
  norm_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  source_index INTEGER NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT,
  local_source TEXT,
  object_key TEXT,
  media_type TEXT,
  sha256 TEXT,
  retrieved_at TEXT,
  source_valid_from TEXT,
  source_valid_to TEXT,
  PRIMARY KEY (norm_id, version_id, source_index),
  FOREIGN KEY (norm_id, version_id)
    REFERENCES law_versions(norm_id, version_id)
    ON DELETE CASCADE
);

-- Den Suchindex füllen die Sync-Skripte ausschließlich mit der jeweils aktuellen
-- Fassung. norm_id/version_id/provision_path sind unindexierte Identitätsfelder.
CREATE VIRTUAL TABLE IF NOT EXISTS law_search USING fts5(
  norm_id UNINDEXED,
  version_id UNINDEXED,
  provision_path UNINDEXED,
  slug UNINDEXED,
  title,
  short_title,
  abbr,
  label,
  heading,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS law_runtime_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
