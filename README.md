# Staatsregierung des Ostdeutschen Freistaates

Website der fiktiven Staatsregierung des Ostdeutschen Freistaates mit Regierungsportal, Rechtsbereich, Presse, Haushalt und Service.

Die öffentliche Website soll sachlich, ruhig und behördennah wirken. Architektur- und Entwicklungsbegriffe gehören nicht in öffentliche Seitentexte; operative Hinweise bleiben in Code, README, AGENTS oder `CONTENT.md`.

Die zentrale Anleitung zur Pflege der Website-Inhalte steht in `CONTENT.md`.

## Projektkern

- Astro und TypeScript
- Cloudflare Workers als Zielplattform
- dateibasierte Inhalte unter `content/`
- Rechtsportal unter `/recht/` mit Normen, Fassungen, Historien, Sachgebieten und Rechtssuche

Das Projekt ist eine politische Simulation. Es stellt keine echte amtliche Veröffentlichung dar.

## Entwicklung

```sh
npm install
npm run dev
npm run content:check
npm run check
npm run build
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
- Service-Grundseiten liegen unter `content/service/seiten/`.
- Normen liegen unter `content/normen/[slug]/` mit `meta.json`, `history.json` und `versions/[versionId].json`.

Historische Normfassungen werden nicht automatisch konsolidiert. Sie werden als eigene Fassungen gespeichert.

## Zentrale Konfiguration

- `src/config/site.ts`: Portaltexte, Pfade, Navigation, Kontakt, Regierungsstammdaten
- `src/config/features.ts`: Feature-Flags für Header und Analytics
- `src/config/analytics.ts`: Consent und Webanalyse-Konfiguration
- `src/lib/portal/routes.ts`: zentrale Portalpfade
- `src/lib/norms/routes.ts`: zentrale Rechtspfadlogik

## Laufzeit und Cloudflare

Das Portal wird weiterhin für Cloudflare Workers gebaut, nutzt aktuell aber keine D1- oder R2-Bindings. Pressemitteilungen, Termine, Stellenangebote, Projektstatus und Medien werden dateibasiert aus `content/`, `src/data/dashboard/` und `public/images/` erzeugt.

Das Rechtsportal darf funktional nicht leichtfertig umgebaut werden.

## Qualitätssicherung

Vor relevanten Änderungen:

```sh
npm run content:check
npm run check
npm run build
```

Nach öffentlichen Textänderungen zusätzlich gezielt nach Entwicklerbegriffen suchen und sicherstellen, dass sie nicht in Bürgerseiten erscheinen.
