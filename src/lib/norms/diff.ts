import type { NormBodyBlock, NormVersion } from './schema.ts';

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
  if (longest === 0 || longest > 2_000) return false;
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
