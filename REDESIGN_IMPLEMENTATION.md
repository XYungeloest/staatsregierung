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

---

## Phase 2: Bereichs-, Übersichts- und Detailseiten

### Ausgangsbefund

Nach der ersten Phase waren Startseite, Behördenkopf, Serviceband und Footer bereits der visuelle
Maßstab. Die zentralen Unterseiten verwendeten dagegen überwiegend denselben großen weißen
Seitenkopf, gleichförmige Kartenraster und teilweise sehr große Abschnittsabstände. Personen,
Ressorts, Status und fachliche Arbeitsaufträge waren im Einstieg nicht ausreichend sichtbar;
langen Seiten fehlte teils eine lokale Orientierung.

### Neue Unterseitenmuster und Komponenten

`SectionHero.astro` führt ein gemeinsames, flaches Bereichskopfmuster mit Varianten für Regierung,
Themen, Recht, Haushalt, Kreisreform, Presse, Service und Freistaat ein. Der Kopf kann echte Fakten,
Status, genau eine primäre Aktion, ein vorhandenes Bild und eine Suche oder einen anderen
fachlichen Einstieg aufnehmen. Eine Langtitelvariante schützt Norm- und Ressorttitel vor Überlauf.

`SectionNavigation.astro` stellt die lokale Bereichs- und Ankernavigation mit semantischem
Navigationsbereich, beschreibendem Label, aktivem Link und sichtbaren Fokuszuständen bereit.
Bereichsspezifische Wrapper vereinheitlichen Regierung, Recht, Haushalt, Presse und Freistaat.
`MinistryDirectory.astro` lädt Ressortname, Kurzname, Leitung und zentrale Aufgabe aus den
vorhandenen Ministeriumsdaten. `ServiceCard.astro`, `TopicCard.astro` und `MinistryCard.astro`
wurden an die neue Typografie, Iconlogik und zurückhaltende Flächengestaltung angepasst.

### Geänderte Seitenfamilien

- **Staatsregierung:** repräsentativer Einstieg mit Kabinett Honecker II, Porträt, Koalition,
  Leitung und Ressortzahl; gestaffelte Direkteinstiege, datenbasiertes Ministeriumsverzeichnis und
  konsistente Mitgliederkarten. Kabinett, Ministerpräsident, Koalition, 15-Punkte-Plan,
  Mitglieder und frühere Kabinette nutzen die lokale Regierungsnavigation.
- **Kabinett und Ressorts:** das Kabinett bildet den zentralen Ministerienbereich ohne
  hartcodierte Ressortduplikate. Ressortdetails beginnen zweispaltig mit Aufgaben, Leitung, Bild
  und Kontakt; danach folgen Profil, Zuständigkeiten, Themen und Rechtsgrundlagen.
- **Regierungsmitglieder:** Porträt, Name, Amt, Ressort, Status und Kontakt stehen gemeinsam im
  ersten Profilbereich; Biografie und weiterführende Angaben schließen darunter an.
- **Themen:** Kreisreform und Bildung sind hervorgehobene Leitthemen. Die Übersicht gruppiert die
  tatsächlichen Statuswerte und nennt das zuständige Ressort. Details besitzen die geforderte
  Ankernavigation, eine verständliche Abfolge der nächsten Schritte und fachliche Rechtslisten.
- **Recht:** Suche und kompakte echte Kennzahlen stehen am Anfang. Recherchewege, Änderungen und
  Verkündungen sind strukturierte Listen. Normköpfe zeigen Rechtsstand, Typ, Abkürzung und
  Fundstelle früh; die Navigation zu Inhalt, Text, Daten, Historie und verwandten Vorschriften ist
  vereinheitlicht. Normtext, Historienmodell, Tracker und Druckansicht bleiben erhalten.
- **Haushalt:** kompakter Bereichskopf, gemeinsame lokale Navigation und früh sichtbare
  Jahresumschaltung. Doppelte große Aktionswege wurden entfernt; Kennzahlen, Filter, Tabellen,
  Vergleiche und Datenlogik bleiben unverändert.
- **Kreisreform:** die textlich nutzbare Gebietssuche steht im Bereichskopf vor Fakten und Karte.
  Bezirke und Kreise, Karte, Änderungen, Tabellen, Rechtsgrundlagen und FAQ besitzen eindeutige
  Anker. Kartenfreigabe, Tabellenansicht und Suchlogik bleiben unverändert.
- **Presse:** die neueste Meldung bildet den redaktionellen Schwerpunkt; weitere Meldungen,
  Termine, Kontakt, RSS und Kalender sind getrennt gruppiert. Leere Terminmodule werden nicht
  ausgegeben.
- **Service:** Kontakt und 115, Ressortsuche, Karriere, Publikationen und FAQ ersetzen die
  bisherigen Pseudo-Kennzahlen. Leichte Sprache, Gebärdensprache und Barrierefreiheit sowie
  Impressum und Datenschutz bilden jeweils eigene Gruppen. Es gibt weder ein erfundenes
  Servicekonto noch einen Telefonlink für 115.
- **Freistaat:** Grunddaten, Regierungssitz, staatliche Struktur, Flagge und zentrale Wege zu
  Staatsregierung, Themen, Recht und Haushalt vertiefen die Orientierung der Startseite.
- **Startseite:** nur typografischer Feinschliff am Desktop-H1, Bildposition und etwas geringere
  Abstände im unteren Bereich; Informationsarchitektur und bestehende Einstiege bleiben erhalten.

### Bewusst beibehaltene Fachstrukturen

Normfassungen, Historien, Verkündungsverknüpfungen, Haushaltsdaten und -filter sowie
Kreisreformdaten wurden nicht neu modelliert. Die Karte startet weiterhin erst nach ausdrücklicher
Freigabe. Tabellen bleiben in ihren kontrollierten Scrollbereichen. Es wurden keine Dienste,
Personen, Ressorts oder Pressebilder ergänzt, die nicht in den bestehenden Quellen vorhanden sind.

### Responsive Entscheidungen

Die repräsentativen Seitentypen werden bei 360 × 800, 390 × 844, 768 × 1024, 1024 × 900 und
1440 × 1000 geprüft. Bereichsköpfe und Profilköpfe stapeln Bild und Text ohne leere Spalte;
Langtitel brechen innerhalb des Containers um. Lokale Navigationen werden mobil zweispaltig oder
kontrolliert umbrechend dargestellt und nicht fixiert. Kontaktangaben und Aktionen erhalten die
volle verfügbare Breite. Breite Fachtabellen scrollen nur in ihrem eigenen, beschrifteten Bereich.

### Accessibility-Entscheidungen

Alle neuen Einstiege bewahren genau eine H1, Landmarken, Skip-Link und nachvollziehbare
Überschriften. Lokale Navigationen besitzen ein verständliches `aria-label` und `aria-current`.
Suche, Filter und Statusmeldungen bleiben beschriftet und tastaturbedienbar. Fokuszustände und
Touchziele sind sichtbar beziehungsweise ausreichend groß. Status wird nie nur über Farbe
vermittelt; normale Themen- und Navigationsakzente verwenden kein Rot. Reduzierte Bewegung und
die Rechtsdruckansicht bleiben berücksichtigt.

### Tests und Ergebnisse

Die Testabdeckung wurde um Staatsregierung, Kabinett, ein Ressort, ein Regierungsmitglied und
Service ergänzt; eine Themendetailseite war bereits enthalten. Browserprüfungen sichern lokale
Navigation, Ministeriumsverzeichnis, Profilporträt, Servicegruppierung sowie Kreisreform-,
Haushalts-, Rechts- und Portalsuche. Qualitätsprüfungen decken die fünf verbindlichen Viewports,
200-Prozent-Zoom und lange Norm- und Ressorttitel ab. Nach manueller Sichtprüfung wurden die
Baselines aktualisiert und anschließend in einem unveränderten Lauf verifiziert.

- `npm run content:check`: Content-QA erfolgreich
- `npm run check`: 169 Dateien, 0 Fehler, 0 Warnungen, 0 Hinweise
- `npm run test:unit`: 3 fachliche Zuordnungsprüfungen erfolgreich
- `npm run build`: 322 statische Seiten erfolgreich erzeugt
- `npm run links:check`: interne Links in 322 HTML-Dateien erfolgreich geprüft
- `npm run seo:check`: SEO-QA erfolgreich
- `npm run test:a11y`: 95 Accessibility-Prüfungen erfolgreich
- `npm run test:quality`: 6 Viewport-, Überlauf-, Zoom-, Consent- und Bewegungsprüfungen erfolgreich
- `npm run test:browsers`: 21 Interaktionstests in Chromium, Firefox und WebKit erfolgreich
- `npm run test:visual:update`: 140 Baselines und ergänzende Interaktionsprüfungen aktualisiert
- `npm run test:visual`: 140 visuelle und ergänzende Interaktionstests erfolgreich verifiziert

### Verbleibende Einschränkungen

Das vorhandene Staatskanzlei-Motiv liegt nur bis 960 Pixel Breite vor und wurde nicht künstlich
hochskaliert. Die vorhandenen Pressebilder sind Ein-Pixel-Platzhalter und werden deshalb nicht als
redaktionelle Aufmacherbilder verwendet. Die integrierte Browser-Verbindung der Arbeitsumgebung
war wegen fehlender Laufzeitmetadaten nicht verfügbar; Sicht-, Interaktions- und Screenshotprüfung
erfolgen daher mit der lokal installierten Playwright-Konfiguration.
