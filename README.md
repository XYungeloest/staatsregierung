# Staatsrat des Ostdeutschen Freistaates

Website des fiktiven Staatsrates des Ostdeutschen Freistaates mit Staatsportal, eigenständigem
Rechtsportal, Presse, Haushalt und Service.

Das Projekt ist eine politische Simulation und stellt keine echte amtliche Veröffentlichung dar.
Der entsprechende Hinweis erscheint in der oberen Hinweisleiste, im Footer und ausführlich im
Impressum.

Der redaktionelle Stichtag ist in `src/config/editorial.json` festgelegt und liegt derzeit auf dem
**23. August 2026**. Die Inhaltsformate und Pflegewege stehen in `CONTENT.md`. Aktuell offene
Quellenfragen stehen in `CONTENT_GAPS.md`.

## Architektur

Grundentscheidung ist **ein Repository mit einem gemeinsamen Daten- und Wissensbestand und zwei
öffentlichen Anwendungen**:

- Staatsportal: `https://freistaat-ostdeutschland.de`
- Rechtsportal OstRecht: `https://recht.freistaat-ostdeutschland.de`

Beide Anwendungen lesen dieselben Bestände unter `content/`, `Gesetze/` und `knowledge/`.
`knowledge/` wird nicht öffentlich ausgeliefert. Das Staatsportal behält unter `/recht/` nur eine
redaktionelle Brückenseite; Rechtsdetailseiten liegen ausschließlich auf der Rechtsdomain.

Technischer Kern:

- Astro und TypeScript
- Cloudflare Workers als Zielplattform
- dateibasierte Inhalte unter `content/`
- normalisierte Regierungsorganisation unter `content/organisation/`
- getrenntes, Access-geschütztes Git-Redaktionsstudio unter `/redaktion/`
- interner Wissenshub unter `knowledge/`
- keine aktiven D1- oder R2-Bindings für die öffentliche Inhaltsauslieferung

Dauerhafte Gestaltungsregeln stehen in `DESIGN.md`. Agenten- und Repositoryregeln stehen in
`AGENTS.md`.

## Entwicklung

```sh
npm install
npm run dev
npm run dev:recht
npm run content:check
npm run knowledge:check
npm run knowledge:build
npm run check
npm run test:unit
npm run build
npm run build:portal
npm run build:recht
npm run links:check
npm run seo:check
npm run test:visual
npm run test:a11y
npm run test:quality
npm run test:browsers
npm run editorial:check
```

Weitere wichtige Befehle:

```sh
npm run preview
npm run preview:recht
npm run deploy:staging
npm run deploy
npm run deploy:portal
npm run deploy:recht
npm run editorial:dev
```

`PORTAL_SITE_URL` und `LAW_SITE_URL` steuern die beiden Origins. `npm run build:portal` schreibt
nach `dist/portal/`, `npm run build:recht` nach `dist/law/`. Die Cloudflare-Konfigurationen liegen
in `wrangler.jsonc` und `wrangler.recht.jsonc`.

`npm run deploy` veröffentlicht beide Artefakte desselben Commits in der Reihenfolge OstRecht,
danach Staatsportal. Details zu Veröffentlichung, Wiederanlauf und Produktionskontrolle stehen in
`docs/DEPLOYMENT_RUNBOOK.md`.

## Wichtige Verzeichnisse

```text
content/
  dashboard/
  gesetzgebung/
  freistaat/
  haushalt/
  normen/
  organisation/
  portal/
  presse/
  regierung/
  ressorts/
  service/
  themen/
  verkuendungen/

knowledge/
  entities/
  generated/
  README.md
  AUDIT.md
  SOURCE_POLICY.md
  current-state.json
  timeline.json
  projects.json
  proceedings.json
  open-questions.json

Gesetze/
  amtliche und redaktionell geprüfte Rechtsquellen

public/
  data/kreisreform/
  images/

src/
  components/
  config/
  editorial-worker/
  law/pages/
  data/
  layouts/
  lib/
  pages/
  scripts/
  styles/

context/
  historische Ausgangstexte, Entwürfe und Simulationsmaterial
```

Architektur, Einrichtung und Bedienung des Redaktionsstudios stehen in
`docs/EDITORIAL_ARCHITECTURE.md`, `docs/EDITORIAL_SETUP.md` und `docs/EDITORIAL_RUNBOOK.md`.

## Inhalts- und Wissenspflege

Öffentliche Websiteinhalte werden grundsätzlich über die validierten Dateien unter `content/`
gepflegt. Die vollständigen Felder, Dateiformate, Normstrukturen und redaktionellen Regeln stehen in
`CONTENT.md`.

Aktuelle Ämter, Mitgliedschaften und Ressortleitungen werden ausschließlich aus
`content/organisation/governments.json`, `offices.json` und `assignments.json` abgeleitet.
Personen- und Ressortprofile duplizieren diese Zustände nicht.

`knowledge/` bildet den internen Quellen-, Beziehungs- und Zeitindex. Der Einstieg steht in
`knowledge/README.md`, die Quellenhierarchie in `knowledge/SOURCE_POLICY.md`. Bestätigte Einträge
benötigen konkrete Quellenreferenzen und soweit bekannt Gültigkeitszeiträume. Ungeprüftes
Gesprächswissen bleibt in `knowledge/conversation-candidates.json`.

Die Dateien unter `knowledge/generated/` werden ausschließlich durch `npm run knowledge:build`
erzeugt und nicht manuell gepflegt.

## Normen und Rechtsportal

Normen liegen unter:

```text
content/normen/[slug]/
  meta.json
  history.json
  versions/[versionId].json
```

Verkündungen liegen unter `content/verkuendungen/[slug].json` und verknüpfen Fundstellen mit den
gespeicherten Normfassungen. Historische Fassungen werden nicht zur Laufzeit berechnet, sondern als
vollständige, unveränderliche Fassungen gespeichert.

Reguläre Importquellen sind die redaktionell geprüften HTML-Dateien unter `Gesetze/`. Vorhandene
PDFs dienen der visuellen Gegenprüfung. Markdown wird nur für Altquellen ohne passende HTML-Fassung
über den getrennten Legacy-Parser verwendet. Mehrdeutige Abweichungen werden nicht still
harmonisiert.

Für ausdrücklich geänderte übernommene Stammnormen bildet grundsätzlich der am 1. November 2023
geltende sächsische Rechtsstand die Ausgangsfassung. REVOSax-Snapshots werden unverändert
versioniert; Folgefassungen entstehen ausschließlich über geprüfte, deterministische Patch-Rezepte.
Quellenkonflikte blockieren die Konsolidierung.

Der kanonische Ablauf für Import, REVOSax-Snapshots, Konsolidierung und technische Prüfung steht in
`docs/NORM_WORKFLOW.md`.

```sh
npm run norms:audit
npm run norms:consolidation:audit
npm run norms:metadata:audit
npm run norms:workflow -- --file "Gesetze/…html" --write
```

`data/recht/consolidation-manifest.json` enthält den maschinenlesbaren Einzelstatus der
Konsolidierung. `data/recht/consolidation-report.md` ist die dazugehörige menschenlesbare
Auditübersicht. Aktuelle redaktionelle Quellenfragen werden nicht parallel dort, im README und in
weiteren Erledigt-Listen gepflegt, sondern in `CONTENT_GAPS.md` gebündelt.

## Besondere Portalbereiche

Die Kreis- und Bezirksreform ist unter `/kreisreform/` erreichbar. Die Kartendaten liegen unter
`public/data/kreisreform/`. Die Karte lädt externe OpenStreetMap-Kacheln erst nach ausdrücklicher
Freigabe im aktuellen Seitenaufruf; Suche, Filter und Tabellen funktionieren ohne Kartenstart. Die
Datenpipeline ist in `docs/KREISREFORM_KARTE.md` dokumentiert.

Der Haushaltsbereich verwendet `src/data/haushalt.ts` als zentrale Datenlogik. Gesamtplan,
Einzelpläne und Sondervermögen verwenden dieselbe dateibasierte Haushaltsgrundlage. Die öffentliche
CSV-Ausgabe steht unter `/haushalt/daten.csv` bereit.

Webanalyse ist optional und wird erst nach Zustimmung geladen. Eine außerhalb des Builds aktivierte
Cloudflare Web Analytics muss ebenfalls deaktiviert bleiben, solange dafür keine gesonderte
Einwilligungslogik besteht.

Beide Anwendungen teilen Basiskomponenten und Accessibility-Regeln, verwenden aber getrennte
Layouts. Das Staatsportal nutzt `BaseLayout.astro`, OstRecht `LawLayout.astro`.

## Qualitätssicherung

Vor relevanten Änderungen mindestens:

```sh
npm run content:check
npm run knowledge:check
npm run knowledge:build
npm run knowledge:check
npm run check
npm run test:unit
npm run build
npm run links:check
npm run seo:check
```

Bei betroffenen Oberflächen kommen die gezielten Visual-, Accessibility-, Qualitäts- und
Browserprüfungen hinzu. Screenshot-Baselines werden nur nach Sichtprüfung aktualisiert. Die
vollständige technische Releaseabfolge steht im Deployment-Runbook.

## TODO

Diese Liste enthält ausschließlich aktuell offene Arbeit. Quellenlocators und maschinenlesbare
Einzelzustände gehören in die jeweils zuständigen Datenbestände, nicht als parallele Aufgabenliste
hierher. Für noch benötigte externe Unterlagen und fachliche Entscheidungen steht
`docs/ZUARBEITSFORMULAR.md` bereit.

### Sitzungsmediathek der Volkskammer

- [ ] Fachlichen Auftrag, Verantwortlichkeiten, veröffentlichte Sitzungsteile, Formate,
  Aufbewahrung und Rechte anhand des Zuarbeitsformulars festlegen.
- [ ] Architekturentscheidung mit Kostenprobe für Cloudflare Stream, R2-basierte Auslieferung und
  eine externe Videoplattform treffen. Video-Transcoding, Audio, Downloads, Kostenlimits und
  Wiederherstellung müssen dabei getrennt bewertet werden.
- [ ] Reviewbare Sitzungsmetadaten als neuen Contentbestand modellieren. Große Medien bleiben
  außerhalb von Git und Cloudflare Static Assets. Uploadrechte, CORS, Dateigrenzen und Bereinigung
  unvollständiger Uploads sind eng zu begrenzen.
- [ ] Veröffentlichung, Depublikation, Korrekturen, Untertitel, Transkript, Vorschaubilder,
  Barrierefreiheit, Datenschutz und CSP für die gewählte Medienauslieferung definieren.
- [ ] Schema-, Inhalts-, Such-, Sitemap-, Browser- und Accessibility-Tests ergänzen und vor einem
  allgemeinen Start eine längere öffentliche Sitzung als Pilot vollständig durchspielen.

### Rechtsportal und Primärquellen

- [ ] Die 24 im Konsolidierungsmanifest als `missing-stem-record` geführten Zielnormen aus den
  bereits bestimmten Ausgangssnapshots als historisierte Stammnormen anlegen und ihre
  ostdeutschen Änderungen über geprüfte Patch-Rezepte konsolidieren. Kulturraumgesetz und
  Ostdeutsches Polizeibehördengesetz bleiben vorrangig.
- [ ] Die vollständige Ausgangsfassung des NDR-Staatsvertrags vor der Änderung vom 8. März 2026
  einschließlich Anlagen beschaffen.
- [ ] Die gemeinsame Dokumentidentität von `OABl. 2025 Nr. 2` und
  `StAnzO. 2026 Nr. 2.html` technisch zusammenführen; Dokumentkopf und internes Datum bleiben
  kanonisch.
- [ ] Für noch ausschließlich als Markdown vorliegende Altquellen schrittweise geprüfte
  strukturierte HTML-Transkriptionen erstellen und bis dahin PDF-Gegenprüfung und Legacy-Fixtures
  erhalten.
- [ ] Die drei gesperrten schulrechtlichen Zieltextkonflikte bei SOFS, BSO und BGySO fachlich
  klären und erst danach konsolidierte Folgefassungen erzeugen.

### Aktuelle Vorhaben und öffentliche Inhalte

- [ ] Volksbefragung und Wahl zur achten Volkskammer entlang der belegten Termine fortschreiben.
  Durchführung, Ergebnisbekanntmachungen und politische Folgebeschlüsse erst nach Eingang der
  jeweiligen Primärquelle übernehmen.
- [ ] Für Boom Europe die operative Standortumsetzung und Projektorganisation belegen.
- [ ] Für die OVV-/DB-Ticketanerkennung Geltungsbeginn und Tarifbedingungen belegen sowie
  Fernverkehrsreaktivierungen nur mit Bestellungs-, Fahrplan- oder Betriebsnachweis führen.
- [ ] Für noch offene Beschaffungs- und Unternehmensentscheidungen die praktische Umsetzung
  belegen. Dazu gehören das E-Jura-System, vier Hovercrafts, die NVIDIA-Ansiedlung, der erste
  Zeppelin NT und das Luxemburg-Liebknecht-Denkmal.

### Politische Geschichte und Wissenshub

- [ ] Die politische Chronologie vor Dezember 2025 vervollständigen, insbesondere frühere
  Regierungen und Wahlperioden, Ende der Amtszeit Tom Kurzschlusses, Misstrauensvoten, Partei- und
  Fraktionswechsel, Honeckers belegte Biografie und die Namensgeschichte von DEMOS.
- [ ] Verbleibende unbestimmte Personen, Gerichtsverfahren und nichtrechtliche Realitätsereignisse
  aus `knowledge/conversation-candidates.json` einzeln prüfen. Bestätigtes in die zuständigen
  Strukturen überführen, Widerlegtes entfernen und unprüfbares Gesprächswissen nicht in den
  Gegenwartsstand übernehmen.
- [ ] Die offenen Beteiligungsfragen in `knowledge/open-questions.json` bei neuen Primärquellen
  weiterführen, insbesondere nicht öffentlich ausgewiesene tiefere Beteiligungsstufen und formale
  Anpassungen gemeinsamer Träger.

### Laufende Qualität

- [ ] Beim Fortschreiben des redaktionellen Stichtags alle zeitabhängigen Oberflächen gemeinsam
  prüfen: Termine, Stellen, Highlight-Zeiträume, Verfahren, Normfassungen, Regierungszuordnungen,
  Gebietsstände, Timeline und Suchindex.
- [ ] Nach Änderungen an Arbeits- und Prüfdokumentation erledigte Punkte vollständig entfernen und
  keine Erledigt-Archive anlegen. Generierte Wissensdateien ausschließlich über ihre Generatoren
  aktualisieren.
- [ ] Vor Produktionsfreigaben zusätzlich zu den automatisierten Prüfungen einen kurzen manuellen
  Tastatur- und Screenreader-Test sowie eine Sichtprüfung der festgelegten Mobil-, Tablet- und
  Desktopbreiten durchführen.
