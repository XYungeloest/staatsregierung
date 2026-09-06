import type { CorpusStats } from './runtime/store.ts';

/**
 * Bestandszahlen in Worten. Die Zahl des Rechtsbestands wird auf Startseite, A–Z, Sachgebieten
 * und in der Suche gleich gebildet und gleich benannt, damit dieselbe Menge nicht an zwei Stellen
 * verschieden heißt. Reine Darstellung: dieses Modul liegt außerhalb der D1-Projektion.
 */

/** „1 Vorschrift“ / „23 Vorschriften“ – Zahl und passendes Substantiv. */
export function formatCount(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Der Bestandssatz: „1933 Vorschriften, davon 1867 geltend“. Grundmenge sind alle Vorschriften
 * außer den übernommenen Änderungsvorschriften (packages/shared/src/lib/norms/inventory.ts).
 */
export function formatInventoryCount(stats: Pick<CorpusStats, 'normCount' | 'inForceCount'>): string {
  return `${formatCount(stats.normCount, 'Vorschrift', 'Vorschriften')}, davon ${stats.inForceCount} geltend`;
}

/** „139 Ausgaben“ der Verkündungsblätter. */
export function formatPublicationCount(count: number): string {
  return formatCount(count, 'Ausgabe', 'Ausgaben');
}
