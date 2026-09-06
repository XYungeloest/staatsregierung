import type {
  NormHistoryEntry,
  NormRecord,
  NormSourceReference,
  NormVersion,
} from '@ostrecht/shared/lib/norms/schema.ts';

/**
 * Herkunftsmodell der Rechtsvorschriften (Baseline, eigene Änderungen, Herkunftsart) und die
 * projizierte Bezeichnung `formatNormOriginKind`. Teil der D1-Projektion (Code-Abschluss von
 * scripts/sync-recht-d1.mjs über search.ts und derived.ts): Herkunft und Bezeichnung landen in
 * law_norm_derived und law_runtime_meta. Kurzform, Erläuterung und Fassungseinordnung für die
 * Oberfläche stehen in origin-presentation.ts; dieses Modul importiert sie nie.
 */

export const LEGAL_BASELINE_DATE = '2023-11-01';

export const NORM_ORIGIN_KINDS = [
  'ostdeutsch-original',
  'inherited-unchanged',
  'inherited-amended',
  'origin-unresolved',
] as const;

export type NormOriginKind = (typeof NORM_ORIGIN_KINDS)[number];

export interface OwnNormChange {
  type: 'amendment' | 'repeal';
  date: string;
  title: string;
  citation: string;
  relatedNormSlug?: string;
  resultingVersionId?: string;
}

export interface NormOriginInfo {
  kind: NormOriginKind;
  baselineDate?: string;
  baselineVersionId?: string;
  baselineSourceUrl?: string;
  firstOwnChangeDate?: string;
  lastOwnChangeDate?: string;
  ownAmendmentCount: number;
  ownChangeCount: number;
  ownChanges: OwnNormChange[];
}

/**
 * Eigene ostdeutsche Verkündungsorgane: Gesetz- und Verordnungsblatt (OGVBl.), Amtsblatt
 * (OABl.), Staatsanzeiger (StAnzO.), Vertragsblatt (OVertrBl.), Verordnungsblatt (VBlO.) sowie
 * das Gemeinsame Ministerialblatt für Verwaltungsabkommen mit dem Bund (GMBl.).
 */
const OWN_PUBLICATION_PATTERN = /(?:^|[^\p{L}\p{N}])(?:OGVBl\.|OABl\.|StAnzO\.|OVertrBl\.|VBlO\.|GMBl\.)/iu;
const SAXON_SOURCE_PATTERN = /(?:Sächs|Sachsen|SächsGVBl\.|REVOSax)/iu;

function sourceCoversBaseline(source: NormSourceReference): boolean {
  return source.kind === 'revosax-snapshot'
    && Boolean(source.sourceValidFrom)
    && source.sourceValidFrom! <= LEGAL_BASELINE_DATE
    && (!source.sourceValidTo || source.sourceValidTo >= LEGAL_BASELINE_DATE);
}

function allSourceReferences(record: NormRecord): NormSourceReference[] {
  return [
    ...(record.meta.sourceReferences ?? []),
    ...record.versions.flatMap((version) => version.sourceReferences ?? []),
  ];
}

function hasSaxonSource(record: NormRecord): boolean {
  return allSourceReferences(record).some((source) => source.kind === 'revosax-snapshot')
    || SAXON_SOURCE_PATTERN.test(record.meta.enactingBody ?? '');
}

function hasOwnPublicationEvidence(record: NormRecord): boolean {
  return OWN_PUBLICATION_PATTERN.test([
    record.meta.initialCitation,
    record.meta.enactingBody,
    ...record.history.entries.map((entry) => entry.citation),
    ...record.versions.map((version) => version.citation),
  ].filter(Boolean).join(' '));
}

function isOwnChangeEntry(
  entry: NormHistoryEntry,
  normLookup: Map<string, NormRecord>,
): boolean {
  if ((entry.type !== 'amendment' && entry.type !== 'repeal') || entry.date <= LEGAL_BASELINE_DATE) {
    return false;
  }

  if (OWN_PUBLICATION_PATTERN.test(entry.citation)) return true;
  if (!entry.relatedNorm) return false;

  const related = normLookup.get(entry.relatedNorm);
  return Boolean(
    related
    && !hasSaxonSource(related)
    && (hasOwnPublicationEvidence(related) || (related.meta.documentDate ?? '') > LEGAL_BASELINE_DATE),
  );
}

export function getBaselineVersion(record: Pick<NormRecord, 'versions'>): NormVersion | undefined {
  return record.versions.find((version) =>
    version.validFrom === LEGAL_BASELINE_DATE
    && (version.sourceReferences ?? []).some(sourceCoversBaseline),
  );
}

export function getOwnNormChanges(
  record: NormRecord,
  records: NormRecord[] = [record],
): OwnNormChange[] {
  const normLookup = new Map(records.map((entry) => [entry.meta.slug, entry]));

  return record.history.entries
    .filter((entry) => isOwnChangeEntry(entry, normLookup))
    .map((entry) => ({
      type: entry.type as 'amendment' | 'repeal',
      date: entry.date,
      title: entry.title,
      citation: entry.citation,
      relatedNormSlug: entry.relatedNorm ?? undefined,
      resultingVersionId: entry.affectingVersionId ?? undefined,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function isProvenOwnOriginal(record: NormRecord, records: NormRecord[]): boolean {
  if (hasSaxonSource(record)) return false;

  const initialVersion = record.history.initialVersionId
    ? record.versions.find((version) => version.versionId === record.history.initialVersionId)
    : record.versions[0];
  const initialEntry = record.history.entries.find((entry) => entry.type === 'initial');
  // Maßgeblich ist der Eintritt in die ostdeutsche Rechtsordnung: das Datum des ersten
  // Historieneintrags oder, wenn die erste Fassung erst später gilt (etwa ein älteres
  // Übereinkommen, das durch ein ostdeutsches Zustimmungsgesetz in Kraft gesetzt wird),
  // der Geltungsbeginn dieser Fassung. Liegt beides auf oder vor dem Stichtag, bleibt die
  // Herkunft ungeklärt.
  const entryDate = [initialEntry?.date, initialVersion?.validFrom, record.meta.effectiveDate]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  if (!entryDate || entryDate <= LEGAL_BASELINE_DATE) return false;

  const normLookup = new Map(records.map((entry) => [entry.meta.slug, entry]));
  const enactingNorm = record.meta.enactingNorm
    ? normLookup.get(record.meta.enactingNorm)
    : undefined;

  return hasOwnPublicationEvidence(record)
    || Boolean(enactingNorm && !hasSaxonSource(enactingNorm) && hasOwnPublicationEvidence(enactingNorm));
}

export function getNormOriginInfo(
  record: NormRecord,
  records: NormRecord[] = [record],
): NormOriginInfo {
  const baselineVersion = getBaselineVersion(record);
  const ownChanges = getOwnNormChanges(record, records);
  const common = {
    ownAmendmentCount: ownChanges.filter((entry) => entry.type === 'amendment').length,
    ownChangeCount: ownChanges.length,
    ownChanges,
    firstOwnChangeDate: ownChanges[0]?.date,
    lastOwnChangeDate: ownChanges.at(-1)?.date,
  };

  if (baselineVersion) {
    const baselineSource = baselineVersion.sourceReferences?.find(sourceCoversBaseline);
    return {
      ...common,
      kind: ownChanges.length > 0 ? 'inherited-amended' : 'inherited-unchanged',
      baselineDate: LEGAL_BASELINE_DATE,
      baselineVersionId: baselineVersion.versionId,
      baselineSourceUrl: baselineSource?.url,
    };
  }

  if (isProvenOwnOriginal(record, records)) {
    return { ...common, kind: 'ostdeutsch-original' };
  }

  return { ...common, kind: 'origin-unresolved' };
}

/**
 * Erklärende öffentliche Bezeichnung der Rechtsherkunft. Sie wird projiziert (Suchfilter in
 * law_runtime_meta über search.ts) und ist zugleich die Langform der Oberfläche; die Kurzform
 * für Listen und die Erläuterung für Tooltips stehen in origin-presentation.ts
 * (`formatNormOriginBadge`, `describeNormOriginKind`).
 */
export function formatNormOriginKind(kind: NormOriginKind): string {
  if (kind === 'ostdeutsch-original') return 'Ostdeutsch neu geschaffen';
  if (kind === 'inherited-amended') return 'Übernommen und ostdeutsch geändert';
  if (kind === 'inherited-unchanged') return 'Übernommen und unverändert';
  return 'Herkunft ungeklärt';
}
