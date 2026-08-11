# Design-System: Freistaat Ostdeutschland

Dieses Dokument beschreibt die visuelle Leitlinie des Portals. Maßgeblich bleibt der tatsächliche
Stand in `src/styles/global.css`; dieses Dokument hält die gestalterischen Entscheidungen und ihre
Anwendung fest.

## Grundhaltung

Das Portal wirkt wie eine sachliche Regierungswebsite: ruhig, verlässlich, verständlich und
barrierearm. Die Gestaltung priorisiert Orientierung, Zuständigkeiten und aktuelle Informationen.
Sie vermeidet Kampagnenästhetik, unnötige Effekte und den Eindruck einer Entwicklerdemo.

Die visuelle Richtung der Startseite übersetzt die bereitgestellte Referenz in das vorhandene
Portal: ein klarer Behördenkopf, eine bildgestützte Suche, kompakte Direkteinstiege, ein sichtbares
Hinweisband und geordnete Informationsbereiche. Inhalte und Funktionen bleiben dabei vollständig
aus den bestehenden Routen und dateibasierten Quellen abgeleitet.

## Stylesheet-Struktur

`src/styles/global.css` hält nur die stabile Importreihenfolge. Die Kaskade ist nach Verantwortung
gegliedert: `foundation.css` enthält Tokens, Basis-, Layout- und allgemeine Fachregeln,
`section-system.css` die Bereichsheros und lokale Orientierung, `portal-shell.css` Behördenkopf,
Serviceband und Footer, `home.css` die Startseite und `content-layout.css` die abschließende
Verdichtung gemeinsamer Inhaltsseiten. Responsive und druckspezifische Regeln bleiben jeweils bei
ihrem fachlichen Block; ihre Reihenfolge darf nicht ohne visuelle Regressionstests verändert werden.

Bei der Bereinigung am 19. Juli 2026 sank der Bestand von 6.257 Zeilen, 114.861 Byte und 982 Regeln
auf 5.759 Zeilen, 106.128 Byte und 900 Regeln. Entfernt wurden die nicht mehr erreichbaren alten
Header-Varianten, der ungenutzte Budget-Explorer sowie bytegleiche Deklarationsdubletten. Die
gemeinsamen Root-Regeln für `.page-header` und `.panel` besitzen jeweils eine Basisdefinition und
höchstens eine bewusst spätere Inhaltsseiten-Verfeinerung; responsive Varianten bleiben getrennt.

## Design-Tokens

Die zentralen Werte liegen als CSS Custom Properties in `src/styles/global.css`.

| Rolle | Wert | Verwendung |
| --- | --- | --- |
| Primärblau | `#173b6b` | Navigation, Links, primäre Orientierung |
| Dunkelblau | `#0a2547` | Hero, Serviceband, Footer |
| Sekundärgrün | `#2f7b3d` | ruhige Akzente und Status |
| Warnrot | `#8f2e2f` | ausschließlich Fehler-, Warn- und Gefahrensituationen |
| Gold | `#c39a3b` | sparsame Hervorhebung |
| Text | `#20312d` | Fließtext |
| Seitenfläche | `#edf1f0` | Seitenhintergrund |
| Oberfläche | `#fffffb` | Karten und Inhaltsflächen |
| Rahmen | `#c6d2cc` | Trennung und Gruppierung |

Ecken sind mit etwa 8 bis 14 Pixeln nur leicht gerundet. Schatten trennen Ebenen zurückhaltend;
Rahmen und Abstände tragen die Struktur. Farbverläufe und dekorative Großformen sind kein
Grundelement des Portals.

## Typografie

Das Portal verwendet Jost als lokal ausgelieferte Variable Font für Überschriften, Navigation und
Fließtext. Schriftgrößen sind responsiv begrenzt und lange Ressort- oder Amtsbezeichnungen dürfen
umbrechen.

- Überschriften sind kurz, sachlich und gut scannbar.
- Fließtext arbeitet mit gut lesbarer Zeilenhöhe und begrenzter Zeilenlänge.
- Karten verwenden keine unnötig kleinen Hilfstexte.
- Negative Laufweiten werden vermieden.
- Personenbezeichnungen verwenden einheitlich den Doppelpunkt.

## Layoutsystem

`BaseLayout.astro` kennt zwei Hauptvarianten:

- `contained` für Fach-, Rechts- und Inhaltsseiten mit einem begrenzten Hauptcontainer
- `full` für die Startseite mit vollbreiten Farbbändern und jeweils innen begrenzten Containern

Der maximale Inhaltscontainer ist 84 Rem breit. Vollbreite Bereiche behalten stets ausreichende
Innenabstände. Wiederholte Einheiten nutzen Grid oder strukturierte Listen; ganze Fachabschnitte
werden nicht ohne Grund in schwebende Karten verwandelt.

## Globaler Kopfbereich

Der gemeinsame Header besteht aus:

1. sichtbarer Simulations-Hinweisleiste,
2. Wortmarke mit Staatsflagge,
3. Hauptnavigation mit aktivem Zustand,
4. realer Portalsuche,
5. Einstiegen zu Leichter Sprache und Gebärdensprache.

Auf kleineren Bildschirmen bleiben Suche und Servicelinks direkt in der geöffneten
Menünavigation erreichbar. Das Menü verwendet native, tastaturbedienbare Elemente. Der Skip-Link
führt unmittelbar zum Hauptinhalt.

## Startseite

Die Startseite folgt einer festen Informationshierarchie:

1. Hero mit redaktionellem Staatskanzlei-Bild, H1 und Portalsuche
2. zentrale Portalpfade als kompakte Zugangskarten
3. wichtiges Hinweisband aus vorhandenen Inhalten
4. Presse, aktuelle Ministerien und Freistaat-Kurzprofil
5. Kreisreform als hervorgehobener Portalweg und weitere Themen
6. Recht, Haushalt, Regierungsprogramm, Karriere und weitere Serviceangebote
7. globales 115-Serviceband und Footer

Suchvorschläge, Karten, Hinweise und Listen verweisen ausschließlich auf vorhandene Seiten. Die
Direkteinstiege sind keine erfundenen Onlinedienste.

## Komponenten

Wiederkehrende Startseitenmuster liegen als kleine Astro-Komponenten unter
`src/components/portal/`:

- `PortalIcon.astro`: konsistentes, lokales SVG-Iconset
- `PortalAccessCard.astro`: zentrale Portalpfade
- `ImportantNoticeBand.astro`: kompakte wichtige Hinweise
- `HomePressList.astro`: aktuelle Presseinformationen
- `HomeMinistryList.astro`: aktuelle Ressortliste
- `FreestateSummary.astro`: Freistaat-Kurzprofil
- `ServiceBand.astro`: 115-, Kontakt-, Behördenfinder-, RSS- und Kalenderzugänge

Buttons, Links, Suchmasken und Karten besitzen gut erkennbare Hover- und Fokuszustände. Icons
ergänzen Text, ersetzen ihn aber nicht. Breadcrumbs, Tabellen, Definitionen und Listen bleiben die
bevorzugten Muster für Rechts- und Verwaltungsinhalte.

## Bilder

Bilder unterstützen Orientierung und Wiedererkennung. Die Startseite nutzt das vorhandene,
redaktionell nachgewiesene Staatskanzlei-Motiv mit AVIF-, WebP- und JPEG-Varianten. Ein dunkler
Overlay stellt die Lesbarkeit des Hero-Texts sicher.

- Bilder werden über absolute Pfade unter `/images/` referenziert.
- Responsive Varianten liegen unter `public/images/generated/`.
- Alternativtexte beschreiben den fachlichen Bildinhalt.
- Bildnachweise werden nur bei belastbarer Quelle ausgegeben.
- Ein-Pixel-Platzhalter werden nicht als sichtbare Pressebilder verwendet.
- Unterhalb des sichtbaren Einstiegs werden Bilder nach Möglichkeit verzögert geladen.

## Fach- und Rechtsseiten

Die Fassungsnavigation trennt die dauerhaften Hauptansichten „Vorschrift“,
„Normenhistorie“ und „Fassungsvergleich“ von den gespeicherten Fassungen. Die
Fassungen stehen in einem kompakten, ohne JavaScript bedienbaren
`details`-Wähler und sind nach geltend, historisch, zukünftig und ungeklärtem
Inkrafttreten gruppiert. Im Fassungsvergleich werden größere Änderungen
strukturell und satzweise als getrennte Blöcke „Bisher“ und „Neu“ dargestellt;
Ein-Wort-Wechsel sind nicht die Standarddarstellung.

Paragraphen- und Artikelüberschriften bleiben typografisch hervorgehoben.
Absatz-, Nummern- und Buchstabenkennzeichnungen gehören dagegen zum Fließtext
und verwenden normales Schriftgewicht bei fester Labelspalte.

Fachseiten verwenden denselben Kopf, dieselben Tokens und dieselbe Servicezone wie die
Startseite, behalten aber ihre inhaltlich geeigneten Strukturen. Das Rechtsportal priorisiert
Lesbarkeit, Gliederung, zitierfähige Normtexte und stabile Verlinkung. Verkündungen, Fundstellen und
Metadaten bleiben Listen, Tabellen oder Definitionen statt dekorativer Teaser.

Die Fassungsnavigation ist ein kompaktes, umbrechendes Linkband und kein Tab-Widget. Geltende,
zukünftige, historische und zeitlich ungeklärte Fassungen werden immer zusätzlich textlich
bezeichnet. Normtextwerkzeuge stehen unmittelbar vor dem Text. Paragraphen, Artikel und Anlagen
verwenden sprechende, deterministische Anker; kompatible alte Anker bleiben unsichtbare
Sprungziele. Einzeldruck und kopierbare Stellenlinks gehören zur jeweiligen Gliederungseinheit.

Fassungsvergleiche stellen Änderungen als gegliederte Liste dar. `ins` und `del`, Klartextlabels
und unterschiedliche Flächen ergänzen sich, sodass Farbe nie die einzige Unterscheidung ist.
Quellen- und Druckangebote bilden einen eigenen sachlichen Abschnitt unter dem Normtext.

Breite Tabellen und Fachgrafiken erhalten klar abgegrenzte Scrollbereiche. Ihre wesentlichen
Informationen müssen außerhalb der Tabelle oder Grafik zugänglich bleiben. Die Kreisreform-Suche
liefert ein Textergebnis ohne gestartete Karte; die Karte wird auf kleinen Bildschirmen nur nach
ausdrücklicher Freigabe geladen.

## Unterseiten und Bereichsidentitäten

Unterseiten folgen einer gemeinsamen, abgestuften Hierarchie: globaler Behördenkopf,
bereichsbezogener Einstieg, lokale Orientierung, fachlich passende Inhaltsmodule sowie das
gemeinsame Serviceband mit Footer. `SectionHero.astro` ersetzt die frühere universelle,
schwebende Kopfkarte auf den zentralen Seitenfamilien. Die Varianten `government`, `topics`,
`law`, `budget`, `reform`, `press`, `service`, `freestate` und `plain` verwenden denselben Aufbau
und unterscheiden sich nur durch zurückhaltende Akzentfarben, Medienanteil und fachliche
Zusatzinhalte.

- Staatsregierung nutzt Porträts, Leitung, Koalition und Ressortbezüge.
- Themen zeigen direkt nach dem Bereichskopf fachlichen Stand, Status, wichtigen Termin,
  Zuständigkeit, Beschlossenes, bereits Geltendes und den nächsten Schritt. Inhaltsspezifische
  Fragen-, Zeitstrahl-, Fakten- und Vergleichsmodule ergänzen diesen gemeinsamen Überblick.
- Recht stellt Suche, Rechtsstand und strukturierte Dokumente vor dekorative Flächen.
- Haushalt priorisiert Jahre, echte Kennzahlen, Vergleiche und Tabellen.
- Kreisreform beginnt mit der textlich nutzbaren Gebietssuche; die Karte bleibt nachgeordnet.
- Presse trennt redaktionelle Meldungen, Termine, Kontakt und Abonnements.
- Service gruppiert Kontakt, Orientierung, barrierearme Zugänge und rechtliche Informationen.
- Freistaat verbindet Grunddaten, staatliche Struktur und die zentralen Landesbereiche.

Normale Seitentitel verwenden ungefähr `clamp(2.2rem, 4vw, 3.25rem)`. Eine eigene Langtitelklasse
reduziert sehr lange Norm- und Ressorttitel und erlaubt sichere Umbrüche. Im Einstieg gibt es
höchstens eine primäre Aktion. Suche oder ein anderer primärer Arbeitsauftrag steht vor ergänzenden
Fakten und Aktionen.

## Lokale Navigation und Orientierung

`SectionNavigation.astro` bildet die gemeinsame Bereichs- und Ankernavigation. Sie bleibt ein
semantisches `nav` mit beschreibendem Label, echten Links und `aria-current`; sie täuscht keine
Registerkartensteuerung vor. Auf großen Bildschirmen ist sie kompakt horizontal angeordnet, auf
kleinen Bildschirmen bricht sie kontrolliert um. Dort wird sie nicht fixiert. Lange Themen- und
Fachseiten ergänzen Anker zu Überblick, inhaltsspezifischen Modulen, Rechtsgrundlagen, aktuellen
Bezügen, FAQ und Zuständigkeit. Das gemeinsame Themen-Briefing ersetzt mehrfach wiederholte
Teaser- und Statusabschnitte.

## Fakten, Status und wiederholte Einheiten

Kennzahlenkarten sind echten Zahlenwerten vorbehalten. Kurze Fakten stehen als Definitionen im
Bereichskopf oder in kompakten Faktenlisten; Statusangaben besitzen zusätzlich eine textliche
Bezeichnung. Navigationszugänge sind Links oder Servicemodule und werden nicht als Statistik
ausgegeben.

Karten bleiben wiederholten, gleichartigen Einheiten vorbehalten, etwa Personen, Themen oder
Servicezugängen. Ministerien werden als scanbares, datenbasiertes Verzeichnis dargestellt.
Inhaltsabschnitte verwenden vorrangig Typografie, Listen und gezielte Hintergrundgruppen. Grün und
Gold tragen normale Akzente; Rot ist Warnungen und kritischen Zuständen vorbehalten. Durchgehende
Trennlinien, große Schatten und lange Leerräume werden vermieden.

Die Themenübersicht gliedert sich in zeitlich begrenzte aktuelle Vorhaben, dauerhafte
Schwerpunkte und ein vollständiges, fachlich gruppiertes Verzeichnis. Startseite und Übersicht
verwenden dieselbe Hervorhebungslogik aus den Themendaten; es gibt keine zweite manuelle
Startseitenliste. Fachliche Daten aus dem Wissenshub und redaktionelle Sichtbarkeit bleiben durch
das Coverage-Register ausdrücklich voneinander getrennt.

## Personen und Bilder auf Unterseiten

Bei Regierungsmitgliedern bilden Porträt, Name, Amt, Ressort, Status und Kontakt einen gemeinsamen
Profilkopf. Ressortseiten verbinden Titel und Zuständigkeit mit einem vorhandenen Ressortbild oder
einem kompakten Kontaktzugang. Bilder besitzen stabile Seitenverhältnisse und verschwinden nicht
in leeren Spalten. Die Freistaat-Seite verwendet die vorhandene, 1920 Pixel breite Flagge und
formatoptimierte responsive Varianten bis 960 Pixel Breite. Für das 960 Pixel breite
Staatskanzlei-Hero liegt weiterhin kein größeres redaktionelles Original vor.

Bildnachweise gehören unmittelbar zur jeweiligen Medienfläche. `SectionHero.astro` gibt Bilder
mit belastbarem Nachweis als `figure` mit direkt zugeordnetem `figcaption` aus; der Alternativtext
beschreibt weiterhin unabhängig davon den Bildinhalt. Nachweise dürfen nicht als losgelöste Zeile
hinter einer Bereichsnavigation erscheinen. Die Beschriftung bleibt auf kleinen Bildschirmen
lesbar und verdeckt keine wesentlichen Bildinhalte.

Die Behördennummer 115 ist ein Orientierungsbegriff, kein automatisch angebotener Telefonweg.
Ihre Darstellung wird zentral konfiguriert und verweist auf den Kontaktbereich. Ein `tel:`-Link
wird nur ausgegeben, wenn ein direkter Telefonweg ausdrücklich konfiguriert ist. Angaben zu
Erreichbarkeiten dürfen nicht aus der bloßen Nummer abgeleitet werden.

## Responsive Verhalten

Die Gestaltung arbeitet inhaltlich mit vier Bereichen:

- großer Desktop: volle Hauptnavigation und mehrspaltige Startseitenmodule
- kleiner Desktop/Tablet quer: kompaktes Menü und reduzierte Spaltenzahl
- Tablet hoch: überwiegend zwei Spalten
- Smartphone: lineare Reihenfolge mit ausreichend großen Bedienzielen

Inhalte werden gestapelt, nicht abgeschnitten oder versteckt. Kein Seitenlayout darf einen
unkontrollierten horizontalen Dokumentüberlauf erzeugen. Tabellen dürfen in einem ausdrücklich
gekennzeichneten Detailbereich horizontal scrollen.

## Barrierefreiheit

- genau eine H1 pro Seite
- semantische Landmarken und nachvollziehbare Überschriftenfolge
- Skip-Link und deutlich sichtbarer Tastaturfokus
- `aria-current` für den aktiven Hauptnavigationspunkt
- beschriftete Suchfelder und verständliche Schaltflächen
- ausreichender Farbkontrast, auch auf Bildflächen
- Statusausgaben der Suche werden zugänglich angekündigt
- keine allein durch Farbe vermittelte Information
- Rücksicht auf reduzierte Bewegung und Druckausgabe

Automatisierte Tests ergänzen den manuellen Tastatur-, Zoom- und Screenreader-Kurztest.

## Qualitätssicherung

Die visuellen Baselines decken zentrale Seiten bei Smartphone-, Tablet- und Desktopbreiten ab.
Änderungen an Header, Startseite oder globalen Komponenten werden erst nach manueller Sichtprüfung
in die Baselines übernommen. Content-, Type-, Build-, Link-, Accessibility-, Browser- und
Overflow-Prüfungen bleiben Teil der Produktions-QA.

Ergänzend zu den vollständigen Seitenbaselines sichern kleine Locator-Screenshots wichtige
Module unterhalb des ersten Viewports. Dazu gehören unter anderem Ministeriumsverzeichnisse,
Profil- und Kontaktbereiche, Recherchewege, Rechtsstand, Haushaltskennzahlen, Reformzugänge,
Pressekontakt, barrierearme Zugänge sowie das globale Serviceband und der Footer. Die Tests
scrollen das jeweilige Modul kontrolliert in den sichtbaren Bereich und warten auf enthaltene
Bilder.

## Was vermieden wird

- Marketing-Heroes ohne Verwaltungsnutzen
- erfundene Bürgerdienste oder nicht vorhandene Kontenfunktionen
- starke Farbverläufe und dekorative Formen ohne Informationswert
- übertriebene Animationen
- öffentliche Texte mit technischen Architekturbegriffen
- wiederholte Erklärungen der politischen Simulation außerhalb der festgelegten Hinweise
- Layouts mit abgeschnittenen Inhalten oder ungeplantem horizontalem Scrollen
