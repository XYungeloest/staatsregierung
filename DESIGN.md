# Design-System: Freistaat Ostdeutschland

Dieses Dokument beschreibt die visuelle Leitlinie des Portals. Maßgeblich bleibt der tatsächliche CSS-Stand in `src/styles/global.css`; diese Datei erklärt die Absicht dahinter.

## Grundhaltung

Das Portal soll wie eine sachliche Regierungswebsite wirken: ruhig, belastbar, gut lesbar und ohne Demo- oder Kampagnencharakter. Die Gestaltung ordnet Inhalte, Zuständigkeiten und Rechtsinformationen, statt sich selbst in den Vordergrund zu stellen.

Prioritäten:

- klare Orientierung vor visueller Überraschung
- hoher Textkontrast und stabile Layouts
- nüchterne Amtsanmutung mit freundlicher, nicht dekorativer Farbigkeit
- wiedererkennbare Blau-Weiß-Grün-Anmutung
- barrierearme Interaktion mit sichtbaren Fokuszuständen
- keine Überläufe, abgeschnittenen Inhalte oder ungeplanten horizontalen Scrollbereiche

## Typografie

Das Portal verwendet Jost als lokale Variable Font. Sie wird in `src/styles/global.css` eingebunden und für Fließtext, Navigation und Überschriften genutzt.

Regeln:

- Überschriften knapp, sachlich und gut scannbar halten.
- Keine negativen Laufweiten verwenden.
- Lange Amts- und Ressortbezeichnungen müssen umbrechen dürfen.
- Hero-Größen nur für echte Seitenköpfe einsetzen, nicht in Karten oder Listen.
- Personenbezeichnungen mit Doppelpunkt schreiben, etwa `Bürger:innen` oder `Referent:in`.

## Farbpalette

Die aktuelle Palette ist bewusst gedämpft und behördennah:

- Primärblau: `#173b6b`
- Sekundärgrün: `#2f7b3d`
- Siegelrot: `#8f2e2f`
- Goldakzent: `#c39a3b`
- Text: `#20312d`
- Seitenhintergrund: `#edf1f0`
- Oberfläche: `#fffffb`
- Rahmen: `#c6d2cc`

Blau trägt Navigation, Rechtsbereich, primäre Aktionen und Orientierung. Grün setzt ruhige Akzente im allgemeinen Portal. Rot und Gold bleiben sparsam für hoheitliche Akzente, Hinweise und Statusmomente.

## Layout

Die Seiten arbeiten mit breiten Inhaltsbändern und begrenzten Innencontainern. Karten werden für wiederholte Einheiten genutzt, zum Beispiel Mitglieder, Presse, Stellen oder Datensätze. Ganze Seitenabschnitte sollen nicht wie schwebende Karten wirken.

Regeln:

- Informationsdichte darf behördlich-kompakt sein, solange Abstände und Zeilenlängen lesbar bleiben.
- Wiederholte Karten brauchen stabile Bild- und Textflächen, damit Listen nicht springen.
- Rechtsportal und Normseiten priorisieren Lesbarkeit, Gliederung und zitierfähige Struktur.
- Verkündungen, Fundstellen und Normmetadaten werden als Listen, Tabellen und Definitionen
  dargestellt, nicht als dekorative Teaserflächen.
- Mobile Layouts sollen Inhalte stapeln, nicht verstecken.
- Die Startseite ordnet den Einstieg in dieser Reihenfolge: klare Orientierung, Portalpfade,
  aktueller Stand, Reformen, Recht sowie Presse und Service. Sekundäre Einstiege folgen danach.
- Die Kreisreform ist als eigenständiger, sichtbarer Portalweg gestaltet. Auf großen Bildschirmen
  startet die Karte eng auf der Reformregion; auf kleinen Bildschirmen stehen Suche, Karten- und
  Tabellenzugang sowie Bezirk-Karten als gleichwertige Alternativen bereit.
- Große Karten und Detailtabellen dürfen ihren Inhalt nicht hinter einem Seitenüberlauf verstecken.
  Tabellen sind bei Bedarf als klar abgegrenzte Detailansicht horizontal scrollbar; die wichtigsten
  Informationen bleiben zusätzlich ohne Tabelle erreichbar.

## Bilder

Bilder unterstützen Orientierung und Wiedererkennung. Porträts, Ressortbilder und Pressebilder sollen nicht als schwere Originaldateien ausgeliefert werden, wenn eine webtaugliche Fassung ausreicht.

Regeln:

- Bilder unter `public/images/` mit absoluten Pfaden ab `/images/...` referenzieren.
- Porträts webtauglich komprimieren und in stabilen Seitenverhältnissen anzeigen.
- Alternativtexte in den JSON-Inhalten fachlich beschreibend pflegen.
- Bildnachweise nicht auslassen, wenn der Content-Typ sie vorsieht.

## Komponenten

Buttons, Links, Listen, Suchmasken und Karten bleiben zurückhaltend. Ecken sind leicht gerundet, Rahmen fein, Schatten schwach. Hover- und Fokuszustände dürfen deutlich sein, sollen aber keine Bewegung oder Effekte erzwingen.

Der Header verwendet die Staatsflagge als klar erkennbare, rahmenlose Bildmarke neben dem Wortzeichen.
Sie darf nicht durch zusätzliche Kästen, Doppelrahmen oder zu geringe Größe an Wirkung verlieren.

Die sichtbaren Hinweise zur politischen Simulation stehen in der oberen Hinweisleiste und im Footer.
Sie sind Teil der Seite, aber nicht Teil jedes Seitenkopfs oder Teasers.

Geeignete Muster:

- Breadcrumbs für tiefe Bereiche
- ein Skip-Link und klar sichtbare Fokuszustände für Navigation, Suche, Filter, Karte, Akkordeons
  und Dialoge
- Tabellen und strukturierte Listen für Rechts- und Verwaltungsinhalte
- Karten für wiederholte Teaser
- Tags nur, wenn sie beim Scannen helfen
- dezente Hinweisboxen für Status, Zuständigkeit oder Kontext
- klar unterschiedliche Zustände für Suche: noch keine Eingabe, Laden, Treffer, keine Treffer und Fehler

## Was vermieden wird

- Marketing-Heroes ohne Verwaltungsnutzen
- starke Farbverläufe als Hauptmotiv
- dekorative Formen ohne Informationswert
- übertriebene Animationen
- öffentliche Texte mit technischen Architekturbegriffen
- Layouts, die wie eine Entwicklerdemo oder ein Dashboard-Prototyp wirken
- Selbstbeschreibungen der Umsetzung, etwa Hinweise auf Platzhalter, Designabsichten oder technische
  Bereitstellung
