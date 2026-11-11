# Haushaltsinformationssystem

Runbook für den Haushaltsbereich des Staatsportals (`/haushalt/`): Datenherkunft, Import,
Freigabe, redaktionelle Overlays, Ausgabedateien und Tests.

## Grundsätze

- Das Haushaltsrepo (`osthaushalt-2027-2028`) rechnet, das Portal zeigt an. Das Portal ändert
  keine Ansätze, rechnet keine Szenarien und bildet keine abweichenden Gesamtbeträge; es prüft
  Kontrollsummen, gruppiert, berechnet Anteile und Veränderungen und visualisiert.
- Beträge stehen nie in Seiten, Komponenten oder Overlays. Sie kommen ausschließlich aus dem
  versionierten Snapshot unter `data/haushalt/<periode>/` (Perioden mit Snapshot) oder aus dem
  Altbestand 2025/2026 (`apps/portal/src/lib/haushalt/legacy-2025-2026.ts`).
- Ein Entwurf erscheint nie als geltender Haushalt. Status und Freigabe stehen nur im
  Periodenregister `content/haushalt/perioden.json`.
- Der Snapshot entsteht nur über `npm run haushalt:sync`; er wird nicht von Hand bearbeitet.
- Die Veröffentlichung braucht das Haushaltsrepo nicht: Build und Prüfungen lesen nur den
  committeten Snapshot.

## Periodenregister

`content/haushalt/perioden.json` führt jede Haushaltsperiode mit:

- `id` (`2027-2028`), `bezeichnung`, `jahre`;
- `status`: `arbeitsentwurf`, `regierungsentwurf`, `parlamentarische-beratung`, `beschlossen`,
  `verkuendet` oder `historisch`; ein optionaler `nachtrag` (`nummer`, `status`) erscheint als
  eigenes Statusabzeichen im Periodenkopf, auf der Einstiegsseite und in den Ressortblöcken;
- `datenquelle`: `snapshot` (Daten unter `data/haushalt/<periode>/`) oder `legacy-2025-2026`;
- `freigabe`: `oeffentlich`, `datum`, `grundlage`, optional `hinweis`. Öffentlich ist eine Periode
  nur mit `oeffentlich: true` und einem Status außer `arbeitsentwurf`;
- `rechtsgrundlage.normSlug` für verkündete Haushaltsgesetze.

Eine nicht freigegebene Periode erscheint auf keiner Seite, in keinem Suchindex, keiner Sitemap
und keinem Download. Der Altbestand 2025/2026 liegt unter `/haushalt/2025-2026/`; die früheren
Adressen `/haushalt/gesamtplan/` und `/haushalt/einzelplaene/…` leiten dauerhaft dorthin weiter
(`apps/portal/src/config/legacy-routes.mjs`, je Einzelplan statisch).

## Import aus dem Haushaltsrepo

```sh
npm run haushalt:sync -- --source <pfad zum Haushaltsrepo> [--dry-run] [--rueckschritt-erlauben]
npm run haushalt:check
```

`haushalt:sync` liest den committeten Stand der aktiven Fassung (`haushalt/VERSIONEN.json`),
prüft die SHA-256-Werte gegen die Quellmanifeste, kontrolliert Summen und Identitäten, schreibt in
ein temporäres Verzeichnis, prüft erneut und tauscht den Snapshot atomar aus. Bei jedem Fehler
bleibt der bestehende Snapshot unverändert. Ein Snapshot wird nur durch einen Nachfolger seines
Quellcommits ersetzt; `--rueckschritt-erlauben` lässt einen älteren oder abgezweigten Stand
ausdrücklich zu. Herkunft, Commit, Prüfstand, Prüfsummen und Befunde stehen in
`data/haushalt/<periode>/import-manifest.json`.

Aufbau des Snapshots: `periode.json`, `gesamtplan.json`, `einzelplaene.json`, `kapitel.json`,
`titel/<ep>.json`, `projekte.json`, `finanzierung.json`, `ruecklagen.json`, `personal.json`,
`gesetze.json`, `qualitaet.json`, `import-manifest.json` und gegebenenfalls `ausgabe/`.

`haushalt:check` ist Teil von `content:check` und läuft ohne Haushaltsrepo: Hashes laut Manifest,
Summen-, Eindeutigkeits- und Projektinvarianten, Periodenregister und Overlays sowie die
Kreuzprüfung der Ausgabedateien.

## Ausgabedateien (PDF, Arbeitsmappe)

Haushaltsplan (PDF) und Arbeitsmappe (XLSX) stammen aus der öffentlichen Ausgabefassung des
Haushaltsrepos (Profil `oeffentlich`, Dateien `<name>_oeffentlich.<endung>`). Das Profil erzeugt sie
aus denselben Beträgen wie die interne Standardausgabe, gibt Titeltexte aber nur in der
redaktionell freigegebenen Fassung aus `content/haushalt/<periode>/freitexte.json` wieder
(`anzeige`; Texte mit `anzeige: null` oder ohne Klassifikation entfallen) und verwendet die
öffentlichen Bezeichnungen aus dem Abschnitt `bezeichnungen`. Dazu liegt im Haushaltsrepo eine
unveränderte Kopie dieser Datei (`haushalt/<periode>/oeffentlich/freitexte.json`, Prüfsumme in
`MANIFEST.json` unter `oeffentliche_freitexte`).

`haushalt:sync` übernimmt die öffentliche Fassung unverändert unter dem neutralen Namen
`<name>.<endung>` nach `data/haushalt/<periode>/ausgabe/`, wenn die Prüfung
(`scripts/lib/haushalt/artefakte.mjs`) nichts findet; die interne Standardausgabe wird nie
veröffentlicht. Gesperrt wird fail-closed bei

- lokalen Pfaden oder nicht prüfbaren Bestandteilen,
- nicht öffentlichen Abschnitten (`ARTEFAKT_SPERRMARKEN` in `scripts/lib/haushalt/legenden.mjs`),
- internen Kennungen und Arbeitsvermerken (`ARTEFAKT_KENNUNGSMUSTER`: Kennungen des Finanzrahmens,
  des Entscheidungsprotokolls, der Prüfungen, Korrekturvorlagen und Maßnahmen, Simulationsbundes-
  recht, Vorbildherleitung, Quellenmatrix, Verhandlungspositionen, Modellannahmen,
  Nachweisvermerke, Name eines realen Handelsunternehmens wie `METABEGRIFFE` `unternehmensname`),
- jedem Titeltext, den `freitexte.json` nicht zur Anzeige freigibt; verglichen wird ohne Leerraum
  und Satzzeichen.

Eine gesperrte öffentliche Fassung führt nie zum Rückgriff auf die interne Standardausgabe; die
Downloadseite und `datenpaket.json` lassen die Datei dann weg. Status und Sperrgrund jeder Datei
stehen in `import-manifest.json` unter `artefakte`. `haushalt:check` wiederholt die Kreuzprüfung für
jede als übernommen verzeichnete Datei, sodass auch ein manuell eingespielter Snapshot auffällt.
Beruht die Ausgabefassung auf einer anderen Fassung von `freitexte.json` als der im Portal, warnt
`haushalt:sync`; die Dateien können dann überholte öffentliche Fassungen enthalten.

Bei neuen oder geänderten Freitexten und bei einer neuen Quellfassung:

1. `content/haushalt/<periode>/freitexte.json` im Portal pflegen, bis `npm run haushalt:check`
   besteht.
2. Die Datei unverändert nach `haushalt/<periode>/oeffentlich/freitexte.json` im Haushaltsrepo
   kopieren, die Ausgabe dort neu erzeugen (Prüfsumme in `MANIFEST.json`) und committen.
3. `npm run haushalt:sync -- --source <pfad>`; Hinweise und Warnungen zu den Ausgabedateien lesen.
   Bleibt eine Datei gesperrt, wird sie im Haushaltsrepo bereinigt, nie im Portal.

## Redaktionelle Overlays

Unter `content/haushalt/<periode>/` (geprüft von `haushalt:check`):

- `freitexte.json`: jeder Freitext der Titel (Rechtsgrundlage, Finanzierung, Erläuterung,
  Haushaltsvermerk) als exakter Quelltext mit öffentlicher Fassung (`anzeige`) oder `null`;
  Rechtsgrundlagen zusätzlich mit `art` und gegebenenfalls `normSlug`; nennt ein Quelltext
  Vorschriften verschiedenen Stands, stehen die weiteren unter `weitere`. Ein Entwurf verweist nie
  auf eine Norm. Unter `bezeichnungen` stehen öffentliche Fassungen von Bezeichnungen und
  Zuständigkeiten mit internem Begriff, Paarform oder unzutreffender Amtsbezeichnung.
- `einzelplaene.json`: Kurztitel, Kategorie, Beschreibung, Ressorts und Themen je Einzelplan.
- `projekte.json`: öffentliche Fassung jedes Vorhabens (Titel, Status, Beschreibung,
  Rechtsbezüge, Ressort, Themen; `ohneSumme` mit Pflicht-`betragshinweis`, wenn die Titel nicht
  allein dem Vorhaben gewidmet sind).
- `finanzierung.json`, `fonds.json`, `personal.json`, `suchbegriffe.json`: Beschriftungen,
  Rechtsbezüge und Alltagsbegriffe ohne Beträge.

Öffentliche Texte enthalten keine Arbeitsvermerke (`METABEGRIFFE` in
`apps/portal/src/lib/haushalt/oeffentlich.ts`) und keine Paarformen. Suchbegriffe der Vorhaben aus
dem Snapshot, die einen solchen Begriff enthalten, entfallen in Suche und Suchindex.

## Freigabe und Vorschau

- Freigabe: `freigabe.oeffentlich` im Register setzen, `haushalt:check`, Build, Prüfungen.
- `HAUSHALT_VORSCHAU=1` baut zusätzlich nicht freigegebene Perioden mit `noindex` und
  Vorschauhinweis. Nur wenn es solche Perioden gibt, schreibt der Build den Marker
  `apps/portal/dist/haushalt-vorschau.json` und `noindex`-Regeln in `_headers`; ohne sie entspricht
  ein Vorschau-Build der Freigabeform.
- `scripts/check-haushalt-release.mjs` (Teil von `deploy:assets:check`) prüft den Build: ohne
  Marker darf keine nicht freigegebene Periode enthalten sein; `--produktion` lehnt jeden
  Vorschau-Build ab. Der PR-Workflow lädt einen Build mit Marker nicht als Cloudflare-Vorschau hoch.

## Neue Periode, Aktualisierung und Nachtrag

1. Im Haushaltsrepo den neuen Stand committen (aktive Fassung in `haushalt/VERSIONEN.json`).
2. `npm run haushalt:sync -- --source <pfad>`; Warnungen zu gesperrten Ausgabedateien lesen.
3. Neue Freitexte und Bezeichnungen in `freitexte.json` klassifizieren, Overlays ergänzen, bis
   `npm run haushalt:check` besteht; danach die Ausgabefassung wie unter „Ausgabedateien“
   beschrieben neu erzeugen und erneut synchronisieren.
4. Eine neue Periode zunächst mit `freigabe.oeffentlich: false` eintragen und mit
   `HAUSHALT_VORSCHAU=1` sichten; freigeben erst nach redaktioneller Entscheidung.
5. Status (z. B. `parlamentarische-beratung`, `beschlossen`, `verkuendet`) und `nachtrag` nur im
   Register ändern.

## Tests

- Unit-Tests: `tests/haushalt-*.test.*` (Register und Gate, Kennzahlen, Overlays, Import,
  Artefaktprüfung, Freigabe-Guard, Suche) mit Fixturen unter `tests/fixtures/haushalt/`.
- Korpus-Test: `tests/corpus/haushalt-snapshot.test.ts` gegen den echten Snapshot.
- Browser-, Barrierefreiheits- und Screenshot-Tests (`tests/browser-smoke.spec.ts`,
  `tests/accessibility.spec.ts`, `tests/visual.spec.ts`) leiten Ziele zur Laufzeit aus den
  Seiten ab und nennen keine Beträge, Titel oder Vorhaben.
