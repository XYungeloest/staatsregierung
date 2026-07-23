import { parse } from 'parse5';

import { parseGermanDate, parseStructureMarker } from './norm-html-parser.mjs';

const DATE_DOTTED = /(\d{1,2})\.(\d{1,2})\.(\d{4})/u;
const DATE_DOTTED_GLOBAL = /(\d{1,2})\.(\d{1,2})\.(\d{4})/gu;
const FOOTNOTE_LINK = /^#FNID_/u;
const SIGNATURE_START = /^(?:Dresden|Leipzig|Chemnitz),\s+den\s+/iu;
const STRUCTURE_RANK = {
  part: 1,
  chapter: 2,
  section: 3,
  subsection: 4,
  article: 5,
  paragraph: 5,
  annex: 2,
};

export class RevosaxParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RevosaxParseError';
  }
}

function attributes(node) {
  return Object.fromEntries((node?.attrs ?? []).map(({ name, value }) => [name, value]));
}

function hasClass(node, className) {
  return (attributes(node).class ?? '').split(/\s+/u).includes(className);
}

function elementChildren(node, tagName) {
  return (node?.childNodes ?? []).filter((child) =>
    child.tagName && (!tagName || child.tagName === tagName)
  );
}

function descendants(node, predicate, output = []) {
  for (const child of node?.childNodes ?? []) {
    if (child.tagName && predicate(child)) output.push(child);
    descendants(child, predicate, output);
  }
  return output;
}

function findElement(node, predicate) {
  if (node?.tagName && predicate(node)) return node;
  for (const child of node?.childNodes ?? []) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\r\n?/gu, '\n')
    .replace(/[\u00a0\u202f]/gu, ' ')
    .replace(/[\u200b\u200c\u200d\u2060\ufeff]/gu, '')
    .replace(/[ \t\f\v]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function superscript(value) {
  const characters = {
    0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴',
    5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹',
  };
  return String(value).replace(/\d/gu, (digit) => characters[digit] ?? digit);
}

function nodeText(node, { breaks = false, skipFootnoteLinks = true } = {}) {
  if (!node) return '';
  if (node.nodeName === '#text') return node.value ?? '';
  if (node.tagName === 'br') return breaks ? '\n' : ' ';
  const nodeAttributes = attributes(node);
  if (skipFootnoteLinks && node.tagName === 'a' && FOOTNOTE_LINK.test(nodeAttributes.href ?? '')) return '';
  if (node.tagName === 'sup' && hasClass(node, 'satzzahl')) {
    return superscript((node.childNodes ?? []).map((child) => nodeText(child, { breaks, skipFootnoteLinks })).join(''));
  }
  return (node.childNodes ?? [])
    .map((child) => {
      const value = nodeText(child, { breaks, skipFootnoteLinks });
      const isBlock = ['p', 'div', 'section', 'header', 'footer', 'dt', 'dd', 'tr'].includes(child.tagName);
      return isBlock ? `${value}${breaks ? '\n' : ' '}` : value;
    })
    .join('');
}

function textOf(node, options) {
  return normalizeText(nodeText(node, options)).replace(/\n+/gu, options?.breaks ? '\n' : ' ');
}

function parseFlexibleDate(value) {
  const dotted = String(value ?? '').match(DATE_DOTTED);
  if (dotted) return `${dotted[3]}-${dotted[2].padStart(2, '0')}-${dotted[1].padStart(2, '0')}`;
  return parseGermanDate(value);
}

function directHeading(section) {
  return elementChildren(section).find((child) => /^h[1-6]$/u.test(child.tagName));
}

function markerFromSection(section) {
  const source = attributes(section).title ?? textOf(directHeading(section), { breaks: true });
  const parsed = parseStructureMarker(source);
  if (parsed) return parsed;
  const match = normalizeText(source)
    .replace(/\n+/gu, ' ')
    .match(/^((?:Erster|Zweiter|Dritter|Vierter|Fünfter|Sechster|Siebter|Achter|Neunter|Zehnter|Elfter|Zwölfter)\s+(?:Teil|Kapitel|Abschnitt|Unterabschnitt))\s*(?:[–—:-])?\s*(.*)$/iu);
  if (!match) return null;
  const suffix = match[1].split(/\s+/u).at(-1).toLocaleLowerCase('de');
  const type = { teil: 'part', kapitel: 'chapter', abschnitt: 'section', unterabschnitt: 'subsection' }[suffix];
  return { type, label: match[1], ...(match[2] ? { title: match[2] } : {}) };
}

function parseTable(table) {
  const rows = descendants(table, (node) => node.tagName === 'tr').map((row) => ({
    type: 'tableRow',
    children: elementChildren(row)
      .filter((cell) => cell.tagName === 'td' || cell.tagName === 'th')
      .map((cell) => {
        const cellAttributes = attributes(cell);
        const header = cell.tagName === 'th';
        return {
          type: header ? 'tableHeaderCell' : 'tableCell',
          text: textOf(cell, { breaks: true }),
          ...(header ? { scope: cellAttributes.scope === 'row' ? 'row' : 'col' } : {}),
          ...(Number(cellAttributes.rowspan) > 1 ? { rowspan: Number(cellAttributes.rowspan) } : {}),
          ...(Number(cellAttributes.colspan) > 1 ? { colspan: Number(cellAttributes.colspan) } : {}),
        };
      }),
  }));
  const width = rows.reduce((maximum, row) =>
    Math.max(maximum, row.children.reduce((sum, cell) => sum + (cell.colspan ?? 1), 0)), 0);
  for (const [index, row] of rows.entries()) {
    const rowWidth = row.children.reduce((sum, cell) => sum + (cell.colspan ?? 1), 0);
    if (rowWidth !== width) {
      throw new RevosaxParseError(`Tabelle verliert in Zeile ${index + 1} Spalten (${rowWidth} statt ${width})`);
    }
  }
  return { type: 'table', columns: width, children: rows };
}

function parseDefinitionList(list) {
  const result = [];
  const children = elementChildren(list).filter((node) => node.tagName === 'dt' || node.tagName === 'dd');
  let pendingLabel = null;
  let pendingLevel = 0;
  let lastTopLevel = null;

  for (const node of children) {
    const text = textOf(node, { breaks: true });
    if (node.tagName === 'dt') {
      pendingLabel = text;
      pendingLevel = 0;
      continue;
    }
    if (/^td_2$/u.test(attributes(node).class ?? '') || hasClass(node, 'td_2')) {
      pendingLabel = text;
      pendingLevel = 1;
      continue;
    }
    if (!hasClass(node, 'last') && !text) continue;
    if (!pendingLabel) {
      if (text) result.push({ type: 'paragraphText', text });
      continue;
    }
    const item = {
      type: 'item',
      label: pendingLabel,
      text,
      level: pendingLevel,
      numberingStyle: /^[a-z]{1,2}\)$/iu.test(pendingLabel) ? 'lower-latin' : 'decimal',
      children: [],
    };
    if (pendingLevel > 0 && lastTopLevel) lastTopLevel.children.push(item);
    else {
      result.push(item);
      lastTopLevel = item;
    }
    pendingLabel = null;
    pendingLevel = 0;
  }
  return result;
}

function paragraphBlock(node) {
  const text = textOf(node, { breaks: true })
    .replace(/\nDas vorstehende Gesetz wird hiermit ausgefertigt und ist zu verkünden\.?$/iu, '')
    .trim();
  if (!text) return null;
  const subparagraph = text.match(/^\((\d+[a-z]?)\)\s*(.*)$/isu);
  if (subparagraph) {
    return {
      type: 'subparagraph',
      label: `(${subparagraph[1]})`,
      text: subparagraph[2].trim(),
      children: [],
    };
  }
  return { type: 'paragraphText', text };
}

function sectionContent(section) {
  const blocks = [];
  let signature = false;
  for (const child of elementChildren(section)) {
    if (/^h[1-6]$/u.test(child.tagName) || child.tagName === 'section') continue;
    if (child.tagName === 'p') {
      const text = textOf(child, { breaks: true });
      if (SIGNATURE_START.test(text)) {
        signature = true;
        continue;
      }
      if (signature) continue;
      const block = paragraphBlock(child);
      if (block) blocks.push(block);
      continue;
    }
    if (child.tagName === 'dl') {
      blocks.push(...parseDefinitionList(child));
      continue;
    }
    if (child.tagName === 'table') {
      blocks.push(parseTable(child));
      continue;
    }
    for (const paragraph of descendants(child, (node) => node.tagName === 'p')) {
      const block = paragraphBlock(paragraph);
      if (block) blocks.push(block);
    }
  }
  return blocks;
}

function parseSections(container) {
  const root = [];
  const stack = [{ rank: 0, children: root }];
  const sections = descendants(container, (node) => node.tagName === 'section');
  for (const section of sections) {
    const marker = markerFromSection(section);
    if (!marker) {
      throw new RevosaxParseError(`REVOSax-Abschnitt ohne erkennbare Gliederung: „${attributes(section).title ?? textOf(directHeading(section)).slice(0, 120)}“`);
    }
    const block = {
      type: marker.type,
      label: marker.label,
      ...(marker.title ? { title: marker.title } : {}),
      children: sectionContent(section),
    };
    const rank = STRUCTURE_RANK[block.type];
    while (stack.length > 1 && stack.at(-1).rank >= rank) stack.pop();
    stack.at(-1).children.push(block);
    stack.push({ rank, children: block.children });
  }
  return root;
}

function parseSourceNotes(article) {
  const footer = elementChildren(article, 'footer')[0];
  if (!footer) return [];
  const list = findElement(footer, (node) => node.tagName === 'dl');
  if (!list) return [];
  const entries = elementChildren(list).filter((node) => node.tagName === 'dt' || node.tagName === 'dd');
  const notes = [];
  let label = null;
  for (const node of entries) {
    if (node.tagName === 'dt') label = textOf(node);
    else if (label) {
      notes.push({ label, text: textOf(node, { skipFootnoteLinks: false }) });
      label = null;
    }
  }
  return notes;
}

export function parseRevosaxSnapshot(html, { url = '' } = {}) {
  let document;
  try {
    document = parse(html);
  } catch (error) {
    throw new RevosaxParseError(`HTML5-Parserfehler: ${error.message}`);
  }
  const content = findElement(document, (node) => attributes(node).id === 'content');
  const lawShow = content && findElement(content, (node) => hasClass(node, 'law_show'));
  const article = lawShow && findElement(lawShow, (node) => node.tagName === 'article' && attributes(node).id === 'lesetext');
  if (!lawShow || !article) throw new RevosaxParseError('amtlicher REVOSax-Lesetext #lesetext fehlt');

  const titleNode = findElement(lawShow, (node) => node.tagName === 'h1');
  const citationNode = elementChildren(lawShow, 'p').find((node) => /^Vollzitat:/u.test(textOf(node)));
  const sourceTitle = textOf(titleNode);
  const fullCitation = textOf(citationNode).replace(/^Vollzitat:\s*/u, '');
  if (!sourceTitle || !fullCitation) throw new RevosaxParseError('Titel oder Vollzitat fehlt');

  const articleHeader = elementChildren(article, 'header')[0];
  const identityHeading = articleHeader && findElement(articleHeader, (node) => node.tagName === 'h3');
  const identityText = textOf(identityHeading, { breaks: true });
  const parenthetical = identityText.match(/\(([^()]+)\)\s*$/u);
  const parentheticalText = parenthetical?.[1]?.trim();
  const abbr = parentheticalText?.split(/\s+[–—-]\s+/u).at(-1)?.trim();
  const dateNode = articleHeader && descendants(articleHeader, (node) => node.tagName === 'p')
    .find((node) => parseFlexibleDate(textOf(node)));
  const documentDate = parseFlexibleDate(textOf(dateNode));

  const stateHeading = elementChildren(lawShow, 'h2')[0];
  const stateText = textOf(stateHeading);
  const validityDates = [...stateText.matchAll(DATE_DOTTED_GLOBAL)].map((match) =>
    parseFlexibleDate(match[0]),
  );
  const quickbar = findElement(document, (node) => attributes(node).id === 'quickbar');
  const quickbarText = textOf(quickbar);
  const validFrom = parseGermanDate(quickbarText.match(/Fassung gültig ab:\s*.{0,80}?\d{4}/iu)?.[0])
    ?? validityDates[0]
    ?? null;
  const validTo = parseGermanDate(quickbarText.match(/Fassung gültig bis:\s*.{0,80}?\d{4}/iu)?.[0])
    ?? validityDates[1]
    ?? null;

  const entryFormula = articleHeader
    ? descendants(articleHeader, (node) => node.tagName === 'p' && !hasClass(node, 'centre'))
      .map((node) => paragraphBlock(node))
      .filter(Boolean)
    : [];
  const sectionsContainer = findElement(article, (node) => hasClass(node, 'sections'));
  if (!sectionsContainer) throw new RevosaxParseError('REVOSax-Gliederungscontainer .sections fehlt');
  const body = [...entryFormula, ...parseSections(sectionsContainer)];
  const provisionLabels = body
    .flatMap(function flatten(block) {
      return [block, ...(block.children ?? []).flatMap(flatten)];
    })
    .filter((block) => block.type === 'paragraph' || block.type === 'article')
    .map((block) => block.label);
  if (provisionLabels.length === 0) throw new RevosaxParseError('keine Paragraphen oder Artikel erkannt');

  return {
    sourceTitle,
    shortTitle: sourceTitle,
    ...(abbr ? { abbr } : {}),
    fullCitation,
    documentDate,
    sourceValidFrom: validFrom,
    sourceValidTo: validTo,
    sourceUrl: url,
    body,
    sourceNotes: parseSourceNotes(article),
  };
}
