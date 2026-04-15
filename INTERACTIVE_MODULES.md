# Interaktive Module – funktionale Spezifikation

## Grundsatz

Alle interaktiven Module bleiben vollständig innerhalb der statischen Architektur.
Das bedeutet:
- keine Serverlogik
- keine Datenbank
- keine Live-Schnittstellen
- keine Benutzerkonten
- keine serverseitige Speicherung

Alle Module arbeiten mit:
- vorab gepflegten Content-Daten
- bei Bedarf zusätzlich vorab generierten JSON-Dateien
- clientseitiger Filterung, Sortierung und Visualisierung

## 1. 15-Punkte-Fortschritts-Dashboard

### Zweck
Visuelle Übersicht über den Umsetzungsstand des politischen 15-Punkte-Plans der Regierungskoalition.

### Inhalt
Für jeden Programmpunkt:
- Titel
- Kurzbeschreibung
- Status
- optional federführendes Ressort
- optional Verlinkung auf Themenseite
- optional Verlinkung auf Rechtsgrundlagen

### Statussystem
- `umgesetzt` → anzeigen als ✅
- `teilweise_umgesetzt` → anzeigen als 🔄
- `angelegt` → anzeigen als 📋

### Darstellung
- Kartenraster oder tabellarische Übersicht
- zusätzlich kompakte Status-Zusammenfassung oben:
  - Anzahl umgesetzt
  - Anzahl teilweise umgesetzt
  - Anzahl angelegt

### Interaktion
- clientseitiger Filter nach Status
- optional Filter nach Ressort
- Klick auf Eintrag führt zur passenden Themenseite

## 2. Projekt-Timeline

### Zweck
Chronologische Darstellung wichtiger Regierungsmaßnahmen und Normerlasse seit Dezember 2025.

### Inhalt je Timeline-Eintrag
- Datum
- Titel
- Typ des Eintrags
- Kurzbeschreibung
- optional Ressort
- optionale Verlinkung

### Eintragstypen
- Gesetz / Verordnung / Staatsvertrag
- politisches Projekt
- Kabinettsbeschluss
- Presseereignis
- Haushaltsereignis

### Darstellung
- vertikale Timeline
- gruppierbar nach Jahr oder Quartal
- auf Mobilgeräten reduzierte, gut lesbare Form

### Interaktion
- clientseitiger Filter nach Typ
- optional Filter nach Ressort
- optional Suche innerhalb der Timeline

## 3. Gesetzgebungs-Tracker

### Zweck
Übersicht über laufende oder kürzlich abgeschlossene Gesetzgebungsvorhaben im politischen Prozess.

### Inhalt je Vorhaben
- Titel
- Kurzbeschreibung
- federführendes Ressort
- aktueller Status
- optional Bezugsthema
- optionale Verlinkung auf Themenseite oder Norm

### Statusstufen
- `entwurf`
- `kabinett`
- `landtag`
- `verkuendung`
- `inkrafttreten`

### Darstellung
- Karten oder Tabelle
- pro Vorhaben eine sichtbare Statuskette
- aktueller Schritt hervorgehoben

### Interaktion
- Filter nach Status
- Filter nach Ressort
- optional Filter nach Thema

### Inhaltliche Leitplanke
Auch bereits abgeschlossene Vorhaben dürfen hier erscheinen, wenn dies für die Nachvollziehbarkeit der Reformschritte sinnvoll ist.

## 4. Haushalt-Explorer

### Zweck
Niedrigschwellige Visualisierung des Doppelhaushalts 2025/2026.

### Inhalt
Mindestens:
- Gesamtsumme 2025
- Gesamtsumme 2026
- Einzelpläne oder Ressortzuordnungen
- Sondervermögen / Fonds als eigene Positionen oder Zusatzbereich

### Datenstruktur
Je Datensatz mindestens:
- Jahr
- Ressort oder Einzelplan
- Betrag
- optionale Kurzbeschreibung
- optional Kategorie

### Darstellung
- einfache Balken- oder Säulendiagramme
- alternativ tabellarische Darstellung mit Filter- und Umschaltmöglichkeit
- keine überkomplexe Finanzanalyse

### Interaktion
- Umschaltung zwischen 2025 und 2026
- Filter nach Ressort / Einzelplan
- optionale Umschaltung Diagramm / Tabelle

### Inhaltliche Leitplanke
Das Modul ist ein politisch-administrativer Überblick, kein vollwertiges Haushaltsinformationssystem.

## 5. FAQ-Module / FAQ-Pattern

### Zweck
Wiederverwendbares FAQ-Element für Themenseiten, Service-Seiten und ggf. Rechtsportal-Einstiegsseiten.

### Inhalt
Je FAQ-Eintrag:
- Frage
- Antwort
- optional Verlinkung auf zuständige Seite oder Norm

### Einsatzorte
- Themenseiten
- Service/FAQ
- Kontakt
- Rechtsportal-Einstieg
- Karriere optional

### Darstellung
- Accordion oder ausklappbare Fragenliste
- standardisierte Komponente für mehrere Seitentypen

### Beispiele für FAQ-Inhalte
- Was bedeutet das Gesetz für mich?
- Wann tritt es in Kraft?
- Wer ist zuständig?
- Wo finde ich den vollständigen Normtext?
- Wie kann ich Kontakt aufnehmen?

## 6. Datengrundlage

Diese Module arbeiten mit kleinen, klaren, buildzeitnahen Datensätzen. Im aktuellen Projekt liegen sie als kuratierte Sekundärquellen unter:

- `src/data/dashboard/action-plan.ts`
- `src/data/dashboard/timeline.ts`
- `src/data/dashboard/legislation.ts`
- `src/data/dashboard/budget.ts`

Wichtig:

- Diese Dateien dienen der Visualisierung und Einstiegskommunikation.
- Sie sind nicht die primäre inhaltliche Wahrheit des Portals.
- Stammdaten bleiben in den Collections unter `content/`.
- Wo sinnvoll, sollen Dashboard-Daten schrittweise stärker aus Collections oder Normreferenzen abgeleitet werden.

## 7. Technische Leitplanken

- möglichst leichtgewichtige clientseitige Implementierung
- keine schweren Chart-Bibliotheken, wenn einfache Mittel genügen
- einfache, gut lesbare Visualisierung vor Designspielerei
- state und filtering möglichst klar und wartbar halten

## 8. Gestaltungsregeln

- amtlich und sachlich
- gut lesbar
- barrierearm
- auf Mobilgeräten brauchbar
- Jost als globale Schrift
- Farben aus dem bestehenden Blau-Weiß-Grün-System
- deutsche Umlaute, Großschreibung und Datumsdarstellung korrekt
