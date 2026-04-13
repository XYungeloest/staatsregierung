# Ostrecht-Portal

Statisches Rechtsportal für den „Freistaat Ostdeutschland“ auf Basis von Astro und TypeScript.

## Leitplanken

- vollständig statische Ausgabe
- GitHub-Pages-kompatibler Build
- keine Datenbank
- kein Backend
- keine Container
- dateibasierte Inhalte

## Entwicklung

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

Die Ausgabe wird vollständig statisch nach `dist/` erzeugt und ist für GitHub Pages vorgesehen.

## Konfiguration

`site` und `base` werden über Umgebungsvariablen gesteuert:

```sh
SITE_URL=https://beispiel.de BASE_PATH=/ostrecht-portal npm run build
```

- `SITE_URL`: vollständige Zieladresse der späteren Seite
- `BASE_PATH`: Unterpfad für GitHub Pages, z. B. `/ostrecht-portal/`

Ohne Angabe wird mit `https://example.github.io` und `/` gebaut.

## Content-Struktur

Normdaten liegen dateibasiert unter `content/normen/[slug]/`:

```text
content/normen/[slug]/
├── meta.json
├── history.json
└── versions/
    └── [versionId].json
```

Die Typen, Validierung und Einlese-Utilities dafür liegen in `src/lib/norms/`. Damit bleiben Inhalte redaktionsnah als Dateien pflegbar und können später zur Build-Zeit in Seiten und Verzeichnisse übernommen werden.
