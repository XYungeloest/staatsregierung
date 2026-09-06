import { parse } from 'parse5';

import { parseGermanDate, parseStructureMarker } from './norm-html-parser.mjs';

const DATE_DOTTED = /(\d{1,2})\.(\d{1,2})\.(\d{4})/u;
const DATE_DOTTED_GLOBAL = /(\d{1,2})\.(\d{1,2})\.(\d{4})/gu;
const FOOTNOTE_LINK = /^#FNID_/u;
const SIGNATURE_START = /^(?:Dresden|Leipzig|Chemnitz),\s+(?:den\s+|\d{1,2}\.\s)/iu;
const NON_NORM_SECTION = /^(?:Bekanntmachung|Gesetz|Verordnung|Inhaltsübersicht|Inhaltsverzeichnis)$/iu;
// Diese Wrapper enthalten in Zustimmungsgesetzen gelegentlich den gesamten Text; ihr Inhalt wird
// nur dann übernommen, wenn das Dokument sonst keinen Normtext hätte.
const TEXT_BEARING_WRAPPER = /^(?:Gesetz|Verordnung|Bekanntmachung)$/iu;
// Generische Dokument-Wrapper, die REVOSax um den eigentlichen Text legt (etwa
// „Vorschrift“ oder „Zustimmungsgesetz“). Sie sind keine Gliederungseinheit;
// ihr unmittelbarer Inhalt wird auf der aktuellen Ebene übernommen.
const HOISTED_WRAPPER_SECTION = /^(?:Vorschrift|Verwaltungsvorschrift|Gemeinsame Verwaltungsvorschrift|Zustimmungsgesetz|Richtlinie|Förderrichtlinie|Verwaltungsvereinbarung)$/iu;
// Buchstabengliederung von Verwaltungsvorschriften („A. Geltungsbereich“, „B Inkrafttreten“).
const LETTER_OUTLINE = /^([A-Z])\.?\s+(\p{Lu}.*)$/u;
const LETTER_OUTLINE_RANK = 2.5;
// Römische Gliederung („I.“, „II.“) liegt zwischen Buchstaben- und Ziffernebene.
const ROMAN_OUTLINE_RANK = 2.75;
// Überschriften ohne Gliederungskennzeichen gelten als eigenständige Abschnitte auf Dokumentebene.
const GENERIC_SECTION_RANK = 2.5;
const SATZZAHL_MARKER = '\uE000';
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
  const source = String(value ?? '');
  let withoutSentenceNumbers = '';
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== SATZZAHL_MARKER) {
      withoutSentenceNumbers += source[index];
      continue;
    }

    const before = withoutSentenceNumbers.at(-1);
    const after = source.slice(index + 1).match(/[^\uE000]/u)?.[0];
    if (before && after && !/\s/u.test(before) && !/\s/u.test(after)) {
      const beforeWord = /[\p{L}\p{N})\]}]/u.test(before);
      const afterWord = /[\p{L}\p{N}([{]/u.test(after);
      if (beforeWord && afterWord) withoutSentenceNumbers += ' ';
      else if (/[.!?;:)]/u.test(before) && /[\p{L}\p{N}]/u.test(after)) withoutSentenceNumbers += ' ';
    }
  }

  return withoutSentenceNumbers
    .replace(/\r\n?/gu, '\n')
    .replace(/[\u00a0\u202f]/gu, ' ')
    .replace(/[\u200b\u200c\u200d\u2060\ufeff]/gu, '')
    .replace(/[ \t\f\v]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function nodeText(node, { breaks = false, skipFootnoteLinks = true } = {}) {
  if (!node) return '';
  if (node.nodeName === '#text') return node.value ?? '';
  if (node.tagName === 'br') return breaks ? '\n' : ' ';
  const nodeAttributes = attributes(node);
  if (skipFootnoteLinks && node.tagName === 'a' && FOOTNOTE_LINK.test(nodeAttributes.href ?? '')) return '';
  if (node.tagName === 'sup' && hasClass(node, 'satzzahl')) {
    return SATZZAHL_MARKER;
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
  if (parsed) {
    return /^[IVXLCDM]+\.$/u.test(parsed.label ?? '') && parsed.type === 'section'
      ? { ...parsed, rank: ROMAN_OUTLINE_RANK }
      : parsed;
  }
  const numeric = normalizeText(source).replace(/\n+/gu, ' ').match(/^(\d+(?:\.\d+)*\.?)(?:\s+(.+))?$/u);
  if (numeric && (numeric[2] || /\.$/u.test(numeric[1]))) {
    return { type: 'section', label: numeric[1], ...(numeric[2] ? { title: numeric[2] } : {}) };
  }
  const letterPart = normalizeText(source).replace(/\n+/gu, ' ').match(/^(Teil\s+[A-Z])(?:\s*[–—:-]?\s*(.*))?$/u);
  if (letterPart) return { type: 'part', label: letterPart[1], ...(letterPart[2] ? { title: letterPart[2] } : {}) };
  const letter = normalizeText(source).replace(/\n+/gu, ' ').match(LETTER_OUTLINE);
  if (letter) return { type: 'section', label: `${letter[1]}.`, title: letter[2], rank: LETTER_OUTLINE_RANK };
  const match = normalizeText(source)
    .replace(/\n+/gu, ' ')
    .match(/^((?:Erster|Zweiter|Dritter|Vierter|Fünfter|Sechster|Siebter|Siebenter|Achter|Neunter|Zehnter|Elfter|Zwölfter)\s+(?:Teil|Kapitel|Abschnitt|Unterabschnitt))\s*(?:[–—:-])?\s*(.*)$/iu);
  if (/^Muster$/iu.test(normalizeText(source))) {
    return { type: 'annex', label: 'Muster' };
  }
  if (!match) return null;
  const suffix = match[1].split(/\s+/u).at(-1).toLocaleLowerCase('de');
  const type = { teil: 'part', kapitel: 'chapter', abschnitt: 'section', unterabschnitt: 'subsection' }[suffix];
  return { type, label: match[1], ...(match[2] ? { title: match[2] } : {}) };
}

function tableRows(table) {
  const rows = [];
  const visit = (node) => {
    for (const child of node?.childNodes ?? []) {
      if (child.tagName === 'table' && child !== table) continue;
      if (child.tagName === 'tr') rows.push(child);
      else visit(child);
    }
  };
  visit(table);
  return rows.filter((row, index) => {
    if (index === 0) return true;
    const previous = rows[index - 1];
    const comparable = (candidate) => elementChildren(candidate)
      .filter((cell) => cell.tagName === 'td' || cell.tagName === 'th')
      .map((cell) => textOf(cell, { breaks: true }).replace(/\s+/gu, ''))
      .join('|');
    const spansColumns = elementChildren(row).some((cell) => Number(attributes(cell).rowspan) > 1 || Number(attributes(cell).colspan) > 1);
    return !(spansColumns && comparable(row) === comparable(previous));
  });
}

function parseTable(table) {
  const rows = tableRows(table).map((row) => ({
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
  const occupied = [];
  let width = 0;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    occupied[rowIndex] ??= [];
    let column = 0;
    for (const cell of rows[rowIndex].children) {
      while (occupied[rowIndex][column]) column += 1;
      const rowspan = cell.rowspan ?? 1;
      const colspan = cell.colspan ?? 1;
      for (let rowOffset = 0; rowOffset < rowspan; rowOffset += 1) {
        occupied[rowIndex + rowOffset] ??= [];
        for (let columnOffset = 0; columnOffset < colspan; columnOffset += 1) {
          if (occupied[rowIndex + rowOffset][column + columnOffset]) {
            throw new RevosaxParseError(`Tabelle enthält überlappende Zellen in Zeile ${rowIndex + 1}`);
          }
          occupied[rowIndex + rowOffset][column + columnOffset] = true;
        }
      }
      column += colspan;
    }
    width = Math.max(width, occupied[rowIndex].length);
  }
  for (let rowIndex = 0; rowIndex < occupied.length; rowIndex += 1) {
    const rowWidth = occupied[rowIndex].filter(Boolean).length;
    if (rowWidth !== width) {
      const hasInternalGap = occupied[rowIndex].slice(0, occupied[rowIndex].length).some((value) => !value);
      if (hasInternalGap || rowWidth > width || !rows[rowIndex]) {
        throw new RevosaxParseError(`Tabelle verliert in Zeile ${rowIndex + 1} Spalten (${rowWidth} statt ${width})`);
      }
      const missingColumns = width - rowWidth;
      rows[rowIndex].children.push({
        type: 'tableCell',
        text: '',
        ...(missingColumns > 1 ? { colspan: missingColumns } : {}),
      });
    }
  }
  return { type: 'table', columns: width, children: rows };
}

function definitionLevel(node) {
  const classes = String(attributes(node).class ?? '').split(/\s+/u);
  for (const className of classes) {
    const match = className.match(/^td_(\d+)$/u);
    if (match) return Math.max(0, Number.parseInt(match[1], 10) - 1);
  }
  return node.tagName === 'dt' ? 0 : null;
}

function definitionNumberingStyle(label) {
  if (/^\d+(?:\.\d+)*\.?$/u.test(label) || /^\(\d+\)$/u.test(label)) return 'decimal';
  if (/^[a-z]+\)$/u.test(label) || /^\([a-z]+\)$/u.test(label)) return 'lower-latin';
  if (/^[A-Z]+\)$/u.test(label) || /^\([A-Z]+\)$/u.test(label)) return 'upper-latin';
  if (/^(?:[ivxlcdm]+\.?|\([ivxlcdm]+\))$/u.test(label)) return 'lower-roman';
  if (/^(?:[IVXLCDM]+\.?|\([IVXLCDM]+\))$/u.test(label)) return 'upper-roman';
  return 'decimal';
}

function parseDefinitionList(list) {
  const result = [];
  const children = elementChildren(list).filter((node) => node.tagName === 'dt' || node.tagName === 'dd');
  const anchors = [];
  let pendingMarkers = [];
  let rowMaxLevel = -1;

  const appendItem = (marker, text) => {
    const item = {
      type: 'item',
      label: marker.label,
      text,
      level: marker.level,
      numberingStyle: definitionNumberingStyle(marker.label),
      children: [],
    };
    let parent = null;
    for (let level = marker.level - 1; level >= 0; level -= 1) {
      if (anchors[level]) {
        parent = anchors[level];
        break;
      }
    }
    if (parent) parent.children.push(item);
    else result.push(item);
    anchors[marker.level] = item;
    anchors.length = marker.level + 1;
    return item;
  };

  const finishRow = (text) => {
    if (pendingMarkers.length > 0) {
      for (const [index, marker] of pendingMarkers.entries()) {
        appendItem(marker, index === pendingMarkers.length - 1 ? text : '');
      }
    } else if (text) {
      const continuationParent = rowMaxLevel >= 0 ? anchors[rowMaxLevel] : null;
      if (continuationParent) continuationParent.children.push({ type: 'paragraphText', text });
      else result.push({ type: 'paragraphText', text });
    }
    pendingMarkers = [];
    rowMaxLevel = -1;
  };

  for (const node of children) {
    const text = textOf(node, { breaks: true });
    if (hasClass(node, 'last')) {
      finishRow(text);
      continue;
    }
    const level = definitionLevel(node);
    if (level === null) {
      if (text) finishRow(text);
      continue;
    }
    rowMaxLevel = Math.max(rowMaxLevel, level);
    // REVOSax setzt leere td_N-Zellen ein, um die sichtbare Ebene einer Zeile
    // zu markieren. Sie erhalten den bestehenden Elternanker, sind aber selbst
    // weder Gliederungspunkt noch Inhalt.
    if (text) pendingMarkers.push({ label: text, level });
  }
  if (pendingMarkers.length > 0) finishRow('');
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

function parseHtmlList(list, level = 0) {
  const ordered = list.tagName === 'ol';
  return elementChildren(list, 'li').map((item, index) => {
    const nestedLists = elementChildren(item).filter((child) => child.tagName === 'ol' || child.tagName === 'ul');
    const ownContent = { ...item, childNodes: (item.childNodes ?? []).filter((child) => !nestedLists.includes(child)) };
    return {
      type: 'item',
      label: ordered ? `${index + 1}.` : '–',
      text: textOf(ownContent, { breaks: true }),
      level,
      numberingStyle: 'decimal',
      children: nestedLists.flatMap((nested) => parseHtmlList(nested, level + 1)),
    };
  });
}

function sectionContent(section, state = { signature: false }) {
  const blocks = [];
  for (const child of elementChildren(section)) {
    if (/^h[1-6]$/u.test(child.tagName) || child.tagName === 'section') continue;
    if (child.tagName === 'p') {
      const text = textOf(child, { breaks: true });
      if (SIGNATURE_START.test(text)) {
        state.signature = true;
        continue;
      }
      if (state.signature) continue;
      const block = paragraphBlock(child);
      if (block) blocks.push(block);
      continue;
    }
    if (state.signature) continue;
    if (child.tagName === 'dl') {
      blocks.push(...parseDefinitionList(child));
      continue;
    }
    if (child.tagName === 'table') {
      blocks.push(parseTable(child));
      continue;
    }
    if (child.tagName === 'ol' || child.tagName === 'ul') {
      blocks.push(...parseHtmlList(child));
      continue;
    }
    // Sonstige Container (div, nav, …): Inhalt in Dokumentreihenfolge übernehmen.
    blocks.push(...sectionContent(child, state));
  }
  return blocks;
}

function parseSections(container, notes = [], { hoistTextBearingWrappers = false } = {}) {
  const root = [];
  const stack = [{ rank: 0, children: root }];
  const sections = descendants(container, (node) => node.tagName === 'section');
  for (const section of sections) {
    let marker = markerFromSection(section);
    if (!marker) {
      const sectionTitle = normalizeText(
        attributes(section).title ?? textOf(directHeading(section), { breaks: true }),
      ).replace(/\n+/gu, ' ');
      // REVOSax stellt Bekanntmachungs- und Identitätsblöcke im selben Container
      // wie den Normkörper bereit. Sie gehören zur unveränderten Rohquelle und
      // zur Fundstellenprüfung, sind aber keine Gliederungseinheit der Lesefassung.
      if (hoistTextBearingWrappers && TEXT_BEARING_WRAPPER.test(sectionTitle)) {
        stack.at(-1).children.push(...sectionContent(section));
        notes.push({ kind: 'hoisted-wrapper', title: sectionTitle });
        continue;
      }
      if (NON_NORM_SECTION.test(sectionTitle)) continue;
      if (HOISTED_WRAPPER_SECTION.test(sectionTitle)) {
        stack.at(-1).children.push(...sectionContent(section));
        notes.push({ kind: 'hoisted-wrapper', title: sectionTitle });
        continue;
      }
      if (!sectionTitle) {
        // Unbetitelte technische Container (z. B. für manuelle Satznummerierung) sind
        // keine Gliederungseinheit; ihr unmittelbarer Inhalt wird auf der aktuellen Ebene übernommen.
        stack.at(-1).children.push(...sectionContent(section));
        notes.push({ kind: 'untitled-wrapper' });
        continue;
      }
      // Überschrift ohne Gliederungskennzeichen (z. B. „Übereinkommen“, „Schlussbestimmungen“):
      // Die Struktur bleibt als betitelter Abschnitt erhalten und wird im Staging ausgewiesen.
      marker = { type: 'section', title: sectionTitle, rank: GENERIC_SECTION_RANK };
      notes.push({ kind: 'generic-section', title: sectionTitle });
    }
    const block = {
      type: marker.type,
      ...(marker.label ? { label: marker.label } : {}),
      ...(marker.title ? { title: marker.title } : {}),
      children: sectionContent(section),
    };
    const rank = marker.rank ?? STRUCTURE_RANK[block.type];
    while (stack.length > 1 && stack.at(-1).rank >= rank) stack.pop();
    stack.at(-1).children.push(block);
    stack.push({ rank, children: block.children });
  }
  return root;
}

/**
 * Fundstellennummer aus dem Kasten „Fundstelle und systematische Gliederungsnummer“
 * der Marginalspalte. Ihre Gliederungsnummer (Teil vor dem Bindestrich) trägt die
 * amtliche Sachgebietszuordnung; ältere Fassungsseiten führen den Kasten ohne sie.
 */
function parseFsnNumber(document) {
  const box = findElement(document, (node) => hasClass(node, 'box')
    && elementChildren(node, 'h3').some((heading) => textOf(heading) === 'Fundstelle und systematische Gliederungsnummer'));
  if (!box) return null;
  const match = textOf(box, { breaks: true }).match(/Fsn-Nr\.:\s*(\S+)/u);
  return match ? match[1] : null;
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
  // Neuere REVOSax-Ausgaben legen die Abschnitte in einen anderen Container als .sections;
  // maßgeblich ist, dass der Artikel Gliederungsabschnitte enthält.
  const sectionsContainer = findElement(article, (node) => hasClass(node, 'sections'))
    ?? (descendants(article, (node) => node.tagName === 'section').length > 0 ? article : null);
  const structureNotes = [];
  const provisionsOf = (blocks) => blocks
    .flatMap(function flatten(block) {
      return [block, ...(block.children ?? []).flatMap(flatten)];
    })
    .filter((block) => ['paragraph', 'article', 'section'].includes(block.type));
  let sectionBlocks;
  if (sectionsContainer) {
    sectionBlocks = parseSections(sectionsContainer, structureNotes);
    if (sectionBlocks.length === 0) {
      // Zustimmungsgesetze und amtliche Bekanntmachungen tragen ihren gesamten Text
      // gelegentlich im Wrapper „Gesetz“, „Verordnung“ oder „Bekanntmachung“.
      structureNotes.length = 0;
      sectionBlocks = parseSections(sectionsContainer, structureNotes, { hoistTextBearingWrappers: true });
    }
  } else {
    // Altes REVOSax-Layout ohne Gliederungscontainer: Lesetext liegt direkt im Artikel.
    const container = findElement(article, (node) => node.tagName === 'nav' || (node.tagName === 'div' && attributes(node).id === 'lesetext')) ?? article;
    sectionBlocks = sectionContent(container).filter((block) => !(block.type === 'paragraphText' && /^Vom\s+\d{1,2}\.\s/u.test(block.text)));
    if (sectionBlocks.length === 0) throw new RevosaxParseError('REVOSax-Gliederungscontainer .sections fehlt und Artikel enthält keinen Text');
    structureNotes.push({ kind: 'legacy-layout' });
  }
  const body = [...entryFormula, ...sectionBlocks];
  if (body.length === 0) throw new RevosaxParseError('kein Normtext erkannt');
  if (provisionsOf(body).length === 0) structureNotes.push({ kind: 'no-provisions' });

  return {
    sourceTitle,
    shortTitle: sourceTitle,
    ...(abbr ? { abbr } : {}),
    // REVOSax aktualisiert dieses Seiten-Vollzitat teilweise auch auf Seiten
    // historischer Fassungen. Es bleibt Quelleninformation; Materializer müssen
    // daraus eine zeitlich plausible versionsspezifische Zitierung auswählen.
    pageFullCitation: fullCitation,
    fullCitation,
    // Amtliche Fundstellennummer der Seite; Grundlage der Sachgebietszuordnung.
    fsnNumber: parseFsnNumber(document),
    documentDate,
    sourceValidFrom: validFrom,
    sourceValidTo: validTo,
    sourceUrl: url,
    body,
    sourceNotes: parseSourceNotes(article),
    ...(structureNotes.length > 0 ? { structureNotes } : {}),
  };
}
