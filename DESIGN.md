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

Die beiden Portale haben getrennte Stylesheets mit gemeinsamen Schriften.
`packages/shared/src/styles/global.css` (Staatsportal) hält nur die Importreihenfolge: `fonts.css`
(die lokalen `@font-face`-Blöcke beider Portale), `foundation.css` (Tokens, Basis-, Layout- und
allgemeine Fachregeln), `section-system.css` (Bereichsköpfe und lokale Orientierung),
`portal-shell.css` (Behördenkopf, Serviceband, Footer), `home.css` (Startseite des Staatsportals),
`content-layout.css` (Verdichtung gemeinsamer Inhaltsseiten) und `holdings.css`
(Beteiligungsseiten). OstRecht lädt über `apps/recht/src/styles/index.css` eigene Stylesheets:
`tokens.css` (Design-Tokens der Richtung E „Rechtsstand“, `docs/design/`), `base.css` (Reset,
Typografierollen, Schaltflächen, Felder, Tabellen, Statusmarken, Buchstabenleiste, Seitenwechsel),
`shell.css` (Amtsband, Navigation, Seitenkopf, Footer, Einwilligungsbanner), `home.css`,
`search.css`, `norm.css` (Vorschriftskopf, Arbeitsbereich, Inhaltsübersicht, Normtext,
Seitenspalte, Vorschriftendaten, Rechtsbeziehungen), `versions.css` (Fassungen, Zeitachse,
Protokoll, Vergleich), `publications.css`, `directory.css` (Verzeichnisse, A–Z, Sachgebiete,
Hilfe) und `print.css`. Responsive und druckspezifische Regeln bleiben bei ihrem fachlichen Block;
ihre Reihenfolge darf nicht ohne visuelle Regressionstests verändert werden.

Je Selektor gibt es außerhalb von Media Queries eine Definition. Zulässig ist eine Gruppenregel mit
unmittelbar folgender Verfeinerung desselben Selektors; zwei konkurrierende Stände sind es nicht.
Größen, Abstände, Radien und Farben kommen aus den Tokens unten. Ein Einzelwert neben der Skala ist
ein Hinweis auf eine fehlende Stufe: dann wird die Stufe ergänzt und im Commit begründet, nicht der
Einzelwert behalten.

## Design-Tokens

Die Tokens des Staatsportals liegen in `foundation.css` unter `:root`. OstRecht hat seit der
Richtung E einen eigenen, vollständigen Tokensatz in `apps/recht/src/styles/tokens.css`
(Farbpalette mit Staatsblau als Strukturfarbe, Papier- und Tintenstufen, Schriftgrößenskala
`--fs-micro` bis `--fs-display-lg`, Zeilenhöhen, Abstände `--space-*`, Radien, Linien, Fokus); die
Werte folgen dem Production Board unter `docs/design/`. Die Tabelle nennt die Tokens und Rollen des
Staatsportals, keine Werte – die Werte stehen im Stylesheet.

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
| Gold | `--color-gold`, `--color-gold-bright` | aktiver Navigationspunkt, Oberrand der Leitkarte; helles Gold auf dunklem Grund |
| Informationsflächen | `--color-info-blue`, `--color-info-green`, `--color-info-gold`, `--color-info-gold-soft`, `--color-info-gold-hover` | Hinweise, Status, künftige und entfallene Fassungen, großflächige Hinweisbänder |
| Rahmen und Text auf Informationsflächen | `--color-info-blue-border`, `--color-info-blue-hover`, `--color-info-green-border`, `--color-info-gold-border`, `--color-info-gold-divider`, `--color-info-gold-ink` | je Fläche ein Rahmen, ein Innentrenner, eine Textfarbe |
| Hoheitszeichen und Tiefen | `--color-flag-blue`, `--color-flag-green`, `--color-ink-deep`, `--color-highlight` | Flagge, Fußbereich, Trefferhervorhebung der Suche |
| Fokus | `--color-focus`, `--focus-ring`, `--focus-halo` | Umriss, weißer Schein, Vererbung an dunkle Flächen |
| Hinweisleiste | `--color-banner` | Simulationshinweis des Staatsportals |
| Schatten | `--shadow-soft`, `--shadow-card` | Ebenentrennung, sparsam |
| Radien | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill` | 0,5 / 0,75 / 0,875 rem; Pillen ein Idiom |
| Breiten | `--content-width` (Staatsportal 84 rem, OstRecht 96 rem), `--content-width-narrow`, `--space-section` | Inhaltscontainer, Lesespalte, Abstand zwischen Bändern |
| Seitenrand und Lesemaß | `--page-gutter`, `--measure-body` | Rand des Inhaltscontainers, Zeilenlänge des Fließtexts; das Staatsportal setzt beide unter `.portal-site` eigenständig |

Hexwerte stehen nur in den Token-Definitionen und als `#fff` für reines Weiß **als Textfarbe** auf
dunklem Grund; Rahmen- und Flächenfarben kommen ausschließlich aus Tokens (`hexInBorderBackground`
im Stilwächter steht auf 0). Weiße Flächen sind `var(--color-surface)`. Rahmen und Abstände tragen die Struktur, Schatten
trennen Ebenen zurückhaltend. Farbverläufe gibt es nur noch am Fußbereich und an der Servicekarte
des Rechtsportals, wo keine Kleinschrift darüber liegt; dekorative Großformen gibt es nicht.

## Typografie

### Schriften

Alle Familien werden lokal aus `packages/shared/src/assets/fonts/` untersetzt ausgeliefert
(Zeichenumfang, Werkzeuge und Kommandos: `README.md` im selben Ordner):

| Datei | Familie | Achsen | Größe | Rolle |
| --- | --- | --- | --- | --- |
| `Jost-Variable.woff2` | Jost (OFL) | wght 100–900 | 34 KB | Oberfläche beider Portale |
| `SourceSerif4Variable-Roman.woff2` | Source Serif 4 (Adobe, OFL) | wght 400–700, opsz 12–48 | 86 KB | Dokument im Rechtsportal |
| `OstGrotesk-Regular.woff2`, `OstGrotesk-Bold.woff2` | Ost Grotesk (aus Neu5Land, OFL), nach der Schmalen Erbar-Grotesk | feste Schnitte 400 und 700 | 17 KB | Wegweiserebene beider Portale |

Budget für die gesamte Schriftübertragung: 270 KB; Stand 137 KB (Jost 34, Source Serif 4 86, Ost Grotesk 8 + 8). Keine Kursive (der Bestand enthält
keine). `font-display: swap`. `PageHead.astro` lädt Jost auf jeder Seite vor; in jeder Messung (lokal
und gegen die Produktion auf Cloudflare, bis Slow 3G) war Jost vor dem ersten Anstrich fertig, deshalb
folgt auf Jost direkt `system-ui`, ohne Rückfallschnitt. Source Serif 4 wird nur auf den Normseiten
vorgeladen (`documentFont`) und kommt dort bei Fast 3G rund 170 ms, bei Slow 3G rund 1 s nach dem
ersten Anstrich; bis dahin setzt ein metrikangeglichener Rückfallschnitt je Plattformfamilie (Georgia
für Windows, macOS und iOS; Noto Serif für Android; DejaVu Serif und Liberation Serif für Linux) mit im
Browser gemessenen `size-adjust`- und Override-Werten (Herleitung, Zahlen und Messskript: `README.md`
im Schriftordner). Die Optical-Size-Achse folgt der Schriftgröße automatisch.

Ost Grotesk wird als fetter Schnitt auf jeder Seite vorgeladen (Wortzeichen); der normale Schnitt
trägt nur Abkürzungen und Sigel und lädt ohne Vorrang. Ein eigener Rückfallschnitt entfällt: bei
8 KB je Schnitt gilt dieselbe Messung wie für Jost, und `--font-sign` fällt auf die
Oberflächenschrift zurück, wenn die Datei ausbleibt. Die Familie hat keine Gewichtsachse — es gibt
nur 400 und 700.

Tokens: `--font-sans` (Jost), `--font-display` (Alias von `--font-sans`), `--font-document`
(Source Serif 4), `--font-sign` (Ost Grotesk, dann `--font-sans`). Der Wechsel der Dokumentschrift
ist eine Änderung an `--font-document`. Systemschriften kommen nur als Rückfall vor.

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
- Ost Grotesk (`--font-display` in OstRecht): die Wegweiserebene – die H1 jeder Seite
  (`.r-h1`, `.r-page-head h1`, „Suche im Landesrecht“, „Gesetze“), die Wortmarke im Amtsband und
  im Fuß, die Sachgebietsnummern (`.r-subjects__number`, `.r-subject__number`) und die Bandtitel
  („Historische Fassung“). Sie wird nicht auf Titel in Listen, Zustände oder Etiketten verteilt;
  Normtitel, Statusmarken und Herkunftsangaben bleiben Jost. Alle Stellen mit `--font-display`
  fordern die tz-Ligatur an: eine zentrale Regel in `base.css` setzt `font-feature-settings:
  'dlig' 1` für genau diese Selektoren („Gesetze“ zeigt das verbundene tz).
- Versalien (`.r-label`, 11 px) bleiben Etiketten: Metadatenrubriken, Seitenspaltenrubriken,
  Tabellenköpfe, kurze Kennzeichnungen. Trägt ein Überschriftenelement diese Rolle (Rubriken der
  Seitenspalte und des Fußes, `h2.r-label`, `h3.r-label`), steht es in `--fs-caption` (12 px) –
  kein h1/h2/h3 setzt `--fs-micro` (Stilwächter). Tragende H1/H2/H3 einer Seite stehen nie in
  dieser Rolle: H1 in Ost Grotesk (34 px), H2 in `.r-h2` (23 px, Untervariante `.r-h2--sub`
  20 px), H3 in `.r-h3` (17 px). Die Stufe steht als Klasse am Element; ein Abschnittskopf
  (`.r-section-head`) setzt keine eigene Größe dagegen. Die drei Abschnitts-H2 der Startseite
  (Sachgebiete, Änderungsdienst, Neueste amtliche Veröffentlichungen) tragen `.r-h2 .r-h2--sub`,
  die Spaltenrubriken des Änderungsdiensts `.r-h3`; `tests/visual.spec.ts` misst, dass alle
  sichtbaren H2 der Startseite dieselbe Schriftgröße haben.

### Skalen

Typoskala (`foundation.css`): `--text-2xs` 0,72 rem (11,52 px), `--text-xs` 0,82 (13,12),
`--text-sm` 0,92 (14,72), `--text-base` 1 (16), `--text-base-plus` 1,0625 (17), `--text-md` 1,15
(18,4), `--text-lg` 1,3 (20,8), `--text-lg-plus` 1,5 (24), `--text-xl` 1,75 (28). Begründete
Zusatzstufen: `--text-base-plus` für Kartentitel (zwischen 16 und 18,4 px), `--text-lg-plus` für die
Abschnitts-H2 des Staatsportals (sonst 20,8 px). Die kleinste Stufe trägt Wortmarken-Untertitel und
Kennzahl-Etiketten, nie Navigations- oder Listeneinträge: die Inhaltsübersicht der Normseite steht
mindestens in `--text-sm`, ihre Gliederungszeichen mindestens in `--text-xs`
(`tests/stilwaechter.test.ts` hält beide Untergrenzen fest).

Titelstufen, zwei in beiden Portalen: `--text-title` trägt jede H1 – Startseiten-Hero, Bereichs-,
Such- und Hilfeseiten –, `--text-title-long` die Langtitel (Normseiten, Rechtsentwicklung, Personen,
Beteiligungen, Leitkarte der Startseite). Beide sind `clamp()`-Ausdrücke (bei 1440 px: 52 / 42,4 px).
Eine dritte Stufe für den Hero gab es einmal; sie unterschied sich bei 1280 px um 0,8 px von
`--text-title` und ist darin aufgegangen.

Drei skalierende Zwischenrollen ersetzen die früheren freien `clamp()`-Schriftgrößen der
Stylesheets: `--text-band` für die Überschrift eines Startseiten- oder Modulbandes,
`--text-card-title` für den hervorgehobenen Kartentitel, `--text-metric` für die Kennzahl eines
Kopfbereichs. Außerhalb der Wortmarke von OstRecht bildet keine Datei mehr eine eigene
Schriftgröße; `tests/visual.spec.ts` misst je Seitenfamilie die kleinste Fließtextgröße
(mindestens 14,5 px) und das Lesemaß.

Zeilenhöhen ausschließlich aus vier Tokens: `--lh-display` 1,12 (Titel), `--lh-heading` 1,28
(Überschriften), `--lh-compact` 1,45 (Etiketten, Menü- und Bedienzeilen), `--lh-body` 1,65
(Lesetext). Ausnahme ist `line-height: 1` auf Aufklappzeichen (`::before`/`::after`), der Wortmarke
und dem Symbolknopf der Einheitenwerkzeuge – Geometrie, keine Typografie.

Normtext (OstRecht): `--fs-body` (17 px) in Source Serif 4, Zeilenhöhe `--lh-legal`; das
Lesemaß `--measure-legal` (66ch) gilt für den Textkörper rechts der Adressspalte (siehe
„Normtext“). Lange Ressort-, Amts- und Normtitel dürfen umbrechen; negative Laufweiten kommen nicht vor;
Personenbezeichnungen verwenden den Doppelpunkt.

## Abstände und Radien

Abstandsskala: `--space-hairline` 2 px, `--space-1` 4, `--space-xs` 6, `--space-2` 8, `--space-3` 12,
`--space-4` 16, `--space-4-plus` 20, `--space-5` 24, `--space-6` 32, `--space-6-plus` 40,
`--space-7` 48, `--space-8` 64. `--space-hairline` und `--space-xs` sind ergänzte Zwischenstufen für
Haarabstände und die häufigen 6-px-Lücken; `--space-4-plus` und `--space-6-plus` sind die beiden
Stufen, ohne die Kartenpolster und Bandabstände des Staatsportals um bis zu 8 px springen müssten
(zwischen 16 und 24 px lagen dort 57 Einzelwerte, zwischen 32 und 48 px weitere 14).
`--space-section` (`clamp(2.5rem, 5vw, 4.5rem)`) trennt die Bänder einer Seite. Radien nur aus
`--radius-sm`, `--radius-md`, `--radius-lg` und `--radius-pill`.

## Layoutsystem

Der Inhaltscontainer `.container` rechnet mit `--page-gutter`. OstRecht behält den Wert des
Fundaments (`--space-4`, 16 px auf jeder Breite); das Staatsportal setzt ihn am `body`
(`.portal-site`) und lässt ihn mit der Fensterbreite wachsen: `--space-6` (32 px) über 80 rem,
`--space-5` (24) bis 80 rem, `--space-4` (16) bis 64 rem, `--space-3` (12) bis 48 rem. Denselben
Weg geht das Lesemaß: `--measure-body` steht im Fundament auf 78ch, im Staatsportal auf 75ch, und
`p`, `li`, `dd`, die Beschreibungszeile einer Eintragsliste und der Einleitungssatz einer Seite
lesen es.

OstRecht rechnet mit einer eigenen Skala: `--page-max` steht auf 80 rem (1280 px) und gilt für
Kopf, Bänder, Arbeitsbereiche und Fuß gleichermaßen; `--page-gutter` geht von 2,5 rem über
1,25 rem (unter 48 rem) auf 1 rem (unter 30 rem). Es gibt keine zweite, breitere Seitenklasse: der
dreispaltige Normarbeitsbereich passt in dieselbe Breite, und auf großen Bildschirmen bleibt der
Rand außen statt den Text auseinanderzuziehen. Ein allein stehender Bereich (Vorschriftendaten,
Rechtsbeziehungen) nimmt `--measure-panel` (56 rem) statt der vollen Spalte.

Das Staatsportal verwendet `apps/portal/src/layouts/BaseLayout.astro` mit den Hauptvarianten
`contained` (begrenzter Hauptcontainer) und `full` (vollbreite Bänder mit innen begrenzten
Containern). OstRecht verwendet `apps/recht/src/layouts/LawLayout.astro` mit denselben Varianten;
es teilt Tokens, Schriften, Skip-Link, Fokusregeln und die Normkomponenten, kontrolliert aber Kopf,
Wortmarke, Navigation, Suche, Brotkrume und Fußbereich selbst. Wiederholte Einheiten nutzen Grid oder
strukturierte Listen; Fachabschnitte werden nicht ohne Grund zu schwebenden Karten.

## Kopfbereiche

Der Kopf des Staatsportals besteht aus Simulations-Hinweisleiste, Wortmarke mit Staatsflagge,
Hauptnavigation mit `aria-current`, Portalsuche und den Einstiegen zu Leichter Sprache und
Gebärdensprache. Er kennt drei Stufen: über 80 rem steht alles in einer Zeile; zwischen 48 und
80 rem wird er zweizeilig — oben Wortmarke und Suchfeld, darunter die vollständige
Hauptnavigation mit Trennlinie und 2,75 rem hohen Zielen —, und erst ab 48 rem abwärts weichen
Navigation und Kopfwerkzeuge gemeinsam in das native, tastaturbedienbare Menü. Kein Zustand
blendet die Navigation mit `!important` aus; `tests/visual.spec.ts` misst bei 1024, 1100, 1280 und
1440 px sichtbare Navigationspunkte.

Die Hauptnavigation führt ausschließlich Bereichseinstiege. Bereichsname, Adresse und
Kurzbeschreibung stehen als `PORTAL_SECTIONS` in `packages/shared/src/config/site.ts`; Navigation,
Fehlerseite, Serviceübersicht und Suchfilter lesen sie dort. Der Bereich heißt „Staatsrat“, weil
die Staatsverfassung das Organ an der Spitze der vollziehenden Gewalt so nennt; seine Adresse
bleibt `/staatsregierung/`, weil sie das Politikfeld benennt, eingeführt ist und in
`site-routing.ts` innerhalb des D1-Projektionsabschlusses liegt.

OstRecht führt das Amtsband (`.law-header`): Wappen und Wortmarke „OstRecht · Rechtsportal des
Freistaates“, ein kompaktes Suchfeld und die fünf Bereiche Sachgebiete, A–Z und Register, Amtliche
Veröffentlichungen, Verfassung und Hilfe mit `aria-current`. Über dem Band steht keine
Hinweiszeile; der Hinweis zur Simulation schließt die Seite im Fuß ab, damit der Einstieg mit dem
Hoheitszeichen beginnt – eine bewusste Abweichung vom Staatsportal, das den Hinweis oben führt
(Entscheidung zu E35). Die Familienzugehörigkeit beider Portale tragen drei gemeinsame Anker:
dasselbe Wappen im Kopf, Gold als Markierung des aktiven Navigationspunkts (`aria-current`) und
der 3 px breite Fokusring (`--focus-width`, Staatsblau auf hellen Flächen, Gold im Amtsband).
Kopfstil, Radien und Symbole bleiben verschieden: OstRecht ist als eigenständiges Rechtsportal
erkennbar, nicht als Unterseite. Politische Teaser- und Pressenavigation gehören nicht in diese
Navigation.

Das Amtsband kennt drei Stufen: über 80 rem eine Zeile; bei 80 rem und darunter zweizeilig, mit den
Bereichen als eigener Zeile; unter 60 rem weichen Suche und Bereiche in das Menü „Bereiche“.

Der Fuß ist ein moderater Abschluss in drei Bereichen: Marke (kleines Wappen, Wortmarke,
Rechtsstand und amtlicher Hinweis), „Recherchieren“ (Rechtssuche, Sachgebiete, A–Z und Register,
Amtliche Veröffentlichungen, Änderungsdienst als Sprung zur Startseite, darunter die Gruppe
„Nach Normtyp“ mit den vier Verzeichnissen) und „Service“ (Hilfe, Impressum, Datenschutz,
Barrierefreiheit, Staatsportal); darunter, durch eine Haarlinie getrennt, der Hinweis zur
Simulation. Unter 48 rem wird der Fuß einspaltig und „Recherchieren“ zweispaltig – Recherchewege
links, „Nach Normtyp“ rechts, sodass die vier Verzeichnisse untereinander bleiben. Die Normtypen
sind keine Punkte des Amtsbands, aber von jeder Seite sekundär erreichbar – im Fuß und im Menü
„Bereiche“ unter „Weitere Zugänge“. Die Verzeichnisse der Normtypen tragen über der H1 eine
Brotkrume „OstRecht · <Verzeichnis>“ mit Link zur Startseite (kein Systemwort „Normtyp“).

## Responsives Verhalten

Das Staatsportal hat vier Breakpoints, alle als `max-width` in rem: **80 rem**, **64 rem**,
**48 rem**, **30 rem**. OstRecht (Richtung E) nutzt die Stufen **80 rem**, **60 rem**, **48 rem**,
**40 rem** und **30 rem**. Sie gelten „ab“ der Breite: Abfragen unterhalb einer Stufe enden
0,01 rem darunter (`79.99rem`, `59.99rem`, `47.99rem`, `39.99rem`, `29.99rem`), damit 1280, 960,
768, 640 und 480 px schon zur größeren Stufe zählen. Dieselben Grenzen prüfen die Skripte
(`sheets.ts`, `search-page.ts`, `norm-page.ts`), damit Gestaltung und Verhalten nicht an
verschiedenen Punkten umschalten. Einzige begründete Ausnahme ist das Amtsband: es wird bei genau
1280 px zweizeilig, weil Wortmarke, Suchfeld und fünf Bereiche sonst überlaufen.

- bis 80 rem (kleiner Desktop): in beiden Portalen wird der Kopf zweizeilig – Wortmarke und
  Suchfeld oben, die Navigationsliste als zweite Zeile; das Menü bleibt geschlossen. Der
  Seitenrand des Staatsportals geht von `--space-6` auf `--space-5`. Das Band der Startseite geht
  auf zwei Spalten, die Funktionskarte nimmt die volle Breite. Der Normarbeitsbereich geht von
  drei auf zwei Spalten: Text und Seitenspalte nebeneinander, die Inhaltsübersicht öffnet über
  „Inhalt“ im Kopf als modales Seitenblatt. Die Registeransichten bleiben einspaltig.
- bis 64 rem (Tablet quer, Staatsportal): die Navigationszeile bleibt sichtbar, der Seitenrand
  geht auf `--space-4`, Kartenraster gehen auf zwei Spalten und die Bereichsnavigation klebt nicht
  mehr; der Schnellzugriff geht auf drei Spalten (3 + 2, keine allein stehende Karte).
- bis 60 rem (OstRecht): Suche und Bereiche weichen in das Menü „Bereiche“ des Amtsbands, dort
  bleiben sie erreichbar. Alle zweispaltigen Arbeitsbereiche mit Seitenspalte werden einspaltig:
  Filterspalte der Rechtssuche und der Verzeichnisse als Aufklappbereich über der Liste,
  Protokoll und Seitenspalte der Seite
  „Fassungen und Änderungen“ untereinander. Eine Tabelle neben einer 380 px breiten Seitenspalte
  braucht mehr als 768 px; deshalb liegt diese Grenze bei 60 rem und nicht bei 48 rem.
- bis 48 rem (Tablet hoch): im Staatsportal weichen Navigation und Kopfwerkzeuge in das Menü, die
  Kartenraster werden einspaltig, der Seitenrand geht auf `--space-3`; in OstRecht wird der
  Normarbeitsbereich einspaltig (Kopf → Inhaltsübersicht geschlossen → Fassungsleiste → Text →
  Seitenspalte), die Fassungsleiste wird zum waagerechten Streifen, Filterleisten und
  Formularzeilen stapeln sich.
- bis 40 rem (OstRecht): die Subline der Wortmarke entfällt; im Normkopf bleiben Marke, erste
  Statusangabe und ein künftiger Änderungshinweis, Rechtsherkunft und weitere Angaben stehen in
  den Vorschriftendaten; Tabellen verlieren Normtyp- und Herkunftsspalte.
- bis 30 rem (Smartphone, Staatsportal): auch die Kopfsuche weicht in das Menü, dort bleibt sie
  erreichbar; Kacheln werden einspaltig.

Inhalte werden gestapelt, nicht abgeschnitten oder versteckt. Kein Seitenlayout erzeugt
horizontalen Dokumentüberlauf (geprüft bei 375, 768, 1024, 1100, 1280 und 1440 px). Tabellen dürfen
nur in einem gekennzeichneten Scrollbereich (`.table-wrap`) horizontal rollen; ihre wesentlichen
Informationen bleiben außerhalb zugänglich.

Lange Datenansichten werden über ihren Aufbau geregelt, nicht über eine Seitenhöhe. Eine Seitenhöhe
in Pixeln ist kein Gestaltungsmerkmal: sie hängt an der Bestandsgröße, an der Zeichenlänge der
längsten Zelle, an der Fensterbreite und an der vom Nutzer eingestellten Schriftgröße – eine
Vorgabe, die bei 200 % Textvergrößerung bricht, bestraft Barrierefreiheit. Es gilt stattdessen:
eine Datenansicht gibt höchstens eine Datenseite auf einmal aus (`DEFAULT_PORTAL_PAGE_SIZE`,
gemeinsame `DataPagination`), Sammelblöcke ebenso; Aufklappbereiche stehen beim Seitenaufruf
geschlossen; jeder Abschnitt ist über die Abschnittsnavigation in einem Schritt erreichbar, deren
Sprungziele im ersten Bildschirm stehen. Diese Aussagen sind messbar und stehen als Messungen in
`tests/visual.spec.ts`.

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

Gesetze, Verordnungen, Verwaltungsvorschriften, Förderrichtlinien, Amtliche Veröffentlichungen,
Sachgebiete und A–Z sind Tabellen mit Linien, keine Kartenfamilie (Richtung E, P5/P6). Sie
verwenden dieselben Bausteine aus `apps/recht/src/components/directory/` und `ui/`:

- `NormTable.astro`: eine Zeile je Vorschrift (`data-directory-entry`) mit Titel aus
  `getNormTitleBlock` (Kurztitel als Link, Langtitel in Metaschrift darunter), Abkürzung, Normtyp,
  Geltung als Statusmarke (`StatusMark.astro`, Wort mit Rahmen), Rechtsstand (Fassung seit,
  Änderung) und Rechtsherkunft in Kurzform („Übernommen · geändert“). Die Herkunft ist Text, kein
  Zeichen; unter 60 rem entfällt ihre Spalte (Filter und Vorschriftendaten tragen sie weiter),
  Typseiten wiederholen den Normtyp nicht, unter 40 rem entfällt er auch im A–Z.
- `FilterForm.astro`: GET-Formular (`data-directory-filter`) als Filterspalte oder Leiste über der
  Tabelle, „Zurücksetzen“ immer vorhanden und ohne aktiven Filter ausgegraut (`aria-disabled`),
  die Ergebniszahl in einem Satz (`data-directory-count`); Auswahländerungen senden sofort, ohne
  JavaScript wirkt die Schaltfläche.
- `Pagination.astro`: serverseitige Seiten mit Bereichsangabe („A · 1–50 von 132“).
- `LetterNav.astro`: Buchstabenleiste mit allen 27 Buchstabengruppen, unbelegte sichtbar inaktiv.

Die Sachgebietsübersicht zeigt die amtliche Systematik: acht nummerierte Hauptgruppen mit
Beschreibung, darunter ihre nummerierten Sachgebiete mit Vorschriftenzahl; Sachgebiete ohne
Vorschriften erscheinen nicht. Die Sachgebietsseite nennt die Nummer im Eyebrow („Sachgebiet 71“)
und die Hauptgruppe in der Einleitung. Filter, Facetten und Kennzeichnungen tragen Nummer und
Kurzform („71 Bildungswesen“), die vollständige amtliche Bezeichnung steht auf Übersicht und
Sachgebietsseite; der gespeicherte Wert bleibt die amtliche Bezeichnung.
Die Seiten zählen 50 Einträge (`DEFAULT_PAGE_SIZE`) in allen Verzeichnissen; im A–Z stehen
Vorschriften, Stichwörter und Abkürzungen je zu 50 (`KEYWORD_PAGE_SIZE`) mit den unabhängigen
Parametern `seite`, `stichwortseite` und `abkuerzungsseite`.

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
sind Filter der Rechtssuche; `/rechtsentwicklung/` leitet mit denselben Parameternamen dorthin
weiter. Einen Zählerblock je Herkunftsart gibt es nicht mehr.

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
abweicht. Die Buchstabengruppe der Vorschriften folgt dem Ordnungswort.

### A–Z und Register

Primäre Bereiche besitzen eigene URLs; Hash-Anker dienen ausschließlich sekundären Sprüngen innerhalb einer Ansicht.
Die gemeinsame Seitenfamilie umfasst `/a-z/` (Vorschriften A–Z),
`/a-z/stichwortregister/` (redaktionelle Stichwörter aus `content/stichwortregister.json`) und
`/a-z/abkuerzungen/` (Abkürzungen und Kurztitel). Die Reiter verwenden diese URLs und markieren
genau eine Ansicht mit `aria-current="page"`. Nur `buchstabe` wird zwischen Ansichten übertragen.
Jede Ansicht lädt ihre eigene paginierte Liste; Such- und Seitenparameter bleiben beim Reload erhalten.
Die Buchstabenleiste der Vorschriften zählt Normen nach Ordnungswort; Register bieten alle Buchstaben
an, auch wenn dort keine Stichwörter verzeichnet sind.
Geltung, Rechtsherkunft und übernommene Änderungsvorschriften sind ausschließlich Filter der
Vorschriftentabelle (`geltung`, `herkunft`, `aenderungen`). Abgeleitete Titelwörter erscheinen in den
Wortlisten nicht; sie bleiben durchsuchbar. `/archiv/` bleibt eine dauerhafte Weiterleitung nach `/a-z/`.

### Normkopf und Bereiche der Vorschrift

Fassung, „Fassungen und Änderungen“, Fassungsvergleich und Einzelfassung rendern denselben
`NormHead.astro` aus dem Modell in `apps/recht/src/lib/norm-head.ts` (`buildNormHeadModel`): eine
Kopfzeile (Bereich „Vorschrift“, Sachgebiet, Normtyp, Ausfertigung, Stammfundstelle), die
Überschrift in der Dokumentschrift mit Langtitel und Abkürzung in Klammern, dann die Statuszeile
mit der Statusmarke: zuerst die angezeigte Fassung, danach die Vorschrift („Geltende Fassung seit …
· Vorschrift in Kraft seit …“, bei gleichen Daten „Geltende Fassung · in Kraft seit …“, „zuletzt
geändert durch … mit Wirkung vom …“ mit Fundstelle) und, falls verkündet, der künftige
Änderungshinweis in Gold („Änderung zum <Datum> verkündet (<Fundstelle>)“). Seine Fundstelle ist
die der Änderungsvorschrift: die Verkündung der künftigen Fassung, sonst die letzte Klammer ihres
Vollzitats (`amendingCitation`) – nie die Stammfundstelle, die bei konsolidierten Fassungen in der
ersten Klammer steht und nur in der Kopfzeile erscheint. Alle vier Ansichten (Text, Vorschriftendaten,
Fassungen und Änderungen, Fassungsvergleich) laden den Kopf über `loadNormView`
(`apps/recht/src/lib/norm-view.ts`) und nennen deshalb denselben Änderungsakteur („zuletzt
geändert durch <Kurztitel der Änderungsvorschrift>“). Daten stehen im Kopf numerisch (dd.mm.yyyy). Historische, künftige und
ungeklärte Fassungen tragen ein Statusband über dem Kopf, das mit Wort, Farbe und Weg zur
geltenden Fassung unmissverständlich ist (P3b). Die Rechtsherkunft steht als nachgeordnete Zeile
unter der Statuszeile (auf dem Smartphone nur in den Vorschriftendaten). Werkzeuge: „Inhalt“
(unter 80 rem, öffnet die Inhaltsübersicht), „Vollzitat“ und „Link“ bzw. „Fassungslink“
(kopieren mit Rückmeldung), „Drucken“, „Amtliches PDF“ oder „Als PDF“ (Portalfassung). Darunter
führen die „Bereiche der Vorschrift“ (`NormSectionTabs.astro`) als Reiterzeile zu Text,
Vorschriftendaten, Fassungen und Änderungen sowie Rechtsbeziehungen. Der Wechsel zwischen den
Ansichten verändert den Kopf nicht. Auf dem Smartphone (unter 48 rem, wo die Inhaltsübersicht
nicht neben dem Text steht) begleitet ein verdichteter Normkopf das Lesen
(`NormMiniHead.astro`): eine 44-px-Zeile mit Kurztitel, Abkürzung, der gelesenen Einheit
(„Artikel 12“, gesetzt von `norm-page.ts` aus derselben Beobachtung wie das mitlaufende Zitat)
und der Schaltfläche „Inhalt“, die das vorhandene Seitenblatt öffnet. Sie erscheint, sobald der
Vorschriftskopf nach oben aus dem Bild ist, haftet unter dem sichtbaren Amtsband
(`--law-header-offset`, bei ausgeblendetem Band bei 0), ist bis dahin `hidden` und nicht
fokussierbar, weicht bei offenem Bereichsmenü und offenem Seitenblatt, fehlt im Druck und ab
48 rem, blendet mit 180 ms ein (bei reduzierter Bewegung ohne Übergang) und ist Orientierung,
keine Meldung – keine Live-Region. Ein allein gezeigter Bereich schließt ohne zweite Linie an die
Reiterzeile an, nimmt die Lesebreite `--measure-panel` und wiederholt seinen Namen nicht als
Etikett – der Reiter nennt ihn; für Vorlesen, Druck und Betrieb ohne JavaScript bleibt die
Überschrift im Baum. Alle Reiter funktionieren auch ohne JavaScript als reguläre Seitennavigation.

Alle Angaben zur Vorschrift stehen genau einmal in `NormFacts.astro` („Vorschriftendaten“):
Vollzitat, Fundstelle, Rechtsstand, Geltung, Herkunft mit den verlinkten Änderungsvorschriften,
Quelle, Sachgebiete, Ressort und Vertragsdaten. Sie stehen unter `/norm/<slug>/daten/`, die
Rechtsbeziehungen mit Empfehlungen und Portalbezügen unter `/norm/<slug>/beziehungen/`.
Konkrete Fassungen besitzen dieselben Unterseiten unter `/norm/<slug>/version/<versionId>/`;
beim Reiterwechsel bleibt die Version-ID erhalten. „Fassungen und Änderungen“ führt stets auf
`/norm/<slug>/history/`. Die Textseite enthält ausschließlich Lesebereiche und Seitenspalte,
keine angehängten vollständigen Daten- oder Beziehungsbereiche. Seitennavigation verwendet keine
Hash-Umschaltung oder künstliche Übernahme der Scrollposition.

Die Fassungen stehen in der Seitenspalte der Vorschrift (`NormAside.astro`, „Fassungen dieser
Vorschrift“) als senkrechte Zeitleiste (auf Smartphones vor dem Normtext als horizontaler Streifen): je Fassung Datum, Art (geltend, historisch, künftig,
Inkrafttreten nicht belegt, Ausgangsfassung) in Wort und Marke, Fundstelle; die angezeigte Fassung
ist hervorgehoben. Darunter Zitieren (Normzitat, Link zur Vorschrift oder zur Fassung kopieren),
Vollzitat und Amtliche Quelle. Die Seite „Fassungen und Änderungen“ (P4) führt Abschnittszeile,
Änderungsprotokoll (die Spalte „Verkündet“ nur mit belegten Daten), Fassungen im Wortlaut,
Fassungsvergleich und die Recherche „Fassung zu einem Datum“ (nur für diese Vorschrift; es gibt keine portalweite Stichtagswahl). Die geltende Fassung
heißt überall „Rechtsstand vom <Datum>“.

Umbrechende Metadatenzeilen (Kopfzeile, Statuszeile, Trefferzeilen, Angabenlisten `.r-inline-list`)
trennen ihre Teile allein durch den Abstand des Flex-Rasters; ein Mittelpunkt „·“ steht nur noch
innerhalb eines einzelnen, nicht umbrechenden Wortes („Übernommen · geändert“). So beginnt oder
endet nach einem Umbruch keine Zeile mit einem Trenner.

### Normtext

Abschnittsüberschriften (Teil, Kapitel, Abschnitt) stehen als Versalzeile in `--fs-caption` mit
Vorabstand und dünner Trennlinie, Teil- und Kapiteltitel in `--fs-ui`; Artikel und Paragraphen
tragen ihre Überschrift in der Dokumentschrift in `--fs-h4`, das Gliederungszeichen davor in
derselben Zeile; ein Label ohne Titel („Präambel“) bleibt Überschrift. Zwischen Label und Titel bzw.
Text steht ein echtes Leerzeichen, damit kopierter und vorgelesener Text „Artikel 1
Verfassungsgrundsätze“ und „(1) Die Hauptstadt …“ lautet. Absatz-, Nummern- und
Buchstabenkennzeichnungen gehören zum Fließtext mit fester Adressspalte.

Der Vorschriftentext ist ein durchlaufendes Dokument (Richtung E, P3): jede nicht zitierte
Einheit ist ein `section` mit echter Überschrift, nichts wird auf- oder zugeklappt, es gibt keinen
globalen Umschalter. Absätze stehen mit ihrer Adresse in einer schmalen Spalte (`--col-addr`, 3 rem) links vom
Text; sichtbar ist nur das Absatzzeichen „(1)“, das Gliederungszeichen der Einheit steht in der
Überschrift darüber und bleibt im zugänglichen Namen und im Anker („§ 12 (1)“). Das Lesemaß
`--measure-legal` (66ch) gilt für den Textkörper rechts der Adressspalte: `.norm-body` ist
Maß plus Adressspalte plus Lücke breit, sodass reiner Absatztext bei 1440 px rund 70 Zeichen je
Zeile trägt (mindestens 560 px, gemessen in `tests/visual.spec.ts`) und innerhalb der 690 px
breiten Textspalte bleibt – Raster 260/690/250 und Seitenbreite 80 rem bleiben. Je Einheit stehen in der Kopfzeile die Textlinks
„Link“ (kopiert die Adresse der Stelle) und „Drucken“ (Einzeldruck). Paragraphen, Artikel und
Anlagen tragen sprechende, deterministische Anker; alte Anker bleiben unsichtbare Sprungziele.
Zitierte Bestimmungen (`quotedProvision`) erscheinen als amtlich zitierter Text mit Linie, nicht
als dekoratives Zitat; Unterschriftenblöcke stehen im Fluss. Die Inhaltsübersicht (ab 80 rem als
haftende Spalte links mit Filterfeld und Umfangszeile, darunter als modales Seitenblatt) hebt die
gelesene Stelle hervor. Tabellen und Anlagen nutzen die volle Textspalte und rollen erst darüber
hinaus in `.norm-table-wrap`.

Änderungen stehen am Ort der Änderung: Jede angezeigte Fassung wird gegen ihre unmittelbare
Vorfassung verglichen (`buildNormChangeMarks`, `packages/shared/src/lib/norms/change-marks.ts`,
derselbe strukturelle Textvergleich wie der Fassungsvergleich – kein Redaktionsfeld). Eine
geänderte oder neue Einheit (§, Artikel, Anlage) trägt in ihrer Kopfzeile hinter dem Titel das
Textzeichen „geändert mit Wirkung vom <Datum>“ bzw. „neu mit Wirkung vom <Datum>“ (Jost,
`--fs-caption`, `--status-amended`), verlinkt auf den Vergleich Vorfassung → angezeigte Fassung
mit dem Anker der Einheit (`#vergleich-<Anker>`; jede Vergleichseinheit trägt diesen Anker).
Absätze mit neuem oder geändertem Wortlaut (`.norm-abs--changed`) tragen eine Randlinie
(`--line-mark`) in `--status-amended` und die Fläche `--surface-selected`; ihre Adresse sagt
Vorlesern „geändert“. In der Inhaltsübersicht steht am Eintrag die Kurzmarke „geänd.“ bzw. „neu“
mit dem vollständigen Text als `title` und für Vorleser; Gruppen zählen ihre Marken nicht. Die
Ausgangs- oder Erstfassung trägt keine Marken; entfallene Absätze haben in der angezeigten
Fassung keinen Ort. Im Druck bleiben die Textzeichen, die Flächen entfallen. Der Vergleich kostet
bei langen Vorschriften mehr als 50 ms (Verfassung 70–90 ms), deshalb bleiben die Marken je
(Slug, Vorfassung, Fassung) im Speicher des Workers (`loadNormView`), nicht in der
D1-Projektion.

### Scrollwerkzeuge des Rechtsportals

Das globale Amtsband bleibt mit `position: sticky` im Dokumentfluss. Ab 100 px Seitenposition
blendet es sich bei mindestens 12 px kumulierter Abwärtsbewegung per Transformation nach oben
aus; entsprechende Aufwärtsbewegung blendet es wieder ein. Kleine Richtungswechsel lösen keinen
Zustandswechsel aus. Am Seitenanfang, bei Fokus im Kopf, offenem mobilen Menü oder geöffneten
Suchvorschlägen bleibt es sichtbar. Tastaturfokus blendet es sofort ein. Bei reduzierter Bewegung
bleibt die Funktion ohne Transition erhalten. `shell.ts` bündelt passive Scrollereignisse pro
Animationsframe; ein ResizeObserver setzt `--law-header-height` (die gemessene Kopfhöhe, mit der
das Bereichsmenü rechnet) und `--law-header-offset` (dieselbe Höhe, solange das Band sichtbar
ist, und 0, sobald es ausgeblendet ist). Der Versatz bestimmt `scroll-padding-top` und `top`
sowie `max-height` der haftenden Inhaltsübersicht; sie folgt dem Band mit demselben Übergang
(180 ms, bei reduzierter Bewegung keiner) und nutzt den gewonnenen Platz. Ein Sprung zu einem
Anker derselben Seite gilt nicht als Leserichtung: das Band bleibt, wie es war.

„Zum Seitenanfang“ ist ein sekundäres globales Werkzeug als kleine eckige Schaltfläche mit Pfeil
und mindestens 44 × 44 px Bedienziel. Es erscheint auf allen Breiten erst nach zwei
Bildschirmhöhen (`2 × innerHeight`; kurze Vorschriften zeigen es nie), schreibt keinen URL-Hash
und scrollt bei reduzierter Bewegung sofort. Am Seitenanfang ist es verborgen und nicht
fokussierbar; nach Aktivierung geht der Fokus zur Wortmarke. Bei offenem Bereichsmenü, Dialog,
Einwilligungsbanner oder sichtbarem Footer wird es ausgeblendet, um keine Bedienelemente zu
verdecken. Während der Fahrt trägt das Dokument `data-law-scroll-to-top`; die Inhaltsübersicht
hebt vorbeiziehende Einheiten zwar hervor, rollt aber nur ihren eigenen Container – nie das
Fenster (`revealInOutline` in `norm-page.ts`, kein `scrollIntoView`). Am Ende der Fahrt
(`scrollend` oder Seitenanfang, Ereignis `law:scroll-to-top-end`) bestimmt sie die gelesene
Einheit neu aus den tatsächlichen Positionen (`syncActiveToViewport`: die letzte Einheit, die
oberhalb der Leselinie bei 12 % der Höhe beginnt, sonst die erste), weil eine schnelle Fahrt
Einheiten am Beobachter vorbeiziehen lässt. So kommt die Fahrt auch bei einer Übersicht an, die
länger ist als ihr Container, und die Hervorhebung stimmt danach mit der Leseposition überein.

Das mitlaufende Normzitat nach aktueller Leseposition gehört zur Normansicht; der verdichtete
Normkopf des Smartphones (siehe „Normkopf und Bereiche der Vorschrift“) liest dieselbe Stelle.

### Fassungsvergleich

Sichtbare Vergleichseinheiten sind Paragraphen und Artikel, sofern die Struktur solche Einheiten
enthält. Andernfalls bildet ein sinnvoll benannter struktureller Textcontainer die gemeinsame
Einheit, etwa eine Präambel. Seine Textabsätze erscheinen strukturiert innerhalb einer Synopse,
nicht als Folge eigenständiger Neu-/Entfallen-Karten. Unbenannte Freitextläufe werden nur innerhalb
derselben Lücke zwischen stabilen Absatz- oder Strukturankern gebündelt: ausschließlich links
bedeutet „Entfallen“, ausschließlich rechts „Neu“, auf beiden Seiten „Geändert“. Die Paarung und
die Markierungen der enthaltenen Absätze bleiben erhalten; echte Artikel werden nie zu einem
ganzen Abschnitt zusammengezogen.

Geänderte Einheiten tragen die Marke „Neu“, „Geändert“ oder „Entfallen“ (`.r-status`) und
stehen in genau einer Darstellung nebeneinander: links „Fassung vom <Datum>“ der älteren, rechts
der jüngeren Fassung (`renderNormDiffDocument`). Streichungen links sind durchgestrichen auf
roter Fläche, Einfügungen rechts stehen auf grüner Fläche mit grünem Unterstrich; Farbe ist nie
die einzige Angabe. Jede geänderte Einheit erscheint je Spalte genau einmal gegliedert; der
geglättete Gesamttext des Eintrags dient nur der Erkennung und wird nicht gerendert. Einen
Umschalter „Im Text / Nebeneinander“ gibt es nicht mehr. Der
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

Keine Hero-Fläche (Richtung E, P1): Suchfeld mit Beschriftung in gemischter Schreibweise
(`--fs-meta`), darunter zwei kompakte Zeilen ohne Bestandszahlen – „Schnellzugriff“ auf
redaktionell hervorgehobene Vorschriften (Verfassung und im Bestand vorhandene Kernvorschriften,
nicht „meistgenutzt“, weil keine Nutzungsstatistik vorliegt) und „Nach Normtyp“ mit den vier
Übersichten. Daneben die Sachgebiete als nummerierte Liste der amtlichen Systematik und darunter
eine ruhige Zeile „Alle Sachgebiete · A–Z und Register“ (A–Z ist kein Sachgebiet), darunter der Änderungsdienst als drei Spalten mit Linien: „Neu in
Kraft getreten“, „Verkündet, noch nicht in Kraft“ und „Außer Kraft getreten“ (je fünf Einträge;
leere Spalten zeigen einen Hinweis), zuletzt die Tabelle der jüngsten amtlichen
Veröffentlichungen mit Datum, Gegenstand, Dokumentart und Fundstelle.

Eine Zeile des Änderungsdiensts ist knapper als der Änderungsverlauf der Vorschrift: Datum,
Vorschrift, ein Ereigniswort der Rechtswirkung („erstmals in Kraft“ / „geändert“ / „aufgehoben“,
künftig „tritt in Kraft“ / „wird geändert“ / „tritt außer Kraft“) und darunter die Ursache ohne
das wiederholte Ereigniswort samt Fundstelle (`describeChangeCause`, `shortCitation`). Wo der
Eintragstitel nur das Vollzitat wiederholt, steht die Fundstelle allein. Kein Bedienziel unter
24 px. Startseite und Feed lesen dieselben drei Spalten und Wörter aus
`apps/recht/src/lib/change-service.ts`.

Der Änderungsdienst ist als RSS 2.0 abonnierbar (`/aenderungsdienst/rss.xml`, ein Feed für den
gesamten Dienst – keine Feeds je Vorschrift, keine E-Mail): je Spalte höchstens fünf Einträge mit
Titel „<Kurztitel> <Ereigniswort>“, Ursache und Fundstelle als Beschreibung, der Spalte als
Kategorie, Link auf „Fassungen und Änderungen“ der Vorschrift, dem Datum der Rechtswirkung als
`pubDate` (RFC 822) und einer stabilen Kennung aus Slug, Datum und Ereignisart;
`lastBuildDate` ist der Rechtsstand. Der Link „RSS“ steht in der Kopfzeile des Änderungsdiensts
neben „Vollständiges Protokoll“, jede Seite trägt `<link rel="alternate" type="application/rss+xml">`;
die Sitemap führt den Feed nicht.

### Rechtssuche

Sichtbare H1 „Suche im Landesrecht“ in der Wegweiserschrift, Suchzeile mit Suchbereich, aktive Filter als Chips, „Weitere Filter · Erweiterte Suche“ als
Aufklappbereich (P2b: exakte Wortfolge, Ausschluss, Ressort, Rechtsherkunft, Fassungsbereich,
Geltungstag, Fundstelle, Änderungsvorschriften; alle bisherigen Parameter bleiben) und rechts die
Filterspalte „Eingrenzen“ (Geltung, Normtyp, Sachgebiet mit Zählern). Die Geltung zeigt je Wort
eine Option: „außer Kraft“ filtert `repealed` und `historical` gemeinsam (`validityOptions`,
`data-search-facet-values`); Facettengruppen ohne Option werden nicht gerendert. Die Quelltextfolge
Anfrage → Trefferkopf → Filterspalte → Trefferliste ist zugleich die Reihenfolge unter 60 rem
(Filter als Aufklappbereich vor der Liste). Unter 48 rem verdichtet sich die Anfrage zu zwei
Zweierzeilen unter Suchfeld und Schaltfläche: Suchbereich neben Sortierung, darunter „Weitere
Filter · Erweiterte Suche“ neben „Eingrenzen“; ein geöffneter Bereich nimmt die volle Breite
darunter, ohne JavaScript bleiben beide gewöhnliche Aufklappbereiche. Die Hüllen der Anfrage
werden dafür durchsichtig (`display: contents`), die Quelltextfolge bleibt; der erste Treffer
beginnt bei 390 px spätestens bei 460 px (Messung in `tests/visual.spec.ts`). Treffertitel sind Links in Staatsblau (`--text-link`),
der Auszug steht in `--fs-ui` unter dem Titel; ein Langtitel, der nur Überschrift plus
Klammer-Abkürzung wiederholt, entfällt (`getNormTitleBlock`). Ein Treffer ist ein Eintrag mit Linien, keine Karte: Kurztitel
mit Kennung (Abkürzung · Normtyp), Langtitel darunter, eine Metazeile aus Statusmarke,
Fassungsangabe, Fundstelle und Rechtsherkunft in Worten, dann der Auszug (bis 220 Zeichen) mit der
Trefferstelle als Etikett und die Wege „Fassungen und Änderungen“ sowie weitere passende
Fassungen. Ein Treffer bleibt bei 390 Pixeln Breite unter 300 Pixeln hoch (Messung in
`tests/visual.spec.ts`).

Die Trefferliste ist seitenweise: die Überschrift nennt die vollständige Trefferzahl und die
Sortierung („N Treffer. Sortiert nach …“), der Knopf „Weitere Treffer laden“ nennt den Rest. Die
Reihenfolge nach Relevanz folgt fünf Stufen: Gleichheit mit einer Bezeichnung, Treffer im Titel,
eigene vor übernommenen Änderungsträgern, alle Suchbegriffe in derselben Vorschrift, gewichtete
Volltextrelevanz und zuletzt der Titel. Der Leerzustand heißt „Keine Vorschrift gefunden“, zitiert
die Anfrage und bietet drei Auswege (Filter zurücksetzen mit Anzahl, alle Fassungen, Vorschriften
A–Z); Facetten zählen passende Vorschriften und sind ohne Treffer deaktiviert, außer innerhalb
einer Gruppe mit eigener Auswahl. Filterzeilen haben die barrierearme Höhe von 2,75 rem.

### Rechtsherkunft und Benennungen

Rechtsherkunft ist auf allen Rechtsseiten in Worten sichtbar, nie als Zeichen oder Pille (Texte
ausschließlich aus `packages/shared/src/lib/norms/origin-presentation.ts`; die erklärende Langform
ist `formatNormOriginKind` aus `origin.ts`) in genau zwei Formen: kurz in Tabellen und Trefferzeilen
(„Übernommen · unverändert“, „Übernommen · geändert“, „Ostdeutsch neu“, „Herkunft ungeklärt“; die
Tabellen nutzen dieselbe Kurzform mit Mittelpunkt als Teil des Wortes) und erklärend auf Normseite, in Filtern und
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
Abkürzung steht neben der Überschrift, wenn sie sich von ihr unterscheidet. Eine Klammer am Ende
des Langtitels („… im Freistaat Ostdeutschland (FRL IndiFö)“) wird immer abgetrennt: Ist der Rest
die Überschrift, entfällt der Langtitel, und ohne hinterlegte Abkürzung tritt der Klammerinhalt an
ihre Stelle – kein Titel steht zweimal untereinander. Normkopf, Suchtreffer,
Verzeichniseinträge, Stichwortregister, Brotkrumen, Auswahllisten und Autocomplete verwenden diese
eine Regel; keine Oberfläche bildet eigene Titelvarianten. Formelhafte Kurzbeschreibungen des
Massenimports (`summarySource: "derived"`) werden nirgends als Beschreibung ausgespielt; ohne
redaktionelle Kurzbeschreibung bleibt die Zeile leer.

## Staatsportal

### Startseite

Alle Hauptbänder der Startseite tragen denselben vertikalen Rhythmus (`--space-7`, unter 48 rem
`--space-6`). Hinweisband und Informationsband sind ausdrücklich **ein** Band — gleiche Fläche,
keine Farbgrenze —, deshalb steht zwischen ihnen der halbe Bandabstand statt einer zweiten
Bandkante.

Die Startseite folgt einer festen Hierarchie: Hero mit redaktionellem Staatskanzlei-Bild, H1 und
Portalsuche; zentrale Portalpfade als Zugangskarten (`PortalAccessCard.astro`); wichtiges Hinweisband
(`ImportantNoticeBand.astro`); Presse, aktuelle Ministerien und Freistaat-Kurzprofil
(`HomePressList.astro`, `HomeMinistryList.astro`, `FreestateSummary.astro`); „Aktuelles
Regierungshandeln“ mit einem Leitvorhaben als dunkler Karte (`home-lead-feature`) und bis zu zwei
weiteren Vorhaben; Recht, Haushalt und weitere Serviceangebote; Serviceband und Footer. Suchvorschläge,
Karten und Listen verweisen ausschließlich auf vorhandene Seiten. Hervorhebungen sind redaktionelle
Entscheidungen aus den Themendaten; es gibt keine zweite manuelle Startseitenliste.

### Karten, Raster und Formulare

Eine Kartenbasis trägt Polster, Rahmen, Radius, Hover und Titelgröße: `.portal-card` (mit `.panel`
als eingeführtem Namen derselben Rolle) gilt für `EventCard`, `GovernmentMemberCard`,
`JobOfferCard`, `MinistryCard`, `PressReleaseCard`, `ServiceCard`, `SpeechCard` und `TopicCard`.
Die Komponenten bestimmen nur noch ihren Inhalt.

Die Rasterklassen sagen, was sie tun: `.card-grid--two` sind zwei Spalten, `.card-grid--three`
drei, `.card-grid--four` vier; unter 64 rem werden daraus zwei, unter 48 rem eine. Eine einzelne
Karte behält damit die Breite ihrer Spalte und wird nie zum Vollbreitenband. Die Spaltenzahl eines
Rasters, dessen Kartenzahl schwankt, kommt aus `getBalancedColumnCount`: sieben Zugangskarten
stehen als 4 + 3, acht als 4 + 4, sechs als 3 + 3 — nie eine Karte allein in der letzten Reihe.
Die Rasterlücke ist größer als das seitliche Innenpolster der Karte.

Kennzahlenkarten sind quantitativen Werten vorbehalten (`isMetricValue`); Textangaben stehen als
Beschreibungsliste (`.fact-list`).

Ein Formularmuster trägt alle Such- und Filterleisten: `.filter-bar` setzt das Raster,
`.filter-field` Beschriftung, Feldhöhe (2,75 rem), Rahmen und Fokus. Das Rechtsportal folgt
demselben Grundsatz mit `FilterForm.astro`. Es gibt nur `:focus-visible`-Regeln; keine Leiste
überschreibt den globalen Fokusring beim Klicken.

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

Lange Datenansichten blättern zu 25 Zeilen (`DEFAULT_PORTAL_PAGE_SIZE`). Beteiligungsnavigator und
Kreistabelle teilen Rechnung (`getPageState`), Wortlaut und Leiste (`DataPagination.astro`); beide
geben die erste Seite im HTML aus, laden den Rest aus ihrer Datendatei und nennen ohne JavaScript
den vollständigen Datensatz. Die Bereichsnavigation (`SectionNavigation`) bleibt ab 64 rem klebend;
ihre Sprungziele werden gegen die vorhandenen `id`-Attribute geprüft.

Die Kreisreform-Seite liefert die Gebietssuche als Text; die interaktive Karte wird erst nach
ausdrücklicher Freigabe geladen. Die Behördennummer 115 ist ein Orientierungsbegriff aus der
zentralen Konfiguration und verweist auf den Kontaktbereich; ein `tel:`-Link erscheint nur bei
ausdrücklich konfiguriertem Telefonweg.

### Wortliste für Stände

`siteConfig.vocabulary` legt die Begriffe fest, und die Oberflächen lesen sie dort: **Stand** ist
der redaktionelle Stand einer Portalseite, **Datenstand** der Stand eines Datenbestands,
**Ausgangsstichtag** der Beginn einer Zeitreihe, **Stichtag** der Bezugstag einer Erhebung. Der
**Rechtsstand** des Rechtsportals steht in `lawSiteConfig.vocabulary` und bezeichnet ein Datum der
Rechtslage; er wird bewusst nicht mit „Stand“ gleichgesetzt. Wörter, die dieselbe Sache anders
benennen — „Fachstand“, „Sachstand“, „Bearbeitungsstand“ —, prüft `tests/visual.spec.ts` weg.

### Portalsuche und Portalinventar

Das Portalinventar (`apps/portal/src/lib/route-inventory.ts`) ist die einzige Liste der
öffentlichen Portalseiten. `sitemap.xml`, die Serviceübersicht und der Suchindex lesen sie; es gibt
keine zweite Seitenliste und kein Nachparsen der Sitemap. Werkzeugseiten (Suche, Fehlerseiten,
Datenendpunkte) stehen nicht darin.

Der Suchbestand liegt in zwei Dateien. `/search-index.json` trägt die Portalinhalte mit ihrem
sichtbaren Fließtext und wird sofort geladen; `/search-index-recht.json` trägt die Bezeichnungen
des Rechtsbestands in schmaler Form (dieselbe Grundmenge wie die Verzeichnisse von OstRecht) und
wird erst geholt, wenn der Bereichsfilter das Recht einschließt. Die Trefferliste weist
„Staatsportal“ und „Recht“ als getrennte Gruppen aus und verweist für den Volltext auf die
Rechtssuche. Die Reihenfolge folgt fünf Stufen — Gleichheit mit einer Bezeichnung, Bezeichnung
beginnt mit der Anfrage, Bezeichnung enthält sie, Kurzbeschreibung, Volltext — und gibt
Portalseiten einen Bereichsbonus, der eine exakt eingegebene Abkürzung nicht verdrängt. Ein
Volltexttreffer zeigt einen Ausschnitt um die Fundstelle mit hervorgehobenem Begriff.

## Barrierefreiheit

- genau eine H1 pro Seite, semantische Landmarken, nachvollziehbare Überschriftenfolge
- Skip-Link, sichtbarer Tastaturfokus mit mindestens 3 : 1 gegen seine Bezugsfläche und 3 px Umriss
  (`--focus-width`, dieselbe Stärke wie im Staatsportal; Staatsblau auf hellen Flächen, Gold im Amtsband)
- `aria-current` für den aktiven Hauptnavigationspunkt; native `details` für Menüs und
  Aufklappbereiche. Die Einheiten des Vorschriftentextes sind Abschnitte mit echter Überschrift
  und werden nicht auf- oder zugeklappt.
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
bei 1280 px stehen Inhaltsübersicht, Text und Seitenspalte in drei Spalten, bei 1152 px Text und
Seitenspalte in zwei; auf den Mobilbreiten ist der Normkopf höchstens 320 px hoch und der
Vorschriftentext beginnt spätestens bei 700 px.

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

Mobile Recherche: Die erweiterte Suche öffnet als natives modales Vollbild-Blatt mit aufklappbaren Filtergruppen und haftenden Aktionen. Escape schließt das Blatt; ohne JavaScript bleibt die Filterfläche ein gewöhnlicher Aufklappbereich.
