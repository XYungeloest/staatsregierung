# Offene Quellenfragen

**Repositoryprüfung:** 29. August 2026
**Redaktioneller Stichtag:** zentral in `packages/shared/src/config/editorial.json`

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

3 produktive SourceReferences aus 2 unterschiedlichen Markdownquellen verbleiben als
`legacy-markdown-transcription`. Davon betrifft eine Quelle einen echten Quellenkonflikt zwischen
Markdown und PDF (OGVBl. 2025 Nr. 10); bei der zweiten fehlt eine ausreichende Kontrollquelle für
die vollständige Fassung (OGVBl. 2024 Nr. 2 S. 2). Die elf übrigen Quellen wurden nach
Strukturprüfung und PDF-Gegenkontrolle über die bestehende Pipeline in strukturtragende
HTML-Quellen überführt. Ihre Roh-Markdowndateien bleiben ausschließlich als ergänzende
Provenienz-/Regressionsquellen erhalten. Die Einzelklassifikationen und konkreten Blockierungsgründe
stehen in `data/recht/alt-source-inventory.json`.

## Dauerhafte Quellenbegrenzung

Für die dritte Plenarsitzung vom 20. Juli 2026 liegt kein Plenarprotokoll mit Redebeiträgen,
Einzelabstimmungen und Stimmenzahlen vor. Die Verkündungen belegen Beschluss und Verkündung der
betroffenen Vorhaben, nicht aber den Beratungsverlauf oder konkrete Abstimmungszahlen. Solche
Details werden ohne zusätzliche Primärquelle nicht ergänzt.
