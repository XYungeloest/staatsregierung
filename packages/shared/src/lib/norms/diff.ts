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
  'paragraphText', 'item', 'subitem', 'tableRow', 'tableCell', 'tableHeaderCell',
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

/** Zellen tragen ihre Bedeutung aus der Spaltenposition und werden deshalb weiter der Reihe nach gepaart. */
const POSITIONAL_BLOCK_TYPES = new Set(['tableCell', 'tableHeaderCell']);

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

function pairBlockLists(
  before: NormBodyBlock[],
  after: NormBodyBlock[],
  parentKey: string,
): NormDiffBlock[] {
  const beforeOccurrences = new Map<string, number>();
  const afterOccurrences = new Map<string, number>();
  const beforeSegments = before.map((block) => blockSegment(block, beforeOccurrences));
  const afterSegments = after.map((block) => blockSegment(block, afterOccurrences));
  const usedAfter = new Set<number>();
  const matches = new Map<number, number>();
  const pairs: Array<{ before?: NormBodyBlock; after?: NormBodyBlock; beforeIndex?: number; afterIndex?: number; key: string }> = [];

  // Beschriftete Blöcke folgen ihrem Gliederungszeichen; nur der Rest wird inhaltlich gepaart.
  before.forEach((block, index) => {
    if (!block.label) return;
    const exact = after.findIndex((candidate, candidateIndex) =>
      !usedAfter.has(candidateIndex) && candidate.type === block.type && candidate.label === block.label,
    );
    if (exact < 0) return;
    usedAfter.add(exact);
    matches.set(index, exact);
  });

  const unlabeled = (blocks: NormBodyBlock[], used?: Set<number>) => blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) => !block.label && !(used?.has(index) ?? false));
  const openBefore = unlabeled(before).filter(({ index }) => !matches.has(index));
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

  pairs.sort((left, right) =>
    Math.min(left.beforeIndex ?? Number.POSITIVE_INFINITY, left.afterIndex ?? Number.POSITIVE_INFINITY) -
    Math.min(right.beforeIndex ?? Number.POSITIVE_INFINITY, right.afterIndex ?? Number.POSITIVE_INFINITY),
  );

  return pairs.map((pair) => buildDiffBlock(pair, parentKey));
}

function primitiveFieldsChanged(before: NormDiffValue, after: NormDiffValue): boolean {
  return DIFF_VALUE_FIELDS.some((field) => {
    if (field === 'text') return comparableText(before.text) !== comparableText(after.text);
    return before[field] !== after[field];
  });
}

function buildDiffBlock(
  pair: { before?: NormBodyBlock; after?: NormBodyBlock; beforeIndex?: number; afterIndex?: number; key: string },
  parentKey: string,
): NormDiffBlock {
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
      children: pairBlockLists(before?.children ?? [], after?.children ?? [], pair.key),
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
  const children = pairBlockLists(before.children ?? [], after.children ?? [], pair.key);
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

function toProvision(block: NormDiffBlock): NormProvisionDiff {
  if (block.kind === 'unchanged') throw new Error(`Unveränderte Vorschrift ${block.key} darf nicht als Änderung ausgegeben werden`);
  const beforeText = summaryText(block, 'before');
  const afterText = summaryText(block, 'after');
  const textDiff = beforeText && afterText ? diffWords(beforeText, afterText) : undefined;
  return {
    key: block.key,
    type: block.type,
    kind: block.kind,
    ...(block.before ? { before: block.before } : {}),
    ...(block.after ? { after: block.after } : {}),
    children: block.children,
    ...(beforeText ? { beforeText } : {}),
    ...(afterText ? { afterText } : {}),
    ...(block.titleDiff ? { titleDiff: block.titleDiff } : {}),
    ...(block.labelDiff ? { labelDiff: block.labelDiff } : {}),
    ...(textDiff && hasReadableWordDiff(textDiff, beforeText, afterText) ? { textDiff } : {}),
  };
}

export function buildProvisionVersionDiff(
  before: Pick<NormVersion, 'body'>,
  after: Pick<NormVersion, 'body'>,
): NormProvisionDiff[] {
  const root = pairBlockLists(before.body, after.body, 'body');
  const provisions: NormProvisionDiff[] = [];

  function collect(block: NormDiffBlock): number {
    if (block.kind === 'unchanged') return 0;
    if (isProvision(block)) {
      provisions.push(toProvision(block));
      return 1;
    }
    const nested = block.children.reduce((count, child) => count + collect(child), 0);
    if (nested > 0) return nested;
    provisions.push(toProvision(block));
    return 1;
  }

  root.forEach(collect);
  return provisions;
}
