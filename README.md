# Staatsrat des Ostdeutschen Freistaates

Website des fiktiven Staatsrates des Ostdeutschen Freistaates mit Staatsportal, Rechtsbereich, Presse, Haushalt und Service.

Die öffentliche Website soll sachlich, ruhig und behördennah wirken. Architektur- und Entwicklungsbegriffe gehören nicht in öffentliche Seitentexte; operative Hinweise bleiben in Code, README, AGENTS oder `CONTENT.md`.

Die zentrale Anleitung zur Pflege der Website-Inhalte steht in `CONTENT.md`.
Der aktuelle redaktionelle Stand ist der 21. Juli 2026. Der frühere Stichtagsimport vom
19. Juli 2026 bleibt in `CONTENT_UPDATE_2026-07-19.md` historisch dokumentiert; aktuelle offene
Quellenfragen stehen in `CONTENT_GAPS.md`.

## Projektkern

- Astro und TypeScript
- Cloudflare Workers als Zielplattform
- dateibasierte Inhalte unter `content/`
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
npm run check
npm run test:unit
npm run build
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
npm run deploy:staging
npm run deploy
```

`SITE_URL` und `BASE_PATH` steuern Canonicals, Sitemap, Robots und Pfadauflösung:

```sh
SITE_URL=https://freistaat-ostdeutschland.de BASE_PATH=/ npm run build
```

## Wichtige Verzeichnisse

```text
content/
  gesetzgebung/
  freistaat/
  haushalt/
  normen/
  presse/
  regierung/
  ressorts/
  service/
  themen/
  verkuendungen/

public/
  data/kreisreform/
  images/

src/
  components/
  config/
  data/
  layouts/
  lib/
  pages/
  scripts/
  styles/

context/
  externe Ausgangstexte und Simulationsmaterial
```

`context/` bleibt bewusst erhalten. Alte Planungs- und Zwischendokumente im Repository-Root wurden in diese README und `AGENTS.md` verdichtet.

## Content-Regeln

- Die vollständige Pflegeanleitung für Inhaltsformate, JSON-Felder, Normfassungen und Dashboarddaten steht in `CONTENT.md`.
- Öffentliche Inhalte werden deutschsprachig mit echten Umlauten gepflegt.
- Datumsdarstellung auf Seiten bevorzugt `TT. Monat JJJJ`.
- Regierungsmitglieder liegen unter `content/regierung/mitglieder/`.
- Ressorts liegen unter `content/ressorts/`.
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
  Quell-HTML direkt. Gleichnamige Markdown-Dateien sind nur noch gekennzeichneter Altbestand und
  werden vom Importer nicht geöffnet. PDF-Dateien werden nicht ersatzweise automatisch als
  scheinbar verlässlicher Volltext ausgewertet.

Historische Normfassungen werden nicht automatisch konsolidiert. Sie werden als eigene Fassungen gespeichert.

Die Rechtssuche wird buildzeitbasiert aus den gespeicherten Fassungen erzeugt. Der allgemeine
Normlink führt zur aktuellen Fassung, historische Fassungen behalten eigene statische URLs.

## Zentrale Konfiguration

- `src/config/site.ts`: Portaltexte, Pfade, Navigation, Kontakt, Regierungsstammdaten
- `src/config/editorial.json`: zentraler redaktioneller Stichtag
- `src/config/features.ts`: Feature-Flag für die optionale Webanalyse
- `src/config/analytics.ts`: Consent und Webanalyse-Konfiguration
- `src/lib/portal/routes.ts`: zentrale Portalpfade
- `src/lib/norms/routes.ts`: zentrale Rechtspfadlogik
- Der Rechtsbereich hat statische Einstiege für Suche, alphabetischen Index, Sachgebiete,
  Fundstellennachweise, Verkündungen, Förderrichtlinien und Hilfe. Neue Rechtspfade werden
  zentral über die Route-Helper gepflegt.

Für öffentliche Übersichten werden Termine und Stellenangebote über
`src/lib/portal/dates.ts` gegen den redaktionellen Stichtag gefiltert. Vergangene Termine und
abgelaufene Fristen bleiben im Archiv erreichbar, werden aber nicht als aktuell ausgegeben.
Der derzeitige Stichtag ist der 21. Juli 2026.

Der Normimport ist standardmäßig ein schreibfreier Audit. `npm run norms:audit` klassifiziert die
Quellen und zeigt erkannte Normen und geplante Änderungen. Schreiben ist nur gezielt mit
`npm run norms:import -- --write --file "Gesetze/…html"` möglich; vorhandene Datensätze werden nur
mit dem zusätzlichen Flag `--update-existing` verändert. Der Import löscht den Normbestand nicht.
`npm run norms:audit -- --strict` vergleicht die konfigurierten Primärquellen mit den gespeicherten
Norm- und Verkündungsdaten und beendet den Prozess bei Abweichungen mit einem Fehlercode.
`npm run content:check` führt diesen strikten Abgleich vor den übrigen Inhaltsprüfungen automatisch
aus.

Jeder Produktionsbuild trägt den vollständigen Git-Commit als `meta[name="build-commit"]` in
HTML-Seiten und als Antwortheader `X-Portal-Commit` auf allen Routen. In CI wird die Kennung aus
`GITHUB_SHA` übernommen; lokale Builds verwenden den aktuellen `HEAD`.

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
