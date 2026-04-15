# SEO-Hinweise

## Was im Projekt jetzt vorhanden ist

- zentrale SEO-Basis in `src/config/site.ts`
  - `siteConfig.seo.siteName`
  - `siteConfig.seo.siteUrl`
  - `siteConfig.seo.defaultDescription`
  - `siteConfig.seo.locale`
- zentrales Head-Rendering in `src/layouts/BaseLayout.astro`
  - Title-Template
  - Meta Description
  - Canonical-URL
  - Robots-Meta
  - Open-Graph-Metadaten
  - Twitter/X-Basismeta
  - JSON-LD-Ausgabe
- SEO-Utilities in `src/lib/seo/index.ts`
  - Canonical-Helfer
  - Title-Helfer
  - `WebSite`
  - `Organization`
  - `BreadcrumbList`
  - `Article`
  - `Event`
- technische SEO-Dateien
  - `src/pages/robots.txt.ts`
  - `src/pages/sitemap.xml.ts`

## Wo was gepflegt wird

### Site-Name und Grundbeschreibung

Pflege zentral in:

```text
src/config/site.ts
```

Wichtige Felder:

- `siteConfig.authorityName`
- `siteConfig.portalTitle`
- `siteConfig.portalSubtitle`
- `siteConfig.seo.*`

### Canonical-Basis und GitHub-Pages-Pfade

Pflege in:

```text
astro.config.mjs
```

Relevante Umgebungsvariablen:

- `SITE_URL`
- `BASE_PATH`

Beispiel:

```sh
SITE_URL=https://username.github.io BASE_PATH=/repo-name/ npm run build
```

### Strukturierte Daten

Werden erzeugt in:

```text
src/lib/seo/index.ts
```

Aktuell genutzt für:

- Startseite: `WebSite`, `Organization`
- Brotkrumen: `BreadcrumbList`
- Pressemitteilungen und Reden: `Article`
- Termine: `Event`

### Seitenspezifische SEO

Die wichtigsten Seitentypen übergeben ihre SEO-Daten direkt an:

```text
src/layouts/BaseLayout.astro
```

Relevante Props:

- `title`
- `description`
- `breadcrumbs`
- `structuredData`
- `ogType`
- `ogImage`
- `noindex`

## Externe Schritte

Diese Schritte passieren nicht im Repository und müssen separat erledigt werden:

1. Domain oder GitHub-Pages-URL in der Google Search Console anlegen.
2. `https://.../sitemap.xml` in der Search Console einreichen.
3. Indexierung der wichtigsten Seiten prüfen:
   - Startseite
   - Staatsregierung
   - Themenübersicht
   - Rechtsbereich
   - Pressebereich
4. Falls eine eigene Domain genutzt wird:
   - Weiterleitungen konsistent halten
   - bevorzugte Domain festlegen
   - Search-Console-Eigenschaft für die endgültige Domain verwenden
5. Nach größeren Inhaltsupdates erneut Sitemap und Indexierungsstatus prüfen.
