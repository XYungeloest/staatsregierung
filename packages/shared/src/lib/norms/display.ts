import {
  anchorSlug,
  buildNormAnchorMap,
  getResolvedBlockAnchorId,
  isAnchoredBlock,
  toDisplayText,
  type TextLinkReference,
} from '@ostrecht/shared/lib/norms/presentation.ts';
import type { PublicationEntryType } from '@ostrecht/shared/lib/norms/publications.ts';
import type { NormBodyBlock } from '@ostrecht/shared/lib/norms/schema.ts';

/**
 * Reine Darstellung für die Oberfläche: Datumsformat, Fundstellenparser, verlinkter Text,
 * Überschriftenebenen, Gliederung und alte Anker. Nicht Teil der D1-Projektion: der Sync
 * erreicht dieses Modul nicht; die projizierten Anzeigetexte und Anker stehen in
 * presentation.ts (Modell-Module importieren dieses Modul nie).
 */

export interface NormOutlineItem {
  anchor: string;
  label?: string;
  title: string;
  level: number;
  children: NormOutlineItem[];
}

export interface ParsedCitation {
  source: string;
  year: string;
  part?: string;
  issue: string;
  page?: string;
}

const PUBLICATION_ENTRY_TYPE_LABELS: Record<PublicationEntryType, string> = {
  gesetz: 'Gesetz',
  verordnung: 'Verordnung',
  verwaltungsvorschrift: 'Verwaltungsvorschrift',
  foerderrichtlinie: 'Förderrichtlinie',
  bekanntmachung: 'Bekanntmachung',
  berichtigung: 'Berichtigung',
  staatsvertrag: 'Staatsvertrag',
  verwaltungsabkommen: 'Verwaltungsabkommen',
  sonstiges: 'Sonstige Veröffentlichung',
};

export function formatPublicationEntryType(value: PublicationEntryType): string {
  return PUBLICATION_ENTRY_TYPE_LABELS[value];
}

export function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map((entry) => Number.parseInt(entry, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function parseCitation(value: string): ParsedCitation | undefined {
  const displayValue = toDisplayText(value);
  const match = displayValue.match(
    /\b(OGVBl\.|OABl\.|StAnzO\.|OVertrBl\.|GMBl\.|SächsGVBl\.|BGBl\.)\s+(\d{4})(?:\s+([IVX]+))?\s+Nr\.\s+([\p{L}\p{N}]+(?:[./\-–—][\p{L}\p{N}]+)*)(?:\s+S\.\s+([\p{L}\p{N}]+(?:[./\-–—][\p{L}\p{N}]+)*))?/u,
  );

  if (!match) {
    return undefined;
  }

  return {
    source: match[1],
    year: match[2],
    ...(match[3] ? { part: match[3] } : {}),
    issue: match[4],
    ...(match[5] ? { page: match[5] } : {}),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function isWordCharacter(value: string): boolean {
  return /[\p{L}\p{N}_-]/u.test(value);
}

function isDelimited(value: string, start: number, length: number): boolean {
  const before = value[start - 1];
  const after = value[start + length];

  return (!before || !isWordCharacter(before)) && (!after || !isWordCharacter(after));
}

export function renderLinkedDisplayText(
  value: string | null | undefined,
  references: TextLinkReference[] = [],
): string {
  const text = toDisplayText(value);
  if (!text || references.length === 0) {
    return escapeHtml(text);
  }

  const chunks: string[] = [];
  let index = 0;

  while (index < text.length) {
    const match = references.find((reference) => {
      if (!text.startsWith(reference.label, index)) {
        return false;
      }

      return isDelimited(text, index, reference.label.length);
    });

    if (!match) {
      chunks.push(escapeHtml(text[index]));
      index += 1;
      continue;
    }

    chunks.push(
      `<a class="inline-link" href="${escapeHtml(match.url)}"${match.external ? ' rel="noopener noreferrer" target="_blank"' : ''}>${escapeHtml(match.label)}</a>`,
    );
    index += match.label.length;
  }

  return chunks.join('');
}

export function getLegacyBlockAnchorId(path: number[], block: NormBodyBlock): string {
  const base = block.label ?? block.title ?? block.type;
  const slug = anchorSlug(base);

  return `block-${path.join('-')}-${slug || block.type}`;
}

export function getHeadingTag(parentLevel: number): 'h3' | 'h4' | 'h5' | 'h6' {
  const level = Math.min(Math.max(parentLevel + 1, 3), 6);
  return `h${level}` as 'h3' | 'h4' | 'h5' | 'h6';
}

export function buildNormOutline(
  blocks: NormBodyBlock[],
): NormOutlineItem[] {
  const anchors = buildNormAnchorMap(blocks);

  function visit(entries: NormBodyBlock[], path: number[] = [], level = 0): NormOutlineItem[] {
    return entries.flatMap((block, index) => {
      const currentPath = [...path, index];
      if (block.type === 'quotedProvision') return [];
      const shouldInclude = isAnchoredBlock(block);
      const children = block.children
        ? visit(block.children, currentPath, shouldInclude ? level + 1 : level)
        : [];

      if (!shouldInclude) {
        return children;
      }

      return [
        {
          anchor: getResolvedBlockAnchorId(anchors, currentPath, block),
          label: block.label ? toDisplayText(block.label) : undefined,
          title: toDisplayText(block.title ?? block.label ?? 'Unbenannt'),
          level,
          children,
        },
      ];
    });
  }

  return visit(blocks);
}
