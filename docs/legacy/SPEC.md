# Ostrecht-Portal – Spezifikation

## Ziel

Es soll ein leichtgewichtiges, vollständig statisches Rechtsportal für den „Freistaat Ostdeutschland“ entstehen, funktional inspiriert von REVOSax, aber technisch bewusst einfach gehalten.

Das Portal dient als amtlich wirkendes Rechtsinformationssystem innerhalb einer politischen Simulation. Es soll aktuelle Fassungen, historische Fassungen, Normenhistorien und eine Suche bereitstellen.

## Technische Leitentscheidungen

- Framework: Astro
- Sprache: TypeScript
- Ausgabe: rein statische HTML-, CSS- und JS-Dateien
- Hosting: GitHub Pages
- Keine Datenbank
- Kein Server-Backend
- Keine Container
- Kein Login
- Kein CMS
- Keine SSR
- Suche rein clientseitig mit vorab generiertem Suchindex

## Projektprinzipien

1. Einfachheit vor Vollständigkeit.
2. Robuste statische Generierung vor dynamischer Laufzeitlogik.
3. Lesbarkeit und Wartbarkeit vor cleverer Abstraktion.
4. Juristische Fachlogik nur so weit wie nötig.
5. Keine automatische Konsolidierung von Änderungsgesetzen.
6. Jede Fassung einer Norm wird als eigene konsolidierte Version gespeichert.

## Fachlicher Umfang

Das Portal soll mindestens folgende Normtypen unterstützen:

- Gesetz
- Verordnung
- Verwaltungsvorschrift
- Förderrichtlinie
- Staatsvertrag
- Zustimmungsgesetz
- Änderungsvorschrift

## Kernfunktionen

### 1. Aktuelle Fassung einer Norm
Jede Norm hat eine aktuelle Fassung unter einer stabilen URL, etwa:

`/norm/polg/`

### 2. Historische Fassungen
Jede Norm kann mehrere konsolidierte Fassungen haben, jeweils mit Gültigkeitszeitraum.

Beispiel-URL:

`/norm/polg/version/2026-01-01/`

### 3. Normenhistorie
Für jede Norm gibt es eine Historienseite mit:
- Stammfassung
- Änderungsvorschriften
- Fundstellen
- Liste aller Fassungen
- Gültigkeitszeiträumen
- Vorgänger-/Nachfolgeregelungen

Beispiel-URL:

`/norm/polg/history/`

### 4. Suche
Es soll eine clientseitige Suche geben über:
- Titel
- Kurztitel
- Abkürzung
- Normtyp
- Ressort
- Sachgebiet
- Schlagwörter
- Normtext

### 5. Verzeichnisse
Zusätzlich:
- alphabetischer Index
- Sachgebietsseiten
- optional Startseite mit „letzte Änderungen“

## Datenhaltung

Alle Inhalte werden dateibasiert im Repository gespeichert.

Bevorzugte Struktur:

- `content/normen/[slug]/meta.json`
- `content/normen/[slug]/versions/[versionId].json`
- `content/normen/[slug]/history.json`

Beispiel:

- `content/normen/polg/meta.json`
- `content/normen/polg/versions/2026-01-01.json`
- `content/normen/polg/versions/2026-04-01.json`
- `content/normen/polg/history.json`

## Metadaten einer Norm

Jede Norm soll mindestens folgende Felder haben:

- `id`
- `slug`
- `title`
- `shortTitle`
- `abbr`
- `type`
- `ministry`
- `subjects`
- `keywords`
- `initialCitation`
- `predecessor`
- `successor`
- `summary`
- `status`

## Daten je Fassung

Jede Fassung soll mindestens enthalten:

- `versionId`
- `validFrom`
- `validTo`
- `isCurrent`
- `citation`
- `changeNote`
- `body`

## Struktur des Normtextes

Normtexte sollen nicht nur als einfacher Fließtext gespeichert werden, sondern strukturiert, z. B. mit:

- Überschriften
- Teilen
- Abschnitten
- Unterabschnitten
- Paragraphen oder Artikeln
- Absätzen
- Nummern
- Buchstaben
- Anlagen

Die Renderer sollen daraus saubere HTML-Strukturen erzeugen.

## Erforderliche Seitentypen

### Startseite
- Suchfeld
- Einstieg in Index und Sachgebiete
- kurzer Hinweis zum Charakter als Simulationsportal

### Suchseite
- Suchfeld
- Filter
- Trefferliste mit Metadaten
- Trefferkontext

### Normseite (aktuelle Fassung)
- Titel
- Kurztitel
- Abkürzung
- Vollzitat / Fundstelle
- Ressort
- Inhaltsübersicht
- kompletter Normtext
- Rechtsstand-Hinweis
- Links auf Historie und historische Fassungen

### Historienseite
- Stammfassung
- Änderungsvorschriften
- Liste der Fassungen
- Fundstellen
- Vorgänger / Nachfolger

### Seite einer historischen Fassung
- deutlicher Hinweis „historische Fassung“
- Gültigkeitszeitraum
- Link zur aktuellen Fassung
- Link zur Historie

### Alphabetischer Index
- alle Normen alphabetisch
- A–Z-Sprünge

### Sachgebietsseiten
- Liste von Sachgebieten
- darunter zugeordnete Normen

## URL-Schema

- aktuelle Fassung: `/norm/[slug]/`
- Historie: `/norm/[slug]/history/`
- historische Fassung: `/norm/[slug]/version/[versionId]/`
- Suche: `/search/`
- Index: `/index/`
- Sachgebiete: `/subjects/`

## Suchtechnik

- rein clientseitig
- JSON-Suchindex wird beim Build generiert
- leichte Lösung bevorzugt
- FlexSearch oder Lunr sind möglich
- alternativ einfacher eigener Index

## Content-Pflege

Das System soll redaktionsfreundlich sein:
- klare Datei- und Ordnerstruktur
- gute Typisierung
- Build-Validierung der Inhalte
- verständliche Fehlermeldungen bei fehlenden Pflichtfeldern

## GitHub-Pages-Anforderungen

Das Projekt muss:
- mit `npm run build` vollständig statisch bauen
- auf GitHub Pages deploybar sein
- GitHub-Pages-Unterpfade sauber unterstützen
- einen konfigurierbaren `base`-Pfad haben
- einen GitHub-Actions-Workflow für Pages enthalten

## Seed-Daten

Es sollen mindestens enthalten sein:
- 5 Beispielnormen
- mindestens 2 Normen mit mehreren Fassungen
- mindestens 1 Änderungsvorschrift
- mindestens 1 Förderrichtlinie
- mindestens 1 Staatsvertrag oder Zustimmungsgesetz

## Qualitätsanforderungen

- sauber typisiert
- übersichtliche Komponentenstruktur
- keine unnötige Komplexität
- keine verfrühte Generalisierung
- zuerst funktionierende Basis, dann Verfeinerung

## Wichtige Negativabgrenzung

Nicht bauen:
- kein großes Fachverfahren
- keine automatische Einrechnung von Änderungsgesetzen
- kein Backend
- keine Datenbank
- kein Benutzer- und Rechtesystem
- keine unnötigen Build- oder Deployment-Komplexitäten

## Erwartete Arbeitsreihenfolge

1. Projektgrundstruktur
2. Astro-Konfiguration für GitHub Pages
3. Content-Schema und Typen
4. Seed-Daten
5. Routen und Seitentypen
6. Suchindex-Generator
7. Suchseite
8. Layout-Verfeinerung
9. GitHub-Actions-Deploy
10. README