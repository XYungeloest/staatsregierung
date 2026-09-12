# Redaktionsworkflow für Normen

Der kanonische Eingang für neue Normen und Änderungsnormen ist eine amtliche HTML-Quelle unter
`Gesetze/`; vorhandene PDFs dienen der visuellen Gegenprüfung. Der Workflow arbeitet immer
dateibezogen und verändert weder andere Quellen noch `temp-neu/`.

Dieses Dokument beschreibt den Normteil. Der vollständige Eingangsablauf über alle Inhaltsarten —
einschließlich der Schritte, die `npm run norms:workflow` nicht ausführt (`docs:check`,
`norms:publications:pdf-sync`, Screenshot-Baselines, D1-Prüfung, Organisations-Snapshot) — steht in
[`docs/EINPFLEGE_PLAYBOOK.md`](EINPFLEGE_PLAYBOOK.md).

## Ablauf

1. Amtliche HTML- und PDF-Dateien nach `Gesetze/` übernehmen und gegeneinander prüfen.
2. Den strikten Prüflauf starten:

   ```sh
   npm run norms:workflow -- --file "OGVBl. 2026 Nr. 60.html" --quick
   ```

3. Importkonfiguration, Normtyp, Titel, Kurztitel, Abkürzung, Zusammenfassung,
   `enactingBody`, `responsibleMinistry`, Sachgebiete und Beziehungen redaktionell prüfen.
   Dabei gilt das Titelmodell: `title` ist der amtliche Langtitel, `shortTitle` nur eine echte
   Kurzbezeichnung, `abbr` nur eine echte Abkürzung; abkürzungsartige Bezeichnungen gehören in
   `keywords`. Die Zusammenfassung ist eine redaktionelle Kurzbeschreibung; nur eine aus Typ und
   Titel gebildete Formel des Massenimports trägt `summarySource: "derived"` und bleibt öffentlich
   unsichtbar. Eigene Vorschriften brauchen immer eine echte Kurzbeschreibung.
   Sachgebiete stammen aus der amtlichen Systematik (`packages/shared/src/config/law-subjects.json`);
   `primarySubject` ist das erste Sachgebiet, Förderrichtlinien tragen zusätzlich `fundingArea`.
4. Bei der ersten ostdeutschen Änderung einer übernommenen Stammnorm die am 1. November 2023
   geltende REVOSax-Fassung mit `npm run norms:revosax:fetch` sichern und parsen. Die gespeicherte
   HTML-Datei unter `data/recht/sources/revosax/` ist unveränderliche Quellenbeweissicherung.
   Beim Parsen werden ausschließlich die semantischen REVOSax-Anzeigeelemente
   `<sup class="satzzahl">…</sup>` verworfen; gewöhnliche Hochstellungen und der übrige
   Quelltext bleiben erhalten. Nach einer Parseränderung werden alle abgeleiteten Snapshots
   kontrolliert mit `npm run norms:revosax:parse -- --all` neu erzeugt. Eine Folgefassung darf
   nur über ein geprüftes Rezept unter `data/recht/amendments/` entstehen; die daraus abgeleiteten
   Normfassungen werden anschließend mit `node scripts/consolidate-norms.mjs --all --write`
   aktualisiert. Fehlt der Stammnormdatensatz trotz gesichertem Snapshot, wird er über
   `npm run norms:revosax:materialize -- --all --write` aus dem dynamisch ermittelten
   Konsolidierungsbestand angelegt. Nach Parseränderungen werden bereits materialisierte,
   deterministisch erzeugte Ausgangsfassungen kontrolliert mit
   `npm run norms:revosax:materialize -- --all --update-existing --write` regeneriert;
   redaktionelle Folgefassungen entstehen weiterhin ausschließlich durch die Konsolidierung.
5. Amtliche Berichtigungen werden als eigene Verkündungen importiert und über deklaratorische
   Rezepte unter `data/recht/corrections/` angewandt. Sie korrigieren die betroffene gespeicherte
   Fassung samt Provenienz, erzeugen aber weder einen neuen materiellen Wirksamkeitstag noch eine
   künstliche zusätzliche Fassung. Originalquellen bleiben unverändert.
6. Original-PDFs werden unabhängig vom Alter der Ausgabe über
   `npm run norms:publications:pdf-sync -- --write` den Verkündungen zugeordnet und als
   deploybare Rechtsassets bereitgestellt; der öffentliche Dateiname ist der Slug der Ausgabe
   (`public/assets/recht/<slug>.pdf`), der interne Quellenname unter `Gesetze/` bleibt unverändert.
   HTML bleibt die strukturtragende Transkription,
   PDF die amtliche visuelle Kontrollquelle; abweichende historische Dateinamen brauchen eine
   eindeutige, geprüfte Zuordnung. Der Lauf übernimmt das Prüfdatum (`verifiedAt`) der Ausgabe
   auf die zugeordneten Normen und setzt ein bereits dokumentiertes späteres Prüfdatum derselben
   Datei nie zurück (`preserveVerifiedAt` in `scripts/lib/publication-pdf.mjs`).
7. Den gezielten Schreib- und vollständigen QA-Lauf ausführen:

   ```sh
   npm run norms:workflow -- --file "OGVBl. 2026 Nr. 60.html" --write
   ```

Mehrere `--file`-Argumente sind zulässig. `--quick` lässt Build und UI-Smokes bewusst aus und ist
nur für lokale Zwischenprüfungen gedacht.

Ein Schreiblauf verändert außer den Dateien der eingepflegten Quelle nichts. Der Materialisierer und
die Konsolidierung erzeugen übernommene Normen zwar vollständig neu, übernehmen dabei aber die
redaktionelle Metadatenebene aus dem gespeicherten Datensatz: Titel, Kurzbezeichnung und Abkürzung
folgen dem Titelmodell (`resolveIdentityFields` in `scripts/lib/norm-title-rules.mjs`), und die
gepflegte Fundstellennummer der amtlichen Quelle (`fsnNumber`) überlebt die Neuerzeugung der
Quellenangabe (`retainFsnNumber`). **Daraus folgt: eine Vorschrift wird in
`content/normen/<slug>/meta.json` umbenannt, nicht in `data/recht/consolidation-sources.json`.**
`resultTitle`, `resultShortTitle` und `resultAbbr` legen die Bezeichnung nur bei der Neuanlage an
und bleiben für vorhandene Normen wirkungslos. Nach jedem Schreiblauf gegenprüfen:

```sh
git status --porcelain -- content/normen   # nur die Verzeichnisse der eingepflegten Quelle
```

Ziele mit redaktionell versionierter Ausgangsfassung (`existingVersionSeed` in
`data/recht/consolidation-sources.json`) laufen bewusst nur über `--target`, nicht über `--all`.
Die Rechtsüberleitung des Ergebnisses (`applyRechtsueberleitung`) wird nur auf Ziele mit
REVOSax-Provenienz angewandt (`usesRechtsueberleitung`); eigene ostdeutsche Vorschriften behalten
ihre Eigennamen. Beginnt die Geltung der Ausgangsfassung nach ihrer Fassungskennung (verkündet am
23. März, in Kraft am 25. März), nennt der Seed den Geltungsbeginn ausdrücklich
(`existingVersionSeed: { versionId, validFrom }`), zusammen mit `baselineVersionDate` für den
Vollständigkeitsnachweis der Fassungsfolge. Der Importer setzt beim erneuten Einlesen der
Verkündungsquelle das Gültigkeitsende einer so fortgeschriebenen Ausgangsfassung nicht zurück
(`reconcileVersionIntervals`). Nach einer Änderung an einem solchen Ziel ist
`data/recht/consolidation-manifest.json` gegenzuprüfen.

Trägt eine amtliche Ausgabe selbst eine Nummerierungslücke (HTML und PDF stimmen überein, etwa
Artikel 5 in OGVBl. 2026 Nr. 77 mit den Nummern 1., 3., 4., 5.), lässt der Parser genau diesen
wörtlich hinterlegten Befund zu: `ACCEPTED_SEQUENCE_ISSUES` in
`scripts/lib/norm-parser-contract.mjs` nennt je Datei die Befunde und den PDF-Nachweis; jeder
andere Nummerierungsbefund bleibt ein Abbruchgrund. Die Ausgabe erhält dazu einen
`sourceNotes`-Hinweis in der Importkonfiguration.

Nach einer Änderung am HTML- oder Markdown-Parser werden die betroffenen eigenen Verkündungen
gezielt neu eingelesen:

```sh
npm run norms:import -- --write --update-existing --file "OGVBl. 2026 Nr. 40.html"
npm run norms:import -- --source-dir Gesetze --strict --quiet
```

Der Unterschriftenblock einer Verkündung (`signature`) entsteht dabei allein aus der amtlichen
Quelle. Quellen, deren interne Metadaten nicht zu einem vorhandenen Verkündungsdatensatz passen,
und Normen ohne HTML-Quelle bleiben unangetastet; sie werden redaktionell gepflegt und der Schritt
im Commit begründet.

## Abbruchbedingungen

Der Ablauf bricht vor einer Veröffentlichung ab, wenn eine ausgewählte Quelle strukturell nicht
erkannt wird, ein notwendiger REVOSax-Snapshot fehlt, ein Patch keinen eindeutigen Zielanker hat,
Gültigkeitsintervalle überlappen, eine fassungsspezifische Bezeichnung widersprüchlich ist oder
die Konsolidierung einen Sperrstatus meldet. Vorhandene Fassungsdateien werden nicht nachträglich
umgeschrieben; jede neue Rechtslage erhält eine neue, unveränderliche Fassung.

## Redaktionellen Stichtag fortschreiben

Der redaktionelle Stichtag steht ausschließlich in `packages/shared/src/config/editorial.json`.
Er entscheidet, welche gespeicherte Fassung als geltend gilt und welchen Status eine Norm im
Gitbestand trägt (`future-effective` nur bis zum Inkrafttreten, `in-force` nur bis zum
Außerkrafttreten). Die Fortschreibung läuft deterministisch:

```sh
npm run norms:advance-reference-date -- --to 2026-09-04           # Audit: Status- und Fassungsübergänge
npm run norms:advance-reference-date -- --to 2026-09-04 --write   # schreibt nur status (meta.json) und referenceDate
npm run content:check
npm run knowledge:build && npm run knowledge:check
```

Der Lauf zeigt jede Norm, deren Status wechselt, jede Fassung, deren zeitliche Einordnung
wechselt, sowie ablaufende Themen-Hervorhebungen; er verändert weder Quellen noch Fassungen,
Historie oder Verkündungen. Der Stichtag wird nur vorwärts geschrieben: ein Zielstichtag vor dem
bisherigen wird fail-closed abgelehnt, bevor etwas gelesen oder geschrieben wird (die Statuslogik
ist nicht reversibel); derselbe Stichtag ist ein erlaubter No-op. Für die D1-Projektion ist die Stichtagsänderung kein Full-Trigger:
der automatische `--git-diff`-Sync liest den alten Stichtag aus dem Basis-Commit und projiziert
nur die stichtagsabhängig betroffenen Normen samt abgeleiteten Daten aller Normen
(`scripts/lib/d1-reference-date.mjs`; Gleichheit mit einer frischen Vollprojektion wird in
`tests/recht-d1-reference-date.test.mjs` geprüft).

Der Stichtag bleibt eine redaktionelle Entscheidung; er wird nicht täglich automatisch
fortgeschrieben. Die Oberfläche behauptet deshalb keine Tagesaussage: Fassungswahl,
Vorschriftendaten und Trefferliste bezeichnen die geltende Fassung als „Rechtsstand vom
<Stichtag>“ (`referenceDateLabel` in `apps/recht/src/lib/vocabulary.ts`, wortgleich in
`packages/recht-search/src/search-query.ts`). Dieser Satz trifft an jedem Aufruftag zu, auch wenn
der Stichtag einige Tage zurückliegt; „Geltend am <Datum>“ und das Wort „Stichtag“ kommen in
öffentlichen Texten außerhalb der Hilfe nicht vor. Ein täglicher Workflow wurde bewusst nicht
eingerichtet: er verlangte PR-Erstellung mit Pflichtchecks ohne Bypass, einen Organisations-
Snapshot je Stichtag, eine laufende Themen-Hervorhebung, neu erzeugte Wissenshub-Dateien sowie je
Lauf Vollbestand-Smoke, Doppel-Deployment und einen D1-Neuaufbau der abgeleiteten Daten aller
Normen.

## Redaktionelle Nacharbeit

Nach dem Import sind Verkündungsbezüge, Stammfundstelle, kanonisches Vollzitat, betroffene und
verwandte Normen, Themen, Pressemitteilungen sowie mittelbare Auswirkungen und Querverweise zu
prüfen. Bestätigtes Kontextwissen wird mit Quellen und Gültigkeitszeitraum in den Wissenshub
überführt. Ungeprüftes Gesprächswissen verbleibt in `knowledge/conversation-candidates.json`.

Der vollständige Lauf prüft Content, Wissenshub, Unit-Tests und Astro/TypeScript, baut beide
Anwendungen einmal und prüft danach Links, SEO sowie repräsentative Chromium- und
Accessibility-Smokes gegen diesen Build (OstRecht mit dem lokalen D1-Seed aus
`scripts/d1-runtime-seed.mjs`). Visuelle Baselines werden bei betroffenen Oberflächen separat und
erst nach Sichtprüfung aktualisiert.
