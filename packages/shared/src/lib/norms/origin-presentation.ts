import { formatNormOriginKind, type NormOriginInfo, type NormOriginKind } from '@ostrecht/shared/lib/norms/origin.ts';
import type { NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';

/**
 * Öffentliche Kurzform, Erläuterung und Fassungseinordnung der Rechtsherkunft für die
 * Oberfläche. Nicht Teil der D1-Projektion: der Sync erreicht dieses Modul nicht; origin.ts
 * liefert das Herkunftsmodell und die projizierte Bezeichnung `formatNormOriginKind`.
 *
 * Alle Oberflächen (Filter, Listen, Suchtreffer, Normseite) verwenden diese Funktionen; es gibt
 * keine zweite Herkunftsbezeichnung im Browser. Genau zwei Formen: kurz für Listen
 * (`formatNormOriginBadge('compact')`) und erklärend für Detailseiten, Filter und Zähler
 * (`formatNormOriginKind`, identisch mit `formatNormOriginBadge('full')`).
 */

export type NormOriginVersionKind =
  | 'ostdeutsch-original'
  | 'baseline'
  | 'inherited-intermediate'
  | 'inherited-amended'
  | 'origin-unresolved';

export function classifyNormOriginVersion(
  origin: NormOriginInfo,
  version: Pick<NormVersion, 'versionId' | 'validFrom'>,
): NormOriginVersionKind {
  if (origin.kind === 'ostdeutsch-original') return 'ostdeutsch-original';
  if (origin.kind === 'origin-unresolved') return 'origin-unresolved';
  if (version.versionId === origin.baselineVersionId) return 'baseline';
  if (!origin.firstOwnChangeDate || version.validFrom < origin.firstOwnChangeDate) {
    return 'inherited-intermediate';
  }
  return 'inherited-amended';
}

export type NormOriginBadgeVariant = 'compact' | 'full';

export function formatNormOriginBadge(kind: NormOriginKind, variant: NormOriginBadgeVariant = 'compact'): string {
  if (variant === 'full') return formatNormOriginKind(kind);
  if (kind === 'ostdeutsch-original') return 'Ostdeutsch neu';
  if (kind === 'inherited-amended') return 'Übernommen · geändert';
  if (kind === 'inherited-unchanged') return 'Übernommen · unverändert';
  return 'Herkunft ungeklärt';
}

/** Kurze, für Tooltips und Screenreader geeignete Erläuterung der Herkunftsart. */
export function describeNormOriginKind(kind: NormOriginKind): string {
  if (kind === 'ostdeutsch-original') return 'Erst im Freistaat Ostdeutschland geschaffen.';
  if (kind === 'inherited-amended') return 'Aus dem sächsischen Rechtsstand vom 1. November 2023 übernommen und seitdem ostdeutsch geändert.';
  if (kind === 'inherited-unchanged') return 'Aus dem sächsischen Rechtsstand vom 1. November 2023 übernommen und seitdem nicht geändert.';
  return 'Die Herkunft dieser Vorschrift ist noch nicht abschließend belegt.';
}
