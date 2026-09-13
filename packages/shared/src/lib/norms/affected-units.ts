import { buildVersionDiffTree, type NormDiffBlock } from './diff.ts';
import { buildNormAnchorMap, getResolvedBlockAnchorId, type NormAnchorMap } from './presentation.ts';
import type { NormBodyBlock, NormVersion } from './schema.ts';

/**
 * Betroffene Einheiten einer Fassung gegenüber ihrer Vorfassung (REVOSax „Betroffen“): geänderte
 * und neue Einheiten mit Anker der angezeigten Fassung, entfallene mit ihrem Gliederungszeichen –
 * aus demselben dokumentweiten Vergleich wie Fassungsvergleich und Marken am Ort der Änderung.
 * Die Reihenfolge ist die Dokumentreihenfolge (entfallene: der Vorfassung).
 */
export interface AffectedUnit {
  anchor: string;
  label: string;
  /** Absatzbezeichnungen mit neuem oder geändertem Wortlaut (nur bei geänderten Einheiten). */
  subparagraphs: string[];
}

export interface AffectedUnits {
  changed: AffectedUnit[];
  added: AffectedUnit[];
  removed: Array<{ label: string }>;
  /** Gliederungszeichen aller Einheiten der angezeigten bzw. der Vorfassung in Dokumentreihenfolge (für Bereiche „13a–13f“). */
  afterOrder: string[];
  beforeOrder: string[];
}

const UNIT_TYPES = new Set<NormBodyBlock['type']>(['paragraph', 'article', 'annex']);
const SUBPARAGRAPH_TYPES = new Set<string>(['subparagraph', 'paragraphText']);

const normalizeLabel = (label: string | undefined): string => (label ?? '').replace(/\s+/gu, ' ').trim();

function unitLabels(blocks: NormBodyBlock[]): string[] {
  const labels: string[] = [];
  const visit = (entries: NormBodyBlock[]): void => {
    for (const block of entries) {
      if (block.type === 'quotedProvision') continue;
      if (UNIT_TYPES.has(block.type) && block.label) labels.push(normalizeLabel(block.label));
      if (block.children) visit(block.children);
    }
  };
  visit(blocks);
  return labels;
}

function changedSubparagraphs(unit: NormDiffBlock): string[] {
  return unit.children
    .filter((child) => child.kind !== 'unchanged' && child.kind !== 'removed' && SUBPARAGRAPH_TYPES.has(child.type) && child.after?.label)
    .map((child) => child.after!.label!);
}

export function summarizeAffectedUnits(
  previous: Pick<NormVersion, 'body'>,
  shown: Pick<NormVersion, 'body'>,
  anchors: NormAnchorMap = buildNormAnchorMap(shown.body),
): AffectedUnits {
  const result: AffectedUnits = { changed: [], added: [], removed: [], afterOrder: unitLabels(shown.body), beforeOrder: unitLabels(previous.body) };
  const visit = (blocks: NormDiffBlock[], shownBlocks: NormBodyBlock[], path: number[]): void => {
    for (const block of blocks) {
      if (block.kind === 'unchanged') continue;
      if (block.afterIndex === undefined) {
        // Entfallen: nur Einheiten, und zwar samt Einheiten in einer entfallenen Gliederungseinheit.
        if (UNIT_TYPES.has(block.type)) { if (block.before?.label) result.removed.push({ label: normalizeLabel(block.before.label) }); continue; }
        if (block.type !== 'quotedProvision') visit(block.children, [], []);
        continue;
      }
      const shownBlock = shownBlocks[block.afterIndex];
      if (!shownBlock || shownBlock.type === 'quotedProvision') continue;
      const currentPath = [...path, block.afterIndex];
      if (UNIT_TYPES.has(shownBlock.type)) {
        const entry: AffectedUnit = { anchor: getResolvedBlockAnchorId(anchors, currentPath, shownBlock), label: normalizeLabel(shownBlock.label ?? block.after?.label), subparagraphs: block.kind === 'added' ? [] : changedSubparagraphs(block) };
        (block.kind === 'added' ? result.added : result.changed).push(entry);
        continue;
      }
      visit(block.children, shownBlock.children ?? [], currentPath);
    }
  };
  visit(buildVersionDiffTree(previous, shown), shown.body, []);
  return result;
}

/** Gliederungszeichen in Präfix („Artikel“, „§“, „Anlage“) und Zählteil („13a“) zerlegen. */
function splitLabel(label: string): { prefix: string; number: string } {
  const match = label.match(/^(§§?|Art\.|Artikel|Anlage)\s*(.*)$/u);
  return match ? { prefix: match[1], number: match[2].trim() } : { prefix: '', number: label };
}

function prefixWord(prefix: string, count: number): string {
  if (prefix === '§' || prefix === '§§') return count === 1 ? '§' : '§§';
  if (prefix === 'Artikel' || prefix === 'Art.') return 'Art.';
  if (prefix === 'Anlage') return count === 1 ? 'Anlage' : 'Anlagen';
  return prefix;
}

/**
 * Gliederungszeichen als Aufzählung mit Bereichen: zusammenhängende Folgen in der Dokumentreihenfolge
 * werden mit Bindestrich zusammengezogen („Art. 3a, 7c–7e, 13a–13f“). Gruppen je Präfix.
 */
export function formatUnitList(labels: string[], order: string[]): string {
  if (labels.length === 0) return '';
  const position = new Map(order.map((label, index) => [label, index] as const));
  const groups = new Map<string, string[]>();
  for (const label of labels) {
    const { prefix } = splitLabel(label);
    groups.set(prefix, [...(groups.get(prefix) ?? []), label]);
  }
  return [...groups].map(([prefix, group]) => {
    const sorted = [...group].sort((left, right) => (position.get(left) ?? Number.POSITIVE_INFINITY) - (position.get(right) ?? Number.POSITIVE_INFINITY));
    const runs: string[][] = [];
    for (const label of sorted) {
      const last = runs.at(-1);
      const previous = last?.at(-1);
      const consecutive = previous !== undefined && position.has(previous) && position.get(label) === position.get(previous)! + 1;
      if (last && consecutive) last.push(label);
      else runs.push([label]);
    }
    const parts = runs.map((run) => run.length >= 3 ? `${splitLabel(run[0]).number}–${splitLabel(run.at(-1)!).number}` : run.map((label) => splitLabel(label).number).join(', '));
    const word = prefixWord(prefix, group.length);
    return `${word ? `${word} ` : ''}${parts.join(', ')}`;
  }).join('; ');
}

/** „Art. 1, 3, 4, 6 geändert · Art. 3a, 7c–7e, 13a–13f neu · Art. 7 entfallen“; leer, wenn nichts betroffen ist. */
export function formatAffectedUnits(units: AffectedUnits): string {
  return [
    units.changed.length > 0 ? `${formatUnitList(units.changed.map((entry) => entry.label), units.afterOrder)} geändert` : '',
    units.added.length > 0 ? `${formatUnitList(units.added.map((entry) => entry.label), units.afterOrder)} neu` : '',
    units.removed.length > 0 ? `${formatUnitList(units.removed.map((entry) => entry.label), units.beforeOrder)} entfallen` : '',
  ].filter(Boolean).join(' · ');
}
