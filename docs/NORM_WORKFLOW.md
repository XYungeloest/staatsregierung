# Redaktionsworkflow für Normen

Der kanonische Eingang für neue Normen und Änderungsnormen ist eine amtliche HTML-Quelle unter
`Gesetze/`; vorhandene PDFs dienen der visuellen Gegenprüfung. Der Workflow arbeitet immer
dateibezogen und verändert weder andere Quellen noch `temp-neu/`.

## Ablauf

1. Amtliche HTML- und PDF-Dateien nach `Gesetze/` übernehmen und gegeneinander prüfen.
2. Den strikten Prüflauf starten:

   ```sh
   npm run norms:workflow -- --file "OGVBl. 2026 Nr. 60.html" --quick
   ```

3. Importkonfiguration, Normtyp, Titel, Kurztitel, Abkürzung, Zusammenfassung,
   `enactingBody`, `responsibleMinistry`, Sachgebiete und Beziehungen redaktionell prüfen.
4. Bei der ersten ostdeutschen Änderung einer übernommenen Stammnorm die am 1. November 2023
   geltende REVOSax-Fassung mit `npm run norms:revosax:fetch` sichern und parsen. Eine Folgefassung
   darf nur über ein geprüftes Rezept unter `data/recht/amendments/` entstehen.
5. Den gezielten Schreib- und vollständigen QA-Lauf ausführen:

   ```sh
   npm run norms:workflow -- --file "OGVBl. 2026 Nr. 60.html" --write
   ```

Mehrere `--file`-Argumente sind zulässig. `--quick` lässt die lange Build-, Browser-, Visual- und
Accessibility-Runde bewusst aus und ist nur für lokale Zwischenprüfungen gedacht.

## Abbruchbedingungen

Der Ablauf bricht vor einer Veröffentlichung ab, wenn eine ausgewählte Quelle strukturell nicht
erkannt wird, ein notwendiger REVOSax-Snapshot fehlt, ein Patch keinen eindeutigen Zielanker hat,
Gültigkeitsintervalle überlappen, eine fassungsspezifische Bezeichnung widersprüchlich ist oder
die Konsolidierung einen Sperrstatus meldet. Vorhandene Fassungsdateien werden nicht nachträglich
umgeschrieben; jede neue Rechtslage erhält eine neue, unveränderliche Fassung.

## Redaktionelle Nacharbeit

Nach dem Import sind Verkündungsbezüge, Stammfundstelle, kanonisches Vollzitat, betroffene und
verwandte Normen, Themen, Pressemitteilungen sowie mittelbare Auswirkungen und Querverweise zu
prüfen. Bestätigtes Kontextwissen wird mit Quellen und Gültigkeitszeitraum in den Wissenshub
überführt. Ungeprüftes Gesprächswissen verbleibt in `knowledge/conversation-candidates.json`.

Der vollständige Lauf prüft Content, Wissenshub, Unit-Tests, Astro/TypeScript, Editorial Worker,
beide Builds, Links, SEO, Browser, Accessibility und Visual-Baselines. Geänderte Screenshots
werden weiterhin erst nach Sichtprüfung als neue Baseline übernommen.
