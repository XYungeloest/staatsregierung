# Ostrecht-Portal – Portal-Redesign zur Website der Staatsregierung

## Ziel

Das bestehende statische Rechtsportal wird zu einer umfassenderen statischen Website der Staatsregierung des Ostdeutschen Freistaates ausgebaut.

Die Website soll künftig nicht nur das Rechtsportal enthalten, sondern zusätzlich:
- eine Startseite der Staatsregierung
- eine Regierungssektion
- eine Übersicht der Regierungsmitglieder
- Einzelprofile der Regierungsmitglieder
- eine Ministerien-Übersicht
- eine Unterseite für jedes Ministerium
- eine Presse-Sektion mit Pressemitteilungen und Bildern
- eine Karriere-Sektion mit Stellenausschreibungen
- Kontakt, Impressum, Datenschutz, Barrierefreiheit

Das Projekt bleibt vollständig statisch und GitHub-Pages-kompatibel.

## Grundprinzipien

- kein Backend
- keine Datenbank
- keine SSR
- keine Container
- dateibasierte Inhalte
- zentrale Konfiguration
- einfache, wartbare Architektur
- das bestehende Rechtsportal wird integriert, nicht neu erfunden

## Zielanmutung

Die Website soll optisch und strukturell an eine moderne Landesregierungsseite erinnern:
- sachlich
- klar gegliedert
- „offiziell“ wirkend
- aber klar als fiktive Politiksimulation gekennzeichnet

## Hauptbereiche

1. Startseite
2. Regierung
3. Ministerien
4. Presse
5. Karriere
6. Recht
7. Service

## Rechtsportal-Integration

Das Rechtsportal bleibt als eigener Bereich bestehen und wird unter `/recht/` eingehängt.

Bestehende Kernfunktionen des Rechtsportals bleiben erhalten:
- aktuelle Fassungen
- historische Fassungen
- Normenhistorie
- Suche
- Sachgebiete
- alphabetischer Index

## Content-Typen

- `regierungMitglied`
- `ministerium`
- `pressemitteilung`
- `stellenangebot`
- `seite`
- `norm`

## Nicht-Ziele

- kein CMS
- keine serverseitige Speicherung
- keine komplexen Workflows
- keine dynamische Jobsuche
- keine Pressedatenbank mit API