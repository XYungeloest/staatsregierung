# Offene Quellenfragen

Diese Datei enthält ausschließlich Quellenlücken, Quellenkonflikte und notwendige Quellenarbeiten,
die im aktuellen Repository offen sind. Jeder Eintrag nennt Fundstelle, Grund und das, was zur
Lösung fehlt. Gelöste Fälle werden entfernt; der maschinenlesbare Einzelstand der
Normkonsolidierung steht in `data/recht/consolidation-manifest.json`, die Bilanz der
REVOSax-Übernahme in `data/recht/revosax-import-audit/summary.json`.

## REVOSax-Übernahme (Ausgangsbestand 1. November 2023)

- **Europäisches Übereinkommen über das grenzüberschreitende Fernsehen (REVOSax 1018)** —
  REVOSax hält den Text nur als PDF-Anlagen vor; das Übereinkommen selbst ist ein Scan ohne
  Textebene. Ohne manuell geprüfte Texterkennung wird kein Normtext erzeugt; die Anlagen sind
  hashverifiziert in R2 archiviert (dokumentierter SKIP in
  `data/recht/revosax-baseline-decisions.json`).
- **Änderungs-VwV mit reiner Fragebogen-Anlage (REVOSax 17114)** — die einzige Anlage hat eine
  Textebene, ist aber ein Formular und kein Normtext; sie wird nicht als Paragraphentext
  umgedeutet (dokumentierter SKIP, Anlage in R2).
- **Richtlinie Hilfe Wohngebäude und Unternehmen 2014 (REVOSax 14011.1)** — der übernommene Text
  befristet die Richtlinie auf den 31. Dezember 2015, REVOSax führt die Fassung jedoch bis zum
  31. Dezember 2023 als geltend. Ohne weitere amtliche Quelle ist nicht entscheidbar, ob eine
  Verlängerung vorlag; die Norm bleibt unverändert, der Fall ist in
  `data/recht/revosax-sunset-decisions.json` als offen dokumentiert.

## Sächsische Rechtsakte nach dem Überleitungsstichtag

Erlassdatum oder Fassungsbeginn nach dem 1. November 2023 werden in
`data/recht/revosax-post-cutoff-decisions.json` entschieden (`discard`, `adopted`, `open`). Offen
bleibt ein Fall:

- **VwV Größere Raubtiere** (`vwv-groessere-raubtiere`, REVOSax 21231) — die amtliche Trefferliste
  nennt als Erlassdatum den 30. Mai 2025, die übernommene Fassung gilt aber seit dem 1. Juli 2023
  und wurde für den Stichtag ausgeliefert. Ohne weitere amtliche Quelle ist nicht entscheidbar, ob
  die Vorschrift am Stichtag in dieser Fassung galt; sie bleibt unverändert im Bestand.

## Rechtsherkunft nicht belegbar (`origin-unresolved`)

Die Herkunftsklasse wird aus Quellen, Fundstellen und Historie abgeleitet
(`packages/shared/src/lib/norms/origin.ts`); `npm run test:unit -- tests/norm-origin-metadata.test.ts`
zählt die Klassen. Vier Normen lassen sich nach den geltenden Regeln nicht zuordnen, weil das
Herkunftsmodell nur die Übernahme des sächsischen Rechtsstands zum 1. November 2023 und die eigene
ostdeutsche Setzung kennt:

- **Ostdeutsches Zweckentfremdungsverbotsgesetz** (`zweckentfremdungsverbotsgesetz`) — sächsisches
  Gesetz vom 14. Februar 2024 (SächsGVBl. S. 167, REVOSax 20743.1, gültig ab 19. März 2024), also
  nach dem Stichtag erlassen und dennoch übernommen; ostdeutsche Änderung durch OGVBl. 2026
  Nr. 29. Die Übernahme ist als `adopted` in `data/recht/revosax-post-cutoff-decisions.json`
  belegt; offen bleibt allein die Herkunftsklasse, weil das Modell nur Übernahme zum Stichtag und
  eigene ostdeutsche Setzung kennt.
- **Ostdeutsches Gleichstellungsgesetz** (`saechsisches-gleichstellungsgesetz`) — sächsisches
  Gesetz vom 19. Oktober 2023 (SächsGVBl. S. 850, REVOSax 20283.1), am Stichtag verkündet, aber
  erst am 1. Januar 2024 in Kraft; ostdeutsche Änderung durch OGVBl. 2026 Nr. 35. Die Übernahme
  ist in `data/recht/revosax-post-cutoff-decisions.json` als `adopted` belegt; offen ist, ob am
  Stichtag verkündetes, noch nicht geltendes Recht als übernommen gilt.
- **Ausbildungs- und Prüfungsordnung Polizei** (`ausbildungs-und-pruefungsordnung-polizei`) —
  sächsische Verordnung vom 6. August 2024, Fassung ab 1. September 2025 (REVOSax 21006.2),
  ostdeutsche Änderung durch OGVBl. 2026 Nr. 12; die Übernahme ist wie beim
  Zweckentfremdungsverbotsgesetz in `data/recht/revosax-post-cutoff-decisions.json` als `adopted`
  belegt, die Herkunftsklasse bleibt offen.
- **Oberstufen- und Abiturprüfungsverordnung** (`oberstufenund-abiturprufungsverordnung`) — die
  2024 geänderte Verordnung war bereits seit dem 1. August 2008 außer Kraft
  (`knowledge/clarifications/2026-08-27-zuarbeit-pdfnachtrag.md`); der Datensatz trägt weder eine
  REVOSax-Quelle noch eine eigene Ausgangsfassung. Ohne amtliche Quelle der 1996er Verordnung bleibt
  die Herkunft ungeklärt.

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

`npm run norms:consolidation:audit` erzeugt `data/recht/consolidation-report.md` mit den offenen
Zielnormen. Derzeit blockieren vier Quellenkonflikte und eine fehlende Ausgangsfassung:

- **Gesetz über den öffentlichen Personennahverkehr** — `blocked-source-conflict`: Artikel 9
  Nummer 1 passt nicht eindeutig auf die maßgebliche Ausgangsfassung; ohne Quellenklärung wird
  keine Folgefassung erzeugt.
- **NDR-Staatsvertrag** — `missing-baseline`: Die maßgebliche Ausgangsfassung ist durch die
  korrigierte Ausgabe als NDR-Staatsvertrag vom 4./9. März 2021 (GVOBl. M-V S. 797) eindeutig
  bezeichnet; sie ist jedoch noch nicht unverändert im Repository versioniert und damit noch keine
  Konsolidierungsbaseline (Zuarbeit Q-01 in `docs/ZUARBEITSFORMULAR.md`).
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

## Legacy-Transkriptionen

Drei produktive Quellenreferenzen aus zwei Markdownquellen verbleiben als
`legacy-markdown-transcription`: OGVBl. 2025 Nr. 10 ist wegen eines Konflikts zwischen Markdown
und PDF blockiert, für OGVBl. 2024 Nr. 2 S. 2 fehlt eine ausreichende Kontrollquelle für die
vollständige Fassung. Klassifikation und Blockierungsgründe stehen in
`data/recht/alt-source-inventory.json`.

## Dauerhafte Quellenbegrenzung

Für die dritte Plenarsitzung vom 20. Juli 2026 liegt kein Plenarprotokoll mit Redebeiträgen,
Einzelabstimmungen und Stimmenzahlen vor. Die Verkündungen belegen Beschluss und Verkündung der
betroffenen Vorhaben, nicht aber den Beratungsverlauf oder konkrete Abstimmungszahlen. Solche
Details werden ohne zusätzliche Primärquelle nicht ergänzt.
