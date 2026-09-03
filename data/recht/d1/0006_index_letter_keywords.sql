-- 0006: Buchstabenindex und Stichworttabelle für skalierbare Übersichten.
--
-- A–Z und Rechtsentwicklung liefern nicht mehr den gesamten Bestand in einer Seite,
-- sondern filtern und paginieren serverseitig. Dafür erhält law_norms die Spalte
-- index_letter (A–Z oder '#', nach derselben Regel wie getGermanIndexLetter im Portal:
-- erstes Zeichen des Titels, Ä/Ö/Ü wie A/O/U, alles andere '#') mit Index über
-- (index_letter, sort_title); Herkunft und Status erhalten Indizes mit sort_title als
-- zweiter Spalte, damit gefilterte Listen sortiert über den Index gelesen werden.
-- law_norm_keywords hält die Einträge des Stichwortindex (Abkürzung, Kurzbezeichnung,
-- Schlagwörter) je Norm mit Buchstabengruppe. Bestehende Zeilen werden per SQL gefüllt;
-- der Sync schreibt dieselben Werte je Norm.
PRAGMA foreign_keys = ON;

ALTER TABLE law_norms ADD COLUMN index_letter TEXT NOT NULL DEFAULT '#';

UPDATE law_norms SET index_letter = CASE
  WHEN substr(ltrim(title), 1, 1) IN ('Ä', 'ä') THEN 'A'
  WHEN substr(ltrim(title), 1, 1) IN ('Ö', 'ö') THEN 'O'
  WHEN substr(ltrim(title), 1, 1) IN ('Ü', 'ü') THEN 'U'
  WHEN upper(substr(ltrim(title), 1, 1)) BETWEEN 'A' AND 'Z' AND length(upper(substr(ltrim(title), 1, 1))) = 1 THEN upper(substr(ltrim(title), 1, 1))
  ELSE '#'
END;

CREATE INDEX IF NOT EXISTS idx_law_norms_index_letter ON law_norms(index_letter, sort_title);
CREATE INDEX IF NOT EXISTS idx_law_norms_origin_kind ON law_norms(origin_kind, sort_title);
CREATE INDEX IF NOT EXISTS idx_law_norms_status_sort ON law_norms(status, sort_title);
CREATE INDEX IF NOT EXISTS idx_law_norms_type_sort ON law_norms(type, sort_title);

CREATE TABLE IF NOT EXISTS law_norm_keywords (
  norm_id TEXT NOT NULL REFERENCES law_norms(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  index_letter TEXT NOT NULL,
  PRIMARY KEY (norm_id, keyword)
);
CREATE INDEX IF NOT EXISTS idx_law_norm_keywords_letter ON law_norm_keywords(index_letter, keyword, norm_id);

-- Bestehende Zeilen: Abkürzung, Kurzbezeichnung und Schlagwörter (mindestens zwei Zeichen).
INSERT OR IGNORE INTO law_norm_keywords (norm_id, keyword, index_letter)
  SELECT n.id, trim(k.value), CASE
    WHEN substr(ltrim(k.value), 1, 1) IN ('Ä', 'ä') THEN 'A'
    WHEN substr(ltrim(k.value), 1, 1) IN ('Ö', 'ö') THEN 'O'
    WHEN substr(ltrim(k.value), 1, 1) IN ('Ü', 'ü') THEN 'U'
    WHEN upper(substr(ltrim(k.value), 1, 1)) BETWEEN 'A' AND 'Z' AND length(upper(substr(ltrim(k.value), 1, 1))) = 1 THEN upper(substr(ltrim(k.value), 1, 1))
    ELSE '#'
  END
  FROM law_norms n, json_each(json_array(n.abbr, n.short_title)) AS k
  WHERE k.value IS NOT NULL AND length(trim(k.value)) >= 2;
INSERT OR IGNORE INTO law_norm_keywords (norm_id, keyword, index_letter)
  SELECT n.id, trim(k.value), CASE
    WHEN substr(ltrim(k.value), 1, 1) IN ('Ä', 'ä') THEN 'A'
    WHEN substr(ltrim(k.value), 1, 1) IN ('Ö', 'ö') THEN 'O'
    WHEN substr(ltrim(k.value), 1, 1) IN ('Ü', 'ü') THEN 'U'
    WHEN upper(substr(ltrim(k.value), 1, 1)) BETWEEN 'A' AND 'Z' AND length(upper(substr(ltrim(k.value), 1, 1))) = 1 THEN upper(substr(ltrim(k.value), 1, 1))
    ELSE '#'
  END
  FROM law_norms n, json_each(n.keywords_json) AS k
  WHERE k.value IS NOT NULL AND length(trim(k.value)) >= 2;

-- Statistiken für den Abfrageplaner nach Indexänderungen.
PRAGMA optimize;
