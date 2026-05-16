import {
  getAccessibilityUrl,
  getHomeUrl,
  getImprintUrl,
  getLawConstitutionUrl,
  getLawFundingUrl,
  getLawHomeUrl,
  getLawHelpUrl,
  getLawIndexUrl,
  getLawSearchUrl,
  getLawSubjectsUrl,
  getPrivacyUrl,
  getServiceOverviewUrl,
  withBase,
} from '../portal/routes.ts';
import type { NormRecord } from './schema.ts';

function normalizeForSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getNormUrl(slug: string): string {
  return withBase(`/recht/norm/${slug}/`);
}

export function getNormHistoryUrl(slug: string): string {
  return withBase(`/recht/norm/${slug}/history/`);
}

export function getNormVersionUrl(slug: string, versionId: string): string {
  return withBase(`/recht/norm/${slug}/version/${versionId}/`);
}

export function getSearchUrl(): string {
  return getLawSearchUrl();
}

export function getIndexUrl(): string {
  return getLawIndexUrl();
}

export function getSubjectsUrl(): string {
  return getLawSubjectsUrl();
}

export function getFundingUrl(): string {
  return getLawFundingUrl();
}

export function getHelpUrl(): string {
  return getLawHelpUrl();
}

export function getLawPortalUrl(): string {
  return getLawHomeUrl();
}

export {
  getAccessibilityUrl,
  getHomeUrl,
  getImprintUrl,
  getLawConstitutionUrl,
  getLawFundingUrl,
  getLawHelpUrl,
  getPrivacyUrl,
  getServiceOverviewUrl,
};

export function getSubjectSlug(subject: string): string {
  return normalizeForSlug(subject);
}

export function getSubjectUrl(subject: string): string {
  return withBase(`/recht/sachgebiete/${getSubjectSlug(subject)}/`);
}

export interface SubjectGroup {
  name: string;
  slug: string;
  norms: NormRecord[];
}

export interface SubjectAreaGroup {
  name: string;
  description: string;
  subjects: SubjectGroup[];
  normCount: number;
}

const SUBJECT_AREA_DEFINITIONS: Array<{ name: string; description: string; subjects: string[] }> = [
  {
    name: 'Staat, Verwaltung und Sicherheit',
    description: 'Verfassung, Verwaltung, Transparenz, öffentliche Ordnung und allgemeines Landesrecht.',
    subjects: [
      'Landesrecht',
      'Kommunal- und Verwaltungsrecht',
      'Sicherheit und Ordnung',
      'Transparenz und Informationszugang',
      'Verordnungsrecht',
    ],
  },
  {
    name: 'Wirtschaft, Arbeit und soziale Sicherung',
    description: 'Wirtschaftsrecht, Förderung, Arbeit, Soziales, Wohnen und Bodenordnung.',
    subjects: ['Arbeit und Soziales', 'Wirtschaft und Förderung', 'Wohnen und Bodenordnung'],
  },
  {
    name: 'Bildung, Kultur und Gesellschaft',
    description: 'Bildung, Medien, Rundfunk, Feiertage und gesellschaftliches Leben.',
    subjects: ['Bildung und Weiterbildung', 'Rundfunk und Medien', 'Feiertage und gesellschaftliches Leben'],
  },
  {
    name: 'Umwelt, Raum und Nachbarschaft',
    description: 'Umwelt, Energie, Raumordnung, Landesplanung, Staatsverträge und Nachbarschaftsrecht.',
    subjects: [
      'Umwelt, Energie und Klimaschutz',
      'Raumordnung und Landesplanung',
      'Völkerrecht und Staatsverträge',
    ],
  },
];

export function getSubjectGroups(norms: NormRecord[]): SubjectGroup[] {
  const groups = new Map<string, SubjectGroup>();

  for (const norm of norms) {
    for (const subject of norm.meta.subjects) {
      const slug = getSubjectSlug(subject);
      const existing = groups.get(slug);

      if (existing) {
        existing.norms.push(norm);
        continue;
      }

      groups.set(slug, {
        name: subject,
        slug,
        norms: [norm],
      });
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      norms: [...group.norms].sort((left, right) => left.meta.title.localeCompare(right.meta.title)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getSubjectAreaGroups(norms: NormRecord[]): SubjectAreaGroup[] {
  const subjectGroups = getSubjectGroups(norms);
  const knownSubjects = new Set<string>();
  const areaGroups = SUBJECT_AREA_DEFINITIONS.map((definition) => {
    const subjects = definition.subjects
      .map((subject) => subjectGroups.find((group) => group.name === subject))
      .filter((group): group is SubjectGroup => Boolean(group));

    for (const subject of subjects) {
      knownSubjects.add(subject.name);
    }

    return {
      name: definition.name,
      description: definition.description,
      subjects,
      normCount: new Set(subjects.flatMap((subject) => subject.norms.map((norm) => norm.meta.slug))).size,
    };
  });

  const remainingSubjects = subjectGroups.filter((subject) => !knownSubjects.has(subject.name));
  if (remainingSubjects.length > 0) {
    areaGroups.push({
      name: 'Weitere Sachgebiete',
      description: 'Weitere im Normenbestand verwendete fachliche Zuordnungen.',
      subjects: remainingSubjects,
      normCount: new Set(remainingSubjects.flatMap((subject) => subject.norms.map((norm) => norm.meta.slug))).size,
    });
  }

  return areaGroups.filter((group) => group.subjects.length > 0);
}

export function getIndexGroups(norms: NormRecord[]): Array<{ letter: string; norms: NormRecord[] }> {
  const groups = new Map<string, NormRecord[]>();

  for (const norm of norms) {
    const letter = norm.meta.title.charAt(0).toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : '#';
    const existing = groups.get(key);

    if (existing) {
      existing.push(norm);
    } else {
      groups.set(key, [norm]);
    }
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([letter, entries]) => ({
      letter,
      norms: [...entries].sort((left, right) => left.meta.title.localeCompare(right.meta.title)),
    }));
}
