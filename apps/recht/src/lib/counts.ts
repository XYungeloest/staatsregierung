import type { CorpusStats } from './runtime/store.ts';

/**
 * Bestandszahlen in Worten. Die Zahl des Rechtsbestands wird auf Startseite, A–Z, Sachgebieten
 * und in der Suche gleich gebildet und gleich benannt, damit dieselbe Menge nicht an zwei Stellen
 * verschieden heißt. Reine Darstellung: dieses Modul liegt außerhalb der D1-Projektion.
 */

/** Das zur Zahl passende Substantiv, wenn die Zahl getrennt vom Wort steht (Kacheln, Listen). */
export function countNoun(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** „1 Vorschrift“ / „23 Vorschriften“ – Zahl und passendes Substantiv. */
export function formatCount(count: number, one: string, many: string): string {
  return `${count} ${countNoun(count, one, many)}`;
}

/** Die Vorschriften des Bestands: die häufigste Einheit und deshalb hier einmal benannt. */
export const NORM_UNIT = { one: 'Vorschrift', many: 'Vorschriften' } as const;

/** „1 Vorschrift“ / „1933 Vorschriften“ – die Einheit der Verzeichnisse und Kacheln. */
export function formatNormCount(count: number): string {
  return formatCount(count, NORM_UNIT.one, NORM_UNIT.many);
}

/**
 * Der Bestandssatz: „1933 Vorschriften, davon 1867 geltend“. Grundmenge sind alle Vorschriften
 * außer den übernommenen Änderungsvorschriften (packages/shared/src/lib/norms/inventory.ts).
 */
export function formatInventoryCount(stats: Pick<CorpusStats, 'normCount' | 'inForceCount'>): string {
  return `${formatNormCount(stats.normCount)}, davon ${stats.inForceCount} geltend`;
}

/** „139 Ausgaben“ der Verkündungsblätter. */
export function formatPublicationCount(count: number): string {
  return formatCount(count, 'Ausgabe', 'Ausgaben');
}
