import { dayAfterLastValidDay, formatDate } from '@ostrecht/shared/lib/norms/display.ts';
import { LEGAL_BASELINE_DATE, type NormOriginInfo } from '@ostrecht/shared/lib/norms/origin.ts';
import { classifyNormOriginVersion } from '@ostrecht/shared/lib/norms/origin-presentation.ts';
import { toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';
import { hasNumberedIssue, type NormPublicationReference } from '@ostrecht/shared/lib/norms/publications.ts';
import { getNormCompareSelectionUrl, getNormUrl, getNormVersionUrl, getPublicationUrl } from '@ostrecht/shared/lib/norms/routes.ts';
import type { NormHistoryEntry, NormRecord, NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';
import { classifyNormVersion, classifyNormVersions, EDITORIAL_REFERENCE_DATE, type VersionTemporalKind } from '@ostrecht/shared/lib/norms/versions.ts';

import { formatShortDate } from './dates.ts';
import { citationReference, describeChangeAgent } from './history-labels.ts';
import { validityLabel } from './vocabulary.ts';

/**
 * Kopf der Normansichten (Richtung E, P3/P3b): Statusmarke, Statuszeile mit Fassung, Geltung,
 * letzter Änderung und verkündeter künftiger Änderung, dazu Statusband und Herkunftszeile.
 * Eine Quelle für Text-, Fassungs-, Historien- und Vergleichsseite; die Wörter kommen aus der
 * Wortliste (vocabulary.ts).
 */
export interface HeadLink {
  text: string;
  href?: string;
  /** Farbrolle des Teils: künftig (Gold) oder Hinweis. */
  tone?: 'future' | 'muted';
}

export interface NormHeadBand {
  kind: 'historical' | 'future' | 'unknown-effective';
  title: string;
  text: string;
  links: HeadLink[];
}

export interface NormHeadModel {
  temporalKind: VersionTemporalKind;
  /** Statusmarke: Geltung der Vorschrift (bei historischer Fassung mit Zusatz). */
  mark: { status: NormRecord['meta']['status']; label?: string };
  /** Erste, hervorgehobene Angabe der Statuszeile. */
  primary: string;
  /** Weitere Angaben der Statuszeile in Leserichtung. */
  parts: HeadLink[];
  /** Statusband über dem Kopf (historische, künftige, ungeklärte Fassung). */
  band?: NormHeadBand;
  /** Herkunftszeile: Text und Wege zu Ausgangsfassung, Vergleich und Quelle. */
  origin: { text: string; links: HeadLink[] };
  /** Nächste verkündete, noch nicht wirksame Fassung dieser Vorschrift. */
  nextFuture?: { version: NormVersion; citation?: string; publicationHref?: string };
}

function inForceSince(norm: NormRecord): string | undefined {
  const initial = norm.history.initialVersionId
    ? norm.versions.find((entry) => entry.versionId === norm.history.initialVersionId)
    : undefined;
  return norm.meta.effectiveDate ?? initial?.validFrom;
}

/**
 * Erster Tag, an dem eine außer Kraft getretene Vorschrift nicht mehr gilt: der Folgetag des
 * belegten letzten Geltungstags `expiryDate`. Nur für aufgehobene und historische Vorschriften;
 * sonst (oder ohne belegtes Datum) keine Angabe. Kopf und Vorschriftendaten lesen dasselbe Datum.
 */
export function outOfForceSince(norm: NormRecord): string | undefined {
  const status = norm.meta.status;
  if (status !== 'repealed' && status !== 'historical') return undefined;
  return norm.meta.expiryDate ? dayAfterLastValidDay(norm.meta.expiryDate) : undefined;
}

/**
 * Angabe zur Geltung der Vorschrift selbst (nicht der angezeigten Fassung) in der Statuszeile:
 * aufgehobene Vorschriften nennen den ersten Tag ohne Geltung, noch nicht wirksame den Tag des
 * Inkrafttretens; „in Kraft seit“ nur, wenn das Inkrafttreten am Stichtag erreicht ist. Ohne
 * belegtes Datum oder bei ungeklärtem Inkrafttreten keine Angabe.
 */
function normValidityPart(norm: NormRecord, since: string | undefined, asOf = EDITORIAL_REFERENCE_DATE): string | undefined {
  const status = norm.meta.status;
  if (status === 'repealed' || status === 'historical') {
    const outOfForce = outOfForceSince(norm);
    return outOfForce ? `Vorschrift ${validityLabel(status)} seit ${formatShortDate(outOfForce)}` : undefined;
  }
  if (!since || status === 'pending-effective') return undefined;
  return since > asOf ? `Vorschrift tritt am ${formatShortDate(since)} in Kraft` : `Vorschrift in Kraft seit ${formatShortDate(since)}`;
}

/**
 * Jüngste Änderung bis zum Stichtag (Historieneintrag Änderung), zur Zeile „zuletzt geändert durch“.
 * Gleichtägige Änderungen stehen in der Historie in ihrer Anwendungsreihenfolge; es gilt die zuletzt
 * angewandte, wie im Vollzitat der Fassung.
 */
export function latestAmendment(norm: NormRecord, asOf = EDITORIAL_REFERENCE_DATE): NormHistoryEntry | undefined {
  return norm.history.entries
    .filter((entry) => entry.type === 'amendment' && entry.date <= asOf)
    .toSorted((left, right) => left.date.localeCompare(right.date))
    .at(-1);
}

/**
 * Kurze Fundstelle aus einem Vollzitat: die erste Klammer, die eine Fundstelle bezeichnet (nicht
 * Titel oder Kurzbezeichnung, `citationReference`); ohne Klammer der ganze Text, ohne Fundstelle leer.
 */
export function shortCitation(citation: string | null | undefined): string {
  return citationReference(citation, 'first');
}

/**
 * Fundstelle der ändernden Vorschrift aus einem Vollzitat: die letzte Klammer, die eine Fundstelle
 * bezeichnet (`citationReference`). Bei konsolidierten Fassungen nennt die erste die
 * Stammfundstelle („… in der Fassung der Bekanntmachung vom 9. März 2018 (SächsGVBl. S. 99), die zuletzt durch Artikel 3 des Gesetzes vom 20. Juli 2026
 * (OGVBl. 2026 Nr. 46 S. 2) geändert worden ist“ → „OGVBl. 2026 Nr. 46 S. 2“).
 */
export function amendingCitation(citation: string | null | undefined): string {
  return citationReference(citation, 'last');
}

/**
 * Fundstelle einer Fassung in der Fassungsliste: bei der Stamm- und der Ausgangsfassung die erste
 * Klammer des Vollzitats, bei Folgefassungen die Fundstelle der ändernden Vorschrift (letzte
 * Klammer) – nie die Stammfundstelle, sonst trügen alle Fassungen dieselbe Quelle. Ohne
 * benannte Stammfassung gilt die früheste Fassung als Stammfassung.
 */
export function versionListCitation(norm: NormRecord, version: NormVersion, baselineVersionId?: string | null): string {
  const initialVersionId = norm.history.initialVersionId
    ?? [...norm.versions].sort((left, right) => left.validFrom.localeCompare(right.validFrom))[0]?.versionId;
  const initial = version.versionId === initialVersionId || version.versionId === baselineVersionId;
  return initial ? shortCitation(version.citation) : amendingCitation(version.citation);
}

/**
 * Vergleichsform einer Fundstelle: Blattkürzel, Jahrgang, Nummer und Seite ohne Satzzeichen,
 * Leerraumvarianten und Groß-/Kleinschreibung („OGVBl. 2024 Nr. II S. 5“ → „ogvbl 2024 nr ii s 5“).
 */
const normalizeShortCitation = (value: string) => toDisplayText(value)
  .toLocaleLowerCase('de-DE')
  .replace(/\bseiten?\b/gu, 's')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

/**
 * Vergleichsformen eines Verkündungsbezugs: das Kurzzitat der Ausgabe aus Blattkürzel, Jahrgang
 * und Nummer mit und ohne Anfangsseite, die Fundstelle des Verkündungseintrags und der
 * ausgeschriebene Ausgabentitel. Die Stammfundstelle trägt die Kurzform, der Verkündungsbezug
 * zeigt den Titel; verglichen wird deshalb die Kurzform, nicht der Titel.
 */
function publicationReferenceKeys(reference: NormPublicationReference): Set<string> {
  const page = reference.startPage ? ` S. ${reference.startPage}` : '';
  const issue = reference.issue && hasNumberedIssue({ issue: reference.issue })
    ? `${reference.publication} ${reference.publicationDate.slice(0, 4)} Nr. ${reference.issue}`
    : '';
  return new Set([
    issue ? `${issue}${page}` : '',
    issue,
    shortCitation(reference.citation),
    `${reference.publicationTitle}${page}`,
  ].filter(Boolean).map(normalizeShortCitation).filter(Boolean));
}

/**
 * Fundstelle der Vorschriftendaten ohne Verkündungsbezug: dieselbe Regel wie in der Fassungsliste
 * (versionListCitation), damit Folgefassungen die Fundstelle der ändernden Vorschrift nennen und
 * nicht die erste Klammer ihres konsolidierten Vollzitats. Die Stammfundstelle steht zusätzlich,
 * wenn sie weder dieser Fundstelle noch dem Verkündungsbezug der Fassung entspricht (keine
 * Doppelung). Ohne erkennbare Fundstelle bleibt die Angabe leer wie in der Fassungsliste; das
 * Vollzitat steht ohnehin in einer eigenen Zeile.
 */
export function factsCitation(
  norm: NormRecord,
  version: NormVersion,
  { baselineVersionId, publicationReference }: { baselineVersionId?: string | null; publicationReference?: NormPublicationReference } = {},
): { citation: string; initialCitation?: string } {
  const citation = versionListCitation(norm, version, baselineVersionId);
  const initialCitation = shortCitation(norm.meta.initialCitation);
  if (!initialCitation) return { citation };
  const initialKey = normalizeShortCitation(initialCitation);
  const sameAsShown = initialKey === normalizeShortCitation(citation)
    || Boolean(publicationReference && publicationReferenceKeys(publicationReference).has(initialKey));
  return sameAsShown ? { citation } : { citation, initialCitation };
}

function originText(origin: NormOriginInfo, version: NormVersion): string {
  const versionKind = classifyNormOriginVersion(origin, version);
  const count = origin.ownAmendmentCount;
  const changes = count === 1 ? '1 ostdeutsche Änderung' : `${count} ostdeutsche Änderungen`;
  if (versionKind === 'ostdeutsch-original') return 'Ostdeutsch neu geschaffen, kein übernommenes sächsisches Ausgangsrecht';
  if (versionKind === 'origin-unresolved') return 'Rechtsherkunft noch nicht sicher zugeordnet';
  if (origin.kind === 'inherited-unchanged') return `Übernommen und unverändert: sächsischer Rechtsstand vom ${formatShortDate(LEGAL_BASELINE_DATE)}`;
  if (versionKind === 'baseline') return `Übernommen und ostdeutsch geändert: diese Fassung ist der sächsische Ausgangsrechtsstand vom ${formatShortDate(LEGAL_BASELINE_DATE)}`;
  if (versionKind === 'inherited-intermediate') return `Übernommen und ostdeutsch geändert: übernommener sächsischer Rechtsstand vor der ersten ostdeutschen Änderung`;
  return `Übernommen und ostdeutsch geändert: sächsischer Rechtsstand vom ${formatShortDate(LEGAL_BASELINE_DATE)}, seitdem ${changes}`;
}

function originLinks(norm: NormRecord, version: NormVersion, origin: NormOriginInfo): HeadLink[] {
  if (origin.kind === 'ostdeutsch-original' || origin.kind === 'origin-unresolved') return [];
  const baselineVersion = origin.baselineVersionId ? norm.versions.find((entry) => entry.versionId === origin.baselineVersionId) : undefined;
  const links: HeadLink[] = [];
  if (baselineVersion && baselineVersion.versionId !== version.versionId) {
    const baselineHref = classifyNormVersion(norm, baselineVersion) === 'current' ? getNormUrl(norm.meta.slug) : getNormVersionUrl(norm.meta.slug, baselineVersion.versionId);
    links.push({ text: `Ausgangsfassung vom ${formatShortDate(LEGAL_BASELINE_DATE)}`, href: baselineHref });
    if (origin.kind === 'inherited-amended') links.push({ text: 'Mit Ausgangsrecht vergleichen', href: getNormCompareSelectionUrl(norm.meta.slug, baselineVersion.versionId, version.versionId) });
  }
  if (origin.baselineSourceUrl) links.push({ text: 'Amtliche sächsische Quelle', href: origin.baselineSourceUrl });
  return links;
}

export function buildNormHeadModel(
  norm: NormRecord,
  version: NormVersion,
  {
    origin,
    publicationReference,
    amendmentLabels,
    nextFutureReference,
  }: {
    origin: NormOriginInfo;
    publicationReference?: NormPublicationReference;
    /** Bezeichnungen der Änderungsvorschriften (Slug → Titel). */
    amendmentLabels?: Map<string, { title: string; shortTitle?: string | null }>;
    /** Fundstelle der nächsten künftigen Fassung, wenn bekannt. */
    nextFutureReference?: NormPublicationReference;
  },
): NormHeadModel {
  const temporalKind = classifyNormVersion(norm, version);
  const status = norm.meta.status;
  const since = inForceSince(norm);
  const versionFrom = formatShortDate(version.validFrom);
  const classified = classifyNormVersions(norm);
  const current = classified.find((entry) => entry.kind === 'current')?.version;
  const future = classified.filter((entry) => entry.kind === 'future').map((entry) => entry.version).sort((left, right) => left.validFrom.localeCompare(right.validFrom));
  const nextFutureVersion = future.find((entry) => entry.validFrom > version.validFrom);
  const parts: HeadLink[] = [];
  let primary = '';
  let mark: NormHeadModel['mark'] = { status };
  let band: NormHeadBand | undefined;

  const amendment = latestAmendment(norm);
  // Ohne bekannten Kurztitel nennt describeChangeAgent die ändernde Vorschrift aus Titel oder
  // Vollzitat; Sätze und Änderungsnotizen kommen dort nicht durch.
  const amendmentText = amendment
    ? (amendment.relatedNorm && amendmentLabels?.get(amendment.relatedNorm)?.shortTitle) || describeChangeAgent(amendment)
    : '';
  const publicationHref = publicationReference ? getPublicationUrl(publicationReference.publicationSlug) : undefined;

  if (temporalKind === 'current') {
    if (status === 'in-force') {
      primary = since && since !== version.validFrom ? `Geltende Fassung seit ${versionFrom}` : `Geltende Fassung · in Kraft seit ${versionFrom}`;
      if (since && since !== version.validFrom) parts.push({ text: `Vorschrift in Kraft seit ${formatShortDate(since)}` });
    } else if (status === 'one-time-act') {
      primary = `${validityLabel(status)} · mit Wirkung vom ${versionFrom}`;
    } else if (status === 'repealed' || status === 'historical') {
      const outOfForce = outOfForceSince(norm);
      primary = outOfForce ? `${validityLabel(status)} seit ${formatShortDate(outOfForce)}` : validityLabel(status);
      parts.push({ text: 'Der Wortlaut bleibt zu Dokumentationszwecken lesbar', tone: 'muted' });
    } else if (status === 'future-effective') {
      primary = `Verkündet · tritt am ${formatShortDate(norm.meta.effectiveDate ?? version.validFrom)} in Kraft`;
    } else if (status === 'pending-effective') {
      primary = 'Verkündet · Bedingung für das Inkrafttreten nicht belegt';
    } else {
      primary = validityLabel(status);
    }
    if (amendment && status !== 'one-time-act') {
      parts.push({ text: amendmentText ? `zuletzt geändert durch ${amendmentText} mit Wirkung vom ${formatShortDate(amendment.date)}` : `zuletzt geändert mit Wirkung vom ${formatShortDate(amendment.date)}`, href: amendment.relatedNorm ? getNormUrl(amendment.relatedNorm) : undefined });
      const citation = shortCitation(amendment.citation);
      if (citation) parts.push({ text: citation, href: publicationHref });
    }
  } else if (temporalKind === 'historical') {
    mark = { status, label: `Vorschrift ${validityLabel(status)}` };
    primary = `Angezeigt: historische Fassung ${versionFrom}${version.validTo ? ` – ${formatShortDate(version.validTo)}` : ''}`;
    const validityPart = normValidityPart(norm, since);
    if (validityPart) parts.push({ text: validityPart });
    const outOfForce = status === 'repealed' || status === 'historical';
    parts.push({ text: status === 'in-force' ? 'Die Vorschrift selbst ist weiterhin in Kraft; nur der angezeigte Wortlaut ist überholt.' : outOfForce && validityPart ? 'Der Wortlaut bleibt zu Dokumentationszwecken verfügbar.' : outOfForce ? 'Die Vorschrift ist außer Kraft; der Wortlaut bleibt zu Dokumentationszwecken verfügbar.' : 'Der angezeigte Wortlaut ist historisch und bleibt zu Dokumentationszwecken verfügbar.', tone: 'muted' });
    const successor = classified
      .map((entry) => entry.version)
      .filter((entry) => entry.validFrom > version.validFrom)
      .sort((left, right) => left.validFrom.localeCompare(right.validFrom))[0];
    const replacedBy = successor ? [...norm.history.entries].filter((entry) => entry.type === 'amendment' && entry.date === successor.validFrom)[0] : undefined;
    band = {
      kind: 'historical',
      title: 'Historische Fassung',
      text: `gültig vom ${versionFrom}${version.validTo ? ` bis ${formatShortDate(version.validTo)}` : '; Gültigkeitsende nicht belegt'}${replacedBy ? (() => { const agent = (replacedBy.relatedNorm && amendmentLabels?.get(replacedBy.relatedNorm)?.shortTitle) || describeChangeAgent(replacedBy); return agent ? `, abgelöst durch ${agent}` : ''; })() : ''}`,
      links: current ? [{ text: `Zur geltenden Fassung (seit ${formatShortDate(current.validFrom)}) →`, href: getNormUrl(norm.meta.slug) }] : [],
    };
  } else if (temporalKind === 'future') {
    mark = { status: 'future-effective', label: 'Künftige Fassung' };
    primary = `Angezeigt: künftige Fassung ab ${versionFrom}`;
    if (current) parts.push({ text: `geltende Fassung seit ${formatShortDate(current.validFrom)}`, href: getNormUrl(norm.meta.slug) });
    const validityPart = normValidityPart(norm, since);
    if (validityPart) parts.push({ text: validityPart });
    band = {
      kind: 'future',
      title: 'Künftige Fassung',
      text: `verkündet, tritt am ${versionFrom} in Kraft · gehört bis dahin nicht zum geltenden Rechtsstand`,
      links: current ? [{ text: 'Zur geltenden Fassung →', href: getNormUrl(norm.meta.slug) }] : [],
    };
  } else {
    mark = { status: 'pending-effective' };
    primary = 'Verkündete Fassung · Inkrafttreten nicht belegt';
    const validityPart = normValidityPart(norm, since);
    if (validityPart) parts.push({ text: validityPart });
    band = {
      kind: 'unknown-effective',
      title: 'Inkrafttreten nicht belegt',
      text: 'Verkündet; der Eintritt der Bedingung für das Inkrafttreten ist durch die vorliegenden Quellen noch nicht belegt.',
      links: [],
    };
  }

  // Die verkündete Änderung zitiert die Fundstelle der Änderungsvorschrift: die Verkündung der
  // künftigen Fassung, sonst die letzte Klammer ihres Vollzitats – nie die Stammfundstelle.
  const nextFuture = nextFutureVersion
    ? {
        version: nextFutureVersion,
        citation: (nextFutureReference ? amendingCitation(nextFutureReference.citation) : '') || amendingCitation(nextFutureVersion.citation) || undefined,
        publicationHref: nextFutureReference ? getPublicationUrl(nextFutureReference.publicationSlug) : undefined,
      }
    : undefined;
  if (nextFuture && temporalKind !== 'future') {
    parts.push({ text: `Änderung zum ${formatShortDate(nextFuture.version.validFrom)} verkündet${nextFuture.citation ? ` (${nextFuture.citation})` : ''}`, href: getNormVersionUrl(norm.meta.slug, nextFuture.version.versionId), tone: 'future' });
  }

  return {
    temporalKind,
    mark,
    primary,
    parts,
    band,
    origin: { text: originText(origin, version), links: originLinks(norm, version, origin) },
    nextFuture,
  };
}

/** Kopfzeile über dem Titel: Bereich, Sachgebiet, Normtyp, Ausfertigung, Stammfundstelle. */
export function normKicker(norm: NormRecord): { documentDate?: string; initialCitation: string } {
  return {
    documentDate: norm.meta.documentDate ? formatShortDate(norm.meta.documentDate) : undefined,
    initialCitation: shortCitation(norm.meta.initialCitation),
  };
}

/** Wortlaut des Datums in der Langform für Fließtext. */
export { formatDate };
