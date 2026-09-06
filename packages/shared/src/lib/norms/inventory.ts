import type { NormOriginKind } from '@ostrecht/shared/lib/norms/origin.ts';
import type { NormStatus, NormType } from '@ostrecht/shared/lib/norms/schema.ts';

/**
 * Grundmenge des Rechtsbestands („Bestand“): alle Vorschriften außer den aus dem sächsischen
 * Rechtsstand übernommenen Änderungsvorschriften. Übernommene Änderungsakte sind historische
 * Änderungsträger, keine gleichrangigen Stammnormen; sie bleiben über die Suche mit
 * Normtyp-Filter, das Häkchen „Übernommene Änderungsvorschriften einbeziehen“ und die
 * Beziehungen der geänderten Vorschrift erreichbar. Ostdeutsche Änderungsvorschriften gehören
 * zur Grundmenge. Verzeichnisse, A–Z, Sachgebiete, Bestandszahlen und die Standardsuche lesen
 * diese eine Regel; es gibt keine zweite Definition.
 *
 * Teil der D1-Projektion: der Sync schreibt `in_inventory` und die Bestandszahlen damit.
 */
export function isInheritedAmendment(norm: { type: NormType; originKind?: NormOriginKind | null }): boolean {
  return norm.type === 'aenderungsvorschrift'
    && (norm.originKind === 'inherited-unchanged' || norm.originKind === 'inherited-amended');
}

/** SQL-Bedingung für den Alias `n` von law_norms: Vorschrift gehört zur Grundmenge. */
export const INVENTORY_SQL = 'n.in_inventory = 1';

/**
 * Dieselbe Regel als Ausdruck über Normtyp und Rechtsherkunft, für Abfragen, die ohne die
 * projizierte Spalte auskommen müssen (etwa während einer Migration oder in Datenbanken, die
 * `in_inventory` noch nicht führen). Beide Formen beschreiben dieselbe Menge; wo die Spalte
 * vorhanden ist, ist INVENTORY_SQL die günstigere Bedingung.
 */
export function inventoryPredicateSql(alias = 'n'): string {
  return `NOT (${alias}.type = 'aenderungsvorschrift' AND ${alias}.origin_kind IN ('inherited-unchanged', 'inherited-amended'))`;
}

/** Bestandszahlen (law_runtime_meta `corpus_stats_json`), immer über die Grundmenge. */
export interface InventoryStats {
  /** Vorschriften der Grundmenge. */
  normCount: number;
  /** Davon in Kraft. */
  inForceCount: number;
  /** Übernommene Änderungsvorschriften außerhalb der Grundmenge. */
  inheritedAmendmentCount: number;
  publicationCount: number;
  types: NormType[];
  statuses: NormStatus[];
}
