import editorialConfig from '../../config/editorial.json' with { type: 'json' };
import { ContentValidationError, type NormRecord, type NormVersion } from './schema.ts';

export const EDITORIAL_REFERENCE_DATE = editorialConfig.referenceDate;

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
