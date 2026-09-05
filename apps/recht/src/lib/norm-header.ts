import { formatDate, formatNormStatus } from '@ostrecht/shared/lib/norms/presentation.ts';
import type { NormRecord, NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';
import { classifyNormVersion } from '@ostrecht/shared/lib/norms/versions.ts';

/**
 * Eyebrow und Statuszeile des Normkopfs (NormPageHeader) – eine Quelle für alle vier
 * Normansichten (Fassung, Historie, Vergleich, Einzelfassung), damit der Wechsel zwischen den
 * Ansichten den Seitenkopf nicht verändert (Befunde P1, D2).
 */
export interface NormHeaderState {
  eyebrow: string;
  status: string;
}

/**
 * Der Eyebrow nennt den Bereich („Vorschrift“ wie „Verkündung“ und „Sachgebiet“ auf den anderen
 * Detailseiten); Fassungsart und Rechtsstand stehen gemeinsam in der Statuszeile.
 */
const EYEBROW = 'Vorschrift';

/** Kopfzustand der Norm in ihrer geltenden bzw. maßgeblichen Fassung. */
export function normHeaderState(norm: NormRecord, version: NormVersion): NormHeaderState {
  const statusLabel = formatNormStatus(norm.meta.status);
  const statusDate = norm.meta.effectiveDate ?? version.validFrom;
  const kind = norm.meta.status === 'in-force' ? 'Aktuelle Fassung' : 'Veröffentlichte Fassung';
  if (norm.meta.status === 'future-effective') return { eyebrow: EYEBROW, status: `${kind} · verkündet, Inkrafttreten am ${formatDate(statusDate)}` };
  if (norm.meta.status === 'pending-effective') return { eyebrow: EYEBROW, status: `${kind} · verkündet, Inkrafttreten noch nicht belegt` };
  if (norm.meta.status === 'repealed' || norm.meta.status === 'historical') {
    return { eyebrow: EYEBROW, status: `${kind} · ${statusLabel}${norm.meta.expiryDate ? ` seit ${formatDate(norm.meta.expiryDate)}` : ''}` };
  }
  return { eyebrow: EYEBROW, status: `${kind} · ${statusLabel} seit ${formatDate(statusDate)}` };
}

/** Kopfzustand einer konkreten gespeicherten Fassung (Einzelfassungsseite). */
export function versionHeaderState(norm: NormRecord, version: NormVersion): NormHeaderState {
  const kind = classifyNormVersion(norm, version);
  const kindLabel = kind === 'future' ? 'Zukünftige Fassung' : kind === 'historical' ? 'Historische Fassung' : 'Veröffentlichte Fassung';
  const end = version.validTo
    ? ` bis ${formatDate(version.validTo)}`
    : kind === 'historical'
      ? '; Gültigkeitsende nicht gespeichert'
      : '';
  return { eyebrow: EYEBROW, status: `${kindLabel} · gültig ab ${formatDate(version.validFrom)}${end}` };
}
