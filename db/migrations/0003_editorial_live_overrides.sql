ALTER TABLE editor_entries
  ADD COLUMN published_version_id TEXT;

CREATE INDEX IF NOT EXISTS idx_editor_entries_type_slug_published_version
  ON editor_entries (type, slug, published_version_id);

UPDATE editor_entries
SET published_version_id = current_version_id
WHERE status = 'published'
  AND published_version_id IS NULL;
