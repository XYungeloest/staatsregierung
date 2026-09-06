import { siteUrls } from '@ostrecht/shared/config/site-routing.ts';
import { formatDate, getNormTitleBlock } from '@ostrecht/shared/lib/norms/display.ts';
import { getNormVersionIdentity } from '@ostrecht/shared/lib/norms/identity.ts';
import { toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';
import type { NormRecord, NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';
import { EDITORIAL_REFERENCE_DATE, type VersionTemporalKind } from '@ostrecht/shared/lib/norms/versions.ts';

import { referenceDateLabel, versionKindLabel } from '../vocabulary.ts';
import { glyphWidth, textWidth, type PdfFontKey } from './font-metrics.ts';
import {
  BODY_SIZE,
  FOOTER_Y,
  RUNNING_HEADER_Y,
  SMALL_SIZE,
  TEXT_WIDTH,
  flattenNormBody,
  paginate,
  wrapParagraphs,
  type PdfPage,
  type PdfParagraph,
} from './layout.ts';
import { toWinAnsiBytes } from './winansi.ts';
import { buildPdf } from './writer.ts';

/**
 * Portalfassung einer gespeicherten Fassung als PDF: Kopfblock mit Bezeichnung, Vollzitat,
 * Rechtsstand und Fundstelle, danach der Vorschriftentext in der Reihenfolge der
 * Bildschirmansicht, auf jeder Seite ein laufender Kopf und ein Fuß mit Seitenzahl. Das
 * Ergebnis ist keine amtliche Verkündung; der Fuß sagt das auf jeder Seite.
 */

const FOOTER_NOTE = 'Portalfassung, keine amtliche Verkündung';
const LAW_HOST = siteUrls.law.replace(/^https?:\/\//u, '');
const MUTED_GRAY = 0.4;

export interface NormVersionPdfInput {
  norm: NormRecord;
  version: NormVersion;
  /** Vollzitat der Fassung; fehlt es, entfällt die Zeile. */
  fullCitation?: string;
  temporalKind: VersionTemporalKind;
  referenceDate?: string;
  /** Nur für Tests: unkomprimierte Inhaltsströme lassen sich unmittelbar lesen. */
  compress?: boolean;
}

/** Statuszeile der Fassung in den Wörtern der Wortliste; für die geltende Fassung der Rechtsstand. */
export function versionStatusLine(input: Pick<NormVersionPdfInput, 'version' | 'temporalKind' | 'referenceDate'>): string {
  const { version, temporalKind } = input;
  const referenceDate = input.referenceDate ?? EDITORIAL_REFERENCE_DATE;
  if (temporalKind === 'current') return `${versionKindLabel('current')}, ${referenceDateLabel(referenceDate)}`;
  const start = `gültig ab ${formatDate(version.validFrom)}`;
  if (temporalKind === 'historical') {
    return `${versionKindLabel('historical')}, ${start}${version.validTo ? ` bis ${formatDate(version.validTo)}` : ''}`;
  }
  return `${versionKindLabel(temporalKind)}, ${start}`;
}

/** Kopfblock der ersten Seite: Bezeichnung, Vollzitat, Rechtsstand, Fundstelle. */
function headerParagraphs(input: NormVersionPdfInput, heading: string, longTitle: string | undefined, abbr: string | undefined): PdfParagraph[] {
  const paragraphs: PdfParagraph[] = [
    { text: heading, font: 'F2', size: 14, indent: 0, spacingBefore: 0, keepWithNext: true },
  ];
  if (longTitle) paragraphs.push({ text: longTitle, font: 'F1', size: BODY_SIZE, indent: 0, spacingBefore: 5, keepWithNext: true });
  if (abbr) paragraphs.push({ text: `Abkürzung: ${abbr}`, font: 'F1', size: BODY_SIZE, indent: 0, spacingBefore: 4, keepWithNext: true });

  const fullCitation = toDisplayText(input.fullCitation ?? '').trim();
  if (fullCitation) paragraphs.push({ text: `Vollzitat: ${fullCitation}`, font: 'F1', size: BODY_SIZE, indent: 0, spacingBefore: 12, keepWithNext: true });
  paragraphs.push({ text: versionStatusLine(input), font: 'F1', size: BODY_SIZE, indent: 0, spacingBefore: 5, keepWithNext: true });

  const citation = toDisplayText(input.version.citation ?? '').trim();
  if (citation && citation !== fullCitation) {
    paragraphs.push({ text: `Fundstelle: ${citation}`, font: 'F1', size: BODY_SIZE, indent: 0, spacingBefore: 4, keepWithNext: true });
  }
  return paragraphs;
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const result = new Uint8Array(left.length + right.length);
  result.set(left, 0);
  result.set(right, left.length);
  return result;
}

/** Kürzt einen Text auf die verfügbare Breite und schließt ihn mit einem Auslassungszeichen ab. */
function truncateToWidth(value: string, font: PdfFontKey, size: number, maxWidth: number): Uint8Array {
  const bytes = toWinAnsiBytes(value);
  if (textWidth(bytes, font, size) <= maxWidth) return bytes;
  const ellipsis = toWinAnsiBytes('…');
  const limit = maxWidth - textWidth(ellipsis, font, size);
  let width = 0;
  let end = 0;
  while (end < bytes.length) {
    const characterWidth = (glyphWidth(bytes[end], font) * size) / 1000;
    if (width + characterWidth > limit) break;
    width += characterWidth;
    end += 1;
  }
  return concatBytes(bytes.subarray(0, end), ellipsis);
}

/** Laufender Kopf und Fuß auf jeder Seite; die Gesamtzahl steht erst nach dem Umbruch fest. */
function addRunningElements(pages: PdfPage[], runningHeader: string): void {
  const headerBytes = truncateToWidth(runningHeader, 'F1', SMALL_SIZE, TEXT_WIDTH);
  pages.forEach((page, index) => {
    page.runs.unshift({ bytes: headerBytes, font: 'F1', size: SMALL_SIZE, x: 0, gray: MUTED_GRAY, y: RUNNING_HEADER_Y });
    const footer = `${FOOTER_NOTE} · OstRecht, ${LAW_HOST} · Seite ${index + 1} von ${pages.length}`;
    page.runs.push({
      bytes: truncateToWidth(footer, 'F1', SMALL_SIZE, TEXT_WIDTH),
      font: 'F1',
      size: SMALL_SIZE,
      x: 0,
      gray: MUTED_GRAY,
      y: FOOTER_Y,
    });
  });
}

/** Erzeugt die Portalfassung einer Fassung als PDF-Bytefolge. */
export async function renderNormVersionPdf(input: NormVersionPdfInput): Promise<Uint8Array<ArrayBuffer>> {
  const identity = getNormVersionIdentity(input.norm, input.version);
  const { heading, longTitle, abbr } = getNormTitleBlock(identity);
  const status = versionStatusLine(input);
  const paragraphs = [
    ...headerParagraphs(input, heading, longTitle, abbr),
    ...flattenNormBody(input.version.body, 0, false),
  ];
  const pages = paginate(wrapParagraphs(paragraphs));
  addRunningElements(pages, `${heading} · ${status}`);

  return buildPdf({
    pages,
    title: heading,
    subject: status,
    date: input.version.validFrom,
    ...(input.compress === false ? { compress: false } : {}),
  });
}

/** Dateibezeichnung der erzeugten Fassung: `<slug>-<versionId>.pdf`. */
export function normVersionPdfFilename(slug: string, versionId: string): string {
  return `${slug}-${versionId}.pdf`.replace(/[^a-zA-Z0-9._-]/gu, '-');
}
