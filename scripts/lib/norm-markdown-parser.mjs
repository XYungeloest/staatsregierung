const ORDINAL_STEM = '(?:Erst|Zweit|Dritt|Viert|Fünft|Sechst|Siebt|Acht|Neunt|Zehnt|Elft|Zwölft|Dreizehnt|Vierzehnt|Fünfzehnt|Sechzehnt|Siebzehnt|Achtzehnt|Neunzehnt|Zwanzigst)';
const ORDINAL_LAW = `(?:${ORDINAL_STEM}(?:e|er|es|en))`;

const SOURCE_HEADING_PATTERN = new RegExp(
  `^(?:(?:${ORDINAL_LAW})\\s+(?:Gesetz|Verordnung)|Gesetz|Änderungsgesetz|Rechtsverordnung|Verordnung|Satzung|Förderrichtlinie|Richtlinie|Verwaltungsvorschrift|Allgemeinverfügung|Bekanntmachung|Anordnung|Erlass|Staatsvertrag|Abkommen|Übereinkommen|Vertrag)(?:\\s+.*)?$`,
  'iu',
);

const OUTER_ARTICLE_TITLE = /^(?:Einführung|Änderung|Neufassung|Übergangsbestimmungen?|Berichtspflicht|Einschränkung|Inkrafttreten|Außerkrafttreten|Bekanntmachung|Anpassung|Rechtsbereinigung)/iu;
const SIGNATURE_START = /^(?:Dresden|Berlin|Leipzig|Potsdam|Warschau|Prag|Helsinki),\s+den\b/iu;
const SIGNATURE_OFFICE = /^(?:D\s+i\s+e|D\s+e\s+r)\s+(?:M\s+I\s+N\s+I\s+S\s+T\s+E\s+R|S\s+T\s+A\s+A\s+T\s+S|L\s+A\s+N\s+D\s+T\s+A\s+G)/iu;
const BASE64_PATTERN = /(?:data:image\/|;base64,|\[image\d+\]:\s*<data:)/iu;
const QUOTED_PROVISION_TRIGGER = /(?:wird\s+(?:wie folgt gefasst|folgender\s+(?:Artikel|Paragraph|§)[^:]*(?:eingefügt|angefügt))|wird\s+durch\s+(?:die\s+)?(?:folgende|nachstehende)\s+Fassung\s+(?:ersetzt|abgelöst)|erhält\s+folgende\s+Bezeichnung)\s*:?$/iu;

export class NormMarkdownParseError extends Error {
  constructor(fileName, line, message) {
    super(`${fileName}:${line}: ${message}`);
    this.name = 'NormMarkdownParseError';
  }
}

export function normalizeMarkdown(markdown) {
  return markdown
    .replace(/\r\n?/gu, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, ' ')
    .replace(/\u00a0/gu, ' ');
}

export function stripMarkdown(value) {
  return value
    .replace(/^\s{0,3}#{1,6}\s*/u, '')
    .replace(/^\s*>+\s?/u, '')
    .replace(/\{#[^}]+\}\s*$/u, '')
    .replace(/!\[[^\]]*\](?:\[[^\]]+\]|\([^)]*\))/gu, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/\[\^[^\]]+\]/gu, '')
    .replace(/\*\*|__/gu, '')
    .replace(/(?<!\*)\*(?!\*)/gu, '')
    .replace(/`/gu, '')
    .replace(/\\([.()\-])/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
}

function makeLines(markdown) {
  return normalizeMarkdown(markdown).split('\n').map((raw, index) => ({
    raw,
    indent: raw.match(/^\s*/u)?.[0].replace(/\t/gu, '    ').length ?? 0,
    number: index + 1,
    text: stripMarkdown(raw),
    blank: stripMarkdown(raw) === '',
  }));
}

export function classifyMarkdownSource(fileName, markdown) {
  const normalized = normalizeMarkdown(markdown);
  if (/^PM-/iu.test(fileName) || /\bPressemitteilung\b/iu.test(normalized.slice(0, 3000))) {
    return { kind: 'editorial', reason: 'Presse- oder Begleittext' };
  }
  if (/(?:Gesetz- und Verordnungsblatt|Amtsblatt|Staatsanzeiger|Vertragsblatt)/iu.test(normalized.slice(0, 5000)) && /Ausgegeben\s+(?:zu|in)/iu.test(normalized.slice(0, 5000))) {
    return { kind: 'publication', reason: 'Ausgabe eines Verkündungsblattes' };
  }
  const structureCount = (normalized.match(/^(?:\s*#{1,6}\s*)?(?:\*\*)?(?:§{1,2}\s*\d|Artikel\s+\d)/gimu) ?? []).length;
  if (/Staatsverfassung/iu.test(fileName) || /\bVollzitat\b/iu.test(normalized) || structureCount >= 3) {
    return { kind: 'consolidated', reason: 'konsolidierte oder eigenständige Einzelnorm' };
  }
  if (/\b(?:Erläuterung|Begründung|Hinweis|Begleittext)\b/iu.test(normalized.slice(0, 3000))) {
    return { kind: 'editorial', reason: 'redaktionelle Begleitdatei' };
  }
  return { kind: 'ambiguous', reason: 'keine eindeutige Norm- oder Ausgabenstruktur' };
}

export function parseGermanDate(value) {
  const match = value?.replace(/\\\./gu, '.').match(
    /(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/iu,
  );
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

function cleanTitleLines(lines) {
  return lines.map((line) => line.text).filter(Boolean).join(' ').replace(/\s+/gu, ' ').trim();
}

function parseIdentity(heading, rawTitle) {
  const cleanedRawTitle = rawTitle.replace(/^[„“”'`,.]+/u, '').trim();
  let title = new RegExp(`^(?:${heading}|Gesetz|Verordnung)\\b`, 'iu').test(cleanedRawTitle)
    ? cleanedRawTitle
    : `${heading} ${cleanedRawTitle}`.replace(/\s+/gu, ' ').trim();
  const parenthetical = title.match(/\(([^()]+?)\s+[–-]\s+([^()]+?)\)\s*$/u);
  let shortTitle = title;
  let abbr = '';
  if (parenthetical) {
    shortTitle = parenthetical[1].trim();
    abbr = parenthetical[2].trim();
    title = title.slice(0, parenthetical.index).trim();
  }
  if (!abbr) {
    const simpleParenthetical = title.match(/\(([^()]{2,40})\)\s*$/u);
    if (simpleParenthetical) abbr = simpleParenthetical[1].trim();
  }
  return { title, shortTitle, abbr: abbr || undefined };
}

function sourceTypeFromHeading(heading, title) {
  if (/Verordnung/iu.test(heading)) return 'verordnung';
  if (/Verwaltungsvorschrift/iu.test(heading)) return 'verwaltungsvorschrift';
  if (/Förderrichtlinie/iu.test(heading)) return 'foerderrichtlinie';
  if (/Allgemeinverfügung/iu.test(heading)) return 'allgemeinverfuegung';
  if (/Bekanntmachung/iu.test(heading)) return 'bekanntmachung';
  if (/Anordnung|Erlass|Richtlinie/iu.test(heading)) return 'verwaltungsvorschrift';
  if (/Staatsvertrag|Abkommen|Übereinkommen|Vertrag/iu.test(heading)) return 'staatsvertrag';
  if (/Änderung|Neuordnung|Einführung|Errichtung|Reform/iu.test(`${heading} ${title}`)) return 'aenderungsvorschrift';
  return 'gesetz';
}

export function parseStructureMarker(value) {
  const raw = String(value ?? '');
  const text = stripMarkdown(raw).replace(/^[„“”'`,.]+/u, '').trim();
  let match = text.match(/^((?:Teil|Kapitel|Abschnitt|Unterabschnitt)\s+(?:\d+[a-z]?|[IVXLCDM]+))\s*(?:[–—:-]|\s-\s)?\s*(.*)$/iu);
  if (match) {
    const prefix = match[1].split(/\s+/u)[0].toLocaleLowerCase('de');
    const type = { teil: 'part', kapitel: 'chapter', abschnitt: 'section', unterabschnitt: 'subsection' }[prefix];
    return { type, label: match[1], title: match[2] || undefined };
  }
  match = text.match(/^([IVXLCDM]+\.\s*Abschnitt)\s*(?:[–—:-])?\s*(.*)$/u);
  if (match) return { type: 'section', label: match[1], title: match[2] || undefined };
  if (/^\s*(?:#{1,6}\s*)?(?:\*\*)?(?![IVXLCDM]\\?\.)[A-Z]\\?\.(?:\*\*)?\s*$/u.test(raw)) {
    return { type: 'part', label: text };
  }
  if (/^\s*(?:#{1,6}\s*)?(?:\*\*)?[IVXLCDM]+\\?\.(?:\*\*)?\s*$/u.test(raw)) {
    return { type: 'section', label: text };
  }
  if (/^\s*(?:(?:#{1,6}\s*)|(?:\*\*))\d+(?:\.\d+)*\\?\.(?:\*\*)?\s+.+/u.test(raw)) {
    const outline = text.match(/^(\d+(?:\.\d+)*\.)\s+(.+)$/u);
    if (outline) return { type: outline[1].includes('.') && outline[1].split('.').filter(Boolean).length > 1 ? 'subsection' : 'section', label: outline[1], title: outline[2] };
  }
  match = text.match(/^(Präambel)\s*(?:[–—:-])?\s*(.*)$/iu);
  if (match) return { type: 'section', label: 'Präambel', title: match[2] || undefined };
  match = text.match(/^(Artikel\s+\d+[a-z]?)\s*(?:[–—:-])?\s*(.*)$/iu);
  if (match) return { type: 'article', label: match[1], title: match[2] || undefined };
  match = text.match(/^(§{1,2}\s*\d+[a-z]?(?:\s*(?:,|und)\s*\d+[a-z]?)?(?:\s+bis\s+\d+[a-z]?)?)\s*(?:[–—:-])?\s*(.*)$/iu);
  if (match) return { type: 'paragraph', label: match[1], title: match[2] || undefined };
  match = text.match(/^((?:Anlage(?:\s+\d+[a-z]?)?|Anhang)(?:\s*\([^)]*\))?)\s*(?:[–—:-])?\s*(.*)$/iu);
  if (match) return { type: 'annex', label: match[1], title: match[2] || undefined };
  return null;
}

function markerAt(lines, index) {
  const marker = parseStructureMarker(lines[index]?.raw ?? '');
  if (!marker) return null;
  if (!marker.title) {
    let cursor = index + 1;
    while (cursor < lines.length && lines[cursor].blank) cursor += 1;
    if (cursor < lines.length && !parseStructureMarker(lines[cursor].raw) && /^\s*(?:#{1,6}\s*)?(?:\*\*)/u.test(lines[cursor].raw)) {
      marker.title = lines[cursor].text;
      marker.titleLine = cursor;
    }
  }
  return marker;
}

function isOuterArticle(lines, index) {
  const marker = markerAt(lines, index);
  return marker?.type === 'article' && OUTER_ARTICLE_TITLE.test(marker.title ?? '');
}

function sanitizeBodyLines(lines, startIndex, endIndex) {
  const result = [];
  let inSignatureBlock = false;
  for (let index = startIndex; index < endIndex; index += 1) {
    const line = lines[index];
    if (SIGNATURE_START.test(line.text)) {
      inSignatureBlock = true;
      continue;
    }
    if (SIGNATURE_OFFICE.test(line.text)) {
      // Steht der Orts- und Datumsblock bereits vor der Unterschrift, wurden
      // Name und Amtszeile noch gar nicht in den Normkörper übernommen. Nur
      // Quellen ohne diesen Block benötigen die rückwärts gerichtete Entfernung
      // der unmittelbar vorangestellten Namenszeile.
      if (!inSignatureBlock) {
        while (result.at(-1)?.blank) result.pop();
        if (result.at(-1) && !parseStructureMarker(result.at(-1).raw)) result.pop();
      }
      inSignatureBlock = true;
      continue;
    }
    if (inSignatureBlock) {
      const marker = parseStructureMarker(line.raw);
      if (marker?.type !== 'annex') continue;
      inSignatureBlock = false;
    }
    if (/^\[image\d+\]:/iu.test(line.raw.trim()) || /^!\[[^\]]*\]\[[^\]]+\]\s*$/u.test(line.raw.trim())) continue;
    if (/^\[\^[^\]]+\]:/u.test(line.raw.trim())) continue;
    if (BASE64_PATTERN.test(line.raw)) continue;
    if (/Gesetz- und Verordnungsblatt/iu.test(line.text) && /Nr\./u.test(line.text)) continue;
    result.push(line);
  }
  return result;
}

const STRUCTURE_RANK = { part: 1, chapter: 2, annex: 2, section: 3, subsection: 4, article: 5, paragraph: 5 };

function parseListItem(text) {
  let match = text.match(/^(\(?\d+[a-z]?\)?[.)])(?:\s+(.*))?$/iu);
  if (match) return { type: 'item', label: match[1], text: match[2] ?? '', numberingStyle: /^\(/u.test(match[1]) ? 'decimal-parenthesized' : 'decimal' };
  match = text.match(/^([a-z]{1,2}[.)])(?:\s+(.*))?$/iu);
  if (match) return { type: match[1].length > 2 ? 'subitem' : 'item', label: match[1], text: match[2] ?? '', numberingStyle: 'lower-latin' };
  match = text.match(/^([ivxlcdm]+[.)])(?:\s+(.*))?$/iu);
  if (match) return { type: 'subitem', label: match[1], text: match[2] ?? '', numberingStyle: 'lower-roman' };
  match = text.match(/^[–—-]\s+(.*)$/u);
  if (match) return { type: 'item', label: '–', text: match[1] };
  return null;
}

function alphabeticLabel(number) {
  let value = Math.max(1, number);
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(97 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function romanLabel(number) {
  const values = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let value = Math.max(1, number);
  let label = '';
  for (const [numeric, roman] of values) {
    while (value >= numeric) {
      label += roman;
      value -= numeric;
    }
  }
  return label;
}

function normalizeLegacyNestedLabel(item, semanticLevel) {
  if (semanticLevel === 0 || item.numberingStyle !== 'decimal' || !/^\d+\.$/u.test(item.label)) return item;
  const number = Number.parseInt(item.label, 10);
  if (semanticLevel === 1) return { ...item, label: `${alphabeticLabel(number)}.`, numberingStyle: 'lower-latin' };
  if (semanticLevel === 2) return { ...item, label: `${romanLabel(number)}.`, numberingStyle: 'lower-roman' };
  return { ...item, label: `${alphabeticLabel(number).repeat(2)})`, numberingStyle: 'lower-latin-double' };
}

function tableCells(raw) {
  const trimmed = raw.trim();
  const withoutOuterPipes = trimmed.replace(/^\|/u, '').replace(/\|$/u, '');
  return withoutOuterPipes.split('|').map((cell) => stripMarkdown(cell));
}

function isTableSeparator(raw) {
  return /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/u.test(raw);
}

export function parseStructuredBody(inputLines) {
  const lines = inputLines.map((line, index) => typeof line === 'string'
    ? { raw: line, indent: line.match(/^\s*/u)?.[0].replace(/\t/gu, '    ').length ?? 0, text: stripMarkdown(line), blank: stripMarkdown(line) === '', number: index + 1 }
    : line);
  const root = [];
  const stack = [{ rank: 0, children: root }];
  let listStack = [];
  let previousWasBlank = true;

  const appendContinuation = (children, text) => {
    const previous = children.at(-1);
    if (!previous || !['paragraphText', 'subparagraph', 'item', 'subitem'].includes(previous.type)) return false;
    previous.text = `${previous.text} ${text}`.replace(/\s+/gu, ' ').trim();
    return true;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.blank) {
      previousWasBlank = true;
      continue;
    }
    const marker = markerAt(lines, index);
    if (marker) {
      const block = { type: marker.type, label: marker.label, title: marker.title, children: [] };
      const rank = STRUCTURE_RANK[marker.type];
      const quoteParent = listStack.at(-1);
      if (quoteParent && line.indent > quoteParent.indent && QUOTED_PROVISION_TRIGGER.test(quoteParent.block.text ?? '')) {
        const quotedProvision = { type: 'quotedProvision', children: [block] };
        quoteParent.block.children.push(quotedProvision);
        stack.push({ rank, children: block.children });
        listStack = [];
        if (marker.titleLine === index + 1) index = marker.titleLine;
        previousWasBlank = false;
        continue;
      }
      while (stack.length > 1 && stack.at(-1).rank >= rank) stack.pop();
      stack.at(-1).children.push(block);
      stack.push({ rank, children: block.children });
      listStack = [];
      if (marker.titleLine === index + 1) index = marker.titleLine;
      previousWasBlank = false;
      continue;
    }

    if (/^\s*\|.*\|\s*$/u.test(line.raw)) {
      const rows = [];
      const rawRows = [];
      let cursor = index;
      while (cursor < lines.length && /^\s*\|.*\|\s*$/u.test(lines[cursor].raw)) {
        rawRows.push(lines[cursor]);
        cursor += 1;
      }
      const separatorIndex = rawRows.findIndex((row) => isTableSeparator(row.raw));
      rawRows.forEach((row, rowIndex) => {
        if (isTableSeparator(row.raw)) return;
        const header = separatorIndex > 0 && rowIndex < separatorIndex;
        const cells = tableCells(row.raw).map((text) => ({
          type: header ? 'tableHeaderCell' : 'tableCell',
          text,
        }));
        rows.push({ type: 'tableRow', children: cells });
      });
      if (rows.length > 0) stack.at(-1).children.push({ type: 'table', children: rows });
      listStack = [];
      index = cursor - 1;
      previousWasBlank = false;
      continue;
    }

    const text = line.text;
    if (!text || /^Inhaltsverzeichnis$/iu.test(text)) continue;
    if (text === '1.' && line.indent === 0 && !root.some((block) => ['part', 'chapter', 'section'].includes(block.type)) &&
      lines.slice(index + 1).some((candidate) => parseStructureMarker(candidate.raw)?.label === 'II.')) {
      const block = { type: 'section', label: 'I.', children: [] };
      root.push(block);
      stack.push({ rank: STRUCTURE_RANK.section, children: block.children });
      listStack = [];
      previousWasBlank = false;
      continue;
    }
    const subparagraph = text.match(/^\((\d+[a-z]?)\)\s*(.*)$/iu);
    if (subparagraph) {
      const block = { type: 'subparagraph', label: `(${subparagraph[1]})`, text: subparagraph[2], children: [] };
      stack.at(-1).children.push(block);
      listStack = [{ indent: line.indent, children: block.children, block }];
      previousWasBlank = false;
      continue;
    }
    const item = parseListItem(text);
    if (item) {
      while (listStack.length > 0 && line.indent <= listStack.at(-1).indent) listStack.pop();
      const semanticLevel = listStack.length;
      const normalizedItem = normalizeLegacyNestedLabel(item, semanticLevel);
      const block = { ...normalizedItem, level: semanticLevel, children: [] };
      const children = listStack.at(-1)?.children ?? stack.at(-1).children;
      children.push(block);
      listStack.push({ indent: line.indent, children: block.children, block });
      previousWasBlank = false;
      continue;
    }
    const continuationChildren = listStack.at(-1)?.children?.length === 0 && listStack.at(-1)?.block
      ? [listStack.at(-1).block]
      : stack.at(-1).children;
    if ((!previousWasBlank || listStack.at(-1)?.block?.text === '') && appendContinuation(continuationChildren, text)) {
      previousWasBlank = false;
      continue;
    }
    stack.at(-1).children.push({ type: 'paragraphText', text });
    listStack = [];
    previousWasBlank = false;
  }
  return root;
}

function flattenBlocks(blocks, output = []) {
  for (const block of blocks) {
    output.push(block);
    if (block.children) flattenBlocks(block.children, output);
  }
  return output;
}

function validateBody(fileName, sourceLine, title, body, { strictLabels = false } = {}) {
  const flat = flattenBlocks(body);
  const structured = flat.filter((block) => ['part', 'chapter', 'section', 'subsection', 'article', 'paragraph', 'annex', 'item', 'table'].includes(block.type));
  if (structured.length === 0 && !flat.some((block) => block.type === 'paragraphText' && block.text)) {
    throw new NormMarkdownParseError(fileName, sourceLine, `„${title}“ enthält keinen erkannten Normtext`);
  }
  const bodyText = flat.map((block) => `${block.label ?? ''} ${block.title ?? ''} ${block.text ?? ''}`).join(' ');
  if (/Inhaltsverzeichnis/iu.test(bodyText)) throw new NormMarkdownParseError(fileName, sourceLine, `Inhaltsverzeichnis ist in den Normkörper von „${title}“ geraten`);
  if (BASE64_PATTERN.test(bodyText)) throw new NormMarkdownParseError(fileName, sourceLine, `Bild- oder Base64-Daten sind in den Normkörper von „${title}“ geraten`);
  if (/Dresden,\s+den|LANDTAGSPRÄSIDENT/iu.test(bodyText)) throw new NormMarkdownParseError(fileName, sourceLine, `Signaturblock ist in den Normkörper von „${title}“ geraten`);
  if (strictLabels) {
    const labels = new Set();
    for (const block of structured.filter((entry) => entry.type === 'paragraph')) {
      const label = block.label?.toLocaleLowerCase('de');
      if (label && labels.has(label)) throw new NormMarkdownParseError(fileName, sourceLine, `doppelte Paragraphenkennzeichnung ${block.label} in „${title}“`);
      if (label) labels.add(label);
    }
  }
}

function findMainHeading(lines, tocIndex) {
  for (let index = Math.max(0, tocIndex + 1); index < lines.length; index += 1) {
    if (SOURCE_HEADING_PATTERN.test(lines[index].text)) return index;
  }
  return -1;
}

function parseMainTitle(lines, headingIndex, fileName, fallbackDocumentDate = null) {
  const heading = lines[headingIndex].text;
  const titleLines = [];
  let documentDate = null;
  let cursor = headingIndex + 1;
  for (; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (line.blank) continue;
    if (/^vom\b/iu.test(line.text)) {
      documentDate = parseGermanDate(line.text);
      cursor += 1;
      break;
    }
    if (parseStructureMarker(line.raw) || /^(?:Der .*Landtag|Auf Grund|Aufgrund|Der Staatsrat|Ich ordne|Gemäß)/iu.test(line.text)) break;
    titleLines.push(line);
  }
  documentDate ??= fallbackDocumentDate;
  if (!documentDate) throw new NormMarkdownParseError(fileName, lines[headingIndex].number, 'Dokumentdatum nach der Normüberschrift fehlt oder ist mehrdeutig');
  const identity = parseIdentity(heading, cleanTitleLines(titleLines));
  if (!identity.title || /^\|/u.test(identity.title)) throw new NormMarkdownParseError(fileName, lines[headingIndex].number, 'Normtitel fehlt oder besteht aus Kopf-/Tabellentext');
  return { heading, identity, documentDate, cursor };
}

function inferEffectiveDate(text, publicationDate) {
  if (/tritt\s+(?:am|mit dem)\s+Tag\s+(?:nach\s+)?(?:seiner|ihrer|der)\s+Verkündung\s+in\s+Kraft/iu.test(text)) {
    return /Tag\s+nach/iu.test(text) ? addUtcDays(publicationDate, 1) : publicationDate;
  }
  const explicit = text.match(/tritt\s+am\s+(\d{1,2}\.\s*[A-ZÄÖÜa-zäöüß]+\s+\d{4})\s+in\s+Kraft/iu);
  return explicit ? parseGermanDate(explicit[1]) : null;
}

function extractIntroducedNorms(lines, bodyStart, bodyEnd, publication, fileName) {
  const introduced = [];
  for (let index = bodyStart; index < bodyEnd; index += 1) {
    const introduction = lines[index].text.match(/^Das nachstehende wird (Gesetz|Verordnung):$/iu);
    const replacement = lines[index].text.match(/wird durch die nachstehende\s+(.+?)\s+abgelöst:$/iu);
    if (!introduction && !replacement) continue;
    let cursor = index + 1;
    while (cursor < bodyEnd && lines[cursor].blank) cursor += 1;
    const titleLines = [];
    while (cursor < bodyEnd && !parseStructureMarker(lines[cursor].raw)) {
      if (!lines[cursor].blank) titleLines.push(lines[cursor]);
      cursor += 1;
    }
    const heading = introduction?.[1] ?? 'Gesetz';
    const rawIdentity = cleanTitleLines(titleLines).replace(/^[„“”'`,.]+/u, '').trim();
    const replacementMatch = replacement ? rawIdentity.match(/^(.+?)\s*\(([^()]+)\)\s*$/u) : null;
    const identity = replacementMatch
      ? { title: replacementMatch[1].trim(), shortTitle: replacementMatch[1].trim(), abbr: replacementMatch[2].trim() }
      : parseIdentity(heading, rawIdentity);
    if (!identity.title) throw new NormMarkdownParseError(fileName, lines[index].number, 'eingeführte Stammnorm besitzt keinen Titel');
    const segmentStart = cursor;
    let segmentEnd = bodyEnd;
    for (let lookahead = segmentStart + 1; lookahead < bodyEnd; lookahead += 1) {
      if (isOuterArticle(lines, lookahead)) {
        segmentEnd = lookahead;
        break;
      }
    }
    const bodyLines = sanitizeBodyLines(lines, segmentStart, segmentEnd);
    const body = parseStructuredBody(bodyLines);
    validateBody(fileName, lines[index].number, identity.title, body, { strictLabels: true });
    introduced.push({
      kind: replacement ? 'replacement' : 'introduced',
      heading,
      ...identity,
      type: /Verordnung/iu.test(heading) ? 'verordnung' : 'gesetz',
      documentDate: publication.documentDate,
      publicationDate: publication.publicationDate,
      effectiveDate: publication.effectiveDate,
      sourceLine: lines[index].number,
      body,
    });
  }
  return introduced;
}

export function parsePublicationMarkdown(fileName, markdown) {
  const classification = classifyMarkdownSource(fileName, markdown);
  if (classification.kind !== 'publication') throw new NormMarkdownParseError(fileName, 1, `Quelle ist keine Verkündungsblatt-Ausgabe (${classification.reason})`);
  const lines = makeLines(markdown);
  const header = lines.slice(0, 20).map((line) => line.text).join(' ');
  const issueMatch = header.match(/Nr\.\s*(\d+)/u);
  const publicationDate = parseGermanDate(header.match(/Ausgegeben[^|]*/iu)?.[0] ?? header);
  if (!issueMatch || !publicationDate) throw new NormMarkdownParseError(fileName, 1, 'Ausgabenummer oder Ausgabedatum konnte nicht bestimmt werden');
  const tocIndex = lines.findIndex((line) => /^Inhaltsverzeichnis$/iu.test(line.text));
  const headingIndex = findMainHeading(lines, tocIndex);
  if (headingIndex < 0) throw new NormMarkdownParseError(fileName, 1, 'keine unterstützte Normüberschrift nach dem Inhaltsverzeichnis erkannt');
  const main = parseMainTitle(lines, headingIndex, fileName, publicationDate);
  const tocText = lines.slice(Math.max(0, tocIndex), headingIndex).map((line) => line.text).join(' ');
  const startPage = tocText.match(/\bSeite\s+(\d+)\b/iu)?.[1];
  const bodyStart = main.cursor;
  // Der Ausfertigungsblock beendet nicht zwingend die Quelle: Anlagen können ihm folgen.
  // Die Bereinigung überspringt Signaturzeilen und setzt bei einer Anlage wieder ein.
  const bodyEnd = lines.length;
  const sanitized = sanitizeBodyLines(lines, bodyStart, bodyEnd);
  const body = parseStructuredBody(sanitized);
  validateBody(fileName, lines[headingIndex].number, main.identity.title, body);
  const bodyText = lines.slice(bodyStart, bodyEnd).map((line) => line.text).join(' ');
  const effectiveDate = inferEffectiveDate(bodyText, publicationDate);
  const publication = {
    kind: 'publication',
    fileName,
    issue: issueMatch[1],
    publication: /Gesetz- und Verordnungsblatt/iu.test(header) ? 'OGVBl.'
      : /Staatsanzeiger/iu.test(header) ? 'StAnzO.'
        : /Vertragsblatt/iu.test(header) ? 'OVertrBl.' : 'OABl.',
    year: Number(publicationDate.slice(0, 4)),
    publicationDate,
    documentDate: main.documentDate,
    effectiveDate,
    heading: main.heading,
    ...main.identity,
    type: sourceTypeFromHeading(main.heading, main.identity.title),
    sourceLine: lines[headingIndex].number,
    startPage,
    body,
  };
  publication.introducedNorms = extractIntroducedNorms(lines, bodyStart, bodyEnd, publication, fileName);
  const firstMainStructure = publication.body.find((block) => ['article', 'paragraph'].includes(block.type));
  if (publication.introducedNorms.length > 0 || firstMainStructure?.title?.startsWith('Änderung')) {
    publication.type = 'aenderungsvorschrift';
  }
  return publication;
}

export function parseConsolidatedMarkdown(fileName, markdown, identity = {}) {
  const classification = classifyMarkdownSource(fileName, markdown);
  if (classification.kind !== 'consolidated') throw new NormMarkdownParseError(fileName, 1, `Quelle ist keine konsolidierte Einzelnorm (${classification.reason})`);
  const lines = makeLines(markdown);
  const tocIndex = lines.findIndex((line) => /Inhaltsverzeichnis/iu.test(line.text));
  let bodyStart = lines.findIndex((line, index) => index > tocIndex && /^\s*#{1,6}\s/u.test(line.raw) && parseStructureMarker(line.raw));
  if (bodyStart < 0) bodyStart = lines.findIndex((line) => parseStructureMarker(line.raw));
  const body = parseStructuredBody(sanitizeBodyLines(lines, bodyStart, lines.length));
  const titlePreamble = [];
  for (const line of lines.slice(0, tocIndex >= 0 ? tocIndex : 12)) {
    if (/^(?:Vollzitat|Weitere Änderungen|in der Fassung)/iu.test(line.text)) break;
    if (line.text) titlePreamble.push(line.text);
  }
  const inferredTitle = titlePreamble.join(' ').replace(/\s+/gu, ' ').trim();
  const title = (identity.title ?? inferredTitle) || stripMarkdown(fileName.replace(/\.md$/iu, ''));
  validateBody(fileName, lines[bodyStart]?.number ?? 1, title, body, { strictLabels: true });
  return { kind: 'consolidated', fileName, title, body, sourceLine: lines[bodyStart]?.number ?? 1 };
}

export function summarizeParsedSource(parsed) {
  const all = [parsed, ...(parsed.introducedNorms ?? [])];
  return all.map((norm) => {
    const flat = flattenBlocks(norm.body);
    const structures = flat.filter((block) => ['article', 'paragraph', 'annex'].includes(block.type));
    return {
      title: norm.title,
      type: norm.type ?? 'gesetz',
      documentDate: norm.documentDate,
      publicationDate: norm.publicationDate,
      effectiveDate: norm.effectiveDate,
      firstStructure: structures[0]?.label,
      lastStructure: structures.at(-1)?.label,
      structureCount: structures.length,
    };
  });
}
