# Dynamic Content Notes

## Ziel dieser Phase

Die Website bleibt insgesamt weitgehend statisch. Nur ausgewählte Bereiche werden jetzt gezielt on-demand über Cloudflare Workers mit D1 und R2 ergänzt:

- Pressemitteilungen
- Termine
- Karriere / Stellenangebote
- 15-Punkte-Dashboard / Projektstatus

Das Rechtsportal unter `/recht/` bleibt dateibasiert und weitgehend statisch.

## Bindings

### Produktion

- `DB`
  D1-Datenbank `freistaat-portal-prod`
- `MEDIA`
  R2-Bucket `freistaat-assets-prod`

### Staging

- `DB`
  D1-Datenbank `freistaat-portal-staging`
- `MEDIA`
  R2-Bucket `freistaat-assets-staging`

Die Bindings sind in [wrangler.jsonc](/Users/petzke/ostrecht-portal/wrangler.jsonc:1) hinterlegt.

## D1-Tabellen

### `press_releases`

Speichert Pressemitteilungen mit Slug, Datum, Ressort, Teaser, Bildreferenzen, Tags, Textabsätzen und Verknüpfungen zu Themen, Normen und weiteren Pressemitteilungen.

### `events`

Speichert öffentliche Termine mit Datum, Ort, Teaser und Fließtext. Bildfelder sind bereits vorbereitet, aber in der aktuellen Seed-Stufe noch leer.

### `jobs`

Speichert Stellenangebote mit Ressort, Standort, Arbeitsbereich, Veröffentlichungs- und Fristdaten, optionalen Kontaktdaten und vorbereiteten Medienfeldern.

### `project_status`

Speichert die Einträge des 15-Punkte-Dashboards mit Reihenfolge, Status, Ressort, Ziel-URL und optionalen Normreferenzen.

### `editor_entries`

Speichert Redaktionsentwürfe, Preview-Stände, veröffentlichte Inhalte und den optional aktiven `published_version_id` für Live-Overrides über alle Studio-Typen hinweg.

### `editor_versions`

Speichert einfache Versionsstände mit Änderungsvermerk, Aktion (`draft_save`, `publish`, `export`) und optionalem Publish-/Override-Payload.

### `media_assets`

Speichert Metadaten zu in R2 abgelegten Studio-Medien wie Key, Alt-Text, Titel, Dateiname und MIME-Typ.

### `publish_log`

Schreibt eine einfache Historie für direkte Veröffentlichungen, Live-Overrides und optionale JSON-Exporte.

## Migrationen

Die D1-Migrationen liegen unter:

```text
db/migrations/
```

Aktuell:

- `0001_dynamic_content.sql`
- `0002_editorial_studio.sql`
- `0003_editorial_live_overrides.sql`

## Seed- und Import-Workflow

Die Seed-Datei wird aus den bestehenden dateibasierten Quellen erzeugt:

- `content/presse/mitteilungen/*.json`
- `content/presse/termine/*.json`
- `content/service/stellen/*.json`
- ein kleines, im Seed-Skript gepflegtes Startset für `project_status`

Script:

```sh
npm run db:seed:build
```

Ergebnis:

```text
db/seeds/0001_seed.sql
```

Wichtig:

- Das Seed-Skript leert die vier dynamischen Tabellen und schreibt sie deterministisch neu.
- Es ist damit als pragmatischer Initial- und Sync-Import aus dem Repository gedacht, nicht als CMS.

## Lokale Entwicklung

1. Migrationen lokal anwenden:

```sh
npm run db:migrate:local
```

2. Seed lokal einspielen:

```sh
npm run db:seed:local
```

3. Entwicklungsserver starten:

```sh
npm run dev
```

Für lokale Preview:

```sh
npm run build
npm run preview
```

## Remote-Migrationen

### Staging

```sh
npm run db:migrate:staging
```

### Produktion

```sh
npm run db:migrate:prod
```

## Remote-Seed

### Staging

```sh
npm run db:seed:staging
```

### Produktion

```sh
npm run db:seed:prod
```

## R2-Nutzung

R2 wird in dieser Phase bewusst einfach vorbereitet:

- Datensätze können optional `media_key` speichern
- Worker liefern diese Objekte über `/media/[...key]` aus
- falls kein `media_key` gesetzt ist, können weiterhin bestehende statische Bildpfade oder externe URLs genutzt werden

Damit ist eine schrittweise Umstellung einzelner Bilder oder Downloads auf R2 möglich, ohne bestehende Inhalte sofort umzuziehen.

Zusätzlich nutzt das Redaktionsstudio R2 nun direkt für interne Uploads unter `/redaktion/medien/`. Die Uploads werden in D1 über `media_assets` referenziert und können anschließend über `mediaKey` in Studio-Formularen eingebunden werden.

## Jetzt dynamische Seiten

- `/presse/`
- `/presse/pressemitteilungen/`
- `/presse/pressemitteilungen/[slug]/`
- `/presse/termine/`
- `/presse/termine/[slug]/`
- `/service/karriere/`
- `/service/karriere/[slug]/`
- `/staatsregierung/15-punkte-plan/`
- `/media/[...key]`
- `/api/project-status.json`
- `/redaktion/`
- `/redaktion/inhalte/`
- `/redaktion/inhalte/[type]/`
- `/redaktion/inhalte/[type]/neu`
- `/redaktion/inhalte/[type]/[id]`
- `/redaktion/medien/`
- `/redaktion/entwuerfe/`

## Bewusst statisch bleibende Bereiche

- Startseite
- Staatsregierung außerhalb des 15-Punkte-Plans
- Themenseiten
- Reden
- Haushalt
- Freistaat
- Service-Grundseiten
- komplettes Rechtsportal unter `/recht/`
- Sitemap und `robots.txt`
