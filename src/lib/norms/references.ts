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

    addUniqueReference(references, norm.meta.abbr, reference);
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
