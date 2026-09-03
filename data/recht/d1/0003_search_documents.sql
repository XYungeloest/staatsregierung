-- Suchdokumente je Fassung (Metadaten ohne Provisionstext), damit historische und
-- künftige Fassungen über Titel, Fundstelle und Metadaten auffindbar bleiben, während
-- der FTS5-Index law_search nur die jeweils geltende Fassung provisionsgenau trägt.
CREATE TABLE IF NOT EXISTS law_search_documents (
  norm_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  document_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (norm_id, version_id),
  FOREIGN KEY (norm_id) REFERENCES law_norms(id) ON DELETE CASCADE
);
