import type { NormBodyBlock, NormVersion, StructureType, TableHeaderScope } from '@ostrecht/shared/lib/norms/schema.ts';

export type NormDiffKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface NormDiffUnit {
  key: string;
  type: string;
  label: string;
  beforeTitle?: string;
  afterTitle?: string;
  contextTitle?: string;
  beforeText?: string;
  afterText?: string;
  kind: NormDiffKind;
  textDiff?: Array<{ kind: 'same' | 'insert' | 'delete'; text: string }>;
  sentenceChanges?: Array<{ before?: string; after?: string; kind: NormDiffKind }>;
  provisionLabel?: string;
  provisionTitle?: string;
  beforeProvisionText?: string;
  afterProvisionText?: string;
}

export interface NormDiffSummary {
  changed: number;
  added: number;
  removed: number;
  unchanged: number;
}

export interface NormProvisionDiff {
  key: string;
  type: StructureType;
  kind: Exclude<NormDiffKind, 'unchanged'>;
  before?: NormDiffValue;
  after?: NormDiffValue;
  children: NormDiffBlock[];
  /** Überschrift der früheren Gliederungseinheit, wenn die Einheit in eine andere gewandert ist („II. Abschnitt Die Grundrechte“). */
  movedFrom?: string;
  /** Nur die Überschrift einer umbenannten, neuen oder entfallenen Gliederungseinheit – ihre Einheiten stehen einzeln. */
  headingOnly?: boolean;
  /** Kompatibilitätsdarstellung für bestehende Verbraucher; die Vergleichsansicht nutzt children. */
  beforeText?: string;
  afterText?: string;
  titleDiff?: Array<{ kind: 'same' | 'insert' | 'delete'; text: string }>;
  labelDiff?: Array<{ kind: 'same' | 'insert' | 'delete'; text: string }>;
  textDiff?: Array<{ kind: 'same' | 'insert' | 'delete'; text: string }>;
}

export interface NormDiffValue {
  type: StructureType;
  label?: string;
  title?: string;
  text?: string;
  level?: number;
  listId?: string;
  numberingStyle?: string;
  scope?: TableHeaderScope;
  rowspan?: number;
  colspan?: number;
  columns?: number;
}

export interface NormDiffBlock {
  key: string;
  type: StructureType;
  kind: NormDiffKind;
  before?: NormDiffValue;
  after?: NormDiffValue;
  children: NormDiffBlock[];
  beforeIndex?: number;
  afterIndex?: number;
  /** Überschrift der Gliederungseinheit, aus der die Einheit gewandert ist (dokumentweite Paarung). */
  movedFrom?: string;
  label?: string;
  beforeTitle?: string;
  afterTitle?: string;
  beforeText?: string;
  afterText?: string;
  titleDiff?: Array<{ kind: 'same' | 'insert' | 'delete'; text: string }>;
  labelDiff?: Array<{ kind: 'same' | 'insert' | 'delete'; text: string }>;
  textDiff?: Array<{ kind: 'same' | 'insert' | 'delete'; text: string }>;
}

interface FlatUnit {
  key: string;
  type: string;
  label: string;
  title: string;
  contextTitle: string;
  text: string;
  provisionLabel: string;
  provisionTitle: string;
  provisionText: string;
}

const UNIT_TYPES = new Set([
  'part', 'chapter', 'paragraph', 'article', 'section', 'subsection', 'annex', 'subparagraph',
  'paragraphText', 'item', 'subitem', 'tableRow', 'tableCell', 'tableHeaderCell', 'signature',
]);

function directText(block: NormBodyBlock): string {
  return [block.text]
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/gu, ' ')
    .trim();
}

function fullProvisionText(block: NormBodyBlock): string {
  const lines: string[] = [];
  const visit = (entry: NormBodyBlock, includeHeading: boolean) => {
    const heading = includeHeading ? [entry.label, entry.title].filter(Boolean).join(' ') : '';
    if (heading) lines.push(heading);
    const text = directText(entry);
    if (text) lines.push([includeHeading ? '' : entry.label, text].filter(Boolean).join(' '));
    entry.children?.forEach((child) => visit(child, false));
  };
  visit(block, true);
  return lines.join('\n').trim();
}

export function flattenVersionUnits(version: Pick<NormVersion, 'body'>): FlatUnit[] {
  const units: FlatUnit[] = [];
  const occurrence = new Map<string, number>();

  function visit(
    blocks: NormBodyBlock[],
    path: string[] = [],
    quoted = false,
    inheritedLabel = '',
    inheritedTitle = '',
    provision: { label: string; title: string; text: string } = { label: '', title: '', text: '' },
  ): void {
    for (const [index, block] of blocks.entries()) {
      if (block.type === 'quotedProvision') {
        continue;
      }

      const currentProvision = block.type === 'paragraph' || block.type === 'article'
        ? { label: block.label ?? '', title: block.title ?? '', text: fullProvisionText(block) }
        : provision;

      if (!quoted && UNIT_TYPES.has(block.type)) {
        const label = block.label ?? inheritedLabel;
        const identity = label || block.title || `${block.type}-${index + 1}`;
        const base = [...path, `${block.type}:${identity}`].join('/');
        const count = (occurrence.get(base) ?? 0) + 1;
        occurrence.set(base, count);
        units.push({
          key: count === 1 ? base : `${base}:${count}`,
          type: block.type,
          label,
          title: block.title ?? '',
          contextTitle: block.title ?? inheritedTitle,
          text: directText(block),
          provisionLabel: currentProvision.label,
          provisionTitle: currentProvision.title,
          provisionText: currentProvision.text,
        });
      }

      if (block.children) {
        const parentIdentity = block.label || block.title || `${block.type}-${index + 1}`;
        visit(
          block.children,
          [...path, `${block.type}:${parentIdentity}`],
          quoted,
          block.label ?? inheritedLabel,
          block.title ?? inheritedTitle,
          currentProvision,
        );
      }
    }
  }

  visit(version.body);
  return units;
}

export function summarizeNormDiff(diff: NormDiffUnit[]): NormDiffSummary {
  return diff.reduce<NormDiffSummary>((summary, unit) => {
    summary[unit.kind] += 1;
    return summary;
  }, { changed: 0, added: 0, removed: 0, unchanged: 0 });
}

function hasReadableWordDiff(
  chunks: Array<{ kind: 'same' | 'insert' | 'delete'; text: string }>,
  before: string,
  after: string,
): boolean {
  const longest = Math.max(before.length, after.length);
  if (longest === 0) return false;
  const sameLength = chunks
    .filter((chunk) => chunk.kind === 'same')
    .reduce((sum, chunk) => sum + chunk.text.length, 0);
  return sameLength / longest >= 0.35;
}

export function segmentSentences(value: string): string[] {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (!normalized) return [];
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return [...new Intl.Segmenter('de', { granularity: 'sentence' }).segment(normalized)]
      .map((entry) => entry.segment.trim())
      .filter(Boolean);
  }
  return normalized.match(/.+?(?:[.!?](?=\s|$)|$)/gu)?.map((entry) => entry.trim()).filter(Boolean) ?? [normalized];
}

export function diffSentences(
  before: string,
  after: string,
): Array<{ before?: string; after?: string; kind: NormDiffKind }> {
  const left = segmentSentences(before);
  const right = segmentSentences(after);
  return Array.from({ length: Math.max(left.length, right.length) }, (_, index) => {
    const beforeSentence = left[index];
    const afterSentence = right[index];
    if (beforeSentence === afterSentence) return { before: beforeSentence, after: afterSentence, kind: 'unchanged' };
    if (beforeSentence === undefined) return { after: afterSentence, kind: 'added' };
    if (afterSentence === undefined) return { before: beforeSentence, kind: 'removed' };
    return { before: beforeSentence, after: afterSentence, kind: 'changed' };
  });
}

function tokenize(value: string): string[] {
  return value.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? [];
}

export function diffWords(
  before: string,
  after: string,
): Array<{ kind: 'same' | 'insert' | 'delete'; text: string }> {
  const left = tokenize(before);
  const right = tokenize(after);
  const table = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] = left[i] === right[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const chunks: Array<{ kind: 'same' | 'insert' | 'delete'; text: string }> = [];
  const push = (kind: 'same' | 'insert' | 'delete', text: string) => {
    const previous = chunks.at(-1);
    if (previous?.kind === kind) previous.text += text;
    else chunks.push({ kind, text });
  };

  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      push('same', left[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push('delete', left[i]);
      i += 1;
    } else {
      push('insert', right[j]);
      j += 1;
    }
  }
  while (i < left.length) push('delete', left[i++]);
  while (j < right.length) push('insert', right[j++]);
  return chunks;
}

export function buildStructuralVersionDiff(
  before: Pick<NormVersion, 'body'>,
  after: Pick<NormVersion, 'body'>,
): NormDiffUnit[] {
  const left = flattenVersionUnits(before);
  const right = flattenVersionUnits(after);
  const leftByKey = new Map(left.map((unit) => [unit.key, unit]));
  const rightByKey = new Map(right.map((unit) => [unit.key, unit]));
  const keys = [...new Set([...left.map((unit) => unit.key), ...right.map((unit) => unit.key)])];

  return keys.map((key) => {
    const beforeUnit = leftByKey.get(key);
    const afterUnit = rightByKey.get(key);
    if (!beforeUnit && afterUnit) {
      return {
        key,
        type: afterUnit.type,
        label: afterUnit.label,
        afterTitle: afterUnit.title,
        contextTitle: afterUnit.contextTitle,
        afterText: afterUnit.text,
        provisionLabel: afterUnit.provisionLabel,
        provisionTitle: afterUnit.provisionTitle,
        afterProvisionText: afterUnit.provisionText,
        kind: 'added',
      };
    }
    if (beforeUnit && !afterUnit) {
      return {
        key,
        type: beforeUnit.type,
        label: beforeUnit.label,
        beforeTitle: beforeUnit.title,
        contextTitle: beforeUnit.contextTitle,
        beforeText: beforeUnit.text,
        provisionLabel: beforeUnit.provisionLabel,
        provisionTitle: beforeUnit.provisionTitle,
        beforeProvisionText: beforeUnit.provisionText,
        kind: 'removed',
      };
    }

    const titleChanged = beforeUnit!.title !== afterUnit!.title;
    const textChanged = beforeUnit!.text !== afterUnit!.text;
    const textDiff = textChanged ? diffWords(beforeUnit!.text, afterUnit!.text) : undefined;
    return {
      key,
      type: beforeUnit!.type,
      label: beforeUnit!.label,
      beforeTitle: beforeUnit!.title,
      afterTitle: afterUnit!.title,
      contextTitle: afterUnit!.contextTitle || beforeUnit!.contextTitle,
      beforeText: beforeUnit!.text,
      afterText: afterUnit!.text,
      kind: titleChanged || textChanged ? 'changed' : 'unchanged',
      textDiff: textDiff && hasReadableWordDiff(textDiff, beforeUnit!.text, afterUnit!.text)
        ? textDiff
        : undefined,
      sentenceChanges: textChanged ? diffSentences(beforeUnit!.text, afterUnit!.text) : undefined,
      provisionLabel: afterUnit!.provisionLabel || beforeUnit!.provisionLabel,
      provisionTitle: afterUnit!.provisionTitle || beforeUnit!.provisionTitle,
      beforeProvisionText: beforeUnit!.provisionText,
      afterProvisionText: afterUnit!.provisionText,
    };
  });
}

const DIFF_VALUE_FIELDS = [
  'label', 'title', 'text', 'level', 'listId', 'numberingStyle',
  'scope', 'rowspan', 'colspan', 'columns',
] as const;

function diffValue(block: NormBodyBlock): NormDiffValue {
  const value: NormDiffValue = { type: block.type };
  for (const field of DIFF_VALUE_FIELDS) {
    const fieldValue = block[field];
    if (fieldValue !== undefined) value[field] = fieldValue as never;
  }
  return value;
}

function comparableText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/gu, ' ').trim();
}

function blockSegment(block: NormBodyBlock, occurrences: Map<string, number>): string {
  const identity = block.label ? `label:${block.label}` : `position:${block.type}`;
  const count = (occurrences.get(identity) ?? 0) + 1;
  occurrences.set(identity, count);
  return `${block.type}:${identity}:${count}`;
}

/**
 * Ähnlichkeitsschwelle für Absätze ohne Gliederungszeichen: erreicht ein Paar sie, gilt der Absatz
 * als geändert und wird wortweise verglichen; darunter ist der alte Absatz entfallen und der neue
 * hinzugekommen. Gemessen als Anteil unveränderter Zeichen an der längeren der beiden Fassungen –
 * dieselbe Größe wie in `hasReadableWordDiff`.
 */
export const UNLABELED_PAIRING_THRESHOLD = 0.5;

/** Obergrenze der Paarungsmatrix; darüber bleibt es bei der Paarung in Reihenfolge. */
const UNLABELED_PAIRING_LIMIT = 160_000;

/**
 * Zellen tragen ihre Bedeutung aus der Spaltenposition und werden deshalb weiter der Reihe nach
 * gepaart. Unterschriften ebenso: sie stehen in fester Reihenfolge am Ende der Vorschrift, und ein
 * Wechsel der unterzeichnenden Person ist eine Änderung derselben Stelle, kein Wegfall.
 */
const POSITIONAL_BLOCK_TYPES = new Set(['tableCell', 'tableHeaderCell', 'signature']);

function blockSignature(block: NormBodyBlock): string {
  return `${block.type} ${comparableText(block.text)} ${comparableText(block.title)}`;
}

function blockContent(block: NormBodyBlock): string {
  return [comparableText(block.title), comparableText(block.text)].filter(Boolean).join(' ');
}

/** Anteil gemeinsamer Zeichen an der längeren Fassung (0 bis 1); zwei textlose Blöcke gelten als gleich. */
function blockSimilarity(before: NormBodyBlock, after: NormBodyBlock): number {
  const left = blockContent(before);
  const right = blockContent(after);
  const longest = Math.max(left.length, right.length);
  if (longest === 0) return 1;
  const same = diffWords(left, right)
    .filter((chunk) => chunk.kind === 'same')
    .reduce((sum, chunk) => sum + chunk.text.length, 0);
  return same / longest;
}

/** Längste gemeinsame Teilfolge zweier Signaturfolgen als Indexpaare (Standard-DP wie `diffWords`). */
function longestCommonSubsequence(left: string[], right: string[]): Array<[number, number]> {
  const table = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

/**
 * Reste zwischen zwei gleichen Absätzen inhaltlich paaren: das ähnlichste Paar zuerst, danach nur
 * noch Paare, die die Reihenfolge nicht kreuzen. Was die Schwelle nicht erreicht, bleibt ungepaart
 * (entfallen bzw. neu).
 */
function pairBySimilarity(
  beforeIndexes: number[],
  afterIndexes: number[],
  before: NormBodyBlock[],
  after: NormBodyBlock[],
): Array<[number, number]> {
  const candidates: Array<{ before: number; after: number; similarity: number }> = [];
  for (const beforeIndex of beforeIndexes) {
    for (const afterIndex of afterIndexes) {
      const similarity = blockSimilarity(before[beforeIndex], after[afterIndex]);
      if (similarity >= UNLABELED_PAIRING_THRESHOLD) candidates.push({ before: beforeIndex, after: afterIndex, similarity });
    }
  }
  candidates.sort((left, right) => right.similarity - left.similarity || left.before - right.before);
  const accepted: Array<[number, number]> = [];
  const usedBefore = new Set<number>();
  const usedAfter = new Set<number>();
  for (const candidate of candidates) {
    if (usedBefore.has(candidate.before) || usedAfter.has(candidate.after)) continue;
    const crosses = accepted.some(([beforeIndex, afterIndex]) =>
      (candidate.before < beforeIndex && candidate.after > afterIndex) ||
      (candidate.before > beforeIndex && candidate.after < afterIndex));
    if (crosses) continue;
    accepted.push([candidate.before, candidate.after]);
    usedBefore.add(candidate.before);
    usedAfter.add(candidate.after);
  }
  return accepted;
}

/**
 * Blöcke ohne Gliederungszeichen paaren: zuerst die längste gemeinsame Teilfolge wortgleicher
 * Absätze (sie bleiben unverändert und tauchen im Vergleich nicht auf), danach die Reste zwischen
 * zwei solchen Ankern nach Ähnlichkeit. So gilt eine umformulierte Zeile als geändert und eine
 * gestrichene als entfallen, statt beides an der Position zu verrechnen.
 */
function pairUnlabeledBlocks(
  beforeIndexes: number[],
  afterIndexes: number[],
  before: NormBodyBlock[],
  after: NormBodyBlock[],
): Array<[number, number]> {
  if (beforeIndexes.length === 0 || afterIndexes.length === 0) return [];
  if (beforeIndexes.length * afterIndexes.length > UNLABELED_PAIRING_LIMIT) {
    const length = Math.min(beforeIndexes.length, afterIndexes.length);
    return Array.from({ length }, (_, index) => [beforeIndexes[index], afterIndexes[index]] as [number, number]);
  }
  const anchors = longestCommonSubsequence(
    beforeIndexes.map((index) => blockSignature(before[index])),
    afterIndexes.map((index) => blockSignature(after[index])),
  );
  const pairs: Array<[number, number]> = [];
  let left = 0;
  let right = 0;
  for (const [anchorLeft, anchorRight] of [...anchors, [beforeIndexes.length, afterIndexes.length] as [number, number]]) {
    pairs.push(...pairBySimilarity(beforeIndexes.slice(left, anchorLeft), afterIndexes.slice(right, anchorRight), before, after));
    if (anchorLeft < beforeIndexes.length) pairs.push([beforeIndexes[anchorLeft], afterIndexes[anchorRight]]);
    left = anchorLeft + 1;
    right = anchorRight + 1;
  }
  return pairs;
}

/**
 * Dokumentweite Paarung (N11): Beschriftete Einheiten – Paragraphen, Artikel, Anlagen – werden
 * über Art und normalisiertes Gliederungszeichen in der ganzen Vorschrift gepaart, gleich in
 * welcher Gliederungseinheit sie stehen. Ein Gliederungszeichen zählt nur, wenn es je Fassung
 * genau einmal vorkommt; sonst gilt für dieses Zeichen die Geschwisterregel. Gliederungsblöcke
 * werden danach nach Inhalt gepaart, nicht nach Ordnungszahl.
 */
const UNIT_BLOCK_TYPES = new Set<NormBodyBlock['type']>(['paragraph', 'article', 'annex']);
const DIVISION_BLOCK_TYPES = new Set<NormBodyBlock['type']>(['part', 'chapter', 'section', 'subsection']);

interface UnitEntry {
  block: NormBodyBlock;
  parent?: NormBodyBlock;
}

interface PairingContext {
  /** Dokumentweit eindeutige, in beiden Fassungen vorhandene Einheiten je Fassung. */
  before: Map<string, UnitEntry>;
  after: Map<string, UnitEntry>;
  /** Einheiten, die in eine andere Gliederungseinheit gewandert sind. */
  moved: number;
  /** Schlüssel der dokumentweit gepaarten Einheiten je Gliederungsblock (Überdeckung). */
  keysWithin: WeakMap<NormBodyBlock, Set<string>>;
}

function unitKey(block: NormBodyBlock): string | undefined {
  if (!UNIT_BLOCK_TYPES.has(block.type) || !block.label) return undefined;
  return `${block.type}|${block.label.replace(/\s+/gu, ' ').trim().toLocaleLowerCase('de-DE')}`;
}

function collectUnits(blocks: NormBodyBlock[], parent: NormBodyBlock | undefined, into: Map<string, UnitEntry[]>): void {
  for (const block of blocks) {
    if (block.type === 'quotedProvision') continue;
    const key = unitKey(block);
    if (key) into.set(key, [...(into.get(key) ?? []), { block, parent }]);
    if (block.children) collectUnits(block.children, block, into);
  }
}

function createPairingContext(beforeBody: NormBodyBlock[], afterBody: NormBodyBlock[]): PairingContext {
  const unique = (body: NormBodyBlock[]): Map<string, UnitEntry> => {
    const all = new Map<string, UnitEntry[]>();
    collectUnits(body, undefined, all);
    return new Map([...all].filter(([, entries]) => entries.length === 1).map(([key, [entry]]) => [key, entry]));
  };
  const before = unique(beforeBody);
  const after = unique(afterBody);
  for (const key of [...before.keys()]) if (!after.has(key)) before.delete(key);
  for (const key of [...after.keys()]) if (!before.has(key)) after.delete(key);
  return { before, after, moved: 0, keysWithin: new WeakMap() };
}

/** Dokumentweit gepaarte Einheiten innerhalb eines Blocks (für die Überdeckung von Gliederungsblöcken). */
function pairedKeysWithin(block: NormBodyBlock, context: PairingContext): Set<string> {
  const cached = context.keysWithin.get(block);
  if (cached) return cached;
  const keys = new Set<string>();
  const visit = (entries: NormBodyBlock[]): void => {
    for (const entry of entries) {
      if (entry.type === 'quotedProvision') continue;
      const key = unitKey(entry);
      if (key && context.before.has(key)) keys.add(key);
      if (entry.children) visit(entry.children);
    }
  };
  if (block.children) visit(block.children);
  context.keysWithin.set(block, keys);
  return keys;
}

function headingOf(block: NormBodyBlock | undefined): string {
  return block ? [comparableText(block.label), comparableText(block.title)].filter(Boolean).join(' ') : '';
}

/**
 * Gliederungsblöcke unter Geschwistern paaren: zuerst nach Inhalt (der Block mit den meisten
 * gemeinsamen, dokumentweit gepaarten Einheiten; Überdeckung mindestens die Hälfte der kleineren
 * Menge), dann nach gleicher Überschrift, zuletzt nach Ordnungszahl. Ein umbenannter oder neu
 * nummerierter Abschnitt mit demselben Inhalt bleibt so „geändert“ statt „entfallen + neu“.
 */
function pairDivisions(
  before: NormBodyBlock[],
  after: NormBodyBlock[],
  usedAfter: Set<number>,
  context: PairingContext | undefined,
): Map<number, number> {
  const matches = new Map<number, number>();
  const beforeIndexes = before.map((block, index) => ({ block, index })).filter(({ block }) => DIVISION_BLOCK_TYPES.has(block.type));
  const afterIndexes = after.map((block, index) => ({ block, index })).filter(({ block, index }) => DIVISION_BLOCK_TYPES.has(block.type) && !usedAfter.has(index));
  const open = () => beforeIndexes.filter(({ index }) => !matches.has(index));
  const free = () => afterIndexes.filter(({ index }) => !usedAfter.has(index));
  if (context) {
    const candidates: Array<{ before: number; after: number; shared: number; ratio: number }> = [];
    for (const left of open()) {
      const leftKeys = pairedKeysWithin(left.block, context);
      if (leftKeys.size === 0) continue;
      for (const right of free()) {
        if (right.block.type !== left.block.type) continue;
        const rightKeys = pairedKeysWithin(right.block, context);
        if (rightKeys.size === 0) continue;
        let shared = 0;
        for (const key of leftKeys) if (rightKeys.has(key)) shared += 1;
        const ratio = shared / Math.min(leftKeys.size, rightKeys.size);
        if (ratio >= 0.5) candidates.push({ before: left.index, after: right.index, shared, ratio });
      }
    }
    candidates.sort((a, b) => b.shared - a.shared || b.ratio - a.ratio || a.before - b.before || a.after - b.after);
    for (const candidate of candidates) {
      if (matches.has(candidate.before) || usedAfter.has(candidate.after)) continue;
      matches.set(candidate.before, candidate.after);
      usedAfter.add(candidate.after);
    }
  }
  for (const field of ['title', 'label'] as const) {
    for (const left of open()) {
      const value = comparableText(left.block[field]);
      if (!value) continue;
      const right = free().find((entry) => entry.block.type === left.block.type && comparableText(entry.block[field]) === value);
      if (!right) continue;
      matches.set(left.index, right.index);
      usedAfter.add(right.index);
    }
  }
  return matches;
}

function pairBlockLists(
  before: NormBodyBlock[],
  after: NormBodyBlock[],
  parentKey: string,
  context?: PairingContext,
): NormDiffBlock[] {
  const beforeOccurrences = new Map<string, number>();
  const afterOccurrences = new Map<string, number>();
  const beforeSegments = before.map((block) => blockSegment(block, beforeOccurrences));
  const afterSegments = after.map((block) => blockSegment(block, afterOccurrences));
  const usedAfter = new Set<number>();
  const matches = new Map<number, number>();
  const pairs: Array<{ before?: NormBodyBlock; after?: NormBodyBlock; beforeIndex?: number; afterIndex?: number; key: string; movedFrom?: string }> = [];

  // Dokumentweit gepaarte Einheiten, deren Partner nicht in dieser Geschwisterliste steht: links
  // gewandert (kein „entfallen“), rechts zugewandert (Paar mit dem Block aus der alten Stelle).
  const beforeKeys = new Set(before.map(unitKey).filter(Boolean));
  const afterKeys = new Set(after.map(unitKey).filter(Boolean));
  const movedAway = new Set<number>();
  before.forEach((block, index) => {
    const key = unitKey(block);
    if (key && context?.before.has(key) && !afterKeys.has(key)) movedAway.add(index);
  });
  after.forEach((block, index) => {
    const key = unitKey(block);
    if (!key || !context?.after.has(key) || beforeKeys.has(key)) return;
    const origin = context.before.get(key)!;
    usedAfter.add(index);
    pairs.push({ before: origin.block, after: block, afterIndex: index, key: `${parentKey}/${afterSegments[index]}`, movedFrom: headingOf(origin.parent) });
  });

  // Gliederungsblöcke nach Inhalt, Überschrift, Ordnungszahl.
  for (const [beforeIndex, afterIndex] of pairDivisions(before, after, usedAfter, context)) matches.set(beforeIndex, afterIndex);

  // Beschriftete Blöcke folgen ihrem Gliederungszeichen; nur der Rest wird inhaltlich gepaart.
  before.forEach((block, index) => {
    if (!block.label || DIVISION_BLOCK_TYPES.has(block.type) || movedAway.has(index) || matches.has(index)) return;
    const key = unitKey(block);
    const exact = after.findIndex((candidate, candidateIndex) =>
      !usedAfter.has(candidateIndex) && candidate.type === block.type && (key ? unitKey(candidate) === key : candidate.label === block.label),
    );
    if (exact < 0) return;
    usedAfter.add(exact);
    matches.set(index, exact);
  });

  const unlabeled = (blocks: NormBodyBlock[], used?: Set<number>) => blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) => !block.label && !(used?.has(index) ?? false));
  const openBefore = unlabeled(before).filter(({ index }) => !matches.has(index) && !movedAway.has(index));
  const openAfter = unlabeled(after, usedAfter);
  const types = [...new Set(openBefore.map(({ block }) => block.type))];
  for (const type of types) {
    const beforeIndexes = openBefore.filter(({ block }) => block.type === type).map(({ index }) => index);
    const afterIndexes = openAfter.filter(({ block }) => block.type === type).map(({ index }) => index);
    const paired = POSITIONAL_BLOCK_TYPES.has(type)
      ? Array.from({ length: Math.min(beforeIndexes.length, afterIndexes.length) }, (_, index) => [beforeIndexes[index], afterIndexes[index]] as [number, number])
      : pairUnlabeledBlocks(beforeIndexes, afterIndexes, before, after);
    for (const [beforeIndex, afterIndex] of paired) {
      matches.set(beforeIndex, afterIndex);
      usedAfter.add(afterIndex);
    }
  }

  before.forEach((block, index) => {
    if (movedAway.has(index)) return;
    const afterIndex = matches.get(index);
    if (afterIndex === undefined) {
      pairs.push({ before: block, beforeIndex: index, key: `${parentKey}/${beforeSegments[index]}` });
      return;
    }
    pairs.push({
      before: block,
      after: after[afterIndex],
      beforeIndex: index,
      afterIndex,
      key: `${parentKey}/${beforeSegments[index]}`,
    });
  });

  after.forEach((block, index) => {
    if (usedAfter.has(index)) return;
    pairs.push({ after: block, afterIndex: index, key: `${parentKey}/${afterSegments[index]}` });
  });

  // Reihenfolge der neuen Fassung; entfallene Blöcke stehen an ihrer alten Stelle.
  const position = (pair: { beforeIndex?: number; afterIndex?: number }) => pair.afterIndex ?? pair.beforeIndex ?? Number.POSITIVE_INFINITY;
  pairs.sort((left, right) => position(left) - position(right) || (left.afterIndex === undefined ? -1 : 0) - (right.afterIndex === undefined ? -1 : 0));

  return pairs.map((pair) => buildDiffBlock(pair, parentKey, context));
}

function primitiveFieldsChanged(before: NormDiffValue, after: NormDiffValue): boolean {
  return DIFF_VALUE_FIELDS.some((field) => {
    if (field === 'text') return comparableText(before.text) !== comparableText(after.text);
    return before[field] !== after[field];
  });
}

function buildDiffBlock(
  pair: { before?: NormBodyBlock; after?: NormBodyBlock; beforeIndex?: number; afterIndex?: number; key: string; movedFrom?: string },
  parentKey: string,
  context?: PairingContext,
): NormDiffBlock {
  if (pair.movedFrom !== undefined && context) context.moved += 1;
  const before = pair.before;
  const after = pair.after;
  if (!before && !after) throw new Error(`Leerer Diff-Knoten ${parentKey}`);

  if (!before || !after) {
    const block = before ?? after!;
    const kind = before ? 'removed' : 'added';
    return {
      key: pair.key,
      type: block.type,
      kind,
      ...(before ? { before: diffValue(before) } : { after: diffValue(after!) }),
      children: pairBlockLists(before?.children ?? [], after?.children ?? [], pair.key, context),
      ...(pair.beforeIndex === undefined ? {} : { beforeIndex: pair.beforeIndex }),
      ...(pair.afterIndex === undefined ? {} : { afterIndex: pair.afterIndex }),
      label: block.label,
      ...(before?.title ? { beforeTitle: before.title } : {}),
      ...(after?.title ? { afterTitle: after.title } : {}),
      ...(before?.text ? { beforeText: before.text } : {}),
      ...(after?.text ? { afterText: after.text } : {}),
    };
  }

  const beforeValue = diffValue(before);
  const afterValue = diffValue(after);
  const children = pairBlockLists(before.children ?? [], after.children ?? [], pair.key, context);
  const textChanged = comparableText(before.text) !== comparableText(after.text);
  const titleChanged = before.title !== after.title;
  const labelChanged = before.label !== after.label;
  const childrenChanged = children.some((child) => child.kind !== 'unchanged');
  const kind: NormDiffKind = primitiveFieldsChanged(beforeValue, afterValue) || childrenChanged
    ? 'changed'
    : 'unchanged';
  const textDiff = textChanged ? diffWords(comparableText(before.text), comparableText(after.text)) : undefined;
  const titleDiff = titleChanged ? diffWords(before.title ?? '', after.title ?? '') : undefined;
  const labelDiff = labelChanged ? diffWords(before.label ?? '', after.label ?? '') : undefined;

  return {
    key: pair.key,
    type: after.type,
    kind,
    before: beforeValue,
    after: afterValue,
    children,
    ...(pair.beforeIndex === undefined ? {} : { beforeIndex: pair.beforeIndex }),
    ...(pair.afterIndex === undefined ? {} : { afterIndex: pair.afterIndex }),
    ...(pair.movedFrom === undefined ? {} : { movedFrom: pair.movedFrom }),
    label: after.label ?? before.label,
    ...(before.title ? { beforeTitle: before.title } : {}),
    ...(after.title ? { afterTitle: after.title } : {}),
    ...(before.text ? { beforeText: before.text } : {}),
    ...(after.text ? { afterText: after.text } : {}),
    ...(textDiff && hasReadableWordDiff(textDiff, comparableText(before.text), comparableText(after.text)) ? { textDiff } : {}),
    ...(titleDiff && hasReadableWordDiff(titleDiff, before.title ?? '', after.title ?? '') ? { titleDiff } : {}),
    ...(labelDiff && hasReadableWordDiff(labelDiff, before.label ?? '', after.label ?? '') ? { labelDiff } : {}),
  };
}

function summaryText(block: NormDiffBlock, side: 'before' | 'after', includeHeading = true): string {
  const value = side === 'before' ? block.before : block.after;
  if (!value) return '';
  const heading = includeHeading ? [value.label, value.title].filter(Boolean).join(' ') : '';
  const text = value.text ? [includeHeading ? '' : value.label, value.text].filter(Boolean).join(' ') : '';
  const children = block.children
    .slice()
    .sort((left, right) => (side === 'before' ? left.beforeIndex ?? left.afterIndex ?? 0 : left.afterIndex ?? left.beforeIndex ?? 0) - (side === 'before' ? right.beforeIndex ?? right.afterIndex ?? 0 : right.afterIndex ?? right.beforeIndex ?? 0))
    .map((child) => summaryText(child, side, false))
    .filter(Boolean);
  return [heading, text, ...children].filter(Boolean).join('\n').trim();
}

function isProvision(block: NormDiffBlock): boolean {
  return block.type === 'paragraph' || block.type === 'article';
}

function containsProvisionUnit(block: NormDiffBlock): boolean {
  return isProvision(block) || block.children.some(containsProvisionUnit);
}

const TEXT_CONTAINER_TYPES = new Set<StructureType>(['part', 'chapter', 'section', 'subsection', 'annex']);

/** Ein benannter Freitextabschnitt ist eine Einheit; Abschnitte mit §§/Artikeln sind es nicht. */
function isLogicalComparisonContainer(block: NormDiffBlock): boolean {
  const named = block.before?.label || block.before?.title || block.after?.label || block.after?.title;
  const hasText = (entry: NormDiffBlock): boolean => Boolean(entry.before?.text || entry.after?.text) || entry.children.some(hasText);
  return TEXT_CONTAINER_TYPES.has(block.type) && Boolean(named) && !containsProvisionUnit(block) && hasText(block);
}

function toProvision(block: NormDiffBlock): NormProvisionDiff {
  if (block.kind === 'unchanged') throw new Error(`Unveränderte Vorschrift ${block.key} darf nicht als Änderung ausgegeben werden`);
  const beforeText = summaryText(block, 'before');
  const afterText = summaryText(block, 'after');
  // Freitextcontainer rendern ihre strukturierten Kinder. Kein quadratischer Gesamtwortdiff
  // über möglicherweise sehr lange Anlagen; die Markierungen liegen bereits an den Kindern.
  const textDiff = beforeText && afterText && !isLogicalComparisonContainer(block) ? diffWords(beforeText, afterText) : undefined;
  return {
    key: block.key,
    type: block.type,
    kind: block.kind,
    ...(block.before ? { before: block.before } : {}),
    ...(block.after ? { after: block.after } : {}),
    children: block.children,
    ...(block.movedFrom ? { movedFrom: block.movedFrom } : {}),
    ...(beforeText ? { beforeText } : {}),
    ...(afterText ? { afterText } : {}),
    ...(block.titleDiff ? { titleDiff: block.titleDiff } : {}),
    ...(block.labelDiff ? { labelDiff: block.labelDiff } : {}),
    ...(textDiff && hasReadableWordDiff(textDiff, beforeText, afterText) ? { textDiff } : {}),
  };
}

/**
 * Strukturbaum des Vergleichs zweier Fassungen: je Block Art der Änderung, Kinder und Position in
 * beiden Fassungen. Grundlage der Marken am Ort der Änderung (change-marks.ts) und des Vergleichs.
 */
export function buildVersionDiffTree(
  before: Pick<NormVersion, 'body'>,
  after: Pick<NormVersion, 'body'>,
): NormDiffBlock[] {
  return pairBlockLists(before.body, after.body, 'body', createPairingContext(before.body, after.body));
}

/** Ergebnis eines Fassungsvergleichs: die sichtbaren Einheiten und die Zähler der Umgliederung. */
export interface NormVersionComparison {
  provisions: NormProvisionDiff[];
  /** Einheiten, die in eine andere Gliederungseinheit gewandert sind (mit oder ohne Wortlautänderung). */
  movedUnits: number;
  /** Gliederungseinheiten mit umbenannter, neuer oder entfallener Überschrift. */
  renamedDivisions: number;
}

function headingChanged(block: NormDiffBlock): boolean {
  if (block.kind === 'added' || block.kind === 'removed') return true;
  return comparableText(block.before?.label) !== comparableText(block.after?.label) || comparableText(block.before?.title) !== comparableText(block.after?.title);
}

/** Kastenkopf einer Gliederungseinheit ohne ihre Einheiten (die stehen einzeln im Vergleich). */
function headingProvision(block: NormDiffBlock): NormProvisionDiff {
  const heading = (value: NormDiffValue | undefined) => [value?.label, value?.title].filter(Boolean).join(' ');
  return {
    key: `${block.key}/heading`,
    type: block.type,
    kind: block.kind === 'unchanged' ? 'changed' : block.kind,
    ...(block.before ? { before: block.before } : {}),
    ...(block.after ? { after: block.after } : {}),
    children: [],
    ...(block.before ? { beforeText: heading(block.before) } : {}),
    ...(block.after ? { afterText: heading(block.after) } : {}),
    ...(block.titleDiff ? { titleDiff: block.titleDiff } : {}),
    ...(block.labelDiff ? { labelDiff: block.labelDiff } : {}),
    headingOnly: true,
  };
}

export function buildVersionComparison(
  before: Pick<NormVersion, 'body'>,
  after: Pick<NormVersion, 'body'>,
): NormVersionComparison {
  const context = createPairingContext(before.body, after.body);
  const root = pairBlockLists(before.body, after.body, 'body', context);
  const provisions: NormProvisionDiff[] = [];
  let renamedDivisions = 0;

  function collect(block: NormDiffBlock): number {
    if (block.kind === 'unchanged') return 0;
    if (isProvision(block) || isLogicalComparisonContainer(block)) {
      provisions.push(toProvision(block));
      return 1;
    }
    // Eine Gliederungseinheit mit Einheiten erscheint nur mit ihrer Überschrift, wenn diese sich
    // geändert hat (umbenannt, neu nummeriert, neu, entfallen); ihre Einheiten stehen einzeln,
    // gewanderte mit unverändertem Wortlaut gar nicht.
    let own = 0;
    if (DIVISION_BLOCK_TYPES.has(block.type) && containsProvisionUnit(block) && headingChanged(block)) {
      provisions.push(headingProvision(block));
      renamedDivisions += 1;
      own = 1;
    }
    const nested = collectList(block.children);
    if (nested > 0 || own > 0) return nested + own;
    if (containsProvisionUnit(block)) return 0;
    provisions.push(toProvision(block));
    return 1;
  }

  /** Unbenannte Textlücken enden an jedem stabilen Absatz oder Strukturknoten. Die einzelnen
   * Paarungen bleiben unverändert; nur die sichtbare Karte bündelt den zusammenhängenden Lauf. */
  function collectList(blocks: NormDiffBlock[]): number {
    const isFreeChange = (block: NormDiffBlock) => block.type === 'paragraphText'
      && !block.before?.label && !block.after?.label && !block.before?.title && !block.after?.title
      && block.kind !== 'unchanged';
    const anchors = blocks.filter((block) => !isFreeChange(block));
    const gapOnSide = (block: NormDiffBlock, side: 'beforeIndex' | 'afterIndex'): string | undefined => {
      const index = block[side];
      if (index === undefined) return undefined;
      const ordered = anchors.filter((entry) => entry[side] !== undefined).sort((a, b) => a[side]! - b[side]!);
      const previous = ordered.filter((entry) => entry[side]! < index).at(-1);
      const next = ordered.find((entry) => entry[side]! > index);
      return `${previous?.key ?? '^'}|${next?.key ?? '$'}`;
    };
    const gaps = new Map<string, NormDiffBlock[]>();
    const gapKeys = new Map<NormDiffBlock, string>();
    for (const block of blocks.filter(isFreeChange)) {
      const beforeGap = gapOnSide(block, 'beforeIndex');
      const afterGap = gapOnSide(block, 'afterIndex');
      // Verschobene Textstücke über eine Strukturgrenze hinweg bleiben eigenständig.
      const key = beforeGap && afterGap && beforeGap !== afterGap ? `${block.key}/separate` : (beforeGap ?? afterGap)!;
      gaps.set(key, [...(gaps.get(key) ?? []), block]);
      gapKeys.set(block, key);
    }
    let count = 0;
    for (const block of blocks) {
      const gapKey = gapKeys.get(block);
      if (!gapKey) { count += collect(block); continue; }
      const run = gaps.get(gapKey);
      if (!run) continue;
      gaps.delete(gapKey);
      if (run.length === 1) { count += collect(block); continue; }
      const before = run.some((entry) => entry.before);
      const after = run.some((entry) => entry.after);
      count += collect({
        key: `${run[0].key}/text-run`, type: 'section',
        kind: before && after ? 'changed' : before ? 'removed' : 'added',
        ...(before ? { before: { type: 'section' as const, title: 'Textstelle' } } : {}),
        ...(after ? { after: { type: 'section' as const, title: 'Textstelle' } } : {}),
        children: run,
      });
    }
    return count;
  }

  collectList(root);
  return { provisions, movedUnits: context.moved, renamedDivisions };
}

export function buildProvisionVersionDiff(
  before: Pick<NormVersion, 'body'>,
  after: Pick<NormVersion, 'body'>,
): NormProvisionDiff[] {
  return buildVersionComparison(before, after).provisions;
}
