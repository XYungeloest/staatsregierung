# Cloudflare-Migration Phase 1

## Ziel dieser Phase

Das Portal wird von der bisherigen GitHub-Pages-Zielarchitektur auf Cloudflare Workers umgestellt, ohne die bestehende Seitenstruktur oder das Rechtsportal unter `/recht/` funktional zu verändern.

Phase 1 bleibt bewusst konservativ:

- Astro bleibt das Build-System
- Inhalte bleiben dateibasiert
- das Regierungsportal und das Rechtsportal bleiben weitgehend statisch prerendered
- Cloudflare Workers wird neue Deploy-Zielplattform
- D1 und R2 werden nur vorbereitet, nicht eingeführt

## Neue und geänderte Dateien

- `astro.config.mjs`
  Astro nutzt jetzt den Cloudflare-Adapter und baut weiter statisch mit `output: 'static'`.
- `wrangler.jsonc`
  Basis-Konfiguration für Cloudflare Workers inklusive vorbereiteter `staging`-Umgebung.
- `.github/workflows/deploy.yml`
  Der bisherige GitHub-Pages-Workflow wurde auf Cloudflare-Deployments umgestellt.
- `package.json`
  Ergänzt um `check`, `deploy` und `deploy:staging`.
- `README.md`
  Dokumentiert jetzt die Cloudflare-Zielplattform und den neuen Deployment-Pfad.

## Warum `output: 'static'` in Phase 1

Der aktuelle Repo-Zustand ist bereits stark buildzeitbasiert:

- Portal-Content wird aus JSON-Dateien geladen
- Normen und Fassungen unter `/recht/` werden aus Dateistrukturen generiert
- die Rechtssuche nutzt einen beim Build erzeugten Index
- interaktive Module laufen clientseitig ohne Serverpersistenz

Darum bleibt die Ausgabe in Phase 1 statisch. Der Cloudflare-Adapter ist trotzdem bereits aktiv, damit spätere Worker-Routen gezielt per `prerender = false` ergänzt werden können.

Wichtig:

- `prerenderEnvironment: 'node'` ist gesetzt, weil die bestehenden Loader aktuell `node:fs` und `node:fs/promises` verwenden
- dadurch bleiben Build-Zeit-Reads stabil, ohne das Rechtsportal jetzt unnötig umzubauen
- automatische Cloudflare-KV-Sessions sind in Phase 1 bewusst deaktiviert
- das Image-Handling bleibt auf `passthrough`, damit keine unnötige Images-Binding eingeführt wird
- beim Build erzeugt Astro zusätzlich `dist/server/wrangler.json`; Wrangler verwendet diese generierte Deploy-Konfiguration beim eigentlichen Deploy automatisch weiter

## Lokal entwickeln

Abhängigkeiten installieren:

```sh
npm install
```

Astro-Devserver starten:

```sh
npm run dev
```

Type-Check:

```sh
npm run check
```

Produktionsbuild:

```sh
npm run build
```

Lokale Cloudflare-nahe Vorschau:

```sh
npm run preview
```

## Lokal für Staging testen

Wenn Canonical-URL, Sitemap und `robots.txt` auf eine Staging-Domain zeigen sollen, den Build mit `SITE_URL` ausführen:

```sh
SITE_URL=https://ostrecht-portal-staging.<subdomain>.workers.dev npm run build
```

Optional kann auch ein `BASE_PATH` gesetzt werden, falls die Seite ausnahmsweise unter einem Unterpfad betrieben werden soll:

```sh
SITE_URL=https://example.org BASE_PATH=/verwaltung/ npm run build
```

## Deployen

Produktion:

```sh
SITE_URL=https://freistaat-ostdeutschland.de npm run build
npm run deploy
```

Staging:

```sh
SITE_URL=https://ostrecht-portal-staging.<subdomain>.workers.dev npm run build
npm run deploy:staging
```

Der GitHub-Workflow deployt:

- bei `push` auf `main` standardmäßig nach `production`
- per `workflow_dispatch` wahlweise nach `staging` oder `production`

Für `staging` muss im manuellen Workflow eine vollständige `site_url` angegeben werden, damit Canonical-URLs und Sitemap nicht auf Produktion zeigen.

## Noch nötige externe Cloudflare-Schritte

1. In Cloudflare Workers eine `workers.dev`-Subdomain aktivieren, falls noch nicht vorhanden.
2. Einen API-Token mit Deploy-Rechten erzeugen.
3. In GitHub die Secrets `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` hinterlegen.
4. Optional eine produktive Custom Domain mit dem Worker verbinden.
5. Optional eine Staging-Domain oder die `workers.dev`-URL festlegen und als `SITE_URL` beim Staging-Build verwenden.

## Was vorerst statisch bleibt

- Startseite und Hauptnavigation
- Staatsregierung, Themen, Presse, Haushalt, Freistaat und Service
- das komplette Rechtsportal unter `/recht/`
- Normensuche via statischem Suchindex
- das Rechtswerkzeug für Normdateien unter `/redaktion/recht/`

Das eigentliche Redaktionsstudio unter `/redaktion/` ist inzwischen als gezielt on-demand gerenderter Worker-Bereich ergänzt worden. Die ursprüngliche Migrationsentscheidung bleibt dabei erhalten: Das öffentliche Portal bleibt weitgehend statisch, nur interne Studio-Routen und ausgewählte D1-Bereiche rendern serverseitig bei Bedarf.

## Gute Kandidaten für spätere Dynamisierung

### D1

- strukturierte Presse- und Terminverwaltung
- kuratierte Service-Datensätze mit Redaktionsoberfläche
- spätere redaktionelle Metadaten oder einfache Verwaltungslisten

### R2

- größere Bildablagen
- Uploads für Presse oder Dokumente
- Downloads und Anhänge, die nicht dauerhaft im Git-Repository gepflegt werden sollen
