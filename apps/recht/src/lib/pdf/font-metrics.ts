/**
 * Zeichenbreiten der eingebauten PDF-Schriften (Adobe-Core-14-Metriken für Helvetica,
 * Helvetica-Bold und Helvetica-Oblique). Die Tabellen stehen je Windows-1252-Code in 1/1000 der
 * Schriftgröße; sie sind reine Daten, keine Bibliothek, und werden nur für den Zeilenumbruch
 * gebraucht. Helvetica-Oblique hat dieselben Breiten wie Helvetica. Nicht belegte Codes haben die
 * Breite 0; sie kommen im kodierten Text nicht vor (siehe winansi.ts).
 */

/** Schriftschlüssel im PDF: Grundschrift, Halbfett (Überschriften), Kursiv (zitierte Vorschriften). */
export type PdfFontKey = 'F1' | 'F2' | 'F3';

// prettier-ignore
const HELVETICA = Uint16Array.from([
  /* 32 */ 278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  /* 48 */ 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  /* 64 */ 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  /* 80 */ 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  /* 96 */ 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  /* 112 */ 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 0,
  /* 128 */ 556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  /* 144 */ 0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667,
  /* 160 */ 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  /* 176 */ 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  /* 192 */ 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  /* 208 */ 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  /* 224 */ 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
  /* 240 */ 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500,
]);

// prettier-ignore
const HELVETICA_BOLD = Uint16Array.from([
  /* 32 */ 278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  /* 48 */ 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  /* 64 */ 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  /* 80 */ 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  /* 96 */ 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  /* 112 */ 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 0,
  /* 128 */ 556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  /* 144 */ 0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667,
  /* 160 */ 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  /* 176 */ 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  /* 192 */ 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  /* 208 */ 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  /* 224 */ 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278,
  /* 240 */ 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556,
]);

const FIRST_CODE = 32;

/** Breitentabelle einer Schrift; Kursiv teilt die Metriken der Grundschrift. */
function widthsOf(font: PdfFontKey): Uint16Array {
  return font === 'F2' ? HELVETICA_BOLD : HELVETICA;
}

/** Breite eines einzelnen Zeichens in 1/1000 der Schriftgröße. */
export function glyphWidth(code: number, font: PdfFontKey): number {
  const widths = widthsOf(font);
  const index = code - FIRST_CODE;
  return index >= 0 && index < widths.length ? widths[index] : 0;
}

/** Breite eines nach Windows-1252 kodierten Textes in Punkt. */
export function textWidth(bytes: Uint8Array, font: PdfFontKey, size: number): number {
  const widths = widthsOf(font);
  let sum = 0;
  for (const byte of bytes) {
    const index = byte - FIRST_CODE;
    sum += index >= 0 && index < widths.length ? widths[index] : 0;
  }
  return (sum * size) / 1000;
}

/** PDF-Namen der eingebauten Schriften in der Reihenfolge der Schriftschlüssel. */
export const PDF_BASE_FONTS: ReadonlyArray<{ key: PdfFontKey; baseFont: string }> = [
  { key: 'F1', baseFont: 'Helvetica' },
  { key: 'F2', baseFont: 'Helvetica-Bold' },
  { key: 'F3', baseFont: 'Helvetica-Oblique' },
];
