# Staatsregierung des Ostdeutschen Freistaates

Statische Website der Staatsregierung des Ostdeutschen Freistaates mit integriertem Rechtsbereich unter `/recht/`.

Das Projekt verbindet drei Bereiche in einer gemeinsamen Astro-Architektur:

- Regierungsportal mit Staatsregierung, Themen, Presse, Haushalt und Freistaat-Seiten
- integriertes Rechtsportal mit aktuellen Fassungen, Historien, Suchindex, Archiv und Sachgebieten
- Servicebereich mit Übersicht, Karriere, Kontakt, FAQ, Datenschutz, Impressum und Barrierefreiheit

Die Website ist ausdrücklich Teil einer fiktiven Politiksimulation. Sie bleibt vollständig dateibasiert und wird in der ersten Cloudflare-Migrationsphase weiterhin weitgehend statisch erzeugt.

## Kanonische Dokumentation

Die aktuellen Leitdokumente im Repository sind:

- [SPEC_PORTAL_MASTER.md](./SPEC_PORTAL_MASTER.md)
- [IA_AND_ROUTES.md](./IA_AND_ROUTES.md)
- [CONTENT_MODEL_MASTER.md](./CONTENT_MODEL_MASTER.md)
- [CONTENT_GUIDE_SIM.md](./CONTENT_GUIDE_SIM.md)
- [TASKLIST_PORTAL_MASTER.md](./TASKLIST_PORTAL_MASTER.md)
- [INTERACTIVE_MODULES.md](./INTERACTIVE_MODULES.md)
- [AGENTS.md](./AGENTS.md)
- [CONTENT_EDITOR_GUIDE.md](./CONTENT_EDITOR_GUIDE.md)
- [SEO_NOTES.md](./SEO_NOTES.md)
- [CLOUDFLARE_MIGRATION.md](./CLOUDFLARE_MIGRATION.md)
- [DYNAMIC_CONTENT_NOTES.md](./DYNAMIC_CONTENT_NOTES.md)

Ältere Vorstufen der Spezifikation liegen nur noch als Archiv unter [docs/legacy/](./docs/legacy/).

## Technischer Rahmen

- Astro
- TypeScript
- Cloudflare Workers als Zielplattform
- in Phase 1 weiterhin weitgehend statische Ausgabe
- gezielte D1-/R2-Nutzung für ausgewählte dynamische Bereiche
- kein klassisches Backend und keine Voll-SSR
- keine Container
- keine Adminoberfläche

## Voraussetzungen

- Node.js ab `22.12.0`
- `npm`

## Lokale Entwicklung

Abhängigkeiten installieren:

```sh
npm install
```

Entwicklungsserver starten:

```sh
npm run dev
```

Type-Check ausführen:

```sh
npm run check
```

Produktionsbuild erzeugen:

```sh
npm run build
```

Wenn die Telemetry in der Umgebung deaktiviert werden soll:

```sh
ASTRO_TELEMETRY_DISABLED=1 npm run build
```

Lokale Vorschau im Cloudflare-kompatiblen Preview-Runtime:

```sh
npm run preview
```

## Build-Parameter, Canonicals und Cloudflare

`astro.config.mjs` liest die Site- und Basis-URL über Umgebungsvariablen ein. Diese Werte steuern insbesondere Canonical-URLs, Sitemap und `robots.txt`.

- `SITE_URL`
  Vollständige Site-URL, zum Beispiel `https://freistaat-ostdeutschland.de`
- `BASE_PATH`
  Optionaler Unterpfad, zum Beispiel `/verwaltung/`

Beispiele:

```sh
SITE_URL=https://ostrecht-portal-staging.<subdomain>.workers.dev npm run build
```

```sh
SITE_URL=https://osten.de BASE_PATH=/ npm run build
```

Ohne Variablen baut das Projekt standardmäßig mit:

- `site = https://freistaat-ostdeutschland.de`
- `base = /`

Das eigentliche Cloudflare-Deployment erfolgt anschließend mit Wrangler:

```sh
npm run deploy
```

Für ein erstes Staging ist eine separate Worker-Umgebung vorbereitet:

```sh
SITE_URL=https://ostrecht-portal-staging.<subdomain>.workers.dev npm run build
npm run deploy:staging
```

Die nötigen Schritte und offenen externen Cloudflare-Einstellungen stehen in [CLOUDFLARE_MIGRATION.md](./CLOUDFLARE_MIGRATION.md).

## Wichtige Verzeichnisse

### Content

```text
content/
  freistaat/
  haushalt/
  normen/
  presse/
    mitteilungen/
    reden/
    termine/
  regierung/
    mitglieder/
  ressorts/
  service/
    seiten/
    stellen/
  themen/
```

### Seiten und Logik

```text
src/
  components/
  config/
  data/
    dashboard/
  layouts/
  lib/
    norms/
    portal/
  pages/
  scripts/
  styles/
```

### Assets

```text
public/images/
  jobs/
  ministerien/
  presse/
  regierung/
  ui/
```

## Zentrale Konfiguration

- `src/config/site.ts`
  Globale Portaltexte, Navigation, Pfade, Kontaktangaben und Regierungsstammdaten
- `src/config/features.ts`
  Schmale Feature-Flags, vor allem für Kennzeichnungsleiste, Sticky Header, Analytics und Redaktionswerkzeug
- `src/config/analytics.ts`
  Zentrale Konfiguration für Google Analytics 4, Standard-Consent und die clientseitige Consent-Speicherung

`siteConfig` enthält bewusst nur globale Portal-Konfiguration. Inhaltliche Listen wie Ressorts oder Regierungsmitglieder werden über die Content-Dateien gepflegt, nicht parallel in der Konfiguration.

Google Analytics 4 wird global im `BaseLayout` eingebunden. Der Standardzustand der Einwilligung wird zentral über `src/config/analytics.ts` gesteuert; eine abweichende Entscheidung wird ohne Backend lokal im Browser gespeichert.

## Dynamische Bereiche

In der zweiten Cloudflare-Migrationsphase werden ausgewählte Bereiche gezielt on-demand aus Cloudflare D1 geladen:

- Pressemitteilungen
- Termine
- Karriere / Stellenangebote
- 15-Punkte-Dashboard / Projektstatus

Für Bilder, Downloads und größere Medien steht zusätzlich eine einfache R2-Integration bereit. Das Rechtsportal unter `/recht/` bleibt weiterhin dateibasiert und weitgehend statisch.

Details zu Tabellen, Migrationen, Seed-Workflow und lokalen Schritten stehen in [DYNAMIC_CONTENT_NOTES.md](./DYNAMIC_CONTENT_NOTES.md).

## Rechtsbereich

Der Rechtsbereich bleibt funktional erhalten und liegt vollständig unter `/recht/`.

Normen liegen kanonisch unter:

```text
content/normen/[slug]/
  meta.json
  history.json
  versions/
    [versionId].json
```

Historische Fassungen werden nicht berechnet, sondern als eigene Fassungen gespeichert.

Die Suche arbeitet mit einem beim Build erzeugten Index unter:

```text
src/pages/recht/search-index.json.ts
```

## Weitere dateibasierte Bereiche

Zusätzlich zum Rechtsportal werden diese Bereiche direkt aus JSON-Dateien geladen und validiert:

- Regierungsmitglieder
- Ressorts
- Themenseiten
- Pressemitteilungen
- Reden
- Termine
- Haushaltsseiten
- Stellenangebote
- Service-Seiten

Die Schemata und Parser dafür liegen in:

```text
src/lib/portal/schema.ts
```

## Dashboard- und Interaktionsmodule

Interaktive, aber rein statische Module liegen als kleine Client-Module vor, unter anderem für:

- 15-Punkte-Plan
- Projekt-Timeline
- Gesetzgebungs-Tracker
- Haushalt-Explorer
- FAQ-Akkordeons
- Karriere-Filter
- Kontakt-Wegweiser

Die kuratierten Datensätze für Dashboard-Module liegen in:

```text
src/data/dashboard/
```

Diese Daten sind bewusst Sekundärquellen für Visualisierung und Einstiegsmodule, nicht die primäre inhaltliche Wahrheit. Inhaltliche Stammdaten bleiben in den Collections unter `content/`.

## Typografie und Assets

- Die UI verwendet die Schriftart Jost als lokal gehostete Variable Font unter `src/assets/fonts/`.
- Regierungs-, Ressort-, Presse- und Jobbilder werden über benannte PNG-Dateien unter `public/images/` referenziert.
- Die Flagge des Freistaates liegt unter `public/images/ui/ost-flagge.png`.

## Redaktionelles Werkzeug

Unter `/redaktion/` gibt es ein optionales, rein clientseitiges Hilfswerkzeug für Normdateien.

Wichtig:

- es ist standardmäßig nicht in der Navigation verlinkt
- es speichert nichts serverseitig
- es bleibt vollständig statisch
- es kann über `src/config/features.ts` ein- oder ausgeblendet werden

## Legacy-Dokumente

Die früheren Portal- und Redesign-Spezifikationen bleiben nur als Referenz erhalten:

- `SPEC.md`
- `SPEC_REDESIGN.md`
- `TASKLIST.md`
- `TASKLIST_REDESIGN.md`
- `IA_PORTAL.md`
- `CONTENT_MODEL_PORTAL.md`

Die inhaltlichen Altstände liegen unter `docs/legacy/`; die Dateien im Projektwurzel verweisen nur noch auf die Master-Dokumentation.
