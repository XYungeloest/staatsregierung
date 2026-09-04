import { getNormUrl } from '@ostrecht/shared/lib/norms/routes.ts';
import type { NormRecord } from '@ostrecht/shared/lib/norms/schema.ts';
import { toDisplayText, type TextLinkReference } from '@ostrecht/shared/lib/norms/presentation.ts';
import { EDITORIAL_REFERENCE_DATE, getApplicableVersion } from '@ostrecht/shared/lib/norms/versions.ts';
import { getNormVersionIdentity } from '@ostrecht/shared/lib/norms/identity.ts';

const FEDERAL_REFERENCES: TextLinkReference[] = [
  {
    label: 'Grundgesetz',
    url: 'https://www.gesetze-im-internet.de/gg/',
    external: true,
  },
  {
    label: 'Bürgerliches Gesetzbuch',
    url: 'https://www.gesetze-im-internet.de/bgb/',
    external: true,
  },
  {
    label: 'BGB',
    url: 'https://www.gesetze-im-internet.de/bgb/',
    external: true,
  },
  {
    label: 'Handwerksordnung',
    url: 'https://www.gesetze-im-internet.de/hwo/',
    external: true,
  },
  {
    label: 'Bundesausbildungsförderungsgesetz',
    url: 'https://www.gesetze-im-internet.de/baf_g/',
    external: true,
  },
  {
    label: 'Wohnraumförderungsgesetz',
    url: 'https://www.gesetze-im-internet.de/wofg/',
    external: true,
  },
  {
    label: 'Baugesetzbuch',
    url: 'https://www.gesetze-im-internet.de/bbaug/',
    external: true,
  },
  {
    label: 'Waffengesetz',
    url: 'https://www.gesetze-im-internet.de/waffg_2002/',
    external: true,
  },
  {
    label: 'Bundespolizeigesetz',
    url: 'https://www.gesetze-im-internet.de/bgsg_1994/',
    external: true,
  },
  {
    label: 'Strafgesetzbuch',
    url: 'https://www.gesetze-im-internet.de/stgb/',
    external: true,
  },
  {
    label: 'Verwaltungsgerichtsordnung',
    url: 'https://www.gesetze-im-internet.de/vwgo/',
    external: true,
  },
];

function addUniqueReference(
  references: Map<string, TextLinkReference | null>,
  label: string,
  reference: TextLinkReference,
): void {
  const normalizedLabel = toDisplayText(label).trim();
  if (normalizedLabel.length < 3) {
    return;
  }

  if (references.has(normalizedLabel)) {
    references.set(normalizedLabel, null);
    return;
  }

  references.set(normalizedLabel, {
    ...reference,
    label: normalizedLabel,
  });
}

export function buildNormTextLinkReferences(
  norms: NormRecord[],
  currentSlug: string,
  asOf = EDITORIAL_REFERENCE_DATE,
): TextLinkReference[] {
  const references = new Map<string, TextLinkReference | null>();

  for (const norm of norms) {
    if (norm.meta.slug === currentSlug) {
      continue;
    }

    const reference = {
      label: '',
      url: getNormUrl(norm.meta.slug),
    };

    const identity = getNormVersionIdentity(norm, getApplicableVersion(norm, asOf));

    if (identity.abbr) addUniqueReference(references, identity.abbr, reference);
    addUniqueReference(references, identity.shortTitle, reference);
  }

  return [
    ...[...references.values()].filter((entry): entry is TextLinkReference => Boolean(entry)),
    ...FEDERAL_REFERENCES,
  ].sort((left, right) => right.label.length - left.label.length || left.label.localeCompare(right.label, 'de'));
}

export function getRelatedNormsBySubjects(norm: NormRecord, norms: NormRecord[]): NormRecord[] {
  return norms
    .filter((entry) => entry.meta.slug !== norm.meta.slug)
    .map((entry) => ({
      entry,
      sharedSubjects: entry.meta.subjects.filter((subject) => norm.meta.subjects.includes(subject)).length,
    }))
    .filter(({ sharedSubjects }) => sharedSubjects > 0)
    .sort(
      (left, right) =>
        right.sharedSubjects - left.sharedSubjects ||
        getNormVersionIdentity(left.entry, getApplicableVersion(left.entry)).title.localeCompare(
          getNormVersionIdentity(right.entry, getApplicableVersion(right.entry)).title,
          'de',
        ),
    )
    .slice(0, 5)
    .map(({ entry }) => entry);
}

export type NormRelationKind =
  | 'ändert'
  | 'führt aus'
  | 'verweist auf'
  | 'gemeinsame Rechtsgrundlage'
  | 'gleiches Sachgebiet'
  | 'Vorgängerregelung'
  | 'Nachfolgeregelung';

export interface RelatedNormRecommendation {
  norm: NormRecord;
  relation: NormRelationKind;
  score: number;
}

function collectBodyText(norm: NormRecord, asOf = EDITORIAL_REFERENCE_DATE): string {
  const currentVersion = getApplicableVersion(norm, asOf);
  const parts: string[] = [];

  const visit = (blocks: typeof currentVersion.body): void => {
    for (const block of blocks) {
      if (block.label) parts.push(block.label);
      if (block.title) parts.push(block.title);
      if (block.text) parts.push(block.text);
      if (block.children) visit(block.children);
    }
  };

  if (currentVersion) visit(currentVersion.body);
  return parts.join(' ').normalize('NFKC').toLocaleLowerCase('de');
}

function aliases(norm: NormRecord, asOf = EDITORIAL_REFERENCE_DATE): string[] {
  const identity = getNormVersionIdentity(norm, getApplicableVersion(norm, asOf));
  return [identity.abbr, identity.shortTitle, identity.title]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().normalize('NFKC').toLocaleLowerCase('de'))
    .filter((value, index, values) => value.length >= 4 && values.indexOf(value) === index);
}

function textMentionsNorm(text: string, norm: NormRecord): boolean {
  return aliases(norm).some((alias) => text.includes(alias));
}

function explicitRelatedSlugs(norm: NormRecord): Set<string> {
  return new Set(
    [
      norm.meta.predecessor,
      norm.meta.successor,
      ...(norm.meta.relatedNorms ?? []),
      ...norm.history.entries.map((entry) => entry.relatedNorm),
    ]
      .filter((slug): slug is string => Boolean(slug)),
  );
}

/**
 * Liefert nur redaktionell oder in den Normtexten nachvollziehbare Beziehungen.
 * Eine bloße Ressortübereinstimmung ist ausdrücklich kein Empfehlungssignal.
 */
export function getRelatedNormRecommendations(
  norm: NormRecord,
  norms: NormRecord[],
  limit = 5,
): RelatedNormRecommendation[] {
  const sourceText = collectBodyText(norm);
  const sourceExplicit = explicitRelatedSlugs(norm);
  const subjectFrequency = new Map<string, number>();

  for (const entry of norms) {
    for (const subject of entry.meta.subjects) {
      subjectFrequency.set(subject, (subjectFrequency.get(subject) ?? 0) + 1);
    }
  }

  return norms
    .filter((candidate) => candidate.meta.slug !== norm.meta.slug)
    .map((candidate): RelatedNormRecommendation | null => {
      const candidateText = collectBodyText(candidate);
      const candidateExplicit = explicitRelatedSlugs(candidate);

      if (norm.meta.predecessor === candidate.meta.slug) {
        return { norm: candidate, relation: 'Vorgängerregelung', score: 100 };
      }
      if (norm.meta.successor === candidate.meta.slug) {
        return { norm: candidate, relation: 'Nachfolgeregelung', score: 100 };
      }
      if (candidate.meta.predecessor === norm.meta.slug) {
        return { norm: candidate, relation: 'Nachfolgeregelung', score: 100 };
      }
      if (candidate.meta.successor === norm.meta.slug) {
        return { norm: candidate, relation: 'Vorgängerregelung', score: 100 };
      }

      if (candidateExplicit.has(norm.meta.slug)) {
        return {
          norm: candidate,
          relation: candidate.meta.type === 'aenderungsvorschrift' ? 'ändert' : 'verweist auf',
          score: 95,
        };
      }
      if (sourceExplicit.has(candidate.meta.slug)) {
        return { norm: candidate, relation: 'verweist auf', score: 92 };
      }

      const sharedBases = [...candidateExplicit].filter((slug) => sourceExplicit.has(slug));
      if (sharedBases.length > 0) {
        return { norm: candidate, relation: 'gemeinsame Rechtsgrundlage', score: 85 };
      }

      if (textMentionsNorm(sourceText, candidate)) {
        return { norm: candidate, relation: 'verweist auf', score: 80 };
      }
      if (textMentionsNorm(candidateText, norm)) {
        const relation =
          candidate.meta.type === 'aenderungsvorschrift'
            ? 'ändert'
            : candidate.meta.type === 'verordnung' || candidate.meta.type === 'verwaltungsvorschrift'
              ? 'führt aus'
              : 'verweist auf';
        return { norm: candidate, relation, score: 75 };
      }

      const sharedSpecificSubjects = candidate.meta.subjects.filter(
        (subject) => norm.meta.subjects.includes(subject) && (subjectFrequency.get(subject) ?? Infinity) <= 4,
      );
      if (sharedSpecificSubjects.length > 0) {
        return {
          norm: candidate,
          relation: 'gleiches Sachgebiet',
          score: 50 + sharedSpecificSubjects.length,
        };
      }

      return null;
    })
    .filter((entry): entry is RelatedNormRecommendation => Boolean(entry))
    .sort(
      (left, right) =>
        right.score - left.score ||
        getNormVersionIdentity(left.norm, getApplicableVersion(left.norm)).title.localeCompare(
          getNormVersionIdentity(right.norm, getApplicableVersion(right.norm)).title,
          'de',
        ),
    )
    .slice(0, limit);
}

interface ReferenceMatcher<T extends { label: string }> {
  byPrefix: Map<string, T[]>;
  minLength: number;
}

const PREFIX_LENGTH = 3;

function buildReferenceMatcher<T extends { label: string }>(references: T[]): ReferenceMatcher<T> {
  const byPrefix = new Map<string, T[]>();
  let minLength = Number.POSITIVE_INFINITY;
  for (const reference of references) {
    if (reference.label.length < PREFIX_LENGTH) continue;
    const key = reference.label.slice(0, PREFIX_LENGTH);
    const list = byPrefix.get(key) ?? [];
    list.push(reference);
    byPrefix.set(key, list);
    minLength = Math.min(minLength, reference.label.length);
  }
  for (const list of byPrefix.values()) list.sort((left, right) => right.label.length - left.label.length);
  return { byPrefix, minLength };
}

function isWordDelimited(text: string, start: number, length: number): boolean {
  const before = start > 0 ? text[start - 1] : '';
  const after = text[start + length] ?? '';
  const isWordChar = (value: string): boolean => /[\p{L}\p{N}]/u.test(value);
  return !(before && isWordChar(before)) && !(after && isWordChar(after));
}

/**
 * Ermittelt, welche Verweislabels in einem Text vorkommen. Die Prüfung entspricht
 * `renderLinkedDisplayText` (exakte Schreibweise, wortbegrenzt), skaliert aber über
 * einen Präfixindex auch für mehrere tausend Labels.
 */
export function selectMatchingTextLinkReferences(
  references: TextLinkReference[],
  texts: Iterable<string>,
  { delimited = true }: { delimited?: boolean } = {},
): TextLinkReference[] {
  const matcher = buildReferenceMatcher(references);
  const matched = new Map<string, TextLinkReference>();
  for (const rawText of texts) {
    const text = toDisplayText(rawText);
    for (let index = 0; index + PREFIX_LENGTH <= text.length; index += 1) {
      const candidates = matcher.byPrefix.get(text.slice(index, index + PREFIX_LENGTH));
      if (!candidates) continue;
      for (const candidate of candidates) {
        if (matched.has(candidate.label)) continue;
        if (!text.startsWith(candidate.label, index)) continue;
        if (delimited && !isWordDelimited(text, index, candidate.label.length)) continue;
        matched.set(candidate.label, candidate);
      }
    }
  }
  return references.filter((reference) => matched.has(reference.label));
}

export function collectNormBodyText(norm: NormRecord): string {
  return collectBodyText(norm);
}

export interface RelatedNormRecommendationIndexEntry {
  slug: string;
  relation: NormRelationKind;
  score: number;
}

/**
 * Berechnet die Empfehlungen für alle Normen mit denselben Regeln wie
 * `getRelatedNormRecommendations`, aber in einem Durchlauf über den Bestand:
 * Texterwähnungen werden einmal je Norm über einen Präfixindex ermittelt statt
 * paarweise. Das Ergebnis ist je Norm eine sortierte Liste von Slugs.
 */
export function buildRelatedNormRecommendationIndex(
  norms: NormRecord[],
  { limit = 5, asOf = EDITORIAL_REFERENCE_DATE, bodyTextFor = (norm: NormRecord) => collectBodyText(norm, asOf) }: { limit?: number; asOf?: string; bodyTextFor?: (norm: NormRecord) => string } = {},
): Map<string, RelatedNormRecommendationIndexEntry[]> {
  const bySlug = new Map(norms.map((norm) => [norm.meta.slug, norm]));
  const titleFor = new Map(norms.map((norm) => [
    norm.meta.slug,
    getNormVersionIdentity(norm, getApplicableVersion(norm, asOf)).title,
  ]));
  const explicit = new Map(norms.map((norm) => [norm.meta.slug, explicitRelatedSlugs(norm)]));
  const subjectFrequency = new Map<string, number>();
  for (const entry of norms) {
    for (const subject of entry.meta.subjects) {
      subjectFrequency.set(subject, (subjectFrequency.get(subject) ?? 0) + 1);
    }
  }

  // Erwähnungen: Text der Norm enthält einen Alias einer anderen Norm (Teilstring, wie bisher).
  const aliasReferences = norms.flatMap((norm) => aliases(norm, asOf).map((label) => ({ label, slug: norm.meta.slug })));
  const matcher = buildReferenceMatcher(aliasReferences);
  const mentions = new Map<string, Set<string>>();
  const mentionedBy = new Map<string, Set<string>>();
  for (const norm of norms) {
    const text = bodyTextFor(norm);
    const found = new Set<string>();
    for (let index = 0; index + PREFIX_LENGTH <= text.length; index += 1) {
      const candidates = matcher.byPrefix.get(text.slice(index, index + PREFIX_LENGTH));
      if (!candidates) continue;
      for (const candidate of candidates) {
        if (candidate.slug === norm.meta.slug || found.has(candidate.slug)) continue;
        if (text.startsWith(candidate.label, index)) found.add(candidate.slug);
      }
    }
    mentions.set(norm.meta.slug, found);
    for (const slug of found) {
      const reverse = mentionedBy.get(slug) ?? new Set<string>();
      reverse.add(norm.meta.slug);
      mentionedBy.set(slug, reverse);
    }
  }

  const index = new Map<string, RelatedNormRecommendationIndexEntry[]>();
  for (const norm of norms) {
    const sourceExplicit = explicit.get(norm.meta.slug)!;
    const sourceMentions = mentions.get(norm.meta.slug)!;
    const sourceMentionedBy = mentionedBy.get(norm.meta.slug) ?? new Set<string>();
    const entries: RelatedNormRecommendationIndexEntry[] = [];
    for (const candidate of norms) {
      if (candidate.meta.slug === norm.meta.slug) continue;
      const candidateExplicit = explicit.get(candidate.meta.slug)!;
      let entry: RelatedNormRecommendationIndexEntry | null = null;
      if (norm.meta.predecessor === candidate.meta.slug) entry = { slug: candidate.meta.slug, relation: 'Vorgängerregelung', score: 100 };
      else if (norm.meta.successor === candidate.meta.slug) entry = { slug: candidate.meta.slug, relation: 'Nachfolgeregelung', score: 100 };
      else if (candidate.meta.predecessor === norm.meta.slug) entry = { slug: candidate.meta.slug, relation: 'Nachfolgeregelung', score: 100 };
      else if (candidate.meta.successor === norm.meta.slug) entry = { slug: candidate.meta.slug, relation: 'Vorgängerregelung', score: 100 };
      else if (candidateExplicit.has(norm.meta.slug)) {
        entry = { slug: candidate.meta.slug, relation: candidate.meta.type === 'aenderungsvorschrift' ? 'ändert' : 'verweist auf', score: 95 };
      } else if (sourceExplicit.has(candidate.meta.slug)) entry = { slug: candidate.meta.slug, relation: 'verweist auf', score: 92 };
      else if ([...candidateExplicit].some((slug) => sourceExplicit.has(slug))) {
        entry = { slug: candidate.meta.slug, relation: 'gemeinsame Rechtsgrundlage', score: 85 };
      } else if (sourceMentions.has(candidate.meta.slug)) entry = { slug: candidate.meta.slug, relation: 'verweist auf', score: 80 };
      else if (sourceMentionedBy.has(candidate.meta.slug)) {
        entry = {
          slug: candidate.meta.slug,
          relation: candidate.meta.type === 'aenderungsvorschrift'
            ? 'ändert'
            : candidate.meta.type === 'verordnung' || candidate.meta.type === 'verwaltungsvorschrift'
              ? 'führt aus'
              : 'verweist auf',
          score: 75,
        };
      } else {
        const sharedSpecificSubjects = candidate.meta.subjects.filter(
          (subject) => norm.meta.subjects.includes(subject) && (subjectFrequency.get(subject) ?? Infinity) <= 4,
        );
        if (sharedSpecificSubjects.length > 0) {
          entry = { slug: candidate.meta.slug, relation: 'gleiches Sachgebiet', score: 50 + sharedSpecificSubjects.length };
        }
      }
      if (entry) entries.push(entry);
    }
    entries.sort((left, right) =>
      right.score - left.score
      || titleFor.get(left.slug)!.localeCompare(titleFor.get(right.slug)!, 'de'));
    index.set(norm.meta.slug, entries.slice(0, limit));
  }
  void bySlug;
  return index;
}
