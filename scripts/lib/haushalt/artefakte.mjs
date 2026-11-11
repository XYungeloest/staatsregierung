import { inflateRawSync, inflateSync } from 'node:zlib';

import { findLocalPathPatterns } from './common.mjs';
import { ARTEFAKT_SPERRMARKEN } from './legenden.mjs';

/**
 * Prüft Ausgabedateien (PDF, XLSX) auf lokale Pfade und auf nicht öffentliche Abschnitte.
 * XLSX-Dateien werden als ZIP-Archiv entpackt und jeder Eintrag geprüft; PDF-Ströme werden über
 * ihre Filter (ASCII85, ASCIIHex, Flate) dekodiert, weil kodierte Rohdaten sowohl Pfade
 * verbergen als auch Scheintreffer erzeugen. PDF-Zeichenketten (Literal- und Hex-Strings in
 * Strömen und Metadaten) werden zusätzlich entmaskiert, einschließlich UTF-16. Bildströme werden
 * nicht dekodiert, ihre Rohbytes aber mit den Mustern für Binärdaten geprüft. Nicht dekodierbare
 * Inhalte gelten als nicht prüfbar und sperren das Artefakt.
 *
 * @returns {{ ok: boolean, findings: string[], inhaltsbefunde: string[] }}
 *   findings: lokale Pfade oder nicht prüfbare Bestandteile; inhaltsbefunde: Bezeichnungen
 *   gefundener nicht öffentlicher Abschnitte (siehe ARTEFAKT_SPERRMARKEN).
 */
export function scanArtifact(fileName, buffer, zusatzmarken = []) {
  const lower = fileName.toLowerCase();
  let result;
  if (lower.endsWith('.xlsx') || lower.endsWith('.zip') || lower.endsWith('.docx')) {
    result = scanZip(buffer);
  } else if (lower.endsWith('.pdf')) {
    result = scanPdf(buffer);
  } else {
    result = { ...scanText('Datei', buffer), texts: textVariants(buffer) };
  }
  const inhaltsbefunde = findBlockedSections(result.texts ?? [], zusatzmarken);
  return {
    ok: result.findings.length === 0 && inhaltsbefunde.length === 0,
    findings: result.findings,
    inhaltsbefunde,
  };
}

/**
 * Bezeichnungen der nicht öffentlichen Inhalte, die in den Texten vorkommen: feste Abschnitte
 * (ARTEFAKT_SPERRMARKEN) sowie Zusatzmarken. Eine Zusatzmarke ist entweder ein Muster
 * (`{ muster, bezeichnung }`, geprüft am Text ohne XML-Auszeichnung) oder eine Liste von
 * Textteilen (`{ textteile, bezeichnung }`), die in kanonischer Form (nur Buchstaben und Ziffern,
 * Kleinschreibung) gesucht werden. So stören weder Zeilenumbrüche und Silbentrennung im PDF noch
 * Auszeichnungen oder Entitäten in der Arbeitsmappe.
 */
export function findBlockedSections(texts, zusatzmarken = []) {
  const found = [];
  const normalisiert = texts.map((text) => text.normalize('NFC'));
  for (const { muster, bezeichnung } of ARTEFAKT_SPERRMARKEN) {
    if (normalisiert.some((text) => muster.test(text))) found.push(bezeichnung);
  }
  if (zusatzmarken.length === 0) return found;
  const klartexte = normalisiert.map(ohneAuszeichnung);
  const kanonisch = klartexte.map(kanonischerText);
  for (const marke of zusatzmarken) {
    if (marke.muster instanceof RegExp) {
      const muster = new RegExp(marke.muster.source, marke.muster.flags.replace('g', ''));
      if (klartexte.some((text) => muster.test(text))) found.push(marke.bezeichnung);
    } else if (Array.isArray(marke.textteile)) {
      if (marke.textteile.some((teil) => teil !== '' && kanonisch.some((text) => text.includes(teil)))) found.push(marke.bezeichnung);
    }
  }
  return [...new Set(found)];
}

const XML_ENTITAETEN = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Text ohne XML-Auszeichnung und mit aufgelösten Entitäten (Arbeitsmappen-XML, PDF-Text unverändert). */
export function ohneAuszeichnung(text) {
  if (!text.includes('<') && !text.includes('&')) return text;
  return text
    .replace(/<[^>]*>/gu, ' ')
    .replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-z]+));/gu, (ganz, dezimal, hex, name) => {
      if (dezimal) return String.fromCodePoint(Number(dezimal));
      if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
      return XML_ENTITAETEN[name] ?? ganz;
    });
}

/** Kanonische Vergleichsform: nur Buchstaben und Ziffern, kleingeschrieben. */
export function kanonischerText(text) {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Muster interner Kennungen und Arbeitsvermerke der Haushaltsaufstellung, die in öffentlichen
 * Ausgabedateien nicht stehen dürfen (angelehnt an METABEGRIFFE in
 * apps/portal/src/lib/haushalt/oeffentlich.ts). Bewusst nicht gesperrt sind die vorgeschriebenen
 * Simulationshinweise („Regierungsentwurf (Simulation)“), „Herkunftsländer“ und Paarformen.
 */
export const ARTEFAKT_KENNUNGSMUSTER = [
  { muster: /\bC0\b/iu, bezeichnung: 'Kennung des Finanzrahmens (C0)' },
  { muster: /\bD-\d{2}\b/u, bezeichnung: 'Kennungen des Entscheidungsprotokolls (D-…)' },
  { muster: /\bQ\d{2}\b/u, bezeichnung: 'Prüfkennungen (Q…)' },
  { muster: /\bK-0\d/u, bezeichnung: 'Kennungen von Korrekturvorlagen (K-0…)' },
  { muster: /\bF(?:0[1-9]|[1-9]\d)\b/u, bezeichnung: 'interne Maßnahmenkennungen (F…)' },
  { muster: /Simulationsbund|Simulations-GG|Simulationsbundesrecht/u, bezeichnung: 'Bezug auf das Simulationsbundesrecht' },
  { muster: /Vorbild|sächsische[nrs]?\s+(?:Vorbild|Regierungsentwurf|Titel|Zuschüsse|Systematik)/iu, bezeichnung: 'Herleitung aus dem sächsischen Vorbild' },
  { muster: /Quell(?:en)?matrix/iu, bezeichnung: 'Verweis auf die Quellenmatrix' },
  { muster: /Verhandlungsziel/iu, bezeichnung: 'Verhandlungsposition' },
  { muster: /Modell:\s*\d/u, bezeichnung: 'Modellannahme („Modell: …“)' },
  { muster: /nicht (?:belegt|nachgewiesen)/u, bezeichnung: 'interner Nachweisstand („nicht belegt“)' },
  { muster: /\bMapping\b/iu, bezeichnung: 'Begriff der Datenaufbereitung (Mapping)' },
  { muster: /Referenzvektor/iu, bezeichnung: 'Referenzdaten (Referenzvektor)' },
  { muster: /Basis(?:run|bereinigung)/iu, bezeichnung: 'interne Rechenschritte (Basisrun, Basisbereinigung)' },
  { muster: /vom Staatsrat akzeptiert/iu, bezeichnung: 'unbelegter Staatsratsbeschluss zur Planungsfassung' },
  // Gleiches Muster wie METABEGRIFFE `unternehmensname` (apps/portal/src/lib/haushalt/oeffentlich.ts,
  // Gleichlauf in tests/haushalt-sync.test.mjs geprüft); öffentlich „Übernahme bestehender Filialen“.
  { muster: /\btegut\b/iu, bezeichnung: 'Name eines realen Handelsunternehmens' },
];

/** Mindestlänge (kanonische Zeichen) eines Textteils, damit er als Sperrmarke taugt. */
const TEXTTEIL_MIN = 20;
/** Länge der Textausschnitte, in die ein langer nicht freigegebener Text zerlegt wird. */
const TEXTTEIL_LAENGE = 40;

/**
 * Zusatzmarken aus den Freitexten der Titel: Jeder Rohtext (Rechtsgrundlage, Finanzierung,
 * Erläuterung, Haushaltsvermerk), der laut content/haushalt/<periode>/freitexte.json nicht
 * angezeigt wird (`anzeige: null`) oder dort gar nicht klassifiziert ist, darf auch in PDF und
 * Arbeitsmappe nicht stehen. Gesucht wird der Textanfang (60 kanonische Zeichen) und jeder
 * 40-Zeichen-Ausschnitt; Ausschnitte, die auch in einem freigegebenen Text oder dessen
 * öffentlicher Fassung vorkommen, entfallen, damit gemeinsame Formulierungen nicht sperren.
 *
 * @param {{ texte: Record<string, Iterable<string>>, freitexte: object | null | undefined }} eingabe
 *   texte: Feld → Rohtexte der Titel (collectTitelFreitexte); freitexte: Overlay oder null.
 * @returns {{ textteile: string[], bezeichnung: string }[]}
 */
export function freitextSperrmarken({ texte, freitexte }) {
  const freigegeben = [];
  const gesperrt = [];
  for (const [feld, rohtexte] of Object.entries(texte)) {
    const klassifikation = freitexte?.[feld] ?? {};
    for (const rohtext of rohtexte) {
      const eintrag = Object.hasOwn(klassifikation, rohtext) ? klassifikation[rohtext] : undefined;
      if (typeof eintrag?.anzeige === 'string' && eintrag.anzeige.trim() !== '') {
        freigegeben.push(kanonischerText(rohtext), kanonischerText(eintrag.anzeige));
      } else {
        gesperrt.push({ feld, rohtext });
      }
    }
  }
  const marken = [];
  for (const { feld, rohtext } of gesperrt) {
    const kanon = kanonischerText(rohtext);
    if (kanon.length < TEXTTEIL_MIN) continue;
    const teile = new Set([kanon.slice(0, 60)]);
    for (let start = 0; start + TEXTTEIL_LAENGE <= kanon.length; start += TEXTTEIL_LAENGE) teile.add(kanon.slice(start, start + TEXTTEIL_LAENGE));
    const textteile = [...teile].filter((teil) => teil.length >= TEXTTEIL_MIN && !freigegeben.some((text) => text.includes(teil)));
    if (textteile.length === 0) continue;
    marken.push({ textteile, bezeichnung: `nicht freigegebener Titeltext (${feld}): „${rohtext.slice(0, 60)}${rohtext.length > 60 ? '…' : ''}“` });
  }
  return marken;
}

/** Freitexte aus bereits gelesenen Titeldateien (`titel/<ep>.json`): Feld → Menge der Quelltexte. */
export function sammleTitelFreitexte(titelDateien) {
  const texte = { rechtsgrundlage: new Set(), finanzierung: new Set(), erlaeuterung: new Set(), vermerk: new Set() };
  for (const datei of titelDateien) {
    for (const titel of Array.isArray(datei?.titel) ? datei.titel : []) {
      const quellen = [titel, ...Object.values(titel?.jahre ?? {})];
      for (const quelle of quellen) {
        for (const feld of Object.keys(texte)) {
          if (typeof quelle?.[feld] === 'string' && quelle[feld] !== '') texte[feld].add(quelle[feld]);
        }
      }
    }
  }
  return texte;
}

/** Alle Zusatzmarken einer Periode: interne Kennungen und nicht freigegebene Titeltexte. */
export function artefaktZusatzmarken({ texte, freitexte }) {
  return [...ARTEFAKT_KENNUNGSMUSTER, ...freitextSperrmarken({ texte, freitexte })];
}

function textVariants(buffer) {
  const latin = buffer.toString('latin1');
  const variants = [latin, buffer.toString('utf8')];
  // UTF-16-Text (z. B. in PDF-Zeichenketten) mit entfernten Nullbytes
  if (latin.includes('\u0000')) variants.push(latin.replaceAll('\u0000', ''));
  return variants;
}

function scanText(location, buffer, options = {}) {
  const findings = [];
  const hits = new Set();
  for (const variant of textVariants(buffer)) {
    for (const hit of findLocalPathPatterns(variant, options)) hits.add(hit);
  }
  for (const hit of [...hits].sort()) findings.push(`${location}: Muster ${hit}`);
  return { ok: findings.length === 0, findings };
}

// ---------------------------------------------------------------------------------------------
// ZIP (XLSX)

export function readZipEntries(buffer) {
  const endSignature = 0x06054b50;
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === endSignature) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error('ZIP-Verzeichnisende nicht gefunden');

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const directoryOffset = buffer.readUInt32LE(endOffset + 16);
  const entries = [];
  let cursor = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('ZIP-Zentralverzeichnis beschädigt');
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    cursor += 46 + nameLength + extraLength + commentLength;

    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`ZIP-Eintrag ${name} beschädigt`);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = inflateRawSync(raw);
    else throw new Error(`ZIP-Eintrag ${name}: Kompressionsmethode ${method} nicht unterstützt`);
    entries.push({ name, data });
  }
  return entries;
}

function scanZip(buffer) {
  let entries;
  try {
    entries = readZipEntries(buffer);
  } catch (error) {
    return { findings: [`Archiv nicht prüfbar: ${error.message}`], texts: [] };
  }
  const findings = [];
  const texts = [];
  for (const entry of entries) {
    findings.push(...scanText(`Eintrag ${entry.name}`, Buffer.from(entry.name, 'utf8')).findings);
    findings.push(...scanText(`Eintrag ${entry.name}`, entry.data).findings);
    texts.push(entry.data.toString('utf8'));
  }
  return { findings: [...new Set(findings)], texts };
}

// ---------------------------------------------------------------------------------------------
// PDF

export function decodeAscii85(input) {
  let text = input.toString('latin1').replace(/\s+/gu, '');
  if (text.startsWith('<~')) text = text.slice(2);
  const end = text.indexOf('~>');
  if (end >= 0) text = text.slice(0, end);
  const bytes = [];
  let group = [];
  for (const char of text) {
    if (char === 'z' && group.length === 0) {
      bytes.push(0, 0, 0, 0);
      continue;
    }
    const code = char.charCodeAt(0);
    if (code < 33 || code > 117) throw new Error(`ungültiges ASCII85-Zeichen ${JSON.stringify(char)}`);
    group.push(code - 33);
    if (group.length === 5) {
      let value = 0;
      for (const digit of group) value = value * 85 + digit;
      if (value > 0xffffffff) throw new Error('ASCII85-Gruppe außerhalb des Wertebereichs');
      bytes.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
      group = [];
    }
  }
  if (group.length === 1) throw new Error('unvollständige ASCII85-Gruppe');
  if (group.length > 0) {
    const missing = 5 - group.length;
    const padded = [...group, ...Array(missing).fill(84)];
    let value = 0;
    for (const digit of padded) value = value * 85 + digit;
    const all = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
    bytes.push(...all.slice(0, 4 - missing));
  }
  return Buffer.from(bytes);
}

function decodeAsciiHex(input) {
  let text = input.toString('latin1').replace(/\s+/gu, '');
  const end = text.indexOf('>');
  if (end >= 0) text = text.slice(0, end);
  if (text.length % 2 === 1) text += '0';
  if (!/^[0-9A-Fa-f]*$/u.test(text)) throw new Error('ungültige ASCIIHex-Daten');
  return Buffer.from(text, 'hex');
}

function inflatePdf(data) {
  try {
    return inflateSync(data);
  } catch {
    return inflateRawSync(data);
  }
}

/** Bildfilter: Ströme werden nicht dekodiert, ihre Rohbytes aber mit Binärmustern geprüft. */
const IMAGE_FILTERS = new Set(['DCTDecode', 'JPXDecode', 'CCITTFaxDecode', 'JBIG2Decode', 'DCT', 'CCF']);

/** Dekodiert einen PDF-Literal-String (ohne die äußeren Klammern) in Bytes. */
export function decodePdfLiteral(text) {
  const bytes = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char !== '\\') {
      bytes.push(char.charCodeAt(0) & 0xff);
      continue;
    }
    index += 1;
    const next = text[index];
    if (next === undefined) break;
    if (/[0-7]/u.test(next)) {
      let digits = next;
      while (digits.length < 3 && /[0-7]/u.test(text[index + 1] ?? '')) {
        index += 1;
        digits += text[index];
      }
      bytes.push(Number.parseInt(digits, 8) & 0xff);
    } else if (next === 'n') bytes.push(0x0a);
    else if (next === 'r') bytes.push(0x0d);
    else if (next === 't') bytes.push(0x09);
    else if (next === 'b') bytes.push(0x08);
    else if (next === 'f') bytes.push(0x0c);
    else if (next === '\r') {
      if (text[index + 1] === '\n') index += 1;
    } else if (next === '\n') {
      // Zeilenfortsetzung
    } else bytes.push(next.charCodeAt(0) & 0xff);
  }
  return Buffer.from(bytes);
}

/** Text einer PDF-Zeichenkette: UTF-16BE mit Bytefolgemarke, sonst Latin-1 (WinAnsi-nah). */
export function pdfStringText(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.from(bytes.subarray(2));
    if (swapped.length % 2 === 1) return swapped.subarray(0, -1).swap16().toString('utf16le');
    return swapped.swap16().toString('utf16le');
  }
  return bytes.toString('latin1');
}

/** Alle Literal- und Hex-Zeichenketten eines PDF-Abschnitts (Latin-1-Text), dekodiert. */
export function extractPdfStrings(latin) {
  const strings = [];
  let index = 0;
  while (index < latin.length) {
    const char = latin[index];
    if (char === '%') {
      // Kommentar bis Zeilenende
      while (index < latin.length && latin[index] !== '\n' && latin[index] !== '\r') index += 1;
    } else if (char === '(') {
      let depth = 1;
      let cursor = index + 1;
      while (cursor < latin.length && depth > 0) {
        const current = latin[cursor];
        if (current === '\\') cursor += 2;
        else {
          if (current === '(') depth += 1;
          else if (current === ')') depth -= 1;
          cursor += 1;
        }
      }
      strings.push(pdfStringText(decodePdfLiteral(latin.slice(index + 1, depth === 0 ? cursor - 1 : cursor))));
      index = cursor;
      continue;
    } else if (char === '<' && latin[index + 1] !== '<') {
      const end = latin.indexOf('>', index + 1);
      if (end < 0) break;
      const hex = latin.slice(index + 1, end).replace(/\s+/gu, '');
      if (/^[0-9A-Fa-f]*$/u.test(hex)) {
        strings.push(pdfStringText(Buffer.from(hex.length % 2 === 1 ? `${hex}0` : hex, 'hex')));
      }
      index = end + 1;
      continue;
    } else if (char === '<') {
      index += 2;
      continue;
    }
    index += 1;
  }
  return strings;
}

function scanPdf(buffer) {
  const latin = buffer.toString('latin1');
  const findings = [];
  const outsideParts = [];
  const texts = [];
  let lastEnd = 0;
  let streamCount = 0;

  const scanStrings = (location, section) => {
    const strings = extractPdfStrings(section);
    const joined = strings.join('\n');
    findings.push(...scanText(location, Buffer.from(joined, 'utf8')).findings);
    texts.push(strings.join(''), strings.join(' '));
  };

  // Ströme suchen: Wörterbuch direkt vor „stream“, Ende an „endstream“.
  const dictionaryStream = /stream(?:\r\n|\n|\r)/gu;
  let match;
  while ((match = dictionaryStream.exec(latin)) !== null) {
    const keywordStart = match.index;
    // Nur echte Strom-Schlüsselwörter (nicht „endstream“)
    if (latin.slice(Math.max(0, keywordStart - 3), keywordStart) === 'end') continue;
    const dataStart = keywordStart + match[0].length;
    const dataEnd = latin.indexOf('endstream', dataStart);
    if (dataEnd < 0) {
      findings.push('PDF nicht prüfbar: Strom ohne Ende');
      break;
    }
    const dictionaryStart = latin.lastIndexOf('obj', keywordStart);
    const dictionary = dictionaryStart >= 0 ? latin.slice(dictionaryStart, keywordStart) : '';
    outsideParts.push(latin.slice(lastEnd, keywordStart));
    lastEnd = dataEnd + 'endstream'.length;
    dictionaryStream.lastIndex = lastEnd;
    streamCount += 1;

    let data = buffer.subarray(dataStart, dataEnd);
    const filterMatch = dictionary.match(/\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/u);
    const filters = filterMatch ? [...filterMatch[1].matchAll(/\/([A-Za-z0-9]+)/gu)].map((entry) => entry[1]) : [];
    let image = false;
    try {
      for (const filter of filters) {
        if (filter === 'ASCII85Decode' || filter === 'A85') data = decodeAscii85(data);
        else if (filter === 'ASCIIHexDecode' || filter === 'AHx') data = decodeAsciiHex(data);
        else if (filter === 'FlateDecode' || filter === 'Fl') data = inflatePdf(data);
        else if (IMAGE_FILTERS.has(filter)) image = true;
        else throw new Error(`Filter ${filter} nicht unterstützt`);
        if (image) break;
      }
    } catch (error) {
      findings.push(`PDF-Strom ${streamCount} nicht prüfbar: ${error.message}`);
      continue;
    }
    if (image) {
      // Eingebettete Metadaten (z. B. EXIF) stehen unkodiert in den Bildbytes.
      findings.push(...scanText(`PDF-Bildstrom ${streamCount}`, data, { binaer: true }).findings);
      continue;
    }
    findings.push(...scanText(`PDF-Strom ${streamCount}`, data).findings);
    scanStrings(`PDF-Strom ${streamCount} (Zeichenketten)`, data.toString('latin1'));
  }
  outsideParts.push(latin.slice(lastEnd));

  const outside = outsideParts.join('\n');
  findings.push(...scanText('PDF-Struktur', Buffer.from(outside, 'latin1')).findings);
  // Zeichenketten außerhalb der Ströme (z. B. Metadaten), entmaskiert
  scanStrings('PDF-Zeichenkette', outside);
  return { findings: [...new Set(findings)], texts };
}

// ---------------------------------------------------------------------------------------------
// Auswahl der zu veröffentlichenden Ausgabedateien

/**
 * Namenszusatz der öffentlichen Ausgabefassung im Haushaltsrepo
 * (z. B. `Haushalt_2027_2028_oeffentlich.pdf` neben der internen `Haushalt_2027_2028.pdf`).
 */
export const OEFFENTLICH_ZUSATZ = '_oeffentlich';

const OEFFENTLICH_MUSTER = /_oeffentlich(\.[^./\\]+)$/u;

/** Ist die Quelldatei eine öffentliche Ausgabefassung (`<name>_oeffentlich.<endung>`)? */
export function istOeffentlicheFassung(quelldatei) {
  return OEFFENTLICH_MUSTER.test(quelldatei);
}

/** Veröffentlichter Dateiname: öffentliche Ausgabefassung ohne Namenszusatz, sonst unverändert. */
export function veroeffentlichterName(quelldatei) {
  return quelldatei.replace(OEFFENTLICH_MUSTER, '$1');
}

/** Name der öffentlichen Ausgabefassung zu einer Standardausgabe (`<name>.<endung>` → `<name>_oeffentlich.<endung>`). */
export function oeffentlicheFassungVon(quelldatei) {
  if (istOeffentlicheFassung(quelldatei)) return quelldatei;
  return quelldatei.replace(/(\.[^./\\]+)$/u, `${OEFFENTLICH_ZUSATZ}$1`);
}

function sperrgruende(scan) {
  const gruende = [];
  if (scan.inhaltsbefunde.length > 0) {
    const titeltexte = scan.inhaltsbefunde.filter((befund) => befund.startsWith('nicht freigegebener Titeltext'));
    const uebrige = scan.inhaltsbefunde.filter((befund) => !befund.startsWith('nicht freigegebener Titeltext'));
    if (titeltexte.length > 0) uebrige.push(`${titeltexte.length} nicht freigegebene Titeltexte (freitexte.json: anzeige null)`);
    gruende.push(`enthält nicht öffentliche Abschnitte: ${uebrige.join(', ')}`);
  }
  if (scan.findings.length > 0) gruende.push(`enthält lokale Pfade oder ist nicht prüfbar: ${scan.findings.join('; ')}`);
  return gruende.join('; ');
}

/**
 * Wählt aus den Ausgabedateien der Quelle (`ausgabe/<datei>`) die zu veröffentlichenden Artefakte.
 *
 * Jede Datei wird geprüft (`scanArtifact`: lokale Pfade, nicht prüfbare Bestandteile, Sperrmarken);
 * eine beanstandete Datei wird nie übernommen („gesperrt“). Liegt zu einer Ausgabe eine öffentliche
 * Ausgabefassung `<name>_oeffentlich.<endung>` vor, wird ausschließlich sie veröffentlicht, und zwar
 * unter dem Namen `<name>.<endung>`; die Standardausgabe wird dann auch ohne Befund nicht übernommen
 * („ersetzt“). Ist die öffentliche Fassung gesperrt, gibt es für diese Ausgabe keine Datei – es wird
 * nicht auf die Standardausgabe zurückgegriffen (fail-closed). Ohne öffentliche Fassung wird eine
 * befundfreie Standardausgabe unter ihrem eigenen Namen übernommen.
 *
 * @param {{ datei: string, buffer: Buffer, sha256: string }[]} kandidaten
 *   `datei` ist der Name unter `ausgabe/` der Quelle.
 * @param {object[]} [zusatzmarken] weitere Sperrmarken (artefaktZusatzmarken), z. B. interne
 *   Kennungen und nicht freigegebene Titeltexte der Periode.
 * @returns {{ artefakte: object[], dateien: Map<string, Buffer>, meldungen: { art: 'warnung'|'hinweis', text: string }[] }}
 *   artefakte: Einträge für import-manifest.json (nach Quelldatei sortiert); dateien: Snapshotpfad
 *   `ausgabe/<veröffentlichter Name>` → unveränderter Inhalt.
 */
export function waehleArtefakte(kandidaten, zusatzmarken = []) {
  const sortiert = [...kandidaten].sort((left, right) => (left.datei < right.datei ? -1 : left.datei > right.datei ? 1 : 0));
  const scans = new Map(sortiert.map((kandidat) => [kandidat.datei, scanArtifact(kandidat.datei, kandidat.buffer, zusatzmarken)]));
  const oeffentlich = new Set(sortiert.filter((kandidat) => istOeffentlicheFassung(kandidat.datei)).map((kandidat) => kandidat.datei));
  const artefakte = [];
  const dateien = new Map();
  const meldungen = [];
  for (const kandidat of sortiert) {
    const scan = scans.get(kandidat.datei);
    const ziel = veroeffentlichterName(kandidat.datei);
    const oeffentlicheFassung = istOeffentlicheFassung(kandidat.datei) ? null : oeffentlicheFassungVon(kandidat.datei);
    const ersetzendeFassung = oeffentlicheFassung && oeffentlich.has(oeffentlicheFassung) ? oeffentlicheFassung : null;
    if (!scan.ok) {
      const grund = sperrgruende(scan);
      artefakte.push({ quelldatei: kandidat.datei, status: 'gesperrt', sha256: kandidat.sha256, grund });
      if (ersetzendeFassung && scans.get(ersetzendeFassung).ok) {
        meldungen.push({ art: 'hinweis', text: `ausgabe/${kandidat.datei} wird nicht übernommen (${grund}); veröffentlicht wird die öffentliche Ausgabefassung ausgabe/${ersetzendeFassung}.` });
      } else {
        const folge = istOeffentlicheFassung(kandidat.datei)
          ? `Für ${ziel} wird keine Datei veröffentlicht; die öffentliche Ausgabefassung muss im Haushaltsrepo bereinigt werden.`
          : 'Das Haushaltsrepo muss eine öffentliche Fassung ohne diese Bestandteile erzeugen.';
        meldungen.push({ art: 'warnung', text: `ausgabe/${kandidat.datei} wird nicht übernommen (${grund}). ${folge}` });
      }
      continue;
    }
    if (ersetzendeFassung) {
      artefakte.push({
        quelldatei: kandidat.datei,
        status: 'ersetzt',
        sha256: kandidat.sha256,
        grund: `öffentliche Ausgabefassung ${ersetzendeFassung} liegt vor; die Standardausgabe wird nicht veröffentlicht`,
      });
      continue;
    }
    artefakte.push({ datei: ziel, quelldatei: kandidat.datei, status: 'uebernommen', sha256: kandidat.sha256, bytes: kandidat.buffer.length });
    dateien.set(`ausgabe/${ziel}`, kandidat.buffer);
  }
  return { artefakte, dateien, meldungen };
}
