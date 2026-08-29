# Offene Quellenfragen

**Repositoryprüfung:** 29. August 2026
**Redaktioneller Stichtag:** zentral in `src/config/editorial.json`

Diese Datei enthält ausschließlich Quellenlücken, Quellenkonflikte und notwendige Quellenarbeiten,
die im aktuellen Repository noch offen sind. Der maschinenlesbare Einzelstand der
Normkonsolidierung steht in `data/recht/consolidation-manifest.json`.

## Rechtskonsolidierung

Der Audit erkennt 85 Zielnormen; 81 sind vollständig konsolidiert. Vier Fälle bleiben offen:

- **Gesetz über den öffentlichen Personennahverkehr** — `blocked-source-conflict`: Artikel 9
  Nummer 1 passt nicht eindeutig auf die maßgebliche Ausgangsfassung; ohne Quellenklärung wird
  keine Folgefassung erzeugt.
- **NDR-Staatsvertrag** — `missing-baseline`: Die vollständige maßgebliche Ausgangsfassung vor
  der Änderung vom 8. März 2026 einschließlich Anlagen fehlt.
- **Schulordnung Förderschulen** — `blocked-source-conflict`: Artikel 1 Nummer 6 Buchstabe b
  der OGVBl. 2026 Nr. 64 passt auch nach der Berichtigung in Nr. 68 nicht auf die verbindliche
  Ausgangsfassung.
- **Zehntes Sächsisches Kostenverzeichnis** — `blocked-source-conflict`: Der Änderungsbefehl zu
  Tarifplatz 3 widerspricht dem vorhandenen Ausgangsbestand; der Zieltext ist nicht eindeutig
  ableitbar.

## Noch notwendige Quellenarbeit

### Legacy-Transkriptionen

25 produktive SourceReferences verwenden weiterhin `legacy-markdown-transcription`. Sie betreffen
13 unterschiedliche Markdownquellen aus den Ausgaben OABl. 2025 Nr. 1, 3–6, OGVBl. 2025 Nr. 8–12,
OGVBl. 2026 Nr. 12 und 44 sowie OGVBl. 2024 Nr. 2 S. 2. Für keine dieser Quellen liegt derzeit
eine gleichartige strukturtragende HTML-Fassung vor. Bei den meisten Ausgaben liegt zwar ein
zugehöriges PDF als visuelle Kontrollquelle vor; daraus wird ohne geprüfte Strukturtranskription
kein neuer Normvolltext abgeleitet. Die einzelnen Abhängigkeiten und Blockierungsgründe stehen in
`data/recht/alt-source-inventory.json`.

Eine Migration erfolgt nur, wenn eine strukturtragende HTML-Quelle oder eine gleichwertig geprüfte
Transkription vorliegt. Bis dahin bleiben die vorhandenen Markdownquellen für Provenienz und
Regression sowie die bestehende PDF-Gegenprüfung erhalten.

## Dauerhafte Quellenbegrenzung

Für die dritte Plenarsitzung vom 20. Juli 2026 liegt kein Plenarprotokoll mit Redebeiträgen,
Einzelabstimmungen und Stimmenzahlen vor. Die Verkündungen belegen Beschluss und Verkündung der
betroffenen Vorhaben, nicht aber den Beratungsverlauf oder konkrete Abstimmungszahlen. Solche
Details werden ohne zusätzliche Primärquelle nicht ergänzt.
