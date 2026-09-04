# Offene Quellenfragen

**Repositoryprüfung:** 4. September 2026
**Redaktioneller Stichtag:** zentral in `packages/shared/src/config/editorial.json`

Diese Datei enthält ausschließlich Quellenlücken, Quellenkonflikte und notwendige Quellenarbeiten,
die im aktuellen Repository noch offen sind. Der maschinenlesbare Einzelstand der
Normkonsolidierung steht in `data/recht/consolidation-manifest.json`.

## REVOSax-Übernahme (Ausgangsbestand 1. November 2023)

Die Bilanz der Übernahme steht maschinenlesbar in `data/recht/revosax-import-audit/summary.json`;
offen bleiben drei Quellenfragen:

- **Europäisches Übereinkommen über das grenzüberschreitende Fernsehen (REVOSax 1018)** —
  REVOSax hält den Text nur als PDF-Anlagen vor; das Übereinkommen selbst ist ein Scan ohne
  Textebene. Ohne manuell geprüfte Texterkennung wird kein Normtext erzeugt; die Anlagen sind
  hashverifiziert in R2 archiviert (dokumentierter SKIP).
- **Änderungs-VwV mit reiner Fragebogen-Anlage (REVOSax 17114)** — die einzige Anlage hat eine
  Textebene, ist aber ein Formular und kein Normtext; sie wird nicht als Paragraphentext
  umgedeutet (dokumentierter SKIP, Anlage in R2).
- **Richtlinie Hilfe Wohngebäude und Unternehmen 2014 (REVOSax 14011.1)** — der übernommene Text
  befristet die Richtlinie auf den 31. Dezember 2015, REVOSax führt die Fassung jedoch bis zum
  31. Dezember 2023 als geltend. Ohne weitere amtliche Quelle ist nicht entscheidbar, ob eine
  Verlängerung vorlag; die Norm bleibt unverändert, der Fall ist in
  `data/recht/revosax-sunset-decisions.json` als offen dokumentiert.

## Bekanntmachungen zur Interflug (StAnzO. 2026 Nr. 39 und 40)

- **Bekanntmachung des Staatsrates über die Bestellung des Gründungsvorstandes der Interflug
  (StAnzO. 2026 Nr. 39)** — der amtliche Text zitiert „§ 24 Absatz 3“, „§ 24 Absatz 4“ und
  „§ 10 Absatz 2 des Interflug-Gesetzes“. Im verkündeten Interflug-Gesetz (OGVBl. 2026 Nr. 74)
  regeln § 23 Absatz 3 und 4 den Gründungsvorstand und § 14 Absatz 2 die Bestellung des Vorstandes
  durch den Verwaltungsrat; § 24 existiert nicht, § 10 betrifft das betriebsnotwendige Vermögen.
  Der Wortlaut der Bekanntmachung wird unverändert wiedergegeben; die Abweichung ist im
  Datierungshinweis der Norm dokumentiert und wird nicht redaktionell korrigiert, solange keine
  amtliche Berichtigung vorliegt. HTML und PDF beider Ausgaben stimmen überein.

## Rechtskonsolidierung

Der Audit erkennt 89 Zielnormen; 84 sind vollständig konsolidiert. Fünf Fälle bleiben offen:

- **Gesetz über den öffentlichen Personennahverkehr** — `blocked-source-conflict`: Artikel 9
  Nummer 1 passt nicht eindeutig auf die maßgebliche Ausgangsfassung; ohne Quellenklärung wird
  keine Folgefassung erzeugt.
- **NDR-Staatsvertrag** — `missing-baseline`: Die maßgebliche Ausgangsfassung ist durch die
  korrigierte Ausgabe als NDR-Staatsvertrag vom 4./9. März 2021 (GVOBl. M-V S. 797) eindeutig
  bezeichnet; sie ist jedoch noch nicht unverändert im Repository versioniert und damit noch keine
  Konsolidierungsbaseline.
- **Ostdeutsche Gemeindeordnung** — `blocked-source-conflict`: Artikel 1 des Gesetzes zur
  Einführung von Hinweisgebermeldestellen ordnet nach § 71a einen neuen § 71b an. Die ausdrücklich
  als zuletzt geändert bezeichnete Fassung vom 20. Juli 2026 enthält jedoch bereits § 71b bis § 71g;
  ohne Berichtigung ist keine Umnummerierung oder Verdrängung ableitbar.
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
