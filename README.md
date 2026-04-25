# Staatsregierung des Ostdeutschen Freistaates

Website der fiktiven Staatsregierung des Ostdeutschen Freistaates mit Regierungsportal, Rechtsbereich, Presse, Haushalt, Service und internem Redaktionsstudio.

Die öffentliche Website soll sachlich, ruhig und behördennah wirken. Architektur- und Entwicklungsbegriffe gehören nicht in öffentliche Seitentexte; operative Hinweise bleiben in Code, README, AGENTS oder im geschützten Redaktionsstudio.

Die zentrale Anleitung zur Pflege der Website-Inhalte steht in `CONTENT.md`.

## Projektkern

- Astro und TypeScript
- Cloudflare Workers als Zielplattform
- dateibasierte Inhalte unter `content/`
- gezielte Laufzeitbereiche für Presse, Termine, Stellenangebote, Medien und Projektstatus
- Rechtsportal unter `/recht/` mit Normen, Fassungen, Historien, Sachgebieten und Rechtssuche
- Redaktionsstudio unter `/redaktion/`, das in Staging und Produktion hinter Cloudflare Access liegen soll

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
npm run db:seed:build
npm run db:migrate:local
npm run db:seed:local
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

db/
  migrations/
  seeds/

context/
  externe Ausgangstexte und Simulationsmaterial
```

`context/` bleibt bewusst erhalten. Alte Planungs- und Zwischendokumente im Repository-Root wurden in diese README und `AGENTS.md` verdichtet.

## Content-Regeln

- Die vollständige Pflegeanleitung für Inhaltsformate, JSON-Felder, Normfassungen, Dashboarddaten und Redaktionsstudio-Bezüge steht in `CONTENT.md`.
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
- `src/config/features.ts`: Feature-Flags für Header, Redaktionszugänge und Analytics
- `src/config/analytics.ts`: Consent und Webanalyse-Konfiguration
- `src/lib/portal/routes.ts`: zentrale Portalpfade
- `src/lib/norms/routes.ts`: zentrale Rechtspfadlogik

## Laufzeitbereiche

Diese Bereiche können aus Cloudflare D1/R2 gespeist werden:

- Pressemitteilungen
- Termine
- Stellenangebote
- Projektstatus / 15-Punkte-Dashboard
- Medien
- ausgewählte Live-Overrides für redaktionelle Inhalte

Dateibasierte Inhalte bleiben die robuste Grundquelle. Das Rechtsportal darf funktional nicht leichtfertig umgebaut werden.

## Redaktionsstudio

`/redaktion/` ist ein interner Arbeitsbereich für:

- Inhalte bearbeiten und veröffentlichen
- Entwürfe
- Medien
- ausgewählte Inline-Bearbeitung
- Rechtswerkzeug für Normdateien

Für produktionsnahe Umgebungen:

```sh
wrangler secret put EDITORIAL_SESSION_SECRET
wrangler secret put EDITORIAL_SESSION_SECRET --env staging
```

## Qualitätssicherung

Vor relevanten Änderungen:

```sh
npm run content:check
npm run check
npm run build
```

Nach öffentlichen Textänderungen zusätzlich gezielt nach Entwicklerbegriffen suchen und sicherstellen, dass sie nicht in Bürgerseiten erscheinen.
