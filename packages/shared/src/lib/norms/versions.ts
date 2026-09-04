import editorialConfig from '@ostrecht/shared/config/editorial.json' with { type: 'json' };
import { ContentValidationError, type HistoryEntryType, type NormRecord, type NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';

export const EDITORIAL_REFERENCE_DATE = editorialConfig.referenceDate;
export const EDITORIAL_TIME_ZONE = 'Europe/Berlin';

export function getBerlinCalendarDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EDITORIAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

/**
 * Compares ISO calendar dates in the portal's Berlin editorial calendar.
 * Changes taking effect on the reference date are current, not future.
 */
export function isStrictlyFutureEffectiveDate(
  effectiveDate: string,
  asOf = EDITORIAL_REFERENCE_DATE,
): boolean {
  return effectiveDate > asOf;
}

/**
 * Splits dated entries against the same Berlin-calendar reference used for
 * current and future legal changes. Entries taking effect today are current.
 */
export function partitionDatedEntries<T extends { date: string }>(
  entries: readonly T[],
  asOf = EDITORIAL_REFERENCE_DATE,
): { current: T[]; future: T[] } {
  const current: T[] = [];
  const future: T[] = [];

  for (const entry of entries) {
    if (isStrictlyFutureEffectiveDate(entry.date, asOf)) future.push(entry);
    else current.push(entry);
  }

  return { current, future };
}

/**
 * Rechtsstandsrelevante Historieneinträge: Erlass, Änderung und Aufhebung. Ein Hinweis oder
 * Berichtigungshinweis (`notice`) verändert den Rechtsstand nicht und zählt deshalb nicht als
 * Rechtsänderung.
 */
export const LEGAL_CHANGE_ENTRY_TYPES: readonly HistoryEntryType[] = ['initial', 'amendment', 'repeal'];

function latestDateUpTo(dates: Array<string | null | undefined>, asOf: string): string | null {
  const known = dates.filter((date): date is string => typeof date === 'string' && date !== '' && date <= asOf);
  return known.length > 0 ? known.sort().at(-1) ?? null : null;
}

/**
 * Jüngste Rechtsänderung einer Norm bis zum Stichtag: Fassungsbeginne und die
 * rechtsstandsrelevanten Historieneinträge (Erlass, Änderung, Aufhebung). Hinweise und
 * Berichtigungshinweise bleiben außen vor – sie ändern den Rechtsstand nicht. Künftige
 * Ereignisse zählen nicht; technische Zeitpunkte (Import, Git) spielen keine Rolle.
 * Grundlage für „Neueste Rechtsänderung“ (D1 `law_norms.last_change_date`, Sortierung der
 * Suche und der Übersichten ohne Suchbegriff). Für übernommene, seitdem unveränderte Normen
 * ist das der Rechtsüberleitungsstichtag ihrer Ausgangsfassung.
 */
export function getNormLastChangeDate(
  record: Pick<NormRecord, 'versions' | 'history'>,
  asOf = EDITORIAL_REFERENCE_DATE,
): string | null {
  return latestDateUpTo([
    ...record.versions.map((version) => version.validFrom),
    ...record.history.entries.filter((entry) => LEGAL_CHANGE_ENTRY_TYPES.includes(entry.type)).map((entry) => entry.date),
  ], asOf);
}

/**
 * Jüngstes dokumentiertes Ereignis einer Norm bis zum Stichtag, einschließlich reiner Hinweise
 * und Berichtigungshinweise: alles, was die veröffentlichte Darstellung der Norm verändert.
 * Grundlage für `lastmod` in der Sitemap (D1 `law_norms.last_activity_date`), nicht für die
 * Sortierung nach Rechtsänderung – dafür gilt {@link getNormLastChangeDate}.
 */
export function getNormLastActivityDate(
  record: Pick<NormRecord, 'versions' | 'history'>,
  asOf = EDITORIAL_REFERENCE_DATE,
): string | null {
  return latestDateUpTo([
    ...record.versions.map((version) => version.validFrom),
    ...record.history.entries.map((entry) => entry.date),
  ], asOf);
}

export const VERSION_TEMPORAL_KINDS = [
  'current',
  'future',
  'historical',
  'unknown-effective',
] as const;

export type VersionTemporalKind = (typeof VERSION_TEMPORAL_KINDS)[number];

export interface ClassifiedNormVersion {
  version: NormVersion;
  kind: VersionTemporalKind;
}

export function classifyNormVersion(
  record: Pick<NormRecord, 'meta'>,
  version: NormVersion,
  asOf = EDITORIAL_REFERENCE_DATE,
): VersionTemporalKind {
  if (record.meta.status === 'pending-effective') {
    return 'unknown-effective';
  }

  if (version.validFrom > asOf) {
    return 'future';
  }

  if (record.meta.status === 'repealed' || record.meta.status === 'historical') {
    return 'historical';
  }

  if (version.validTo !== null && version.validTo < asOf) {
    return 'historical';
  }

  return 'current';
}

export function classifyNormVersions(
  record: NormRecord,
  asOf = EDITORIAL_REFERENCE_DATE,
): ClassifiedNormVersion[] {
  return record.versions.map((version) => ({
    version,
    kind: classifyNormVersion(record, version, asOf),
  }));
}

export function getApplicableVersion(
  record: NormRecord,
  asOf = EDITORIAL_REFERENCE_DATE,
): NormVersion {
  const classified = classifyNormVersions(record, asOf);
  const current = classified.find((entry) => entry.kind === 'current')?.version;
  if (current) return current;

  const future = classified
    .filter((entry) => entry.kind === 'future')
    .sort((left, right) => left.version.validFrom.localeCompare(right.version.validFrom))[0]?.version;
  if (future) return future;

  const unknown = classified.find((entry) => entry.kind === 'unknown-effective')?.version;
  if (unknown) return unknown;

  const latest = [...record.versions].sort((left, right) =>
    right.validFrom.localeCompare(left.validFrom),
  )[0];
  if (latest) return latest;

  throw new ContentValidationError(`${record.meta.slug}: enthält keine gespeicherte Fassung`);
}

export function validateVersionIntervals(
  record: Pick<NormRecord, 'meta' | 'versions'>,
): void {
  const versions = [...record.versions].sort((left, right) =>
    left.validFrom.localeCompare(right.validFrom),
  );

  for (let index = 0; index < versions.length; index += 1) {
    const version = versions[index];
    if (version.validTo !== null && version.validTo < version.validFrom) {
      throw new ContentValidationError(
        `${record.meta.slug}/versions/${version.versionId}.json: validTo liegt vor validFrom`,
      );
    }

    const next = versions[index + 1];
    if (!next) continue;

    if (version.validTo === null || version.validTo >= next.validFrom) {
      throw new ContentValidationError(
        `${record.meta.slug}/versions: Gültigkeitsintervalle ${version.versionId} und ${next.versionId} überlappen`,
      );
    }

    const expectedValidTo = new Date(`${next.validFrom}T00:00:00Z`);
    expectedValidTo.setUTCDate(expectedValidTo.getUTCDate() - 1);
    if (version.validTo !== expectedValidTo.toISOString().slice(0, 10)) {
      throw new ContentValidationError(
        `${record.meta.slug}/versions: zwischen ${version.versionId} und ${next.versionId} besteht eine Gültigkeitslücke`,
      );
    }
  }
}

export function formatVersionTemporalLabel(
  kind: VersionTemporalKind,
  version: NormVersion,
): string {
  if (kind === 'future') return `Zukünftige Fassung ab ${version.validFrom}`;
  if (kind === 'historical') {
    return version.validTo
      ? `Historische Fassung ${version.validFrom} bis ${version.validTo}`
      : `Historische Fassung ab ${version.validFrom}; Gültigkeitsende nicht gespeichert`;
  }
  if (kind === 'unknown-effective') return 'Veröffentlicht; Inkrafttreten nicht belegt';
  return `Zum Stichtag geltende Fassung ab ${version.validFrom}`;
}

/** Die am redaktionellen Stichtag geltende Fassung (siehe getApplicableVersion). */
export function getCurrentVersion(record: NormRecord): NormVersion {
  return getApplicableVersion(record);
}

export function getVersionById(record: NormRecord, versionId: string): NormVersion | undefined {
  return record.versions.find((version) => version.versionId === versionId);
}
