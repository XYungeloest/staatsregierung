# Kreisreform-Karte

Diese Datei dokumentiert die redaktionelle Kartenpipeline für die Seite `/kreisreform/`.

## Quelldaten

Benötigt wird das GeoPackage:

```text
data/geo/kreisreform/gebietsreform.gpkg
```

Es muss die Layer `gemeinden_mit_einwohner`, `kreise_mit_einwohnern` und `bezirke` enthalten. Die Quelldaten liegen in EPSG:25832; das Vorbereitungsskript schreibt Webdaten in EPSG:4326.

Zusätzlich liegen die redaktionellen Rechtsgrundlagen als Arbeitsmaterial im gleichen Ordner:

```text
data/geo/kreisreform/bezirks-und-kreisneuordnungsgesetz-entwurf.md
data/geo/kreisreform/ostdeutsches-bezirkseinfuehrungsgesetz.md
```

Für die bisherigen realen Kreis- und Ländergrenzen wird außerdem das amtliche VG250-GeoPackage des
Bundesamtes für Kartographie und Geodäsie verwendet:

```text
data/geo/kreisreform/vg250/DE_VG250.gpkg
```

Verwendete Produktfassung: Verwaltungsgebiete 1:250 000, Stand 01.01.2025, UTM32s, Geopackage,
Ebenen. Direktdownload des BKG/GDZ:

```text
https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/aktuell/vg250_01-01.utm32s.gpkg.ebenen.zip
```

## Daten erzeugen

```sh
npm run kreisreform:prepare
```

Das Skript liest die GeoPackages mit `sqlite3`, transformiert die Geometrien nach WGS84, vereinfacht
sie für die Webkarte und normalisiert die Properties. Aus VG250 werden die bisherigen Kreise und
Länder gelesen; die bisherigen Bezirke werden aus den VG250-Kreisgrenzen nach dem
Ostdeutschen Bezirkseinführungsgesetz per Dissolve abgeleitet.

## Ausgabedateien

Die Website lädt statische Dateien aus:

```text
public/data/kreisreform/manifest.json
public/data/kreisreform/neue-kreise.geojson
public/data/kreisreform/neue-bezirke.geojson
public/data/kreisreform/alte-kreise.geojson
public/data/kreisreform/alte-bezirke.geojson
public/data/kreisreform/alte-bundeslaender.geojson
public/data/kreisreform/gemeinden-zur-suche.json
```

`manifest.json` enthält Layerstatus, Erzeugungszeitpunkt, Kennzahlen, Quellenangaben und Dateigrößen.

## VG250-Vergleichslayer

Alte Kreis-, Bezirks- und Ländergrenzen werden nicht aus dem Reform-GeoPackage erfunden. Das Skript
erwartet das amtliche VG250-GeoPackage lokal unter:

```text
data/geo/kreisreform/vg250/DE_VG250.gpkg
```

Falls eine andere lokale VG250-Datei verwendet werden soll:

```sh
KREISREFORM_VG250_GPKG=/pfad/zu/DE_VG250.gpkg npm run kreisreform:prepare
```

Mit `node scripts/prepare-kreisreform-map.mjs --with-vg250` bricht die Pipeline verständlich ab,
wenn VG250 fehlt. Ohne VG250 werden alte Vergleichslayer als nicht verfügbar markiert.

Die Quellenangabe für öffentliche Wiedergaben lautet gemäß BKG-Hinweis sinngemäß:
© BKG, dl-de/by-2-0, Datenquellen siehe BKG/GDZ-Dokumentation.

## Geladene Layer

Die Seite lädt standardmäßig:

- neue Kreise
- neue Bezirksgrenzen

Optional, wenn vorhanden:

- alte Kreise
- alte Bezirke
- alte Bundesländer

Die Gemeindeebene wird nicht als Geometrie in die Karte geladen. Für die Suche wird nur `gemeinden-zur-suche.json` verwendet.

## Rechtlicher Hinweis

Digitale Karten auf der Seite sind erklärende Darstellungen. Rechtsverbindlich ist die verkündete Fassung des Gesetzes einschließlich Anlagen.
