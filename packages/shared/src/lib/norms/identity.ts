import type { NormRecord, NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';

export interface NormVersionIdentity {
  title: string;
  shortTitle: string;
  abbr?: string;
  summary: string;
  /** Herkunft der Zusammenfassung; eine fassungsspezifische Zusammenfassung gilt als redaktionell. */
  summarySource?: 'derived' | 'editorial';
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
    summarySource: version.summary !== undefined ? undefined : norm.meta.summarySource,
  };
}

/**
 * Öffentliche Zusammenfassung: eine deterministisch abgeleitete Formel (`summarySource: derived`)
 * wird nirgends gerendert und nicht als Suchtext indexiert; die Oberflächen zeigen dann keine
 * Beschreibung oder eine Kurzform des Vollzitats. Teil der D1-Projektion (der Sync schreibt
 * nur die öffentliche Zusammenfassung in die Übersichtsspalten).
 */
export function getPublicNormSummary(identity: Pick<NormVersionIdentity, 'summary' | 'summarySource'>): string | undefined {
  if (identity.summarySource === 'derived') return undefined;
  const summary = identity.summary?.trim();
  return summary ? summary : undefined;
}
