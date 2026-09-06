-- 0008: Grundmenge, Ordnungswort, Förderbereich und Art der Stichworteinträge.
--
-- Vier projizierte Werte, die Verzeichnisse, A–Z und Sachgebiete bisher zur Abfragezeit nicht
-- ausdrücken konnten:
--
--   in_inventory  Gehört die Vorschrift zur Grundmenge des Rechtsbestands? Übernommene
--                 Änderungsvorschriften (Normtyp aenderungsvorschrift mit übernommener Herkunft)
--                 sind historische Änderungsträger und stehen nicht neben den Stammnormen; sie
--                 bleiben über den Normtypfilter, das Häkchen der Verzeichnisse, die Beziehungen
--                 der geänderten Vorschrift und die Suche erreichbar. Die Regel steht einmal in
--                 packages/shared/src/lib/norms/inventory.ts; die Spalte macht sie indexierbar.
--   sort_word     Sortierschlüssel des Ordnungsworts (erstes inhaltstragendes Wort der
--                 Bezeichnung, ohne Rechtsform, erlassende Stelle, Artikel und Präposition;
--                 kleingeschrieben, Umlaute aufgelöst, ß als ss). SQLite sortiert binär – ohne
--                 aufgelöste Umlaute stünde „Ärzte“ hinter „Zoll“.
--   funding_area  Amtlicher Förderbereich (550–559) einer Förderrichtlinie aus meta.fundingArea.
--   kind          Herkunft eines Stichworteintrags: register (redaktionelles Stichwortregister),
--                 abbr, short-title oder derived (abgeleitete Schlagwörter). Das A–Z zeigt
--                 Register sowie Abkürzungen und Kurztitel getrennt; abgeleitete Titelwörter
--                 bleiben nur noch durchsuchbar.
--
-- Expand/Contract: die Werte füllt der Sync (scripts/sync-recht-d1.mjs). Die Backfills setzen
-- bestehende Zeilen sofort auf einen tragfähigen Wert, damit zwischen Migration und Projektion
-- weder eine falsche Bestandszahl noch eine leere Sortierung entsteht; der Worker liest
-- sort_word mit COALESCE auf sort_title.
PRAGMA foreign_keys = ON;

ALTER TABLE law_norms ADD COLUMN in_inventory INTEGER NOT NULL DEFAULT 1;
ALTER TABLE law_norms ADD COLUMN sort_word TEXT;
ALTER TABLE law_norms ADD COLUMN funding_area TEXT;
ALTER TABLE law_norm_keywords ADD COLUMN kind TEXT NOT NULL DEFAULT 'derived';

-- Bestehende Zeilen: Grundmenge aus Normtyp und Rechtsherkunft, beides bereits projizierte Spalten.
UPDATE law_norms SET in_inventory = CASE
  WHEN type = 'aenderungsvorschrift' AND origin_kind IN ('inherited-unchanged', 'inherited-amended') THEN 0
  ELSE 1
END;

-- Bestehende Zeilen: der kleingeschriebene Titel ist bis zur nächsten Projektion die beste
-- verfügbare Näherung des Sortierschlüssels.
UPDATE law_norms SET sort_word = sort_title WHERE sort_word IS NULL;

-- Verzeichnisse lesen ihre Seiten sortiert über den Index: Grundmenge zuerst, dann das jeweilige
-- Auswahlmerkmal, zuletzt das Ordnungswort.
CREATE INDEX IF NOT EXISTS idx_law_norms_inventory_letter ON law_norms(in_inventory, index_letter, sort_word);
CREATE INDEX IF NOT EXISTS idx_law_norms_inventory_type ON law_norms(in_inventory, type, sort_word);
CREATE INDEX IF NOT EXISTS idx_law_norms_inventory_origin ON law_norms(in_inventory, origin_kind, sort_word);
CREATE INDEX IF NOT EXISTS idx_law_norms_inventory_status ON law_norms(in_inventory, status, sort_word);
CREATE INDEX IF NOT EXISTS idx_law_norm_keywords_kind ON law_norm_keywords(kind, index_letter, keyword);

-- Statistiken für den Abfrageplaner nach Indexänderungen.
PRAGMA optimize;
