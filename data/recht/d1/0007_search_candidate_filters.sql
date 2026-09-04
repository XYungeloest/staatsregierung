-- 0007: Trefferzählung der Rechtssuche und getrennte Begriffe „Rechtsänderung“ und „Aktivität“.
--
-- Die Kandidatenabfrage der Suche (apps/recht/src/pages/api/suche.json.ts) hat bisher nur Normtyp
-- und Rechtsherkunft serverseitig gefiltert; alle übrigen Filter wirkten erst im Browser. Das
-- gelieferte `total` beschrieb damit eine andere Menge als die angezeigte Trefferzahl. Diese
-- Migration ergänzt die schmalen Spalten, die dafür fehlen, und trennt zugleich die beiden
-- Bedeutungen von „zuletzt geändert“.
--
--   is_amendment        Änderungsvorschrift im Sinne von isAmendmentRecord (Normtyp, erlassene
--                       Norm, Titelmuster). Trägt den Filter „Änderungsvorschriften vollständig“
--                       (etwa zwei Drittel des Bestands) serverseitig.
--   last_activity_date  Jüngstes dokumentiertes Ereignis einschließlich reiner Hinweise;
--                       Grundlage für lastmod in der Sitemap.
--   last_change_date    Behält Name und Spalte, meint aber ab jetzt ausschließlich die
--                       Rechtsänderung (Erlass, Änderung, Aufhebung, Fassungsbeginn) ohne
--                       bloße Hinweise. Die Werte zieht der nächste Sync nach
--                       (docs/REVOSAX_BULK_IMPORT.md).
--
-- Die Spalten füllt der Sync (scripts/sync-recht-d1.mjs); die Backfills unten setzen bestehende
-- Zeilen sofort auf den richtigen Wert, damit zwischen Migration und Sync keine falsche Zählung
-- und kein falsches lastmod entsteht.
PRAGMA foreign_keys = ON;

ALTER TABLE law_norms ADD COLUMN last_activity_date TEXT;
ALTER TABLE law_norms ADD COLUMN is_amendment INTEGER NOT NULL DEFAULT 0;

-- Bestehende Zeilen: last_change_date trug bisher genau die Aktivität einschließlich Hinweisen.
UPDATE law_norms SET last_activity_date = last_change_date WHERE last_activity_date IS NULL;

-- Bestehende Zeilen: die Suchdokumente tragen isAmendment bereits als projizierten Wert.
UPDATE law_norms SET is_amendment = COALESCE((
  SELECT max(CASE WHEN json_extract(d.document_json, '$.isAmendment') IN (1, 'true') THEN 1 ELSE 0 END)
  FROM law_search_documents d WHERE d.norm_id = law_norms.id
), 0);

-- Verkündungsblatt und Jahr je Fassung als schmale Spalten statt als JSON-Auszug zur Abfragezeit.
ALTER TABLE law_versions ADD COLUMN publication_source TEXT;
ALTER TABLE law_versions ADD COLUMN publication_year TEXT;

UPDATE law_versions SET
  publication_source = json_extract(publication_ref_json, '$.publication'),
  publication_year = substr(json_extract(publication_ref_json, '$.publicationDate'), 1, 4)
WHERE publication_ref_json IS NOT NULL;

-- Die Kandidatenabfrage prüft je Norm, ob eine Fassung zu Fassungsart, Verkündungsblatt und Jahr
-- passt; der Index macht daraus einen Indexzugriff statt eines Fassungsdurchlaufs.
CREATE INDEX IF NOT EXISTS idx_law_versions_candidate ON law_versions(norm_id, temporal_kind, publication_source, publication_year);
CREATE INDEX IF NOT EXISTS idx_law_norms_amendment ON law_norms(is_amendment, last_change_date);

-- Statistiken für den Abfrageplaner nach Indexänderungen.
PRAGMA optimize;
