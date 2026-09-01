import { NORM_TYPES } from '@ostrecht/shared/lib/norms/schema.ts';
import { getNormVersionIdentity } from '@ostrecht/shared/lib/norms/identity.ts';
import { formatNormType, toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';
import type { NormHistoryEntry, NormRecord, NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';

const ADDITIONAL_GENERIC_DOCUMENT_LEADS = [
  'Verfassung',
  'Organisationserlass',
  'Dienstanordnung',
  'Anordnung',
  'Richtlinie',
  'Übereinkommen',
  'Vereinbarung',
  'Erlass',
] as const;

const GENERIC_DOCUMENT_LEADS = [
  ...new Set([
    ...NORM_TYPES.map((type) => formatNormType(type)),
    ...ADDITIONAL_GENERIC_DOCUMENT_LEADS,
  ]),
].toSorted((left, right) => right.length - left.length);

const CHANGE_CLAUSE =
  /,\s*(?:(?:(?:der|die|das)\s+)?zuletzt\s+durch|(?:zuletzt\s+)?geändert\s+durch|vollständig\s+abgelöst\s+durch)/iu;

const ARTICLE_AMENDMENT =
  /(?:zuletzt\s+)?geändert\s+durch\s+(Artikel\s+\d+[a-z]?(?:\s+Absatz\s+\d+)?)\s+des\s+Gesetzes/giu;

export type NormRecordLookup = ReadonlyMap<string, NormRecord>;

export function buildNormRecordLookup(records: readonly NormRecord[]): Map<string, NormRecord> {
  return new Map(records.map((record) => [record.meta.slug, record]));
}

function stripChangeClause(value: string): string {
  const marker = value.search(CHANGE_CLAUSE);
  return marker >= 0 ? value.slice(0, marker).trim() : value.trim();
}

function normalizeGenericDocumentLead(norm: NormRecord, value: string, version?: NormVersion): string {
  const displayValue = toDisplayText(value).trim();
  const genericLead = GENERIC_DOCUMENT_LEADS.find((label) => {
    if (!displayValue.startsWith(label)) return false;
    return /^\s*(?:vom\b|in der Fassung\b|\()/u.test(displayValue.slice(label.length));
  });
  if (!genericLead) return displayValue;

  const title = version ? getNormVersionIdentity(norm, version).title : norm.meta.title;
  return `${toDisplayText(title)} ${displayValue.slice(genericLead.length).trimStart()}`;
}

function initialPublicationReference(norm: NormRecord): string | undefined {
  return toDisplayText(norm.meta.initialCitation).match(/\([^)]+\)/u)?.[0];
}

function citationBaseForVersion(norm: NormRecord, version: NormVersion): string {
  const base = normalizeGenericDocumentLead(norm, stripChangeClause(version.citation), version);
  if (/\([^)]+\)/u.test(base)) return base;

  const publicationReference = initialPublicationReference(norm);
  return publicationReference ? `${base} ${publicationReference}` : base;
}

function primaryCitationForNorm(norm: NormRecord): string {
  return normalizeGenericDocumentLead(norm, stripChangeClause(norm.meta.initialCitation));
}

function latestAmendmentForVersion(
  norm: NormRecord,
  version: NormVersion,
): NormHistoryEntry | undefined {
  return norm.history.entries
    .filter((entry) =>
      entry.type === 'amendment'
      && entry.affectingVersionId === version.versionId
      && entry.relatedNorm,
    )
    .toSorted((left, right) => left.date.localeCompare(right.date))
    .at(-1);
}

function splitCitationTitle(value: string): { title: string; dateAndSource: string } | undefined {
  const match = value.match(/\s+(vom\s+\d{1,2}\.\s+\p{L}+\s+\d{4}\b.*)$/u);
  if (!match || match.index === undefined) return undefined;

  return {
    title: value.slice(0, match.index).trim(),
    dateAndSource: match[1].trim(),
  };
}

function accusativeAmendmentTitle(value: string): string {
  if (/^Gesetz\b/u.test(value)) return `das ${value}`;

  const ordinalLaw = value.match(/^(.+?)es Gesetz\b(.*)$/u);
  if (ordinalLaw) return `das ${ordinalLaw[1]}e Gesetz${ordinalLaw[2]}`;

  return value;
}

function genitiveAmendmentTitle(value: string): string {
  if (/^Gesetz\b/u.test(value)) return value.replace(/^Gesetz\b/u, 'Gesetzes');

  const ordinalLaw = value.match(/^(.+?)es Gesetz\b(.*)$/u);
  if (ordinalLaw) return `${ordinalLaw[1]}en Gesetzes${ordinalLaw[2]}`;

  return value;
}

function latestArticleReference(value: string): string | undefined {
  return [...value.matchAll(ARTICLE_AMENDMENT)].at(-1)?.[1];
}

function latestDatedReference(value: string): string | undefined {
  return [...value.matchAll(/\b(vom\s+\d{1,2}\.\s+\p{L}+\s+\d{4}\s+\([^)]+\))/gu)]
    .at(-1)?.[1];
}

function amendmentReference(
  amendment: NormRecord,
  sourceCitation: string,
): string {
  const citation = splitCitationTitle(primaryCitationForNorm(amendment));
  if (!citation) return primaryCitationForNorm(amendment);
  const sourceDocument = splitCitationTitle(toDisplayText(amendment.meta.initialCitation))?.title
    ?? formatNormType(amendment.meta.type);

  const article = latestArticleReference(sourceCitation);
  const sourceDateAndReference = latestDatedReference(sourceCitation);
  const dateAndSource = sourceDateAndReference && (
    /\bS\.\s*\d/u.test(sourceDateAndReference)
    || !/\bS\.\s*\d/u.test(citation.dateAndSource)
  )
    ? sourceDateAndReference
    : citation.dateAndSource;
  const title = article
    ? `${article} des ${genitiveAmendmentTitle(sourceDocument)}`
    : accusativeAmendmentTitle(sourceDocument);

  return `${title} ${dateAndSource}`;
}

function citationRelativePronoun(norm: NormRecord, version: NormVersion): 'der' | 'die' | 'das' {
  const title = getNormVersionIdentity(norm, version).title;
  const lead = title.split(/\s+(?:für|über|zur|zum|betreffend)\s+/iu)[0];
  if (/(?:vertrag|erlass)$/iu.test(lead)) return 'der';
  if (/(?:gesetz|abkommen|übereinkommen)$/iu.test(lead)) return 'das';
  if (/(?:ordnung|verordnung|vorschrift|richtlinie|verfügung|bekanntmachung|anordnung|verfassung)$/iu.test(lead)) {
    return 'die';
  }
  if (norm.meta.type === 'gesetz' || norm.meta.type === 'zustimmungsgesetz' || norm.meta.type === 'verwaltungsabkommen') {
    return 'das';
  }
  if (norm.meta.type === 'staatsvertrag') return 'der';
  return 'die';
}

/**
 * Bildet das Vollzitat einer konkreten gespeicherten Fassung.
 *
 * Die unveränderte Quellenfundstelle bleibt in `version.citation` erhalten. Für die öffentliche
 * Zitierweise werden der vollständige Normtitel und – soweit für diese Fassung nachgewiesen –
 * die letzte verknüpfte Änderungsvorschrift ergänzt.
 */
export function buildNormFullCitation(
  norm: NormRecord,
  version: NormVersion,
  recordsBySlug: NormRecordLookup = new Map(),
): string {
  const amendmentEntry = latestAmendmentForVersion(norm, version);
  const amendment = amendmentEntry?.relatedNorm
    ? recordsBySlug.get(amendmentEntry.relatedNorm)
    : undefined;

  if (!amendment) {
    return normalizeGenericDocumentLead(norm, version.citation, version);
  }

  return `${citationBaseForVersion(norm, version)}, ${citationRelativePronoun(norm, version)} zuletzt durch ${amendmentReference(amendment, version.citation)} geändert worden ist`;
}
