import { buildVersionDiffTree, type NormDiffBlock } from './diff.ts';
import { buildNormAnchorMap, getResolvedBlockAnchorId, type NormAnchorMap } from './presentation.ts';
import type { NormBodyBlock, NormVersion } from './schema.ts';

/**
 * Änderungen am Ort der Änderung (E36): Welche Einheiten (§§, Artikel, Anlagen) der angezeigten
 * Fassung gegenüber ihrer unmittelbaren Vorfassung neu oder geändert sind, belegt durch denselben
 * strukturellen Textvergleich wie der Fassungsvergleich – kein Redaktionsfeld. Je geänderter
 * Einheit stehen die Absatzbezeichnungen mit neuem oder geändertem Wortlaut; entfallene Absätze
 * haben in der angezeigten Fassung keinen Ort und tragen keine Marke.
 */
export type NormChangeMarkKind = 'added' | 'changed';

export interface NormUnitChangeMark {
  kind: NormChangeMarkKind;
  /** Absatzbezeichnungen („(1)“, „(2)“) mit geändertem oder neuem Wortlaut; leer bei neuen Einheiten. */
  subparagraphs: string[];
}

/** Marken je Anker der angezeigten Fassung – dieselben Anker wie im gerenderten Normtext. */
export type NormChangeMarks = ReadonlyMap<string, NormUnitChangeMark>;

const MARKED_UNIT_TYPES = new Set<NormBodyBlock['type']>(['paragraph', 'article', 'annex']);
const SUBPARAGRAPH_TYPES = new Set<string>(['subparagraph', 'paragraphText']);

function changedSubparagraphs(unit: NormDiffBlock): string[] {
  return unit.children
    .filter((child) => child.kind !== 'unchanged' && child.kind !== 'removed' && SUBPARAGRAPH_TYPES.has(child.type) && child.after?.label)
    .map((child) => child.after!.label!);
}

export function buildNormChangeMarks(
  previous: Pick<NormVersion, 'body'>,
  shown: Pick<NormVersion, 'body'>,
  anchors: NormAnchorMap = buildNormAnchorMap(shown.body),
): NormChangeMarks {
  const marks = new Map<string, NormUnitChangeMark>();
  const visit = (blocks: NormDiffBlock[], shownBlocks: NormBodyBlock[], path: number[]): void => {
    for (const block of blocks) {
      // Entfallene Blöcke und unveränderte Teilbäume haben keinen Ort bzw. keine Marke.
      if (block.kind === 'unchanged' || block.afterIndex === undefined) continue;
      const shownBlock = shownBlocks[block.afterIndex];
      if (!shownBlock || shownBlock.type === 'quotedProvision') continue;
      const currentPath = [...path, block.afterIndex];
      if (MARKED_UNIT_TYPES.has(shownBlock.type)) {
        const anchor = getResolvedBlockAnchorId(anchors, currentPath, shownBlock);
        marks.set(anchor, { kind: block.kind === 'added' ? 'added' : 'changed', subparagraphs: block.kind === 'added' ? [] : changedSubparagraphs(block) });
        continue;
      }
      visit(block.children, shownBlock.children ?? [], currentPath);
    }
  };
  visit(buildVersionDiffTree(previous, shown), shown.body, []);
  return marks;
}
