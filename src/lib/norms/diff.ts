import type { NormBodyBlock, NormVersion } from './schema.ts';

export type NormDiffKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface NormDiffUnit {
  key: string;
  type: string;
  label: string;
  beforeTitle?: string;
  afterTitle?: string;
  beforeText?: string;
  afterText?: string;
  kind: NormDiffKind;
  textDiff?: Array<{ kind: 'same' | 'insert' | 'delete'; text: string }>;
}

interface FlatUnit {
  key: string;
  type: string;
  label: string;
  title: string;
  text: string;
}

const UNIT_TYPES = new Set(['paragraph', 'article', 'section', 'subsection', 'annex']);

function collectText(block: NormBodyBlock, quoted = false): string {
  return [
    block.text,
    ...(block.children?.flatMap((child) => {
      if (!quoted && UNIT_TYPES.has(child.type)) return [];
      return collectText(child, quoted || child.type === 'quotedProvision');
    }) ?? []),
  ]
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function flattenVersionUnits(version: Pick<NormVersion, 'body'>): FlatUnit[] {
  const units: FlatUnit[] = [];
  const occurrence = new Map<string, number>();

  function visit(blocks: NormBodyBlock[], quoted = false): void {
    for (const block of blocks) {
      if (block.type === 'quotedProvision') {
        continue;
      }

      if (!quoted && UNIT_TYPES.has(block.type)) {
        const label = block.label ?? '';
        const base = `${block.type}:${label || block.title || 'ohne-bezeichnung'}`;
        const count = (occurrence.get(base) ?? 0) + 1;
        occurrence.set(base, count);
        units.push({
          key: count === 1 ? base : `${base}:${count}`,
          type: block.type,
          label,
          title: block.title ?? '',
          text: collectText(block),
        });
      }

      if (block.children) visit(block.children, quoted);
    }
  }

  visit(version.body);
  return units;
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
        afterText: afterUnit.text,
        kind: 'added',
      };
    }
    if (beforeUnit && !afterUnit) {
      return {
        key,
        type: beforeUnit.type,
        label: beforeUnit.label,
        beforeTitle: beforeUnit.title,
        beforeText: beforeUnit.text,
        kind: 'removed',
      };
    }

    const titleChanged = beforeUnit!.title !== afterUnit!.title;
    const textChanged = beforeUnit!.text !== afterUnit!.text;
    return {
      key,
      type: beforeUnit!.type,
      label: beforeUnit!.label,
      beforeTitle: beforeUnit!.title,
      afterTitle: afterUnit!.title,
      beforeText: beforeUnit!.text,
      afterText: afterUnit!.text,
      kind: titleChanged || textChanged ? 'changed' : 'unchanged',
      textDiff: textChanged ? diffWords(beforeUnit!.text, afterUnit!.text) : undefined,
    };
  });
}
