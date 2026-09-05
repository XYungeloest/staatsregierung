# Schriften

Beide Familien werden lokal ausgeliefert, ohne Anfragen an Dritte.

| Datei | Familie | Achsen | Größe |
| --- | --- | --- | --- |
| `Jost-Variable.woff2` | Jost (OFL) | wght 100–900 | 34 KB |
| `SourceSerif4Variable-Roman.woff2` | Source Serif 4 (Adobe, OFL, `LICENSE-SourceSerif4.md`) | wght 400–700, opsz 12–48 | 86 KB |

Rollen: Jost trägt die Oberfläche (Navigation, Titel der Bereichsseiten, Verzeichnisse,
Trefferlisten, Formulare, Metadaten), Source Serif 4 das Dokument (Normtext samt Gliederung,
H1 der Normseiten, verglichener Text, Vollzitat). Token: `--font-sans` bzw. `--font-document`
in `styles/foundation.css`.

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
Stand: 120 KB.
