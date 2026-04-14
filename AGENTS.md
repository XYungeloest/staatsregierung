# AGENTS.md

## Projektkontext

Dieses Repository baut ein statisches Rechtsportal für eine politische Simulation. Es ist kein allgemeines CMS und kein juristisches Großsystem, sondern ein bewusst einfaches, robustes und langfristig wartbares Portal mit aktuellen Fassungen, historischen Fassungen, Normenhistorie und Suche.

## Primärziele

1. Vollständig statische Website
2. GitHub-Pages-kompatibler Build
3. Klare dateibasierte Content-Struktur
4. Einfache Rechtsstandslogik über gespeicherte Fassungen
5. Gute Lesbarkeit und geringe technische Komplexität

## Nicht-Ziele

- keine Datenbank
- kein Server-Backend
- kein Login
- kein Adminbereich
- keine SSR
- keine automatische Konsolidierung von Änderungsgesetzen
- kein Overengineering

## Technische Präferenzen

- Astro
- TypeScript
- kleine, verständliche Komponenten
- klare Utility-Funktionen statt unnötiger Klassenhierarchien
- Build-Zeit-Generierung statt Laufzeitmagie

## Inhaltslogik

Jede Norm besitzt:
- Stammdaten
- mehrere Fassungen
- Historieneinträge

Historische Fassungen werden nicht berechnet, sondern liegen als eigene konsolidierte Fassungen vor.

## Arbeitsweise

- Lies zuerst `SPEC.md` und `TASKLIST.md`.
- Arbeite phasenweise.
- Halte Änderungen klein und überprüfbar.
- Erkläre vor größeren Umbauten kurz die geplanten Dateien.
- Bevorzuge direkte, robuste Lösungen.
- Führe keine unnötigen Bibliotheken ein.
- Dokumentiere neue zentrale Entscheidungen knapp in der README.

## Code-Stil

- klare Typen
- sprechende Namen
- kurze Funktionen mit klarer Verantwortung
- keine zu frühe Generalisierung
- Kommentare nur dort, wo die Absicht nicht sofort aus dem Code hervorgeht

## UI-Stil

- nüchtern
- behördennah
- gute Typografie
- keine verspielten Effekte
- Inhaltsklarheit vor Design-Spielereien

## Bei Unsicherheit

Wenn Anforderungen unklar sind:
- an `SPEC.md` orientieren
- konservative, einfache Interpretation wählen
- keine große Zusatzarchitektur einführen

## Portal-Redesign-Hinweis

Dieses Projekt ist nicht mehr nur ein Rechtsportal, sondern eine statische Website der Staatsregierung mit integriertem Rechtsbereich.

Wichtige Prioritäten:
1. Das Rechtsportal darf funktional nicht beschädigt werden.
2. Neue Portalbereiche sollen mit derselben statischen Architektur umgesetzt werden.
3. Inhalte sind dateibasiert.
4. Navigation, Layout und Service-Struktur sollen eher wie ein Regierungsportal als wie eine Fachanwendung wirken.
5. Keine neue Serverarchitektur einführen.