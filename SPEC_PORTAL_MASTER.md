# Website der Staatsregierung des Freistaates Ostdeutschland – Master-Spezifikation

## 1. Projektgegenstand

Es wird die offizielle Website der Staatsregierung des Freistaates Ostdeutschland innerhalb einer fiktiven Politiksimulation gebaut.

Die Website vereint drei Funktionen:

1. Regierungsportal
   - politische Kommunikation
   - Kabinett und Regierungsmitglieder
   - Ressorts / Ministerien
   - Themen und Projekte
   - Presse & Aktuelles
   - Haushalt

2. Integriertes Rechtsportal
   - durchsuchbare Sammlung von Gesetzen, Verordnungen, Verwaltungsvorschriften, Bekanntmachungen und Staatsverträgen
   - Volltextsuche
   - Normansichten
   - konsolidierte Fassungen
   - Archiv / chronologische Ausgaben
   - direkte Verlinkung aus Themenseiten

3. Serviceportal
   - Karriere / Stellenangebote
   - Kontakt
   - FAQ & Hilfe
   - Barrierefreiheit
   - Impressum
   - Datenschutz

## 2. Technische Leitplanken

- Astro
- TypeScript
- vollständig statische Ausgabe
- GitHub Pages kompatibel
- kein Backend
- keine Datenbank
- keine SSR
- keine Container
- keine Adminoberfläche
- dateibasierte Inhalte
- bestehende Rechtsportal-Logik weiterverwenden und in das Gesamtportal integrieren

## 3. Grundprinzipien

- Das Projekt ist ein staatlich anmutendes Portal mit klarer Kennzeichnung als fiktive Politiksimulation.
- Das Rechtsportal bleibt ein Kernmodul, ist aber kein separates Produkt mehr.
- Informationen sollen lesbar, sachlich, geordnet und barrierearm aufbereitet werden.
- Navigation und Inhaltsstruktur sollen sich an realen deutschen Landesregierungsseiten orientieren.
- Bereits beschlossene Maßnahmen sind als umgesetzt darzustellen.
- Teilweise oder vorbereitete Vorhaben sind als laufend, Ausbauphase oder nächste Schritte darzustellen.

## 4. Hauptnavigation

- Startseite
- Staatsregierung
- Themen & Projekte
- Recht
- Presse & Aktuelles
- Haushalt
- Über den Freistaat
- Service

## 5. Informationsarchitektur

### Startseite
Portal-Einstieg mit Teasern zu Regierung, Themen, Recht, Presse, Haushalt und Service

### Staatsregierung
- Ministerpräsident
- Kabinett & Ressorts
- Koalition
- 15-Punkte-Plan

### Themen & Projekte
- Wohnen & Vergesellschaftung
- ÖPNV & Mobilität
- Bildungsreform
- Kulturpass
- Demokratie & Sicherheit
- Rundfunkreform
- Krankenhausfonds
- Familie & Soziales
- Nachbarschaft & Europa
- Transparenz & Lobbyregister
- Haushalt & Finanzen
- Weitere Themen

### Recht
- Verfassung
- Normensuche
- Normansichten
- Volltextsuche / Facettensuche
- Archiv / Ausgaben
- konsolidierte Fassungen
- Verlinkung aus Themenseiten

### Presse & Aktuelles
- Pressemitteilungen
- Reden & Regierungserklärungen
- Termine

### Haushalt
- Doppelhaushalt 2025/2026 – Gesamtplan
- Einzelpläne
- Sondervermögen & Fonds

### Über den Freistaat
- Verfassung & Staatsziele
- Bezirke
- Landesfarben & Hoheitszeichen
- Hauptstädte / Hauptstadtfunktionen
- Geschichte & Erinnerungspolitik

### Service
- Übersicht
- Karriere
- Kontakt
- FAQ & Hilfe
- Barrierefreiheit
- Impressum
- Datenschutz

## 6. Themenseiten-Schema

Jede Themenseite folgt diesem Aufbau:
- Hero / Teaser
- Was ist beschlossen?
- Was ist umgesetzt?
- Nächste Schritte
- Rechtsgrundlagen
- FAQ
- Zuständiges Ressort

## 7. Interaktive Elemente

- 15-Punkte-Fortschritts-Dashboard
- Projekt-Timeline
- Gesetzgebungs-Tracker
- Haushalt-Explorer
- Archivübersichten
- FAQ-Module

Diese Elemente bleiben innerhalb der statischen Architektur:
- vorab generierte JSON-Daten
- clientseitige Visualisierung
- keine serverseitige Persistenz

## 8. Design-Leitlinien

- Landesfarben Blau, Weiß, Grün als Identität
- UI nutzt daraus abgeleitete, ruhige Verwaltungsfarben
- Schriftart: Jost
- staatlich anmutend, modern, lesbar
- WCAG 2.1 AA als Ziel
- mobile first
- klare Header-, Service- und Footer-Struktur
- Kennzeichnungsleiste zur Fiktionalität bleibt sichtbar

## 9. Sprach- und Redaktionsregeln

- Deutsch
- echte Umlaute und Sonderzeichen
- korrekte Großschreibung deutscher Nomen
- Datumsdarstellung bevorzugt als `TT. Monat JJJJ`
- sachlich-staatstragender, aber bürgerfreundlicher Stil

## 10. Nicht-Ziele

- kein CMS
- keine Login-/Adminlogik
- keine serverseitige Suche
- keine Online-Bewerbungsplattform
- keine serverseitige Kontaktformularverarbeitung
- keine überkomplexe Datenarchitektur