# Design-System: Freistaat Ostdeutschland und OstRecht

Dieses Dokument beschreibt den gestalterischen Ist-Zustand beider öffentlichen Anwendungen und dient
als Prüfmaßstab. Maßgeblich sind die Stylesheets unter `packages/shared/src/styles/`, die Tokens in
`foundation.css` und die Tests unter `tests/`; jede Angabe hier ist dort nachweisbar. Was sich ändert,
wird hier geändert, nicht als „früher“ ergänzt – die Historie liegt in Git.

## Grundhaltung

Beide Portale wirken wie eine sachliche Regierungswebsite: ruhig, verlässlich, verständlich und
barrierearm. Die Gestaltung priorisiert Orientierung, Zuständigkeiten und aktuelle Informationen und
vermeidet Kampagnenästhetik, Effekte und den Eindruck einer Entwicklerdemo. Inhalte und Funktionen
bleiben vollständig aus den bestehenden Routen und dateibasierten Quellen abgeleitet.

## Stylesheet-Struktur

`packages/shared/src/styles/global.css` hält nur die Importreihenfolge: `foundation.css` (Tokens,
Basis-, Layout- und allgemeine Fachregeln), `section-system.css` (Bereichsköpfe und lokale
Orientierung), `portal-shell.css` (Behördenkopf, Serviceband, Footer), `home.css` (Startseite des
Staatsportals), `content-layout.css` (Verdichtung gemeinsamer Inhaltsseiten), `holdings.css`
(Beteiligungsseiten) und zuletzt `law-portal.css` (OstRecht-Shell, Verzeichnisse, Suche,
Normdarstellung). Responsive und druckspezifische Regeln bleiben bei ihrem fachlichen Block; ihre
Reihenfolge darf nicht ohne visuelle Regressionstests verändert werden.

Je Selektor gibt es außerhalb von Media Queries eine Definition. Zulässig ist eine Gruppenregel mit
unmittelbar folgender Verfeinerung desselben Selektors; zwei konkurrierende Stände sind es nicht.
Größen, Abstände, Radien und Farben kommen aus den Tokens unten. Ein Einzelwert neben der Skala ist
ein Hinweis auf eine fehlende Stufe: dann wird die Stufe ergänzt und im Commit begründet, nicht der
Einzelwert behalten.

## Design-Tokens

Die Tokens liegen in `foundation.css` unter `:root`; OstRecht überschreibt einzelne davon in
`law-portal.css` unter `.law-site`. Die Tabelle nennt Tokens und Rollen, keine Werte – die Werte
stehen im Stylesheet.

| Rolle | Token | Verwendung |
| --- | --- | --- |
| Seitenfläche | `--color-page`, `--color-page-deep` | Seitenhintergrund, abgesetzte Bänder |
| Oberflächen | `--color-surface`, `--color-surface-alt`, `--color-surface-muted` | Karten, Formulare, ruhige Flächen |
| Rahmen (genau drei) | `--color-border-soft`, `--color-border`, `--color-border-strong` | Innentrenner, Gruppierung, Abgrenzung |
| Text | `--color-text`, `--color-text-muted`, `--color-heading` (= `--color-ink`) | Fließtext, Nebentext, Überschriften |
| Primär und Akzent | `--color-primary`, `--color-primary-hover`, `--color-accent`, `--color-accent-hover`, `--color-accent-soft` | Links, Knöpfe, aktive Zustände; im Rechtsportal zeigt `--color-accent` auf `--law-blue` |
| OstRecht-Marke | `--law-blue`, `--law-blue-dark`, `--law-blue-light`, `--law-green`, `--law-red` | Kopf, Hinweisleiste, Servicekarte, Statusflächen |
| Sekundärgrün | `--color-secondary`, `--color-secondary-hover` | ruhige Akzente, geltende Fassungen, Einfügungen |
| Warnrot | `--color-seal`, `--color-seal-hover` (Rechtsportal `--law-red`) | Aufhebung, Fehler, Warnungen (siehe Farbrollen) |
| Gold | `--color-gold` | aktiver Navigationspunkt, Oberrand der Leitkarte |
| Informationsflächen | `--color-info-blue`, `--color-info-green`, `--color-info-gold` | Hinweise, Status, künftige und entfallene Fassungen |
| Fokus | `--color-focus`, `--focus-ring`, `--focus-halo` | Umriss, weißer Schein, Vererbung an dunkle Flächen |
| Hinweisleiste | `--color-banner` | Simulationshinweis des Staatsportals |
| Schatten | `--shadow-soft`, `--shadow-card` | Ebenentrennung, sparsam |
| Radien | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill` | 0,5 / 0,75 / 0,875 rem; Pillen ein Idiom |
| Breiten | `--content-width` (Staatsportal 84 rem, OstRecht 96 rem), `--content-width-narrow`, `--space-section` | Inhaltscontainer, Lesespalte, Abstand zwischen Bändern |

Hexwerte stehen nur in den Token-Definitionen und als `#fff`, wo reines Weiß gemeint ist; Rahmen- und
Flächenfarben kommen ausschließlich aus Tokens. Rahmen und Abstände tragen die Struktur, Schatten
trennen Ebenen zurückhaltend. Farbverläufe gibt es nur noch am Fußbereich und an der Servicekarte
des Rechtsportals, wo keine Kleinschrift darüber liegt; dekorative Großformen gibt es nicht.

## Typografie

### Schriften

Beide Familien werden lokal aus `packages/shared/src/assets/fonts/` als untersetzte woff2
ausgeliefert (Zeichenumfang, Werkzeuge und Kommandos: `README.md` im selben Ordner):

| Datei | Familie | Achsen | Größe | Rolle |
| --- | --- | --- | --- | --- |
| `Jost-Variable.woff2` | Jost (OFL) | wght 100–900 | 34 KB | Oberfläche beider Portale |
| `SourceSerif4Variable-Roman.woff2` | Source Serif 4 (Adobe, OFL) | wght 400–700, opsz 12–48 | 86 KB | Dokument im Rechtsportal |

Budget für die gesamte Schriftübertragung: 270 KB; Stand 120 KB. Keine Kursive (der Bestand enthält
keine). `font-display: swap`. `PageHead.astro` lädt Jost auf jeder Seite vor; in jeder Messung (lokal
und gegen die Produktion auf Cloudflare, bis Slow 3G) war Jost vor dem ersten Anstrich fertig, deshalb
folgt auf Jost direkt `system-ui`, ohne Rückfallschnitt. Source Serif 4 wird nur auf den Normseiten
vorgeladen (`documentFont`) und kommt dort bei Fast 3G rund 170 ms, bei Slow 3G rund 1 s nach dem
ersten Anstrich; bis dahin setzt ein metrikangeglichener Rückfallschnitt je Plattformfamilie (Georgia
für Windows, macOS und iOS; Noto Serif für Android; DejaVu Serif und Liberation Serif für Linux) mit im
Browser gemessenen `size-adjust`- und Override-Werten (Herleitung, Zahlen und Messskript: `README.md`
im Schriftordner). Die Optical-Size-Achse folgt der Schriftgröße automatisch.

Tokens: `--font-sans` (Jost), `--font-display` (Alias von `--font-sans`), `--font-document`
(Source Serif 4). Der Wechsel der Dokumentschrift ist eine Änderung an `--font-document`.
Systemschriften kommen nur als Rückfall vor.

### Rollen

Die Serife trägt das Dokument, Jost die Oberfläche – nicht „Serife für Überschriften“.

- Serife (`--font-document`): der Vorschriftentext (`#normtext`) samt Absätzen, Nummern, Buchstaben,
  Tabellen und Anlagen; die Gliederungsüberschriften darin einschließlich der kleinen Nummernzeile
  („I. Abschnitt“, „Artikel 1“); die H1 des Normkopfs in allen vier Normansichten; der verglichene
  Text und seine Überschriften im Fassungsvergleich; das Vollzitat.
- Jost (`--font-sans`): alles Übrige – Wortmarke, Navigation, Brotkrume, Fußbereich, alle übrigen
  Seitentitel, Verzeichnisse und Trefferlisten einschließlich der Normtitel darin, Filter, Formulare,
  Knöpfe, Etiketten, Badges, Statuszeilen, Metadaten, Fundstellen, Kennzahlen.
- Grenzfälle: die Werkzeuge vor dem Text und je Einheit sowie die Überschrift „Vorschriftentext“
  sind Oberfläche (Jost), obwohl sie im Dokumentbereich stehen; die Spaltenlabels „Fassung vom …“ des
  Vergleichs sind Jost, der verglichene Text darunter Serife.

### Skalen

Typoskala (`foundation.css`): `--text-2xs` 0,72 rem (11,52 px), `--text-xs` 0,82 (13,12),
`--text-sm` 0,92 (14,72), `--text-base` 1 (16), `--text-base-plus` 1,0625 (17), `--text-md` 1,15
(18,4), `--text-lg` 1,3 (20,8), `--text-lg-plus` 1,5 (24), `--text-xl` 1,75 (28). Begründete
Zusatzstufen: `--text-base-plus` für Kartentitel (zwischen 16 und 18,4 px), `--text-lg-plus` für die
Abschnitts-H2 des Staatsportals (sonst 20,8 px). Die kleinste Stufe trägt Wortmarken-Untertitel und
Kennzahl-Etiketten, nie Navigations- oder Listeneinträge: die Inhaltsübersicht der Normseite steht
mindestens in `--text-sm`, ihre Gliederungszeichen mindestens in `--text-xs`
(`tests/stilwaechter.test.ts` hält beide Untergrenzen fest).

Titelstufen, eine je Seitenfamilie in beiden Portalen: `--text-display` für den Startseiten-Hero,
`--text-title` für Bereichs-, Such- und Hilfeseiten, `--text-title-long` für Langtitel (Normseiten,
Rechtsentwicklung, Personen, Beteiligungen). Alle drei sind `clamp()`-Ausdrücke (bei 1440 px:
50,4 / 52 / 42,4 px).

Zeilenhöhen ausschließlich aus vier Tokens: `--lh-display` 1,12 (Titel), `--lh-heading` 1,28
(Überschriften), `--lh-compact` 1,45 (Etiketten, Menü- und Bedienzeilen), `--lh-body` 1,65
(Lesetext). Ausnahme ist `line-height: 1` auf Aufklappzeichen (`::before`/`::after`), der Wortmarke
und dem Symbolknopf der Einheitenwerkzeuge – Geometrie, keine Typografie.

Normtext: 16 px, `max-width: 72ch` (in der Serife rund 70 Zeichen je Zeile), Zeilenhöhe 1,65.
Lange Ressort-, Amts- und Normtitel dürfen umbrechen; negative Laufweiten kommen nicht vor;
Personenbezeichnungen verwenden den Doppelpunkt.

## Abstände und Radien

Abstandsskala: `--space-hairline` 2 px, `--space-1` 4, `--space-xs` 6, `--space-2` 8, `--space-3` 12,
`--space-4` 16, `--space-5` 24, `--space-6` 32, `--space-7` 48, `--space-8` 64. `--space-hairline` und
`--space-xs` sind ergänzte Zwischenstufen für Haarabstände und die häufigen 6-px-Lücken.
`--space-section` (`clamp(2.5rem, 5vw, 4.5rem)`) trennt die Bänder einer Seite. Radien nur aus
`--radius-sm`, `--radius-md`, `--radius-lg` und `--radius-pill`.

## Layoutsystem

Das Staatsportal verwendet `apps/portal/src/layouts/BaseLayout.astro` mit den Hauptvarianten
`contained` (begrenzter Hauptcontainer) und `full` (vollbreite Bänder mit innen begrenzten
Containern). OstRecht verwendet `apps/recht/src/layouts/LawLayout.astro` mit denselben Varianten;
es teilt Tokens, Schriften, Skip-Link, Fokusregeln und die Normkomponenten, kontrolliert aber Kopf,
Wortmarke, Navigation, Suche, Brotkrume und Fußbereich selbst. Wiederholte Einheiten nutzen Grid oder
strukturierte Listen; Fachabschnitte werden nicht ohne Grund zu schwebenden Karten.

## Kopfbereiche

Der Kopf des Staatsportals besteht aus Simulations-Hinweisleiste, Wortmarke mit Staatsflagge,
Hauptnavigation mit `aria-current`, Portalsuche und den Einstiegen zu Leichter Sprache und
Gebärdensprache. Ab 80 rem Breite wandern Navigation, Suche und Servicelinks gemeinsam in das native,
tastaturbedienbare Menü.

OstRecht führt eine dunkle Hinweisleiste (`.law-notice`), die Wortmarke „OstRecht – Rechtsportal des
Ostdeutschen Freistaates“, die Hauptnavigation zu Gesetzen, Verordnungen, Verwaltungsvorschriften,
Verfassung, Verkündungen und Sachgebieten, ein kompaktes Suchfeld und die Servicewege
Barrierefreiheit und Staatsportal. Verkündungen bleiben ein eigener Navigationspunkt. Politische
Teaser- und Pressenavigation gehören nicht in diese Navigation.

Der OstRecht-Kopf kennt drei Stufen. Über 80 rem steht alles in einer Zeile. Zwischen 64 und 80 rem
wird der Kopf zweizeilig: Wortmarke, Suchfeld und Servicewege bleiben oben, die sieben
Navigationspunkte stehen darunter als eigene Zeile mit Trennlinie und 2,75 rem hohen Zielen.
Erst ab 64 rem abwärts weichen Servicewege und Navigationsliste gemeinsam in das Menü. Die Höhe der
haftenden Kopfleiste steht als `--law-header-offset` auf `.law-site` (6,5 rem, in der zweizeiligen
Stufe 8,75 rem); alle haftenden Seitenspalten setzen dort an, statt die Höhe zu wiederholen.

## Responsives Verhalten

Es gibt vier Breakpoints, alle als `max-width` in rem: **80 rem**, **64 rem**, **48 rem**, **30 rem**.

- bis 80 rem (kleiner Desktop): im Rechtsportal wird der Kopf zweizeilig – Wortmarke, Suchfeld und
  Servicewege oben, die Navigationsliste als zweite Zeile; das Menü bleibt geschlossen. Das Band der
  Startseite geht auf zwei Spalten, die Funktionskarte nimmt die volle Breite. Der
  Normarbeitsbereich bleibt zweispaltig: die haftende Inhaltsübersicht neben dem Text, die
  Vorschriftendaten darunter über beide Spalten als Aufklappbereich „Angaben zur Vorschrift“.
- bis 64 rem (Tablet quer): Servicewege und Navigationsliste stehen im geöffneten Menü, die Suche
  bleibt im Kopf; der Schnellzugriff geht auf drei Spalten (3 + 2, keine allein stehende Karte);
  Normarbeitsbereich und Startseitenbänder werden einspaltig, die Inhaltsübersicht wird zum
  nativen Aufklappbereich.
- bis 48 rem (Tablet hoch): Verzeichniseinträge, Filterleisten und Formularzeilen stapeln sich; die
  Werkzeuge je Einheit sind dauerhaft sichtbar und tragen ihre Beschriftung. Die beiden
  Aufklappzeilen „Angaben zur Vorschrift“ und „Inhalt der Vorschrift“ stehen nebeneinander über dem
  Text; die geöffnete nimmt die volle Breite. Die Werkzeugleiste des Normkopfs rollt waagerecht.
- bis 30 rem (Smartphone): auch die Kopfsuche weicht in das Menü, dort bleibt sie erreichbar;
  Kacheln werden einspaltig; Normtitel und Fassungswahl rücken eine Stufe zusammen.

Inhalte werden gestapelt, nicht abgeschnitten oder versteckt. Kein Seitenlayout erzeugt
horizontalen Dokumentüberlauf (geprüft bei 375, 768, 1024, 1100, 1280 und 1440 px). Tabellen dürfen
nur in einem gekennzeichneten Scrollbereich (`.table-wrap`) horizontal rollen; ihre wesentlichen
Informationen bleiben außerhalb zugänglich.

## Farbrollen

- Rot: Im Rechtsportal ausschließlich Aufhebung (`--law-red` an `.norm-history__event--repeal`),
  Fehler und Warnungen; aktiver Navigationspunkt, Fokus und Hilfe-Nummern tragen kein Rot. Im
  Staatsportal ist `--color-seal` die Warnfarbe für Hinweise und Warnungen; darüber hinaus steht sie
  in `foundation.css` noch an Zeitstrahl-Markern, dem Aufklappzeichen der FAQ, den Trennern der
  Brotkrume, dem Startseiten-Hinweis und der Reform-Karte – das sind die einzigen nicht warnenden
  Rotstellen.
- Gold: aktiver Punkt der Hauptnavigation in beiden Portalen (`aria-current="page"`), Oberrand
  der Leitkarte der Startseite, Informationsfläche `--color-info-gold`.
- Grün: Sekundärakzent, geltende Fassungen, Einfügungen im Vergleich (`ins` auf
  `--color-info-green`).
- Fokus: `--color-focus` ist in beiden Portalen dieselbe Farbe; der Umriss ist 3 px breit mit 2 px
  Versatz. In zusammengesetzten Bedienelementen, in denen der Umriss sonst auf einem dunklen Nachbarn
  läge (Kopfsuchfelder, Auswahlfelder der Suchpillen, Servicelinks), liegt er innen
  (`outline-offset: -3px`). Der weiße Fokusschein ist das vererbte Token `--focus-halo`: dunkle
  Flächen und Bedienelemente setzen es auf `var(--focus-ring)` (Serviceband, Fußzeilen,
  Hinweisleiste, Startseiten-Hero, Leitkarte, Servicekarte, Vergleichskopf, Sprunglink sowie
  Hauptnavigation und Menüknopf des Rechtsportals, die bis an die Hinweisleiste reichen). Der Test
  „Fokusindikator hebt sich von seiner Bezugsfläche ab“ in `tests/accessibility.spec.ts` fährt auf
  sechs Seiten beider Portale jedes fokussierbare Element an und verlangt mindestens 3 : 1 gegen die
  Fläche, auf der der Umriss tatsächlich liegt.
- Farbe ist nie die einzige Unterscheidung: jede Statusklasse trägt Text.

## Seitenfamilien des Rechtsportals

### Verzeichnisse

Gesetze, Verordnungen, Verwaltungsvorschriften, Förderrichtlinien, Verkündungen, Sachgebiete und
A–Z verwenden dieselben Bausteine aus `apps/recht/src/components/directory/`:

- `DirectoryEntry.astro`: links das beschriftete Datum („Rechtsstand“ bei Vorschriften, „Ausgabe
  vom“ bei Ausgaben, „Verkündet am“ bei Einträgen), Mitte die Überschrift aus `getNormTitleBlock`
  (Kurztitel mit der echten Abkürzung, darunter der Langtitel in gedämpfter Schrift) mit
  Kurzbeschreibung, rechts Fakten als Definitionsliste, darunter die Badgezeile (Normtyp,
  Rechtsherkunft). Die Beschreibung ist die redaktionelle Zusammenfassung; fehlt sie, steht dort
  die Kurzform des Vollzitats („Vom 4. Dezember 1997 (OGVBl. S. 684)“). Der Fakt „Geltung“ trägt
  das Wort der Wortliste. Verkündungen zeigen die Herkunft der verkündeten Vorschriften.
- `DirectoryFilterBar.astro`: Auto-Fit-Raster, Aktionen an derselben Stelle, „Zurücksetzen“ immer
  vorhanden und ohne aktiven Filter ausgegraut (`aria-disabled`), die Ergebniszahl unter der Leiste;
  der Bereichskopf nennt keine Bestandszahl mehr.
- `LetterNav.astro`: Sprungnavigation mit allen 27 Buchstabengruppen, unbelegte sichtbar inaktiv.

Die Sachgebietsübersicht zeigt die amtliche Systematik: acht nummerierte Hauptgruppen mit
Beschreibung, darunter ihre nummerierten Sachgebiete mit Vorschriftenzahl; Sachgebiete ohne
Vorschriften erscheinen nicht. Die Sachgebietsseite nennt die Nummer im Eyebrow („Sachgebiet 71“)
und die Hauptgruppe in der Einleitung. Filter, Facetten und Kennzeichnungen tragen Nummer und
Kurzform („71 Bildungswesen“), die vollständige amtliche Bezeichnung steht auf Übersicht und
Sachgebietsseite; der gespeicherte Wert bleibt die amtliche Bezeichnung.
- `DirectoryPagination.astro`: serverseitige Seiten zu 50 Einträgen (`DEFAULT_PAGE_SIZE`) in allen
  Verzeichnissen; im A–Z stehen Vorschriften, Stichwörter und Abkürzungen je zu 50
  (`KEYWORD_PAGE_SIZE`) mit den unabhängigen Parametern `seite`, `stichwortseite` und
  `abkuerzungsseite`.

Filter und Seiten laufen über GET-Parameter mit kanonischer Adresse; Seiten mit aktiven Filtern
tragen `noindex`. Verkündungen filtern ihre Metadatentabelle im Speicher, folgen aber demselben
Adress- und Seitenmuster.

Verkündungen führen Ausgaben und Einträge in einer Seite. Ein Ansichtswechsel
(`<nav class="law-view-switch" aria-label="Ansicht">`, zwei gleichwertige Links mit
`aria-current="page"`) schaltet zwischen „Ausgaben“ und „Einträge“ (`ansicht=eintraege`); Filter,
Jahrgangsleiste und Ergebniszahl gelten für beide Ansichten, beide beginnen mit der jüngsten
Ausgabe. `/fundstellen/` ist eine dauerhafte Weiterleitung auf die Ansicht „Einträge“.

Förderrichtlinien haben keine Buchstabenleiste, sondern die zehn amtlichen Förderbereiche: der
Seitenkopf nennt Bestand und geltende Richtlinien, darunter stehen die belegten Förderbereiche als
Sprungziele mit Zahl, danach je Förderbereich ein Abschnitt `<section class="directory"
id="bereich-55x">` mit den gemeinsamen Einträgen. Der Filter kennt zusätzlich den Förderbereich;
ohne Auswahl zeigt jeder Abschnitt höchstens eine Seite und verweist auf den vollständigen Bereich.

Die Rechtsentwicklung ist keine eigene Übersicht mehr: Herkunft, Normtyp, Sachgebiet und Geltung
sind Filter der Rechtssuche. Die Herkunftszahlen des Bestands stehen als Kachelreihe
(`.law-origin-overview`) über der Trefferliste; `/rechtsentwicklung/` leitet mit denselben
Parameternamen dorthin weiter.

### Grundmenge und Bestandszahl

Verzeichnisse, A–Z, Sachgebiete, Bestandszahlen und die Standardsuche beschreiben dieselbe
Grundmenge: alle Vorschriften außer den aus dem sächsischen Rechtsstand übernommenen
Änderungsvorschriften (`packages/shared/src/lib/norms/inventory.ts`, projizierte Spalte
`law_norms.in_inventory`). Übernommene Änderungsakte sind historische Änderungsträger, keine
gleichrangigen Stammnormen; erreichbar bleiben sie über den Normtypfilter „Änderungsvorschrift“,
das Auswahlfeld „Übernommene Änderungsvorschriften“ (`aenderungen=uebernommen`) in A–Z und
Sachgebietsseiten sowie über die Beziehungen der geänderten Vorschrift. Die Verzeichnisse der
Gesetze, Verordnungen, Verwaltungsvorschriften und Förderrichtlinien führen sie nie.

Die Bestandszahl lautet überall gleich: „1933 Vorschriften, davon 1867 geltend“
(`formatInventoryCount` in `apps/recht/src/lib/counts.ts`, Einzahl „1 Vorschrift“). Sie steht auf der
Startseite, im Kopf des A–Z und der Sachgebietsübersicht.

### Ordnungswort und alphabetische Einordnung

Der Buchstabe eines Eintrags ist der Anfangsbuchstabe seines Ordnungsworts – des ersten
inhaltstragenden Wortes der Bezeichnung, ohne Ordnungszahl, Rechtsform, erlassende Stelle,
Präposition und Artikel („Gesetz über die Landesregulierungsbehörde“ steht unter L).
`getNormSortWord` und `getNormSortKey` in `packages/shared/src/lib/norms/presentation.ts` bilden es;
die Projektion legt den Vergleichsschlüssel als `law_norms.sort_word` ab, die Buchstabengruppe als
`index_letter`. Die Überschrift eines Verzeichniseintrags bleibt der Titelblock; das Ordnungswort
erscheint als beschriftete Angabe nur dort, wo sein Anfangsbuchstabe von dem der Überschrift
abweicht. Die Einleitung des A–Z sagt einmal, dass der Buchstabe dem Ordnungswort folgt.

### A–Z unter `/a-z/`

Der alphabetische Zugang liegt unter `/a-z/`; `/archiv/` bleibt als dauerhafte Weiterleitung (301)
mit Buchstabe, Herkunft, Seite und Stichwortstand erreichbar. Die Seite hat nach Herkunftsübersicht
und Vorschriftenliste zwei getrennte Wortlisten: „Stichwortregister“ mit den redaktionellen
Stichwörtern aus `content/stichwortregister.json` und „Abkürzungen und Kurztitel“. Abgeleitete
Titelwörter erscheinen dort nicht mehr; sie bleiben durchsuchbar.

### Normkopf und Fassungsnavigation

Fassung, „Fassungen und Änderungen“, Fassungsvergleich und Einzelfassung rendern denselben
`NormPageHeader.astro`; Eyebrow und Statuszeile kommen aus `apps/recht/src/lib/norm-header.ts`: der
Eyebrow lautet „Vorschrift“, die Statuszeile beschreibt zuerst die angezeigte Fassung und danach die
Vorschrift („Geltende Fassung seit … · Vorschrift in Kraft seit …“, bei gleichen Daten „Geltende
Fassung · in Kraft seit …“, „Historische Fassung · gültig ab … bis … · Vorschrift in Kraft seit …“).
Der Wechsel zwischen den Ansichten verändert den Kopf nicht. Der Kopf trägt außer Titelblock
(Überschrift, Langtitel nur bei Abweichung, Abkürzung) nur Normtyp und Geltung; Fundstelle,
Rechtsstand und Zusammenfassung stehen nicht im Kopf. Die Werkzeugleiste hat drei feste Plätze –
„Fassung als PDF“, „Amtliche Ausgabe (PDF)“ (ohne Beleg ausgegraut mit Begründung) und „Link
kopieren“ – dazu den Sprunglink „Zum Vorschriftentext“ bzw. „Zur geltenden Fassung“.

Alle Angaben zur Vorschrift stehen genau einmal in `NormFacts.astro` („Vorschriftendaten“):
Vollzitat, Fundstelle, Rechtsstand, Geltung, Herkunft mit den verlinkten Änderungsvorschriften,
Quelle, Sachgebiete, Ressort und Vertragsdaten. Ab 80 rem steht der Block offen, darunter ist er der
Aufklappbereich „Angaben zur Vorschrift“.

Die Fassungsnavigation ist ein Linkband gleichwertiger Links mit unterstrichenem aktivem Eintrag –
kein Kasten, keine gefüllte Pille, kein Tab-Widget. Sie führt ausschließlich Unterseiten der
Vorschrift: „Aktuelle Fassung“, „Fassungen und Änderungen“ und – ab zwei gespeicherten Fassungen –
„Fassungsvergleich“, jede mit `aria-current` auf ihrer Seite; Sprungziele stehen nicht in der Reihe.
Die gespeicherten Fassungen stehen in einem ohne JavaScript bedienbaren `details`-Wähler, nach
geltend, historisch, zukünftig und ungeklärtem Inkrafttreten gruppiert und immer zusätzlich textlich
bezeichnet; die geltende Fassung heißt dort wie überall „Rechtsstand vom <Datum>“. Vorschriften mit
einer einzigen Fassung zeigen keinen Wähler.

### Normtext

Abschnittsüberschriften stehen in `--text-xl` mit Vorabstand (`--space-7`) und dünner Trennlinie, die
Nummer als eigene Zeile in `--text-sm`; Artikel und Paragraphen in `--text-md`, ihr Label in derselben
kleinen Zeile; ein Label ohne Titel („Präambel“) bleibt Überschrift. Zwischen Label und Titel bzw.
Text steht ein echtes Leerzeichen, damit kopierter und vorgelesener Text „Artikel 1
Verfassungsgrundsätze“ und „(1) Die Hauptstadt …“ lautet. Absatz-, Nummern- und
Buchstabenkennzeichnungen gehören zum Fließtext mit fester Labelspalte.

Jede nicht zitierte Einheit ist ein `section` mit echter Überschrift; das Auf- und Zuklappen
übernimmt ein Knopf daneben (`aria-expanded`, `aria-controls`), nicht ein `summary` – Überschriften
in `summary` werden von Safari mit VoiceOver und von Firefox nicht als Überschrift ausgegeben.

Vor dem Text stehen ein Umschalter, dessen Beschriftung den nächsten Zustand und die Einheitenart
der Vorschrift nennt („Alle Artikel schließen“, „Alle Paragraphen öffnen“; ohne Artikel und
Paragraphen entfällt er), „Inhaltsübersicht“ als Sprunglink und „Drucken“ als Symbolknopf. Je
Einheit gibt es einen Knopf „Werkzeuge“ in der Kopfzeile (Desktop bei Hover und Fokus, kleine
Bildschirme dauerhaft; ab 48 rem mit sichtbarer Beschriftung, darunter als Symbol mit
zugänglichem Namen) mit „Link zu dieser Stelle kopieren“ (springt und kopiert) und „Einzeldruck“.
Paragraphen, Artikel und Anlagen tragen sprechende, deterministische Anker; alte Anker bleiben
unsichtbare Sprungziele, und ein Sprung auf eine eingeklappte Einheit klappt sie auf. Die
Inhaltsübersicht haftet neben dem Dokument; ihre Spalte trägt dafür die volle Zeilenhöhe.
Entscheidung gegen die ursprüngliche Empfehlung: Tabellen und Anlagen ragen nicht in die
Informationsspalte hinein, weil sie unter der haftenden Fläche lägen; sie nutzen die volle
Textspalte und rollen erst darüber hinaus in `.table-wrap`.

### Fassungsvergleich

Geänderte Einheiten stehen auf breiten Bildschirmen nebeneinander als „Bisher“ und „Neu“, auf
kleinen gestapelt; `ins`/`del`, Klartextlabels und unterschiedliche Flächen ergänzen sich. Der
Vergleich zeigt dieselbe Gliederungstiefe, dieselben Leerzeichen und dieselbe Dokumentschrift wie die
Normseite. Er wird von `packages/shared/src/lib/norms/diff-render.ts` erzeugt, einem eigenen Renderer
neben `NormBody.astro`; beide bleiben bewusst getrennt, weil der eine Astro-Templates aus dem
Normmodell, der andere Zeichenketten mit Änderungsläufen je Seite aus dem Diff-Modell baut – gemeinsam
sind Klassen und Regeln, nicht der Code. Der Zähler nennt die Einheitenart der verglichenen
Fassungen und beugt sie richtig („132 geänderte Artikel“, „1 geänderter Paragraph“, „1 geänderte
Textstelle“; `packages/shared/src/lib/norms/units.ts`). Absätze ohne Gliederungszeichen werden
inhaltlich gepaart: wortgleiche Absätze bleiben unverändert und erscheinen nicht, eine umformulierte
Zeile gilt als geändert, eine gestrichene als entfallen.

### Startseite

Ruhige Hero-Fläche (`--law-blue-light`, kein Verlauf, kein Dekorzeichen) mit Volltextsuche und
Chips, die sämtlich Suchfilter sind (der letzte führt zur erweiterten Suche), darunter ein
horizontaler Schnellzugriff mit fünf Karten: fünf Spalten bis 64 rem, darunter drei (3 + 2), unter
48 rem ein waagerechtes Rollband. Zwei Bänder: oben „Aktuelle Änderungen“ und „Künftige Änderungen“
als gleich lange Spalten (je vier Einträge; eine leere Zukunftsspalte zeigt einen Hinweis; künftige
Einträge sind nach ihrer Art als „tritt in Kraft“ oder „tritt außer Kraft“ beschriftet, und Einträge
ohne aussagekräftigen Titel zeigen den Anfang des Vollzitats), unten „Neu
verkündet“, „Sachgebiete“ (die acht nummerierten Hauptgruppen der amtlichen Systematik in ihrer
Reihenfolge, mit Hinweis auf Mehrfachzuordnung) und die Funktionen des Rechtsportals;
zwischen den Bändern `--space-section`. H2 in `--text-lg`, Kartentitel in `--text-base-plus`,
Beschreibungen in `--text-sm`, Etiketten in `--text-xs`; kein Bedienziel unter 24 px.

### Rechtssuche

Filter, Trefferliste und Suchhinweise stehen auf breiten Bildschirmen nebeneinander; auf kleinen
werden die Filter als `details` vorangestellt. Ein Treffer zeigt vor dem Auszug zwei Zeilen:
Kurztitel mit Abkürzung (aus dem gemeinsamen Titelblock, siehe „Rechtsherkunft und Benennungen“;
der Langtitel steht klein darunter und weicht auf schmalen Bildschirmen dem Wortlaut) und eine
einzeilige Metazeile aus Normtyp und – je nach Rechtsherkunft – dem kurzen Herkunftszeichen oder
der Fundstelle: übernommenes, unverändertes Recht ist der Regelfall und nennt die Fundstelle,
eigene, geänderte und ungeklärte Vorschriften tragen das Herkunftszeichen. Der Auszug trägt die
Trefferstelle als verlinktes Präfix, ist auf 300 Zeichen begrenzt, beginnt beim Wortlaut statt bei
der wiederholten Überschrift und zeigt auf schmalen Bildschirmen drei Zeilen; die Fassungspille
erscheint nur, wenn sie vom aktiven Fassungsfilter abweicht. So bleibt eine ungeöffnete
Trefferkarte bei 375 Pixeln Breite unter 220 Pixeln hoch (Messung in `tests/visual.spec.ts`).

Die Trefferliste ist seitenweise: die Überschrift nennt die vollständige Trefferzahl und die
Sortierung („N Treffer. Sortiert nach …“), der Knopf „Weitere Treffer laden“ nennt den Rest. Die
Reihenfolge nach Relevanz folgt fünf Stufen: Gleichheit mit einer Bezeichnung, Treffer im Titel,
eigene vor übernommenen Änderungsträgern, alle Suchbegriffe in derselben Vorschrift, gewichtete
Volltextrelevanz und zuletzt der Titel. Der Leerzustand heißt „Keine Vorschrift gefunden“, zitiert
die Anfrage und bietet drei Auswege (Filter zurücksetzen mit Anzahl, alle Fassungen, Vorschriften
A–Z); Facetten zählen passende Vorschriften und sind ohne Treffer deaktiviert, außer innerhalb
einer Gruppe mit eigener Auswahl. Filterzeilen haben die barrierearme Höhe von 2,75 rem.

### Rechtsherkunft und Benennungen

Rechtsherkunft ist auf allen Rechtsseiten mit derselben Kennzeichnung sichtbar
(`NormOriginBadge.astro`, Klasse `origin-badge`, Texte ausschließlich aus
`packages/shared/src/lib/norms/origin-presentation.ts`; die erklärende Langform ist
`formatNormOriginKind` aus `origin.ts`) in genau zwei Formen: kurz in Listen und Trefferzeilen
(„Übernommen · unverändert“, „Übernommen · geändert“, „Ostdeutsch neu“, „Herkunft ungeklärt“; die
erklärende Fassung steht dort als Titel am Zeichen) und erklärend auf Normseite, in Filtern und
Zählern („Übernommen und unverändert“,
„Übernommen und ostdeutsch geändert“, „Ostdeutsch neu geschaffen“, „Herkunft ungeklärt“). Die
Normseite führt Rechtsstand und Herkunft in `NormFacts.astro` mit allen übrigen Angaben zur
Vorschrift zusammen. Die geltende Fassung heißt in Fassungswahl, Vorschriftendaten und Trefferliste
„Rechtsstand vom <Datum>“; das Wort „Stichtag“ steht öffentlich nur in der Hilfe.

Für Geltung, Rechtsstand und Fassung gilt eine Wortliste: `lawSiteConfig.vocabulary`
(`packages/shared/src/config/site.ts`) legt sie fest, `apps/recht/src/lib/vocabulary.ts` bildet sie
für die Oberfläche ab. **Geltung** ist der Zustand einer Vorschrift (in Kraft, künftig in Kraft,
außer Kraft, einmaliger Rechtsakt, Inkrafttreten nicht belegt, nicht verkündet) und beschriftet den
Verzeichnisfilter, die Facette der Suche und die Fakten der Einträge; die Auswahl „alle“ heißt
„Jede Geltung“. **Rechtsstand** ist immer ein Datum. **Fassung** benennt die zeitliche Einordnung
(Geltende, Historische, Künftige Fassung, Fassung mit ungeklärtem Inkrafttreten) und beschriftet die
Fassungsauswahl der Suche und die Fassungsnavigation. Kein Formular führt eigene Wörter;
`tests/law-target-labels.test.ts` prüft die Optionslisten der drei Auswahlfelder gegen die Wortliste.

Öffentliche Texte sprechen die Sprache der Nutzenden: keine maschinenlesbaren Daten, keine
Systemwörter („gespeichert“, „Datenbestand“, „Anker“, „strukturtragend“, „Stichtag“ außerhalb der
Hilfe) und Zähler in richtiger Zahl (`apps/recht/src/lib/counts.ts` bildet jede Bestandszahl).
Wortlaute aus dem Import, die dagegen verstoßen, werden zur Anzeige abgebildet
(`apps/recht/src/lib/history-labels.ts`): Platzhaltertitel wie „Verkündung.“ weichen dem Anfang des
Vollzitats, die Herkunftsformel wird zu „Übernommene Ausgangsfassung mit Rechtsstand vom
1. November 2023“.

Jedes Ziel hat genau eine Bezeichnung, gelesen aus `lawSiteConfig.targetLabels`
(`packages/shared/src/config/site.ts`) von Navigation, Fußzeilen beider Portale, Startseitenkarten,
Hilfe, Suche und Fehlerseite – etwa „Vorschriften A–Z“ und „Sachgebiete“; ein Unit-Test hält
Navigation und Bezeichnungen zusammen. Der Eyebrow nennt den Bereich: „Rechtsportal“ auf
Übersichten, Hilfe und Fehlerseite, „Rechtssuche“, „Vorschrift“, „Verkündung“, „Sachgebiet“ auf den
Detailseiten; Zustände stehen in der Statuszeile oder im Text. Bestandszahlen heißen „geltende
Vorschriften“ (Startseite) und „Vorschriften im Bestand“ (Übersichten) — die zusammengesetzte Zahl
bildet `formatInventoryCount` (siehe „Grundmenge und Bestandszahl“); die Historie zeigt frühere
Titel einer Vorschrift nur bei Abweichung, gekennzeichnet als „Damaliger Titel“.

Für die Benennung einer Vorschrift gilt überall derselbe Titelblock aus `getNormTitleBlock`
(`packages/shared/src/lib/norms/display.ts`): Überschrift ist die Kurzbezeichnung, sonst der
Langtitel; der Langtitel steht klein darunter, sobald er von der Überschrift abweicht; die
Abkürzung steht neben der Überschrift, wenn sie sich von ihr unterscheidet. Normkopf, Suchtreffer,
Verzeichniseinträge, Stichwortregister, Brotkrumen, Auswahllisten und Autocomplete verwenden diese
eine Regel; keine Oberfläche bildet eigene Titelvarianten. Formelhafte Kurzbeschreibungen des
Massenimports (`summarySource: "derived"`) werden nirgends als Beschreibung ausgespielt; ohne
redaktionelle Kurzbeschreibung bleibt die Zeile leer.

## Staatsportal

### Startseite

Die Startseite folgt einer festen Hierarchie: Hero mit redaktionellem Staatskanzlei-Bild, H1 und
Portalsuche; zentrale Portalpfade als Zugangskarten (`PortalAccessCard.astro`); wichtiges Hinweisband
(`ImportantNoticeBand.astro`); Presse, aktuelle Ministerien und Freistaat-Kurzprofil
(`HomePressList.astro`, `HomeMinistryList.astro`, `FreestateSummary.astro`); „Aktuelles
Regierungshandeln“ mit einem Leitvorhaben als dunkler Karte (`home-lead-feature`) und bis zu zwei
weiteren Vorhaben; Recht, Haushalt und weitere Serviceangebote; Serviceband und Footer. Suchvorschläge,
Karten und Listen verweisen ausschließlich auf vorhandene Seiten. Hervorhebungen sind redaktionelle
Entscheidungen aus den Themendaten; es gibt keine zweite manuelle Startseitenliste.

### Komponenten und Bilder

Wiederkehrende Muster liegen als kleine Astro-Komponenten unter `apps/portal/src/components/portal/`;
anwendungsübergreifende Grundbausteine (`PortalIcon.astro`, `ResponsivePicture.astro`,
`SectionHero.astro`) unter `packages/shared/src/components/portal/`. Icons ergänzen Text, ersetzen
ihn nicht. Bilder werden über absolute Pfade unter `/images/` referenziert, responsive Varianten
liegen unter `public/images/generated/`; Alternativtexte beschreiben den Bildinhalt, Bildnachweise
werden nur bei belastbarer Quelle als `figcaption` direkt an der Medienfläche ausgegeben; unterhalb
des sichtbaren Einstiegs werden Bilder verzögert geladen.

### Unterseiten und Bereichsidentitäten

Unterseiten folgen der Hierarchie Behördenkopf, bereichsbezogener Einstieg (`SectionHero.astro`
mit den Varianten `government`, `topics`, `law`, `budget`, `reform`, `press`, `service`, `freestate`,
`plain`), lokale Orientierung, fachliche Module, Serviceband und Footer. Die Varianten unterscheiden
sich nur durch zurückhaltende Akzente, Medienanteil und Zusatzinhalte. Seitentitel stehen in
`--text-title`, Langtitel in `--text-title-long`; im Einstieg gibt es höchstens eine primäre Aktion.
Die Bereichsnavigation (`SectionNavigation`) bleibt ein semantisches `nav` mit echten Links und
`aria-current`. Kennzahlenkarten sind echten Zahlenwerten vorbehalten; Karten bleiben wiederholten,
gleichartigen Einheiten vorbehalten. Fehlerseiten beider Portale zeigen im eigenen Layout „Seite
nicht gefunden“ mit Suche und Verzeichniszugängen; die englische Astro-Standardseite wird nie
ausgeliefert.

Die Kreisreform-Seite liefert die Gebietssuche als Text; die interaktive Karte wird erst nach
ausdrücklicher Freigabe geladen. Die Behördennummer 115 ist ein Orientierungsbegriff aus der
zentralen Konfiguration und verweist auf den Kontaktbereich; ein `tel:`-Link erscheint nur bei
ausdrücklich konfiguriertem Telefonweg.

## Barrierefreiheit

- genau eine H1 pro Seite, semantische Landmarken, nachvollziehbare Überschriftenfolge
- Skip-Link, sichtbarer Tastaturfokus mit mindestens 3 : 1 gegen seine Bezugsfläche (siehe Farbrollen)
- `aria-current` für den aktiven Hauptnavigationspunkt; native `details` für Menüs und
  Aufklappbereiche. Ausnahme sind die Einheiten des Vorschriftentextes: dort trägt eine echte
  Überschrift den Namen und ein Knopf mit `aria-expanded`/`aria-controls` das Auf- und Zuklappen,
  weil Überschriften in `summary` nicht überall als Überschrift ausgegeben werden.
- beschriftete Suchfelder, Schaltflächen mit sichtbarem oder zugänglichem Namen
- Bedienziele im Rechtsportal mindestens 24 × 24 px; die Fußzeile des Staatsportals liegt mit
  19–21 px darunter
- Statusausgaben der Suche werden zugänglich angekündigt; keine allein durch Farbe vermittelte
  Information; Rücksicht auf reduzierte Bewegung und Druckausgabe

## Qualitätssicherung

Die visuellen Baselines (`tests/visual.spec.ts`) prüfen zentrale Seiten und Module gegen das
Testfixture des Rechtsbestands (`data/recht/runtime-fixture.json`) in zwei Stufen: die kritische
Auswahl (`npm run test:visual:critical`, Desktop und Mobil, Tablet nur bei eigenem Breakpoint) in
Pull Requests und die breite Inventur (`npm run test:visual:extended`, 1440, 768 und 390 px) auf
`main`, wöchentlich und manuell. Kanonische Plattform ist Linux: versioniert sind nur
`-linux`-Baselines aus dem festen Playwright-Container; unter macOS laufen die Tests funktional
ohne Pixelvergleich. Baselines werden nur nach Sichtprüfung übernommen und mit einem Vorgang
erneuert – `npm run test:visual:update:linux -- --site law` (Docker) oder Workflow
„Screenshot-Baselines erneuern“ plus `npm run test:visual:baselines:apply -- --run <Lauf-ID>`
(`docs/DEPLOYMENT_RUNBOOK.md`, Abschnitt Screenshot-Suite). Sie sind kein Deployment-Gate. `tests/accessibility.spec.ts` prüft alle repräsentativen Seiten mit Axe und den
Fokusindikator gegen seine Bezugsfläche; `tests/browser-smoke.spec.ts` prüft Verzeichnisse,
Suche, Normseiten und Kopfstufen funktional; `npm run docs:check` hält die Dokumente konsistent.
Zwei Messtests in `tests/visual.spec.ts` prüfen den Normarbeitsbereich in Zahlen statt in Bildern:
bei 1280 px stehen Inhaltsübersicht und Text in zwei Spalten, auf den Mobilbreiten ist der Normkopf
höchstens 320 px hoch und der Vorschriftentext beginnt spätestens bei 700 px.

## Was vermieden wird

- Marketing-Heroes, Farbverläufe und Dekorzeichen ohne Informationswert
- Systemschriften als Gestaltungsmittel; Schrift kommt lokal als woff2
- Einzelwerte neben den Skalen für Größen, Abstände, Radien, Zeilenhöhen oder Farben
- zwei Definitionen derselben Eigenschaft für einen Selektor
- Tab-Widgets, wo Links genügen; Karten für ganze Fachabschnitte
- erfundene Bürgerdienste oder Kontenfunktionen
- öffentliche Texte mit technischen Architekturbegriffen
- wiederholte Erklärungen der politischen Simulation außerhalb der festgelegten Hinweise
- Layouts mit abgeschnittenen Inhalten oder ungeplantem horizontalem Scrollen
