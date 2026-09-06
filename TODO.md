# Offene technische Arbeiten

Diese Liste enthält nur offene Aufgaben mit Fertigkriterium. Erledigtes wird entfernt, nicht
abgehakt; Git ist die Historie. Quellenlücken stehen in `CONTENT_GAPS.md`, benötigte externe
Zuarbeit in `docs/ZUARBEITSFORMULAR.md`, wiederkehrende Pflegeregeln in
`docs/DEPLOYMENT_RUNBOOK.md`.

## OstRecht

- [ ] Abgeleitete Metadaten der übernommenen Normen nachschärfen: Schlagwörter und Kurzfassungen
  der REVOSax-Baseline sind deterministisch aus Typ und Titel abgeleitet und im Import-Audit als
  `derivedMetadata` gekennzeichnet. Die Sachgebiete folgen der amtlichen Systematik;
  `derivedMetadata.subjects` zählt, wie viele Zuordnungen die Fundstellennummer belegt und wie
  viele aus der Ableitungskette stammen, die Zweifelsfälle stehen in
  `data/recht/subject-assignment-review.json`. Fertig, wenn redaktionell geprüfte Schlagwörter und
  Kurzfassungen vorliegen und die Kennzeichnung in `data/recht/revosax-import-audit/summary.json`
  entfällt.

## Staatsportal

Die Designprüfung des Staatsportals vom 6. September 2026 hat den Befund des Rechtsportals
gespiegelt: Die Tokenarbeit der Prüfung vom 4. September hat nur `law-portal.css` erreicht.

### Gestaltungssystem

- [ ] Abstände des Staatsportals auf die Tokenskala bringen: `var(--space-*)` steht 361-mal in
  `law-portal.css`, aber einmal in `home.css` und nie in `section-system.css`,
  `portal-shell.css`, `holdings.css` und `content-layout.css`. Diese fünf Dateien tragen 653 rohe
  rem-Werte in 118 verschiedenen Stufen (0,05 bis 3,8 rem in rund 90 Schritten); eine Seite wie
  `/haushalt/` zeigt daraus 14 verschiedene Rasterlücken (4, 5,6, 7,2, 8, 10,4, 12, 12,8, 13,6,
  16, 18,4, 20, 21,6, 44,8 px). Fertig, wenn Polster, Ränder und Lücken dieser Dateien aus
  `--space-*` kommen, der Stilwächter-Grenzwert `rawRem` von 638 auf unter 300 gesenkt ist und
  keine Seite mehr als vier verschiedene Rasterlücken zeigt.
- [ ] Farben des Staatsportals aus Tokens: Die Portal-Stylesheets enthalten 51 rohe Hexfarben in
  14 Werten, darunter eine ganze Goldfamilie (`#f1d58f`, `#e5d6ad`, `#d9c58d`, `#d4b063`,
  `#fffaf0`, `#f8efd8`, `#72530d`), obwohl das Fundament nur `--color-gold` und
  `--color-info-gold` kennt, sowie zwei Paare, die sich um drei Stufen unterscheiden (`#9bb8a2`
  gegen `#9bb79f`, `#a8bdd8` gegen `#9fb3ca`). Fertig, wenn die Goldfamilie als Tokens im
  Fundament steht, `#fff` durch `var(--color-surface)` ersetzt ist, die Beinahe-Dubletten
  zusammengeführt sind und der Stilwächter-Grenzwert `hexInBorderBackground` von 47 auf unter 15
  gesenkt ist.
- [ ] Eine Titelrolle je Seitentyp: Die Startseite setzt ihre H1 aus `--text-display`
  (höchstens 3,15 rem), Unterseiten aus `--text-title` (höchstens 3,25 rem); bei 1280 px ergibt
  das 50,4 px gegen 51,2 px für dieselbe Rolle, auf Themen-Detailseiten zusätzlich 40,96 px aus
  `--text-title-long`. Daneben stehen in `section-system.css` und `home.css` acht eigene
  `clamp()`-Schriftgrößen, die bei 1280 px 18,72, 19,2, 22,72, 24,8 und 25,6 px erzeugen — die
  Themenseite zeigt neun, die Themen-Detailseite elf verschiedene Schriftgrößen. Fertig, wenn
  `--text-display` und `--text-title` zu einem Token zusammengeführt sind, jede
  `clamp()`-Schriftgröße durch ein benanntes Token ersetzt ist und ein Test je Seitenfamilie
  höchstens sieben verschiedene Schriftgrößen findet.
- [ ] Fließtext nicht in `--text-xs` setzen: 13,12 px ist die häufigste Textgröße des Portals —
  auf der Startseite 48 Elemente, im Beteiligungsnavigator 329 (bei 320 px 404 Elemente unter
  13,5 px). Betroffen sind unter anderem die Beschreibungen der sieben Zugangskarten, also der
  wichtigste erklärende Text der Startseite. Fertig, wenn `--text-xs` nur noch Datum,
  Kennzeichnung und Randangaben trägt, Kartenbeschreibungen und Listentexte mindestens
  `--text-sm` verwenden und ein Test die kleinste Fließtextgröße je Seite festhält.
- [ ] Bedienelemente erben die Portalschrift nicht: Die beiden Suchknöpfe im Kopf setzen ihre
  Beschriftung „Suchen“ in Arial, weil `button` die Schriftfamilie nicht erbt und keine Regel sie
  setzt; ein `small` in `details.topic-more-references` fällt auf die Browsergröße 13,333 px
  zurück. Fertig, wenn `button, input, select, textarea` im Fundament `font: inherit` erhalten,
  `small` eine Tokengröße trägt und ein Test auf jeder geprüften Seite nur die drei Hausschriften
  sowie nur Größen aus der Skala findet.
- [ ] Zeilenlänge begrenzen: Fließtextabsätze laufen auf Themen-Detailseiten bis 94 Zeichen
  (689 px bei 16 px), auf der Startseite bis 86. Fertig, wenn Textspalten auf höchstens 75
  Zeichen begrenzt sind und `tests/visual.spec.ts` das je Seitenfamilie misst.

### Kopf, Ränder und Karten

- [ ] Hauptnavigation nicht schon bei 80 rem einklappen: `(max-width: 80rem)` blendet in
  `portal-shell.css` `.site-header__nav` und `.site-header__tools` mit `display: none !important`
  aus, also auch bei 1280 px. Die zehn Navigationspunkte brauchen zusammen 712 px, die Wortmarke
  363 px, und die Kopfspalte ist 1081 px breit — neben der Wortmarke bleiben 718 px leer, während
  die Navigation hinter „Menü“ verschwindet. Das Rechtsportal klappt seit der Abarbeitung erst
  bei 64 rem ein. Fertig, wenn Navigation und Kopfwerkzeuge des Staatsportals ebenfalls bis
  64 rem sichtbar bleiben, `!important` entfällt und ein Test bei 1024, 1100 und 1280 px
  sichtbare Navigationspunkte findet.
- [ ] Seitenrand mit der Breite wachsen lassen: `.container` setzt
  `width: min(calc(100% - 2rem), var(--content-width))`, also 16 px Rand bei jeder Breite; bei
  1280 px beginnt der Inhalt 16 px vom Fensterrand. Fertig, wenn der Seitenrand mit der
  Fensterbreite von `--space-4` auf mindestens `--space-6` wächst und `DESIGN.md` (Layoutsystem)
  den Wert nennt.
- [ ] Kartenpolster und Rasterlücken der Zugangskarten: `.portal-access-card` hat
  `padding: 1rem 0.75rem 1.8rem` — 12 px seitlich innen gegen 11,2 px Rasterlücke außen, unten
  fast das Doppelte von oben; die 13,12 px große Beschreibung steht zentriert über 278 px.
  Fertig, wenn das Polster symmetrisch aus Tokens kommt (mindestens `--space-4` seitlich), die
  Rasterlücke größer als das Innenpolster ist und mehrzeilige Kartentexte linksbündig stehen.
- [ ] Sieben Karten in einem Vier-Spalten-Raster: Die Zugangskarten der Startseite füllen vier
  Spalten und lassen in der zweiten Reihe einen Platz frei. Fertig, wenn die Spaltenzahl zur
  Kartenzahl passt (vier Spalten bei acht Karten, sonst drei) und `tests/visual.spec.ts` bei
  1280 px keine angebrochene letzte Reihe mit nur einem freien Platz findet.
- [ ] Rasterklassen halten, was ihr Name sagt: `.card-grid--two` erzeugt je nach Kartenzahl eine
  bis vier Spalten, `.card-grid--three` fünf; auf `/themen/` entstehen dadurch auf einer Seite
  Kartenbreiten von 237, 300, 405, 616 und 1248 px, und ein Themenbereich mit einer einzigen
  Karte wird zum Vollbreitenband. Fertig, wenn die Modifikatoren die Spaltenzahl festlegen, eine
  einzelne Karte die Spaltenbreite ihres Rasters behält und ein Test die Kartenbreiten je Seite
  auf höchstens zwei Werte prüft.
- [ ] Kartenkomponenten zusammenführen: Neun Komponenten (`EventCard`, `GovernmentMemberCard`,
  `JobOfferCard`, `MinistryCard`, `PortalAccessCard`, `PressReleaseCard`, `ServiceCard`,
  `SpeechCard`, `TopicCard`) bringen eigene Polster mit (1 rem, 1,15 rem, 1,25 rem,
  1 rem 0,75 rem 1,8 rem); `.topic-card` ist in `section-system.css` zweimal definiert (Zeile 370
  und 566), insgesamt gibt es acht mehrfach definierte Selektoren. Fertig, wenn eine Basisklasse
  Polster, Rahmen, Radius und Überschriftengröße trägt, die Komponenten nur noch ihren Inhalt
  bestimmen und keine Klasse mehr zweimal definiert ist.
- [ ] Ein Suchmuster statt vier: Kopfsuche (`.header-search`), Startseitensuche
  (`.home-hero-search`), Portalsuche (`.search-field`, `.search-form__primary`) und die Filter in
  neun Seiten und Komponenten sind vier getrennte Muster; zwei Regeln überschreiben den globalen
  Fokusring (`:focus-visible`, 3 px `--color-focus`) für Eingabefelder mit `:focus` und 2 px
  `--color-accent`, also auch beim Klicken mit der Maus. Fertig, wenn eine Filterleiste alle
  Such- und Filterformulare des Staatsportals trägt (Vorbild `DirectoryFilterBar` im
  Rechtsportal), es nur noch `:focus-visible`-Regeln gibt und der Fokuskontrasttest die
  Eingabefelder einschließt.

### Startseite und Seitenbänder

- [ ] Bänder trennen oder zusammenlegen: `home-important-section` endet mit `padding-bottom: 0`
  direkt am `home-information-section` mit `padding-top: 17,6 px`, beide auf `#f2f5f7` — zwischen
  beiden Bändern liegen null Pixel und keine Farbgrenze, sie lesen sich als ein Band. Die
  Bandpolster der Startseite lauten 23,2, 17,6 und 53,76 px. Fertig, wenn alle Bänder dasselbe
  Abstandstoken verwenden, gleichfarbige Nachbarbänder entweder zusammengelegt oder durch eine
  Linie getrennt sind und `DESIGN.md` (Startseite) den Bandabstand nennt.
- [ ] Kennzahlenkarten echten Zahlen vorbehalten: `DESIGN.md` verlangt das, aber `/freistaat/`
  zeigt drei von vier Karten mit Text („Dresden“, „7. Volkskammer“, „Erster Staatsrat“), der
  Beteiligungsnavigator „9 Träger + 2 Sondervermögen“ und „Erster Staatsrat“, die Startseite
  unter „Orientierung“ vier Textwerte. Fertig, wenn Kennzahlenkarten nur Zahlen mit Einheit
  tragen, Textangaben als Beschreibungsliste erscheinen und `content:check` oder ein
  Komponententest den Unterschied erzwingt.

### Portalsuche

- [ ] Portalinhalte in der Suche vor den Rechtsbestand stellen: „Haushalt“ liefert 433 Treffer,
  von denen alle 20 angezeigten aus dem Bereich Recht stammen und 14 „Haushaltsbegleitgesetz
  <Jahr>“ heißen; die Haushaltsseite des Portals steht nicht darunter. „Kreisreform“ liefert zwei
  Treffer, davon die Seite „Barrierefreiheit“ vor dem Thema „Kreis- und Bezirksreform 2026“.
  „Bildungsreform“ liefert vier Treffer, ohne die Schulsystemseite aus der Hauptnavigation.
  Fertig, wenn Treffer nach Bereichen gruppiert ausgegeben werden, Portalseiten vor Normen
  ranken, der Bereichsfilter Normen ausschließen kann und ein Test für „Haushalt“, „Kreisreform“
  und „Bildungsreform“ die jeweilige Portalseite unter den ersten drei Treffern findet.
- [ ] Suche über den Volltext statt nur über Titel: „Bildungsreform“ findet vier Einträge,
  obwohl Pressemitteilungen, Themenmodule und Reden den Begriff im Text führen. Fertig, wenn der
  Suchindex die Fließtexte der Portalseiten enthält, Treffer einen Textausschnitt mit der
  Fundstelle zeigen und ein Test einen nur im Text vorkommenden Begriff findet.

### Lange Seiten und Datenansichten

- [ ] Kreis- und Bezirkstabelle blättern: Die Tabelle der Kreise zeigt alle 101 Zeilen auf einmal
  (8.911 px bei 1280 px, 12.712 px bei 375 px in einem 356 px breiten Rollbereich mit einer
  608 px breiten Tabelle); die Seite ist dadurch 15.061 px lang, mobil 24.900 px. Der
  Beteiligungsnavigator blättert dieselbe Art Daten zu 25 Zeilen. Fertig, wenn beide Tabellen
  dieselbe serverseitige Blätterung verwenden, die Zeilenzahl je Seite genannt wird und die
  Kreisreformseite bei 375 px unter 8.000 px bleibt.
- [ ] Bereichsnavigation auf langen Seiten mitführen: `SectionNavigation` steht mit
  `position: static` am Seitenanfang und rollt weg; auf Seiten mit 13.000 bis 15.000 px Länge
  (Beteiligungsnavigator, Kreisreform) gibt es danach keine Orientierung mehr und keine
  Sprungmarken zu den Abschnitten. Fertig, wenn die Bereichsnavigation ab 64 rem klebend bleibt,
  Seiten über 4.000 px eine Abschnittsübersicht mit Sprungzielen führen und ein Test die
  Sprungziele gegen die `h2`-Folge prüft.

### Aufbau und Benennungen

- [ ] Übersichtsseite vollständig erzeugen: `/service/uebersicht/` führt 19 Links, davon elf in
  den Servicebereich, während die Sitemap 136 Seiten kennt (Presse 44, Staatsrat 34, Themen 24,
  Service 17, Freistaat 10, Haushalt 4). Fertig, wenn die Übersicht aus derselben Quelle wie
  `sitemap.xml` erzeugt wird, nach Bereichen gegliedert ist und ein Test die Zahl der verlinkten
  Seiten gegen die Sitemap prüft.
- [ ] Fehlerseite des Staatsportals auf eigene Zugänge stellen: Die 404-Seite bietet „Zur
  Rechtssuche“, „Zum alphabetischen Index“ und „Zu den Sachgebieten“ — drei Wege in das
  Rechtsportal — und nennt die Suche im Text, ohne ein Suchfeld anzubieten. Fertig, wenn die
  Fehlerseite ein Suchfeld und die Bereiche des Staatsportals führt und die Rechtsportalzugänge
  dort stehen, wo sie hingehören.
- [ ] Hauptnavigation nur mit Bereichen: Zwischen „Themen“ und „Recht“ steht „Schulsystem“
  (`/themen/bildung-und-schule/schulsystem/`), eine Detailseite auf der Ebene der acht Bereiche.
  Fertig, wenn die Hauptnavigation nur Bereichseinstiege führt und einzelne Themen über die
  Themenseite erreichbar bleiben.
- [ ] Bereichsname und Adresse in Übereinstimmung bringen: Der Navigationspunkt heißt „Staatsrat“
  und führt auf `/staatsregierung/`; Seitentitel, Brotkrume und Kennzahlenkarte verwenden
  „Staatsrat“ als Organ und als Bereichsnamen zugleich, der Seitentitelzusatz lautet auf jeder
  Seite „Staatsrat des Ostdeutschen Freistaates“. Fertig, wenn Bereichsname, Adresse, Brotkrume
  und Titelzusatz aus einer Quelle in `packages/shared/src/config/site.ts` stammen und ein Test
  sie gegeneinander prüft.
- [ ] Eine Wortliste für Stände und Daten: Dasselbe Feld heißt „Fachstand“ (Themenkarten),
  „Stand“ (Themenseite), „Datenstand“ und „Ausgangsstichtag“ (Beteiligungsnavigator) und
  „Rechtsstand“ (Rechtsportal). Fertig, wenn die Begriffe in
  `packages/shared/src/config/site.ts` festgelegt sind, alle Karten und Kopfbereiche sie
  verwenden und ein Test die verwendeten Wörter gegen die Liste prüft.
- [ ] Themenübersicht ohne Dubletten und ohne leeres Statusabzeichen: `/themen/` zeigt 29 Karten
  für 21 Themen — die sieben Schwerpunkte erscheinen unter „Schwerpunkte“ und noch einmal unter
  „Alle Themen“ —, und 27 der 29 Abzeichen lauten „In Umsetzung“, zwei „Geplant“. Fertig, wenn
  jedes Thema genau einmal in der Vollübersicht steht (Schwerpunkte als Verweis darauf) und das
  Statusabzeichen entweder differenziert (etwa „beschlossen“, „in Kraft“, „in Umsetzung“,
  „geplant“) oder entfällt.

## Schriften

- [ ] Wegweiserschrift als woff2 ausliefern: `OstGrotesk-Regular.woff` und `OstGrotesk-Bold.woff`
  liegen als woff (zlib) vor, weil in der Bauumgebung kein `brotli` verfügbar war. Fertig, wenn
  beide Schnitte als woff2 erzeugt sind (`scripts/build-sign-font.py` mit der Endung `.woff2`),
  `@font-face` und der Preload in `PageHead.astro` das Format nennen und die Gesamtübertragung
  der Schriften in `DESIGN.md` und `assets/fonts/README.md` fortgeschrieben ist.

## Sitzungsmediathek der Volkskammer

Große Audio- oder Videodateien dürfen weder unter `public/` (Workers Static Assets: 25 MiB je
Datei) noch als Git-Blob in einen Pull Request gelangen; die Medien-CSP lässt nur die eigene Origin
zu. Die Mediathek betrifft zunächst aufgezeichnete öffentliche Sitzungen, keinen Livebetrieb. Die
benötigten Entscheidungen und Unterlagen stehen in `docs/ZUARBEITSFORMULAR.md` (Abschnitt M).

- [ ] Fachlichen Auftrag mit der Volkskammer festlegen (Redaktion, Öffentlichkeit, Formate,
  Download, Aufbewahrung, Depublikation, Volumen). Fertig, wenn Abschnitt M des
  Zuarbeitsformulars ausgefüllt vorliegt.
- [ ] Architekturentscheidung mit Kostenprobe für Cloudflare Stream (Video), R2 (Audio, Downloads)
  und eine externe Plattform; monatliches Kostenlimit und Warnschwellen. Fertig, wenn die
  Entscheidung samt Kostenprobe im Deployment-Runbook dokumentiert ist.
- [ ] Validiertes Contentmodell unter `content/volkskammer/sitzungen/` (Metadaten in Git,
  Binärdaten nur im Mediendienst; Stream-UID bzw. R2-Schlüssel, Prüfsumme, Dauer und
  Verarbeitungsstatus als Referenzen). Fertig, wenn Schema, `content:check` und `CONTENT.md` das
  Modell tragen.
- [ ] Portalbereich `/volkskammer/sitzungen/` mit barrierearmem Player (kein Autoplay,
  Tastaturbedienung, Untertitel/Transkript als Veröffentlichungsvoraussetzung), geschütztem
  Uploadablauf (kurzlebige Einmal-URLs, resumierbare Uploads, serverseitige Validierung),
  R2-Custom-Domain statt `r2.dev`, minimalen CSP-Anpassungen ohne Wildcards sowie Tests für
  Schema, Suche, Sitemap, Wiedergabe und Barrierefreiheit. Fertig, wenn eine längere öffentliche
  Sitzung als Pilot veröffentlicht, gemessen und abgenommen ist.
