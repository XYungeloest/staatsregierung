import { summarizeAffectedUnits, type AffectedUnits } from './affected-units.ts';
import { buildNormAnchorMap, type NormAnchorMap } from './presentation.ts';
import type { NormVersion } from './schema.ts';

/**
 * Änderungen am Ort der Änderung (E36): Welche Einheiten (§§, Artikel, Anlagen) der angezeigten
 * Fassung gegenüber ihrer unmittelbaren Vorfassung neu oder geändert sind, belegt durch denselben
 * dokumentweiten Textvergleich wie der Fassungsvergleich – kein Redaktionsfeld. Je geänderter
 * Einheit stehen die Absatzbezeichnungen mit neuem oder geändertem Wortlaut; entfallene Absätze
 * haben in der angezeigten Fassung keinen Ort und tragen keine Marke. Die Marken sind eine Sicht
 * auf die betroffenen Einheiten (affected-units.ts), die auch Protokollspalte und Verlauf lesen.
 */
export type NormChangeMarkKind = 'added' | 'changed';

export interface NormUnitChangeMark {
  kind: NormChangeMarkKind;
  /** Absatzbezeichnungen („(1)“, „(2)“) mit geändertem oder neuem Wortlaut; leer bei neuen Einheiten. */
  subparagraphs: string[];
}

/** Marken je Anker der angezeigten Fassung – dieselben Anker wie im gerenderten Normtext. */
export type NormChangeMarks = ReadonlyMap<string, NormUnitChangeMark>;

export function marksFromAffectedUnits(affected: AffectedUnits): NormChangeMarks {
  const marks = new Map<string, NormUnitChangeMark>();
  for (const unit of affected.changed) marks.set(unit.anchor, { kind: 'changed', subparagraphs: unit.subparagraphs });
  for (const unit of affected.added) marks.set(unit.anchor, { kind: 'added', subparagraphs: [] });
  return marks;
}

export function buildNormChangeMarks(
  previous: Pick<NormVersion, 'body'>,
  shown: Pick<NormVersion, 'body'>,
  anchors: NormAnchorMap = buildNormAnchorMap(shown.body),
): NormChangeMarks {
  return marksFromAffectedUnits(summarizeAffectedUnits(previous, shown, anchors));
}
