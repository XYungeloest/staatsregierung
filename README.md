# Ostrecht-Portal

Statisches Rechtsportal für den „Freistaat Ostdeutschland“ auf Basis von Astro und TypeScript.

Das Projekt ist bewusst einfach gehalten:

- keine Datenbank
- kein Backend
- keine Container
- keine SSR
- keine automatische Konsolidierung von Änderungsgesetzen
- vollständig statische Ausgabe für GitHub Pages

## Kurzüberblick

Das Portal zeigt:

- aktuelle Fassungen von Normen
- historische Fassungen
- Normenhistorien
- einen alphabetischen Index
- Sachgebietsseiten
- eine rein clientseitige Suche

Inhalte liegen vollständig dateibasiert im Repository unter `content/normen/`.
Die Markdown-Dateien unter `Gesetze/` dienen als Primärquelle für importierte Normtexte.

## Voraussetzungen

- Node.js ab `22.12.0`
- `npm`

## Installation

Repository klonen und Abhängigkeiten installieren:

```sh
npm install
```

Lokale Entwicklungsumgebung starten:

```sh
npm run dev
```

Danach ist das Portal lokal im Astro-Dev-Server erreichbar.

## Build

Statischen Build erzeugen:

```sh
npm run build
```

Die fertige Ausgabe liegt danach in `dist/`.

Optional können Sie zusätzlich den Type-Check ausführen:

```sh
npm exec astro check
```

Wenn der Build in einer eingeschränkten Umgebung läuft, kann Astro-Telemetry zusätzlich deaktiviert werden:

```sh
ASTRO_TELEMETRY_DISABLED=1 npm run build
```

## GitHub Pages und `base`-Pfad

Das Projekt ist auf GitHub Pages als Projektseite ausgelegt, also auf Adressen wie:

```text
https://username.github.io/repo-name/
```

Wichtig dafür sind zwei Umgebungsvariablen:

- `SITE_URL`
  Die Basisdomain, z. B. `https://username.github.io`
- `BASE_PATH`
  Der Unterpfad des Repositories, z. B. `/repo-name/`

Lokaler Test für eine Projektseite:

```sh
SITE_URL=https://username.github.io BASE_PATH=/repo-name/ npm run build
```

Beispiel für eine Root-Seite ohne Unterpfad:

```sh
SITE_URL=https://beispiel.de BASE_PATH=/ npm run build
```

Ohne Angaben nutzt das Projekt Standardwerte für die lokale Entwicklung und einfache Tests.

## Deployment auf GitHub Pages

Das Repository enthält bereits einen einfachen Workflow:

- `.github/workflows/deploy.yml`

Der Workflow:

- installiert Abhängigkeiten mit `npm ci`
- baut das Projekt mit `npm run build`
- lädt `dist/` als Pages-Artefakt hoch
- deployed über GitHub Pages

Zusätzlich wird `public/.nojekyll` mit ausgeliefert, damit GitHub Pages die statische Astro-Ausgabe unverändert ausliefert.

### Was Sie in GitHub noch manuell einstellen müssen

1. Repository auf GitHub öffnen
2. `Settings` → `Pages` öffnen
3. Bei `Source` die Option `GitHub Actions` auswählen
4. Prüfen, dass der Workflow auf Ihren Standard-Branch passt

Danach reicht ein Push auf `main`, um das Deployment auszulösen.

## Projektstruktur

Die wichtigsten Verzeichnisse:

```text
content/normen/          Normdaten als JSON-Dateien
public/                  statische Dateien wie Favicon und .nojekyll
src/pages/               Astro-Seiten und Routen
src/components/          wiederverwendbare Oberflächenbausteine
src/lib/norms/           Typen, Validierung, Loader, Routen- und Such-Helfer
src/scripts/             clientseitige Skripte, z. B. für die Suche
```

## Offizielle Header-Sprache und Kennzeichnung

Das Portal kann optional mit einer stärker amtlich wirkenden, aber klar als fiktiv gekennzeichneten
Kopfstruktur betrieben werden.

Die zentrale Steuerung erfolgt in `src/config/features.ts`:

- `enableOfficialStyleHeader`
  Schaltet die offizielle Kopfstruktur und die obere Kennzeichnungsleiste ein oder aus
- `enableServiceLinks`
  Blendet die zusätzliche Servicenavigation im Kopfbereich ein oder aus
- `enableStickyHeader`
  Schaltet den Kopfbereich als sticky Header

Ergänzende Texte und Pfade liegen in `src/config/site.ts`.

Erwarteter Pfad für die Flagge:

```text
public/assets/flagge-ostdeutschland.png
```

Wenn die Bilddatei fehlt, verwendet das Layout automatisch einen textuellen Fallback. Die
Kennzeichnungsleiste weist dauerhaft darauf hin, dass es sich um eine inoffizielle Website einer
fiktiven Politiksimulation handelt.

## Architektur in Kürze

Das Projekt arbeitet in drei einfachen Schritten:

1. JSON-Dateien unter `content/normen/` werden zur Build-Zeit eingelesen und validiert.
2. Astro erzeugt daraus statische Seiten für aktuelle Fassungen, historische Fassungen, Historien, Verzeichnisse und Suche.
3. Die Suche lädt einen vorab erzeugten JSON-Index im Browser und arbeitet rein clientseitig.

Wichtig:

- historische Fassungen werden nicht berechnet
- jede Fassung liegt als eigene konsolidierte Datei vor
- Inhalte werden beim Build validiert
- Markdown-Quellen aus `Gesetze/` werden bei Bedarf über `scripts/import-normen.mjs` in die kanonische JSON-Struktur überführt

## Content-Struktur

Jede Norm hat ein eigenes Verzeichnis:

```text
content/normen/[slug]/
├── meta.json
├── history.json
└── versions/
    ├── 2026-01-01.json
    └── 2026-04-01.json
```

Beispiel:

```text
content/normen/polg/
├── meta.json
├── history.json
└── versions/
    ├── 2026-01-01.json
    └── 2026-04-01.json
```

Die Dateinamen unter `versions/` müssen zum jeweiligen `versionId` passen.

## Redaktionelle Eingabemaske

Optional steht eine rein clientseitige Redaktionsmaske unter `/redaktion/` zur Verfügung.

Die Funktion wird zentral in `src/config/features.ts` gesteuert:

- `enableEditorialTools`
  Schaltet die Redaktionsseite insgesamt ein oder aus
- `showEditorialNavLink`
  Blendet den Navigationslink ein oder aus

Wenn `enableEditorialTools` auf `false` steht:

- erscheint kein Navigationslink
- die Route zeigt nur einen schlichten Hinweis, dass das Werkzeug deaktiviert ist

Wichtig:

- die Redaktionsmaske speichert auf GitHub Pages nichts serverseitig
- es gibt kein Backend, keine Datenbank, keine Authentifizierung und keine GitHub-Schreibzugriffe
- die erzeugten JSON-Dateien müssen anschließend manuell ins Repository übernommen werden

Die Maske kann:

- neue Normen mit `meta.json`, `history.json` und erster Versionsdatei vorbereiten
- neue Fassungen bestehender Normen erzeugen
- optional eine aktualisierte `history.json` für Änderungsstände ausgeben
- Pflichtfelder, Datumslogik, doppelte Slugs und doppelte `versionId`-Werte prüfen
- JSON-Dateien im Browser anzeigen, kopieren und einzeln herunterladen

Praktischer Ablauf:

1. Feature-Flag in `src/config/features.ts` aktivieren
2. lokal `npm run dev` starten oder die gebaute Seite öffnen
3. `/redaktion/` aufrufen
4. Eingaben ausfüllen und JSON-Dateien erzeugen
5. die Vorschau prüfen
6. `meta.json`, `history.json` und `versions/[versionId].json` in die passenden Verzeichnisse unter `content/normen/[slug]/` übernehmen
7. anschließend validieren:

```sh
npm exec astro check
npm run build
```

Beispiel für die Übernahme einer neu erzeugten Norm:

```text
content/normen/schulordnung/
├── meta.json
├── history.json
└── versions/
    └── 2026-09-01.json
```

## Neue Norm anlegen

### 1. Verzeichnis anlegen

Beispiel für eine neue Norm mit dem Slug `schulordnung`:

```text
content/normen/schulordnung/
├── meta.json
├── history.json
└── versions/
    └── 2026-09-01.json
```

### 2. `meta.json` anlegen

Beispiel:

```json
{
  "id": "fod-schulordnung",
  "slug": "schulordnung",
  "title": "Schulordnung des Freistaates Ostdeutschland",
  "shortTitle": "Schulordnung",
  "abbr": "SchulO",
  "type": "verordnung",
  "ministry": "Ministerium für Bildung und Kultur",
  "subjects": ["Schulrecht", "Bildung"],
  "keywords": ["Schule", "Ordnung", "Unterricht"],
  "initialCitation": "Schulordnung vom 1. September 2026 (GVBl. FOD 2026 S. 201)",
  "predecessor": null,
  "successor": null,
  "summary": "Regelt grundlegende organisatorische Fragen des Schulbetriebs.",
  "status": "in-force"
}
```

Wichtige Hinweise:

- `slug` muss genau zum Verzeichnisnamen passen
- `type` ist ein technischer Wert und muss einem erlaubten Typ entsprechen
- `status` ist ebenfalls technisch, z. B. `in-force`
- sichtbare deutsche Texte dürfen normale Umlaute enthalten

### 3. Praktischer Codex-Prompt für Gesetzblatt-PDFs

Wenn ein Gesetzblatt als PDF vorliegt, kann Codex daraus die Dateien für das Portal ableiten. Dafür ist ein klarer Arbeitsauftrag hilfreich.

Beispiel-Prompt:

```text
Lies zuerst vollständig SPEC.md, TASKLIST.md und AGENTS.md.

Verarbeite anschließend das folgende Gesetzblatt-PDF:
[PDF-PFAD-EINFÜGEN]

Ziel:
- überführe die im PDF enthaltenen Normen oder Änderungen in die dateibasierte Struktur dieses Repositories
- lege neue Normen unter content/normen/[slug]/ an
- ergänze bei geänderten Normen die neuen Fassungen als eigene konsolidierte Dateien unter versions/
- setze die bisher aktuelle Fassung auf historisch, wenn eine neue Fassung in Kraft tritt
- ergänze history.json mit passenden Historieneinträgen
- lege bei Änderungsgesetzen oder Änderungsvorschriften auch eigene Normverzeichnisse an, wenn das PDF solche Normen selbst enthält
- berücksichtige Folgeänderungen, wenn im PDF mehrere Normen geändert werden
- speichere historische Fassungen als eigene Dateien; keine automatische Konsolidierung bauen

Wichtig:
- keine Datenbank
- kein Backend
- keine Container
- GitHub-Pages-kompatibel bleiben
- bestehende Strukturen und Typen aus src/lib/norms/schema.ts beachten
- sichtbare deutsche Texte mit echten Umlauten und ß schreiben
- Slugs und technische IDs stabil und ASCII-basiert halten
- wenn eine Norm bereits existiert, vorhandene Dateien sorgfältig lesen und konsistent fortschreiben statt parallel widersprüchliche Dateien anzulegen

Arbeitsweise:
1. lies das PDF vollständig
2. nenne mir kurz, welche Normen neu angelegt oder geändert werden
3. setze dann die notwendigen Dateien um:
   - meta.json
   - history.json
   - versions/[versionId].json
4. prüfe danach mit Build oder Type-Check, ob die Daten valide sind
5. erkläre mir am Ende kurz, welche Normen und Fassungen angelegt oder geändert wurden

Wenn das PDF keine vollständig konsolidierte neue Fassung enthält, dann:
- leite nur dann eine neue konsolidierte Fassung ab, wenn der Text im PDF dafür ausreichend eindeutig ist
- andernfalls stoppe kurz und nenne mir genau, welche Fassung oder welche Textteile für eine saubere Konsolidierung fehlen
```

Praktischer Hinweis:

- Ersetzen Sie `[PDF-PFAD-EINFÜGEN]` durch einen echten lokalen Pfad, z. B. `/Users/name/Downloads/gesetzblatt-2026-12.pdf`
- Wenn ein Gesetzblatt mehrere Gesetze gleichzeitig ändert, sollte der Prompt ausdrücklich „Folgeänderungen berücksichtigen“ enthalten
- Wenn im PDF nur eine Änderungsvorschrift steht, aber keine fertige konsolidierte Neufassung, sollte Codex die Grenzen offen benennen statt ungesicherte Fassungen zu erfinden

## Neue Fassung anlegen

Neue Fassungen kommen als eigene JSON-Datei nach:

```text
content/normen/schulordnung/versions/2027-01-01.json
```

Beispiel:

```json
{
  "versionId": "2027-01-01",
  "validFrom": "2027-01-01",
  "validTo": null,
  "isCurrent": true,
  "citation": "Schulordnung in der Fassung vom 1. Januar 2027 (GVBl. FOD 2027 S. 10)",
  "changeNote": "§ 3 neu gefasst, § 8 ergänzt",
  "body": [
    {
      "type": "section",
      "label": "Teil 1",
      "title": "Allgemeine Vorschriften",
      "children": []
    },
    {
      "type": "paragraph",
      "label": "§ 1",
      "title": "Anwendungsbereich",
      "children": [
        {
          "type": "paragraphText",
          "text": "Diese Verordnung gilt für öffentliche Schulen des Freistaates Ostdeutschland."
        }
      ]
    }
  ]
}
```

Wichtig:

- pro Norm darf es genau eine aktuelle Fassung mit `isCurrent: true` geben
- die aktuelle Fassung muss `validTo: null` haben
- historische Fassungen müssen ein gesetztes `validTo` haben
- `versionId` muss zum Dateinamen passen

## Historieneintrag ergänzen

Historieneinträge stehen in `history.json`.

Beispiel:

```json
{
  "initialVersionId": "2026-09-01",
  "entries": [
    {
      "date": "2026-09-01",
      "type": "initial",
      "title": "Stammfassung",
      "citation": "Schulordnung vom 1. September 2026 (GVBl. FOD 2026 S. 201)",
      "affectingVersionId": "2026-09-01",
      "relatedNorm": null
    },
    {
      "date": "2027-01-01",
      "type": "amendment",
      "title": "Geändert durch Verordnung vom 20. Dezember 2026",
      "citation": "GVBl. FOD 2027 S. 10",
      "affectingVersionId": "2027-01-01",
      "relatedNorm": "schulordnung-aendv-2026"
    }
  ]
}
```

Wichtig:

- `initialVersionId` muss auf eine vorhandene Fassung zeigen
- `affectingVersionId` sollte auf die passende Fassung verweisen
- `relatedNorm` kann auf den Slug einer anderen Norm zeigen

## Welche Felder sichtbar sind

Für Redaktionsarbeit sind diese Felder besonders relevant:

- `title`
  Der volle sichtbare Titel
- `shortTitle`
  Kurztitel für Navigation und Metadaten
- `abbr`
  Abkürzung
- `summary`
  Kurzbeschreibung, erscheint auf Karten und in der Suche
- `citation`
  sichtbare Fundstelle der jeweiligen Fassung
- `changeNote`
  Kurzbeschreibung der Änderung dieser Fassung
- `subjects`
  für Sachgebietsseiten
- `keywords`
  für die Suche

## Erlaubte Normtypen

Aktuell unterstützt das Projekt:

- `gesetz`
- `verordnung`
- `verwaltungsvorschrift`
- `foerderrichtlinie`
- `staatsvertrag`
- `zustimmungsgesetz`
- `aenderungsvorschrift`

## Erlaubte Statuswerte

Aktuell unterstützt das Projekt:

- `in-force`
- `repealed`
- `planned`

Zusätzlich werden einige ältere Schreibweisen beim Einlesen normalisiert, zum Beispiel `published` zu `in-force`.

## Arbeiten als Redakteur

Empfohlener Ablauf für Änderungen:

1. bestehende ähnliche Norm unter `content/normen/` als Vorlage öffnen
2. neue oder geänderte JSON-Datei anlegen
3. auf konsistente Daten achten:
   `slug`, `versionId`, Datumswerte, `isCurrent`, `validTo`
4. Build und Validierung ausführen:

```sh
npm run build
npm exec astro check
```

Wenn der Build fehlschlägt, steckt die Ursache meistens in:

- ungültigem JSON
- fehlenden Pflichtfeldern
- falschem `slug`
- falschem `versionId`
- mehr als einer aktuellen Fassung

## Nützliche Beispiele im Repository

Zum Nachschauen eignen sich besonders:

- aktuelle und historische Fassung:
  `content/normen/polg/`
- Änderungsvorschrift:
  `content/normen/polg-aendg-2026/`
- Förderrichtlinie:
  `content/normen/dorfnetz-foerderrichtlinie/`
- Staatsvertrag:
  `content/normen/elbe-datenpakt-stv/`

## Häufige Fragen

### Muss ich historische Fassungen selbst berechnen?

Nein. Historische Fassungen werden nicht automatisch erzeugt. Jede historische Fassung wird als eigene konsolidierte Datei unter `versions/` gespeichert.

### Kann ich einfach Fließtext in `body` schreiben?

Nicht nur. Der Normtext wird strukturiert gespeichert. Am einfachsten ist es, eine bestehende Norm als Vorlage zu nehmen und die Struktur daran anzupassen.

### Warum sieht ein Typ technisch anders aus als im Frontend?

Technische Werte wie `foerderrichtlinie` oder `aenderungsvorschrift` werden im Frontend automatisch in gut lesbares Deutsch umgewandelt.

### Woher kommt die Suche?

Beim Build wird `search-index.json` erzeugt. Die Seite `/search/` lädt diesen Index im Browser und sucht rein clientseitig.
