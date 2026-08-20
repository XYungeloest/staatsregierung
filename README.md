# Staatsrat des Ostdeutschen Freistaates

Website des fiktiven Staatsrates des Ostdeutschen Freistaates mit Staatsportal, eigenständigem Rechtsportal, Presse, Haushalt und Service.

Die öffentliche Website soll sachlich, ruhig und behördennah wirken. Architektur- und Entwicklungsbegriffe gehören nicht in öffentliche Seitentexte; operative Hinweise bleiben in Code, README, AGENTS oder `CONTENT.md`.

Die zentrale Anleitung zur Pflege der Website-Inhalte steht in `CONTENT.md`.
Der aktuelle redaktionelle Stand ist der 16. August 2026. Der frühere Stichtagsimport vom
19. Juli 2026 bleibt in `CONTENT_UPDATE_2026-07-19.md` historisch dokumentiert; aktuelle offene
Quellenfragen stehen in `CONTENT_GAPS.md`.

## Projektkern

- Astro und TypeScript
- Cloudflare Workers als Zielplattform
- dateibasierte Inhalte unter `content/`
- normalisierte Regierungsorganisation unter `content/organisation/`
- getrenntes, Access-geschütztes Git-Redaktionsstudio unter `/redaktion/`
- interner Wissenshub unter `knowledge/`
- eigenständiges Rechtsportal OstRecht unter `https://recht.freistaat-ostdeutschland.de` mit Normen, Fassungen, Historien, Rechtsherkunft,
  Rechtsentwicklung, Sachgebieten, Fundstellen, Verkündungen und Rechtssuche

Das Projekt ist eine politische Simulation. Es stellt keine echte amtliche Veröffentlichung dar.
Der dafür notwendige Hinweis erscheint sichtbar in der oberen Hinweisleiste und im Footer. Das
Impressum enthält zusätzlich die rechtlich erforderliche ausführliche Einordnung; weitere
öffentliche Texte sollen die Simulation nicht wiederholen.

Grundentscheidung: **Ein Repository, ein gemeinsamer Daten- und Wissensbestand, zwei öffentliche
Anwendungen.** Das Staatsportal läuft unter `https://freistaat-ostdeutschland.de`; OstRecht läuft
unter `https://recht.freistaat-ostdeutschland.de`. Beide Builds lesen dieselben Verzeichnisse
`content/`, `Gesetze/` und `knowledge/`, wobei `knowledge/` in keinem öffentlichen Artefakt
ausgeliefert wird. Das Staatsportal behält unter `/recht/` nur eine redaktionelle Brückenseite.

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

`PORTAL_SITE_URL` und `LAW_SITE_URL` steuern die beiden Origins zentral. Produktionsdefaults sind
`https://freistaat-ostdeutschland.de` und `https://recht.freistaat-ostdeutschland.de`:

```sh
PORTAL_SITE_URL=https://portal.example LAW_SITE_URL=https://recht.example npm run build
```

`npm run build:portal` schreibt nach `dist/portal/`, `npm run build:recht` nach `dist/law/`.
`wrangler.jsonc` deployt das erste Artefakt auf den bestehenden Worker `ostrecht-portal`,
`wrangler.recht.jsonc` das zweite auf `ostrecht-recht`. `npm run deploy` veröffentlicht beide
Artefakte desselben Commits verbindlich in der Reihenfolge OstRecht, dann Staatsportal; die
Staging-Varianten verwenden dieselbe Reihenfolge mit den jeweiligen Wrangler-Umgebungen.

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
  AUDIT.md
  SOURCE_POLICY.md
  current-state.json
  timeline.json
  projects.json
  proceedings.json

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
  externe Ausgangstexte und Simulationsmaterial
```

Architektur, externe Einrichtung und Bedienung des Redaktionsstudios stehen in
`docs/EDITORIAL_ARCHITECTURE.md`, `docs/EDITORIAL_SETUP.md` und
`docs/EDITORIAL_RUNBOOK.md`.
Veröffentlichung, Fehleranalyse, Wiederanlauf und Produktionsnachkontrolle sind in
`docs/DEPLOYMENT_RUNBOOK.md` beschrieben.

`context/` bleibt bewusst erhalten. Alte Planungs- und Zwischendokumente im Repository-Root wurden in diese README und `AGENTS.md` verdichtet.

## Interner Wissenshub

`knowledge/` ist ein interner, nicht öffentlich ausgelieferter Quellen-, Beziehungs- und Zeitindex für die Politiksimulation. Er ersetzt weder die öffentlichen Inhalte unter `content/` noch die Rechtsquellen unter `Gesetze/` und kopiert keine Normvolltexte.

Der zentrale Einstieg steht in `knowledge/README.md`. Bestätigte Einträge benötigen konkrete Quellenreferenzen und, soweit bekannt, Gültigkeitszeiträume. Gesprächswissen bleibt bis zur Prüfung in `knowledge/conversation-candidates.json`. Als externe Wikiquelle ist ausschließlich das PolitikSim-Wiki auf Miraheze zulässig; andere Wikihoster werden nicht übernommen.

Die Dateien unter `knowledge/generated/` werden ausschließlich mit `npm run knowledge:build` erzeugt und nicht manuell gepflegt. `npm run knowledge:check` prüft Quellen, IDs, Datumswerte, Querverweise, Rollenintervalle und die Übereinstimmung der generierten Dateien.

## Content-Regeln

- Die vollständige Pflegeanleitung für Inhaltsformate, JSON-Felder, Normfassungen und Dashboarddaten steht in `CONTENT.md`.
- Öffentliche Inhalte werden deutschsprachig mit echten Umlauten gepflegt.
- Datumsdarstellung auf Seiten bevorzugt `TT. Monat JJJJ`.
- Regierungsmitglieder liegen unter `content/regierung/mitglieder/`.
- Ressorts liegen unter `content/ressorts/`.
- Aktuelle Ämter, Mitgliedschaft und Ressortleitungen werden ausschließlich aus
  `content/organisation/governments.json`, `offices.json` und `assignments.json` abgeleitet.
- Startseite, Kabinettschronologie, Aktionsplan und Timeline liegen unter `content/portal/`,
  `content/regierung/cabinet-page.json` und `content/dashboard/`.
- Themenseiten verweisen über `federfuehrendesRessort`, `rechtsgrundlagen[].normSlug` und
  `knowledgeProjectRefs` auf Ressorts, Normen und eingeordnete Wissenshub-Projekte. Ihre
  zeitlich begrenzte Hervorhebung speist Startseite und Themenübersicht gemeinsam.
- `content/portal/topic-coverage.json` ordnet Wissenshub-Projekte und Gegenwartsstände einer
  öffentlichen Oberfläche oder einer begründeten redaktionellen Ausnahme zu.
- Pressemitteilungen können über `relatedTopicSlugs`, `relatedNormSlugs` und `relatedPressSlugs` querverlinkt werden.
- Stellenangebote liegen unter `content/service/stellen/`.
- Personenbezeichnungen werden durchgehend mit Doppelpunkt gegendert, zum Beispiel `Bürger:innen`
  und `Referent:in`; Paarformen, Sternchen, Binnen-I und Unterstriche werden nicht verwendet.
- Service-Grundseiten liegen unter `content/service/seiten/`.
- Normen liegen unter `content/normen/[slug]/` mit `meta.json`, `history.json` und `versions/[versionId].json`.
- Verkündungen liegen unter `content/verkuendungen/[slug].json` und verknüpfen Ausgaben über
  `entries[].normSlug` und `entries[].versionId` mit gespeicherten Normfassungen.
- Parlamentarische Verfahren liegen unter `content/gesetzgebung/[slug].json`. Ihr Status wird aus
  belegten Drucksachen, Empfehlungen und Tagesordnungen gepflegt und ändert sich nicht allein mit
  dem Ablauf eines angesetzten Sitzungstermins.
- Die redaktionell geprüften HTML-Dateien unter `Gesetze/` sind die alleinigen regulären
  Importquellen für Verkündungsblätter und konsolidierte Einzelnormen. Der Import liest sie mit
  einem HTML5-Parser, rekonstruiert daraus strukturierte Normdaten und veröffentlicht niemals das
  Quell-HTML direkt. Eine intern derselben Ausgabe zugeordnete Markdown-Datei wird nicht geöffnet.
  Für Altquellen ohne HTML bleibt ein getrennter Legacy-Parser verfügbar; solche Datensätze sind als
  `legacy-markdown-transcription` gekennzeichnet. Soweit vorhanden, wird die zugehörige PDF immer
  visuell gegen Gliederungstiefe, Einrückung, Nummerierungsfolge, Listenfortsetzungen, Zitate,
  Tabellen und Anlagen geprüft, aber nicht automatisch als Volltext importiert. Nicht eindeutig
  auflösbare Abweichungen zwischen HTML, Legacy-Markdown und PDF werden nicht still harmonisiert.
  Bundesblätter können einen eigenen, ausdrücklich geprüften Layoutpfad verwenden. Für
  `GMBl. 2026 Nr. 14` erkennt der Importer den Bundesblattkopf und die Übersicht `INHALT`
  unabhängig von der OGVBl.-Struktur; der enthaltene Dokumenttyp lautet
  `verwaltungsabkommen`.

Historische Normfassungen werden nicht zur Laufzeit berechnet. Sie werden als vollständige,
unveränderliche Fassungen gespeichert. Für ausdrücklich geänderte übernommene Stammnormen beginnt
die belegte Fassungsfolge mit dem am 1. November 2023 geltenden sächsischen Rechtsstand. Der
Konsolidierungslauf verwendet ausschließlich versionierte amtliche REVOSax-Snapshots und
redaktionell geprüfte, deterministische Patch-Rezepte; bei einem uneindeutigen Zielanker oder
abweichenden Ausgangstext bricht er ab. Bezeichnet eine ostdeutsche Änderung ausdrücklich einen
späteren sächsischen Zwischenstand, wird auch dieser als eigener Snapshot mit dem wörtlichen
Adoptionsbeleg versioniert; sonstige spätere sächsische Änderungen werden nicht übernommen.
Mehrere Änderungen mit demselben Wirksamkeitstag benötigen eine explizite Reihenfolge und erzeugen
eine gemeinsame Folgefassung mit getrennten Historieneinträgen. `src/lib/norms/versions.ts` ordnet jede gespeicherte Fassung anhand ihres
Gültigkeitsintervalls und des Stichtags aus `src/config/editorial.json` als geltend, künftig,
historisch oder mit ungeklärtem Inkrafttreten ein. `isCurrent` bleibt nur als kompatibles
Bestandsfeld erhalten und steuert keine öffentliche Bezeichnung mehr. Ein ausdrücklich als
historisch oder aufgehoben geführter Datensatz bleibt auch bei einem noch nicht gespeicherten
Intervallende historisch; die Oberfläche benennt das fehlende Enddatum dann ausdrücklich.

`src/lib/norms/origin.ts` leitet die Rechtsherkunft einheitlich aus den gespeicherten Quellen- und
Historienfeldern ab. Als übernommene Ausgangsfassung gilt nur eine am 1. November 2023 beginnende
Fassung mit einem amtlichen REVOSax-Snapshot, dessen Quellenzeitraum diesen Tag umfasst.
Ostdeutsche Änderungen werden aus datierten Änderungs- und Aufhebungseinträgen mit belegter
ostdeutscher Verkündung beziehungsweise eindeutig verknüpfter Änderungsvorschrift bestimmt. Eine
nach dem Ausgangsstichtag erstmals verkündete Norm wird nur bei eigener ostdeutscher
Veröffentlichungsgrundlage als eigenständig neu geschaffen eingeordnet. Fehlt ein solcher Beleg,
bleibt die Herkunft ausdrücklich ungeklärt. Die Einordnung wird für Normseiten, Fassungen, Suche
und `/rechtsentwicklung/` auf OstRecht aus derselben Funktion erzeugt.

Die Rechtssuche wird buildzeitbasiert aus den gespeicherten Fassungen erzeugt. Der allgemeine
Normlink ist dynamisch und führt zur am redaktionellen Stichtag geltenden Fassung. Gibt es noch
keine geltende Fassung, zeigt er die nächste belegte zukünftige beziehungsweise die veröffentlichte
Fassung mit ungeklärtem Inkrafttreten. Versionsspezifische Links bleiben unveränderlich. Die Suche
verwendet standardmäßig geltende Fassungen; Fassungsart, Mehrfachfacetten, strukturierte
Fundstellen, Rechtsherkunft und Präfix-Platzhalter mit `*` sind explizite Filter. Änderungsvorschriften werden
über den Normtyp, belegte Einführungsbeziehungen oder eine eindeutige Änderungsbezeichnung im
amtlichen Titel erkannt und standardmäßig getrennt angeboten.

Öffentliche Vollzitate werden fassungsspezifisch aus dem vollständigen Normtitel, der gespeicherten
Stammfundstelle und dem letzten Historieneintrag mit zugeordneter Änderungsvorschrift gebildet.
`initialCitation`, die Zitierangaben der Fassungen und die Fundstellen in den Verkündungsdatensätzen
bleiben dabei unveränderte Quellen- und Provenienzfelder. Fehlt wegen eines dokumentierten
Quellenkonflikts ein Normdatum, ergänzt die Zitierlogik kein vermeintlich eindeutiges Datum.

## Zentrale Konfiguration

- `src/config/site.ts`: beide Site-Origins, Site-Namen, Pfade, Navigationen und Kontakt
- `src/config/editorial.json`: zentraler redaktioneller Stichtag
- `src/config/features.ts`: Feature-Flag für die optionale Webanalyse
- `src/config/analytics.ts`: Consent und Webanalyse-Konfiguration
- `src/lib/portal/routes.ts`: zentrale Portalpfade und absolute Cross-Site-Links
- `src/lib/norms/routes.ts`: zentrale Rechtspfadlogik ohne öffentliches `/recht/`-Präfix
- `src/config/law-subjects.ts`: redaktionelle Gruppierung der belegten Sachgebiete ohne erfundene Systemnummern
- OstRecht hat statische Einstiege für Suche, alphabetischen Index, Sachgebiete,
  Rechtsentwicklung, Fundstellennachweise, Verkündungen, Förderrichtlinien und Hilfe. Neue Rechtspfade werden
  zentral über die Route-Helper gepflegt.

Normseiten bieten eine gemeinsame Fassungsnavigation, einen strukturellen Vergleich gespeicherter
Fassungen, eine fassungsspezifische Herkunftseinordnung, gerichtete Beziehungen zu Einführungs-,
Änderungs- und Aufhebungsvorschriften, semantische Sprungmarken mit kompatiblen Altankern sowie
Gesamt- und Einzeldruck. Die Vergleichsseite rendert nur den üblichen Vergleich zur vorherigen
Fassung vor; weitere Fassungs-Paare werden als kleine statische JSON-Dateien geladen. Dadurch
bleiben freie Auswahl und stabile `von`-/`bis`-Adressen erhalten, ohne sämtliche Paarungen in eine
Seite einzubetten.
PDF-Links werden nur ausgegeben, wenn eine entsprechende Datei oder externe Quelle im
Verkündungsdatensatz belegt ist. Eine HTML-Druckansicht wird nicht als amtliche Verkündung
bezeichnet.

Für öffentliche Übersichten werden Termine und Stellenangebote über
`src/lib/portal/dates.ts` gegen den redaktionellen Stichtag gefiltert. Vergangene Termine und
abgelaufene Fristen bleiben im Archiv erreichbar, werden aber nicht als aktuell ausgegeben.
Der derzeitige Stichtag ist der 16. August 2026.

Der Normimport ist standardmäßig ein schreibfreier Audit. `npm run norms:audit` klassifiziert die
Quellen und zeigt erkannte Normen und geplante Änderungen. Schreiben ist nur gezielt mit
`npm run norms:import -- --write --file "Gesetze/…html"` möglich; eine Markdown-only-Altquelle kann
auf dieselbe Weise ausdrücklich mit einer `.md`-Datei ausgewählt werden. Vorhandene Datensätze werden nur
mit dem zusätzlichen Flag `--update-existing` verändert. Der Import löscht den Normbestand nicht.
`npm run norms:audit -- --strict` vergleicht die konfigurierten Primärquellen mit den gespeicherten
Norm- und Verkündungsdaten und beendet den Prozess bei Abweichungen mit einem Fehlercode.
`npm run content:check` führt diesen strikten Abgleich vor den übrigen Inhaltsprüfungen automatisch
aus.

Die Konsolidierungswerkzeuge arbeiten offline, abgesehen vom ausdrücklich aufgerufenen Fetch:

```sh
npm run norms:alt-sources:build
npm run norms:alt-sources:migrate
npm run norms:consolidation:audit
npm run norms:revosax:audit
npm run norms:revosax:fetch -- --target <slug> --url <historische-revosax-url>
npm run norms:revosax:parse -- --target <slug>
npm run norms:revosax:fetch -- --target <slug> --snapshot-id <id> --url <historische-revosax-url>
npm run norms:revosax:parse -- --target <slug> --snapshot-id <id>
npm run norms:consolidate -- --target <slug>
npm run norms:consolidate -- --target <slug> --write
```

`norms:alt-sources:build` erzeugt die redaktionell geprüften HTML-Transkriptionen der
bildbasierten Ausgaben OGVBl. II/2024 und I/2025 aus den versionierten Teiltranskriptionen.
`norms:alt-sources:migrate` prüft vor jeder Änderung die festgehaltenen SHA-256-Werte der
Original-PDFs und des DOCX, validiert die Vollständigkeit der Verfassung und Bezirksordnung und
schreibt anschließend ausschließlich den klar abgegrenzten Altquellenbestand. Beide Befehle
arbeiten offline. PDF und DOCX werden über `sourceReferences` als interne Prüfquellen geführt;
ein öffentlicher PDF-Link entsteht nur aus einer ausdrücklich öffentlich ausgelieferten Datei.

Der Audit schreibt `data/recht/consolidation-manifest.json` und
`data/recht/consolidation-report.md`. `npm run content:check` prüft diese Dateien im
schreibfreien `--check`-Modus, validiert Snapshot-Hashes und verhindert dadurch, dass ein neuer
Änderungsfund oder ein Quellenkonflikt unbemerkt bleibt. Ein Vollaufbau aller Normen ist bewusst
nicht vorgesehen.

Jeder Produktionsbuild trägt den vollständigen Git-Commit als `meta[name="build-commit"]` in
HTML-Seiten und als Antwortheader `X-Portal-Commit` auf allen Routen. In CI wird die Kennung aus
`GITHUB_SHA` über `PORTAL_BUILD_COMMIT` übernommen; lokale Builds verwenden den aktuellen `HEAD`.
Der öffentlich ausgelieferte Produktionsstand wird nicht dauerhaft in dieser README festgeschrieben.
Nach einem Produktionsdeployment prüft der Workflow automatisch die Portalseiten `/` und `/recht/`,
beide Sitemaps und `robots.txt`, OstRechts Startseite, Suche, eine repräsentative Norm und die
Verkündungsübersicht sowie einen permanenten Altpfad-Redirect. `X-Portal-Commit` und
`meta[name="build-commit"]` müssen auf beiden Origins dieselbe vollständige Kennung des
freigegebenen Commits ausgeben; andernfalls schlägt der Deployment-Job fehl.

Die Kreis- und Bezirksreform ist unter `/kreisreform/` erreichbar und zusätzlich in Hauptnavigation,
Startseite und Themen-Einstiegen verlinkt. Die Kartendaten liegen unter
`public/data/kreisreform/`. Die interaktive Karte wird auf keiner Viewportbreite automatisch
gestartet: Erst die ausdrückliche Freigabe innerhalb des aktuellen Seitenaufrufs lädt Kacheln von
OpenStreetMap. Gebietssuche, Bezirksübersichten, Filter und Tabellen funktionieren vollständig
ohne Kartenstart.

Der Bereich Bildung und Schule hat neben dem allgemeinen Einstieg unter
`/themen/bildung-und-schule/` eine feste Unterseite zum Schulsystem unter
`/themen/bildung-und-schule/schulsystem/`. Die Schulsystemgrafik wird als redaktionelles SVG unter
`public/images/ui/schulsystem.svg` ausgeliefert; die bearbeitbare Ausgangsdatei bleibt in
`context/schulsystem.drawio.svg`.

Der Haushaltsbereich verwendet `src/data/haushalt.ts` als zentrale Datenlogik. Die Datei liest die
Zusammenfassung unter `context/Staatshaushalt 2025_2026 - Zusammenfassung.csv` buildzeitbasiert
ein und berechnet daraus Summen, Anteile und Jahresvergleiche. Ausgewählte Kapitel- und Titelangaben
der Einzelpläne stammen aus `context/Staatshaushalt 2025_2026.zip`. Gesamtplan, Einzelpläne und
Sondervermögen verwenden dieselbe Datenbasis; Sondervermögen werden nicht zu den Einzelplänen
addiert. Die öffentliche CSV-Ausgabe steht unter `/haushalt/daten.csv` bereit.

Webanalyse ist optional. Der Ausgangszustand nutzt nur notwendige Funktionen; eine Zustimmung wird
lokal gespeichert und kann über die Datenschutzeinstellungen zurückgesetzt werden. Google
Analytics wird erst nach Zustimmung nachgeladen. Eine etwaige automatische Einbindung von
Cloudflare Web Analytics muss zusätzlich in der Cloudflare-Projektkonfiguration deaktiviert
bleiben, weil sie außerhalb des Repository-Builds erfolgen kann.

Die allgemeine Portalsuche unter `/suche/` unterscheidet einen leeren Ausgangszustand, Laden,
Treffer, keine Treffer und Fehler. Die Suche und ihre Filter bleiben per Tastatur bedienbar; Status
und Trefferzahl werden zugänglich ausgegeben. Rechtsfundstellen verweisen auf OstRecht. Dort sind
Suche, Index, Sachgebiete, Verkündungen, Fundstellen, Verfassung, Förderrichtlinien und Hilfe
eigenständige Einstiege; deren Suchtreffer bleiben auf der Rechts-Origin.

Beide Sites teilen Basiskomponenten und Accessibility-Regeln, verwenden aber getrennte Layouts:
`BaseLayout.astro` für das Staatsportal und `LawLayout.astro` für OstRecht. Für Pressemitteilungen werden passende Artikel- und
Breadcrumb-Strukturdaten erzeugt; die Organisationsdaten kennzeichnen das Portal ausdrücklich als
fiktive Politiksimulation. Die getrennten Social-Media-Bilder liegen unter
`public/images/social/portal-preview.png` und `public/images/social/recht-preview.png`.

`BaseLayout.astro` stellt mit `mainWidth="contained"` den begrenzten Hauptcontainer für Fachseiten
und mit `mainWidth="full"` vollbreite Inhaltsbänder mit inneren Containern bereit. Die Startseite
verwendet die volle Variante und setzt ihre wiederverwendbaren Zugangskarten, Informationslisten,
Icons und das Serviceband aus `src/components/portal/` zusammen. Die dauerhaft gültigen
gestalterischen Regeln stehen in `DESIGN.md`.

## Laufzeit und Cloudflare

Beide öffentlichen Anwendungen werden als getrennte statische Artefakte für Cloudflare Workers
gebaut und nutzen aktuell keine D1- oder R2-Bindings. Pressemitteilungen, Termine,
Stellenangebote, Projektstatus und Rechtsdaten werden dateibasiert aus den gemeinsamen Quellen
erzeugt. GitHub Actions baut und deployt beide Worker nach gemeinsamer QA aus demselben Commit.

Alte Detailadressen unter `freistaat-ostdeutschland.de/recht/...` werden über die beim Portalbuild
erzeugte `_redirects`-Datei permanent auf die konfigurierte `LAW_SITE_URL` übertragen. `/recht/`
selbst bleibt die Brückenseite. Ein späterer Domainwechsel erfordert damit im Wesentlichen die neue
`LAW_SITE_URL`, eine angepasste Wrangler-Custom-Domain und einen Redirect des bisherigen Hosts;
Normdaten, Wissenshub und Themenseiten bleiben unverändert.

Die produktiven Sicherheitsheader einschließlich HSTS, CSP, Framing-, Referrer-, MIME- und
Permissions-Schutz werden über `public/_headers` für Cloudflare Static Assets ausgeliefert. Die CSP
erlaubt OpenStreetMap und Google-Analytics-Endpunkte nur als technisch mögliche, weiterhin durch
die jeweilige Einwilligungslogik gesperrte Ziele.

Responsive Regierungs-, Ressort- und Stellenbilder werden als AVIF, WebP und JPEG unter
`public/images/generated/` abgelegt. `npm run images:generate` erzeugt die Varianten deterministisch
aus den redaktionellen Originalbildern.

Das Rechtsportal darf funktional nicht leichtfertig umgebaut werden.

## Qualitätssicherung

Vor relevanten Änderungen:

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
npm run test:quality
npm run test:browsers
```

Nach öffentlichen Textänderungen zusätzlich gezielt nach Entwicklerbegriffen suchen und sicherstellen, dass sie nicht in Bürgerseiten erscheinen.
Bei Layout-, Karten- oder Header-Änderungen die Startseite und `/kreisreform/` zusätzlich bei den
definierten mobilen, Tablet- und Desktopbreiten prüfen.

`npm run links:check` prüft nach dem Build alle statisch ausgegebenen internen und bekannten
Cross-Site-Verweise beider Anwendungen.
`npm run test:visual` erzeugt und vergleicht Chromium-Screenshots dieser Ansichten. Die externen
Basiskacheln der Kreisreform werden dabei unterdrückt, damit die Baselines reproduzierbar bleiben.
`npm run test:a11y` führt zusätzlich einen automatisierten Accessibility-Smoke-Test aus. Beide
Checks ergänzen, ersetzen aber nicht den manuellen Tastatur- und Screenreader-Kurztest.
`npm run test:quality` prüft unter anderem die acht Abnahme-Viewports auf Dokumentüberlauf sowie
Karten- und Statistikfreigaben, Zoom und reduzierte Bewegung. `npm run test:browsers` führt die
zentralen Interaktionen zusätzlich in Chromium, Firefox und WebKit aus; `npm run seo:check` prüft
Metadaten, Canonicals, H1, JSON-LD, Social Cards, Suchseiten, Sitemaps und robots.txt beider Sites.

## TODO

**Zuletzt abgeglichen:** 14. August 2026

Diese Liste ist der zentrale Projektbacklog. Jede noch offene Aufgabe muss hier mindestens als
Sammelpunkt erscheinen. Quellenlocators, Einzelkonflikte und maschinenlesbare Zustände werden
weiterhin in `CONTENT_GAPS.md`, `knowledge/open-questions.json`,
`content/portal/topic-coverage.json` und `data/recht/consolidation-report.md` gepflegt; diese
Dateien liefern die Nachweise, bilden aber keine parallele Aufgabenliste. Erledigte Punkte werden
entfernt statt dauerhaft abgehakt stehen gelassen.

Alle dafür noch benötigten externen Einstellungen, fachlichen Entscheidungen und Primärquellen
sind ausfüllbar im [`docs/ZUARBEITSFORMULAR.md`](docs/ZUARBEITSFORMULAR.md) gebündelt. Das Formular
dient nur der Übergabe von Zuarbeit; der Aufgabenstatus wird weiterhin ausschließlich hier gepflegt.

### Portal und Betrieb

- [ ] In Cloudflare prüfen und dokumentieren, dass die automatische Webanalyse deaktiviert ist und
  Statistik ausschließlich nach ausdrücklicher Einwilligung geladen wird.

### Redaktionsstudio und Vorschauen

- [ ] Die in `docs/EDITORIAL_SETUP.md` beschriebene GitHub App, Installation, Worker-Secrets,
  Cloudflare-Access-Anwendung und produktive Worker-Route vollständig einrichten und mit einem
  nicht berechtigten sowie einem berechtigten Konto abnehmen.
- [ ] Geschützte Pull-Request-Vorschauen betrieblich aktivieren: Repositoryvariable und Secrets
  setzen, Alias- und Versionsdomains mit Cloudflare Access schützen und Upload, PR-Kommentar sowie
  das Löschen aller Preview-Versionen nach Merge oder Schließen in einem echten Test-PR prüfen.
- [ ] Einen vollständigen Studio-Testvorgang durchführen: Inhalt laden, atomaren Commit auf einem
  `redaktion/...`-Branch erzeugen, Draft Pull Request aktualisieren, SHA-Konflikt behandeln,
  Vorschau prüfen und erst nach Review über den normalen `main`-Workflow veröffentlichen.
- [ ] Das Redaktionsstudio für das erweiterte Themenmodell fachlich abnehmen und vervollständigen.
  Termine und Module müssen noch ohne Roh-JSON verständlich pflegbar sein; die bereits
  strukturierten Felder für Priorität, Highlight-Zeitraum, verwandte Themen und Wissensprojekte
  dabei praktisch abnehmen. Die atomare Gegenpflege von `knowledgeProjectRefs` in
  `content/portal/topic-coverage.json` ist durch Unit-Tests abgesichert, muss aber im vollständigen
  Studio-Testvorgang mitgeprüft werden.

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

- [ ] Die 33 im Konsolidierungsbericht als `missing-baseline` geführten Zielnormen priorisiert mit
  amtlichen historischen REVOSax-Fassungen, Gültigkeitszeitraum und unverändertem Snapshot sichern
  und anschließend über geprüfte Patch-Rezepte konsolidieren. Kulturraumgesetz und Ostdeutsches
  Polizeibehördengesetz sind wegen der Berlin-Darstellung zuerst zu bearbeiten.
- [ ] Die gemeinsame Dokumentidentität von `OABl. 2025 Nr. 2` und
  `StAnzO. 2026 Nr. 2.html` technisch zusammenführen; Dokumentkopf und internes Datum bleiben
  kanonisch.
- [ ] Für die noch ausschließlich als Markdown vorliegenden Altquellen schrittweise geprüfte
  strukturierte HTML-Transkriptionen erstellen und bis dahin PDF-Gegenprüfung und Legacy-Fixtures
  erhalten.
- [ ] Eine amtliche Berichtigung oder Ergänzung zum fehlenden Inkrafttretenssatz in § 7 des
  Verwaltungsabkommens zur Kasernierten Grenzpolizei einpflegen, sobald eine Primärquelle vorliegt.
- [ ] Plenarprotokoll, Abstimmungslisten und Beschlussempfehlungen 07/18 bis 07/21 zur Sitzung vom
  20. Juli 2026 nachreichen und ausschließlich damit Beratungsverlauf und Einzelabstimmungen
  ergänzen.
- [ ] Die geltende Hoheitszeichenregelung mit besonderem Gesetz, Verordnung, Anlagen und
  verbindlicher Wappenbeschreibung widerspruchsfrei belegen und konsolidieren.
- [ ] Feiertagsgesetz beziehungsweise Änderungsgesetze und ihre Inkrafttretensdaten normgenau
  zuordnen.
- [ ] Die Organisationserlasse 09/2025 und 12/2025 mit eindeutigen Aufhebungs- oder
  Übergangsquellen vervollständigen. Bis dahin keine präzisen Außerkrafttretensdaten erfinden und
  die Fortgeltung von 12/2025 neben dem Organisationserlass 05/2026 transparent halten.

### Aktuelle Vorhaben und öffentliche Inhalte

- [ ] Die Volksbefragung und die Wahl zur achten Volkskammer entlang der belegten Termine
  fortschreiben: vollständige Unterlagen nach der vorgesehenen Veröffentlichung am 22. August,
  Durchführung am 5. und 6. September sowie Ergebnisbekanntmachung bis 10. September erst nach
  Eingang der jeweiligen Primärquelle übernehmen. Danach Hervorhebungen, nächste Schritte,
  Terminarchive und Rechtsverknüpfungen gemeinsam aktualisieren.
- [ ] Boom Europe, OVV/DB und die Bodenprojekte getrennt weiterführen: operative Standorteröffnung
  und Projektorganisation von Boom, Beginn und Tarifbedingungen der 57-Millionen-Euro-
  Ticketanerkennung, etwaige tatsächliche Fernverkehrsreaktivierungen sowie Rechts- und
  Umsetzungsstand von Volksacker, Flächenfonds und Bodenfonds Ost nur mit Vollzugsbelegen
  aktualisieren.
- [ ] Für bestätigte Beschaffungs- und Unternehmensentscheidungen die noch fehlende praktische
  Umsetzung belegen. Dazu gehören Zuschlagsempfänger sowie Lieferung und Betrieb des E-Jura-
  Systems, Auslieferung der vier Hovercrafts, NVIDIA-Standortumsetzung, Lieferung des ersten
  Zeppelin NT und Errichtung des Luxemburg-Liebknecht-Denkmals. Abgelehnte oder zurückgezogene
  Varianten bleiben als solche abgeschlossen.
- [ ] Die Beendigung der ostdeutschen Kooperationen mit Israel durch den ursprünglichen
  Regierungsakt oder eine gleichwertige Primärquelle absichern und den genauen Umfang erst danach
  in öffentlichen Inhalten nachführen.
- [ ] Den praktischen Umsetzungsstand des Transparenz- und Informationsfreiheitsrechts klären.
  Ein öffentliches Transparenzportal oder ein Zuständigkeitsfinder darf erst als verfügbar
  erscheinen, wenn Route, Datenpflege, Zuständigkeit und Betrieb tatsächlich vorhanden und
  belegt sind. Ältere Planungen zu Transparenzportal, Zuständigkeitsfinder und Haushaltsnavigator
  einzeln als umgesetzt, weiterhin geplant, verworfen oder unbelegt klassifizieren.

### Politische Geschichte und Wissenshub

- [ ] Primärakten zum Bundesratszugangsstreit, zum formellen Abschluss der Präsidentenanklage gegen
  Manuela Dreyer sowie zu den Einzelakten und zum Ende von Karl Honeckers Vertretung der
  Bundespräsidentin sichern. Bis dahin keine Aktenzeichen, Entscheidungsdaten oder Rechtsfolgen
  ergänzen.
- [ ] Das Ende der historischen Bevollmächtigtenämter von Claus Weselsky und Gregor Gysi sowie die
  Übergänge der Staatskrise 2025 mit Ernennungs-, Entlassungs-, Wahl- oder Organisationsakten
  vervollständigen. Die historische Rolle Gerhardt Lehrmanns nur nach Quellenklärung modellieren
  und weiterhin kein aktuelles Personenprofil für ihn anlegen.
- [ ] Die politische Chronologie vor Dezember 2025 vervollständigen: frühere Regierungen und
  Wahlperioden, Ende der Amtszeit Tom Kurzschlusses, Misstrauensvoten, Partei- und Fraktionswechsel,
  Honeckers belegte Biografie sowie die Namensgeschichte von DEMOS. Rollenintervalle und
  Mehrheitsangaben nur aus datierten Primärakten oder klar gekennzeichneten historischen Quellen
  übernehmen.
- [ ] Die verbleibenden unbestimmten Personen, Gerichtsverfahren und nichtrechtlichen
  Realitätsereignisse aus `knowledge/conversation-candidates.json` einzeln prüfen. Bestätigte
  Befunde in Personenrollen, Timeline oder Proceedings überführen, Widerlegtes verwerfen und
  unprüfbares Gesprächswissen nicht in den Gegenwartsstand übernehmen.

### Dokumentation und laufende Qualität

- [ ] Nach jeder Erledigung eine vollständige Dokumentationsrunde über README, `CONTENT.md`,
  `CONTENT_GAPS.md`, `DESIGN.md`, `docs/` und `knowledge/` durchführen, erledigte Punkte entfernen
  und generierte Wissensdateien ausschließlich mit `npm run knowledge:build` aktualisieren.
- [ ] Beim Fortschreiben des redaktionellen Stichtags alle zeitabhängigen Oberflächen gemeinsam
  prüfen: aktuelle Termine und Stellen, Highlight-Zeiträume, Verfahren, Normfassungen,
  Regierungszuordnungen, Gebietsstände, Timeline und Suchindex. Ein technisches Builddatum darf
  dabei keinen fachlichen Aktualitätsstand ersetzen.
- [ ] Vor Produktionsfreigaben neben den automatisierten Prüfungen einen kurzen manuellen
  Tastatur- und Screenreader-Test sowie eine Sichtprüfung der festgelegten Mobil-, Tablet- und
  Desktopbreiten dokumentieren.
