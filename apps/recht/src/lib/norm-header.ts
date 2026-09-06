import { formatDate } from '@ostrecht/shared/lib/norms/display.ts';
import type { NormRecord, NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';
import { classifyNormVersion } from '@ostrecht/shared/lib/norms/versions.ts';

import { validityLabel, versionKindLabel } from './vocabulary.ts';

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

/**
 * Datum des Inkrafttretens der Vorschrift selbst: das belegte Inkrafttreten, sonst der Beginn der
 * Stammfassung. Fehlt beides, nennt die Statuszeile nur die angezeigte Fassung – sie darf kein
 * Datum behaupten, das die Quellen nicht tragen.
 */
function inForceSince(norm: NormRecord): string | undefined {
  const initial = norm.history.initialVersionId
    ? norm.versions.find((entry) => entry.versionId === norm.history.initialVersionId)
    : undefined;
  return norm.meta.effectiveDate ?? initial?.validFrom;
}

/**
 * Statuszeile der geltenden Fassung: sie beschreibt zuerst die angezeigte Fassung und danach die
 * Vorschrift. Sind beide Daten gleich, steht das Datum nur einmal.
 */
function currentStatus(norm: NormRecord, versionSince: string): string {
  const since = inForceSince(norm);
  if (!since || since === versionSince) return `Geltende Fassung · in Kraft seit ${formatDate(versionSince)}`;
  return `Geltende Fassung seit ${formatDate(versionSince)} · Vorschrift in Kraft seit ${formatDate(since)}`;
}

/** Kopfzustand der Norm in ihrer geltenden bzw. maßgeblichen Fassung. */
export function normHeaderState(norm: NormRecord, version: NormVersion): NormHeaderState {
  const status = norm.meta.status;
  const published = 'Veröffentlichte Fassung';
  if (status === 'future-effective') {
    return { eyebrow: EYEBROW, status: `${published} · verkündet, Inkrafttreten am ${formatDate(norm.meta.effectiveDate ?? version.validFrom)}` };
  }
  if (status === 'pending-effective') {
    return { eyebrow: EYEBROW, status: `${published} · verkündet, Inkrafttreten noch nicht belegt` };
  }
  if (status === 'repealed' || status === 'historical') {
    const since = norm.meta.expiryDate ? ` seit ${formatDate(norm.meta.expiryDate)}` : '';
    return { eyebrow: EYEBROW, status: `${published} · ${validityLabel(status)}${since}` };
  }
  if (status === 'one-time-act') {
    return { eyebrow: EYEBROW, status: `${published} · ${validityLabel(status)} mit Wirkung vom ${formatDate(version.validFrom)}` };
  }
  return { eyebrow: EYEBROW, status: currentStatus(norm, version.validFrom) };
}

/** Kopfzustand einer konkreten gespeicherten Fassung (Einzelfassungsseite). */
export function versionHeaderState(norm: NormRecord, version: NormVersion): NormHeaderState {
  const kind = classifyNormVersion(norm, version);
  if (kind === 'current') return normHeaderState(norm, version);
  const end = version.validTo
    ? ` bis ${formatDate(version.validTo)}`
    : kind === 'historical'
      ? '; Gültigkeitsende nicht belegt'
      : '';
  const since = inForceSince(norm);
  const normSince = since ? ` · Vorschrift in Kraft seit ${formatDate(since)}` : '';
  if (kind === 'unknown-effective') {
    return { eyebrow: EYEBROW, status: `${versionKindLabel('unknown-effective')} · Inkrafttreten nicht belegt${normSince}` };
  }
  return { eyebrow: EYEBROW, status: `${versionKindLabel(kind)} · gültig ab ${formatDate(version.validFrom)}${end}${normSince}` };
}
