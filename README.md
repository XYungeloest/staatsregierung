# Staatsrat des Ostdeutschen Freistaates

Website des fiktiven Staatsrates des Ostdeutschen Freistaates mit Staatsportal, Rechtsbereich, Presse, Haushalt und Service.

Die öffentliche Website soll sachlich, ruhig und behördennah wirken. Architektur- und Entwicklungsbegriffe gehören nicht in öffentliche Seitentexte; operative Hinweise bleiben in Code, README, AGENTS oder `CONTENT.md`.

Die zentrale Anleitung zur Pflege der Website-Inhalte steht in `CONTENT.md`.
Der aktuelle redaktionelle Stand ist der 9. August 2026. Der frühere Stichtagsimport vom
19. Juli 2026 bleibt in `CONTENT_UPDATE_2026-07-19.md` historisch dokumentiert; aktuelle offene
Quellenfragen stehen in `CONTENT_GAPS.md`.

## Projektkern

- Astro und TypeScript
- Cloudflare Workers als Zielplattform
- dateibasierte Inhalte unter `content/`
- normalisierte Regierungsorganisation unter `content/organisation/`
- getrenntes, Access-geschütztes Git-Redaktionsstudio unter `/redaktion/`
- interner Wissenshub unter `knowledge/`
- Rechtsportal unter `/recht/` mit Normen, Fassungen, Historien, Sachgebieten, Fundstellen,
  Verkündungen und Rechtssuche

Das Projekt ist eine politische Simulation. Es stellt keine echte amtliche Veröffentlichung dar.
Der dafür notwendige Hinweis erscheint sichtbar in der oberen Hinweisleiste und im Footer. Das
Impressum enthält zusätzlich die rechtlich erforderliche ausführliche Einordnung; weitere
öffentliche Texte sollen die Simulation nicht wiederholen.

## Entwicklung

```sh
npm install
npm run dev
npm run content:check
npm run knowledge:check
npm run knowledge:build
npm run check
npm run test:unit
npm run build
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
npm run deploy:staging
npm run deploy
npm run editorial:dev
```

`SITE_URL` und `BASE_PATH` steuern Canonicals, Sitemap, Robots und Pfadauflösung:

```sh
SITE_URL=https://freistaat-ostdeutschland.de BASE_PATH=/ npm run build
```

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
- Themenseiten verweisen über `federfuehrendesRessort` und `rechtsgrundlagen[].normSlug` auf Ressorts und Normen.
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

Die Rechtssuche wird buildzeitbasiert aus den gespeicherten Fassungen erzeugt. Der allgemeine
Normlink ist dynamisch und führt zur am redaktionellen Stichtag geltenden Fassung. Gibt es noch
keine geltende Fassung, zeigt er die nächste belegte zukünftige beziehungsweise die veröffentlichte
Fassung mit ungeklärtem Inkrafttreten. Versionsspezifische Links bleiben unveränderlich. Die Suche
verwendet standardmäßig geltende Fassungen; Fassungsart, Mehrfachfacetten, strukturierte
Fundstellen und Präfix-Platzhalter mit `*` sind explizite Filter. Änderungsvorschriften werden
über den Normtyp, belegte Einführungsbeziehungen oder eine eindeutige Änderungsbezeichnung im
amtlichen Titel erkannt und standardmäßig getrennt angeboten.

Öffentliche Vollzitate werden fassungsspezifisch aus dem vollständigen Normtitel, der gespeicherten
Stammfundstelle und dem letzten Historieneintrag mit zugeordneter Änderungsvorschrift gebildet.
`initialCitation`, die Zitierangaben der Fassungen und die Fundstellen in den Verkündungsdatensätzen
bleiben dabei unveränderte Quellen- und Provenienzfelder. Fehlt wegen eines dokumentierten
Quellenkonflikts ein Normdatum, ergänzt die Zitierlogik kein vermeintlich eindeutiges Datum.

## Zentrale Konfiguration

- `src/config/site.ts`: Portalname, Pfade, Navigation und Kontakt
- `src/config/editorial.json`: zentraler redaktioneller Stichtag
- `src/config/features.ts`: Feature-Flag für die optionale Webanalyse
- `src/config/analytics.ts`: Consent und Webanalyse-Konfiguration
- `src/lib/portal/routes.ts`: zentrale Portalpfade
- `src/lib/norms/routes.ts`: zentrale Rechtspfadlogik
- `src/config/law-subjects.ts`: redaktionelle Gruppierung der belegten Sachgebiete ohne erfundene Systemnummern
- Der Rechtsbereich hat statische Einstiege für Suche, alphabetischen Index, Sachgebiete,
  Fundstellennachweise, Verkündungen, Förderrichtlinien und Hilfe. Neue Rechtspfade werden
  zentral über die Route-Helper gepflegt.

Normseiten bieten eine gemeinsame Fassungsnavigation, einen strukturellen Vergleich gespeicherter
Fassungen, semantische Sprungmarken mit kompatiblen Altankern sowie Gesamt- und Einzeldruck.
PDF-Links werden nur ausgegeben, wenn eine entsprechende Datei oder externe Quelle im
Verkündungsdatensatz belegt ist. Eine HTML-Druckansicht wird nicht als amtliche Verkündung
bezeichnet.

Für öffentliche Übersichten werden Termine und Stellenangebote über
`src/lib/portal/dates.ts` gegen den redaktionellen Stichtag gefiltert. Vergangene Termine und
abgelaufene Fristen bleiben im Archiv erreichbar, werden aber nicht als aktuell ausgegeben.
Der derzeitige Stichtag ist der 9. August 2026.

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
Der bekannte öffentlich ausgelieferte Produktionsstand ist am 22. Juli 2026 weiterhin
`59adee4659992b96d55812fbf4e3612a3541e126`; Abweichungen zum aktuellen Repository sind deshalb
kein Cachehinweis. Vor einem späteren Deployment müssen `/`, `/recht/`, `/recht/verfassung/`, die
Normseiten des Ersten Staatsreformgesetzes und der SERO-Verordnung, die Verkündungsseiten Nr. 53
und 58 sowie `/sitemap.xml` und `/search-index.json` dieselbe neue vollständige Kennung ausgeben.

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

Die allgemeine Suche unter `/suche/` unterscheidet einen leeren Ausgangszustand, Laden, Treffer,
keine Treffer und Fehler. Die Suche und ihre Filter bleiben per Tastatur bedienbar; Status und
Trefferzahl werden zugänglich ausgegeben. Im Rechtsbereich sind Suche, Index, Sachgebiete,
Verkündungen, Fundstellen, Verfassung, Förderrichtlinien und Hilfe eigenständige Einstiege.

Jede Seite verwendet das gemeinsame Layout mit Skip-Link, sichtbaren Fokuszuständen,
Breadcrumbs und individuellen Metadaten. Für Pressemitteilungen werden passende Artikel- und
Breadcrumb-Strukturdaten erzeugt; die Organisationsdaten kennzeichnen das Portal ausdrücklich als
fiktive Politiksimulation. Das gemeinsame Social-Media-Bild liegt unter
`public/images/social/portal-preview.png`.

`BaseLayout.astro` stellt mit `mainWidth="contained"` den begrenzten Hauptcontainer für Fachseiten
und mit `mainWidth="full"` vollbreite Inhaltsbänder mit inneren Containern bereit. Die Startseite
verwendet die volle Variante und setzt ihre wiederverwendbaren Zugangskarten, Informationslisten,
Icons und das Serviceband aus `src/components/portal/` zusammen. Die dauerhaft gültigen
gestalterischen Regeln stehen in `DESIGN.md`.

## Laufzeit und Cloudflare

Das Portal wird weiterhin für Cloudflare Workers gebaut, nutzt aktuell aber keine D1- oder R2-Bindings. Pressemitteilungen, Termine, Stellenangebote, Projektstatus und Medien werden dateibasiert aus `content/`, `src/data/dashboard/` und `public/images/` erzeugt.

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

`npm run links:check` prüft nach dem Build alle statisch ausgegebenen internen Verweise.
`npm run test:visual` erzeugt und vergleicht Chromium-Screenshots dieser Ansichten. Die externen
Basiskacheln der Kreisreform werden dabei unterdrückt, damit die Baselines reproduzierbar bleiben.
`npm run test:a11y` führt zusätzlich einen automatisierten Accessibility-Smoke-Test aus. Beide
Checks ergänzen, ersetzen aber nicht den manuellen Tastatur- und Screenreader-Kurztest.
`npm run test:quality` prüft unter anderem die acht Abnahme-Viewports auf Dokumentüberlauf sowie
Karten- und Statistikfreigaben, Zoom und reduzierte Bewegung. `npm run test:browsers` führt die
zentralen Interaktionen zusätzlich in Chromium, Firefox und WebKit aus; `npm run seo:check` prüft
Metadaten, Canonicals, H1, JSON-LD, Social Cards, Suchseiten und Sitemap.
