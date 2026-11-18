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

/**
 * Datierte Fundstelle mit unmittelbar vorangestelltem Artikelbezug („Artikel 6 des Gesetzes vom …
 * (…)“, „Artikel 1 der Verordnung vom … (…)“, auch mit Absatz oder Paragraf innerhalb des Artikels:
 * „Artikel 2 § 1 der Verordnung vom … (…)“); der Artikel gehört nur zu genau dieser Fundstelle.
 */
const DATED_REFERENCE_WITH_ARTICLE =
  /(?:\b(Artikel\s+\d+[a-z]?(?:\s+(?:Absatz|§)\s+\d+[a-z]?)?)\s+((?:des|der)\s+[\p{L}-]+)\s+)?\b(vom\s+\d{1,2}\.\s+\p{L}+\s+\d{4}\s+\([^)]+\))/gu;

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

/** „vom 13. November 2026 (OGVBl. 2026 Nr. 9)“ ohne Seitenangabe als Vergleichsschlüssel. */
function publicationKey(value: string | undefined): string | undefined {
  const reference = value ? latestDatedReference(toDisplayText(value)) : undefined;
  return reference
    ?.replace(/,?\s+S\.\s*[\d\s,–-]+(?=\))/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function changeClausePublicationKey(citation: string): string | undefined {
  const marker = citation.search(CHANGE_CLAUSE);
  return marker >= 0 ? publicationKey(citation.slice(marker)) : undefined;
}

/**
 * Letzte Änderung, die die Fassung nachweislich enthält. Nennt das gespeicherte Zitat der Fassung
 * die Fundstelle der letzten Änderung, gilt die Historie mit genau dieser Fundstelle; sie kann
 * eine frühere Fassung betroffen haben, wenn sie später verkündet, aber früher wirksam wurde.
 * Ohne passende Fundstelle bleibt es beim jüngsten Historieneintrag der Fassung.
 */
function latestAmendmentForVersion(
  norm: NormRecord,
  version: NormVersion,
  recordsBySlug: NormRecordLookup,
): NormHistoryEntry | undefined {
  const amendments = norm.history.entries
    .filter((entry) => entry.type === 'amendment' && entry.relatedNorm)
    .toSorted((left, right) => left.date.localeCompare(right.date));
  const own = amendments.filter((entry) => entry.affectingVersionId === version.versionId);
  const citedKey = changeClausePublicationKey(toDisplayText(version.citation));
  if (citedKey) {
    const cited = amendments.filter((entry) => {
      if (entry.date > version.validFrom && entry.affectingVersionId !== version.versionId) return false;
      const amendment = entry.relatedNorm ? recordsBySlug.get(entry.relatedNorm) : undefined;
      return publicationKey(entry.citation) === citedKey
        || (amendment !== undefined && publicationKey(amendment.meta.initialCitation) === citedKey);
    });
    const match = cited.filter((entry) => own.includes(entry)).at(-1) ?? cited.at(-1);
    if (match) return match;
  }
  return own.at(-1);
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

/**
 * Genitiv mit Artikel („des Gesetzes“, „des Zweiten Gesetzes …“, „der Verordnung“). Für eine bloße
 * Dokumentbezeichnung ohne Zusatz gilt die Wendung des gespeicherten Zitats („des Staatsvertrages“).
 */
function genitiveAmendmentTitle(value: string, sourceGenitive: string | undefined): string {
  if (sourceGenitive && !/\s/u.test(value.trim())) return sourceGenitive;
  if (/^Gesetz\b/u.test(value)) return value.replace(/^Gesetz\b/u, 'des Gesetzes');

  const ordinalLaw = value.match(/^(.+?)es Gesetz\b(.*)$/u);
  if (ordinalLaw) return `des ${ordinalLaw[1]}en Gesetzes${ordinalLaw[2]}`;

  const feminine = value.match(/^((?:\p{L}+e\s+)?)([\p{L}-]*(?:verordnung|ordnung|bekanntmachung|anordnung|richtlinie|vereinbarung|verfügung))\b(.*)$/iu);
  if (feminine) {
    const ordinal = feminine[1] ? `${feminine[1].trimEnd()}n ` : '';
    return `der ${ordinal}${feminine[2]}${feminine[3]}`;
  }

  return sourceGenitive ?? `des ${value}`;
}

/** Letzte datierte Fundstelle des Zitats samt dem Artikel, der unmittelbar vor ihr steht. */
function latestReferenceWithArticle(value: string): { article?: string; genitive?: string; reference: string } | undefined {
  const match = [...value.matchAll(DATED_REFERENCE_WITH_ARTICLE)].at(-1);
  return match ? { article: match[1], genitive: match[2], reference: match[3] } : undefined;
}

function latestDatedReference(value: string): string | undefined {
  return [...value.matchAll(/\b(vom\s+\d{1,2}\.\s+\p{L}+\s+\d{4}\s+\([^)]+\))/gu)]
    .at(-1)?.[1];
}

/**
 * Ändernde Vorschrift im Vollzitat. Artikel, Datum und Fundstelle aus dem gespeicherten Zitat der
 * Fassung gelten nur, wenn dessen letzte Fundstelle dieselbe Verkündung bezeichnet wie der
 * Historieneintrag; sonst trägt allein der Datensatz der ändernden Vorschrift das Zitat.
 */
function amendmentReference(
  amendment: NormRecord,
  amendmentEntry: NormHistoryEntry,
  sourceCitation: string,
): string {
  const citation = splitCitationTitle(primaryCitationForNorm(amendment));
  if (!citation) return primaryCitationForNorm(amendment);
  const sourceDocument = splitCitationTitle(toDisplayText(amendment.meta.initialCitation))?.title
    ?? formatNormType(amendment.meta.type);

  const source = latestReferenceWithArticle(toDisplayText(sourceCitation));
  const sourceKey = publicationKey(source?.reference);
  const matchesAmendment = sourceKey !== undefined && (
    sourceKey === publicationKey(amendmentEntry.citation)
    || sourceKey === publicationKey(amendment.meta.initialCitation)
  );
  const article = matchesAmendment ? source?.article : undefined;
  const sourceDateAndReference = matchesAmendment ? source?.reference : undefined;
  const dateAndSource = sourceDateAndReference && (
    /\bS\.\s*\d/u.test(sourceDateAndReference)
    || !/\bS\.\s*\d/u.test(citation.dateAndSource)
  )
    ? sourceDateAndReference
    : citation.dateAndSource;
  const title = article
    ? `${article} ${genitiveAmendmentTitle(sourceDocument, source?.genitive)}`
    : accusativeAmendmentTitle(sourceDocument);

  return `${title} ${dateAndSource}`;
}

/**
 * Relativpronomen nach dem Kernwort der zitierten Bezeichnung: das Kernwort steht vor der ersten
 * Präposition oder Genitivergänzung („Haushaltsordnung des Freistaates“, „Verordnung der
 * Staatsregierung über …“, „Schulordnung Förderschulen“); ohne erkennbares Kernwort zählt die Normart.
 */
function citationRelativePronoun(norm: NormRecord, citationBase: string): 'der' | 'die' | 'das' {
  const lead = citationBase
    .split(/\s+(?:vom|in\s+der\s+Fassung|für|über|zur|zum|zu|betreffend|des|der|zwischen)\s+|\s*\(/iu)[0];
  for (const word of lead.split(/\s+/u).toReversed()) {
    if (/(?:vertrag|erlass)$/iu.test(word)) return 'der';
    if (/(?:gesetz|abkommen|übereinkommen)$/iu.test(word)) return 'das';
    if (/(?:ordnung|verordnung|vorschrift|richtlinie|verfügung|bekanntmachung|anordnung|verfassung)$/iu.test(word)) {
      return 'die';
    }
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
  const amendmentEntry = latestAmendmentForVersion(norm, version, recordsBySlug);
  const amendment = amendmentEntry?.relatedNorm
    ? recordsBySlug.get(amendmentEntry.relatedNorm)
    : undefined;

  if (!amendment || !amendmentEntry) {
    return normalizeGenericDocumentLead(norm, version.citation, version);
  }

  const base = citationBaseForVersion(norm, version);
  return `${base}, ${citationRelativePronoun(norm, base)} zuletzt durch ${amendmentReference(amendment, amendmentEntry, version.citation)} geändert worden ist`;
}
