# Staatsrat des Ostdeutschen Freistaates

Website des fiktiven Staatsrates des Ostdeutschen Freistaates mit Staatsportal, eigenständigem
Rechtsportal, Presse, Haushalt und Service.

Das Projekt ist eine politische Simulation und stellt keine echte amtliche Veröffentlichung dar.
Der entsprechende Hinweis erscheint in der oberen Hinweisleiste, im Footer und ausführlich im
Impressum.

Der redaktionelle Stichtag ist ausschließlich in `packages/shared/src/config/editorial.json` festgelegt. Die
Inhaltsformate und Pflegewege stehen in `CONTENT.md`. Aktuell offene
Quellenfragen stehen in `CONTENT_GAPS.md`.

## Architektur

Grundentscheidung ist **ein npm-Workspace-Monorepo mit einem gemeinsamen Daten- und Wissensbestand
und zwei öffentlichen Anwendungen**:

- Staatsportal: `https://freistaat-ostdeutschland.de`
- Rechtsportal OstRecht: `https://recht.freistaat-ostdeutschland.de`

Beide Anwendungen lesen dieselben öffentlichen Bestände unter `content/`. `Gesetze/` und
`data/recht/` sind Quellen- und Auditbestände für Import und Validierung; `knowledge/` bleibt interne
Repositorydokumentation und wird nicht öffentlich ausgeliefert. Das Staatsportal behält unter `/recht/`
nur eine redaktionelle Brückenseite; Rechtsdetailseiten liegen ausschließlich auf der Rechtsdomain.

Die Workspaces sind `@ostrecht/portal` unter `apps/portal/`, `@ostrecht/recht` unter `apps/recht/`,
das intern gemeinsam genutzte Paket `@ostrecht/shared` unter `packages/shared/` sowie die
OstRecht-spezifische Suchlogik `@ostrecht/recht-search` unter `packages/recht-search/`. Die
Root-`package.json` orchestriert Entwicklung, Prüfung, Build und Deployment; ein zusätzlicher
Monorepo-Orchestrator wird nicht verwendet.

Technischer Kern:

- Astro und TypeScript
- Cloudflare Workers als Zielplattform
- dateibasierte Inhalte unter `content/`
- normalisierte Regierungsorganisation unter `content/organisation/`
- interner Wissenshub unter `knowledge/`
- Cloudflare D1 (`ostrecht-recht`) als abgeleitete Laufzeitdatenbank von OstRecht, aus
  `content/normen` und `content/verkuendungen` per `npm run norms:runtime:d1-sync` projiziert
- Cloudflare R2 (`ostrecht-recht-quellen`) als unveränderliches Archiv amtlicher Rohquellen;
  das Staatsportal liest weiterhin nur `content/`

Dauerhafte Gestaltungsregeln stehen in `DESIGN.md`. Agenten- und Repositoryregeln stehen in
`AGENTS.md`.

## Entwicklung

```sh
npm ci
npm run dev
npm run dev:portal
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
```

Weitere wichtige Befehle:

```sh
npm run preview
npm run preview:recht
npm run deploy:staging
npm run deploy
npm run deploy:portal
npm run deploy:recht
```

`PORTAL_SITE_URL` und `LAW_SITE_URL` steuern die beiden Origins. `npm run build:portal` schreibt
nach `apps/portal/dist/`, `npm run build:recht` nach `apps/recht/dist/`. Beide Astro-Anwendungen
besitzen eine feste app-lokale `astro.config.mjs`. Ihre Cloudflare-Konfigurationen liegen unter
`apps/portal/wrangler.jsonc` und `apps/recht/wrangler.jsonc`.

Die gemeinsame Assetquelle bleibt `public/`. Vor einem Build erzeugt
`scripts/prepare-site-public.mjs` den jeweils benötigten, nicht versionierten Bestand unter
`apps/portal/.site-public/` oder `apps/recht/.site-public/`. Dadurch werden Rechts-PDFs weiterhin
nur an OstRecht ausgeliefert, ohne die Quellen im Repository zu duplizieren.

OstRecht liest Rechtsdaten zur Laufzeit aus Cloudflare D1. `npm run norms:runtime:d1-sync`
projiziert `content/normen` und `content/verkuendungen` in die produktive Datenbank (Wrangler-
Anmeldung oder `CLOUDFLARE_API_TOKEN`); `npm run norms:runtime:d1-local` baut dieselbe Projektion in
einer lokalen Miniflare-D1 unter `.cache/wrangler-local`. `npm run test:a11y` und
`npm run test:browsers` starten OstRecht darüber als lokalen Worker (`scripts/serve-law-worker.mjs`),
das Staatsportal weiterhin als statische Vorschau.

`npm run deploy` veröffentlicht beide Artefakte desselben Commits in der Reihenfolge OstRecht,
danach Staatsportal. Details zu Veröffentlichung, Wiederanlauf und Produktionskontrolle stehen in
`docs/DEPLOYMENT_RUNBOOK.md`.

## Wichtige Verzeichnisse

```text
apps/
  portal/       Staatsportal; Astro- und Wrangler-Konfiguration, Pages, Layout und Portalcode
  recht/        OstRecht; Astro- und Wrangler-Konfiguration, Pages, Layout und Normkomponenten

packages/
  shared/       gemeinsam genutzte Komponenten, Konfiguration, Styles, Typen und Fachlogik
  recht-search/ OstRecht-spezifische Suche und Autovervollständigung

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
  assets/recht/
  data/kreisreform/
  images/

context/
  historische Ausgangstexte, Entwürfe und Simulationsmaterial

data/           gemeinsame fachliche Datenbestände
docs/           Entwickler- und Betriebsdokumentation
scripts/        repo-weite Import-, Build- und Prüfwerkzeuge
tests/          repo-weite Unit-, Routing-, Browser- und Accessibility-Tests
```

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
versioniert oder hashverifiziert in R2 archiviert (`data/recht/revosax-r2-manifest.json`);
Folgefassungen entstehen ausschließlich über geprüfte, deterministische Patch-Rezepte.
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

Der Haushaltsbereich verwendet `apps/portal/src/data/haushalt.ts` als zentrale Datenlogik. Gesamtplan,
Einzelpläne und Sondervermögen verwenden dieselbe dateibasierte Haushaltsgrundlage. Die öffentliche
CSV-Ausgabe steht unter `/haushalt/daten.csv` bereit.

Webanalyse ist optional und wird erst nach Zustimmung geladen. Eine außerhalb des Builds aktivierte
Cloudflare Web Analytics muss ebenfalls deaktiviert bleiben, solange dafür keine gesonderte
Einwilligungslogik besteht.

Beide Anwendungen teilen Basiskomponenten und Accessibilityregeln, verwenden aber getrennte
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

**Zuletzt abgeglichen:** 3. September 2026

Diese Liste ist der zentrale Projektbacklog. Jede noch offene Aufgabe muss hier mindestens als
Sammelpunkt erscheinen. Quellenlocators, Einzelkonflikte und maschinenlesbare Zustände werden
weiterhin in `CONTENT_GAPS.md`, `knowledge/open-questions.json`,
`content/portal/topic-coverage.json` und `data/recht/consolidation-report.md` gepflegt; diese
Dateien liefern die Nachweise, bilden aber keine parallele Aufgabenliste. Erledigte Punkte werden
entfernt statt dauerhaft abgehakt stehen gelassen.

Alle dafür noch benötigten externen Einstellungen, fachlichen Entscheidungen und Primärquellen
sind ausfüllbar im [`docs/ZUARBEITSFORMULAR.md`](docs/ZUARBEITSFORMULAR.md) gebündelt. Das Formular
dient nur der Übergabe von Zuarbeit; der Aufgabenstatus wird weiterhin ausschließlich hier gepflegt.

### Vollständiger REVOSax-Ausgangsbestand und D1/R2-Laufzeitarchitektur für OstRecht

OstRecht soll den vollständigen am Rechtsüberleitungsstichtag **1. November 2023** maßgeblichen
REVOSax-Bestand übernehmen. Ausgangspunkt ist nicht der heutige Bestand und auch nicht die gesamte
sächsische Versionshistorie, sondern die REVOSax-**Erweiterte Suche mit Geltungstag 01.11.2023**.
Dabei müssen ausdrücklich alle Stamm- und Änderungstypen aktiviert werden: Gesetze und
Änderungsgesetze, Verordnungen und Änderungsverordnungen, Verwaltungsvorschriften und
Änderungsverwaltungsvorschriften, Förderrichtlinien und Änderungsförderrichtlinien sowie
Staatsverträge und Zustimmungsgesetze einschließlich der von REVOSax angebotenen Änderungstypen.
REVOSax blendet Änderungsvorschriften standardmäßig aus; eine Abfrage ohne diese Haken wäre deshalb
kein vollständiger übergeleiteter Rechtsbestand.

Für jeden Treffer wird **genau die von REVOSax für den Stichtag ausgelieferte Fassung** übernommen.
Es sollen nicht zusätzlich sämtliche vor dem 1. November 2023 vorhandenen historischen Fassungen
geladen werden. Die sächsische Versionshistorie vor dem Stichtag ist Quellenhistorie, nicht Teil der
ostdeutschen Fassungsentwicklung. Die übernommene Fassung bildet Version 1 des ostdeutschen
Bestands; spätere Versionen entstehen ausschließlich aus ostdeutschen Verkündungen und den bereits
vorhandenen deterministischen Konsolidierungs- und Patchregeln.

Der Vollbestand soll technisch dreifach, aber mit klar getrennten Aufgaben gehalten werden:

- **Git/Wissenshub bleibt der fachliche und reviewbare Source of Truth.** Die materialisierten Normen
  bleiben unter `content/normen/[slug]/meta.json`, `history.json` und `versions/*.json`. Dadurch
  können lokale Werkzeuge, Codex und ChatGPT weiterhin sofort ermitteln, welche Norm gilt, welcher
  Paragraph eine bestimmte Regelung enthält und wie ein neuer Änderungsbefehl formuliert werden
  muss. Der Rechtsbestand darf deshalb niemals ausschließlich in einer Cloudflare-Datenbank liegen.
- **D1 wird die produktive strukturierte Laufzeitdatenbank von OstRecht.** Dort liegen Normidentität,
  Metadaten, Fassungen, Normkörper und der Volltext-Suchindex. Der Normkörper soll nicht als ein
  einziges riesiges JSON-Feld gespeichert werden, sondern mindestens nach äußeren Body-Blöcken
  getrennt. Das vorbereitetete Schema `data/recht/d1/0001_rechtsbestand.sql` verwendet dafür
  `law_norms`, `law_versions`, `law_version_blocks`, `law_source_objects` und die FTS5-Tabelle
  `law_search`. Ein einzelner Body-Block über 1,8 MB blockiert den Sync und muss strukturell weiter
  zerlegt werden, statt unkontrolliert an die D1-Zeilengrenze zu geraten.
- **R2 wird ausschließlich unverändertes Quellen- und Anlagenarchiv.** Dort gehören REVOSax-HTML,
  PDFs und große Anlagen hin. Der öffentliche Normtext wird nicht bei jedem Aufruf aus R2 geparst.
  Parsing und Rechtsüberleitungsanpassung erfolgen vor Veröffentlichung; normale Normseiten lesen
  später aus D1. R2 wird für Quellennachweis, Kontrolle und Anlagen verwendet.

OstRecht liest Norm-, Fassungs-, Historien-, Vergleichs-, Such-, Verkündungs- und Sitemap-Routen
zur Laufzeit aus D1 (`apps/recht/src/lib/runtime/`); statische Hilfeseiten und die Suchhülle bleiben
prerendert. Ein Fassungsvergleich wird erst beim Abruf für genau das angefragte Paar berechnet und
über `Cache-Control` gecacht, statt `n × (n - 1)` Paare zu bauen. Websitecode löst einen
Astro/Worker-Build aus; reine Rechtsinhaltsänderungen lösen Contentprüfung, Portal-Build und den
D1-Sync aus (`scripts/classify-change-scope.mjs`).

Der vollständige technische Ablauf und die Cloudflare-Schritte stehen in
[`docs/REVOSAX_BULK_IMPORT.md`](docs/REVOSAX_BULK_IMPORT.md).

**Stand 4. September 2026 (Branch `revosax-bulk-import-d1-r2`, Draft-PR #18):** Discovery
(5.092 Listenzeilen, 5.089 eindeutige Fassungen, fail-closed verifiziert), Vollstaging
(5.089/5.089 ohne Parser-, Adapter- oder Reststellenfehler), Rechtsüberleitungsanpassung mit
korpusweitem End-Audit (0 Reststellen im übernommenen Recht), R2-Provenienz im Normschema,
Materialisierungsplan mit Klassifizierung der Mantelbestandteile, R2-Archivierung der Rohquellen
und aller 890 PDF-Anlagen, Materialisierung (3.346 Stammfassungen und Änderungsakte plus 1.521
Artikel von Mantelvorschriften als eigene Änderungsvorschriften; 4.867 übernommene Normen, 5.108
Normen insgesamt), versionierter Import-Audit,
D1-Schema, inkrementeller D1-Sync, die D1-gestützte OstRecht-Laufzeit, getrennte Staging-Ressourcen
und die CI-Trennung sind umgesetzt. Die vollständige Bilanz steht in
`data/recht/revosax-import-audit/summary.json` und geht exakt auf: 5.089 eindeutige Treffer =
4.867 eigene Normen + 7 redaktionell vorhandene (MATCH) + 52 geschützte Ost-Normen + 101 zurückgestellte
Reviewfälle + 62 begründete SKIPs (40 Doppelerfassungen desselben Artikels einer Mantelvorschrift,
8 Aliasse derselben Fassung, 2 identische Vorgängertexte, 9 in REVOSax textlose Einträge,
1 Doppelerfassung, 2 PDF-only-Entscheidungen).

Release-Gates vor dem Merge (PR bleibt Draft):

- [x] **Remote-D1 gegen Git verifiziert.** Der einmalige Vollsync der neuen Materialisierung
  (`--full`, 115.390 Operationen, 16 Minuten) ist durch; `npm run norms:runtime:d1-verify` gegen die
  produktive Datenbank bestätigt Zähler (5.108 Normen, 5.188 Fassungen, 24.444 Blöcke, 6.591 Quellen,
  5.108 abgeleitete Zeilen, 137 Verkündungen, 38.223 Suchzeilen), `corpus_hash` und 15 Stichproben.
- [ ] **Cloudflare-Plan.** Vollsync und Laufzeit haben das D1-Free-Tier-Leselimit (5 Mio.
  Zeilen/Tag) am 3. September 2026 zweimal erschöpft (Fehler 7500 bis Mitternacht UTC); der kalte
  Korpusaufbau der Übersichten liegt über dem CPU-Limit von Workers Free. Für den Betrieb mit dem
  Vollbestand ist Workers Paid nötig; der inkrementelle Sync (`--git-diff`) hält den laufenden
  Betrieb klein.
- [ ] **Produktions-Smoke** (`npm run test:deployment:production`) nach dem ersten Deployment mit
  D1-Laufzeit; bis dahin ist die Runtime nur lokal (Miniflare) und per `wrangler dev --remote`
  geprüft.
- [ ] **CI-Token erweitern.** Der Job `d1_sync` braucht für `CLOUDFLARE_API_TOKEN` zusätzlich
  `D1 Read`/`D1 Write` für `ostrecht-recht`; Migrationen unter `data/recht/d1/` werden bewusst
  manuell mit `wrangler d1 execute` eingespielt.

Redaktionelle Restarbeiten (konkret in `data/recht/revosax-import-audit/` identifiziert):

- [ ] **Zurückgestellte Mantelbestandteile** (`DEFER` in `data/recht/revosax-baseline-decisions.json`,
  Details in `data/recht/revosax-import-audit/envelopes.json`): 101 Artikel, deren Zuordnung nicht
  maschinell gesichert ist – der REVOSax-Anker zeigt auf einen anderen Artikel und keine
  Artikelüberschrift entspricht dem eigenen Titel, kein Anker, kein Artikelkennzeichen oder eine
  weiterleitende Mantelvorschrift. Jeder Fall nennt Mantelvorschrift, Anker und Grund.
- [ ] **PDF-only-Vorschriften.** 1018 (Europäisches Übereinkommen über das grenzüberschreitende
  Fernsehen: Haupttext nur als Scan ohne Textebene) und 17114 (Fragebogen-Anlage); Anlagen sind
  hashverifiziert in R2, Materialisierung bleibt Reviewfall.
- [ ] **Prüfmarken sichten.** „Quelle endet ohne Nachfolger“ ist in `review-flags.json` eingeordnet:
  275 × Typ A (Gültigkeitsende nach dem Stichtag ohne Befristung im Text, spätere sächsische
  Rechtsänderung ohne Wirkung für Ostdeutschland), 7 × Typ B (Befristung im übernommenen Text,
  möglicherweise ostdeutsch wirksam – Review) und 2 × unklar. 249 Fassungen tragen das Erlassdatum
  aus der amtlichen REVOSax-Trefferliste, eine (1018) hat keines.
- [ ] **Altbestand mit sächsischen Bezeichnungen.** Der Korpus-Audit führt die vor dem
  Rechtsüberleitungsadapter aus `Gesetze/` übernommenen Normen (z. B. `landesbeamtengesetz`,
  Titel „Sächsisches Beamtengesetz“) als versionierten Rückstand in
  `data/recht/ost-residual-backlog.json`; jede Abweichung lässt `content:check` fehlschlagen.
  Nachziehen über die Konsolidierung aus `Gesetze/`.
- [ ] **Abgeleitete Metadaten nachschärfen.** Sachgebiete, Schlagwörter und Kurzfassung der
  übernommenen Normen sind deterministisch aus Typ, Ressort und Titel abgeleitet und generisch;
  `originEnactingBody` nennt bewusst das sächsische Ursprungsorgan als Provenienz.

### Sitzungsmediathek der Volkskammer

Der derzeitige Portalstand kann lange Sitzungsaufzeichnungen noch nicht sachgerecht aufnehmen.
Workers Static Assets erlauben nur [25 MiB je Datei](https://developers.cloudflare.com/workers/platform/limits/),
die Medien-CSP lässt ausschließlich die eigene Origin zu und Git eignet sich nicht als Ablage für
große Mediendateien. Große Audio- oder Videodateien dürfen deshalb weder unter `public/` noch als
Git-Blob in einen Pull Request gelangen. Die folgende Planung betrifft zunächst aufgezeichnete
öffentliche Sitzungen, keinen Livebetrieb.

- [ ] Vor der Implementierung den fachlichen Auftrag mit der Volkskammer festlegen: zuständige
  Redaktion, nur öffentliche Sitzungen beziehungsweise öffentliche Sitzungsteile, gewünschte
  Audio- und Videoformate, Downloadangebot, Aufbewahrungsdauer, Korrektur- und Depublikationsweg,
  erwartete Sitzungsdauer, jährliches Volumen und typische gleichzeitige Abrufe. Livestreaming als
  getrennte spätere Ausbaustufe behandeln.
- [ ] Eine kurze Architekturentscheidung mit Kostenprobe für mindestens drei Varianten erstellen:
  Cloudflare Stream für Video, progressive Dateien beziehungsweise selbst erzeugtes HLS aus R2 und
  eine externe Videoplattform. Als bevorzugten Prüfpfad Cloudflare Stream für Video sowie R2 für
  reine Audiofassungen und gegebenenfalls freigegebene Downloads erproben. Stream übernimmt
  Upload, Speicherung, Transcoding und adaptives HLS/DASH; eine bloße große MP4-Datei in R2 bietet
  diese automatische Qualitätsanpassung nicht. Preise anhand realistischer Speicher- und
  Abrufminuten kalkulieren und ein monatliches Kostenlimit samt Warnschwellen festlegen.
- [ ] Die bestehende Quellenarchitektur bewusst erweitern: strukturierte, reviewbare Metadaten
  bleiben unter einem neuen Contentbestand wie `content/volkskammer/sitzungen/` in Git; binäre
  Aufzeichnungen liegen ausschließlich im gewählten Mediendienst. Stream-UID beziehungsweise
  stabiler R2-Objektschlüssel, Prüfsumme, technische Dauer und Verarbeitungsstatus sind Referenzen,
  keine zweite frei bearbeitbare Inhaltsdatenbank. Nach der Entscheidung README, `AGENTS.md`,
  `CONTENT.md`, Architektur- und Betriebsdokumentation anpassen, da R2 derzeit ausdrücklich nicht
  als öffentliche Inhaltsquelle vorgesehen ist.
- [ ] Für Sitzungen ein validiertes Contentmodell entwerfen. Mindestens benötigt werden Wahlperiode,
  Sitzungsnummer, Titel, Datum, Beginn und Ende, Ort, Veröffentlichungsstatus, öffentliche
  Tagesordnung, Kapitel mit Zeitmarken, verknüpfte Drucksachen und Normen, Video- und Audioquelle,
  Dauer, Vorschaubild, Untertitelsprachen, Transkript, barrierefreie Alternativen,
  Veröffentlichungs- und Änderungsdatum sowie ein belegter Rechte- und Freigabestatus. Technische
  Anbieterbegriffe und interne Objektkennungen dürfen auf Bürgerseiten nicht ungefiltert erscheinen.
- [ ] Einen eigenen Portalbereich unter einer stabilen Route wie `/volkskammer/sitzungen/` in der
  vorhandenen Astro-Architektur umsetzen: Übersicht, Sitzungsdetail, Breadcrumbs, Canonical, H1,
  Suchindex, Sitemap und strukturierte Medienmetadaten. Sitzungen mit vorhandenen Terminen, Reden,
  Gesetzgebungsverfahren, Drucksachen und Rechtsgrundlagen verknüpfen, ohne deren Inhalte zu
  duplizieren. Vor Aufnahme in die Hauptnavigation zunächst die gemeinsame Nutzung und dauerhafte
  redaktionelle Zuständigkeit bestätigen.
- [ ] Einen barrierearmen Player als kleine wiederverwendbare Komponente entwickeln. Video soll
  adaptiv über Stream ausgeliefert werden; Audio kann über ein natives `<audio>`-Element von einer
  R2-Custom-Domain kommen. Kein Autoplay, keine ungefragte Vorabübertragung großer Datenmengen,
  verständliche Beschriftungen, vollständige Tastaturbedienung, sichtbarer Fokus, Lautstärke,
  Zeitsprung, Wiedergabegeschwindigkeit, Dauer, Fehlerzustand und ein textlicher Direktlink müssen
  unabhängig vom Player funktionieren. Player und Medien erst nach Nutzeraktion beziehungsweise
  außerhalb des sichtbaren Einstiegs zurückhaltend laden.
- [ ] Barrierefreiheit als Veröffentlichungsvoraussetzung modellieren: deutschsprachige geprüfte
  WebVTT-Untertitel für Video, vollständiges Transkript für reine Audioaufzeichnungen,
  Sprecher:innenkennzeichnung und relevante nichtsprachliche Geräusche. Visuell vermittelte
  sitzungsrelevante Informationen zusätzlich im Transkript beschreiben oder durch Audiodeskription
  zugänglich machen. Automatisch erzeugte Untertitel dürfen erst nach redaktioneller Prüfung
  freigegeben werden. Maßstab sind insbesondere die W3C-Anforderungen für
  [Untertitel aufgezeichneter Medien](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded)
  und [Textalternativen für reine Audioaufzeichnungen](https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded.html).
- [ ] Vor jeder Veröffentlichung Rechte, Datenschutz und Sitzungsöffentlichkeit prüfen und
  dokumentieren. Nichtöffentliche Beratungen, Sitzungspausen, vertrauliche Einblendungen sowie
  Personen ohne erforderliche Freigabe müssen vor Upload beziehungsweise Veröffentlichung sicher
  getrennt oder entfernt sein. Zuständigkeit für Freigabe, Beanstandung, nachträgliche Sperrung,
  Korrektur und endgültige Löschung einschließlich Protokollierung festlegen; eine bloße
  technische Abrufbarkeit darf keinen Veröffentlichungsstatus begründen.
- [ ] Einen geschützten, vom eigentlichen PR getrennten Uploadablauf entwerfen. Der dafür
  vorgesehene serverseitige Dienst darf nur kurzlebige Einmal-URLs ausstellen und keine dauerhaften
  Medien-API-Schlüssel an den Browser geben. Für lange Videos die von Cloudflare vorgesehenen
  [resumierbaren tus-Uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/)
  verwenden; für große Audioobjekte einen resumierbaren R2-Multipart-Upload prüfen. Dateigröße,
  MIME-Typ, Dateisignatur, Dauer, Prüfsumme, erlaubte Formate und Objektpfad serverseitig
  validieren. Upload, technische Verarbeitung, Untertitelprüfung und Veröffentlichung als
  getrennte Zustände behandeln.
- [ ] Für Audio und Downloads einen privaten R2-Arbeitsbereich und einen ausdrücklich freigegebenen
  Veröffentlichungsbereich planen. Öffentliche Dateien nur über eine
  [eigene R2-Custom-Domain](https://developers.cloudflare.com/r2/buckets/public-buckets/) mit CDN,
  passenden Cache-Headern, stabilen ETags und geprüft funktionierenden Byte-Range-Antworten
  ausliefern; `r2.dev` nicht produktiv verwenden. Direkte Browseruploads nur mit kurzlebigen,
  in Methode, Objektpfad, Content-Type und Größe begrenzten Berechtigungen sowie enger CORS-Regel
  zulassen. Unvollständige Multipart-Uploads automatisch bereinigen und Originale nicht
  versehentlich öffentlich schalten.
- [ ] CSP, Permissions Policy und Datenschutzseite minimal für die gewählte Auslieferung anpassen.
  Nur die konkrete Stream- beziehungsweise Medien-Domain in `frame-src`, `media-src` und soweit
  erforderlich `connect-src` aufnehmen; keine pauschalen Wildcards. Prüfen, welche Abruf- und
  Analysedaten Cloudflare Stream erzeugt, ob ein eigener Player oder der Stream-Iframe verwendet
  wird und ob zustimmungsfreie technisch notwendige Auslieferung vertretbar ist. Medienabrufe
  nicht mit der optionalen allgemeinen Webanalyse vermischen.
- [ ] Veröffentlichungs- und Löschkonsistenz absichern: Eine Sitzungsseite darf erst erscheinen,
  wenn Medienverarbeitung, Freigabe, Untertitel beziehungsweise Transkript und Vorschaubild
  vollständig sind. Für fehlgeschlagene oder verwaiste Uploads, aus Git entfernte Metadaten,
  ersetzte Fassungen und gesperrte Aufzeichnungen einen nachvollziehbaren Abgleich- und
  Bereinigungsprozess schaffen. Dauerhafte öffentliche URLs nur kontrolliert ersetzen; Korrekturen
  mit Änderungsdatum kenntlich machen.
- [ ] Tests für Schema und Inhaltsvalidierung, Suche, Sitemap, Metadaten und Querverweise ergänzen.
  Browserprüfungen müssen Video- und Audio-Wiedergabe, Kapitelmarken, Untertitel, Transkript,
  Tastatursteuerung, kein Autoplay, verzögertes Laden, CSP/CORS, Byte-Range-Abrufe, langsame oder
  unterbrochene Verbindungen sowie verständliche Fehlerzustände abdecken. Accessibility- und
  Visual-Baselines für Mobil-, Tablet- und Desktopbreiten ergänzen.
- [ ] Vor dem allgemeinen Start eine einzelne längere öffentliche Sitzung als Pilot veröffentlichen
  und Uploadfortsetzung, Verarbeitungszeit, tatsächliche Bandbreite, mobile Wiedergabe,
  Untertitelworkflow, Kosten, Löschung und Wiederherstellung praktisch messen. Erst nach
  dokumentierter Abnahme entscheiden, ob die Mediathek dauerhaft betrieben und später um
  Livestreaming, abonnierbare Audioangebote oder sitzungsübergreifende Transkriptsuche erweitert
  wird.

### Rechtsportal und Primärquellen

Der Konsolidierungsaudit erkennt derzeit 89 Zielnormen; 84 sind vollständig konsolidiert. Die
folgenden fünf Rechtsfälle bleiben als konkrete Quellenarbeit offen:

- [ ] Gesetz über den öffentlichen Personennahverkehr (`blocked-source-conflict`): den Konflikt
  zwischen Artikel 9 Nummer 1 und der maßgeblichen Ausgangsfassung quellenbasiert klären.
- [ ] NDR-Staatsvertrag (`missing-baseline`): die in der korrigierten Ausgabe eindeutig bezeichnete
  vollständige Ausgangsfassung vor der Änderung vom 8. März 2026 einschließlich Anlagen unverändert
  archivieren und als Konsolidierungsbaseline verarbeiten.
- [ ] Ostdeutsche Gemeindeordnung (`blocked-source-conflict`): die kollidierende Anordnung zu § 71b
  im Gesetz zur Einführung von Hinweisgebermeldestellen mit einer Berichtigung oder weiteren
  Primärquelle klären.
- [ ] Schulordnung Förderschulen (`blocked-source-conflict`): den nicht passenden Änderungsanker
  aus OGVBl. 2026 Nr. 64 auch unter Berücksichtigung der Berichtigung in Nr. 68 klären.
- [ ] Zehntes Sächsisches Kostenverzeichnis (`blocked-source-conflict`): den widersprüchlichen
  Ausgangsbestand des Tarifplatzes 3 mit einer belastbaren Quelle auflösen.
- [ ] Die drei verbleibenden produktiven Legacy-Markdown-Referenzen aus zwei Quellen erst nach
  Quellenklärung durch strukturtragende HTML-Quellen ersetzen: OGVBl. 2025 Nr. 10 ist wegen eines
  Konflikts zwischen Markdown und PDF blockiert, für OGVBl. 2024 Nr. 2 S. 2 fehlt die ausreichende
  Kontrollquelle. Die Einzelbegründungen stehen im Altquelleninventar.

### Aktuelle Vorhaben und öffentliche Inhalte

- [ ] Die Volksbefragung und die Wahl zur achten Volkskammer entlang der belegten Termine
  fortschreiben: Durchführung vom 5. September um 18 Uhr bis 6. September um 18 Uhr,
  Ergebnisbekanntmachung bis 10. September und spätere politische Folgebeschlüsse erst nach Eingang
  der jeweiligen Primärquelle übernehmen. Danach Hervorhebungen, nächste Schritte, Terminarchive
  und Rechtsverknüpfungen gemeinsam aktualisieren.
- [ ] Boom Europe und OVV/DB getrennt weiterführen: operative Standorteröffnung und
  Projektorganisation von Boom, Beginn und Tarifbedingungen der 57-Millionen-Euro-
  Ticketanerkennung sowie etwaige tatsächliche Fernverkehrsreaktivierungen nur mit
  Vollzugsbelegen aktualisieren.
- [ ] Für bestätigte Beschaffungs- und Unternehmensentscheidungen die noch fehlende praktische
  Umsetzung belegen. Dazu gehören Zuschlagsempfänger sowie Lieferung und Betrieb des E-Jura-
  Systems, Auslieferung der vier Hovercrafts, NVIDIA-Standortumsetzung, Lieferung des ersten
  Zeppelin NT und Errichtung des Luxemburg-Liebknecht-Denkmals.

### Politische Geschichte und Wissenshub

- [ ] Die politische Chronologie vor Dezember 2025 vervollständigen: frühere Regierungen und
  Wahlperioden, Ende der Amtszeit Tom Kurzschlusses, Misstrauensvoten, Partei- und Fraktionswechsel,
  Honeckers belegte Biografie sowie die Namensgeschichte von DEMOS. Weitere Rollenintervalle und
  Mehrheitsangaben nur aus datierten Primärakten oder klar gekennzeichneten historischen Quellen
  übernehmen.
- [ ] Die verbleibenden unbestimmten Personen und nichtrechtlichen Realitätsereignisse aus
  `knowledge/conversation-candidates.json` einzeln prüfen. Bestätigte Befunde in Personenrollen,
  Timeline oder Proceedings überführen, Widerlegtes verwerfen und unprüfbares Gesprächswissen
  nicht in den Gegenwartsstand übernehmen. Offene Verfahrensdetails bleiben bis zu belastbaren
  Aktenzeichen, Entscheidungen oder Vollzugsnachweisen in `knowledge/proceedings.json` offen.

### Dokumentation und laufende Qualität

Die wiederkehrenden Dokumentations- und Releaseprüfungen stehen dauerhaft im
[`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md). Sie sind Pflegeanforderungen und keine
einmalig abzuschließenden Backlogpunkte.

### Technik

Die CI/CD trennt Runtime-Deploymentziele von Verifikationsumfang: `docs-only` führt nur die
leichte Dokumentationsprüfung aus, `ci-only` führt notwendige Checks ohne Produktionsdeployment
aus, und `portal`, `law` sowie `shared` bauen und veröffentlichen nur die jeweils betroffenen
Websites. Die Deploymentzuordnung und die konservativen gemeinsamen Pfade sind im
[`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md) beschrieben.
Der Redaktionsstichtag wird nur einmal in `packages/shared/src/config/editorial.json` gesetzt. Gesetzgebungsverfahren
und öffentliche Auswertungen leiten ihren gemeinsamen Stand daraus ab; historische Quellen- und
Ereignisdaten bleiben davon unabhängig.
