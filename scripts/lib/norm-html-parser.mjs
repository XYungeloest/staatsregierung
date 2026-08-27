import { parse } from 'parse5';

const DATE_PATTERN = /(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/iu;
const LIST_CLASS_PATTERN = /(?:^|\s)lst-kix_([a-z0-9_]+)-(\d+)(?=\s|$)/iu;
const SIGNATURE_PATTERN = /^[\p{L} .'-]{2,60},\s+den\s+\d{1,2}\./iu;
const CONTAMINATION_PATTERN = /data:image|;base64,|@font-face|@import\s+url|<style|Inhaltsverzeichnis|Nichtamtliches Inhaltsverzeichnis/iu;
const QUOTE_TRIGGER_PATTERN = /(?:(?:wird|werden)\s+(?:wie folgt|durch folgende|durch die nachstehende)\s+(?:neu\s*)?(?:gefasst|eingefügt)|(?:wird|werden)\s+[^:]*?(?:eingefügt|angefügt|(?:neu\s*)?gefasst)|(?:wird|werden)\s+durch\s+(?:die\s+)?(?:folgende|nachstehende)\s+(?:Fassung|Anlage)\s+(?:ersetzt|abgelöst)|(?:erhält|erhalten)\s+folgende\s+Bezeichnung|(?:wird|werden)\s+wie\s+folgt\s+ersetzt)\s*:\s*$/iu;
const AMENDMENT_REFERENCE_PATTERN = /\b(?:wird|werden)\b[^:]*\b(?:geändert|aufgehoben|ersetzt|gefasst|eingefügt|angefügt|verschoben|umbenannt)\b\s*:?\s*$/iu;
const INTRODUCTION_PATTERN = /^(?:Das\s+nachstehende\s+wird\s+(Gesetz|Verordnung):|.+?wird\s+durch\s+die\s+nachstehende\s+(.+?)\s+abgelöst:)$/iu;
const OPENING_QUOTE_PATTERN = /^(?:„|“|‚|‘|,,|")/u;
const CLOSING_QUOTE_PATTERN = /(?:“|”|’|''|")\s*$/u;
const SOURCE_HEADING_START_PATTERN = /^(?:(?:Erst|Zweit|Dritt|Viert|Fünft|Sechst|Siebt|Acht|Neunt|Zehnt|Elft|Zwölft|Dreizehnt|Vierzehnt|Fünfzehnt|Sechzehnt|Siebzehnt|Achtzehnt|Neunzehnt|Zwanzigst)(?:e|er|es)|Gemeinsame|Gemeinsamer|Gemeinsames)?\s*(?:Gesetz|Verordnung|Änderungsgesetz|Rechtsverordnung|Satzung|Förderrichtlinie|Richtlinie|Verwaltungsvorschrift|Allgemeinverfügung|Anordnung|Bekanntmachung|Berichtigung|Organisationserlass|Erlass|Verwaltungsabkommen|Staatsvertrag|Abkommen|Übereinkommen|Vertrag)/iu;
const OUTER_ARTICLE_TITLE_PATTERN = /^(?:Einführung|Änderung|Folgeänderungen?|Neufassung|Übergangsbestimmungen?|Übergangsrecht|Berichtspflicht|Einschränkung|Inkrafttreten|Außerkrafttreten|Bekanntmachung|Anpassung|Bereinigung|Rechtsbereinigung)/iu;
const EMBEDDED_NORM_TITLE_PATTERN = /^(?:Gesetz|Verordnung|Satzung|Staatsvertrag|Abkommen|Übereinkommen)\b/iu;
const TABLE_HEADER_SCOPES = new Set(['col', 'row', 'colgroup', 'rowgroup']);
const LIST_INTRO_END_PATTERN = /(?:folgende(?:n|r|s)?|insbesondere|wenn|soweit|bei|durch|wie folgt)\s*:?\s*$/iu;

const STRUCTURE_RANK = {
  part: 1,
  chapter: 2,
  section: 3,
  subsection: 4,
  article: 5,
  paragraph: 5,
  annex: 1,
};

export class NormHtmlParseError extends Error {
  constructor(fileName, message) {
    super(`${fileName}: ${message}`);
    this.name = 'NormHtmlParseError';
    this.fileName = fileName;
  }
}

function attrs(node) {
  return Object.fromEntries((node?.attrs ?? []).map((attribute) => [attribute.name, attribute.value]));
}

function findElement(node, tagName) {
  if (node?.tagName === tagName) return node;
  for (const child of node?.childNodes ?? []) {
    const found = findElement(child, tagName);
    if (found) return found;
  }
  return null;
}

function elementChildren(node, tagName) {
  return (node?.childNodes ?? []).filter((child) => child.tagName && (!tagName || child.tagName === tagName));
}

function descendants(node, predicate, output = []) {
  for (const child of node?.childNodes ?? []) {
    if (child.tagName && predicate(child)) output.push(child);
    descendants(child, predicate, output);
  }
  return output;
}

export function normalizeHtmlText(value) {
  return String(value ?? '')
    .replace(/\r\n?/gu, '\n')
    .replace(/[\u00a0\u202f]/gu, ' ')
    .replace(/[\u200b\u200c\u200d\u2060\ufeff]/gu, '')
    .replace(/[\t\f\v ]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function textWithBreaks(node) {
  if (!node) return '';
  if (node.nodeName === '#text') return node.value ?? '';
  if (node.tagName === 'br') return '\n';
  const separator = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'].includes(node.tagName) ? ' ' : '';
  return (node.childNodes ?? []).map(textWithBreaks).join(separator);
}

function textOf(node) {
  return normalizeHtmlText(textWithBreaks(node)).replace(/\n+/gu, ' ');
}

function linesOf(node) {
  return normalizeHtmlText(textWithBreaks(node)).split(/\n+/u).map((line) => line.trim()).filter(Boolean);
}

function normalizeHeadingText(value) {
  return normalizeHtmlText(value)
    .replace(/^(.*?\b(?:Gesetz|Verordnung|Verwaltungsvorschrift|Förderrichtlinie|Richtlinie|Anordnung|Bekanntmachung|Erlass|Staatsvertrag|Abkommen|Übereinkommen|Vertrag))(?=(?:zur|zum|über|der|des|für|betreffend|eines|einer)\b)/iu, '$1 ')
    .replace(/\)(?=vom\s+\d)/giu, ') ')
    .replace(/([\p{L}])(?=vom\s+\d{1,2}\.)/giu, '$1 ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function styleTexts(document) {
  return descendants(document, (node) => node.tagName === 'style').map((node) => textWithBreaks(node)).join('\n');
}

function parseDeclarations(value) {
  return Object.fromEntries(String(value).split(';').flatMap((entry) => {
    const separator = entry.indexOf(':');
    if (separator < 0) return [];
    return [[entry.slice(0, separator).trim().toLocaleLowerCase('en'), entry.slice(separator + 1).trim()]];
  }));
}

function unescapeCssString(value) {
  return String(value)
    .replace(/\\([0-9a-f]{1,6})\s?/giu, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\\(["'\\])/gu, '$1');
}

function quotedCssText(value) {
  return [...String(value).matchAll(/["']((?:\\.|[^"'])*)["']/gu)]
    .map((match) => unescapeCssString(match[1]))
    .join('');
}

export function parseGoogleDocsCss(css) {
  const classStyles = new Map();
  for (const match of String(css).matchAll(/\.([a-z][a-z0-9_-]*)\s*\{([^{}]*)\}/giu)) {
    classStyles.set(match[1], parseDeclarations(match[2]));
  }

  const listStyles = new Map();
  const beforeRule = /\.lst-kix_([a-z0-9_]+)-(\d+)\s*>\s*li(?:::?before)\s*\{([^{}]*)\}/giu;
  for (const match of String(css).matchAll(beforeRule)) {
    const declaration = parseDeclarations(match[3]);
    const content = declaration.content ?? '';
    const counter = content.match(/counter\([^,]+,\s*([a-z-]+)\s*\)/iu);
    const counterIndex = counter?.index ?? -1;
    const before = counterIndex >= 0 ? content.slice(0, counterIndex) : content;
    const after = counterIndex >= 0 ? content.slice(counterIndex + counter[0].length) : '';
    listStyles.set(`${match[1]}:${match[2]}`, {
      numberingStyle: counter?.[1]?.toLocaleLowerCase('en') ?? 'literal',
      prefix: counter ? quotedCssText(before) : '',
      suffix: counter ? quotedCssText(after).trimEnd() : '',
      literal: counter ? undefined : quotedCssText(content).trim(),
    });
  }

  const resets = new Map();
  const resetRule = /ol\.lst-kix_([a-z0-9_]+)-(\d+)\.start\s*\{([^{}]*)\}/giu;
  for (const match of String(css).matchAll(resetRule)) {
    const reset = parseDeclarations(match[3])['counter-reset']?.match(/(?:^|\s)(-?\d+)(?:\s|$)/u);
    if (reset) resets.set(`${match[1]}:${match[2]}`, Number.parseInt(reset[1], 10));
  }
  return { classStyles, listStyles, resets };
}

function nodeStyle(node, css) {
  const own = parseDeclarations(attrs(node).style ?? '');
  for (const className of (attrs(node).class ?? '').split(/\s+/u).filter(Boolean)) {
    Object.assign(own, css.classStyles.get(className) ?? {});
  }
  return own;
}

function cssLengthInPoints(value) {
  const match = String(value ?? '').trim().match(/^(-?\d+(?:\.\d+)?)(pt|px|in|cm|mm)?$/iu);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]);
  const unit = (match[2] ?? 'pt').toLocaleLowerCase('en');
  return amount * ({ pt: 1, px: 0.75, in: 72, cm: 72 / 2.54, mm: 72 / 25.4 }[unit] ?? 1);
}

function visualIndent(node, css, fallback = 0) {
  const indent = cssLengthInPoints(nodeStyle(node, css)['margin-left']);
  return indent ?? fallback;
}

function nodeHasPresentation(node, css, property, matcher) {
  if (matcher(nodeStyle(node, css)[property] ?? '')) return true;
  return (node.childNodes ?? []).some((child) => child.tagName && nodeHasPresentation(child, css, property, matcher));
}

function isBold(node, css) {
  if (node.tagName === 'b' || node.tagName === 'strong') return true;
  return nodeHasPresentation(node, css, 'font-weight', (value) => /^(?:[6-9]00|bold)$/iu.test(value));
}

function isCentered(node, css) {
  return nodeHasPresentation(node, css, 'text-align', (value) => value.toLocaleLowerCase('en') === 'center');
}

export function parseGermanDate(value) {
  const match = String(value ?? '').match(DATE_PATTERN);
  if (!match) return null;
  const months = {
    januar: '01', februar: '02', märz: '03', maerz: '03', april: '04', mai: '05', juni: '06',
    juli: '07', august: '08', september: '09', oktober: '10', november: '11', dezember: '12',
  };
  return `${match[3]}-${months[match[2].toLocaleLowerCase('de')]}-${match[1].padStart(2, '0')}`;
}

export function addUtcDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function alphaCounter(value, upper = false) {
  let current = value;
  let result = '';
  while (current > 0) {
    current -= 1;
    result = String.fromCharCode(97 + (current % 26)) + result;
    current = Math.floor(current / 26);
  }
  return upper ? result.toLocaleUpperCase('de') : result;
}

function romanCounter(value) {
  const pairs = [['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90], ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]];
  let current = value;
  let result = '';
  for (const [glyph, amount] of pairs) {
    while (current >= amount) {
      result += glyph;
      current -= amount;
    }
  }
  return result;
}

function formatCounter(value, style) {
  if (style === 'decimal' || style === 'decimal-leading-zero') return style === 'decimal-leading-zero' ? String(value).padStart(2, '0') : String(value);
  if (style === 'lower-latin' || style === 'lower-alpha') return alphaCounter(value);
  if (style === 'upper-latin' || style === 'upper-alpha') return alphaCounter(value, true);
  if (style === 'lower-roman') return romanCounter(value).toLocaleLowerCase('de');
  if (style === 'upper-roman') return romanCounter(value);
  return null;
}

function parseAlphaCounter(value) {
  let result = 0;
  for (const character of value.toLocaleLowerCase('de')) {
    const code = character.codePointAt(0) - 96;
    if (code < 1 || code > 26) return null;
    result = result * 26 + code;
  }
  return result || null;
}

function parseRomanCounter(value) {
  const glyphs = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const normalized = value.toLocaleUpperCase('de');
  if (!/^[IVXLCDM]+$/u.test(normalized)) return null;
  let result = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    const current = glyphs[normalized[index]];
    const next = glyphs[normalized[index + 1]] ?? 0;
    result += current < next ? -current : current;
  }
  return romanCounter(result) === normalized ? result : null;
}

function counterValueFromLabel(label, style) {
  const visible = style === 'decimal' || style === 'decimal-leading-zero'
    ? String(label ?? '').match(/\d+(?=\D*$)/u)?.[0]
    : String(label ?? '').match(/[\p{L}\d]+/u)?.[0];
  if (!visible) return null;
  if (style === 'decimal' || style === 'decimal-leading-zero') {
    return /^\d+$/u.test(visible) ? Number.parseInt(visible, 10) : null;
  }
  if (style === 'lower-latin' || style === 'lower-alpha' || style === 'upper-latin' || style === 'upper-alpha') {
    return /^[A-Z]+$/iu.test(visible) ? parseAlphaCounter(visible) : null;
  }
  if (style === 'lower-roman' || style === 'upper-roman') return parseRomanCounter(visible);
  return null;
}

function hasDirectQuotedProvision(block) {
  return block?.children?.some((child) => child.type === 'quotedProvision') ?? false;
}

function parseIdentity(heading, rawTitle) {
  const cleaned = normalizeHtmlText(rawTitle).replace(/^[„“”'`,.]+/u, '').replace(/\s+/gu, ' ').trim();
  let title = new RegExp(`^(?:${heading}|Gesetz|Verordnung)\\b`, 'iu').test(cleaned)
    ? cleaned
    : `${heading} ${cleaned}`.replace(/\s+/gu, ' ').trim();
  const parenthetical = title.match(/\(([^()]+?)\s+[–-]\s+([^()]+?)\)\s*$/u);
  let shortTitle = title;
  let abbr;
  if (parenthetical) {
    shortTitle = parenthetical[1].trim();
    abbr = parenthetical[2].trim();
    title = title.slice(0, parenthetical.index).trim();
  }
  return { title, shortTitle, ...(abbr ? { abbr } : {}) };
}

function sourceTypeFromHeading(heading, title) {
  if (/Berichtigung/iu.test(heading)) return 'berichtigung';
  if (/Verordnung/iu.test(heading)) return 'verordnung';
  if (/Verwaltungsvorschrift/iu.test(heading)) return 'verwaltungsvorschrift';
  if (/Verwaltungsabkommen/iu.test(heading)) return 'verwaltungsabkommen';
  if (/Förderrichtlinie/iu.test(heading)) return 'foerderrichtlinie';
  if (/Allgemeinverfügung/iu.test(heading)) return 'allgemeinverfuegung';
  if (/Bekanntmachung/iu.test(heading)) return 'bekanntmachung';
  if (/Staatsvertrag|Abkommen|Übereinkommen|Vertrag/iu.test(heading)) return 'staatsvertrag';
  if (/Änderung|Neuordnung|Einführung|Errichtung|Reform/iu.test(`${heading} ${title}`)) return 'aenderungsvorschrift';
  return 'gesetz';
}

export function parseStructureMarker(value) {
  const original = normalizeHtmlText(value);
  // Google Docs combines label, title and sometimes a short title in one
  // paragraph with several <br> elements. Structure matching must therefore
  // treat these visual line breaks as spaces while preserving the wording.
  const text = original.replace(/^[„“”'`,.]+/u, '').replace(/\n+/gu, ' ').trim();
  let match = text.match(/^((?:Teil|Kapitel|Abschnitt|Unterabschnitt)\s+(?:\d+[a-z]?|[IVXLCDM]+))\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) {
    const prefix = match[1].split(/\s+/u)[0].toLocaleLowerCase('de');
    const type = { teil: 'part', kapitel: 'chapter', abschnitt: 'section', unterabschnitt: 'subsection' }[prefix];
    return { type, label: match[1], title: match[2] || undefined };
  }
  match = text.match(/^([IVXLCDM]+\.\s*Abschnitt)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'section', label: match[1], title: match[2] || undefined };
  match = text.match(/^([IVXLCDM]+\.)(?:\s|\n)*(.*)$/u);
  if (match) return { type: 'section', label: match[1], title: match[2] || undefined };
  match = text.match(/^(Präambel)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'section', label: 'Präambel', title: match[2] || undefined };
  match = text.match(/^(Artikel\s+\d+[a-z]?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'article', label: match[1], title: match[2] || undefined };
  match = text.match(/^(Article\s+\d+[a-z]?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'article', label: match[1], title: match[2] || undefined };
  match = text.match(/^(§{1,2}\s*\d+[a-z]?(?:\s*(?:,|und)\s*\d+[a-z]?)?(?:\s+bis\s+\d+[a-z]?)?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'paragraph', label: match[1], title: match[2] || undefined };
  match = text.match(/^((?:Anlage(?:\s+\d+[a-z]?)?|Anhang)(?:\s*\([^)]*\))?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'annex', label: match[1], title: match[2] || undefined };
  match = text.match(/^((?:Annex|Appendix)\s+(?:\d+[a-z]?|[IVXLCDM]+))\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'annex', label: match[1], title: match[2] || undefined };
  match = text.match(/^(Regulation\s+\d+[a-z]?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'section', label: match[1], title: match[2] || undefined };
  return null;
}

function parsePrintedListItem(value) {
  const text = normalizeHtmlText(value).replace(/^[„“”'`,]+/u, '').trim();
  let match = text.match(/^(\d+(?:\.\d+)*\.?)\s+(.*)$/u);
  if (match) {
    const segments = match[1].replace(/\.$/u, '').split('.');
    return {
      label: match[1],
      text: match[2],
      level: Math.max(0, segments.length - 1),
      numberingStyle: 'decimal',
    };
  }
  match = text.match(/^([a-z]{1,2})\)\s+(.*)$/iu);
  if (match) {
    return {
      label: `${match[1]})`,
      text: match[2],
      level: match[1].length > 1 ? 1 : 0,
      numberingStyle: 'lower-latin',
    };
  }
  return null;
}

function directRowEntries(table) {
  const sections = elementChildren(table).filter((child) => ['thead', 'tbody', 'tfoot'].includes(child.tagName));
  return sections.length > 0
    ? sections.flatMap((section) => elementChildren(section, 'tr').map((node) => ({ node, section: section.tagName })))
    : elementChildren(table, 'tr').map((node) => ({ node, section: null }));
}

function directRows(table) {
  return directRowEntries(table).map(({ node }) => node);
}

function parsePositiveSpan(value, fallback = 1) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function tableBlock(node, css, fileName) {
  const rowEntries = directRowEntries(node);
  const firstContentRow = rowEntries.findIndex(({ node: row }) => elementChildren(row).some((cell) => textOf(cell)));
  const children = rowEntries.map(({ node: row, section }, rowIndex) => {
    const cells = elementChildren(row).filter((cell) => cell.tagName === 'td' || cell.tagName === 'th');
    const rowIsHeader = cells.length > 0 && cells.every((cell) => cell.tagName === 'th' || isBold(cell, css));
    return {
      type: 'tableRow',
      children: cells.map((cell, cellIndex) => {
        const paragraphs = descendants(cell, (entry) => entry.tagName === 'p').map(textOf).filter(Boolean);
        const cellText = paragraphs.length > 0 ? paragraphs.join('\n') : textOf(cell);
        const cellAttrs = attrs(cell);
        const explicitScope = cellAttrs.scope?.toLocaleLowerCase('en');
        if (explicitScope && !TABLE_HEADER_SCOPES.has(explicitScope)) {
          throw new NormHtmlParseError(fileName, `Tabelle enthält den nicht unterstützten Kopfzellen-Scope „${cellAttrs.scope}“`);
        }
        const header = cell.tagName === 'th' || Boolean(explicitScope) || (rowIndex === firstContentRow && rowIsHeader);
        const rowspan = parsePositiveSpan(cellAttrs.rowspan);
        const colspan = parsePositiveSpan(cellAttrs.colspan);
        let scope = explicitScope;
        if (!scope && header && section === 'thead') scope = colspan > 1 ? 'colgroup' : 'col';
        if (!scope && header && rowIndex === firstContentRow && rowIsHeader) scope = colspan > 1 ? 'colgroup' : 'col';
        if (!scope && cell.tagName === 'th' && section === 'tbody' && cellIndex === 0 && rowspan === 1 && colspan === 1) scope = 'row';
        return {
          type: header ? 'tableHeaderCell' : 'tableCell',
          text: cellText,
          ...(scope ? { scope } : {}),
          ...(rowspan > 1 ? { rowspan } : {}),
          ...(colspan > 1 ? { colspan } : {}),
          ...(paragraphs.length > 1 ? { children: paragraphs.map((text) => ({ type: 'paragraphText', text })) } : {}),
        };
      }),
    };
  });
  const table = { type: 'table', children };
  validateTableGrid(table, fileName);
  return table;
}

function validateTableGrid(table, fileName) {
  const occupied = [];
  let width = 0;
  for (let rowIndex = 0; rowIndex < table.children.length; rowIndex += 1) {
    occupied[rowIndex] ??= [];
    let column = 0;
    for (const cell of table.children[rowIndex].children ?? []) {
      while (occupied[rowIndex][column]) column += 1;
      const rowspan = cell.rowspan ?? 1;
      const colspan = cell.colspan ?? 1;
      for (let rowOffset = 0; rowOffset < rowspan; rowOffset += 1) {
        occupied[rowIndex + rowOffset] ??= [];
        for (let columnOffset = 0; columnOffset < colspan; columnOffset += 1) {
          if (occupied[rowIndex + rowOffset][column + columnOffset]) {
            throw new NormHtmlParseError(fileName, `Tabelle enthält überlappende Zellen in Zeile ${rowIndex + 1}`);
          }
          occupied[rowIndex + rowOffset][column + columnOffset] = true;
        }
      }
      column += colspan;
    }
    width = Math.max(width, occupied[rowIndex].length);
  }
  for (let rowIndex = 0; rowIndex < occupied.length; rowIndex += 1) {
    if (occupied[rowIndex].filter(Boolean).length !== width) {
      throw new NormHtmlParseError(fileName, `Tabelle verliert Spalten in Zeile ${rowIndex + 1} (${occupied[rowIndex].filter(Boolean).length} statt ${width})`);
    }
  }
  table.columns = width;
}

function flowNodes(body) {
  return elementChildren(body).filter((node) => !['script', 'style', 'link', 'meta', 'img', 'hr'].includes(node.tagName));
}

function nestedFlowNodes(container, output = []) {
  for (const child of elementChildren(container)) {
    if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ol', 'ul', 'table'].includes(child.tagName)) {
      output.push(child);
    } else {
      nestedFlowNodes(child, output);
    }
  }
  return output;
}

function textWithoutNestedLists(node) {
  if (!node) return '';
  if (node.nodeName === '#text') return node.value ?? '';
  if (node.tagName === 'br') return '\n';
  if (node.tagName === 'ol' || node.tagName === 'ul') return '';
  return (node.childNodes ?? []).map(textWithoutNestedLists).join('');
}

function makeAtomicTokens(nodes, css, fileName) {
  const counters = new Map();
  const tokens = [];
  let standardListSequence = 0;

  const emitStandardList = (node, listId, level = 0) => {
    const nodeAttrs = attrs(node);
    const rawType = node.tagName === 'ul' ? 'bullet' : (nodeAttrs.type ?? '1');
    const numberingStyle = {
      '1': 'decimal',
      a: 'lower-latin',
      A: 'upper-latin',
      i: 'lower-roman',
      I: 'upper-roman',
      bullet: 'bullet',
    }[rawType];
    if (!numberingStyle) {
      throw new NormHtmlParseError(fileName, `nicht unterstützter HTML-Listentyp „${rawType}“`);
    }
    const explicitStart = nodeAttrs.start ? Number.parseInt(nodeAttrs.start, 10) : 1;
    let counter = Number.isInteger(explicitStart) ? explicitStart : 1;
    const items = elementChildren(node, 'li');
    if (items.length === 0) throw new NormHtmlParseError(fileName, `leere Standardliste ${listId}, Ebene ${level}`);
    for (const item of items) {
      const parenthesized = nodeAttrs['data-label-style'] === 'parenthesized';
      const visible = numberingStyle === 'bullet' ? '–' : formatCounter(counter, numberingStyle);
      if (!visible) {
        throw new NormHtmlParseError(fileName, `nicht auflösbarer HTML-Listenzähler ${listId}, Ebene ${level}`);
      }
      tokens.push({
        kind: 'listItem',
        listId,
        level,
        numberingStyle,
        counterValue: numberingStyle === 'bullet' ? null : counter,
        numberingPrefix: parenthesized ? '(' : '',
        numberingSuffix: parenthesized ? ')' : numberingStyle === 'bullet' ? '' : '.',
        label: parenthesized ? `(${visible})` : numberingStyle === 'bullet' ? visible : `${visible}.`,
        text: normalizeHtmlText(textWithoutNestedLists(item)).replace(/\n+/gu, ' '),
        startsList: counter === explicitStart,
        indent: visualIndent(item, css, level * 36),
      });
      for (const nested of elementChildren(item).filter((child) => child.tagName === 'ol' || child.tagName === 'ul')) {
        emitStandardList(nested, listId, level + 1);
      }
      counter += 1;
    }
  };

  for (const node of nodes) {
    const text = textOf(node);
    if (!text && node.tagName !== 'table') continue;
    if (node.tagName === 'table') {
      tokens.push({ kind: 'table', block: tableBlock(node, css, fileName), text });
      continue;
    }
    if (node.tagName === 'ol' || node.tagName === 'ul') {
      const classes = attrs(node).class ?? '';
      const listMatch = classes.match(LIST_CLASS_PATTERN);
      if (!listMatch) {
        standardListSequence += 1;
        emitStandardList(node, `standard-${standardListSequence}`);
        continue;
      }
      const [, listId, rawLevel] = listMatch;
      const level = Number.parseInt(rawLevel, 10);
      const key = `${listId}:${level}`;
      const style = css.listStyles.get(key);
      if (!style) throw new NormHtmlParseError(fileName, `sichtbares Gliederungszeichen für Liste ${listId}, Ebene ${level} fehlt`);
      const nodeAttrs = attrs(node);
      const hasStartClass = classes.split(/\s+/u).includes('start');
      const explicitStart = nodeAttrs.start ? Number.parseInt(nodeAttrs.start, 10) : null;
      let counter = Number.isInteger(explicitStart)
        ? explicitStart
        : hasStartClass
          ? (css.resets.get(key) ?? 0) + 1
          : (counters.get(key) ?? 0) + 1;
      const items = elementChildren(node, 'li');
      if (items.length === 0) throw new NormHtmlParseError(fileName, `leere Liste ${listId}, Ebene ${level}`);
      for (const item of items) {
        const visible = style.literal ?? formatCounter(counter, style.numberingStyle);
        if (!visible) throw new NormHtmlParseError(fileName, `nicht auflösbarer Listenzähler ${listId}, Ebene ${level} (${style.numberingStyle})`);
        tokens.push({
          kind: 'listItem',
          listId,
          level,
          numberingStyle: style.numberingStyle,
          counterValue: counter,
          numberingPrefix: style.prefix,
          numberingSuffix: style.suffix,
          label: `${style.prefix}${visible}${style.suffix}`.trim(),
          text: textOf(item),
          startsList: hasStartClass,
          indent: visualIndent(item, css, level * 36),
        });
        counter += 1;
      }
      counters.set(key, counter - 1);
      for (const counterKey of [...counters.keys()]) {
        const [otherId, otherLevel] = counterKey.split(':');
        if (otherId === listId && Number.parseInt(otherLevel, 10) > level) counters.delete(counterKey);
      }
      continue;
    }
    const rawText = normalizeHtmlText(textWithBreaks(node));
    const numberedHeading = /^h[1-6]$/u.test(node.tagName)
      ? rawText.match(/^(\d+)\.\s+(.+)$/u)
      : null;
    const marker = numberedHeading
      ? { type: 'section', label: `${numberedHeading[1]}.`, title: numberedHeading[2] }
      : parseStructureMarker(rawText);
    const inlineParagraphReference = marker?.type === 'paragraph' &&
      !/^h[1-6]$/u.test(node.tagName) &&
      !rawText.includes('\n') &&
      !isBold(node, css) &&
      !isCentered(node, css) &&
      /\b(?:gilt|gelten|findet|finden|bleibt|bleiben|ist|sind|tritt|treten|wird|werden)\b/iu.test(marker.title ?? '');
    const markerLooksLikeHeading = marker && !inlineParagraphReference;
    const amendmentInstruction = QUOTE_TRIGGER_PATTERN.test(text);
    const amendmentReference = marker && ['article', 'paragraph'].includes(marker.type) && AMENDMENT_REFERENCE_PATTERN.test(marker.title ?? '');
    const printedItem = !markerLooksLikeHeading ? parsePrintedListItem(text) : null;
    if (markerLooksLikeHeading && !amendmentReference && !(amendmentInstruction && ['article', 'paragraph'].includes(marker.type))) {
      tokens.push({
        kind: 'structure', marker, text: rawText, rawText,
        tagName: node.tagName, bold: isBold(node, css), centered: isCentered(node, css),
        opensQuote: OPENING_QUOTE_PATTERN.test(rawText),
      });
    } else if (printedItem) {
      tokens.push({
        kind: 'listItem',
        listId: 'printed-outline',
        ...printedItem,
        startsList: printedItem.level === 0,
        indent: visualIndent(node, css, printedItem.level * 36),
      });
    } else {
      tokens.push({
        kind: 'paragraph', text, rawText, tagName: node.tagName,
        bold: isBold(node, css), centered: isCentered(node, css),
        indent: visualIndent(node, css),
      });
    }
  }
  return tokens;
}

function isOuterArticleToken(token) {
  return token?.kind === 'structure' && token.marker.type === 'article' && !token.opensQuote;
}

function groupIntroducedQuotes(tokens) {
  const grouped = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    grouped.push(token);
    if (
      isOuterArticleToken(token) &&
      EMBEDDED_NORM_TITLE_PATTERN.test(token.marker.title ?? '') &&
      tokens[index + 1]?.kind === 'structure' &&
      tokens[index + 1].marker.type !== 'article'
    ) {
      let end = index + 1;
      while (end < tokens.length && !isOuterArticleToken(tokens[end])) end += 1;
      grouped.push({ kind: 'quotedGroup', tokens: tokens.slice(index + 1, end), attachToPrevious: true, introduction: true });
      index = end - 1;
      continue;
    }
    if (token.kind !== 'paragraph' || !INTRODUCTION_PATTERN.test(token.text)) continue;
    let end = index + 1;
    while (end < tokens.length && !isOuterArticleToken(tokens[end])) end += 1;
    if (end > index + 1) {
      grouped.push({ kind: 'quotedGroup', tokens: tokens.slice(index + 1, end), attachToPrevious: false, introduction: true });
      index = end - 1;
    }
  }
  return grouped;
}

function groupAmendmentQuotes(tokens) {
  const grouped = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    grouped.push(token);
    if (!['listItem', 'paragraph'].includes(token.kind) || !QUOTE_TRIGGER_PATTERN.test(token.text)) continue;
    let end = index + 1;
    let sawContent = false;
    while (end < tokens.length) {
      const candidate = tokens[end];
      if (candidate.kind === 'listItem' && candidate.listId === token.listId && candidate.level <= token.level) break;
      if (
        sawContent &&
        candidate.kind === 'structure' &&
        ['article', 'paragraph'].includes(candidate.marker.type) &&
        (
          CLOSING_QUOTE_PATTERN.test(tokens[end - 1]?.text ?? tokens[end - 1]?.rawText ?? '') ||
          OUTER_ARTICLE_TITLE_PATTERN.test(candidate.marker.title ?? '')
        )
      ) break;
      if (
        sawContent &&
        candidate.kind === 'listItem' &&
        candidate.level <= token.level &&
        candidate.numberingStyle === 'decimal' &&
        CLOSING_QUOTE_PATTERN.test(tokens[end - 1]?.text ?? tokens[end - 1]?.rawText ?? '')
      ) break;
      sawContent = true;
      end += 1;
    }
    if (end > index + 1) {
      grouped.push({
        kind: 'quotedGroup',
        tokens: tokens.slice(index + 1, end),
        attachToPrevious: token.kind === 'listItem',
        introduction: false,
      });
      index = end - 1;
    }
  }
  return grouped;
}

function currentChildren(stack) {
  return stack.at(-1).children;
}

function numberingRank(style) {
  if (style === 'decimal' || style === 'decimal-leading-zero') return 1;
  if (style === 'lower-latin' || style === 'lower-alpha' || style === 'upper-latin' || style === 'upper-alpha') return 2;
  if (style === 'lower-roman' || style === 'upper-roman') return 3;
  if (style === 'bullet' || style === 'literal') return 4;
  return 0;
}

function parseTokens(tokens, fileName, { inQuote = false, parseAmendmentQuotes = true } = {}) {
  const root = [];
  const stack = [{ rank: 0, children: root }];
  const listParents = new Map();
  const listBaselines = new Map();
  const listCounterOffsets = new WeakMap();
  let lastBlock = null;
  let lastListState = null;

  const append = (block) => {
    currentChildren(stack).push(block);
    lastBlock = block;
    return block;
  };

  const groupedTokens = parseAmendmentQuotes
    ? groupAmendmentQuotes(groupIntroducedQuotes(tokens))
    : tokens;
  for (const token of groupedTokens) {
    if (token.kind === 'structure') {
      const block = { type: token.marker.type, label: token.marker.label, ...(token.marker.title ? { title: token.marker.title } : {}), children: [] };
      const rank = STRUCTURE_RANK[block.type];
      while (stack.length > 1 && stack.at(-1).rank >= rank) stack.pop();
      currentChildren(stack).push(block);
      stack.push({ rank, children: block.children });
      lastBlock = block;
      lastListState = null;
      listParents.clear();
      listBaselines.clear();
      continue;
    }
    if (token.kind === 'paragraph') {
      const subparagraph = token.text.match(/^\((\d+[a-z]?)\)\s*(.*)$/iu);
      if (inQuote && !subparagraph && ['article', 'paragraph'].includes(lastBlock?.type) && !lastBlock.title) {
        lastBlock.title = token.text.replace(/^[„“”'`,.]+/u, '').trim();
        continue;
      }
      const paragraphBlock = subparagraph
        ? { type: 'subparagraph', label: `(${subparagraph[1]})`, text: subparagraph[2], children: [] }
        : { type: 'paragraphText', text: token.text };
      const continuationOfListItem = !inQuote && !subparagraph && lastListState &&
        !QUOTE_TRIGGER_PATTERN.test(lastListState.block.text ?? '') &&
        !AMENDMENT_REFERENCE_PATTERN.test(lastListState.block.text ?? '') &&
        (lastListState.continuationOpen || /:\s*$/u.test(lastListState.block.text ?? '')) &&
        token.indent >= (lastListState.indent ?? 0) - 0.5;
      const continuationAfterNestedCorrectionList = !parseAmendmentQuotes && !subparagraph && lastListState?.semanticLevel > 0 &&
        token.indent >= (lastListState.indent ?? 0) - 0.5;
      if (continuationOfListItem || continuationAfterNestedCorrectionList) {
        if (continuationAfterNestedCorrectionList) {
          lastListState.destination.push(paragraphBlock);
          lastBlock = paragraphBlock;
          continue;
        }
        lastListState.block.children ??= [];
        lastListState.block.children.push(paragraphBlock);
        lastListState.continuationOpen = true;
        lastBlock = paragraphBlock;
      } else {
        append(paragraphBlock);
        if (lastListState) lastListState.contextInterrupted = true;
      }
      continue;
    }
    if (token.kind === 'table') {
      append(token.block);
      continue;
    }
    if (token.kind === 'listItem') {
      let parents = listParents.get(token.listId);
      if (!parents) {
        parents = new Map();
        listParents.set(token.listId, parents);
      }
      let baseline = listBaselines.get(token.listId);
      if (baseline === undefined || token.level < baseline) {
        baseline = token.level;
        listBaselines.set(token.listId, baseline);
        parents.clear();
      }
      let semanticLevel = token.level - baseline;
      let destination = currentChildren(stack);
      if (semanticLevel > 0) {
        let parent;
        for (let parentLevel = semanticLevel - 1; parentLevel >= 0; parentLevel -= 1) {
          parent = parents.get(parentLevel);
          if (parent) break;
        }
        if (parent) {
          parent.children ??= [];
          destination = parent.children;
        }
      }
      if (
        !parseAmendmentQuotes && semanticLevel > 0 && lastListState &&
        token.indent < (lastListState.indent ?? 0) - 0.5 &&
        token.level < lastListState.sourceLevel
      ) {
        semanticLevel = 0;
        destination = currentChildren(stack);
        listBaselines.set(token.listId, token.level);
        parents.clear();
      }
      const deeperVisualIndent = token.indent > (lastListState?.indent ?? 0) + 0.5;
      const continuedAtSameIndent = !parseAmendmentQuotes && token.level > 0 &&
        token.indent >= (lastListState?.indent ?? 0) - 0.5 &&
        LIST_INTRO_END_PATTERN.test(lastListState?.block.text ?? '');
      const mayUseVisualParent = !inQuote && (semanticLevel === 0 || continuedAtSameIndent) && lastListState &&
        !QUOTE_TRIGGER_PATTERN.test(lastListState.block.text ?? '') &&
        !AMENDMENT_REFERENCE_PATTERN.test(lastListState.block.text ?? '') &&
        token.listId !== lastListState.semanticListId &&
        (deeperVisualIndent || continuedAtSameIndent) &&
        (
          continuedAtSameIndent ||
          lastListState.continuationOpen ||
          /:\s*$/u.test(lastListState.block.text ?? '') ||
          (
            !lastListState.contextInterrupted &&
            lastBlock === lastListState.block &&
            numberingRank(token.numberingStyle) > numberingRank(lastListState.numberingStyle)
          )
        );
      if (mayUseVisualParent) {
        semanticLevel = lastListState.semanticLevel + 1;
        lastListState.block.children ??= [];
        destination = lastListState.block.children;
        listBaselines.set(token.listId, token.level - semanticLevel);
        parents.set(semanticLevel - 1, lastListState.block);
      }
      const continuesAfterQuote =
        lastListState &&
        lastBlock === lastListState.block &&
        currentChildren(stack) === lastListState.structureParent &&
        token.level === lastListState.sourceLevel &&
        token.numberingStyle === lastListState.numberingStyle &&
        hasDirectQuotedProvision(lastListState.block);
      if (continuesAfterQuote) {
        semanticLevel = lastListState.semanticLevel;
        destination = lastListState.destination;
        listBaselines.set(token.listId, token.level - semanticLevel);
      }
      let destinationOffsets = listCounterOffsets.get(destination);
      if (!destinationOffsets) {
        destinationOffsets = new Map();
        listCounterOffsets.set(destination, destinationOffsets);
      }
      const counterKey = `${token.listId}:${token.level}`;
      let existingCounterOffset = destinationOffsets.get(counterKey) ?? 0;
      let semanticCounterValue = Number.isInteger(token.counterValue) ? token.counterValue + existingCounterOffset : token.counterValue;
      let semanticListId = token.listId;
      let label = existingCounterOffset === 0
        ? token.label
        : `${token.numberingPrefix}${formatCounter(semanticCounterValue, token.numberingStyle)}${token.numberingSuffix}`.trim();
      if (continuesAfterQuote) {
        semanticListId = lastListState.semanticListId;
        const expectedCounterValue = lastListState.counterValue + 1;
        if (Number.isInteger(token.counterValue) && token.counterValue === expectedCounterValue) {
          existingCounterOffset = 0;
          destinationOffsets.set(counterKey, 0);
          semanticCounterValue = token.counterValue;
          label = token.label;
        } else if (Number.isInteger(token.counterValue) && semanticCounterValue !== expectedCounterValue && token.counterValue <= lastListState.counterValue) {
          semanticCounterValue = expectedCounterValue;
          existingCounterOffset = semanticCounterValue - token.counterValue;
          destinationOffsets.set(counterKey, existingCounterOffset);
          const visible = formatCounter(semanticCounterValue, token.numberingStyle);
          if (!visible) {
            throw new NormHtmlParseError(fileName, `needs-review: Listenfortsetzung nach Zitat mit nicht auflösbarem Stil ${token.numberingStyle}`);
          }
          label = `${token.numberingPrefix}${visible}${token.numberingSuffix}`.trim();
        }
      }
      const type = /^\(\d+[a-z]?\)$/iu.test(token.label) ? 'subparagraph' : 'item';
      const block = {
        type,
        label,
        text: token.text,
        level: semanticLevel,
        listId: semanticListId,
        numberingStyle: token.numberingStyle,
        children: [],
      };
      destination.push(block);
      parents.set(semanticLevel, block);
      for (const level of [...parents.keys()]) if (level > semanticLevel) parents.delete(level);
      lastBlock = block;
      lastListState = {
        block,
        counterValue: semanticCounterValue,
        destination,
        numberingStyle: token.numberingStyle,
        semanticLevel,
        semanticListId,
        sourceLevel: token.level,
        structureParent: currentChildren(stack),
        indent: token.indent,
        continuationOpen: false,
        contextInterrupted: false,
      };
      continue;
    }
    if (token.kind === 'quotedGroup') {
      const children = parseTokens(token.tokens, fileName, { inQuote: true, parseAmendmentQuotes });
      if (children.length === 0) throw new NormHtmlParseError(fileName, 'zitierte Neufassung besitzt keinen Inhalt');
      const quote = { type: 'quotedProvision', children };
      if (token.attachToPrevious) {
        if (!lastBlock) throw new NormHtmlParseError(fileName, 'zitierte Neufassung kann keiner Änderungsanweisung zugeordnet werden');
        lastBlock.children ??= [];
        lastBlock.children.push(quote);
      } else {
        append(quote);
      }
    }
  }
  return root;
}

export function validateListSequences(body) {
  const issues = [];
  const visit = (children, path = []) => {
    let previous = null;
    for (const [index, block] of (children ?? []).entries()) {
      const blockPath = [...path, block.label ?? `${block.type}[${index}]`];
      const listBlock = ['item', 'subitem', 'subparagraph'].includes(block.type) && block.listId && block.numberingStyle;
      if (!listBlock || block.listId === 'printed-outline') {
        previous = null;
      } else if (previous && previous.listId === block.listId) {
        if (previous.level !== block.level) {
          issues.push(`${blockPath.join(' > ')}: widersprüchliche semantische Listenebenen ${previous.level} und ${block.level}`);
        } else if (previous.numberingStyle !== block.numberingStyle) {
          issues.push(`${blockPath.join(' > ')}: widersprüchliche Nummerierungsstile ${previous.numberingStyle} und ${block.numberingStyle}`);
        } else {
          const previousValue = counterValueFromLabel(previous.label, previous.numberingStyle);
          const currentValue = counterValueFromLabel(block.label, block.numberingStyle);
          if (previousValue !== null && currentValue !== null && currentValue <= previousValue) {
            const reason = currentValue === previousValue
              ? 'doppeltes Gliederungszeichen'
              : 'rückwärts laufende Nummerierungsfolge oder unerwarteter Neustart';
            issues.push(`${blockPath.join(' > ')}: ${reason} (${previous.label} → ${block.label})`);
          } else if (previousValue !== null && currentValue !== null && currentValue !== previousValue + 1) {
            issues.push(`${blockPath.join(' > ')}: lückenhafte Nummerierungsfolge oder nicht aufgelöster Listenwechsel (${previous.label} → ${block.label})`);
          }
        }
        previous = block;
      } else {
        previous = block;
      }
      visit(block.children, blockPath);
    }
  };
  visit(body);
  return issues;
}

function flattenBlocks(blocks, output = [], insideQuote = false) {
  for (const block of blocks ?? []) {
    output.push({ block, insideQuote });
    flattenBlocks(block.children, output, insideQuote || block.type === 'quotedProvision');
  }
  return output;
}

function validateBody(fileName, title, body) {
  const flat = flattenBlocks(body);
  const main = flat.filter(({ block, insideQuote }) => !insideQuote && [
    'part', 'chapter', 'section', 'subsection', 'article', 'paragraph', 'annex', 'item', 'subitem', 'table',
  ].includes(block.type));
  if (main.length === 0) throw new NormHtmlParseError(fileName, `„${title}“ enthält keine erkennbare äußere Gliederung`);
  const bodyText = flat.map(({ block }) => `${block.label ?? ''} ${block.title ?? ''} ${block.text ?? ''}`).join(' ');
  const contamination = bodyText.match(CONTAMINATION_PATTERN)?.[0];
  if (contamination) throw new NormHtmlParseError(fileName, `Kopf-, Fuß-, CSS-, Bild- oder Signaturdaten sind in den Normkörper von „${title}“ geraten (${contamination})`);
  const sequenceIssues = validateListSequences(body);
  if (sequenceIssues.length > 0) {
    throw new NormHtmlParseError(fileName, `needs-review: ${sequenceIssues.join('; ')}`);
  }
}

function inferEffectiveDate(text, publicationDate) {
  if (/tritt\s+(?:am|mit dem)\s+Tag\s+(?:nach\s+)?(?:seiner|ihrer|der)\s+Verkündung\s+in\s+Kraft/iu.test(text)) {
    return /Tag\s+nach/iu.test(text) ? addUtcDays(publicationDate, 1) : publicationDate;
  }
  const explicit = text.match(/tritt\s+am\s+(\d{1,2}\.\s*[A-ZÄÖÜa-zäöüß]+\s+\d{4})\s+in\s+Kraft/iu);
  return explicit ? parseGermanDate(explicit[1]) : null;
}

function sanitizeNormNodes(nodes) {
  const result = [];
  let signature = false;
  for (const node of nodes) {
    const text = textOf(node);
    const marker = parseStructureMarker(normalizeHtmlText(textWithBreaks(node)));
    if (SIGNATURE_PATTERN.test(text)) {
      signature = true;
      continue;
    }
    if (signature) {
      if (marker?.type !== 'annex') continue;
      signature = false;
    }
    if (!text && node.tagName !== 'table') continue;
    if (/^(?:Seite|\d+)$/iu.test(text)) continue;
    if (
      !['ol', 'ul', 'table'].includes(node.tagName) &&
      text.length <= 300 &&
      /Gesetz- und Verordnungsblatt/iu.test(text) &&
      /Nr\.\s*\d+/u.test(text)
    ) continue;
    result.push(node);
  }
  return result;
}

function headingRanges(nodes, tocIndex, css) {
  const ranges = [];
  let floor = tocIndex + 1;
  for (let end = tocIndex + 1; end < nodes.length; end += 1) {
    const endText = textOf(nodes[end]);
    if (nodes[end].tagName === 'table' || /^(?:Seite\s*)?\d+$/iu.test(endText)) floor = end + 1;
    if (!parseGermanDate(endText)) continue;
    for (let start = end; start >= Math.max(floor, end - 3); start -= 1) {
      const text = normalizeHeadingText(nodes.slice(start, end + 1).map(textOf).join(' '));
      const presentedAsHeading = start === floor || nodes.slice(start, end + 1).some((node) =>
        /^h[1-6]$/u.test(node.tagName) || linesOf(node).length > 1 || isBold(node, css) || isCentered(node, css)
      );
      if ((ranges.length > 0 && !presentedAsHeading) || !SOURCE_HEADING_START_PATTERN.test(text) || !/\bvom\s+\d{1,2}\./iu.test(text)) continue;
      ranges.push({ start, end, text });
      floor = end + 1;
      break;
    }
  }
  return ranges;
}

function extractIntroducedNorms(tokens, publication, fileName) {
  const introduced = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind !== 'paragraph') continue;
    const introduction = token.text.match(INTRODUCTION_PATTERN);
    if (!introduction) continue;
    let end = index + 1;
    while (end < tokens.length && !isOuterArticleToken(tokens[end])) end += 1;
    const segment = tokens.slice(index + 1, end);
    const firstStructure = segment.findIndex((entry) => entry.kind === 'structure');
    if (firstStructure < 0) throw new NormHtmlParseError(fileName, `eingeführte Stammnorm nach „${token.text}“ besitzt keine Hauptgliederung`);
    const titleText = segment.slice(0, firstStructure).filter((entry) => entry.kind === 'paragraph').map((entry) => entry.text).join(' ');
    const heading = introduction[1] ?? 'Gesetz';
    const rawIdentity = titleText.replace(/^[„“”'`,.]+/u, '').trim();
    const replacementMatch = introduction[2] ? rawIdentity.match(/^(.+?)\s*\(([^()]+)\)\s*$/u) : null;
    const identity = replacementMatch
      ? { title: replacementMatch[1].trim(), shortTitle: replacementMatch[1].trim(), abbr: replacementMatch[2].trim() }
      : parseIdentity(heading, rawIdentity);
    const body = parseTokens(segment.slice(firstStructure), fileName, { inQuote: false });
    validateBody(fileName, identity.title, body);
    introduced.push({
      kind: introduction[2] ? 'replacement' : 'introduced',
      heading,
      ...identity,
      type: /Verordnung/iu.test(heading) ? 'verordnung' : 'gesetz',
      documentDate: publication.documentDate,
      publicationDate: publication.publicationDate,
      effectiveDate: publication.effectiveDate,
      body,
    });
    index = end - 1;
  }
  return introduced;
}

function parsedDocument(fileName, html) {
  let document;
  try {
    document = parse(html, { sourceCodeLocationInfo: true });
  } catch (error) {
    throw new NormHtmlParseError(fileName, `HTML5-Parserfehler: ${error.message}`);
  }
  const body = findElement(document, 'body');
  if (!body) throw new NormHtmlParseError(fileName, 'HTML-Dokument besitzt keinen body');
  const css = parseGoogleDocsCss(styleTexts(document));
  return { document, body, css, nodes: flowNodes(body), documentText: textOf(body) };
}

export function classifyHtmlSource(fileName, html) {
  const { documentText } = parsedDocument(fileName, html);
  // Bundesblätter können vor der Inhaltsübersicht einen deutlich längeren
  // Herausgeberkopf als die ostdeutschen Verkündungsreihen führen.
  const lead = documentText.slice(0, 20000);
  const publicationIdentity = detectPublicationIdentity(lead);
  const publication = publicationIdentity &&
    /Ausgegeben\s+zu/iu.test(lead) &&
    (publicationIdentity.publication === 'GMBl.' ? /INHALT/iu.test(lead) : /Inhaltsverzeichnis/iu.test(lead));
  const editorial = /\b(?:Pressemitteilung|Begründung|Vorblatt|Erläuterung|Begleittext)\b/iu.test(lead) || /^PM[-_. ]/iu.test(fileName);
  const structureCount = (documentText.match(/(?:^|\s)(?:Artikel\s+\d+[a-z]?|§{1,2}\s*\d+[a-z]?)/giu) ?? []).length;
  const consolidated = /Staatsverfassung/iu.test(fileName) || /Nichtamtliches Inhaltsverzeichnis/iu.test(lead) || structureCount >= 3;
  if (publication) return { kind: 'publication', publication: publicationIdentity.publication, reason: `${publicationIdentity.longName} mit internem Ausgabekopf und Inhaltsverzeichnis` };
  if (editorial) return { kind: 'editorial', reason: 'redaktioneller Begleittext' };
  if (consolidated) return { kind: 'consolidated', reason: 'konsolidierte oder eigenständige Einzelnorm' };
  if (/<html\b/iu.test(html)) return { kind: 'unsupported', reason: 'HTML ohne eindeutige Norm- oder Verkündungsblattstruktur' };
  return { kind: 'ambiguous', reason: 'keine eindeutige HTML-Dokumentstruktur' };
}

function detectPublicationIdentity(value) {
  const text = String(value ?? '');
  const identities = [
    { publication: 'GMBl.', longName: 'Gemeinsames Ministerialblatt', pattern: /\b(?:GMBl\.|Gemeinsames\s+Ministerialblatt)/iu },
    { publication: 'OVertrBl.', longName: 'Vertragsblatt', pattern: /\b(?:OVertrBl\.|Vertragsblatt\s*für\s+den\s+Freistaat\s+Ostdeutschland)/iu },
    { publication: 'StAnzO.', longName: 'Staatsanzeiger', pattern: /\b(?:StAnzO\.|Staatsanzeiger\s*für\s+den\s+Freistaat\s+Ostdeutschland)/iu },
    { publication: 'OABl.', longName: 'Amtsblatt', pattern: /\b(?:OABl\.|Amtsblatt\s*für\s+den\s+Freistaat\s+Ostdeutschland)/iu },
    { publication: 'OGVBl.', longName: 'Gesetz- und Verordnungsblatt', pattern: /\b(?:OGVBl\.|Gesetz-\s*und\s+Verordnungsblatt)/iu },
  ];
  return identities
    .map(({ pattern, ...identity }) => ({ ...identity, index: text.search(pattern) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index)[0] ?? null;
}

function parseHeadingRange(range, fileName) {
  const documentDate = parseGermanDate(range.text);
  if (!documentDate) throw new NormHtmlParseError(fileName, 'Dokumentdatum in der Normüberschrift fehlt');
  const dateMatch = range.text.match(DATE_PATTERN);
  const rawTitle = range.text.slice(0, dateMatch?.index ?? range.text.length).replace(/\s+vom\s*$/iu, '').trim();
  const heading = rawTitle.match(SOURCE_HEADING_START_PATTERN)?.[0]?.trim();
  if (!heading) throw new NormHtmlParseError(fileName, `Dokumenttyp in der Normüberschrift „${rawTitle}“ fehlt`);
  return { heading, documentDate, ...parseIdentity(heading, rawTitle) };
}

function tocEntries(nodes, tocIndex, mainStart) {
  const result = [];
  let pendingDate = null;
  const candidates = [];
  for (const node of nodes.slice(tocIndex + 1, mainStart)) {
    if (node.tagName === 'table') {
      candidates.push(...descendants(node, (entry) => entry.tagName === 'td' || entry.tagName === 'th').map(textOf));
    } else {
      candidates.push(textOf(node));
    }
  }
  for (const candidate of candidates.map(normalizeHeadingText).filter(Boolean)) {
    const date = parseGermanDate(candidate);
    if (date && DATE_PATTERN.test(candidate) && candidate.replace(DATE_PATTERN, '').trim() === '') {
      pendingDate = date;
      continue;
    }
    if (/^(?:Seite\s*)?\d+$/iu.test(candidate)) continue;
    if (!/(?:Gesetz|Verordnung|Verwaltungsvorschrift|Förderrichtlinie|Richtlinie|Allgemeinverfügung|Anordnung|Bekanntmachung|Berichtigung|Erlass|Staatsvertrag|Abkommen|Übereinkommen|Vertrag)/iu.test(candidate)) continue;
    result.push({ title: candidate, documentDate: pendingDate });
    pendingDate = null;
  }
  return result;
}

function preferTocTitle(identity, tocTitle) {
  if (!tocTitle || identity.title === tocTitle) return identity;
  const normalizedTitle = identity.title.replace(/\s+/gu, ' ').trim();
  const normalizedTocTitle = tocTitle.replace(/\s+/gu, ' ').trim();
  if (normalizedTitle.endsWith(normalizedTocTitle)) {
    return { ...identity, title: normalizedTocTitle, shortTitle: normalizedTocTitle };
  }
  return identity;
}

function normalizeAdministrativeAgreementBody(body) {
  const paragraphOne = body.find((block) => block.type === 'paragraph' && block.label === '§ 1');
  const firstSubparagraphIndex = paragraphOne?.children?.findIndex((block) =>
    block.type === 'subparagraph' && block.label === '(1)'
  ) ?? -1;
  if (firstSubparagraphIndex < 0) return body;
  const numberedItems = paragraphOne.children.slice(firstSubparagraphIndex + 1, firstSubparagraphIndex + 5);
  if (
    numberedItems.length !== 4 ||
    numberedItems.some((block, index) => block.type !== 'item' || block.label !== `${index + 1}.`)
  ) {
    return body;
  }
  const firstSubparagraph = paragraphOne.children[firstSubparagraphIndex];
  firstSubparagraph.children = numberedItems;
  paragraphOne.children.splice(firstSubparagraphIndex + 1, numberedItems.length);
  return body;
}

function parseFederalMinisterialGazette(fileName, nodes, css, classification) {
  const tocIndex = nodes.findIndex((node) => /^INHALT$/u.test(textOf(node)));
  if (tocIndex < 0) throw new NormHtmlParseError(fileName, 'Inhaltsübersicht „INHALT“ fehlt');
  const headerText = nodes.slice(0, tocIndex).map(textOf).join(' ');
  const issueMatch = headerText.match(/\bNr\.\s*(\d+)\b/u);
  const publicationDate = parseGermanDate(headerText.match(/Ausgegeben\s+zu[\s\S]{0,120}/iu)?.[0] ?? headerText);
  if (!issueMatch || !publicationDate) {
    throw new NormHtmlParseError(fileName, 'Ausgabenummer oder Ausgabedatum konnte nicht aus dem GMBl.-Kopf bestimmt werden');
  }

  const headingIndex = nodes.findIndex((node, index) =>
    index > tocIndex &&
    node.tagName !== 'table' &&
    /^Verwaltungsabkommen\s+zwischen\b/iu.test(textOf(node))
  );
  if (headingIndex < 0) {
    throw new NormHtmlParseError(fileName, 'Verwaltungsabkommen nach der GMBl.-Inhaltsübersicht fehlt');
  }
  const title = normalizeHeadingText(textOf(nodes[headingIndex]));
  const signatureIndex = nodes.findIndex((node, index) =>
    index > headingIndex && /^Leipzig,\s+den\s+\d{1,2}\./iu.test(textOf(node))
  );
  const documentDate = parseGermanDate(signatureIndex >= 0 ? textOf(nodes[signatureIndex]) : '');
  if (!documentDate) throw new NormHtmlParseError(fileName, 'Unterzeichnungsdatum in der Leipziger Schlussformel fehlt');

  const bodyNodes = sanitizeNormNodes(nodes.slice(headingIndex + 1))
    .filter((node) => node.tagName !== 'table' || textOf(node).length > 0);
  const body = normalizeAdministrativeAgreementBody(
    parseTokens(makeAtomicTokens(bodyNodes, css, fileName), fileName),
  );
  validateBody(fileName, title, body);
  const tocText = nodes.slice(tocIndex + 1, headingIndex).map(textOf).join(' ');
  const startPage = tocText.match(/Verwaltungsabkommen[\s\S]*?Ostdeutschland\s+(\d+)\b/iu)?.[1] ?? '2';
  return {
    kind: 'publication',
    fileName,
    issue: issueMatch[1],
    publication: classification.publication,
    year: Number(publicationDate.slice(0, 4)),
    publicationDate,
    effectiveDate: null,
    heading: 'Verwaltungsabkommen',
    title,
    shortTitle: title,
    documentDate,
    type: 'verwaltungsabkommen',
    startPage,
    body,
    introducedNorms: [],
  };
}

export function parsePublicationHtml(fileName, html) {
  const classification = classifyHtmlSource(fileName, html);
  if (classification.kind !== 'publication') throw new NormHtmlParseError(fileName, `Quelle ist kein Verkündungsblatt (${classification.reason})`);
  const { nodes, css } = parsedDocument(fileName, html);
  if (classification.publication === 'GMBl.') {
    return parseFederalMinisterialGazette(fileName, nodes, css, classification);
  }
  const headerText = nodes.slice(0, 10).map(textOf).join(' ');
  const issueMatch = headerText.match(/\bNr\.\s*(\d+)\b/u);
  const publicationDate = parseGermanDate(headerText.match(/Ausgegeben\s+zu[\s\S]{0,120}/iu)?.[0] ?? headerText);
  if (!issueMatch || !publicationDate) throw new NormHtmlParseError(fileName, 'Ausgabenummer oder Ausgabedatum konnte nicht aus dem Inhalt bestimmt werden');
  const tocIndex = nodes.findIndex((node) => /^Inhaltsverzeichnis$/iu.test(textOf(node)));
  if (tocIndex < 0) throw new NormHtmlParseError(fileName, 'Inhaltsverzeichnis fehlt');
  const ranges = headingRanges(nodes, tocIndex, css);
  if (ranges.length === 0) throw new NormHtmlParseError(fileName, 'keine unterstützte Normüberschrift nach dem Inhaltsverzeichnis erkannt');
  const [mainRange] = ranges;
  const toc = tocEntries(nodes, tocIndex, mainRange.start);
  const mainIdentity = preferTocTitle(parseHeadingRange(mainRange, fileName), toc[0]?.title);
  const tocText = nodes.slice(tocIndex, mainRange.start).map(textOf).join(' ');
  const startPage = tocText.match(/\bSeite\s*(\d+)\b/iu)?.[1];
  const undatedPublishedStart = classification.publication === 'OVertrBl.' && ranges.length === 1
    ? nodes.findIndex((node, index) => index > mainRange.end && /^(?:CONVENTION|ABKOMMEN|ÜBEREINKOMMEN)\b/iu.test(textOf(node)))
    : -1;
  const mainEnd = ranges[1]?.start ?? (undatedPublishedStart >= 0 ? undatedPublishedStart : nodes.length);
  const bodyNodes = sanitizeNormNodes(nodes.slice(mainRange.end + 1, mainEnd));
  const rawTokens = makeAtomicTokens(bodyNodes, css, fileName);
  const body = parseTokens(rawTokens, fileName, {
    parseAmendmentQuotes: sourceTypeFromHeading(mainIdentity.heading, mainIdentity.title) !== 'berichtigung',
  });
  validateBody(fileName, mainIdentity.title, body);
  const effectiveDate = inferEffectiveDate(bodyNodes.map(textOf).join(' '), publicationDate);
  const publication = {
    kind: 'publication', fileName, issue: issueMatch[1], publication: classification.publication, year: Number(publicationDate.slice(0, 4)), publicationDate,
    effectiveDate, ...mainIdentity,
    type: sourceTypeFromHeading(mainIdentity.heading, mainIdentity.title),
    ...(startPage ? { startPage } : {}), body,
  };
  publication.introducedNorms = extractIntroducedNorms(rawTokens, publication, fileName);
  for (let rangeIndex = 1; rangeIndex < ranges.length; rangeIndex += 1) {
    const range = ranges[rangeIndex];
    const nextStart = ranges[rangeIndex + 1]?.start ?? nodes.length;
    const identity = preferTocTitle(parseHeadingRange(range, fileName), toc[rangeIndex]?.title);
    const secondaryNodes = sanitizeNormNodes(nodes.slice(range.end + 1, nextStart));
    const secondaryBody = parseTokens(makeAtomicTokens(secondaryNodes, css, fileName), fileName);
    validateBody(fileName, identity.title, secondaryBody);
    publication.introducedNorms.push({
      kind: 'published',
      ...identity,
      type: sourceTypeFromHeading(identity.heading, identity.title),
      publicationDate,
      effectiveDate: inferEffectiveDate(secondaryNodes.map(textOf).join(' '), publicationDate),
      body: secondaryBody,
    });
  }
  if (undatedPublishedStart >= 0) {
    const tocEntry = toc[1];
    const sourceContainer = nodes[undatedPublishedStart];
    const sourceCells = sourceContainer.tagName === 'table'
      ? directRows(sourceContainer).flatMap((row) => elementChildren(row).filter((cell) => cell.tagName === 'td' || cell.tagName === 'th'))
      : [];
    const germanCell = sourceCells.find((cell) => /^ÜBEREINKOMMEN\b/iu.test(textOf(cell))) ?? sourceCells.at(-1);
    const identity = {
      heading: 'Übereinkommen',
      title: tocEntry?.title ?? 'Übereinkommen über den Schutz der Meeresumwelt des Ostseegebiets, 1992',
      shortTitle: tocEntry?.title ?? 'Übereinkommen',
      documentDate: tocEntry?.documentDate ?? publicationDate,
    };
    const treatyNodes = germanCell ? nestedFlowNodes(germanCell) : nodes.slice(undatedPublishedStart + 1);
    const treatyBodyStart = treatyNodes.findIndex((node) => /^(?:THE CONTRACTING PARTIES|DIE VERTRAGSPARTEIEN)/iu.test(textOf(node)));
    const secondaryNodes = treatyNodes.slice(treatyBodyStart >= 0 ? treatyBodyStart : 0);
    const secondaryBody = parseTokens(makeAtomicTokens(secondaryNodes, css, fileName), fileName);
    validateBody(fileName, identity.title, secondaryBody);
    publication.introducedNorms.push({
      kind: 'published',
      ...identity,
      type: 'staatsvertrag',
      publicationDate,
      effectiveDate: null,
      body: secondaryBody,
    });
  }
  if (publication.introducedNorms.length > 0 || /Änderung|Reform|Neuordnung|Einführung|Errichtung/iu.test(publication.title)) publication.type = 'aenderungsvorschrift';
  return publication;
}

export function parseConsolidatedHtml(fileName, html, identity = {}) {
  const classification = classifyHtmlSource(fileName, html);
  if (classification.kind !== 'consolidated') throw new NormHtmlParseError(fileName, `Quelle ist keine konsolidierte Einzelnorm (${classification.reason})`);
  const { nodes, css } = parsedDocument(fileName, html);
  let bodyStart = nodes.findIndex((node) => node.tagName === 'h1' && /^Präambel$/iu.test(textOf(node)));
  if (bodyStart < 0) {
    const markerCounts = new Map();
    bodyStart = nodes.findIndex((node) => {
      const marker = parseStructureMarker(normalizeHtmlText(textWithBreaks(node)));
      if (!marker) return false;
      const count = (markerCounts.get(marker.label) ?? 0) + 1;
      markerCounts.set(marker.label, count);
      return count > 1 || !/\s\d+$/u.test(textOf(node));
    });
  }
  if (bodyStart < 0) throw new NormHtmlParseError(fileName, 'Beginn der konsolidierten Norm konnte nicht bestimmt werden');
  const body = parseTokens(makeAtomicTokens(sanitizeNormNodes(nodes.slice(bodyStart)), css, fileName), fileName);
  const title = identity.title ?? fileName.replace(/\.html$/iu, '');
  validateBody(fileName, title, body);
  return { kind: 'consolidated', fileName, title, body };
}

export function summarizeParsedSource(parsed) {
  return [parsed, ...(parsed.introducedNorms ?? [])].map((norm) => {
    const flat = flattenBlocks(norm.body);
    const structures = flat.filter(({ block }) => ['article', 'paragraph', 'annex'].includes(block.type));
    const outer = structures.filter(({ insideQuote }) => !insideQuote);
    return {
      title: norm.title,
      type: norm.type ?? 'gesetz',
      documentDate: norm.documentDate,
      publicationDate: norm.publicationDate,
      effectiveDate: norm.effectiveDate,
      firstStructure: structures[0]?.block.label,
      lastStructure: structures.at(-1)?.block.label,
      structureCount: structures.length,
      outerArticles: outer.filter(({ block }) => block.type === 'article').map(({ block }) => block.label),
      outerParagraphs: outer.filter(({ block }) => block.type === 'paragraph').map(({ block }) => block.label),
      listCount: flat.filter(({ block }) => block.type === 'item' || block.type === 'subitem').length,
      tableCount: flat.filter(({ block }) => block.type === 'table').length,
    };
  });
}

export function summarizeHtmlAudit(parsed) {
  const summaries = summarizeParsedSource(parsed);
  const outer = flattenBlocks(parsed.body).filter(({ insideQuote }) => !insideQuote).map(({ block }) => block);
  return {
    issue: parsed.issue,
    documentDate: parsed.documentDate,
    publicationDate: parsed.publicationDate,
    startPage: parsed.startPage,
    outerStructure: outer.filter((block) => ['part', 'chapter', 'section', 'subsection', 'article', 'paragraph', 'annex'].includes(block.type)).map((block) => block.label ?? block.title),
    articleCount: outer.filter((block) => block.type === 'article').length,
    paragraphCount: outer.filter((block) => block.type === 'paragraph').length,
    listCount: flattenBlocks(parsed.body).filter(({ block }) => block.type === 'item' || block.type === 'subitem').length,
    tableCount: flattenBlocks(parsed.body).filter(({ block }) => block.type === 'table').length,
    norms: summaries,
  };
}
