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

Grundentscheidung ist **ein npm-Workspace-Monorepo mit einem gemeinsamen Daten- und Wissensbestand,
zwei öffentlichen Anwendungen und einem getrennten Redaktionsworker**:

- Staatsportal: `https://freistaat-ostdeutschland.de`
- Rechtsportal OstRecht: `https://recht.freistaat-ostdeutschland.de`

Beide Anwendungen lesen dieselben Bestände unter `content/`, `Gesetze/` und `knowledge/`.
`knowledge/` wird nicht öffentlich ausgeliefert. Das Staatsportal behält unter `/recht/` nur eine
redaktionelle Brückenseite; Rechtsdetailseiten liegen ausschließlich auf der Rechtsdomain.

Die Workspaces sind `@ostrecht/portal` unter `apps/portal/`, `@ostrecht/recht` unter `apps/recht/`,
`@ostrecht/redaktion` unter `apps/redaktion/` und das intern gemeinsam genutzte Paket
`@ostrecht/shared` unter `packages/shared/`. Die Root-`package.json` orchestriert Entwicklung,
Prüfung, Build und Deployment; ein zusätzlicher Monorepo-Orchestrator wird nicht verwendet.

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
nach `apps/portal/dist/`, `npm run build:recht` nach `apps/recht/dist/`. Beide Astro-Anwendungen
besitzen eine feste app-lokale `astro.config.mjs`. Ihre Cloudflare-Konfigurationen liegen unter
`apps/portal/wrangler.jsonc` und `apps/recht/wrangler.jsonc`; der Editorial Worker verwendet
`apps/redaktion/wrangler.jsonc`.

Die gemeinsame Assetquelle bleibt `public/`. Vor einem Build erzeugt
`scripts/prepare-site-public.mjs` den jeweils benötigten, nicht versionierten Bestand unter
`apps/portal/.site-public/` oder `apps/recht/.site-public/`. Dadurch werden Rechts-PDFs weiterhin
nur an OstRecht ausgeliefert, ohne die Quellen im Repository zu duplizieren.

`npm run deploy` veröffentlicht beide Artefakte desselben Commits in der Reihenfolge OstRecht,
danach Staatsportal. Details zu Veröffentlichung, Wiederanlauf und Produktionskontrolle stehen in
`docs/DEPLOYMENT_RUNBOOK.md`.

## Wichtige Verzeichnisse

```text
apps/
  portal/       Staatsportal; Astro- und Wrangler-Konfiguration, Pages, Layout und Portalcode
  recht/        OstRecht; Astro- und Wrangler-Konfiguration, Pages, Layout und Normkomponenten
  redaktion/    Redaktionsstudio; Worker-Quellcode und Wrangler-Konfiguration

packages/
  shared/       gemeinsam genutzte Komponenten, Konfiguration, Styles, Typen und Fachlogik

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

Der Haushaltsbereich verwendet `apps/portal/src/data/haushalt.ts` als zentrale Datenlogik. Gesamtplan,
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

**Zuletzt abgeglichen:** 29. August 2026

Diese Liste ist der zentrale Projektbacklog. Jede noch offene Aufgabe muss hier mindestens als
Sammelpunkt erscheinen. Quellenlocators, Einzelkonflikte und maschinenlesbare Zustände werden
weiterhin in `CONTENT_GAPS.md`, `knowledge/open-questions.json`,
`content/portal/topic-coverage.json` und `data/recht/consolidation-report.md` gepflegt; diese
Dateien liefern die Nachweise, bilden aber keine parallele Aufgabenliste. Erledigte Punkte werden
entfernt statt dauerhaft abgehakt stehen gelassen.

Alle dafür noch benötigten externen Einstellungen, fachlichen Entscheidungen und Primärquellen
sind ausfüllbar im [`docs/ZUARBEITSFORMULAR.md`](docs/ZUARBEITSFORMULAR.md) gebündelt. Das Formular
dient nur der Übergabe von Zuarbeit; der Aufgabenstatus wird weiterhin ausschließlich hier gepflegt.

### Sitzungsmediathek der Volkskammer

Der derzeitige Portalstand kann lange Sitzungsaufzeichnungen noch nicht sachgerecht aufnehmen.
Workers Static Assets erlauben nur [25 MiB je Datei](https://developers.cloudflare.com/workers/platform/limits/),
die Medien-CSP lässt ausschließlich die eigene Origin zu und das Redaktionsstudio ist nur für
kleine Bilddateien ausgelegt. Große Audio- oder Videodateien dürfen deshalb weder unter `public/`
noch als GitHub-Blob in einen Redaktions-PR gelangen. Die folgende Planung betrifft zunächst
aufgezeichnete öffentliche Sitzungen, keinen Livebetrieb.

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
- [ ] Einen geschützten, vom eigentlichen PR getrennten Uploadablauf entwerfen. Der Editorial
  Worker darf nur kurzlebige Einmal-URLs ausstellen und keine dauerhaften Medien-API-Schlüssel an
  den Browser geben. Für lange Videos die von Cloudflare vorgesehenen
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

Der Konsolidierungsaudit erkennt derzeit 85 Zielnormen; 81 sind vollständig konsolidiert. Die
folgenden vier Rechtsfälle bleiben als konkrete Quellenarbeit offen:

- [ ] Gesetz über den öffentlichen Personennahverkehr (`blocked-source-conflict`): den Konflikt
  zwischen Artikel 9 Nummer 1 und der maßgeblichen Ausgangsfassung quellenbasiert klären.
- [ ] NDR-Staatsvertrag (`missing-baseline`): die vollständige maßgebliche Ausgangsfassung vor
  der Änderung vom 8. März 2026 einschließlich Anlagen beschaffen.
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

Die CI/CD klassifiziert Änderungen zentral in `docs-only`, `portal`, `law` und `shared`; die
Deploymentzuordnung und die konservativen gemeinsamen Pfade sind im
[`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md) beschrieben.
Der Redaktionsstichtag wird nur einmal in `packages/shared/src/config/editorial.json` gesetzt. Gesetzgebungsverfahren
und öffentliche Auswertungen leiten ihren gemeinsamen Stand daraus ab; historische Quellen- und
Ereignisdaten bleiben davon unabhängig.
