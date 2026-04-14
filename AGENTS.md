# AGENTS.md

## Master-Portal-Regel

Dieses Projekt ist ein statisches Gesamtportal der Staatsregierung mit integriertem Rechtsbereich.

Prioritäten:
1. Das Gesamtportal wirkt wie eine Regierungswebsite.
2. Das Rechtsportal bleibt funktional erhalten.
3. Inhalte bleiben dateibasiert.
4. Keine neue Serverarchitektur.
5. Navigation und Informationsarchitektur folgen der Master-Spezifikation.
6. Bereits bestehende Seiten dürfen angepasst oder umgehängt werden, wenn dies der konsistenten Gesamtarchitektur dient.

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
