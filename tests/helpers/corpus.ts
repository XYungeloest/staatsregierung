import { loadAllNorms } from '@ostrecht/shared/lib/norms/loader.ts';
import { loadAllVerkuendungen } from '@ostrecht/shared/lib/norms/publications.ts';
import type { NormRecord } from '@ostrecht/shared/lib/norms/schema.ts';
import { buildSearchIndexPayloadFrom, type SearchIndexPayload } from '@ostrecht/recht-search/search-files.ts';

let normsOnce: Promise<NormRecord[]> | null = null;

/**
 * Lädt den vollständigen Rechtsbestand höchstens einmal je Testprozess. Mit
 * mehreren tausend Normen sprengen mehrere unabhängige Kopien den Heap; die
 * Tests lesen den Bestand nur.
 */
export function loadNormsOnce(): Promise<NormRecord[]> {
  normsOnce ??= loadAllNorms();
  return normsOnce;
}

/**
 * Redaktioneller Kernbestand plus deterministische Stichprobe der übernommenen
 * REVOSax-Baseline. Der browserseitige Suchcode wird in Produktion nur mit den
 * Kandidaten aus D1 gefüttert; ein Gesamtindex über den Vollbestand ist als
 * Testartefakt zu groß (Heap) und nicht mehr repräsentativ.
 */
export function sampleCorpus(records: NormRecord[], every = 15): NormRecord[] {
  const isBaselineOnly = (record: NormRecord) => record.versions.length === 1
    && record.versions[0].versionId === '2023-11-01'
    && (record.versions[0].sourceReferences ?? []).every((reference) => reference.availability === 'r2-archived');
  const sorted = [...records].sort((left, right) => left.meta.slug.localeCompare(right.meta.slug, 'de'));
  let baselineIndex = 0;
  return sorted.filter((record) => {
    if (!isBaselineOnly(record)) return true;
    baselineIndex += 1;
    return baselineIndex % every === 1;
  });
}

let searchIndexSampleOnce: Promise<SearchIndexPayload> | null = null;

export function loadSearchIndexSampleOnce(): Promise<SearchIndexPayload> {
  searchIndexSampleOnce ??= (async () => {
    const [records, publications] = await Promise.all([loadNormsOnce(), loadAllVerkuendungen()]);
    return buildSearchIndexPayloadFrom({ records: sampleCorpus(records), publications });
  })();
  return searchIndexSampleOnce;
}
