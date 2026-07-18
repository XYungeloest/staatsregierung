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

## Design-Tokens

Die zentralen Werte liegen als CSS Custom Properties in `src/styles/global.css`.

| Rolle | Wert | Verwendung |
| --- | --- | --- |
| Primärblau | `#173b6b` | Navigation, Links, primäre Orientierung |
| Dunkelblau | `#0a2547` | Hero, Serviceband, Footer |
| Sekundärgrün | `#2f7b3d` | ruhige Akzente und Status |
| Siegelrot | `#8f2e2f` | hoheitliche und dringliche Akzente |
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

Fachseiten verwenden denselben Kopf, dieselben Tokens und dieselbe Servicezone wie die
Startseite, behalten aber ihre inhaltlich geeigneten Strukturen. Das Rechtsportal priorisiert
Lesbarkeit, Gliederung, zitierfähige Normtexte und stabile Verlinkung. Verkündungen, Fundstellen und
Metadaten bleiben Listen, Tabellen oder Definitionen statt dekorativer Teaser.

Breite Tabellen und Fachgrafiken erhalten klar abgegrenzte Scrollbereiche. Ihre wesentlichen
Informationen müssen außerhalb der Tabelle oder Grafik zugänglich bleiben. Die Kreisreform-Suche
liefert ein Textergebnis ohne gestartete Karte; die Karte wird auf kleinen Bildschirmen nur nach
ausdrücklicher Freigabe geladen.

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

## Was vermieden wird

- Marketing-Heroes ohne Verwaltungsnutzen
- erfundene Bürgerdienste oder nicht vorhandene Kontenfunktionen
- starke Farbverläufe und dekorative Formen ohne Informationswert
- übertriebene Animationen
- öffentliche Texte mit technischen Architekturbegriffen
- wiederholte Erklärungen der politischen Simulation außerhalb der festgelegten Hinweise
- Layouts mit abgeschnittenen Inhalten oder ungeplantem horizontalem Scrollen
