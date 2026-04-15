# Ostrecht-Portal – Taskliste

## Phase 1 – Grundgerüst
- Astro-Projekt prüfen und aufräumen
- sinnvolle Ordnerstruktur anlegen
- globale Layouts und Basisstyles anlegen
- `astro.config.mjs` für GitHub Pages vorbereiten
- `site` und `base` konfigurierbar machen
- einfache Startseite als Platzhalter anlegen

## Phase 2 – Datenmodell und Content-Schema
- Typen für Normen, Fassungen und Historien anlegen
- Content-Schema definieren
- Validierung einbauen
- Hilfsfunktionen für das Einlesen von Normdaten bauen

## Phase 3 – Beispielinhalte
- mindestens 5 Beispielnormen anlegen
- mindestens 2 Normen mit mehreren Fassungen anlegen
- Historiendaten ergänzen
- sinnvolle Ressorts, Sachgebiete und Schlagwörter setzen

## Phase 4 – Routen und Seiten
- Normseite der aktuellen Fassung
- Historienseite
- Seite historischer Fassungen
- Indexseite
- Sachgebietsübersicht
- Sachgebietsdetailseiten

## Phase 5 – Renderer
- strukturierte Norminhalte in HTML rendern
- Inhaltsübersicht pro Norm erzeugen
- Metadaten-Box bauen
- Rechtsstand-Hinweise sauber darstellen

## Phase 6 – Suche
- Suchindex beim Build generieren
- Suchseite mit clientseitiger Suche bauen
- Filter nach Typ, Ressort, Sachgebiet und Status ergänzen
- Trefferkontext anzeigen

## Phase 7 – Feinschliff
- Layout lesbarer machen
- Navigation verbessern
- responsive Darstellung prüfen
- Fehlerseiten ergänzen
- Links und Slugs überprüfen

## Phase 8 – Deployment
- GitHub-Actions-Workflow für GitHub Pages anlegen
- `.nojekyll` sicherstellen, falls nötig
- Build-Output prüfen
- README mit Deploy-Anleitung ergänzen

## Arbeitsmodus für Codex
- immer nur eine Phase nach der anderen umsetzen
- vor größeren Änderungen kurz den geplanten Dateibaum nennen
- keine Features aus späteren Phasen vorziehen, wenn sie nicht nötig sind
- lieber wenige saubere Dateien als viele halbfertige
- bestehende Dateien gezielt erweitern statt unnötig neue Abstraktionen einzuführen