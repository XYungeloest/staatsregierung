import type { NormRecord, NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';

export interface NormVersionIdentity {
  title: string;
  shortTitle: string;
  abbr?: string;
  summary: string;
}

/** Liefert die für eine konkrete gespeicherte Fassung gültige öffentliche Bezeichnung. */
export function getNormVersionIdentity(
  norm: Pick<NormRecord, 'meta'>,
  version: Pick<NormVersion, 'title' | 'shortTitle' | 'abbr' | 'summary'>,
): NormVersionIdentity {
  return {
    title: version.title ?? norm.meta.title,
    shortTitle: version.shortTitle ?? version.title ?? norm.meta.shortTitle ?? norm.meta.title,
    abbr: version.abbr ?? norm.meta.abbr,
    summary: version.summary ?? norm.meta.summary,
  };
}
