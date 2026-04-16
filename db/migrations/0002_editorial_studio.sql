CREATE TABLE IF NOT EXISTS editor_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (
    type IN (
      'pressemitteilung',
      'termin',
      'stellenangebot',
      'projektstatus',
      'service-seite',
      'themenseite',
      'ressort',
      'regierungsmitglied'
    )
  ),
  slug TEXT NOT NULL,
  route TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'export_ready')),
  publish_mode TEXT NOT NULL CHECK (publish_mode IN ('direct', 'export')),
  author TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  content_json TEXT NOT NULL,
  current_version_id TEXT,
  current_version_number INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  UNIQUE(type, slug)
);

CREATE INDEX IF NOT EXISTS idx_editor_entries_type_status
  ON editor_entries (type, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_editor_entries_updated_at
  ON editor_entries (updated_at DESC);

CREATE TABLE IF NOT EXISTS editor_versions (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'export_ready')),
  action TEXT NOT NULL CHECK (action IN ('draft_save', 'publish', 'export')),
  author TEXT,
  summary TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  content_json TEXT NOT NULL,
  published_payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entry_id) REFERENCES editor_entries(id) ON DELETE CASCADE,
  UNIQUE(entry_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_editor_versions_entry_created_at
  ON editor_versions (entry_id, created_at DESC);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  credit TEXT,
  mime_type TEXT,
  byte_size INTEGER,
  filename TEXT,
  author TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_assets_created_at
  ON media_assets (created_at DESC);

CREATE TABLE IF NOT EXISTS publish_log (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  version_id TEXT,
  target_type TEXT NOT NULL,
  target_identifier TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('direct', 'export')),
  status TEXT NOT NULL CHECK (status IN ('success', 'prepared', 'failed')),
  detail TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entry_id) REFERENCES editor_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_publish_log_entry_created_at
  ON publish_log (entry_id, created_at DESC);
