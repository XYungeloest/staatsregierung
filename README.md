# Staatsregierung des Ostdeutschen Freistaates

Website der fiktiven Staatsregierung des Ostdeutschen Freistaates mit Regierungsportal, Rechtsbereich, Presse, Haushalt und Service.

Die öffentliche Website soll sachlich, ruhig und behördennah wirken. Architektur- und Entwicklungsbegriffe gehören nicht in öffentliche Seitentexte; operative Hinweise bleiben in Code, README, AGENTS oder `CONTENT.md`.

Die zentrale Anleitung zur Pflege der Website-Inhalte steht in `CONTENT.md`.

## Projektkern

- Astro und TypeScript
- Cloudflare Workers als Zielplattform
- dateibasierte Inhalte unter `content/`
- Rechtsportal unter `/recht/` mit Normen, Fassungen, Historien, Sachgebieten, Fundstellen,
  Verkündungen und Rechtssuche

Das Projekt ist eine politische Simulation. Es stellt keine echte amtliche Veröffentlichung dar.
Der dafür notwendige Hinweis erscheint sichtbar in der oberen Hinweisleiste und im Footer; weitere
öffentliche Texte sollen die Simulation nicht wiederholen.

## Entwicklung

```sh
npm install
npm run dev
npm run content:check
npm run check
npm run build
npm run links:check
npm run test:visual
npm run test:a11y
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

Historische Normfassungen werden nicht automatisch konsolidiert. Sie werden als eigene Fassungen gespeichert.

Die Rechtssuche wird buildzeitbasiert aus den gespeicherten Fassungen erzeugt. Der allgemeine
Normlink führt zur aktuellen Fassung, historische Fassungen behalten eigene statische URLs.

## Zentrale Konfiguration

- `src/config/site.ts`: Portaltexte, Pfade, Navigation, Kontakt, Regierungsstammdaten
- `src/config/features.ts`: Feature-Flags für Header und Analytics
- `src/config/analytics.ts`: Consent und Webanalyse-Konfiguration
- `src/lib/portal/routes.ts`: zentrale Portalpfade
- `src/lib/norms/routes.ts`: zentrale Rechtspfadlogik
- Der Rechtsbereich hat statische Einstiege für Suche, alphabetischen Index, Sachgebiete,
  Fundstellennachweise, Verkündungen, Förderrichtlinien und Hilfe. Neue Rechtspfade werden
  zentral über die Route-Helper gepflegt.

Für öffentliche Übersichten werden Termine und Stellenangebote über
`src/lib/portal/dates.ts` gegen den redaktionellen Stichtag gefiltert. Vergangene Termine und
abgelaufene Fristen bleiben im Archiv erreichbar, werden aber nicht als aktuell ausgegeben.
Der derzeitige Stichtag ist der 22. Juni 2026.

Die Kreis- und Bezirksreform ist unter `/kreisreform/` erreichbar und zusätzlich in Hauptnavigation,
Startseite und Themen-Einstiegen verlinkt. Die Kartendaten liegen unter
`public/data/kreisreform/`. Auf großen Bildschirmen startet die Karte in einer engen Übersicht der
Reformregion; auf kleinen Bildschirmen steht die Gebietssuche mit Textdetail vor der optionalen
Karte. Bezirkskarten und Tabellen bleiben ohne Kartenstart nutzbar.

Webanalyse ist optional. Der Ausgangszustand nutzt nur notwendige Funktionen; eine Zustimmung wird
lokal gespeichert und kann über die Datenschutzeinstellungen zurückgesetzt werden.

Die allgemeine Suche unter `/suche/` unterscheidet einen leeren Ausgangszustand, Laden, Treffer,
keine Treffer und Fehler. Die Suche und ihre Filter bleiben per Tastatur bedienbar; Status und
Trefferzahl werden zugänglich ausgegeben. Im Rechtsbereich sind Suche, Index, Sachgebiete,
Verkündungen, Fundstellen, Verfassung, Förderrichtlinien und Hilfe eigenständige Einstiege.

Jede Seite verwendet das gemeinsame Layout mit Skip-Link, sichtbaren Fokuszuständen,
Breadcrumbs und individuellen Metadaten. Für Pressemitteilungen werden passende Artikel- und
Breadcrumb-Strukturdaten erzeugt; für das Portal stehen Website- und Organisationsdaten bereit.

## Laufzeit und Cloudflare

Das Portal wird weiterhin für Cloudflare Workers gebaut, nutzt aktuell aber keine D1- oder R2-Bindings. Pressemitteilungen, Termine, Stellenangebote, Projektstatus und Medien werden dateibasiert aus `content/`, `src/data/dashboard/` und `public/images/` erzeugt.

Das Rechtsportal darf funktional nicht leichtfertig umgebaut werden.

## Qualitätssicherung

Vor relevanten Änderungen:

```sh
npm run content:check
npm run check
npm run build
npm run links:check
```

Nach öffentlichen Textänderungen zusätzlich gezielt nach Entwicklerbegriffen suchen und sicherstellen, dass sie nicht in Bürgerseiten erscheinen.
Bei Layout-, Karten- oder Header-Änderungen die Startseite und `/kreisreform/` zusätzlich manuell
bei 360, 390, 768, 1024 und 1440 Pixel Breite prüfen.

`npm run links:check` prüft nach dem Build alle statisch ausgegebenen internen Verweise.
`npm run test:visual` erzeugt und vergleicht Chromium-Screenshots dieser Ansichten. Die externen
Basiskacheln der Kreisreform werden dabei unterdrückt, damit die Baselines reproduzierbar bleiben.
`npm run test:a11y` führt zusätzlich einen automatisierten Accessibility-Smoke-Test aus. Beide
Checks ergänzen, ersetzen aber nicht den manuellen Tastatur- und Screenreader-Kurztest.
