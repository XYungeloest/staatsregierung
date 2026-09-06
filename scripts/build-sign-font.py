#!/usr/bin/env python3
"""Erzeugt die Wegweiserschrift „Ost Grotesk“ aus der Vorlage Neu5Land.

Die Vorlage (Uwe Borchert, nach der Schmalen Erbar-Grotesk von Jakob Erbar) liegt
nicht im Repository; sie wird zum Bauen daneben gelegt. Das Werkzeug

  1. meldet Lizenz und Namen aus der Vorlagendatei,
  2. ergänzt eine tz-Ligatur nach dem Vorbild der Berliner Straßenschilder,
  3. registriert sie als discretionary Ligatur (dlig), damit sie nur dort greift,
     wo die Gestaltung sie anfordert, und nie im Fließtext,
  4. benennt die Familie um und behält die Urheberzeile der Vorlage,
  5. untersetzt auf den Zeichensatz des Projekts.

    python3 scripts/build-sign-font.py Neu5Land_Norm.ttf \
      --out packages/shared/src/assets/fonts/OstGrotesk-Regular.woff --style Regular
    python3 scripts/build-sign-font.py Neu5Land_Fett.ttf \
      --out packages/shared/src/assets/fonts/OstGrotesk-Bold.woff --style Bold

Endung .woff2 statt .woff verlangt das Modul brotli; ohne brotli schreibt das
Werkzeug woff (zlib), das jeder Browser seit 2012 versteht.

Die Ligatur: In der Vorlage liegen der Querbalken des t und der obere Balken des z
auf derselben Höhe (beide enden an der x-Höhe) und sind fast gleich dick. Die
Berliner Form nutzt genau das — sie schiebt das z so weit unter den Querbalken,
dass beide Balken zu einem durchgehenden waagerechten Strich verschmelzen, der
links den t-Stamm und rechts den z-Abstrich trägt. Nichts wird verbogen oder
angehängt; die Buchstaben werden nur ineinandergeschoben. Weil die Unterkanten
der beiden Balken je Schnitt um wenige Einheiten auseinanderliegen (3 im normalen,
17 im fetten), führt ein flacher Keil die eine Kante in die andere über.
"""
import argparse
import os
import sys

from fontTools import subset
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

UNICODES = ("U+0020-007E,U+00A0-00FF,U+0100-017F,U+02C6,U+02DC,U+2000-206F,"
            "U+20AC,U+2122,U+2190-2193,U+2212,U+FB00-FB04")
FEATURES = ["kern", "liga", "dlig", "calt", "ccmp", "locl", "mark", "mkmk", "rvrn"]


def melde_vorlage(font, pfad):
    print(f"Vorlage {pfad}")
    for nid, label in ((0, "Urheber"), (1, "Familie"), (2, "Schnitt"),
                       (5, "Version"), (13, "Lizenz"), (14, "Lizenz-URL")):
        wert = font["name"].getDebugName(nid)
        print(f"  {label:11}({nid:>2}): {wert if wert else '— nicht gesetzt —'}")
    if not font["name"].getDebugName(13):
        print("  Hinweis: Die Datei nennt keine Lizenz; sie steht in der FONTLOG.txt des")
        print("           Auslieferungspakets. Siehe assets/fonts/LICENSE-OstGrotesk.md.")


def glyphname(font, zeichen):
    return font.getBestCmap()[ord(zeichen)]


def _punkte(font, zeichen):
    zug = RecordingPen()
    font.getGlyphSet()[glyphname(font, zeichen)].draw(zug)
    return [p for _, args in zug.value if args for p in args if isinstance(p, tuple)], zug


def masse(font):
    """Querbalken des t und oberen Balken des z aus den Konturen ableiten.

    Der Querbalken des t endet rechts am äußersten Punkt der Glyphe; seine Ober- und
    Unterkante sind die beiden y-Werte dort. Der obere Balken des z reicht von der
    x-Höhe bis zu der Kante, an der der Abstrich ansetzt.
    """
    tp, _ = _punkte(font, "t")
    zp, _ = _punkte(font, "z")
    t_rechts = max(x for x, _ in tp)
    t_kanten = sorted({y for x, y in tp if abs(x - t_rechts) < 2})
    z_oben = max(y for _, y in zp)
    z_unten = min(y for _, y in zp if y > z_oben * 0.7)
    z_links = min(x for x, y in zp if y >= z_unten - 1)
    return {
        "t_rechts": t_rechts, "t_unten": t_kanten[0], "t_oben": t_kanten[-1],
        "z_links": z_links, "z_unten": z_unten, "z_oben": z_oben,
    }


def _keil(m, versatz, links_ein=28, rechts_ein=52):
    """Flacher Übergang von der Unterkante des t-Querbalkens zu der des z-Balkens."""
    z_links = m["z_links"] + versatz
    return [
        (m["t_rechts"] - links_ein, m["t_oben"]),
        (z_links + rechts_ein, m["z_oben"]),
        (z_links + rechts_ein, m["z_unten"]),
        (m["t_rechts"] - links_ein, m["t_unten"]),
    ]


def baue_ligatur(font, ueberlappung):
    glyf, hmtx, gs = font["glyf"], font["hmtx"], font.getGlyphSet()
    gt, gz = glyphname(font, "t"), glyphname(font, "z")
    m = masse(font)
    versatz = m["t_rechts"] - m["z_links"] - ueberlappung

    stift = TTGlyphPen(gs)
    gs[gt].draw(stift)
    zug = RecordingPen()
    gs[gz].draw(zug)
    zug.replay(TransformPen(stift, (1, 0, 0, 1, versatz, 0)))

    keil = _keil(m, versatz)
    stift.moveTo(keil[0])
    for punkt in keil[1:]:
        stift.lineTo(punkt)
    stift.closePath()

    name = "t_z"
    glyf[name] = stift.glyph()
    hmtx[name] = (versatz + hmtx[gz][0], hmtx[gt][1])
    reihenfolge = list(font.getGlyphOrder())
    if name not in reihenfolge:
        reihenfolge.append(name)
    font.setGlyphOrder(reihenfolge)
    glyf.glyphOrder = reihenfolge
    font["maxp"].numGlyphs = len(reihenfolge)
    return name, versatz, m


def registriere_dlig(font, ligatur):
    gt, gz = glyphname(font, "t"), glyphname(font, "z")
    if "GSUB" in font:
        del font["GSUB"]
    addOpenTypeFeaturesFromString(font, f"feature dlig {{ sub {gt} {gz} by {ligatur}; }} dlig;")


def benenne_um(font, familie, schnitt):
    voll = f"{familie} {schnitt}".strip()
    urheber = font["name"].getDebugName(0) or ""
    werte = {
        0: f"{urheber} | Ost Grotesk: tz-Ligatur ergaenzt und Zeichensatz untersetzt "
           f"fuer den Freistaat Ostdeutschland",
        1: familie, 2: schnitt, 4: voll, 6: voll.replace(" ", ""), 16: familie, 17: schnitt,
    }
    for nid, wert in werte.items():
        font["name"].setName(wert, nid, 3, 1, 0x409)
        font["name"].setName(wert, nid, 1, 0, 0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("quelle")
    ap.add_argument("--out", required=True)
    ap.add_argument("--family", default="Ost Grotesk")
    ap.add_argument("--style", default="Regular")
    ap.add_argument("--overlap", type=int, default=10,
                    help="Einheiten, um die der z-Balken in den t-Querbalken greift")
    a = ap.parse_args()

    font = TTFont(a.quelle)
    melde_vorlage(font, a.quelle)
    ligatur, versatz, m = baue_ligatur(font, a.overlap)
    registriere_dlig(font, ligatur)
    benenne_um(font, a.family, a.style)
    print(f"  tz-Ligatur: Balken des t bis {m['t_rechts']}, z um {versatz} verschoben, "
          f"Überlappung {a.overlap}")

    optionen = subset.Options()
    optionen.layout_features = FEATURES
    optionen.hinting = False
    optionen.desubroutinize = True
    optionen.name_IDs = ["*"]
    optionen.name_legacy = True
    optionen.notdef_outline = True
    schneider = subset.Subsetter(options=optionen)
    schneider.populate(unicodes=subset.parse_unicodes(UNICODES), glyphs=[ligatur])
    schneider.subset(font)

    font.flavor = "woff2" if a.out.endswith(".woff2") else "woff" if a.out.endswith(".woff") else None
    font.save(a.out)
    print(f"  {len(font.getGlyphOrder())} Glyphen -> {a.out} ({os.path.getsize(a.out)} Bytes)\n")


if __name__ == "__main__":
    sys.exit(main())
