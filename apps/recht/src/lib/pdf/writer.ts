import { PDF_BASE_FONTS } from './font-metrics.ts';
import { PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH, type PdfPage } from './layout.ts';
import { toPdfHexString } from './winansi.ts';

/**
 * Minimaler PDF-1.4-Schreiber: Katalog, Seitenbaum, die drei eingebauten Helvetica-Schnitte mit
 * WinAnsi-Kodierung, je Seite ein Inhaltsstrom, Querverweistabelle und Trailer. Die Ausgabe ist
 * deterministisch – kein Zeitstempel der Anfrage, keine Zufallskennung, kein /ID –, damit
 * dieselbe Fassung immer dieselben Bytes ergibt und zwischengespeichert werden kann.
 */

const encoder = new TextEncoder();

/** Zahlen im Inhaltsstrom: höchstens zwei Nachkommastellen, keine Exponentialschreibweise. */
function num(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function hex(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) result += byte.toString(16).padStart(2, '0');
  return `<${result}>`;
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

type CompressionStreamConstructor = new (format: 'deflate') => { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> };

/**
 * Deflate über die Web-Streams-API (`CompressionStream`), die workerd und Node bereitstellen;
 * das Ergebnis ist zlib-verpackt und damit `/FlateDecode`. Fehlt die API, bleibt der Strom
 * unkomprimiert.
 */
async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  const Compression = (globalThis as { CompressionStream?: CompressionStreamConstructor }).CompressionStream;
  if (!Compression) return null;
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const compressed = await new Response(source.pipeThrough(new Compression('deflate')) as unknown as ReadableStream).arrayBuffer();
  return new Uint8Array(compressed);
}

/** Inhaltsstrom einer Seite: je Textstück Schrift, Graustufe, Position und Hexstring. */
function contentStream(page: PdfPage): string {
  const parts: string[] = ['BT'];
  let font = '';
  let size = Number.NaN;
  let gray = Number.NaN;
  for (const run of page.runs) {
    if (run.font !== font || run.size !== size) {
      parts.push(`/${run.font} ${num(run.size)} Tf`);
      font = run.font;
      size = run.size;
    }
    if (run.gray !== gray) {
      parts.push(`${num(run.gray)} g`);
      gray = run.gray;
    }
    parts.push(`1 0 0 1 ${num(PAGE_MARGIN + run.x)} ${num(run.y)} Tm`);
    parts.push(`${hex(run.bytes)} Tj`);
  }
  parts.push('ET');
  return parts.join('\n');
}

export interface PdfDocumentInput {
  pages: PdfPage[];
  title: string;
  subject?: string;
  /** Datum aus den Fassungsdaten (JJJJ-MM-TT); niemals die Uhr der Anfrage. */
  date?: string;
  /** Inhaltsströme mit FlateDecode packen; ohne CompressionStream bleiben sie unkomprimiert. */
  compress?: boolean;
}

function pdfDate(date: string | undefined): string {
  const digits = (date ?? '').replaceAll('-', '');
  return /^\d{8}$/u.test(digits) ? `D:${digits}000000+00'00'` : "D:00000000000000+00'00'";
}

/** Baut das vollständige PDF-Dokument als Bytefolge. */
export async function buildPdf(input: PdfDocumentInput): Promise<Uint8Array<ArrayBuffer>> {
  const pageCount = Math.max(input.pages.length, 1);
  const pages = input.pages.length > 0 ? input.pages : [{ runs: [] }];
  const fontObjectStart = 3;
  const infoObject = fontObjectStart + PDF_BASE_FONTS.length;
  const firstPageObject = infoObject + 1;
  const pageObject = (index: number): number => firstPageObject + index * 2;
  const contentObject = (index: number): number => firstPageObject + index * 2 + 1;

  const objects: Array<{ dictionary: string; stream?: Uint8Array }> = [];
  objects.push({ dictionary: '<< /Type /Catalog /Pages 2 0 R >>' });
  objects.push({
    dictionary: `<< /Type /Pages /Kids [${pages.map((_, index) => `${pageObject(index)} 0 R`).join(' ')}] /Count ${pageCount} >>`,
  });
  for (const font of PDF_BASE_FONTS) {
    objects.push({ dictionary: `<< /Type /Font /Subtype /Type1 /BaseFont /${font.baseFont} /Encoding /WinAnsiEncoding >>` });
  }
  objects.push({
    dictionary: `<< /Title ${toPdfHexString(input.title)}${input.subject ? ` /Subject ${toPdfHexString(input.subject)}` : ''} /Producer ${toPdfHexString('OstRecht')} /Creator ${toPdfHexString('OstRecht')} /CreationDate (${pdfDate(input.date)}) >>`,
  });

  const resources = `<< /Font << ${PDF_BASE_FONTS.map((font, index) => `/${font.key} ${fontObjectStart + index} 0 R`).join(' ')} >> >>`;
  for (const [index, page] of pages.entries()) {
    const raw = encoder.encode(contentStream(page));
    const packed = input.compress === false ? null : await deflate(raw);
    const stream = packed ?? raw;
    objects.push({
      dictionary: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PAGE_WIDTH)} ${num(PAGE_HEIGHT)}] /Resources ${resources} /Contents ${contentObject(index)} 0 R >>`,
    });
    objects.push({
      dictionary: `<< /Length ${stream.length}${packed ? ' /Filter /FlateDecode' : ''} >>`,
      stream,
    });
  }

  const chunks: Uint8Array[] = [];
  let offset = 0;
  const push = (bytes: Uint8Array): void => {
    chunks.push(bytes);
    offset += bytes.length;
  };
  const pushText = (text: string): void => push(encoder.encode(text));

  // %PDF-Kopf mit Binärkommentar, damit Werkzeuge die Datei nicht als Text behandeln.
  push(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(offset);
    pushText(`${index + 1} 0 obj\n${object.dictionary}\n`);
    if (object.stream) {
      pushText('stream\n');
      push(object.stream);
      pushText('\nendstream\n');
    }
    pushText('endobj\n');
  }

  const xrefOffset = offset;
  const entries = ['0000000000 65535 f\r\n', ...offsets.map((value) => `${String(value).padStart(10, '0')} 00000 n\r\n`)];
  pushText(`xref\n0 ${objects.length + 1}\n${entries.join('')}`);
  pushText(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return concat(chunks);
}
