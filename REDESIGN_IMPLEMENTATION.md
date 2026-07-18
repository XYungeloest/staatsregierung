# Umsetzung der visuellen Neugestaltung

Stand: 18. Juli 2026

## 1. Ausgangszustand

Das Portal besaß bereits eine belastbare Astro- und TypeScript-Struktur, dateibasierte Inhalte,
ein funktionales Rechtsportal, die Kreisreform, Haushaltsdaten, Suche und automatisierte
Qualitätssicherung. Die Startseite war inhaltlich vollständig, wirkte gegenüber der bereitgestellten
Referenz aber stärker wie eine Folge einzelner Inhaltskarten. Der globale Kopf, die Startseite und
der Footer boten weniger visuelle Hierarchie und weniger unmittelbare Orientierung.

## 2. Interpretation der Referenz

Übernommen wurden die gestalterischen Prinzipien, nicht die konkreten Beispielinhalte:

- klare Behördenwortmarke und horizontale Hauptnavigation
- prominent platzierte Suche auf einer bildgestützten Einstiegsfläche
- kompakte Direkteinstiege in zentrale Portalbereiche
- ein schmales Band für wichtige Hinweise
- geordnete Spalten für Aktuelles, Verwaltung und Landesinformationen
- dunkle Service- und Footerzone als stabiler Seitenabschluss

Die Referenz wurde auf den fiktiven Freistaat, seine vorhandenen Seiten und die bestehende
Blau-Weiß-Grün-Anmutung übertragen.

## 3. Bewusste Abweichungen

- Es wurden keine in der Referenz gezeigten Onlinedienste erfunden.
- Statt Servicekonto oder Behördenfinder ohne bestehende Funktion verweisen alle Zugänge auf
  reale Portalpfade wie Suche, Kontakt, Recht, Ministerien und Kreisreform.
- Der sichtbare Simulationshinweis bleibt gemäß Projektvorgabe im oberen Hinweisband und Footer.
- Das Rechtsportal, der Haushalt und die Kreisreform behalten ihre fachlich geeigneten
  Inhaltsmodelle und Interaktionen.
- Das vorhandene Staatskanzlei-Motiv ersetzt das nicht als Quelldatei mitgelieferte Referenzfoto.

## 4. Informationsarchitektur der Startseite

Die neue Reihenfolge lautet: Orientierung und Suche, zentrale Portalpfade, wichtige Hinweise,
Presse und Regierung, Kreisreform und Themen, Recht und weitere zentrale Angebote sowie Service.
Diese Reihenfolge macht die wichtigsten Wege sichtbar, ohne bestehende Inhalte zu duplizieren oder
technische Implementierungsdetails öffentlich zu erklären.

## 5. Neue und angepasste Komponenten

Der gemeinsame Header und Footer wurden in `BaseLayout.astro` überarbeitet. Ergänzt wurden kleine,
auf ihren jeweiligen Zweck begrenzte Komponenten für Portalzugänge, wichtige Hinweise,
Presseinformationen, Ministerien, Freistaat-Kurzprofil, Serviceband und ein lokales SVG-Iconset.
Die Startseite setzt diese Komponenten zusammen und lädt ihre Inhalte weiterhin über die vorhandene
Portal-Datenlogik.

## 6. Geänderte Dateien

- `src/layouts/BaseLayout.astro`: Behördenkopf, mobile Navigation, Hauptbreite, Servicezone, Footer
- `src/pages/index.astro`: neue Startseitenhierarchie und vorhandene Inhaltsquellen
- `src/styles/global.css`: Tokens, responsive Layouts, Komponenten- und Fokuszustände
- `src/components/portal/*.astro`: wiederverwendbare Startseiten- und Servicekomponenten
- `tests/browser-smoke.spec.ts`: Suche, Ressortliste, mobile Navigation und 115-Einstieg
- `DESIGN.md`: aktualisierte Design- und Anwendungsvorgaben
- `README.md`: zentrale Layout- und Komponentenentscheidung
- visuelle Baselines unter `tests/visual.spec.ts-snapshots/`

## 7. Design-Tokens

Primärblau `#173b6b` und Dunkelblau `#0a2547` tragen Orientierung, Headerbild und Servicezone.
Sekundärgrün `#2f7b3d` bleibt der ruhige Portalakzent. Gold und Siegelrot werden sparsam eingesetzt.
Der Seitenhintergrund ist ein helles Blaugrau; Oberflächen bleiben nahezu weiß. Radien und Schatten
sind bewusst zurückhaltend. Die vollständige Zuordnung steht in `DESIGN.md`.

## 8. Responsive Umsetzung

Der Header wechselt unterhalb großer Desktopbreiten in eine native, aufklappbare Navigation.
Startseitenraster reduzieren sich schrittweise von sieben beziehungsweise drei Spalten auf zwei
und schließlich eine Spalte. Suche, Servicelinks und wichtige Hinweise bleiben auch mobil direkt
erreichbar. Fachseiten behalten ihre vorhandenen mobilen Sonderregeln. Kontrollierte
Tabellen-Scrollbereiche werden nicht als Dokumentüberlauf gewertet.

## 9. Accessibility

Die Überarbeitung bewahrt den Skip-Link, semantische Landmarken, genau eine H1, sichtbare
Fokuszustände und den aktiven Navigationszustand. Icongrafiken sind dekorativ, solange ein
Textlabel vorhanden ist. Suchfelder besitzen sichtbare Labels; die Navigation ist per Tastatur
bedienbar. Der Hero-Overlay sichert Textkontrast. Automatisierte Accessibility-Smoke-Tests und
Überlaufprüfungen ergänzen die manuelle Sicht- und Tastaturprüfung.

## 10. Bildstrategie

Das Hero verwendet das vorhandene Bild `public/images/ministerien/staatskanzlei.jpg` und seine
generierten AVIF-, WebP- und JPEG-Varianten bis 960 Pixel Breite. Es besitzt einen redaktionellen
Alternativtext und Bildnachweis. Pressebilder erscheinen nur, wenn eine echte Bilddatei vorliegt;
die bestehenden Ein-Pixel-Platzhalter werden nicht sichtbar hochskaliert. Es wurden keine externen
Bilder oder Bildbibliotheken ergänzt.

## 11. Performance

Die Umsetzung ergänzt keine JavaScript-Bibliothek. Icons sind kleine, inline ausgelieferte SVGs.
Inhalte werden weiterhin buildzeitbasiert geladen. Responsive Bildquellen begrenzen unnötige
Übertragung; nachgelagerte Bilder können verzögert geladen werden. Mobile Navigation und Suche
verwenden vorhandene Browsermechanismen beziehungsweise die bestehende Suchroute.

## 12. Tests und Ergebnis

Die Startseite und repräsentative Unterseiten wurden bei 390, 768, 1024 und 1440 Pixel Breite
visuell geprüft. Dabei trat kein unkontrollierter horizontaler Dokumentüberlauf auf. Zusätzlich
wurden folgende Prüfungen erfolgreich abgeschlossen:

- `npm run content:check`: Content-QA erfolgreich
- `npm run check`: 162 Dateien, 0 Fehler, 0 Warnungen, 0 Hinweise
- `npm run test:unit`: 3 fachliche Zuordnungsprüfungen erfolgreich
- `npm run build`: 322 statische Seiten erfolgreich erzeugt
- `npm run links:check`: interne Links in 322 HTML-Dateien erfolgreich geprüft
- `npm run seo:check`: Metadaten-, H1-, Canonical-, Sitemap- und Strukturdaten-QA erfolgreich
- `npm run test:visual`: 115 visuelle und ergänzende Interaktionstests erfolgreich
- `npm run test:a11y`: automatisierte Accessibility-Smoke-Tests erfolgreich
- `npm run test:quality`: Viewport-, Überlauf-, Zoom-, Consent- und Bewegungsprüfungen erfolgreich
- `npm run test:browsers`: 9 zentrale Interaktionstests in Chromium, Firefox und WebKit erfolgreich

Die eingebettete Browser-Verbindung der Arbeitsumgebung stand während der Prüfung nicht zur
Verfügung. Deshalb erfolgten Interaktions-, Viewport- und Screenshot-QA mit der im Repository
installierten lokalen Playwright-Konfiguration. Die resultierenden, manuell geprüften Baselines
liegen unter `tests/visual.spec.ts-snapshots/`.

## 13. Nicht umgesetzt

- keine neuen Onlinedienste, Nutzerkonten oder Formular-Backends
- keine neue Content- oder Komponentenarchitektur
- keine externe Icon-, Karten- oder UI-Bibliothek
- keine automatische Kartenfreigabe auf der Kreisreform-Seite
- keine inhaltliche Umstrukturierung gespeicherter Normfassungen
- kein neues Profil für Gerhardt Lehrmann

## 14. Verbleibende Rahmenbedingungen

Das Referenzbild lag nur als eingebettete visuelle Vorlage und nicht als wiederverwendbare
Bilddatei vor. Deshalb wurde ein vorhandenes, inhaltlich passendes Staatskanzlei-Motiv eingesetzt.
Dessen größte aktuelle Variante ist 960 Pixel breit; ein später redaktionell bereitgestelltes,
größeres Original könnte die Schärfe auf sehr breiten hochauflösenden Displays weiter verbessern,
ist für Funktion und Layout aber nicht erforderlich. Inhaltliche Aktualität richtet sich weiterhin
nach dem redaktionellen Stichtag 24. Juni 2026.
