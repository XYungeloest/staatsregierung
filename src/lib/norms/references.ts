import { getNormUrl } from './routes.ts';
import type { NormRecord } from './schema.ts';
import { toDisplayText, type TextLinkReference } from './presentation.ts';

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

    if (norm.meta.abbr) addUniqueReference(references, norm.meta.abbr, reference);
    addUniqueReference(references, norm.meta.shortTitle, reference);
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
        left.entry.meta.title.localeCompare(right.entry.meta.title, 'de'),
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

function collectBodyText(norm: NormRecord): string {
  const currentVersion = norm.versions.find((version) => version.isCurrent) ?? norm.versions[0];
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

function aliases(norm: NormRecord): string[] {
  return [norm.meta.abbr, norm.meta.shortTitle, norm.meta.title]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().normalize('NFKC').toLocaleLowerCase('de'))
    .filter((value, index, values) => value.length >= 4 && values.indexOf(value) === index);
}

function textMentionsNorm(text: string, norm: NormRecord): boolean {
  return aliases(norm).some((alias) => text.includes(alias));
}

function explicitRelatedSlugs(norm: NormRecord): Set<string> {
  return new Set(
    [norm.meta.predecessor, norm.meta.successor, ...norm.history.entries.map((entry) => entry.relatedNorm)]
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
        left.norm.meta.title.localeCompare(right.norm.meta.title, 'de'),
    )
    .slice(0, limit);
}
