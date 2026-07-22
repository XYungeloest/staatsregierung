import { parse } from 'parse5';

const DATE_PATTERN = /(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/iu;
const LIST_CLASS_PATTERN = /(?:^|\s)lst-kix_([a-z0-9_]+)-(\d+)(?=\s|$)/iu;
const SIGNATURE_PATTERN = /^Dresden,\s+den\b/iu;
const CONTAMINATION_PATTERN = /data:image|;base64,|@font-face|@import\s+url|<style|Inhaltsverzeichnis|Nichtamtliches Inhaltsverzeichnis|LANDTAGSPRÄSIDENT|D\s*e\s*r\s+L\s*A\s*N\s*D\s*T\s*A\s*G\s*S\s*P\s*R/iu;
const QUOTE_TRIGGER_PATTERN = /(?:(?:wird|werden)\s+(?:wie folgt|durch folgende|durch die nachstehende)\s+(?:neu\s+)?(?:gefasst|eingefügt)|(?:wird|werden)\s+[^:]*?(?:eingefügt|angefügt)|(?:wird|werden)\s+durch\s+(?:die\s+)?(?:folgende|nachstehende)\s+Fassung\s+(?:ersetzt|abgelöst)|(?:erhält|erhalten)\s+folgende\s+Bezeichnung|(?:wird|werden)\s+wie\s+folgt\s+ersetzt)\s*:\s*$/iu;
const INTRODUCTION_PATTERN = /^(?:Das\s+nachstehende\s+wird\s+(Gesetz|Verordnung):|.+?wird\s+durch\s+die\s+nachstehende\s+(.+?)\s+abgelöst:)$/iu;
const OPENING_QUOTE_PATTERN = /^(?:„|“|‚|‘|,,|")/u;
const CLOSING_QUOTE_PATTERN = /(?:“|”|’|''|")\s*$/u;

const STRUCTURE_RANK = {
  part: 1,
  chapter: 2,
  section: 3,
  subsection: 4,
  article: 5,
  paragraph: 5,
  annex: 5,
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
      prefix: quotedCssText(before),
      suffix: quotedCssText(after).trimEnd(),
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
  if (/Verordnung/iu.test(heading)) return 'verordnung';
  if (/Verwaltungsvorschrift/iu.test(heading)) return 'verwaltungsvorschrift';
  if (/Förderrichtlinie/iu.test(heading)) return 'foerderrichtlinie';
  if (/Allgemeinverfügung/iu.test(heading)) return 'allgemeinverfuegung';
  if (/Bekanntmachung/iu.test(heading)) return 'bekanntmachung';
  if (/Staatsvertrag|Abkommen|Übereinkommen|Vertrag/iu.test(heading)) return 'staatsvertrag';
  if (/Änderung|Neuordnung|Einführung|Errichtung|Reform/iu.test(`${heading} ${title}`)) return 'aenderungsvorschrift';
  return 'gesetz';
}

export function parseStructureMarker(value) {
  const original = normalizeHtmlText(value);
  const text = original.replace(/^[„“”'`,.]+/u, '').trim();
  let match = text.match(/^((?:Teil|Kapitel|Abschnitt|Unterabschnitt)\s+(?:\d+[a-z]?|[IVXLCDM]+))\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) {
    const prefix = match[1].split(/\s+/u)[0].toLocaleLowerCase('de');
    const type = { teil: 'part', kapitel: 'chapter', abschnitt: 'section', unterabschnitt: 'subsection' }[prefix];
    return { type, label: match[1], title: match[2] || undefined };
  }
  match = text.match(/^([IVXLCDM]+\.\s*Abschnitt)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'section', label: match[1], title: match[2] || undefined };
  match = text.match(/^(Präambel)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'section', label: 'Präambel', title: match[2] || undefined };
  match = text.match(/^(Artikel\s+\d+[a-z]?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'article', label: match[1], title: match[2] || undefined };
  match = text.match(/^(§{1,2}\s*\d+[a-z]?(?:\s*(?:,|und)\s*\d+[a-z]?)?(?:\s+bis\s+\d+[a-z]?)?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'paragraph', label: match[1], title: match[2] || undefined };
  match = text.match(/^((?:Anlage(?:\s+\d+[a-z]?)?|Anhang)(?:\s*\([^)]*\))?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'annex', label: match[1], title: match[2] || undefined };
  return null;
}

function directRows(table) {
  const sections = elementChildren(table).filter((child) => ['thead', 'tbody', 'tfoot'].includes(child.tagName));
  return sections.length > 0
    ? sections.flatMap((section) => elementChildren(section, 'tr'))
    : elementChildren(table, 'tr');
}

function parsePositiveSpan(value, fallback = 1) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function tableBlock(node, css, fileName) {
  const rows = directRows(node);
  const firstContentRow = rows.findIndex((row) => elementChildren(row).some((cell) => textOf(cell)));
  const children = rows.map((row, rowIndex) => {
    const cells = elementChildren(row).filter((cell) => cell.tagName === 'td' || cell.tagName === 'th');
    return {
      type: 'tableRow',
      children: cells.map((cell) => {
        const paragraphs = descendants(cell, (entry) => entry.tagName === 'p').map(textOf).filter(Boolean);
        const cellText = paragraphs.length > 0 ? paragraphs.join('\n') : textOf(cell);
        const header = cell.tagName === 'th' || (rowIndex === firstContentRow && cells.length > 0 && cells.every((entry) => isBold(entry, css)));
        const cellAttrs = attrs(cell);
        const rowspan = parsePositiveSpan(cellAttrs.rowspan);
        const colspan = parsePositiveSpan(cellAttrs.colspan);
        return {
          type: header ? 'tableHeaderCell' : 'tableCell',
          text: cellText,
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

function makeAtomicTokens(nodes, css, fileName) {
  const counters = new Map();
  const tokens = [];
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
      if (!listMatch) throw new NormHtmlParseError(fileName, `Liste ohne auswertbare Google-Docs-Listenkennung: „${text.slice(0, 80)}“`);
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
          label: `${style.prefix}${visible}${style.suffix}`.trim(),
          text: textOf(item),
          startsList: hasStartClass,
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
    const marker = parseStructureMarker(rawText);
    if (marker) {
      tokens.push({
        kind: 'structure', marker, text: rawText, rawText,
        tagName: node.tagName, bold: isBold(node, css), centered: isCentered(node, css),
        opensQuote: OPENING_QUOTE_PATTERN.test(rawText),
      });
    } else {
      tokens.push({ kind: 'paragraph', text, rawText, tagName: node.tagName, bold: isBold(node, css), centered: isCentered(node, css) });
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
    if (token.kind !== 'listItem' || !QUOTE_TRIGGER_PATTERN.test(token.text)) continue;
    let end = index + 1;
    let sawContent = false;
    while (end < tokens.length) {
      const candidate = tokens[end];
      if (candidate.kind === 'listItem' && candidate.listId === token.listId && candidate.level <= token.level) break;
      if (sawContent && isOuterArticleToken(candidate) && CLOSING_QUOTE_PATTERN.test(tokens[end - 1]?.text ?? tokens[end - 1]?.rawText ?? '')) break;
      sawContent = true;
      end += 1;
    }
    if (end > index + 1) {
      grouped.push({ kind: 'quotedGroup', tokens: tokens.slice(index + 1, end), attachToPrevious: true, introduction: false });
      index = end - 1;
    }
  }
  return grouped;
}

function currentChildren(stack) {
  return stack.at(-1).children;
}

function parseTokens(tokens, fileName, { inQuote = false } = {}) {
  const root = [];
  const stack = [{ rank: 0, children: root }];
  const listParents = new Map();
  let lastBlock = null;

  const append = (block) => {
    currentChildren(stack).push(block);
    lastBlock = block;
    return block;
  };

  for (const token of groupAmendmentQuotes(groupIntroducedQuotes(tokens))) {
    if (token.kind === 'structure') {
      const block = { type: token.marker.type, label: token.marker.label, ...(token.marker.title ? { title: token.marker.title } : {}), children: [] };
      const rank = STRUCTURE_RANK[block.type];
      while (stack.length > 1 && stack.at(-1).rank >= rank) stack.pop();
      currentChildren(stack).push(block);
      stack.push({ rank, children: block.children });
      lastBlock = block;
      listParents.clear();
      continue;
    }
    if (token.kind === 'paragraph') {
      const subparagraph = token.text.match(/^\((\d+[a-z]?)\)\s*(.*)$/iu);
      if (inQuote && !subparagraph && ['article', 'paragraph'].includes(lastBlock?.type) && !lastBlock.title) {
        lastBlock.title = token.text.replace(/^[„“”'`,.]+/u, '').trim();
        continue;
      }
      append(subparagraph
        ? { type: 'subparagraph', label: `(${subparagraph[1]})`, text: subparagraph[2], children: [] }
        : { type: 'paragraphText', text: token.text });
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
      let destination = currentChildren(stack);
      if (token.level > 0) {
        let parent;
        for (let parentLevel = token.level - 1; parentLevel >= 0; parentLevel -= 1) {
          parent = parents.get(parentLevel);
          if (parent) break;
        }
        if (!parent) throw new NormHtmlParseError(fileName, `Listenebene ${token.level} der Liste ${token.listId} besitzt keinen übergeordneten Punkt: „${token.text.slice(0, 100)}“`);
        parent.children ??= [];
        destination = parent.children;
      }
      const type = /^\(\d+[a-z]?\)$/iu.test(token.label) ? 'subparagraph' : 'item';
      const block = {
        type,
        label: token.label,
        text: token.text,
        level: token.level,
        listId: token.listId,
        numberingStyle: token.numberingStyle,
        children: [],
      };
      destination.push(block);
      parents.set(token.level, block);
      for (const level of [...parents.keys()]) if (level > token.level) parents.delete(level);
      lastBlock = block;
      continue;
    }
    if (token.kind === 'quotedGroup') {
      const children = parseTokens(token.tokens, fileName, { inQuote: true });
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

function flattenBlocks(blocks, output = [], insideQuote = false) {
  for (const block of blocks ?? []) {
    output.push({ block, insideQuote });
    flattenBlocks(block.children, output, insideQuote || block.type === 'quotedProvision');
  }
  return output;
}

function validateBody(fileName, title, body) {
  const flat = flattenBlocks(body);
  const main = flat.filter(({ block, insideQuote }) => !insideQuote && ['article', 'paragraph', 'annex'].includes(block.type));
  if (main.length === 0) throw new NormHtmlParseError(fileName, `„${title}“ enthält keine äußeren Artikel, Paragraphen oder Anlagen`);
  const bodyText = flat.map(({ block }) => `${block.label ?? ''} ${block.title ?? ''} ${block.text ?? ''}`).join(' ');
  if (CONTAMINATION_PATTERN.test(bodyText)) throw new NormHtmlParseError(fileName, `Kopf-, Fuß-, CSS-, Bild- oder Signaturdaten sind in den Normkörper von „${title}“ geraten`);
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
    if (/Gesetz- und Verordnungsblatt/iu.test(text) && /Nr\.\s*\d+/u.test(text)) continue;
    result.push(node);
  }
  return result;
}

function headingCandidate(node) {
  const lines = linesOf(node);
  if (lines.length === 0 || !parseGermanDate(lines.join(' '))) return false;
  return /^(?:(?:Erstes|Zweites|Drittes|Viertes|Fünftes|Sechstes|Siebtes|Achtes|Neuntes|Zehntes)\s+)?(?:Gesetz|Verordnung)\b/iu.test(lines[0]);
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
  const lead = documentText.slice(0, 5000);
  const publication = /Gesetz- und Verordnungsblatt/iu.test(lead) && /Ausgegeben\s+zu/iu.test(lead) && /Inhaltsverzeichnis/iu.test(lead);
  const editorial = /\b(?:Pressemitteilung|Begründung|Vorblatt|Erläuterung|Begleittext)\b/iu.test(lead) || /^PM[-_. ]/iu.test(fileName);
  const structureCount = (documentText.match(/(?:^|\s)(?:Artikel\s+\d+[a-z]?|§{1,2}\s*\d+[a-z]?)/giu) ?? []).length;
  const consolidated = /Staatsverfassung/iu.test(fileName) || /Nichtamtliches Inhaltsverzeichnis/iu.test(lead) || structureCount >= 3;
  if (publication && editorial) return { kind: 'ambiguous', reason: 'Verkündungsblatt- und Begleittextmerkmale überschneiden sich' };
  if (publication) return { kind: 'publication', reason: 'Verkündungsblatt mit internem Ausgabekopf und Inhaltsverzeichnis' };
  if (editorial) return { kind: 'editorial', reason: 'redaktioneller Begleittext' };
  if (consolidated) return { kind: 'consolidated', reason: 'konsolidierte oder eigenständige Einzelnorm' };
  if (/<html\b/iu.test(html)) return { kind: 'unsupported', reason: 'HTML ohne eindeutige Norm- oder Verkündungsblattstruktur' };
  return { kind: 'ambiguous', reason: 'keine eindeutige HTML-Dokumentstruktur' };
}

export function parsePublicationHtml(fileName, html) {
  const classification = classifyHtmlSource(fileName, html);
  if (classification.kind !== 'publication') throw new NormHtmlParseError(fileName, `Quelle ist kein Verkündungsblatt (${classification.reason})`);
  const { nodes, css, documentText } = parsedDocument(fileName, html);
  const headerText = nodes.slice(0, 10).map(textOf).join(' ');
  const issueMatch = headerText.match(/\bNr\.\s*(\d+)\b/u);
  const publicationDate = parseGermanDate(headerText.match(/Ausgegeben\s+zu[\s\S]{0,120}/iu)?.[0] ?? headerText);
  if (!issueMatch || !publicationDate) throw new NormHtmlParseError(fileName, 'Ausgabenummer oder Ausgabedatum konnte nicht aus dem Inhalt bestimmt werden');
  const tocIndex = nodes.findIndex((node) => /^Inhaltsverzeichnis$/iu.test(textOf(node)));
  if (tocIndex < 0) throw new NormHtmlParseError(fileName, 'Inhaltsverzeichnis fehlt');
  const headingIndex = nodes.findIndex((node, index) => index > tocIndex && headingCandidate(node));
  if (headingIndex < 0) throw new NormHtmlParseError(fileName, 'keine unterstützte Normüberschrift nach dem Inhaltsverzeichnis erkannt');
  const headingLines = linesOf(nodes[headingIndex]);
  const documentDate = parseGermanDate(headingLines.join(' '));
  const titleLines = headingLines.filter((line) => !/^vom\b/iu.test(line) && !DATE_PATTERN.test(line));
  const dateLine = headingLines.findIndex((line) => /\bvom\b/iu.test(line));
  const identityLines = dateLine >= 0 ? headingLines.slice(0, dateLine) : titleLines;
  const heading = identityLines[0];
  const identity = parseIdentity(heading, identityLines.join(' '));
  const tocText = nodes.slice(tocIndex, headingIndex).map(textOf).join(' ');
  const startPage = tocText.match(/\bSeite\s*(\d+)\b/iu)?.[1];
  const bodyNodes = sanitizeNormNodes(nodes.slice(headingIndex + 1));
  const rawTokens = makeAtomicTokens(bodyNodes, css, fileName);
  const body = parseTokens(rawTokens, fileName);
  validateBody(fileName, identity.title, body);
  const effectiveDate = inferEffectiveDate(documentText, publicationDate);
  const publication = {
    kind: 'publication', fileName, issue: issueMatch[1], publication: 'OGVBl.', publicationDate,
    documentDate, effectiveDate, heading, ...identity,
    type: sourceTypeFromHeading(heading, identity.title),
    ...(startPage ? { startPage } : {}), body,
  };
  publication.introducedNorms = extractIntroducedNorms(rawTokens, publication, fileName);
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
