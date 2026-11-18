import { parse } from 'parse5';

const DATE_PATTERN = /(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/iu;
const PARTIAL_DATE_PATTERN = /(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b(?!\s+\d{4})/iu;
const GERMAN_MONTHS = {
  januar: '01', februar: '02', märz: '03', maerz: '03', april: '04', mai: '05', juni: '06',
  juli: '07', august: '08', september: '09', oktober: '10', november: '11', dezember: '12',
};
const LIST_CLASS_PATTERN = /(?:^|\s)lst-kix_([a-z0-9_]+)-(\d+)(?=\s|$)/iu;
const SIGNATURE_PATTERN = /^[\p{L} .'-]{2,60},\s+den\s+\d{1,2}\./iu;
// Gesperrter Satz: einzeln stehende Buchstaben eines Wortes. Wortgrenzen stehen in den
// Quellen als geschütztes oder doppeltes Leerzeichen; sie werden vor der Auflösung
// markiert, damit „D e r  M I N I S T E R“ nicht zu einem einzigen Wort verschmilzt.
const SPACED_WORD_GAP = '\u0000';
const SPACED_LETTER_RUN = /(?<!\p{L})\p{L}(?: \p{L})+(?!\p{L})/gu;
const SPACED_LETTER_EMPHASIS = /(?<!\p{L})\p{L}(?: \p{L}){3,}(?!\p{L})/u;
const OFFICE_SMALL_WORDS = new Set([
  'der', 'die', 'das', 'des', 'dem', 'den', 'und', 'oder', 'für', 'im', 'in', 'am', 'an',
  'auf', 'bei', 'mit', 'von', 'vom', 'zu', 'zur', 'zum', 'als', 'beim',
]);
const PAGE_FURNITURE_PATTERN = /^(?:Seite\s*\d*|(?:OABl|OGVBl|StAnzO|OVertrBl|GMBl)\.\s*(?:Nr\.\s*\d+\s+)?\d{1,2}\.\s*\p{L}+\s+\d{4}(?:\s+Seite\s*\d*)?)$/u;
const CONTAMINATION_PATTERN = /data:image|;base64,|@font-face|@import\s+url|<style|Inhaltsverzeichnis|Nichtamtliches Inhaltsverzeichnis/iu;
const QUOTE_TRIGGER_PATTERN = /(?:(?:wird|werden)\s+(?:wie folgt|durch folgende|durch die nachstehende)\s+(?:neu\s*)?(?:gefasst|eingefügt)|(?:wird|werden)\s+[^:]*?(?:eingefügt|angefügt|vorangestellt|(?:neu\s*)?gefasst)|(?:wird|werden)\s+[^:]*?durch\s+(?:die\s+|den\s+)?(?:folgende|nachstehende)[nrs]?\s+(?:Fassung|Anlage|Satz|Sätze|Wortlaut|Lernbereich|Abschnitt|Absatz|Absätze|Nummer|Nummern|Buchstabe|Buchstaben)\s+(?:ersetzt|abgelöst)|(?:erhält|erhalten)\s+folgende\s+(?:Bezeichnung|Fassung)|(?:wird|werden)\s+wie\s+folgt\s+ersetzt|(?:wird|werden)\s+ersetzt\s+durch)\s*:\s*$/iu;
const AMENDMENT_REFERENCE_PATTERN = /\b(?:wird|werden)\b[^:]*\b(?:geändert|aufgehoben|ersetzt|gefasst|eingefügt|angefügt|verschoben|umbenannt)\b\s*:?\s*$/iu;
const INTRODUCTION_PATTERN = /^(?:Das\s+nachstehende\s+wird\s+(Gesetz|Verordnung):|.+?wird\s+durch\s+die\s+nachstehende\s+(.+?)\s+abgelöst:)$/iu;
const OPENING_QUOTE_PATTERN = /^(?:„|“|‚|‘|,,|")/u;
// Ein Text, der auf Artikel, Hilfsverb oder Präposition endet, setzt sich im nächsten Absatz fort.
const OPEN_SENTENCE_END_PATTERN = /\b(?:der|die|das|den|dem|des|ein|eine|einer|einem|einen|ist|sind|bei|durch|für|mit|nach|von|vor|zu|zur|zum)\s*$/iu;
const CLOSING_QUOTE_PATTERN = /(?:“|”|’|''|")\s*$/u;
const SOURCE_HEADING_START_PATTERN = /^(?:(?:Erst|Zweit|Dritt|Viert|Fünft|Sechst|Siebt|Acht|Neunt|Zehnt|Elft|Zwölft|Dreizehnt|Vierzehnt|Fünfzehnt|Sechzehnt|Siebzehnt|Achtzehnt|Neunzehnt|Zwanzigst)(?:e|er|es)|Besonderes|Gemeinsame|Gemeinsamer|Gemeinsames)?\s*(?:Gesetz|Verordnung|Änderungsgesetz|Rechtsverordnung|Satzung|Förderrichtlinie|Richtlinie|Verwaltungsvorschrift|Allgemeinverfügung|Anordnung|Bekanntmachung|Berichtigung|Organisationserlass|Erlass|Verwaltungsabkommen|Staatsvertrag|Abkommen|Übereinkommen|Vertrag)/iu;
const OUTER_ARTICLE_TITLE_PATTERN = /^(?:Einführung|Änderung|Folgeänderungen?|Neufassung|Übergangsbestimmungen?|Übergangsrecht|Berichtspflicht|Einschränkung|Inkrafttreten|Außerkrafttreten|Bekanntmachung|Anpassung|Bereinigung|Rechtsbereinigung)/iu;
const EMBEDDED_NORM_TITLE_PATTERN = /^(?:(?:Besonderes|Gemeinsames)\s+)?(?:Gesetz|Verordnung|Satzung|Staatsvertrag|Abkommen|Übereinkommen)\b/iu;
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

export function normalizeHtmlText(value, { joinHyphenation = true } = {}) {
  // Gesperrter Satz wird vor der Vereinheitlichung der Leerzeichen aufgelöst, solange die
  // Wortgrenzen (geschützte Leerzeichen) der Quelle noch erkennbar sind.
  const normalized = collapseSpacedLetters(String(value ?? '').replace(/\r\n?/gu, '\n'))
    .replace(/[\u00a0\u202f]/gu, ' ')
    .replace(/[\u200b\u200c\u200d\u2060\ufeff]/gu, '')
    .replace(/[\t\f\v ]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n');
  return (joinHyphenation ? normalized.replace(LINE_END_HYPHENATION, joinLineEndHyphenation) : normalized).trim();
}

// Silbentrennung am Zeilenende: „Kindertages-<br>betreuungsgesetzes“ ist ein Wort. Verbunden wird
// nur vor einem Kleinbuchstaben oder innerhalb eines Worts in Versalschreibung; Ergänzungsstriche
// vor einer Konjunktion („Daten-<br>und“) und gewöhnliche Bindestrichwörter bleiben erhalten.
const LINE_END_HYPHENATION = /(\p{L}+)-\n(\p{L}+)/gu;
const HYPHENATION_KEEP_WORDS = new Set(['und', 'oder', 'sowie', 'bzw', 'beziehungsweise', 'als', 'bis']);

function joinLineEndHyphenation(match, before, after) {
  if (HYPHENATION_KEEP_WORDS.has(after.toLocaleLowerCase('de'))) return match;
  const lowerContinuation = /^\p{Ll}/u.test(after) && /\p{Ll}$/u.test(before);
  const capitalWord = before.length >= 4 && /^\p{Lu}+$/u.test(before) && /^\p{Lu}+$/u.test(after);
  return lowerContinuation || capitalWord ? `${before}${after}` : match;
}

/**
 * Markiert Wortgrenzen innerhalb gesperrt gesetzter Zeilen: geschützte und doppelte
 * Leerzeichen trennen die Wörter, einfache Leerzeichen trennen die Buchstaben eines Wortes.
 */
function markSpacedWordGaps(line) {
  return String(line ?? '')
    .replace(/[\u00a0\u202f]/gu, SPACED_WORD_GAP)
    .replace(/[\t\f\v]+/gu, ' ')
    .replace(/ {2,}/gu, SPACED_WORD_GAP);
}

/** Enthält der Wert einen gesperrt gesetzten Wortteil (mindestens vier einzelne Buchstaben)? */
export function hasSpacedLetters(value) {
  return String(value ?? '').split('\n').some((line) => SPACED_LETTER_EMPHASIS.test(markSpacedWordGaps(line)));
}

/**
 * Löst gesperrten Satz zeilenweise in gewöhnliche Wörter auf („s o l l“ → „soll“,
 * „D e r  M I N I S T E R“ → „Der MINISTER“). Zeilen ohne gesperrten Satz bleiben
 * unverändert; es gibt kein Auszeichnungsmodell für Hervorhebungen im Normkörper.
 */
export function collapseSpacedLetters(value) {
  return String(value ?? '').split('\n').map((line) => {
    const marked = markSpacedWordGaps(line);
    if (!SPACED_LETTER_EMPHASIS.test(marked)) return line;
    return marked
      .split(SPACED_WORD_GAP)
      .map((segment) => (isSpacedWordSegment(segment)
        ? segment.trim().replaceAll(' ', '')
        : segment.replace(SPACED_LETTER_RUN, (run) => run.replaceAll(' ', ''))))
      .join(' ')
      .replace(/(\p{L}) ([:,;.!?])/gu, '$1$2')
      .replace(/ {2,}/gu, ' ')
      .trim();
  }).join('\n');
}

/**
 * Ein durch Wortgrenzen abgetrennter Abschnitt, der nur aus einzeln gesetzten Buchstaben
 * eines Wortes besteht. Kleine Setzfehler der Quelle („U ND“ statt „U N D“) bleiben Teil
 * desselben Wortes; längere Bestandteile sind gewöhnlicher Text und bleiben getrennt.
 */
function isSpacedWordSegment(segment) {
  const tokens = segment.trim().replace(/[.,;:!?]+$/u, '').split(' ').filter(Boolean);
  return tokens.length > 1 &&
    tokens.every((token) => /^\p{L}+$/u.test(token) && [...token].length <= 3) &&
    tokens.some((token) => [...token].length === 1);
}

/** Amtsbezeichnung aus gesperrter Versalschreibung in Normalschreibung überführen. */
export function normalizeOfficeTitle(value) {
  return collapseSpacedLetters(value)
    .replace(/\s+/gu, ' ')
    .trim()
    .split(' ')
    .map((word, index) => {
      const core = word.replace(/[^\p{L}]/gu, '').toLocaleLowerCase('de');
      if (index > 0 && OFFICE_SMALL_WORDS.has(core)) return word.toLocaleLowerCase('de');
      return `${word.slice(0, 1).toLocaleUpperCase('de')}${word.slice(1).toLocaleLowerCase('de')}`;
    })
    .join(' ')
    .replace(/\s+([,;.])/gu, '$1')
    // Zusammengesetzte Eigennamen stehen in gesperrter Versalschreibung mit Gedankenstrich
    // („N I E D E R S A C H S E N – H O L S T E I N“); in Normalschreibung ist es ein Bindestrich.
    .replace(/(\p{L})\s*[–—]\s*(\p{L})/gu, '$1-$2')
    .trim()
    .replace(/\bfür\b.*$/u, (department) => lowercaseDepartmentAdjectives(department));
}

// In der Ressortbezeichnung hinter „für“ sind Adjektive klein zu schreiben („für Bildung und
// sportliche Ertüchtigung“, „für die bewaffneten Organe“). Erkannt werden nur eindeutige
// Adjektivendungen vor einem großgeschriebenen Wort oder einer Konjunktion.
const DEPARTMENT_ADJECTIVE = /^\p{Lu}\p{Ll}*(?:lich|isch|al|ig|et)e[nmrs]?$/u;

function lowercaseDepartmentAdjectives(department) {
  const words = department.split(' ');
  return words.map((word, index) => {
    const next = words[index + 1] ?? '';
    const core = word.replace(/[,;.]$/u, '');
    if (index === 0 || core !== word || !DEPARTMENT_ADJECTIVE.test(core)) return word;
    return /^(?:\p{Lu}|und\b|oder\b)/u.test(next) ? word.toLocaleLowerCase('de') : word;
  }).join(' ');
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

/** Zeilen eines Knotens mit erhaltenen Wortgrenzen des gesperrten Satzes. */
function spacedLinesOf(node) {
  return String(textWithBreaks(node))
    .replace(/\r\n?/gu, '\n')
    .replace(/[\u200b\u200c\u200d\u2060\ufeff]/gu, '')
    .split('\n')
    .map((line) => line.replace(/[\t\f\v]+/gu, ' ').trim())
    .filter(Boolean);
}

/** Amtsbezeichnung des Unterschriftenblocks („D e r  M I N I S T E R P R Ä S I D E N T“). */
function isSpacedOfficeLine(line) {
  return hasSpacedLetters(line) && /^(?:Der|Die|Das)\s+\p{Lu}{2,}/u.test(collapseSpacedLetters(line));
}

/** Fortsetzungszeile einer umbrochenen Amtsbezeichnung („B A U  U N D  F Ü R  K O M M U N A L E S“). */
function isSpacedOfficeContinuation(line) {
  if (!hasSpacedLetters(line)) return false;
  const collapsed = collapseSpacedLetters(line);
  return /^[\p{Lu}\p{N}\s.,;:()–—-]+$/u.test(collapsed) && /\p{Lu}{2,}/u.test(collapsed);
}

function isPageFurniture(text) {
  return PAGE_FURNITURE_PATTERN.test(String(text ?? '').trim());
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
    // Mehrstufige Gliederungszeichen („2.1.“) nennen die Zähler übergeordneter Ebenen vor dem
    // eigenen Zähler; maßgeblich für Stil und Zählung ist der Zähler der eigenen Ebene.
    const counters = [...content.matchAll(/counter\(\s*lst-ctn-kix_([a-z0-9_]+)-(\d+)\s*,\s*([a-z-]+)\s*\)|counter\([^,]+,\s*([a-z-]+)\s*\)/giu)];
    const own = counters.find((entry) => entry[1] === match[1] && entry[2] === match[2]) ?? counters.at(-1);
    const counterIndex = own?.index ?? -1;
    const before = counterIndex >= 0 ? content.slice(0, counterIndex) : content;
    const after = counterIndex >= 0 ? content.slice(counterIndex + own[0].length) : '';
    const parentCounters = counters.filter((entry) => entry !== own && entry.index < counterIndex && entry[1] === match[1]);
    listStyles.set(`${match[1]}:${match[2]}`, {
      numberingStyle: (own?.[3] ?? own?.[4])?.toLocaleLowerCase('en') ?? 'literal',
      prefix: own ? quotedCssText(before) : '',
      suffix: own ? quotedCssText(after).trimEnd() : '',
      literal: own ? undefined : quotedCssText(content).trim(),
      ...(parentCounters.length > 0 ? {
        prefixParts: parentCounters.map((entry, index) => ({
          level: Number.parseInt(entry[2], 10),
          numberingStyle: entry[3].toLocaleLowerCase('en'),
          text: quotedCssText(content.slice(entry.index + entry[0].length, counters[counters.indexOf(entry) + 1]?.index ?? counterIndex)),
          leading: index === 0 ? quotedCssText(content.slice(0, entry.index)) : '',
        })),
      } : {}),
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
  return `${match[3]}-${GERMAN_MONTHS[match[2].toLocaleLowerCase('de')]}-${match[1].padStart(2, '0')}`;
}

export function addUtcDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function firstDayOfNextMonth(isoDate) {
  const [year, month] = isoDate.split('-').map(Number);
  return `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`;
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

/**
 * Gliederungszeichen einer Zeile. Die exportierte Fassung behält die Erkennung, auf der die
 * REVOSax-Snapshots beruhen; eigene HTML-Ausgaben verwenden die erweiterte Erkennung
 * (Silbentrennung, Ordnungswörter, Buchstabenabschnitte, nummerierte Anhänge).
 */
export function parseStructureMarker(value) {
  return structureMarker(value, false);
}

function parseHtmlStructureMarker(value) {
  return structureMarker(value, true);
}

function structureMarker(value, extended) {
  const original = normalizeHtmlText(value, { joinHyphenation: extended });
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
  // „Sechster Abschnitt<br>Hinweisgeberstellen“: Ordnungswort und Gliederungsart bilden die
  // Bezeichnung, wenn die Überschrift in eigener Zeile folgt oder ganz fehlt.
  const ordinalLines = original.replace(/^[„“”'`,.]+/u, '').trim().split('\n');
  match = !extended ? null : ordinalLines[0].match(/^((?:Erst|Zweit|Dritt|Viert|Fünft|Sechst|Siebt|Acht|Neunt|Zehnt|Elft|Zwölft)er\s+(Teil|Kapitel|Abschnitt|Unterabschnitt))$/u);
  if (match) {
    const type = { teil: 'part', kapitel: 'chapter', abschnitt: 'section', unterabschnitt: 'subsection' }[match[2].toLocaleLowerCase('de')];
    const title = ordinalLines.slice(1).join(' ').trim();
    return { type, label: match[1], title: title || undefined };
  }
  match = text.match(/^([IVXLCDM]+\.\s*Abschnitt)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'section', label: match[1], title: match[2] || undefined };
  // Einzelbuchstaben „C.“, „D.“, „L.“, „M.“ gliedern als Buchstaben („A. … B. … C. …“), nicht als
  // römische Zahlen.
  match = text.match(extended ? /^((?![CDLM]\.)[IVXLCDM]+\.)(?:\s|\n)*(.*)$/u : /^([IVXLCDM]+\.)(?:\s|\n)*(.*)$/u);
  if (match) return { type: 'section', label: match[1], title: match[2] || undefined };
  match = text.match(/^(Präambel)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'section', label: 'Präambel', title: match[2] || undefined };
  match = text.match(/^(Artikel\s+\d+[a-z]?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'article', label: match[1], title: match[2] || undefined };
  match = text.match(/^(Article\s+\d+[a-z]?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'article', label: match[1], title: match[2] || undefined };
  match = text.match(/^(§{1,2}\s*\d+[a-z]?(?:\s*(?:,|und)\s*\d+[a-z]?)?(?:\s+bis\s+\d+[a-z]?)?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'paragraph', label: match[1], title: match[2] || undefined };
  // „Anlage 2“, „ANLAGE IV“, „Anhang 3“; „Anlagen:“ ist kein Anlagenkopf.
  match = extended
    ? text.match(/^((?:Anlage|ANLAGE)\s+[IVXLCDM]+(?![\p{L}\d])|(?:Anlage|Anhang)(?:\s+\d+[a-z]?)?(?![\p{L}\d]))((?:\s*\([^)]*\))?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu)
    : text.match(/^((?:Anlage(?:\s+\d+[a-z]?)?|Anhang))((?:\s*\([^)]*\))?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'annex', label: `${match[1]}${match[2]}`.trim(), title: match[3] || undefined };
  match = text.match(/^((?:Annex|Appendix)\s+(?:\d+[a-z]?|[IVXLCDM]+))\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'annex', label: match[1], title: match[2] || undefined };
  match = text.match(/^(Regulation\s+\d+[a-z]?)\s*(?:[–—:-]|\n)?\s*(.*)$/iu);
  if (match) return { type: 'section', label: match[1], title: match[2] || undefined };
  return null;
}

function parsePrintedListItem(value) {
  const normalized = normalizeHtmlText(value);
  // Das öffnende Anführungszeichen eines zitierten Punkts („„e) …“) steht vor dem
  // Gliederungszeichen und bleibt dort erhalten.
  const openingQuote = normalized.match(/^(?:„|“|,,|")/u)?.[0] ?? '';
  const text = normalized.replace(/^[„“”'`,]+/u, '').trim();
  // Eine einfache Zahl ohne Punkt („70 Kilowattstunden …“) ist eine Mengenangabe, keine Nummer;
  // mehrstufige Ziffern („4.1 …“) dürfen ohne Schlusspunkt stehen.
  let match = text.match(/^(\d+(?:\.\d+)+\.?|\d+\.)\s+(.*)$/u);
  if (match) {
    const segments = match[1].replace(/\.$/u, '').split('.');
    return {
      label: `${openingQuote}${match[1]}`,
      text: match[2],
      level: Math.max(0, segments.length - 1),
      numberingStyle: 'decimal',
      ...(openingQuote ? { opensQuote: true } : {}),
    };
  }
  match = text.match(/^([a-z]{1,2})\)\s+(.*)$/iu);
  if (match) {
    return {
      label: `${openingQuote}${match[1]})`,
      text: match[2],
      level: match[1].length > 1 ? 1 : 0,
      numberingStyle: 'lower-latin',
      ...(openingQuote ? { opensQuote: true } : {}),
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

function cellShading(cell, css) {
  const color = String(nodeStyle(cell, css)['background-color'] ?? '').trim().toLocaleLowerCase('en');
  return color && !['#ffffff', '#fff', 'white', 'transparent', 'inherit', 'initial'].includes(color) ? color : null;
}

// Tabellenzellen, deren einziger Inhalt eine Abbildung ohne Textalternative ist.
const IMAGE_ONLY_CELLS = new WeakSet();

function tableBlock(node, css, fileName, allRowEntries = directRowEntries(node)) {
  const rowEntries = allRowEntries;
  const firstContentRow = rowEntries.findIndex(({ node: row }) => elementChildren(row).some((cell) => textOf(cell)));
  // Eine farbig hinterlegte erste Zeile über ungefärbten Zeilen ist die Kopfzeile.
  const rowShading = (row) => {
    const cells = elementChildren(row).filter((cell) => cell.tagName === 'td' || cell.tagName === 'th');
    const colors = cells.map((cell) => cellShading(cell, css));
    return cells.length > 1 && colors.every(Boolean) && new Set(colors).size === 1 ? colors[0] : null;
  };
  const shadedHeader = firstContentRow >= 0 && rowShading(rowEntries[firstContentRow].node) &&
    rowShading(rowEntries[firstContentRow].node) !== rowShading(rowEntries[firstContentRow + 1]?.node ?? { childNodes: [] });
  const children = rowEntries.map(({ node: row, section }, rowIndex) => {
    const cells = elementChildren(row).filter((cell) => cell.tagName === 'td' || cell.tagName === 'th');
    const rowIsHeader = cells.length > 0 && (cells.every((cell) => cell.tagName === 'th' || isBold(cell, css)) ||
      (shadedHeader && rowIndex === firstContentRow));
    return {
      type: 'tableRow',
      children: cells.map((cell, cellIndex) => {
        const paragraphs = descendants(cell, (entry) => entry.tagName === 'p').map(textOf).filter(Boolean);
        let cellText = paragraphs.length > 0 ? paragraphs.join('\n') : textOf(cell);
        // Eine Zelle, die nur aus einer Abbildung besteht, übernimmt deren Textalternative; ohne
        // Textalternative wird sie als Quellbefund gemeldet (validateBody), nicht still leer gespeichert.
        const images = cellText ? [] : descendants(cell, (entry) => entry.tagName === 'img');
        const imageAlternative = images.map((image) => normalizeHtmlText(attrs(image).alt ?? '')).filter(Boolean).join('\n');
        if (imageAlternative) cellText = imageAlternative;
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
        const cellBlock = {
          type: header ? 'tableHeaderCell' : 'tableCell',
          text: cellText,
          ...(scope ? { scope } : {}),
          ...(rowspan > 1 ? { rowspan } : {}),
          ...(colspan > 1 ? { colspan } : {}),
          ...(paragraphs.length > 1 ? { children: paragraphs.map((text) => ({ type: 'paragraphText', text })) } : {}),
        };
        if (images.length > 0 && !imageAlternative) IMAGE_ONLY_CELLS.add(cellBlock);
        return cellBlock;
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

// Gedruckte Buchstaben „a.“, „b.“ … als einfache Absätze unter einer Nummer, deren Text mit
// einem Doppelpunkt endet: Sie bilden die Unterpunkte dieser Nummer. Erkannt wird nur die
// lückenlose Folge ab „a.“ unmittelbar nach der Nummer; sonst bleibt der Absatz Fließtext.
function printedLetterItem(text, previousToken, indent = 0) {
  const match = normalizeHtmlText(text).match(/^([a-z])\.\s+(.+)$/u);
  const underSubparagraph = previousToken?.kind === 'paragraph' && /^\(\d+[a-z]?\)\s/u.test(previousToken.text ?? '') &&
    indent > (previousToken.indent ?? 0) + 0.5;
  if (!match || (previousToken?.kind !== 'listItem' && !underSubparagraph)) return null;
  const letter = match[1];
  const opensPrintedSublist = letter === 'a' && (underSubparagraph || (previousToken.numberingStyle === 'decimal' &&
    /:\s*$/u.test(previousToken.text ?? '')));
  const continuesPrintedSublist = previousToken.printedLetter &&
    letter.charCodeAt(0) === previousToken.printedLetter.charCodeAt(0) + 1;
  if (!opensPrintedSublist && !continuesPrintedSublist) return null;
  return {
    label: `${letter}.`,
    text: match[2],
    level: 1,
    numberingStyle: 'lower-latin',
    printedLetter: letter,
    opensPrintedSublist,
  };
}

const PRINTED_LETTER_LINE = /^([a-z]{1,2})([.)])\s+(\S.*)$/u;

// Zerlegt einen mit <br> umbrochenen Absatz oder Listenpunkt an Zeilen, die mit einem
// gedruckten Buchstabenzeichen („a)“, „aa)“, „a.“) beginnen. Erkannt werden nur lückenlose
// Folgen ab „a“ bzw. „aa“; Zeilen mit öffnendem Anführungszeichen nach einem Doppelpunkt
// bleiben eigene Absätze (zitierter Wortlaut), alle anderen Zeilen setzen den Vorsatz fort.
function splitPrintedLetterLines(rawText) {
  const lines = String(rawText ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const segments = [];
  const runs = new Map();
  for (const line of lines) {
    const match = OPENING_QUOTE_PATTERN.test(line) ? null : line.match(PRINTED_LETTER_LINE);
    const letters = match?.[1];
    const double = letters?.length === 2;
    const value = !letters ? null : double ? (letters[0] === letters[1] ? letters.charCodeAt(0) - 96 : null) : letters.charCodeAt(0) - 96;
    const kind = letters ? `${double ? 2 : 1}${match[2]}` : null;
    if (value && (value === 1 || runs.get(kind) === value - 1)) {
      runs.set(kind, value);
      segments.push({ label: true, letters, punctuation: match[2], value, double, lines: [match[3]] });
    } else if (segments.length > 0 && OPENING_QUOTE_PATTERN.test(line) && QUOTE_TRIGGER_PATTERN.test(segments.at(-1).lines.at(-1))) {
      segments.push({ label: false, quote: true, lines: [line] });
    } else if (segments.length === 0) {
      segments.push({ label: false, lines: [line] });
    } else {
      segments.at(-1).lines.push(line);
    }
  }
  const labelCount = segments.filter((segment) => segment.label).length;
  if (labelCount === 0 || (segments[0].label && labelCount < 2)) return null;
  return segments;
}

// „Artikel 1 wird wie folgt gefasst:<br>„Artikel 1<br>Verfassungsgrundsätze“ – setzt ein
// Listenpunkt den zitierten Wortlaut nach dem ersten Zeilenumbruch hinter den Änderungsbefehl,
// beginnt dort die zitierte Neufassung. Der Befehl bleibt der Text des Listenpunkts.
function splitQuotedLinesAfterCommand(rawText) {
  const lines = String(rawText ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2 || !QUOTE_TRIGGER_PATTERN.test(lines[0]) || !OPENING_QUOTE_PATTERN.test(lines[1])) return null;
  return { command: lines[0], lines: lines.slice(1) };
}

// Zeilen eines im Listenpunkt umbrochenen Zitats: Eine allein stehende Gliederungsbezeichnung
// bildet mit der folgenden Zeile ihre Überschrift, jede andere Zeile ist ein eigener Absatz.
function quotedLineTokens(lines, indent) {
  const output = [];
  for (let index = 0; index < lines.length; index += 1) {
    const marker = parseHtmlStructureMarker(lines[index]);
    if (marker && !marker.title && index + 1 < lines.length) {
      const rawText = `${lines[index]}\n${lines[index + 1]}`;
      output.push({
        kind: 'structure', marker: parseHtmlStructureMarker(rawText), text: rawText.replace(/\n/gu, ' '), rawText,
        tagName: 'p', bold: false, centered: false, opensQuote: OPENING_QUOTE_PATTERN.test(rawText),
      });
      index += 1;
      continue;
    }
    output.push({ kind: 'paragraph', text: lines[index], rawText: lines[index], tagName: 'p', bold: false, centered: false, indent });
  }
  return output;
}

function makeAtomicTokens(nodes, css, fileName) {
  const counters = new Map();
  // Untergeordnete Listenebenen, die ein Punkt der übergeordneten Ebene beendet hat, und die Zahl
  // der je Ebene ungebrochen weitergezählten Punkte (Zählung des Google-Docs-Exports).
  const restartedLevels = new Set();
  const exportCounts = new Map();
  const tokens = [];
  let standardListSequence = 0;
  let lastStandardList = null;
  let romanRun = null;
  const letterRunLevels = new Map();

  // Ebene eines gedruckten Buchstabenpunkts innerhalb der gedruckten Gliederung: „a)“ nach
  // einer gedruckten Nummer liegt eine Ebene tiefer, Folgebuchstaben bleiben auf dieser Ebene.
  const printedLetterLevel = (double, value, fallback, indent = null) => {
    const kind = double ? 2 : 1;
    const previous = tokens.at(-1);
    if (value === 1) {
      let level = fallback;
      // Ein eigener Absatz „a) …“ wird nur bei sichtbar tieferem Einzug untergeordnet; bei
      // <br>-Zerlegung (indent === null) trägt der gemeinsame Absatz die Zugehörigkeit.
      const visiblyDeeper = indent === null || indent > (previous?.indent ?? 0) + 0.5;
      if (visiblyDeeper && previous?.kind === 'listItem' && previous.listId === 'printed-outline') {
        if (!double && previous.numberingStyle === 'decimal') level = previous.level + 1;
        if (double && previous.numberingStyle === 'lower-latin' && previous.printedLetterKind === 1) level = previous.level + 1;
      }
      letterRunLevels.set(kind, { level, index: tokens.length });
      return level;
    }
    const run = letterRunLevels.get(kind);
    if (!run || tokens.slice(run.index).some((entry) => entry.kind !== 'listItem')) return fallback;
    return run.level;
  };

  const printedLetterToken = (segment, indent) => {
    const level = printedLetterLevel(segment.double, segment.value, segment.double ? 1 : 0);
    return {
      kind: 'listItem',
      listId: 'printed-outline',
      label: `${segment.letters}${segment.punctuation}`,
      text: segment.lines.join(' '),
      level,
      numberingStyle: 'lower-latin',
      counterValue: segment.value,
      numberingPrefix: '',
      numberingSuffix: segment.punctuation,
      printedLetterKind: segment.double ? 2 : 1,
      startsList: segment.value === 1,
      indent,
    };
  };

  const emitPrintedSegments = (segments, baseIndent, { skipFirst = false } = {}) => {
    const labelIndent = segments[0].label ? baseIndent : baseIndent + 36;
    for (const [index, segment] of segments.entries()) {
      if (index === 0 && skipFirst) continue;
      const text = segment.lines.join(' ');
      if (segment.label) {
        tokens.push(printedLetterToken(segment, labelIndent));
      } else if (index === 0) {
        const printed = parsePrintedListItem(text);
        tokens.push(printed
          ? { kind: 'listItem', listId: 'printed-outline', ...printed, startsList: printed.level === 0, indent: baseIndent }
          : { kind: 'paragraph', text, rawText: text, tagName: 'p', bold: false, centered: false, indent: baseIndent });
      } else {
        tokens.push({ kind: 'paragraph', text, rawText: text, tagName: 'p', bold: false, centered: false, indent: labelIndent });
      }
    }
  };

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
        numberingPrefix: parenthesized ? '(' : nodeAttrs['data-label-prefix'] ?? '',
        numberingSuffix: parenthesized ? ')' : numberingStyle === 'bullet' ? '' : nodeAttrs['data-label-suffix'] ?? '.',
        label: parenthesized
          ? `(${visible})`
          : numberingStyle === 'bullet'
            ? visible
            : `${nodeAttrs['data-label-prefix'] ?? ''}${visible}${nodeAttrs['data-label-suffix'] ?? '.'}`,
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
      // Beschriftung über und Hinweise unter einer Tabelle, die als eine einzige Zelle über alle
      // Spalten gesetzt sind, sind Absätze vor beziehungsweise nach der Tabelle.
      const entries = directRowEntries(node);
      const width = Math.max(0, ...entries.map(({ node: row }) => elementChildren(row)
        .filter((cell) => cell.tagName === 'td' || cell.tagName === 'th')
        .reduce((sum, cell) => sum + parsePositiveSpan(attrs(cell).colspan), 0)));
      const spanning = (entry) => {
        const cells = elementChildren(entry.node).filter((cell) => cell.tagName === 'td' || cell.tagName === 'th');
        return width > 2 && cells.length === 1 && parsePositiveSpan(attrs(cells[0]).colspan) === width &&
          parsePositiveSpan(attrs(cells[0]).rowspan) === 1 && Boolean(textOf(cells[0]));
      };
      let first = 0;
      let last = entries.length;
      while (first < last - 2 && spanning(entries[first])) first += 1;
      while (last > first + 2 && spanning(entries[last - 1])) last -= 1;
      const captionToken = (entry) => {
        const cellText = textOf(entry.node);
        return { kind: 'paragraph', text: cellText, rawText: cellText, tagName: 'p', bold: false, centered: false, indent: 0 };
      };
      tokens.push(...entries.slice(0, first).map(captionToken));
      tokens.push({ kind: 'table', block: tableBlock(node, css, fileName, entries.slice(first, last)), text });
      tokens.push(...entries.slice(last).map(captionToken));
      continue;
    }
    if (node.tagName === 'ol' || node.tagName === 'ul') {
      const classes = attrs(node).class ?? '';
      const listMatch = classes.match(LIST_CLASS_PATTERN);
      if (!listMatch) {
        // Eine Standardliste mit Startwert, der die unmittelbar vorangehende gleichartige Liste
        // fortsetzt („<ol start="2">“ nach einem Zitat), bleibt dieselbe Liste.
        const start = Number.parseInt(attrs(node).start ?? '1', 10);
        const previousList = lastStandardList;
        const continues = previousList && start > 1 && previousList.type === (attrs(node).type ?? '1') &&
          previousList.lastValue === start - 1 && node.tagName === 'ol';
        if (!continues) standardListSequence += 1;
        emitStandardList(node, `standard-${standardListSequence}`);
        lastStandardList = {
          type: attrs(node).type ?? '1',
          lastValue: start + elementChildren(node, 'li').length - 1,
        };
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
      // Google Docs beginnt eine untergeordnete Ebene nach einem Punkt der übergeordneten Ebene
      // derselben Liste sichtbar neu („a)“), exportiert aber als start die ungebrochen
      // weitergezählte Nummer („start="3"“). Nur genau diese Fortzählung wird als Neubeginn gelesen.
      const restartedAfterParent = level > 0 && Number.isInteger(explicitStart) && explicitStart > 1 &&
        restartedLevels.has(key) && (exportCounts.get(key) ?? 0) + 1 === explicitStart;
      let counter = restartedAfterParent
        ? 1
        : Number.isInteger(explicitStart)
          ? explicitStart
          : hasStartClass
            ? (css.resets.get(key) ?? 0) + 1
            : (counters.get(key) ?? 0) + 1;
      // Ein ausdrücklicher Startwert über 1 steht für die gedruckte Nummer der Quelle.
      const explicitCounter = Number.isInteger(explicitStart) && explicitStart > 1 && !restartedAfterParent;
      restartedLevels.delete(key);
      const items = elementChildren(node, 'li');
      exportCounts.set(key, (restartedAfterParent || !Number.isInteger(explicitStart)
        ? (hasStartClass && !Number.isInteger(explicitStart) ? 0 : exportCounts.get(key) ?? 0)
        : explicitStart - 1) + items.length);
      if (items.length === 0) throw new NormHtmlParseError(fileName, `leere Liste ${listId}, Ebene ${level}`);
      // Präfix mehrstufiger Gliederungszeichen aus den aktuellen Zählern der übergeordneten Ebenen.
      const prefix = style.prefixParts
        ? style.prefixParts.map((part) => {
          const parentValue = counters.get(`${listId}:${part.level}`);
          const parentVisible = Number.isInteger(parentValue) ? formatCounter(parentValue, part.numberingStyle) : null;
          if (!parentVisible) throw new NormHtmlParseError(fileName, `übergeordneter Listenzähler ${listId}, Ebene ${part.level} fehlt`);
          return `${part.leading}${parentVisible}${part.text}`;
        }).join('')
        : style.prefix;
      for (const item of items) {
        const visible = style.literal ?? formatCounter(counter, style.numberingStyle);
        if (!visible) throw new NormHtmlParseError(fileName, `nicht auflösbarer Listenzähler ${listId}, Ebene ${level} (${style.numberingStyle})`);
        tokens.push({
          kind: 'listItem',
          listId,
          level,
          numberingStyle: style.numberingStyle,
          counterValue: counter,
          numberingPrefix: prefix,
          numberingSuffix: style.suffix,
          label: `${prefix}${visible}${style.suffix}`.trim(),
          text: textOf(item),
          startsList: hasStartClass,
          indent: visualIndent(item, css, level * 36),
          ...(explicitCounter ? { explicitCounter: true } : {}),
        });
        const itemSegments = splitPrintedLetterLines(normalizeHtmlText(textWithBreaks(item)));
        if (itemSegments && !itemSegments[0].label) {
          tokens.at(-1).text = itemSegments[0].lines.join(' ');
          emitPrintedSegments(itemSegments, tokens.at(-1).indent, { skipFirst: true });
        } else if (!itemSegments) {
          const quoted = splitQuotedLinesAfterCommand(normalizeHtmlText(textWithBreaks(item)));
          if (quoted) {
            tokens.at(-1).text = quoted.command;
            tokens.push(...quotedLineTokens(quoted.lines, tokens.at(-1).indent + 36));
          }
        }
        counter += 1;
      }
      counters.set(key, counter - 1);
      for (const counterKey of [...counters.keys()]) {
        const [otherId, otherLevel] = counterKey.split(':');
        if (otherId === listId && Number.parseInt(otherLevel, 10) > level) {
          restartedLevels.add(counterKey);
          counters.delete(counterKey);
        }
      }
      continue;
    }
    if (!['ol', 'ul', 'table'].includes(node.tagName) && isPageFurniture(text)) continue;
    // Unterschriftenblock: Name, darunter die gesperrt gesetzte Amtsbezeichnung; die
    // Amtsbezeichnung kann in eine weitere Zeile oder einen weiteren Absatz umbrechen.
    if (!['ol', 'ul', 'table'].includes(node.tagName)) {
      const lines = spacedLinesOf(node).filter((line) => !isPageFurniture(line));
      const officeIndex = lines.findIndex(isSpacedOfficeLine);
      const previousToken = tokens.at(-1);
      if (officeIndex >= 0) {
        tokens.push({
          kind: 'signature',
          name: collapseSpacedLetters(lines.slice(0, officeIndex).join('\n')).replace(/\s+/gu, ' ').trim(),
          officeParts: lines.slice(officeIndex),
          text,
        });
        continue;
      }
      if (previousToken?.kind === 'signature' && lines.length > 0 && lines.every(isSpacedOfficeContinuation)) {
        previousToken.officeParts.push(...lines);
        continue;
      }
    }
    const rawText = normalizeHtmlText(textWithBreaks(node));
    const numberedHeading = /^h[1-6]$/u.test(node.tagName)
      ? rawText.match(/^(\d+)\.\s+(.+)$/u)
      : null;
    const nodeAttrs = attrs(node);
    const explicitStructureType = STRUCTURE_RANK[nodeAttrs['data-structure-type']];
    const explicitMarker = explicitStructureType && nodeAttrs['data-structure-label']
      ? {
        type: nodeAttrs['data-structure-type'],
        label: nodeAttrs['data-structure-label'],
        ...(nodeAttrs['data-structure-title'] ? { title: nodeAttrs['data-structure-title'] } : {}),
      }
      : null;
    const parsedMarker = numberedHeading
      ? { type: 'section', label: `${numberedHeading[1]}.`, title: numberedHeading[2] }
      : explicitMarker ?? parseHtmlStructureMarker(rawText);
    const leadSentence = !explicitMarker && !numberedHeading ? romanSectionLeadSentence(parsedMarker) : null;
    const marker = leadSentence ? { type: parsedMarker.type, label: parsedMarker.label } : parsedMarker;
    // „§ 5 gilt entsprechend.“ oder „Artikel 95a der Staatsverfassung bleibt unberührt.“ ist ein
    // Satz, der mit einer Verweisung beginnt; ein Artikel nur dann, wenn der Satz kleingeschrieben
    // weiterläuft (Artikelüberschriften beginnen großgeschrieben).
    const inlineParagraphReference = (marker?.type === 'paragraph' ||
      (['article', 'section', 'part', 'chapter', 'subsection'].includes(marker?.type) && /^\p{Ll}/u.test(marker.title ?? ''))) &&
      !/^h[1-6]$/u.test(node.tagName) &&
      !rawText.includes('\n') &&
      !isBold(node, css) &&
      !isCentered(node, css) &&
      /\b(?:gilt|gelten|findet|finden|bleibt|bleiben|ist|sind|tritt|treten|wird|werden)\b/iu.test(marker.title ?? '');
    const markerLooksLikeHeading = marker && !inlineParagraphReference;
    const letterSegments = !markerLooksLikeHeading ? splitPrintedLetterLines(rawText) : null;
    if (letterSegments) {
      emitPrintedSegments(letterSegments, visualIndent(node, css));
      continue;
    }
    const amendmentInstruction = QUOTE_TRIGGER_PATTERN.test(text);
    const amendmentReference = marker && ['article', 'paragraph'].includes(marker.type) && AMENDMENT_REFERENCE_PATTERN.test(marker.title ?? '');
    const romanItem = !markerLooksLikeHeading ? printedRomanItem(text, tokens.at(-1), romanRun) : null;
    const printedItem = !romanItem && !markerLooksLikeHeading && !ordinalNameLine(text, tokens.at(-1), visualIndent(node, css))
      ? parsePrintedListItem(text)
      : romanItem;
    romanRun = romanItem ? { value: romanItem.counterValue, level: romanItem.level } : (printedItem ? romanRun : null);
    const printedLetter = !markerLooksLikeHeading && !printedItem ? printedLetterItem(text, tokens.at(-1), visualIndent(node, css)) : null;
    if (markerLooksLikeHeading && !amendmentReference && !(amendmentInstruction && ['article', 'paragraph'].includes(marker.type))) {
      const embeddedTitle = embeddedIntroducedNormTitle(marker, rawText);
      const headingText = embeddedTitle ? rawText.split('\n').slice(0, 2).join('\n') : rawText;
      tokens.push({
        kind: 'structure',
        marker: embeddedTitle ? { ...marker, title: embeddedTitle.articleTitle } : marker,
        text: headingText, rawText: headingText,
        tagName: node.tagName, bold: isBold(node, css), centered: isCentered(node, css),
        opensQuote: OPENING_QUOTE_PATTERN.test(rawText),
        ...(numberedHeading ? { numberedHeading: true } : {}),
      });
      // Der Satz hinter einer römischen Ordnungszahl wird ihr erster Absatz.
      if (leadSentence) {
        tokens.push({
          kind: 'paragraph', text: leadSentence, rawText: leadSentence, tagName: node.tagName,
          bold: false, centered: false, indent: visualIndent(node, css),
        });
      }
      // Der in derselben Überschrift gesetzte Stammnormtitel bleibt eine eigene Titelzeile
      // unter der Artikelüberschrift, wie bei getrennt gesetzten Einführungsartikeln.
      if (embeddedTitle) {
        tokens.push({
          kind: 'paragraph', text: embeddedTitle.normTitle, rawText: embeddedTitle.normTitle, tagName: node.tagName,
          bold: isBold(node, css), centered: isCentered(node, css),
          indent: visualIndent(node, css),
        });
      }
    } else if (printedItem) {
      if (printedItem.numberingStyle === 'lower-latin' && !romanItem) {
        const letters = printedItem.label.replace(/^(?:„|“|,,|")/u, '').slice(0, -1);
        const double = letters.length === 2;
        const value = double ? (letters[0] === letters[1] ? letters.charCodeAt(0) - 96 : null) : letters.charCodeAt(0) - 96;
        if (value) {
          printedItem.level = printedLetterLevel(double, value, printedItem.level, visualIndent(node, css));
          printedItem.counterValue = value;
          printedItem.printedLetterKind = double ? 2 : 1;
        }
      }
      tokens.push({
        kind: 'listItem',
        listId: 'printed-outline',
        ...printedItem,
        startsList: printedItem.level === 0,
        indent: visualIndent(node, css, printedItem.level * 36),
      });
    } else if (printedLetter) {
      tokens.push({
        kind: 'listItem',
        listId: 'printed-outline',
        ...printedLetter,
        startsList: printedLetter.opensPrintedSublist,
        indent: visualIndent(node, css),
      });
    } else if (splitSubparagraphLines(rawText) ?? splitParallelLines(rawText) ?? splitHeadingBodyLines(rawText, tokens.at(-1))) {
      for (const line of splitSubparagraphLines(rawText) ?? splitParallelLines(rawText) ?? splitHeadingBodyLines(rawText, tokens.at(-1))) {
        tokens.push({
          kind: 'paragraph', text: line, rawText: line, tagName: node.tagName,
          bold: isBold(node, css), centered: isCentered(node, css), indent: visualIndent(node, css),
        });
      }
    } else {
      const ordinal = ordinalNameLine(text, tokens.at(-1), visualIndent(node, css));
      tokens.push({
        kind: 'paragraph', text, rawText, tagName: node.tagName,
        bold: isBold(node, css), centered: isCentered(node, css),
        indent: visualIndent(node, css),
        ...(ordinal ? { ordinalName: Number.parseInt(text, 10) } : {}),
      });
    }
  }
  return closingFormulaTokens(tokens);
}

const CLOSING_FORMULA_PATTERN = /^Zu\s+Urkund\s+dessen\b/iu;

// Schlussformel eines Vertrags („Zu Urkund dessen …“, „Geschehen zu …“, Unterzeichnung und
// Anlagenverzeichnis) steht hinter dem letzten Artikel und nicht in ihm. Am Zeilenende umbrochene
// Sätze werden verbunden, jede Vertragspartei und jede unterzeichnende Person bildet eine eigene
// Zeile; Verzeichniszeilen „Anhang 1: …“ sind Text, keine Anlagen.
function closingFormulaTokens(tokens) {
  const output = [];
  let closing = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!closing && token.kind === 'paragraph' && CLOSING_FORMULA_PATTERN.test(token.text ?? '')) closing = true;
    if (!closing) {
      output.push(token);
      continue;
    }
    const listedAnnex = token.kind === 'structure' && token.marker.type === 'annex' &&
      tokens[index + 1]?.kind === 'structure' && tokens[index + 1].marker.type === 'annex';
    if (token.kind === 'structure' && !listedAnnex) {
      closing = false;
      output.push(token);
      continue;
    }
    if (token.kind !== 'paragraph' && !listedAnnex) {
      output.push(token);
      continue;
    }
    const lines = String(token.rawText ?? token.text ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const previous = output.at(-1);
      const continuesSentence = previous?.closing && !previous.lineStart &&
        !/[.:;!?]\s*$/u.test(previous.text) && /^\p{Ll}/u.test(line);
      const continuesParty = previous?.closing && /^Für\s+(?:den|die|das)$/u.test(previous.text);
      if (continuesSentence || continuesParty) {
        previous.text = `${previous.text} ${line}`;
        previous.rawText = previous.text;
        continue;
      }
      output.push({
        kind: 'paragraph', text: line, rawText: line, tagName: token.tagName ?? 'p',
        bold: false, centered: false, indent: token.indent ?? 0, closing: true,
      });
    }
  }
  return output;
}

// „„(1a) …<br>(1b) …“ – mit Zeilenumbruch in einem Absatz gesetzte Absätze bleiben eigene Absätze.
// Zerlegt wird nur ein Absatz, der selbst mit einer Absatznummer beginnt; Zeilen ohne eigene
// Absatznummer setzen den vorangehenden Absatz fort.
function splitSubparagraphLines(rawText) {
  const lines = String(rawText ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  const label = /^\(\d+[a-z]?\)\s/u;
  if (lines.length < 2 || !label.test(lines[0].replace(OPENING_QUOTE_PATTERN, '')) || !lines.slice(1).some((line) => label.test(line))) return null;
  const segments = [];
  for (const line of lines) {
    if (segments.length === 0 || label.test(line)) segments.push(line);
    else segments[segments.length - 1] = `${segments.at(-1)} ${line}`;
  }
  return segments;
}

// Gedruckte römische Ziffern „i)“, „ii)“, „iii)“ unter einem Buchstabenpunkt. „i)“ beginnt die
// Folge nur, wenn kein Buchstabe „h)“ vorangeht; jede weitere Ziffer setzt eine laufende Folge fort.
function printedRomanItem(text, previousToken, run) {
  const normalized = normalizeHtmlText(text);
  const openingQuote = normalized.match(/^(?:„|“|,,|")/u)?.[0] ?? '';
  const match = normalized.replace(/^(?:„|“|,,|")/u, '').match(/^([ivx]+)\)\s+(\S.*)$/u);
  if (!match) return null;
  const value = parseRomanCounter(match[1].toLocaleUpperCase('de'));
  if (!value) return null;
  let level;
  if (value === 1) {
    if (previousToken?.kind !== 'listItem' || previousToken.listId !== 'printed-outline') return null;
    if (previousToken.numberingStyle === 'lower-latin' && previousToken.counterValue === 8) return null;
    level = previousToken.numberingStyle === 'lower-roman' ? previousToken.level : (previousToken.level ?? 0) + 1;
  } else {
    if (!run || run.value !== value - 1) return null;
    level = run.level;
  }
  return {
    label: `${openingQuote}${match[1]})`,
    text: match[2],
    level,
    numberingStyle: 'lower-roman',
    counterValue: value,
    ...(openingQuote ? { opensQuote: true } : {}),
  };
}

// „Modul M1 …<br>Modul M2 …<br>Modul M3 …“ – mit Zeilenumbruch gesetzte gleich gebaute Zeilen,
// die alle mit demselben großgeschriebenen Wort und einer laufenden Kennung beginnen, bleiben
// getrennte Zeilen.
function splitParallelLines(rawText) {
  const lines = String(rawText ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return null;
  const heads = lines.map((line) => line.match(/^(\p{Lu}\p{L}+)\s+(\S+)/u));
  if (heads.some((head) => !head) || new Set(heads.map((head) => head[1])).size !== 1) return null;
  const keys = heads.map((head) => head[2].replace(/\d+/gu, '#'));
  return new Set(keys).size === 1 && /#/u.test(keys[0]) ? lines : null;
}

// „3. Aufgabenprofil“ / „Navigation: …<br>Unterstützung …<br>Feedbackkanal: …“ – unter einem gedruckten
// Gliederungspunkt, der nur eine Überschrift trägt (kurz, ohne Satzzeichen am Ende), ist ein mit
// Zeilenumbruch gesetzter Absatz eine zeilenweise Aufzählung; jede Zeile bleibt eine eigene Zeile.
// Am Zeilenende getrennte Wörter („Prüf-<br>stelle“) sind schon beim Einlesen verbunden.
function splitHeadingBodyLines(rawText, previousToken) {
  const lines = String(rawText ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  if (previousToken?.kind !== 'listItem' || previousToken.listId !== 'printed-outline') return null;
  const heading = String(previousToken.text ?? '').trim();
  if (!heading || /[.,;:!?“”"]$/u.test(heading) || heading.split(/\s+/u).length > 8) return null;
  // „Antragsstelle ist die“ ist ein offener Satz, den der Absatz fortsetzt, keine Überschrift.
  if (OPEN_SENTENCE_END_PATTERN.test(heading)) return null;
  return lines;
}

// „Tag der Friedlichen Revolution (9. November), / 1. Weihnachtstag (25. Dezember),“ – in einer
// ungezählten Aufzählung von Zeilen gleichen Einzugs ist eine Ordnungszahl vor einem großgeschriebenen
// Wort Bestandteil des Namens und keine Gliederungsnummer. Die nächste Zahl derselben Folge bleibt
// ebenfalls Fließtext.
function ordinalNameLine(text, previousToken, indent) {
  const match = normalizeHtmlText(text).match(/^(\d+)\.\s+\p{Lu}/u);
  if (!match || previousToken?.kind !== 'paragraph' || Math.abs((previousToken.indent ?? 0) - indent) > 0.5) return false;
  const value = Number.parseInt(match[1], 10);
  if (value === 1) return /,\s*$/u.test(previousToken.text ?? '') && !/^\d+\.\s/u.test(previousToken.text ?? '');
  return previousToken.ordinalName === value - 1;
}

// „I. Im Zeitraum … wird … untersagt:“ – folgt auf eine römische Ordnungszahl im selben Absatz ein
// ganzer Satz, ist er der erste Text der Gliederungseinheit und keine Überschrift.
function romanSectionLeadSentence(marker) {
  if (marker?.type !== 'section' || !/^[IVXLCDM]+\.$/u.test(marker.label ?? '')) return null;
  const title = marker.title ?? '';
  if (!/[.:;]$/u.test(title) || title.split(/\s+/u).length < 8) return null;
  return title;
}

// „Artikel 1 / Einführung eines …gesetzes / Gesetz über …“ in einer einzigen Überschrift:
// Artikelüberschrift und Titel der eingeführten Stammnorm werden getrennt.
function embeddedIntroducedNormTitle(marker, rawText) {
  if (marker?.type !== 'article' || OPENING_QUOTE_PATTERN.test(rawText)) return null;
  const lines = rawText.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return null;
  if (!/^Einführung\s+(?:eines|einer)\s+.*?(?:gesetzes|verordnung|satzung)\b/iu.test(lines[1])) return null;
  if (!EMBEDDED_NORM_TITLE_PATTERN.test(lines[2])) return null;
  return { articleTitle: lines[1], normTitle: lines.slice(2).join(' ') };
}

function isOuterArticleToken(token) {
  return token?.kind === 'structure' && token.marker.type === 'article' && !token.opensQuote;
}

function introducedArticleTitle(token) {
  if (!isOuterArticleToken(token)) return null;
  const title = token.marker.title ?? '';
  if (EMBEDDED_NORM_TITLE_PATTERN.test(title)) return title;
  if (!/^Einführung\s+(?:eines|einer)\s+.*?(?:gesetzes|verordnung|satzung)\b/iu.test(title)) return null;
  return token.rawText.split('\n').slice(2).map((line) => line.trim()).find((line) => EMBEDDED_NORM_TITLE_PATTERN.test(line)) ?? null;
}

function groupIntroducedQuotes(tokens) {
  const grouped = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    grouped.push(token);
    if (
      isOuterArticleToken(token) &&
      introducedArticleTitle(token) &&
      tokens[index + 1]?.kind === 'structure' &&
      tokens[index + 1].marker.type !== 'article'
    ) {
      let end = index + 1;
      while (end < tokens.length && !isOuterArticleToken(tokens[end])) end += 1;
      grouped.push({ kind: 'quotedGroup', tokens: tokens.slice(index + 1, end), attachToPrevious: true, introduction: true });
      index = end - 1;
      continue;
    }
    // Der Stammnormtitel steht als eigene Zeile unter dem Einführungsartikel; die
    // zitierte Gliederung reicht bis zum nächsten äußeren Mantelartikel. Sie ist
    // derselbe Ausschnitt, aus dem extractIntroducedNorms die Stammnorm bildet, und
    // wird deshalb wie diese gegliedert (standalone), damit Zitat und Stammnorm übereinstimmen.
    const followsIntroduction = token.kind === 'paragraph' && EMBEDDED_NORM_TITLE_PATTERN.test(token.text) &&
      isOuterArticleToken(tokens[index - 1]) && /^Einführung\s/iu.test(tokens[index - 1].marker.title ?? '') &&
      tokens[index + 1]?.kind === 'structure' && tokens[index + 1].marker.type !== 'article';
    if (token.kind !== 'paragraph' || (!INTRODUCTION_PATTERN.test(token.text) && !followsIntroduction)) continue;
    let end = index + 1;
    while (end < tokens.length && !isOuterArticleToken(tokens[end])) end += 1;
    if (end > index + 1) {
      grouped.push({
        kind: 'quotedGroup', tokens: tokens.slice(index + 1, end), attachToPrevious: false, introduction: true,
        standalone: followsIntroduction,
      });
      index = end - 1;
    }
  }
  return grouped;
}

function endsAmendmentQuote(token) {
  const text = token?.text ?? token?.rawText ?? '';
  // A quoted contents entry may put the sentence's full stop outside the quote.
  // Restrict this to headings: inner quotations in running text must stay inside the provision.
  return CLOSING_QUOTE_PATTERN.test(text) ||
    (token?.kind === 'structure' && /(?:“|”|’|''|")\s*\.\s*$/u.test(text));
}

// Der Listenpunkt, dem ein Änderungsbefehl gehört: der Befehl selbst oder bei einem
// Fortsetzungsabsatz der unmittelbar vorangehende Punkt auf derselben oder geringerer Einrückung.
function quoteOwnerItem(tokens, index) {
  const trigger = tokens[index];
  if (trigger.kind === 'listItem') return trigger;
  for (let back = index - 1; back >= 0; back -= 1) {
    const candidate = tokens[back];
    if (candidate.kind === 'structure' || candidate.kind === 'quotedGroup') return null;
    if (candidate.kind === 'listItem') return (candidate.indent ?? 0) <= (trigger.indent ?? 0) + 0.5 ? candidate : null;
  }
  return null;
}

function isNextVisualSibling(candidate, owner) {
  return candidate.kind === 'listItem' &&
    !OPENING_QUOTE_PATTERN.test(candidate.text ?? '') &&
    candidate.numberingStyle === owner.numberingStyle &&
    listLabelShape(candidate.label) === listLabelShape(owner.label) &&
    Number.isInteger(owner.counterValue) && candidate.counterValue === owner.counterValue + 1 &&
    (candidate.indent ?? 0) <= (owner.indent ?? 0) + 0.5;
}

const QUOTE_TRIGGER_WITHOUT_COLON_PATTERN = new RegExp(QUOTE_TRIGGER_PATTERN.source.replace(/\\s\*:\\s\*\$$/u, '\\s*$'), 'iu');

function opensQuotation(token) {
  return token?.kind === 'structure' || token?.opensQuote
    ? Boolean(token.opensQuote)
    : OPENING_QUOTE_PATTERN.test(token?.rawText ?? token?.text ?? '');
}

function isQuoteTrigger(token, nextToken, followingToken) {
  if (QUOTE_TRIGGER_PATTERN.test(token.text)) {
    // „… wird wie folgt gefasst:“ vor eigenen Unterpunkten derselben Liste ohne Anführung ist ein
    // Änderungsbefehl mit Untergliederung, keine zitierte Neufassung.
    if (nextToken?.kind === 'listItem' && nextToken.counterValue === 1 && !opensQuotation(nextToken) &&
      opensQuotation(followingToken)) return false;
    return !(nextToken?.kind === 'listItem' && token.kind === 'listItem' && nextToken.listId === token.listId &&
      token.listId !== 'printed-outline' && nextToken.level > token.level && !opensQuotation(nextToken));
  }
  // „Die Bezeichnung der Verordnung wird wie folgt geändert:“ unmittelbar vor zitiertem Wortlaut
  // ohne eigene Gliederungsnummer leitet ebenfalls eine Neufassung ein.
  if (/\bwie\s+folgt\s+geändert\s*:\s*$/iu.test(token.text) && nextToken?.kind === 'paragraph' &&
    opensQuotation(nextToken)) return true;
  return QUOTE_TRIGGER_WITHOUT_COLON_PATTERN.test(token.text) && opensQuotation(nextToken);
}

// Übergeordnete Listenpunkte des Befehls: vorangehende Punkte höheren Gliederungsrangs auf
// gleicher oder geringerer Einrückung, bis zur nächsten Gliederungsüberschrift.
function listAncestorTokens(tokens, ownerIndex, owner) {
  const chain = [];
  let rank = numberingRank(owner.numberingStyle);
  let indent = owner.indent ?? 0;
  for (let back = ownerIndex - 1; back >= 0 && rank > 1; back -= 1) {
    const candidate = tokens[back];
    if (candidate.kind === 'structure') break;
    if (candidate.kind !== 'listItem') continue;
    const candidateRank = numberingRank(candidate.numberingStyle);
    if (candidateRank < rank && (candidate.indent ?? 0) <= indent + 0.5) {
      chain.push(candidate);
      rank = candidateRank;
      indent = candidate.indent ?? 0;
    }
  }
  return chain;
}

function enclosingStructureToken(tokens, index) {
  for (let back = index - 1; back >= 0; back -= 1) {
    if (tokens[back].kind === 'structure' && !tokens[back].opensQuote) return tokens[back];
  }
  return null;
}

function structureLabelValue(label) {
  const last = String(label ?? '').trim().replace(/[.:]$/u, '').split(/\s+/u).at(-1) ?? '';
  if (/^\d+$/u.test(last)) return { shape: String(label).replace(last, '#'), value: Number.parseInt(last, 10) };
  const roman = parseRomanCounter(last);
  return roman ? { shape: String(label).replace(last, '#'), value: roman } : null;
}

function isNextStructureSibling(candidate, structure) {
  if (candidate.kind !== 'structure' || candidate.opensQuote || candidate.marker.type !== structure.marker.type) return false;
  // Artikel und Paragraphen kommen in zitierten Neufassungen regelmäßig mit fortlaufender Zählung vor.
  if (['article', 'paragraph'].includes(candidate.marker.type)) return false;
  const current = structureLabelValue(structure.marker.label);
  const next = structureLabelValue(candidate.marker.label);
  return Boolean(current && next && current.shape === next.shape && next.value === current.value + 1);
}

// „Artikel 3 / Das … Gesetz wird wie folgt gefasst: / § 1 … § 3 … / Artikel 4 …“ – eine ohne
// Anführungszeichen gesetzte Neufassung aus Paragraphen endet vor dem Artikel, der die Zählung
// des äußeren Mantelartikels fortsetzt. Enthält das Zitat selbst Artikel, bleibt es offen.
function continuesOuterArticleCount(candidate, outerStructure, quotedTokens) {
  if (candidate.kind !== 'structure' || candidate.opensQuote || candidate.marker.type !== 'article') return false;
  if (outerStructure?.marker.type !== 'article') return false;
  if (quotedTokens.some((token) => token.kind === 'structure' && token.marker.type === 'article')) return false;
  const current = structureLabelValue(outerStructure.marker.label);
  const next = structureLabelValue(candidate.marker.label);
  return Boolean(current && next && current.shape === next.shape && next.value === current.value + 1);
}

// „§ 4 … eingeschränkt.“ § 4a … eingeschränkt.“ – folgt auf ein geschlossenes Zitat eine nicht
// geöffnete Gliederungseinheit, deren Text erneut mit einem schließenden Anführungszeichen unmittelbar
// vor dem nächsten Geschwister des Änderungsbefehls endet, gehört sie noch zur Neufassung; das erste
// schließende Zeichen ist ein Setzfehler der Quelle.
function continuesAfterStrayClosingQuote(tokens, index, owner) {
  if (!owner || tokens[index]?.kind !== 'structure' || tokens[index].opensQuote) return false;
  for (let ahead = index + 1; ahead < tokens.length; ahead += 1) {
    const candidate = tokens[ahead];
    if (candidate.kind === 'structure' || opensQuotation(candidate)) return false;
    if (candidate.kind === 'listItem' && (isNextVisualSibling(candidate, owner) ||
      (candidate.listId === owner.listId && candidate.level <= owner.level))) return false;
    if (endsAmendmentQuote(candidate)) {
      const next = tokens[ahead + 1];
      return !next || (next.kind === 'listItem' && isNextVisualSibling(next, owner)) || isOuterArticleToken(next);
    }
  }
  return false;
}

const TABLE_OF_CONTENTS_PATTERN = /\b(?:Inhaltsübersicht|Inhaltsverzeichnis)\b/iu;

// Der Befehl fügt Angaben einer Inhaltsübersicht ein, selbst oder unter einem übergeordneten
// Punkt „Die Inhaltsübersicht wird wie folgt geändert:“. Die Suche nach dem übergeordneten Punkt
// überspringt vorangehende Zitate und endet am äußeren Artikel.
function quotesTableOfContents(tokens, index, owner) {
  const trigger = tokens[index];
  if (!/\bAngaben?\b/iu.test(trigger.text ?? '')) return false;
  if (TABLE_OF_CONTENTS_PATTERN.test(trigger.text ?? '')) return true;
  if (owner.kind !== 'listItem') return false;
  let rank = numberingRank(owner.numberingStyle);
  for (let back = tokens.indexOf(owner) - 1; back >= 0 && rank > 1; back -= 1) {
    const candidate = tokens[back];
    if (isOuterArticleToken(candidate)) return false;
    if (candidate.kind !== 'listItem' || opensQuotation(candidate)) continue;
    const candidateRank = numberingRank(candidate.numberingStyle);
    if (candidateRank >= rank || (candidate.indent ?? 0) > (owner.indent ?? 0) + 0.5) continue;
    if (TABLE_OF_CONTENTS_PATTERN.test(candidate.text ?? '')) return true;
    rank = candidateRank;
  }
  return false;
}

// Zitierte Angaben einer Inhaltsübersicht („„§ 11a Nutzung privater mobiler Endgeräte“.“) sind
// Textzeilen, keine Gliederungseinheiten mit Überschrift; jede Angabe bleibt eine eigene Zeile.
// Steht die Bezeichnung allein in einer Zeile, gehört die folgende Zeile als Überschrift zu ihr.
function tableOfContentsLineTokens(tokens) {
  const output = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind !== 'structure') {
      output.push(token);
      continue;
    }
    const lines = token.rawText.split('\n').map((line) => line.trim()).filter(Boolean);
    const next = tokens[index + 1];
    if (lines.length === 1 && !token.marker.title && next?.kind === 'paragraph') {
      lines[0] = `${lines[0]} ${next.text}`;
      index += 1;
    }
    output.push(...lines.map((line) => ({
      kind: 'paragraph', text: line, rawText: line, tagName: token.tagName,
      bold: false, centered: false, indent: token.indent ?? 0,
    })));
  }
  return output;
}

// „Die Lernbereiche 1 bis 4 erhalten folgende Fassung: / a) Lernbereich 1 / „Lernbereich 1: …“ /
// b) Lernbereich 2 / „…““ – der Befehl ist untergliedert (isQuoteTrigger); jeder Unterpunkt, dem
// unmittelbar zitierter Wortlaut folgt, ist dann selbst der Träger seiner Neufassung.
function subdividedTriggerList(token, nextToken, followingToken) {
  if (!['listItem', 'paragraph'].includes(token.kind) || !QUOTE_TRIGGER_PATTERN.test(token.text ?? '')) return null;
  if (nextToken?.kind !== 'listItem' || nextToken.counterValue !== 1 || opensQuotation(nextToken) ||
    !opensQuotation(followingToken)) return null;
  return { listId: nextToken.listId, level: nextToken.level };
}

function groupAmendmentQuotes(tokens) {
  const grouped = [];
  let subdivided = null;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    grouped.push(token);
    if (token.kind === 'structure') subdivided = null;
    const subdividedItem = subdivided && token.kind === 'listItem' && token.listId === subdivided.listId &&
      token.level === subdivided.level && !opensQuotation(token) && opensQuotation(tokens[index + 1]);
    subdivided = subdividedTriggerList(token, tokens[index + 1], tokens[index + 2]) ?? subdivided;
    if (!['listItem', 'paragraph'].includes(token.kind) ||
      (!subdividedItem && !isQuoteTrigger(token, tokens[index + 1], tokens[index + 2]))) continue;
    let end = index + 1;
    let sawContent = false;
    const owner = quoteOwnerItem(tokens, index);
    const ownerChain = owner ? listAncestorTokens(tokens, tokens.indexOf(owner), owner) : [];
    const outerStructure = enclosingStructureToken(tokens, index);
    while (end < tokens.length) {
      const candidate = tokens[end];
      if (sawContent && owner && isNextVisualSibling(candidate, owner)) break;
      if (sawContent && ownerChain.some((ancestor) => isNextVisualSibling(candidate, ancestor))) break;
      if (sawContent && outerStructure && isNextStructureSibling(candidate, outerStructure)) break;
      if (sawContent && continuesOuterArticleCount(candidate, outerStructure, tokens.slice(index + 1, end))) break;
      if (candidate.kind === 'listItem' && candidate.listId === token.listId && candidate.level <= token.level &&
        !(!sawContent && opensQuotation(candidate))) break;
      if (
        sawContent &&
        candidate.kind === 'structure' &&
        ['article', 'paragraph'].includes(candidate.marker.type) &&
        (
          (endsAmendmentQuote(tokens[end - 1]) && !continuesAfterStrayClosingQuote(tokens, end, owner)) ||
          OUTER_ARTICLE_TITLE_PATTERN.test(candidate.marker.title ?? '')
        )
      ) break;
      if (
        sawContent &&
        candidate.kind === 'listItem' &&
        candidate.level <= token.level &&
        candidate.numberingStyle === 'decimal' &&
        endsAmendmentQuote(tokens[end - 1])
      ) break;
      sawContent = true;
      end += 1;
    }
    if (end > index + 1) {
      grouped.push({
        kind: 'quotedGroup',
        tokens: quotesTableOfContents(tokens, index, owner ?? token)
          ? tableOfContentsLineTokens(tokens.slice(index + 1, end))
          : tokens.slice(index + 1, end),
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

function listLabelShape(label) {
  return String(label ?? '').trim().replace(/\p{L}/gu, 'a').replace(/\d+/gu, '1');
}

function standaloneListMarkerToken(token, nextToken) {
  if (token?.kind !== 'paragraph' || nextToken?.kind !== 'listItem') return null;
  const label = token.text.trim();
  let numberingStyle;
  let counterValue;
  let numberingPrefix = '';
  let numberingSuffix = '';
  let markerRank;
  if (/^\d+\.$/u.test(label)) {
    numberingStyle = 'decimal';
    counterValue = Number.parseInt(label, 10);
    numberingSuffix = '.';
    markerRank = 1;
  } else if (/^[a-z]\)$/iu.test(label)) {
    numberingStyle = 'lower-latin';
    counterValue = label.toLocaleLowerCase('de').charCodeAt(0) - 96;
    numberingSuffix = ')';
    markerRank = 2;
  } else if (/^[a-z]{2,3}\)$/iu.test(label)) {
    numberingStyle = 'lower-latin';
    counterValue = null;
    numberingSuffix = ')';
    markerRank = 3;
  } else if (/^\(\d+\)$/u.test(label)) {
    numberingStyle = 'decimal';
    counterValue = Number.parseInt(label.slice(1), 10);
    numberingPrefix = '(';
    numberingSuffix = ')';
    markerRank = 4;
  } else if (/^\([a-z]{1,3}\)$/iu.test(label)) {
    numberingStyle = 'lower-latin';
    counterValue = null;
    numberingPrefix = '(';
    numberingSuffix = ')';
    markerRank = 5;
  } else {
    return null;
  }

  const childLabel = nextToken.label?.trim() ?? '';
  const childRank = /^\d+\.$/u.test(childLabel)
    ? 1
    : /^[a-z]\)$/iu.test(childLabel)
      ? 2
      : /^[a-z]{2,3}\)$/iu.test(childLabel)
        ? 3
        : /^\(\d+\)$/u.test(childLabel)
          ? 4
          : /^\([a-z]{1,3}\)$/iu.test(childLabel)
            ? 5
            : numberingRank(nextToken.numberingStyle);
  if (childRank <= markerRank) return null;

  return {
    kind: 'listItem',
    listId: 'printed-outline',
    label,
    text: '',
    level: 0,
    numberingStyle,
    counterValue,
    numberingPrefix,
    numberingSuffix,
    startsList: true,
    indent: token.indent,
    opensSublist: true,
  };
}

// „1.2.1 Nötigkeit“: eine gedruckte Gliederungsnummer mit kurzer Überschrift ohne Satzzeichen.
// Einfache Nummern („1. Artikel 98 …“) gelten nur in einer mehrstufig gedruckten Gliederung als
// Überschrift; sonst („1. Polytechnische Oberschule“) bleiben sie Aufzählungspunkte.
function isOutlineHeadingItem(token, multilevelOutline) {
  const text = String(token.text ?? '').trim();
  const multilevel = /^\d+(?:\.\d+)+\.?$/u.test(token.label ?? '');
  return token.numberingStyle === 'decimal' && !token.opensQuote && (multilevel || (multilevelOutline && /^\d+\.$/u.test(token.label ?? ''))) &&
    /^[\p{Lu}§]/u.test(text) && text.length <= 160 && !/[.,;:!?“”"]$/u.test(text);
}

// Ein mit Satzzeichen abgeschlossener Text aus mindestens sechs Wörtern ist ein Satz; Überschriften
// enden ohne Satzzeichen oder nur mit dem schließenden Zeichen eines Zitats („Übergangsregelung“.“).
function isSentenceText(value) {
  const core = String(value ?? '').replace(/^[„“”'`,.]+/u, '').trim();
  return /[\p{L}\p{N})][.!?]$/u.test(core) && core.split(/\s+/u).length >= 6;
}

const SEPARATE_TITLE_TYPES = new Set(['part', 'chapter', 'section', 'subsection', 'annex']);

// „I.“ / „Zuwendungszweck, Rechtsgrundlagen“ oder „Anlage 1 (zu § 2)“ / „Zuordnung …“: Steht die
// Überschrift einer Gliederungseinheit ohne eigene Überschrift im unmittelbar folgenden, gleich
// gesetzten Absatz, ist dieser Absatz ihre Überschrift und kein Normtext. Erkannt wird nur eine
// kurze Zeile ohne Satzzeichen am Ende, ohne Absatznummer und mit der Auszeichnung der
// Gliederungszeile (Überschriftenelement, Zentrierung, Fettdruck) oder innerhalb eines Zitats.
function separateHeadingTitle(structure, next, inQuote) {
  if (!SEPARATE_TITLE_TYPES.has(structure.marker.type) || next?.kind !== 'paragraph' || next.ordinalName) return null;
  const text = String(next.text ?? '').trim();
  const core = text.replace(CLOSING_QUOTE_PATTERN, '').trim();
  if (!core || core.length > 160 || /[.;:,!?]$/u.test(core) || /^\(\d/u.test(core) || parseHtmlStructureMarker(core)) return null;
  if (OPENING_QUOTE_PATTERN.test(text)) return null;
  const headingElements = /^h[1-6]$/u.test(structure.tagName ?? '') && /^h[1-6]$/u.test(next.tagName ?? '');
  const samePresentation = (structure.centered && next.centered) || (structure.bold && next.bold);
  if (!headingElements && !samePresentation && !inQuote) return null;
  return inQuote ? text : core;
}

function parseTokens(tokens, fileName, { inQuote = false, parseAmendmentQuotes = true } = {}) {
  const root = [];
  const stack = [{ rank: 0, children: root }];
  const listParents = new Map();
  const listBaselines = new Map();
  const listCounterOffsets = new WeakMap();
  let lastBlock = null;
  let lastListState = null;
  // Gedruckte Gliederungsnummer mit Überschrift („1.2.1 Nötigkeit“): Die folgenden Absätze und
  // Listen bis zur nächsten Gliederungsnummer bilden ihren Inhalt.
  let outlineHeading = null;
  const multilevelOutline = tokens.some((entry) => entry.kind === 'listItem' && entry.listId === 'printed-outline' &&
    /^\d+(?:\.\d+)+\.?$/u.test(entry.label ?? ''));

  const append = (block) => {
    currentChildren(stack).push(block);
    lastBlock = block;
    return block;
  };
  // Listenpunkt, dem ein Kinderfeld gehört; trägt die Satzstruktur über mehrere Ebenen.
  const childrenOwner = new WeakMap();
  // Kinderfeld, in dem ein Listenpunkt steht (für den Aufstieg zum übergeordneten Punkt).
  const itemContainer = new WeakMap();
  const blockIndent = new WeakMap();
  const sentenceClosingOwner = (text, indent) => {
    if (!lastListState || lastBlock !== lastListState.block) return null;
    if (/[.!?;:]\s*$/u.test(lastListState.block.text ?? '')) return null;
    const owner = childrenOwner.get(lastListState.destination);
    if (!owner || owner.type !== 'item' || /[.!?;:]\s*$/u.test(owner.text ?? '')) return null;
    // Kleingeschrieben setzt der Schlussteil den Satz fort; großgeschrieben nur mit dem Texteinzug
    // des übergeordneten Punkts („3. … so festzulegen, dass / a) … / b) … / Bestandteil … ist.“).
    const alignedWithOwner = (indent ?? 0) > 0.5 && Math.abs((indent ?? 0) - (blockIndent.get(owner) ?? -1)) <= 0.5;
    if (!/^\p{Ll}/u.test(text ?? '') && !(alignedWithOwner && /^\p{Lu}/u.test(text ?? ''))) return null;
    // Ein Schlussteil, der den Satz beendet („übertragen.“), vollendet auch jeden offenen
    // übergeordneten Punkt, dessen letzter Unterpunkt der Eigentümer ist („2. Dem … wird aus dem
    // Geschäftsbereich / a. … / b. … die Geschäftsbereiche / i. … / iv. … / übertragen.“).
    let closingOwner = owner;
    while (/[.!?]\s*$/u.test(text ?? '')) {
      const container = itemContainer.get(closingOwner);
      const parentOwner = container ? childrenOwner.get(container) : null;
      if (!parentOwner || parentOwner.type !== 'item' || container.at(-1) !== closingOwner ||
        /[.!?;:]\s*$/u.test(parentOwner.text ?? '')) break;
      closingOwner = parentOwner;
    }
    return closingOwner;
  };

  // Der Einleitungssatz vor einer Liste der obersten Ebene endet offen („… in Einnahmen und
  // Ausgaben auf / 1. … / 2. … / festgestellt.“): Ein kleingeschriebener Folgeabsatz mit dem
  // Einzug dieses Einleitungssatzes vollendet ihn und gehört nicht in den letzten Punkt. Mit
  // tieferem Einzug („Sitz / 1. in Berlin / mit Zuständigkeit für …;“) setzt er den Punkt fort.
  const closesOpenListIntro = (state, token) => {
    const text = token.text ?? '';
    if (!state || state.semanticLevel !== 0 || !/^\p{Ll}/u.test(text)) return false;
    const first = state.destination.findIndex((entry) => entry.type === 'item' && entry.listId === state.block.listId);
    const intro = first > 0 ? state.destination[first - 1] : null;
    return Boolean(intro && ['paragraphText', 'subparagraph'].includes(intro.type) &&
      intro.text && !/[.!?;:]\s*$/u.test(intro.text) && blockIndent.has(intro) &&
      Math.abs((token.indent ?? 0) - blockIndent.get(intro)) <= 0.5);
  };

  const ownerAlignedAfterSublist = (token) => {
    if (!lastListState || lastBlock !== lastListState.block || lastListState.contextInterrupted) return null;
    if (lastListState.semanticLevel < 1 || !/[.!?;]\s*$/u.test(lastListState.block.text ?? '')) return null;
    const owner = childrenOwner.get(lastListState.destination);
    if (!owner || !['item', 'subparagraph'].includes(owner.type)) return null;
    const indent = token.indent ?? 0;
    if (indent <= 0.5 || Math.abs(indent - (blockIndent.get(owner) ?? -1)) > 0.5) return null;
    if (!/^\p{Lu}/u.test(token.text ?? '') || OPENING_QUOTE_PATTERN.test(token.text ?? '')) return null;
    return owner;
  };

  const groupedTokens = parseAmendmentQuotes
    ? groupAmendmentQuotes(groupIntroducedQuotes(tokens))
    : tokens;
  for (let tokenIndex = 0; tokenIndex < groupedTokens.length; tokenIndex += 1) {
    const originalToken = groupedTokens[tokenIndex];
    const token = standaloneListMarkerToken(originalToken, groupedTokens[tokenIndex + 1]) ?? originalToken;
    if (token.kind === 'structure') {
      const block = { type: token.marker.type, label: token.marker.label, ...(token.marker.title ? { title: token.marker.title } : {}), children: [] };
      const separateTitle = !block.title ? separateHeadingTitle(token, groupedTokens[tokenIndex + 1], inQuote) : null;
      if (separateTitle) {
        block.title = separateTitle;
        tokenIndex += 1;
      }
      // Paragraphen innerhalb eines Artikels („Artikel 2 Übergangsbestimmungen / § 1 …“) gliedern
      // diesen Artikel weiter und beenden ihn nicht.
      // Innerhalb einer Anlage gliedern Teile, Kapitel und Abschnitte die Anlage weiter.
      // Eine Präambel endet vor dem ersten Artikel; sie enthält keine Artikel.
      const insideAnnex = block.type !== 'annex' && stack.some((frame) => frame.type === 'annex');
      // „III. Änderung … / 1. Allgemeine Ziele / 2. Grundkurs“: Als Überschrift gesetzte Nummern
      // innerhalb einer offenen römisch bezeichneten Gliederung gliedern diese weiter und stehen
      // nicht neben ihr. Ohne offene römische Gliederung bleiben sie Gliederungseinheiten der
      // obersten Ebene.
      const romanFrame = !token.numberedHeading
        ? null
        : stack.at(-1).roman
          ? stack.at(-1)
          : stack.at(-1).numberedHeading && stack.at(-2)?.roman ? stack.at(-2) : null;
      const rank = romanFrame
        ? romanFrame.rank + 1
        : block.type === 'paragraph' && stack.some((frame) => frame.type === 'article')
          ? STRUCTURE_RANK.article + 1
          : STRUCTURE_RANK[block.type] + (insideAnnex ? 1 : 0);
      while (stack.length > 1 && stack.at(-1).rank >= rank) stack.pop();
      currentChildren(stack).push(block);
      const frameRank = block.type === 'section' && block.label === 'Präambel' ? STRUCTURE_RANK.article : rank;
      stack.push({
        rank: frameRank, type: block.type, children: block.children,
        ...(block.type === 'section' && /^[IVXLCDM]+\.$/u.test(block.label ?? '') ? { roman: true } : {}),
        ...(romanFrame ? { numberedHeading: true } : {}),
      });
      lastBlock = block;
      lastListState = null;
      outlineHeading = null;
      listParents.clear();
      listBaselines.clear();
      continue;
    }
    if (token.kind === 'signature') {
      // Unterschriften stehen unter der letzten Gliederungseinheit, nicht in ihr.
      stack.length = 1;
      // Zeilenweise verbinden: Der gesperrte Satz kennt Wortgrenzen nur innerhalb einer Zeile.
      const office = normalizeOfficeTitle(token.officeParts.join('\n'));
      append({
        type: 'signature',
        ...(token.place ? { label: token.place } : {}),
        ...(office ? { title: office } : {}),
        ...(token.name ? { text: token.name } : {}),
      });
      lastListState = null;
      outlineHeading = null;
      listParents.clear();
      listBaselines.clear();
      continue;
    }
    if (token.kind === 'paragraph' && token.closing) {
      stack.length = 1;
      append({ type: 'paragraphText', text: token.text });
      lastListState = null;
      outlineHeading = null;
      listParents.clear();
      listBaselines.clear();
      continue;
    }
    if (token.kind === 'paragraph') {
      // Ein zitierter Absatz behält seine Absatznummer auch hinter dem öffnenden Anführungszeichen
      // („„(3) …“). Das öffnende Zeichen steht wie bei zitierten Punkten („„1.“, siehe
      // parsePrintedListItem) vor der Absatznummer und bleibt in der Bezeichnung erhalten („„(3)“);
      // das schließende Zeichen bleibt am Textende, die Anführung ist damit ausgeglichen.
      const subparagraphQuote = inQuote ? token.text.match(OPENING_QUOTE_PATTERN)?.[0] ?? '' : '';
      const subparagraph = token.text.slice(subparagraphQuote.length).match(/^\((\d+[a-z]?)\)\s*(.*)$/iu);
      // Ein vollständiger Satz („Dem … Staatsvertrag … wird zugestimmt.“) ist Normtext, keine Überschrift.
      if (inQuote && !subparagraph && ['article', 'paragraph'].includes(lastBlock?.type) && !lastBlock.title &&
        !isSentenceText(token.text)) {
        lastBlock.title = token.text.replace(/^[„“”'`,.]+/u, '').trim();
        continue;
      }
      const paragraphBlock = subparagraph
        ? { type: 'subparagraph', label: `${subparagraphQuote}(${subparagraph[1]})`, text: subparagraph[2], children: [] }
        : { type: 'paragraphText', text: token.text };
      blockIndent.set(paragraphBlock, token.indent ?? 0);
      const syntacticallyOpenListItem = lastListState &&
        lastBlock === lastListState.block &&
        !lastListState.contextInterrupted &&
        !/[.!?;:]\s*$/u.test(lastListState.block.text ?? '') &&
        OPEN_SENTENCE_END_PATTERN.test(lastListState.block.text ?? '');
      // Ein Absatz mit dem Texteinzug des unmittelbar vorangehenden Punkts, dessen Text ohne
      // Satzzeichen endet („1. Polytechnische Oberschule“ / „An allen Schulen …“), ist dessen Inhalt.
      const alignedWithOpenListItem = lastListState && lastBlock === lastListState.block &&
        !lastListState.contextInterrupted && (token.indent ?? 0) > 0.5 &&
        Math.abs((token.indent ?? 0) - (lastListState.indent ?? 0)) <= 0.5 &&
        (!/[.!?;:,]\s*$/u.test(lastListState.block.text ?? '') || QUOTE_TRIGGER_PATTERN.test(token.text ?? '')) &&
        !/^\d+\./u.test(token.text ?? '') && !closesOpenListIntro(lastListState, token) &&
        // Ein Zitat gehört nur dann dazu, wenn es im selben Absatz schließt („„Lehrplan …“.“).
        (!OPENING_QUOTE_PATTERN.test(token.text ?? '') || /(?:“|”|")[.,;]?\s*$/u.test(token.text ?? ''));
      // „F. Kontrollen“ – eine mit Großbuchstaben bezeichnete Zwischenüberschrift setzt keinen Punkt fort.
      const letteredHeading = /^\p{Lu}\.\s+\p{Lu}/u.test(token.text ?? '') && !/[.;:,]\s*$/u.test(token.text ?? '');
      const continuationOfListItem = !subparagraph && !letteredHeading && lastListState &&
        !QUOTE_TRIGGER_PATTERN.test(lastListState.block.text ?? '') &&
        !AMENDMENT_REFERENCE_PATTERN.test(lastListState.block.text ?? '') &&
        (lastListState.continuationOpen || /:\s*$/u.test(lastListState.block.text ?? '') || syntacticallyOpenListItem ||
          alignedWithOpenListItem) &&
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
      } else if (!subparagraph && sentenceClosingOwner(paragraphBlock.text, token.indent)) {
        // „In der Überschrift wird / a) … und / b) … / ersetzt.“ – der Schlussteil vollendet den
        // Satz des übergeordneten Punkts hinter dessen Unterpunkten.
        const owner = sentenceClosingOwner(paragraphBlock.text, token.indent);
        owner.children.push(paragraphBlock);
        lastBlock = paragraphBlock;
        lastListState.contextInterrupted = true;
      } else if (!subparagraph && ownerAlignedAfterSublist(token)) {
        // „(3) … folgende Vorgaben: / 1. … / 10. … / Weitere Vorgaben … .“ – ein Absatz mit dem
        // Texteinzug des übergeordneten Punkts hinter dessen Unterpunkten ist dessen nächster Satz.
        const owner = ownerAlignedAfterSublist(token);
        owner.children.push(paragraphBlock);
        lastBlock = paragraphBlock;
        lastListState.contextInterrupted = true;
      } else if (outlineHeading) {
        outlineHeading.children.push(paragraphBlock);
        lastBlock = paragraphBlock;
        if (lastListState) lastListState.contextInterrupted = true;
      } else {
        append(paragraphBlock);
        if (lastListState) lastListState.contextInterrupted = true;
      }
      continue;
    }
    if (token.kind === 'table') {
      if (outlineHeading) {
        outlineHeading.children.push(token.block);
        lastBlock = token.block;
        continue;
      }
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
      if (token.opensPrintedSublist && lastBlock?.type === 'subparagraph' && !lastBlock.listId) {
        // Gedruckte Buchstabenfolge unter einem als Absatz gesetzten „(n)“.
        semanticLevel = 1;
        lastBlock.children ??= [];
        destination = lastBlock.children;
        listBaselines.set(token.listId, token.level - semanticLevel);
        parents.clear();
        parents.set(0, lastBlock);
      } else if (token.listId === 'printed-outline' && token.printedLetterKind === 2 && token.counterValue === 1 &&
        lastListState && lastBlock === lastListState.block && /^[a-z][.)]$/u.test(lastListState.block.label ?? '')) {
        // Doppelbuchstaben „aa)“ unmittelbar nach einem Buchstabenpunkt bilden dessen Unterpunkte.
        semanticLevel = lastListState.semanticLevel + 1;
        lastListState.block.children ??= [];
        destination = lastListState.block.children;
        listBaselines.set(token.listId, token.level - semanticLevel);
        parents.clear();
        parents.set(semanticLevel - 1, lastListState.block);
      } else if (token.opensPrintedSublist && lastListState && lastBlock === lastListState.block) {
        // Gedruckte Buchstabenfolge unter der unmittelbar vorangehenden Nummer.
        semanticLevel = lastListState.semanticLevel + 1;
        destination = lastListState.block.children;
        listBaselines.set(token.listId, token.level - semanticLevel);
        parents.clear();
        parents.set(semanticLevel - 1, lastListState.block);
      } else if (semanticLevel > 0) {
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
      if (outlineHeading && token.listId !== 'printed-outline' && destination === currentChildren(stack)) {
        // Eine Liste im Inhalt einer gedruckten Gliederungsnummer: unter einem unmittelbar
        // vorangehenden, als Absatz gesetzten „(n)“ mit tieferem Einzug, sonst unter der Nummer.
        const subparagraphOwner = lastBlock?.type === 'subparagraph' && !lastBlock.listId &&
          outlineHeading.children.includes(lastBlock) && token.indent > (blockIndent.get(lastBlock) ?? 0) + 0.5
          ? lastBlock
          : null;
        const owner = subparagraphOwner ?? outlineHeading;
        semanticLevel = 1;
        owner.children ??= [];
        destination = owner.children;
        listBaselines.set(token.listId, token.level - semanticLevel);
        parents.clear();
        parents.set(0, owner);
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
      const visualSibling = lastListState && token.listId !== lastListState.semanticListId &&
        Math.abs((token.indent ?? 0) - (lastListState.indent ?? 0)) <= 0.5 &&
        token.numberingStyle === lastListState.numberingStyle &&
        listLabelShape(token.label) === listLabelShape(lastListState.block.label) &&
        Number.isInteger(token.counterValue) && token.counterValue === lastListState.counterValue + 1;
      if (visualSibling) {
        semanticLevel = lastListState.semanticLevel;
        destination = lastListState.destination;
        listBaselines.set(token.listId, token.level - semanticLevel);
        parents.clear();
      }
      const deeperVisualIndent = token.indent > (lastListState?.indent ?? 0) + 0.5;
      const continuedAtSameIndent = !parseAmendmentQuotes && token.level > 0 &&
        token.indent >= (lastListState?.indent ?? 0) - 0.5 &&
        LIST_INTRO_END_PATTERN.test(lastListState?.block.text ?? '');
      const directlyAfterItem = Boolean(lastListState) && lastBlock === lastListState.block && !lastListState.contextInterrupted;
      // Eine neue Liste „1.“ unmittelbar nach einer mehrstufigen Ziffer („4.2“) gliedert diese weiter.
      const opensUnderMultilevelNumber = directlyAfterItem && token.counterValue === 1 &&
        /^\d+\.$/u.test(token.label ?? '') && /^\d+(?:\.\d+)+\.?$/u.test(lastListState.block.label ?? '');
      // Eine Buchstabenliste ab „a“ unmittelbar nach einem Nummernpunkt gliedert diesen, auch bei
      // gleichem Einzug.
      // Das gilt auch hinter einem Einleitungssatz des Punkts, der mit Doppelpunkt endet
      // („5. Klassenstufe 10 / Die Lernbereiche 1 bis 4 erhalten folgende Fassung: / a) …“).
      const afterItemIntroduction = Boolean(lastListState) && !lastListState.contextInterrupted &&
        lastListState.continuationOpen && lastBlock?.type === 'paragraphText' &&
        lastListState.block.children?.at(-1) === lastBlock && /:\s*$/u.test(lastBlock.text ?? '');
      const lettersOpenUnderNumber = (directlyAfterItem || afterItemIntroduction) && token.counterValue === 1 &&
        lastListState.block.type === 'item' &&
        numberingRank(token.numberingStyle) === 2 && numberingRank(lastListState.numberingStyle) === 1;
      // Eine tiefer eingerückte neue Liste ab ihrem ersten Wert unmittelbar nach einem Punkt bildet
      // dessen Unterpunkte.
      const opensDeeperUnderItem = directlyAfterItem && deeperVisualIndent && token.counterValue === 1 &&
        lastListState.block.type === 'item';
      const mayUseVisualParent = !visualSibling && (semanticLevel === 0 || continuedAtSameIndent) && lastListState &&
        !QUOTE_TRIGGER_PATTERN.test(lastListState.block.text ?? '') &&
        token.listId !== lastListState.semanticListId &&
        (deeperVisualIndent || continuedAtSameIndent || lastListState.opensSublist || opensUnderMultilevelNumber || lettersOpenUnderNumber) &&
        (
          continuedAtSameIndent ||
          lastListState.opensSublist ||
          opensUnderMultilevelNumber ||
          lettersOpenUnderNumber ||
          opensDeeperUnderItem ||
          lastListState.continuationOpen ||
          /:\s*$/u.test(lastListState.block.text ?? '') ||
          (directlyAfterItem && numberingRank(token.numberingStyle) > numberingRank(lastListState.numberingStyle))
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
        } else if (token.explicitCounter && token.counterValue === lastListState.counterValue &&
          token.counterValue === lastListState.sourceCounterValue) {
          // Eine ausdrücklich gesetzte Wiederholung der vorangehenden Nummer („1., 2., 3., 3.“) ist
          // die gedruckte Zählung der Quelle; sie wird nicht stillschweigend weitergezählt.
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
      childrenOwner.set(block.children, block);
      itemContainer.set(block, destination);
      blockIndent.set(block, token.indent ?? 0);
      parents.set(semanticLevel, block);
      for (const level of [...parents.keys()]) if (level > semanticLevel) parents.delete(level);
      lastBlock = block;
      if (token.listId === 'printed-outline') {
        outlineHeading = !inQuote && parseAmendmentQuotes && isOutlineHeadingItem(token, multilevelOutline) ? block : null;
      }
      lastListState = {
        block,
        counterValue: semanticCounterValue,
        sourceCounterValue: token.counterValue,
        destination,
        numberingStyle: token.numberingStyle,
        semanticLevel,
        semanticListId,
        sourceLevel: token.level,
        structureParent: currentChildren(stack),
        indent: token.indent,
        continuationOpen: false,
        contextInterrupted: false,
        opensSublist: token.opensSublist === true,
      };
      continue;
    }
    if (token.kind === 'quotedGroup') {
      const children = parseTokens(token.tokens, fileName, { inQuote: !token.standalone, parseAmendmentQuotes });
      if (children.length === 0) throw new NormHtmlParseError(fileName, 'zitierte Neufassung besitzt keinen Inhalt');
      const quote = { type: 'quotedProvision', children };
      if (token.attachToPrevious) {
        if (!lastBlock) throw new NormHtmlParseError(fileName, 'zitierte Neufassung kann keiner Änderungsanweisung zugeordnet werden');
        lastBlock.children ??= [];
        lastBlock.children.push(quote);
      } else if (lastListState?.continuationOpen && lastListState.block.children?.at(-1) === lastBlock) {
        // Der Änderungsbefehl ist Fortsetzungsabsatz eines Punkts; sein Zitat gehört in denselben Punkt.
        lastListState.block.children.push(quote);
        lastBlock = quote;
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

/**
 * Quellbefunde eines Normkörpers, die nur mit wörtlich hinterlegtem Nachweis importiert werden:
 * Nummerierungsbefunde und Tabellenzellen, die nur aus einer Abbildung ohne Textalternative bestehen.
 */
export function sourceFindingIssues(body) {
  return [...validateListSequences(body), ...imageOnlyCellIssues(body)];
}

// Befund je Tabellenzelle, die nur eine Abbildung ohne Textalternative enthält: Der Wortlaut der
// Zelle steht dann nur im Bild und fehlt im gespeicherten Text.
function imageOnlyCellIssues(body) {
  const issues = [];
  const visit = (children, path = []) => {
    for (const [index, block] of (children ?? []).entries()) {
      const blockPath = [...path, block.label ?? `${block.type}[${index}]`];
      if (block.type === 'table') {
        block.children.forEach((row, rowIndex) => row.children.forEach((cell, cellIndex) => {
          if (IMAGE_ONLY_CELLS.has(cell)) {
            issues.push(`${blockPath.join(' > ')} > Zeile ${rowIndex + 1}, Zelle ${cellIndex + 1}: Abbildung ohne Textalternative`);
          }
        }));
        continue;
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

/**
 * Prüft den Normkörper. `acceptedSequenceIssues` nennt wörtlich die Befunde der
 * Sequenzvalidierung, die eine amtliche Quelle nachweislich selbst trägt (PDF und HTML
 * stimmen überein, etwa eine übersprungene Nummer im Änderungsbefehl); nur diese Befunde
 * lassen den Import zu, jeder andere bleibt ein Abbruchgrund.
 */
function validateBody(fileName, title, body, { acceptedSequenceIssues = [] } = {}) {
  const flat = flattenBlocks(body);
  const main = flat.filter(({ block, insideQuote }) => !insideQuote && [
    'part', 'chapter', 'section', 'subsection', 'article', 'paragraph', 'annex', 'item', 'subitem', 'table',
  ].includes(block.type));
  if (main.length === 0 && !flat.some(({ block, insideQuote }) => !insideQuote && block.type === 'paragraphText' && block.text?.trim())) {
    throw new NormHtmlParseError(fileName, `„${title}“ enthält keine erkennbare äußere Gliederung`);
  }
  const bodyText = flat.map(({ block }) => `${block.label ?? ''} ${block.title ?? ''} ${block.text ?? ''}`).join(' ');
  const contamination = bodyText.match(CONTAMINATION_PATTERN)?.[0];
  if (contamination) throw new NormHtmlParseError(fileName, `Kopf-, Fuß-, CSS-, Bild- oder Signaturdaten sind in den Normkörper von „${title}“ geraten (${contamination})`);
  const spaced = flat.find(({ block }) => block.type !== 'signature' &&
    ['label', 'title', 'text'].some((field) => hasSpacedLetters(block[field])));
  if (spaced) {
    throw new NormHtmlParseError(fileName, `gesperrt gesetzter Text im Normkörper von „${title}“: Unterschriften gehören in einen Unterschriftenblock, Hervorhebungen werden ohne Sperrung gespeichert (${[spaced.block.label, spaced.block.title, spaced.block.text].filter(Boolean).join(' ').slice(0, 80)})`);
  }
  const sequenceIssues = sourceFindingIssues(body).filter((issue) => !acceptedSequenceIssues.includes(issue));
  if (sequenceIssues.length > 0) {
    throw new NormHtmlParseError(fileName, `needs-review: ${sequenceIssues.join('; ')}`);
  }
}

/**
 * Inkrafttreten aus der Inkrafttretensformel. Verwaltungsvorschriften und Förderrichtlinien
 * knüpfen an die Veröffentlichung oder Bekanntmachung statt an die Verkündung an; maßgeblich ist
 * jeweils das Ausgabedatum. „Tag nach …“ wird nur in der gefundenen Formel ausgewertet, nicht im
 * übrigen Normtext.
 */
export function inferEffectiveDate(text, publicationDate) {
  if (/tritt\s+am\s+ersten\s+Tag\s+des\s+ersten\s+Monats\s+nach\s+(?:(?:seiner|der)\s+)?Verkündung\s+in\s+Kraft/iu.test(text)) {
    return firstDayOfNextMonth(publicationDate);
  }
  const relative = text.match(/tritt\s+(?:am|mit\s+dem)\s+Tag(?:e)?\s+(nach\s+)?(?:seiner|ihrer|der)\s+(?:Verkündung|Veröffentlichung|Bekanntmachung|Bekanntgabe)\s+in\s+Kraft/iu);
  if (relative) {
    return relative[1] ? addUtcDays(publicationDate, 1) : publicationDate;
  }
  const explicit = text.match(/tritt\s+am\s+(\d{1,2}\.\s*[A-ZÄÖÜa-zäöüß]+\s+\d{4})\s+in\s+Kraft/iu);
  return explicit ? parseGermanDate(explicit[1]) : null;
}

function partialHeadingDate(value, fallbackDate) {
  const match = String(value ?? '').match(PARTIAL_DATE_PATTERN);
  if (!match || !fallbackDate || !/\bvom\s*$/iu.test(String(value).slice(0, match.index))) return null;
  return `${fallbackDate.slice(0, 4)}-${GERMAN_MONTHS[match[2].toLocaleLowerCase('de')]}-${match[1].padStart(2, '0')}`;
}

function sanitizeNormNodes(nodes) {
  const result = [];
  let signature = false;
  for (const node of nodes) {
    const text = textOf(node);
    const marker = parseHtmlStructureMarker(normalizeHtmlText(textWithBreaks(node)));
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

function headingRanges(nodes, tocIndex, css, publicationDate) {
  const ranges = [];
  let floor = tocIndex + 1;
  for (let end = tocIndex + 1; end < nodes.length; end += 1) {
    const endText = textOf(nodes[end]);
    if (nodes[end].tagName === 'table' || /^(?:Seite\s*)?\d+$/iu.test(endText)) floor = end + 1;
    const documentDate = parseGermanDate(endText) ?? partialHeadingDate(endText, publicationDate);
    if (!documentDate) continue;
    for (let start = end; start >= Math.max(floor, end - 3); start -= 1) {
      const text = normalizeHeadingText(nodes.slice(start, end + 1).map(textOf).join(' '));
      const presentedAsHeading = start === floor || nodes.slice(start, end + 1).some((node) =>
        /^h[1-6]$/u.test(node.tagName) || linesOf(node).length > 1 || isBold(node, css) || isCentered(node, css)
      );
      if ((ranges.length > 0 && !presentedAsHeading) || !SOURCE_HEADING_START_PATTERN.test(text) || !/\bvom\s+\d{1,2}\./iu.test(text)) continue;
      ranges.push({ start, end, text, documentDate });
      floor = end + 1;
      break;
    }
  }
  return ranges;
}

function extractIntroducedNorms(tokens, publication, fileName, options = {}) {
  const introduced = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    let end = index + 1;
    while (end < tokens.length && !isOuterArticleToken(tokens[end])) end += 1;
    const segment = tokens.slice(index + 1, end);
    const firstStructure = segment.findIndex((entry) => entry.kind === 'structure');
    const titleText = firstStructure >= 0
      ? segment.slice(0, firstStructure).filter((entry) => entry.kind === 'paragraph').map((entry) => entry.text).join(' ')
      : '';
    // Ein Mantelartikel kann den vollständigen Stammnormtitel selbst tragen.
    // Änderungsüberschriften sind ausgeschlossen; erforderlich bleibt eine eigene Gliederung.
    const directArticleTitle = isOuterArticleToken(token) &&
      introducedArticleTitle(token) && firstStructure === 0
      ? introducedArticleTitle(token) : null;
    const rawIdentity = (directArticleTitle ?? titleText).replace(/^[„“”'`,.]+/u, '').trim();
    const introduction = token.kind === 'paragraph' ? token.text.match(INTRODUCTION_PATTERN) : null;
    const articleIntroduction = token.kind === 'structure' && token.marker.type === 'article' &&
      /^Einführung\s+(?:eines|einer)\s+.*?(?:gesetzes|verordnung|satzung)\b/iu.test(token.marker.title ?? '') &&
      /^(?:(?:Besonderes|Gemeinsames)\s+)?(?:Gesetz|Verordnung|Satzung)\b/iu.test(rawIdentity) &&
      !segment.some((entry) => entry.kind === 'paragraph' && INTRODUCTION_PATTERN.test(entry.text));
    if (!introduction && !articleIntroduction && !directArticleTitle) continue;
    if (firstStructure < 0) throw new NormHtmlParseError(fileName, `eingeführte Stammnorm nach „${token.text ?? token.marker.title}“ besitzt keine Hauptgliederung`);
    const heading = introduction?.[1] ?? (introduction?.[2]
      ? 'Gesetz'
      : rawIdentity.match(/^(?:(?:Besonderes|Gemeinsames)\s+)?(?:Gesetz|Verordnung|Satzung)\b/iu)?.[0]);
    if (!heading) throw new NormHtmlParseError(fileName, `Dokumenttyp der eingeführten Stammnorm „${rawIdentity}“ fehlt`);
    const replacementMatch = introduction?.[2] ? rawIdentity.match(/^(.+?)\s*\(([^()]+)\)\s*$/u) : null;
    const identity = replacementMatch
      ? { title: replacementMatch[1].trim(), shortTitle: replacementMatch[1].trim(), abbr: replacementMatch[2].trim() }
      : parseIdentity(heading, rawIdentity);
    const identityLines = directArticleTitle ? token.rawText.split('\n').slice(1).map((line) => line.trim()).filter(Boolean) : [];
    // Eigenständige Zeilen für Langtitel, Kurzbezeichnung und (Abkürzung).
    if (identityLines.length >= 3 && /^\([^()]+\)$/u.test(identityLines.at(-1))) {
      identity.title = identityLines.slice(0, -2).join(' ');
      identity.shortTitle = identityLines.at(-2);
      identity.abbr = identityLines.at(-1).slice(1, -1);
    }
    const body = parseTokens(segment.slice(firstStructure), fileName, { inQuote: false });
    validateBody(fileName, identity.title, body, options);
    introduced.push({
      kind: introduction?.[2] ? 'replacement' : 'introduced',
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

// Anlagen hinter dem letzten Artikel eines Mantelgesetzes, deren Bezeichnung auf Paragraphen
// verweist („Anlage 1 (Staatswappen, § 3)“), gehören zur einzigen eingeführten Stammnorm: Der
// Mantel selbst hat keine Paragraphen. Die Anlagen bleiben an der abgedruckten Stelle im Mantel.
function assignTrailingAnnexesToIntroducedNorm(publication) {
  const introduced = publication.introducedNorms;
  if (introduced.length !== 1 || introduced[0].kind !== 'introduced' ||
    publication.body.some((block) => block.type === 'paragraph')) return;
  const trailing = [];
  for (let index = publication.body.length - 1; index >= 0 && publication.body[index].type === 'annex'; index -= 1) {
    trailing.unshift(publication.body[index]);
  }
  if (trailing.length === 0 || !trailing.every((annex) => /§\s*\d/u.test(`${annex.label ?? ''} ${annex.title ?? ''}`))) return;
  if (introduced[0].body.some((block) => block.type === 'annex')) return;
  introduced[0].body.push(...structuredClone(trailing));
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
  raiseSuperscriptDigits(body, css);
  return { document, body, css, nodes: flowNodes(body), documentText: textOf(body) };
}

const SUPERSCRIPT_DIGITS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

// Hochgestellte Ziffern („m<sup>2</sup>“ oder eine Klasse mit vertical-align:super) sind Teil des
// Wortlauts („150 m²“). Sie werden als hochgestellte Zeichen übernommen, damit die Textextraktion
// sie nicht zur Grundlinie abflacht („150 m2“). Andere hochgestellte Inhalte bleiben unverändert.
function raiseSuperscriptDigits(node, css) {
  for (const child of node.childNodes ?? []) {
    if (!child.tagName) continue;
    const superscript = child.tagName === 'sup' || /^super$/iu.test(nodeStyle(child, css)['vertical-align'] ?? '');
    if (superscript && /^\d+$/u.test(textWithBreaks(child).trim())) {
      const raise = (entry) => {
        if (entry.nodeName === '#text') entry.value = entry.value.replace(/\d/gu, (digit) => SUPERSCRIPT_DIGITS[digit]);
        for (const nested of entry.childNodes ?? []) raise(nested);
      };
      raise(child);
      continue;
    }
    raiseSuperscriptDigits(child, css);
  }
}

/**
 * Ausgabekopf einer ostdeutschen Verkündungsreihe: Ausgabenummer und Ausgabedatum stehen im
 * Dokument selbst, nicht im Dateinamen.
 */
function publicationIssueHeader(nodes) {
  const headerText = nodes.slice(0, 10).map(textOf).join(' ');
  return {
    issueMatch: headerText.match(/\bNr\.\s*(\d+)\b/u),
    publicationDate: parseGermanDate(headerText.match(/Ausgegeben\s+zu[\s\S]{0,120}/iu)?.[0] ?? headerText),
  };
}

/**
 * Eine Ausgabe kann ausschließlich nichtnormative Veröffentlichungen enthalten, zum Beispiel
 * einen Bericht eines Verfassungsorgans. Sie bleibt ein Verkündungsblatt, trägt aber keine
 * Rechtsvorschrift und ist deshalb keine Normimportquelle. Maßgeblich ist dieselbe
 * Überschriftenerkennung wie beim Import; ohne erkennbaren Ausgabekopf oder Inhaltsverzeichnis
 * bleibt die Einordnung dem Parser überlassen.
 */
function publishesLegalInstrument(nodes, css) {
  const { publicationDate } = publicationIssueHeader(nodes);
  const tocIndex = nodes.findIndex((node) => /^Inhaltsverzeichnis$/iu.test(textOf(node)));
  if (!publicationDate || tocIndex < 0) return true;
  return headingRanges(nodes, tocIndex, css, publicationDate).length > 0;
}

export function classifyHtmlSource(fileName, html) {
  const { documentText, nodes, css } = parsedDocument(fileName, html);
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
  if (publication) {
    const normative = publicationIdentity.publication === 'GMBl.' || publishesLegalInstrument(nodes, css);
    return {
      kind: 'publication',
      publication: publicationIdentity.publication,
      normative,
      reason: normative
        ? `${publicationIdentity.longName} mit internem Ausgabekopf und Inhaltsverzeichnis`
        : `${publicationIdentity.longName} ohne Rechtsvorschrift; die Ausgabe enthält ausschließlich eine nichtnormative Veröffentlichung`,
    };
  }
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
  const documentDate = range.documentDate ?? parseGermanDate(range.text);
  if (!documentDate) throw new NormHtmlParseError(fileName, 'Dokumentdatum in der Normüberschrift fehlt');
  const dateMatch = range.text.match(DATE_PATTERN) ?? range.text.match(PARTIAL_DATE_PATTERN);
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

export function parsePublicationHtml(fileName, html, options = {}) {
  const classification = classifyHtmlSource(fileName, html);
  if (classification.kind !== 'publication') throw new NormHtmlParseError(fileName, `Quelle ist kein Verkündungsblatt (${classification.reason})`);
  const { nodes, css } = parsedDocument(fileName, html);
  if (classification.publication === 'GMBl.') {
    return parseFederalMinisterialGazette(fileName, nodes, css, classification);
  }
  const { issueMatch, publicationDate } = publicationIssueHeader(nodes);
  if (!issueMatch || !publicationDate) throw new NormHtmlParseError(fileName, 'Ausgabenummer oder Ausgabedatum konnte nicht aus dem Inhalt bestimmt werden');
  const tocIndex = nodes.findIndex((node) => /^Inhaltsverzeichnis$/iu.test(textOf(node)));
  if (tocIndex < 0) throw new NormHtmlParseError(fileName, 'Inhaltsverzeichnis fehlt');
  const ranges = headingRanges(nodes, tocIndex, css, publicationDate);
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
  validateBody(fileName, mainIdentity.title, body, options);
  const effectiveDate = inferEffectiveDate(bodyNodes.map(textOf).join(' '), publicationDate);
  const publication = {
    kind: 'publication', fileName, issue: issueMatch[1], publication: classification.publication, year: Number(publicationDate.slice(0, 4)), publicationDate,
    effectiveDate, ...mainIdentity,
    type: sourceTypeFromHeading(mainIdentity.heading, mainIdentity.title),
    ...(startPage ? { startPage } : {}), body,
  };
  publication.introducedNorms = extractIntroducedNorms(rawTokens, publication, fileName, options);
  assignTrailingAnnexesToIntroducedNorm(publication);
  for (let rangeIndex = 1; rangeIndex < ranges.length; rangeIndex += 1) {
    const range = ranges[rangeIndex];
    const nextStart = ranges[rangeIndex + 1]?.start ?? nodes.length;
    const identity = preferTocTitle(parseHeadingRange(range, fileName), toc[rangeIndex]?.title);
    const secondaryNodes = sanitizeNormNodes(nodes.slice(range.end + 1, nextStart));
    const secondaryBody = parseTokens(makeAtomicTokens(secondaryNodes, css, fileName), fileName);
    validateBody(fileName, identity.title, secondaryBody, options);
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
      const marker = parseHtmlStructureMarker(normalizeHtmlText(textWithBreaks(node)));
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
