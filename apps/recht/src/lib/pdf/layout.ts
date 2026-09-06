import { toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';
import type { NormBodyBlock } from '@ostrecht/shared/lib/norms/schema.ts';

import { glyphWidth, textWidth, type PdfFontKey } from './font-metrics.ts';
import { toWinAnsiBytes } from './winansi.ts';

/**
 * Satz der Fassungs-PDF: Der Vorschriftentext wird in derselben Reihenfolge wie in der
 * Bildschirmansicht (NormBody.astro) zu Absätzen verflacht, die Absätze werden nach den
 * Zeichenbreiten der eingebauten Schrift umbrochen und anschließend auf Seiten verteilt.
 * Überschriften bleiben mit dem folgenden Absatz zusammen. Der Satz ist rein rechnerisch und
 * deterministisch; er kennt weder Datum noch Zufall.
 */

/** DIN A4 in Punkt (1 pt = 1/72 Zoll). */
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
/** Seitenrand 20 mm. */
export const PAGE_MARGIN = 56.7;
export const TEXT_WIDTH = PAGE_WIDTH - 2 * PAGE_MARGIN;
/** Oberste Grundlinie des Textes und unterste zulässige Grundlinie. */
export const CONTENT_TOP = PAGE_HEIGHT - PAGE_MARGIN;
export const CONTENT_BOTTOM = PAGE_MARGIN + 16;
/** Grundlinien des laufenden Kopfes und des Fußes, beide im Seitenrand. */
export const RUNNING_HEADER_Y = PAGE_HEIGHT - 38;
export const FOOTER_Y = PAGE_MARGIN - 22;

export const BODY_SIZE = 10.5;
export const SMALL_SIZE = 8.5;
export const LINE_FACTOR = 1.35;
/** Einrückung je Gliederungsstufe. */
export const INDENT_STEP = 14;

const WORD_GAP = 4;
const MIN_HANGING_INDENT = 18;
const SPACE = Uint8Array.from([0x20]);

export interface PdfParagraph {
  /** Fließtext des Absatzes. */
  text: string;
  /** Gliederungszeichen mit hängendem Einzug, zum Beispiel „(1)“ oder „a)“. */
  label?: string;
  font: PdfFontKey;
  size: number;
  /** Linker Einzug in Punkt. */
  indent: number;
  spacingBefore: number;
  /** Überschriften bleiben mit dem folgenden Absatz auf einer Seite. */
  keepWithNext: boolean;
  /** Graustufe des Textes (0 = schwarz). */
  gray?: number;
}

export interface PdfRun {
  bytes: Uint8Array;
  font: PdfFontKey;
  size: number;
  x: number;
  gray: number;
}

export interface PdfLine {
  runs: PdfRun[];
  height: number;
  spacingBefore: number;
  keepWithNext: boolean;
  /** Rechte Kante der Zeile in Punkt; für die Prüfung des Umbruchs. */
  width: number;
}

export interface PdfPage {
  runs: Array<PdfRun & { y: number }>;
}

const HEADING_TYPES = new Set(['part', 'chapter', 'section', 'subsection', 'annex']);
const UNIT_TYPES = new Set(['paragraph', 'article']);
const HANGING_CHILD_TYPES = new Set(['subparagraph', 'item', 'subitem']);

function joined(values: Array<string | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).map((value) => toDisplayText(value)).join(' ').replace(/\s+/gu, ' ').trim();
}

/** Gesamter Text eines Blocks samt Kindern; für Tabellenzellen. */
function blockText(block: NormBodyBlock): string {
  return joined([joined([block.label, block.title, block.text]), ...(block.children ?? []).map((child) => blockText(child))]);
}

/**
 * Tabellen werden nicht gesetzt, sondern lesbar verkettet: je Zeile eine Textzeile, die Zellen
 * durch „ · “ getrennt, Kopfzeilen halbfett. Das bleibt vorlesbar und bricht nicht über den Rand.
 */
function tableParagraphs(block: NormBodyBlock, indent: number, oblique: boolean): PdfParagraph[] {
  const paragraphs: PdfParagraph[] = [];
  const title = block.title ? toDisplayText(block.title) : '';
  if (title) paragraphs.push({ text: title, font: 'F2', size: BODY_SIZE, indent, spacingBefore: 11, keepWithNext: true });
  const rows = (block.children ?? []).filter((row) => row.type === 'tableRow');
  rows.forEach((row, index) => {
    const cells = row.children ?? [];
    const isHeader = cells.length > 0 && cells.every((cell) => cell.type === 'tableHeaderCell');
    const text = cells.map((cell) => blockText(cell)).filter(Boolean).join(' · ');
    if (!text) return;
    paragraphs.push({
      text,
      font: isHeader ? 'F2' : oblique ? 'F3' : 'F1',
      size: 10,
      indent,
      spacingBefore: index === 0 ? 6 : 2,
      keepWithNext: isHeader,
    });
  });
  return paragraphs;
}

/**
 * Verflacht den Normkörper in Absätze. Unbekannte Blockarten werden wie Textblöcke behandelt:
 * eine neue Blockart im Bestand darf die PDF-Erzeugung nie zum Abbruch bringen.
 */
export function flattenNormBody(blocks: NormBodyBlock[] | undefined, indent = 0, oblique = false): PdfParagraph[] {
  const paragraphs: PdfParagraph[] = [];
  const bodyFont: PdfFontKey = oblique ? 'F3' : 'F1';

  for (const block of blocks ?? []) {
    const type: string = block.type;

    if (HEADING_TYPES.has(type)) {
      const heading = joined([block.label, block.title]);
      if (heading) paragraphs.push({ text: heading, font: 'F2', size: 12, indent, spacingBefore: 16, keepWithNext: true });
      paragraphs.push(...flattenNormBody(block.children, indent, oblique));
      continue;
    }

    if (UNIT_TYPES.has(type)) {
      const heading = joined([block.label, block.title]);
      if (heading) paragraphs.push({ text: heading, font: 'F2', size: 11, indent, spacingBefore: 12, keepWithNext: true });
      paragraphs.push(...flattenNormBody(block.children, indent, oblique));
      continue;
    }

    if (type === 'quotedProvision') {
      paragraphs.push(...flattenNormBody(block.children, indent + INDENT_STEP, true));
      continue;
    }

    if (type === 'table') {
      paragraphs.push(...tableParagraphs(block, indent, oblique));
      continue;
    }

    if (type === 'signature') {
      // Unterschriftenblock: Ort und Datum, darunter Name und Amt auf eigenen Zeilen.
      const lines = [block.label, block.text, block.title].filter((value): value is string => Boolean(value));
      lines.forEach((line, index) => {
        paragraphs.push({ text: toDisplayText(line), font: bodyFont, size: BODY_SIZE, indent, spacingBefore: index === 0 ? 16 : 2, keepWithNext: index < lines.length - 1 });
      });
      paragraphs.push(...flattenNormBody(block.children, indent, oblique));
      continue;
    }

    const text = toDisplayText(block.text ?? '');
    const label = block.label ? toDisplayText(block.label) : undefined;
    if (text || label) {
      paragraphs.push({ text, ...(label ? { label } : {}), font: bodyFont, size: BODY_SIZE, indent, spacingBefore: 6, keepWithNext: false });
    }
    paragraphs.push(...flattenNormBody(block.children, HANGING_CHILD_TYPES.has(type) ? indent + INDENT_STEP : indent, oblique));
  }

  return paragraphs;
}

/** Wörter eines kodierten Textes; Folgen von Leerzeichen werden zu einer Trennung. */
function splitWords(bytes: Uint8Array): Uint8Array[] {
  const words: Uint8Array[] = [];
  let start = -1;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 0x20) {
      if (start >= 0) {
        words.push(bytes.subarray(start, index));
        start = -1;
      }
    } else if (start < 0) {
      start = index;
    }
  }
  if (start >= 0) words.push(bytes.subarray(start));
  return words;
}

function joinWords(words: Uint8Array[]): Uint8Array {
  if (words.length === 0) return new Uint8Array(0);
  const length = words.reduce((sum, word) => sum + word.length, 0) + words.length - 1;
  const result = new Uint8Array(length);
  let offset = 0;
  words.forEach((word, index) => {
    if (index > 0) result[offset++] = 0x20;
    result.set(word, offset);
    offset += word.length;
  });
  return result;
}

/** Überlange Wörter (Adressen, verkettete Kennungen) werden hart getrennt, statt überzustehen. */
function breakWord(word: Uint8Array, font: PdfFontKey, size: number, available: number): Uint8Array[] {
  const parts: Uint8Array[] = [];
  let start = 0;
  let width = 0;
  for (let index = 0; index < word.length; index += 1) {
    const characterWidth = (glyphWidth(word[index], font) * size) / 1000;
    if (width + characterWidth > available && index > start) {
      parts.push(word.subarray(start, index));
      start = index;
      width = 0;
    }
    width += characterWidth;
  }
  parts.push(word.subarray(start));
  return parts;
}

/** Bricht einen Absatz an der Textbreite um; das Gliederungszeichen bleibt hängend links. */
export function wrapParagraph(paragraph: PdfParagraph, maxWidth = TEXT_WIDTH): PdfLine[] {
  const { font, size } = paragraph;
  const gray = paragraph.gray ?? 0;
  const labelBytes = paragraph.label ? toWinAnsiBytes(paragraph.label) : null;
  const hangingIndent = labelBytes ? Math.max(textWidth(labelBytes, font, size) + WORD_GAP, MIN_HANGING_INDENT) : 0;
  const textLeft = paragraph.indent + hangingIndent;
  const available = Math.max(maxWidth - textLeft, size * 4);
  const height = size * LINE_FACTOR;
  const spaceWidth = textWidth(SPACE, font, size);
  const lines: PdfLine[] = [];
  let current: Uint8Array[] = [];
  let currentWidth = 0;

  const flush = (): void => {
    const bytes = joinWords(current);
    const runs: PdfRun[] = [];
    if (lines.length === 0 && labelBytes && labelBytes.length > 0) runs.push({ bytes: labelBytes, font, size, x: paragraph.indent, gray });
    if (bytes.length > 0) runs.push({ bytes, font, size, x: textLeft, gray });
    const width = runs.reduce((widest, run) => Math.max(widest, run.x + textWidth(run.bytes, run.font, run.size)), 0);
    lines.push({ runs, height, spacingBefore: lines.length === 0 ? paragraph.spacingBefore : 0, keepWithNext: paragraph.keepWithNext, width });
    current = [];
    currentWidth = 0;
  };

  for (const word of splitWords(toWinAnsiBytes(paragraph.text))) {
    const wordWidth = textWidth(word, font, size);
    if (wordWidth > available) {
      if (current.length > 0) flush();
      const parts = breakWord(word, font, size, available);
      parts.forEach((part, index) => {
        current = [part];
        currentWidth = textWidth(part, font, size);
        if (index < parts.length - 1) flush();
      });
      continue;
    }
    const additional = current.length === 0 ? wordWidth : spaceWidth + wordWidth;
    if (current.length > 0 && currentWidth + additional > available) flush();
    current.push(word);
    currentWidth += current.length === 1 ? wordWidth : additional;
  }

  if (current.length > 0 || lines.length === 0) flush();
  return lines;
}

export function wrapParagraphs(paragraphs: PdfParagraph[], maxWidth = TEXT_WIDTH): PdfLine[] {
  return paragraphs.flatMap((paragraph) => wrapParagraph(paragraph, maxWidth));
}

/** Zusätzliche Höhe der Zeilen, die mit dieser Zeile zusammenbleiben sollen. */
function keepWithNextHeight(lines: PdfLine[], index: number): number {
  let extra = 0;
  let position = index;
  let steps = 0;
  while (lines[position]?.keepWithNext && steps < 6) {
    const next = lines[position + 1];
    if (!next) break;
    extra += next.spacingBefore + next.height;
    position += 1;
    steps += 1;
  }
  return extra;
}

/** Verteilt die Zeilen auf Seiten; die Seitenzahl steht danach fest (Kopf und Fuß kommen extra). */
export function paginate(lines: PdfLine[], top = CONTENT_TOP, bottom = CONTENT_BOTTOM): PdfPage[] {
  const pages: PdfPage[] = [];
  let runs: Array<PdfRun & { y: number }> = [];
  let y = top;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const started = runs.length > 0 || y < top;
    const spacing = started ? line.spacingBefore : 0;
    let baseline = y - spacing - line.height;
    if (started && (baseline < bottom || baseline - keepWithNextHeight(lines, index) < bottom)) {
      pages.push({ runs });
      runs = [];
      y = top;
      baseline = y - line.height;
    }
    for (const run of line.runs) runs.push({ ...run, y: baseline });
    y = baseline;
  }

  pages.push({ runs });
  return pages;
}
