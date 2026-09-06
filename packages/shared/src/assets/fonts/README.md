# Schriften

Alle Familien werden lokal ausgeliefert, ohne Anfragen an Dritte.

| Datei | Familie | Achsen | Größe |
| --- | --- | --- | --- |
| `Jost-Variable.woff2` | Jost (OFL) | wght 100–900 | 34 KB |
| `SourceSerif4Variable-Roman.woff2` | Source Serif 4 (Adobe, OFL, `LICENSE-SourceSerif4.md`) | wght 400–700, opsz 12–48 | 86 KB |
| `OstGrotesk-Regular.woff` | Ost Grotesk (aus Neu5Land, OFL, `LICENSE-OstGrotesk.md`) | fester Schnitt 400 | 11 KB |
| `OstGrotesk-Bold.woff` | Ost Grotesk | fester Schnitt 700 | 12 KB |

Rollen: Jost trägt die Oberfläche (Navigation, Titel der Bereichsseiten, Verzeichnisse,
Trefferlisten, Formulare, Metadaten), Source Serif 4 das Dokument (Normtext samt Gliederung,
H1 der Normseiten, verglichener Text, Vollzitat), Ost Grotesk die Wegweiserebene (Wortzeichen
beider Portale, Ordnungsnummern von Paragraphen und Artikeln, Buchstabenleiste, Abkürzungen und
Verkündungssigel, Kennzahlen, Zugangskarten der Startseite, Ortsnamen der Gebietstabellen).
Token: `--font-sans`, `--font-document` und `--font-sign` in `styles/foundation.css`; die
Wegweiserstellen stehen dort als eine einzige Regel am Dateiende.

## Ost Grotesk

Abgeleitet aus **Neu5Land** von Uwe Borchert, einer Digitalisierung der Schmalen Erbar-Grotesk
(Jakob Erbar, ab 1922). Die schmale Erbar war die verbreitete Schildschrift der DDR; dieselbe
Familie steht auch hinter der West-Berliner Straßenbeschriftung. Zwei feste Schnitte, keine
Gewichtsachse — Gewichte zwischen 400 und 700 gibt es nicht, Anwendungsstellen müssen mit den
beiden auskommen.

Ergänzt wurde eine **tz-Ligatur nach dem Vorbild der Berliner Straßenschilder**: das
zusammengefügte tz, bei dem beide Buchstaben einen Balken teilen. In der Vorlage enden der
Querbalken des t und der obere Balken des z beide an der x-Höhe und sind fast gleich dick; die
Ligatur schiebt das z so weit unter den Querbalken, dass die zwei Balken zu einem durchgehenden
waagerechten Strich werden, der links den t-Stamm und rechts den z-Abstrich trägt. Es wird nichts
verbogen oder angehängt — die Buchstaben werden nur ineinandergeschoben; der Vorschub sinkt von
556 auf 471 Einheiten (fett von 630 auf 545). Sie ist als *discretionary* Ligatur (`dlig`)
registriert und greift deshalb nur, wo die Gestaltung sie ausdrücklich anfordert — nie im
Fließtext, in Normtexten oder in Trefferlisten.

```sh
python3 scripts/build-sign-font.py Neu5Land_Norm.ttf \
  --out packages/shared/src/assets/fonts/OstGrotesk-Regular.woff --style Regular
python3 scripts/build-sign-font.py Neu5Land_Fett.ttf \
  --out packages/shared/src/assets/fonts/OstGrotesk-Bold.woff --style Bold
```

Die Vorlagendateien liegen nicht im Repository. Ausgeliefert wird woff (zlib) statt woff2, weil
`brotli` in der Bauumgebung nicht verfügbar war; mit brotli erzeugt dasselbe Werkzeug woff2, wenn
die Endung `.woff2` lautet — rund 3 KB je Schnitt weniger. Wie eng die Buchstaben ineinander
greifen, steuert `--overlap` (Standard 10 Einheiten je 1000); die Balkenmaße leitet das Werkzeug
je Schnitt aus den Konturen ab, deshalb gilt derselbe Wert für beide. Weil die Unterkanten der
zwei Balken um wenige Einheiten auseinanderliegen (3 im normalen, 17 im fetten Schnitt), führt
ein flacher Keil die eine Kante in die andere über. Die Ligatur bleibt auf der Grundlinie und
verändert die Zeilenbox nicht.

### Lizenz

Die Vorlagendateien selbst führen **keine** Lizenz in der Namenstabelle (name-ID 13 und 14 sind
nicht gesetzt); die Lizenz steht in der `FONTLOG.txt` des Auslieferungspakets und lautet dort
„OFL Open Font License“ mit Verweis auf `http://scripts.sil.org/OFL`. Wortlaut, Urheberzeile und
der Lizenztext liegen in `LICENSE-OstGrotesk.md`. Einen Reserved Font Name erklärt die Vorlage
nicht; die Umbenennung erfolgt trotzdem, damit die abgeleitete Schrift nicht mit Neu5Land
verwechselt wird. Die Urheberzeile der Vorlage bleibt in beiden erzeugten Dateien erhalten und
wird um den Hinweis auf die Ableitung ergänzt.

## Untersetzung

Zeichenumfang aus dem Bestand abgeleitet (Latin, Latin-1, Latin Extended-A, allgemeine
Interpunktion, → und Ligaturen); Layout-Features auf kern, liga, calt, ccmp, locl, mark, mkmk, rvrn
beschränkt. Werkzeuge: fonttools ≥ 4.64 mit brotli (`python3 -m venv .venv && .venv/bin/pip install
fonttools brotli`). Quelle für Source Serif 4: Release 4.005R,
`VAR/SourceSerif4Variable-Roman.ttf` aus `source-serif-4.005_Desktop.zip`.

```sh
UNI="U+0020-007E,U+00A0-00FF,U+0100-017F,U+02C6,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+FB00-FB04"
FEAT="kern,liga,calt,ccmp,locl,mark,mkmk,rvrn"
pyftsubset SourceSerif4Variable-Roman.ttf --unicodes="$UNI" --layout-features="$FEAT" \
  --flavor=woff2 --no-hinting --desubroutinize --output-file=ss4-subset.woff2
python3 - <<'PY'
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
font = instancer.instantiateVariableFont(TTFont('ss4-subset.woff2'), {'wght': (400, 700), 'opsz': (12, 48)})
font.flavor = 'woff2'
font.save('SourceSerif4Variable-Roman.woff2')
PY
pyftsubset Jost-Variable.ttf --unicodes="$UNI" --layout-features="$FEAT" --flavor=woff2 --no-hinting \
  --output-file=Jost-Variable.woff2
```

Budget: gesamte Schriftübertragung höchstens 270 KB (das Doppelte der früheren 135 KB TTF);
Stand: 143 KB (Jost 34, Source Serif 4 86, Ost Grotesk 23).

## Rückfallschnitte

Gemessen am 5. September 2026 mit `scripts/measure-font-fallbacks.mjs` (Chromium aus Playwright,
16 px, Kerning an). Kandidatendateien: Arial und Georgia aus macOS (metrisch gleich Windows und iOS),
Liberation 2.1.5 und DejaVu 2.37 aus den Ubuntu-noble-Paketen `fonts-liberation` und
`fonts-dejavu-core` (der Stand des Playwright-Containers), Roboto 3.005 und Noto Serif 1.07 aus dem
AOSP-Quellbaum (`platform/external/roboto-fonts`, `platform/external/noto-fonts`). Die Dateien liegen
nicht im Repository.

### Wird ein Rückfallschnitt gebraucht?

Tauschphase = Ende der Schriftübertragung (`responseEnd`) minus erster Anstrich (FCP), kalter Cache,
Netz per DevTools-Protokoll gedrosselt, 390 px, je zwei Läufe pro Seite (Startseite Staatsportal,
OstRecht-Suche, Normseite), lokal gegen `serve-site`/`serve-law-worker` und gegen die Produktion auf
Cloudflare (HTTP/2):

| Schrift | Preload | lokal | 4G | Fast 3G | Slow 3G |
| --- | --- | --- | --- | --- | --- |
| Jost, 33 KB | jede Seite | 0 ms | 0 ms | 0 ms | 0 ms (72 von 72 Läufen fertig vor dem ersten Anstrich) |
| Source Serif 4, 86 KB | Normseiten | 0 ms | 0–5 ms | 157–179 ms | 1027–1093 ms (Produktion) |

Entscheidung: Jost ohne Rückfallschnitt – nach Jost folgt direkt `system-ui`; ein Schnitt hätte in
keiner Messung etwas zu tun bekommen und würde im Fehlerfall (Schrift blockiert) den Text dauerhaft
verkleinern. Source Serif 4 mit einem Schnitt je Plattformfamilie.

### Herleitung

- `size-adjust` = Breite eines deutschen Fließtexts in Source Serif 4 ÷ Breite desselben Texts in der
  Kandidatenschrift (16 px, mit Kerning). Die Optical-Size-Achse macht das Verhältnis größenabhängig:
  bei 24 px liegt es rund 4,5 % niedriger; maßgeblich ist die Lesegröße des Normtexts (16 px).
- `ascent-override` = 1,036 ÷ size-adjust, `descent-override` = 0,335 ÷ size-adjust,
  `line-gap-override` 0 (Source Serif 4: hhea, typo und win gleich 1036/335 je 1000 Einheiten, kein
  Zeilenabstand). Damit misst die Zeilenbox des Rückfallschnitts bei 16 px genau wie Source Serif 4
  (22,00 px), und die Grundlinie liegt an derselben Stelle.
- Gegenprobe im Browser: Restabweichung der Fließtextbreite ≤ 0,1 %, Zeilenbox 22,00 px, Ascent
  1,036 em und Descent 0,335 em in allen vier Schnitten.

| Kandidat (`local()`) | Plattform | Breitenverhältnis 16 px | `size-adjust` | `ascent-override` | `descent-override` |
| --- | --- | --- | --- | --- | --- |
| Georgia | Windows, macOS, iOS | 1,0423 | 104,2 % | 99,4 % | 32,1 % |
| Noto Serif 1.07 (`Noto Serif`, `NotoSerif`) | Android | 0,9673 | 96,7 % | 107,1 % | 34,6 % |
| DejaVu Serif 2.37 (`DejaVu Serif`, `DejaVuSerif`) | Linux | 0,8989 | 89,9 % | 115,2 % | 37,3 % |
| Liberation Serif 2.1.5 (`Liberation Serif`, `LiberationSerif`) | Linux ohne DejaVu | 1,1454 | 114,5 % | 90,5 % | 29,3 % |

Reihenfolge im Token `--font-document`: Georgia, Noto Serif, DejaVu Serif, Liberation Serif, `serif`.
Jeder Schnitt trägt einen eigenen Familiennamen; eine Familie, deren `local()`-Quellen fehlen, fällt
aus dem Stapel heraus, die nächste greift.

Zum Vergleich die gemessenen, **nicht eingesetzten** Werte für Jost (Oberfläche, Ascent/Descent
1070/375 je 1000): Arial und Liberation Sans 94,6 % / 113,1 % / 39,6 %; Roboto 3.005 95,0 % / 112,6 % /
39,5 %; DejaVu Sans 2.37 83,9 % / 127,5 % / 44,7 % (Mittel aus Oberflächentexten und Fließtext).
