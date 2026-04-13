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

Für eine Projektseite unter `https://username.github.io/repo-name/` bauen Sie lokal am besten so:

```sh
SITE_URL=https://username.github.io BASE_PATH=/repo-name/ npm run build
```

## Konfiguration

`site` und `base` werden über Umgebungsvariablen gesteuert:

```sh
SITE_URL=https://beispiel.de BASE_PATH=/ostrecht-portal npm run build
```

- `SITE_URL`: vollständige Zieladresse der späteren Seite
- `BASE_PATH`: Unterpfad für GitHub Pages, z. B. `/ostrecht-portal/`

Ohne Angabe wird mit `https://example.github.io` und `/` gebaut.

Für GitHub Pages als Projektseite gilt in der Regel:

- `SITE_URL=https://username.github.io`
- `BASE_PATH=/repo-name/`

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

## Suche

Die Suche bleibt vollständig statisch:

- beim Build wird unter `search-index.json` ein JSON-Suchindex erzeugt
- die Seite `/search/` lädt diesen Index im Browser
- durchsucht werden Titel, Kurztitel, Abkürzung, Metadaten und Normtexte
- Filter stehen für Normtyp, Ressort, Sachgebiet und Status bereit

Damit bleibt die GitHub-Pages-Kompatibilität ohne Backend oder serverseitige Suche erhalten.

## Oberfläche

Die Oberfläche ist bewusst nüchtern und behördennah gehalten:

- einheitliche Kopf- und Fußnavigation
- Brotkrumen zur Orientierung in Verzeichnissen und Normseiten
- lesefreundliche Typografie und klare Abstände für Normtexte
- responsive Darstellung für Desktop und Mobilgeräte
- eigene Fehlerseiten für nicht gefundene oder fehlgeschlagene Aufrufe

## Deployment auf GitHub Pages

Für das Deployment ist eine einfache Standardlösung über GitHub Actions eingerichtet:

- Workflow-Datei: `.github/workflows/deploy.yml`
- statischer Build mit `npm run build`
- Upload des `dist/`-Verzeichnisses als Pages-Artefakt
- Deployment über `actions/deploy-pages`
- `.nojekyll` wird über `public/.nojekyll` mit ausgeliefert

Der Workflow ist auf eine Projektseite wie `https://username.github.io/repo-name/` ausgelegt und setzt dafür automatisch:

- `SITE_URL=https://<GitHub-Benutzername>.github.io`
- `BASE_PATH=/repo-name/`

## Manuelle GitHub-Einrichtung

In GitHub selbst müssen Sie anschließend noch Folgendes einstellen:

1. Das Standard-Branch-Deployment soll über GitHub Actions laufen.
2. Öffnen Sie dazu im Repository `Settings` → `Pages`.
3. Wählen Sie bei `Source` die Option `GitHub Actions`.
4. Stellen Sie sicher, dass der Default-Branch `main` ist oder passen Sie den Workflow an Ihren Branch an.

Danach reicht ein Push auf `main`, um den Build und das Pages-Deployment auszulösen.
