import {
  getAccessibilityUrl,
  getHomeUrl,
  getImprintUrl,
  getLawConstitutionUrl,
  getLawDevelopmentUrl,
  getLawFundingUrl,
  getLawHomeUrl,
  getLawHelpUrl,
  getLawIndexUrl,
  getLawPublicationsUrl,
  getLawReferencesUrl,
  getLawSearchUrl,
  getLawSubjectsUrl,
  getPrivacyUrl,
  getServiceOverviewUrl,
  getLawUrl,
} from '@ostrecht/shared/lib/portal/routes.ts';
import type { NormRecord } from '@ostrecht/shared/lib/norms/schema.ts';
import { lawSubjectAreas } from '@ostrecht/shared/config/law-subjects.ts';
import { getApplicableVersion } from '@ostrecht/shared/lib/norms/versions.ts';
import { getNormVersionIdentity } from '@ostrecht/shared/lib/norms/identity.ts';

function normalizeForSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getNormUrl(slug: string): string {
  return getLawUrl(`/norm/${slug}/`);
}

export function getNormHistoryUrl(slug: string): string {
  return getLawUrl(`/norm/${slug}/history/`);
}

export function getNormVersionUrl(slug: string, versionId: string): string {
  return getLawUrl(`/norm/${slug}/version/${versionId}/`);
}

export function getNormCompareUrl(slug: string): string {
  return getLawUrl(`/norm/${slug}/vergleich/`);
}

export function getSearchUrl(): string {
  return getLawSearchUrl();
}

export function getLawsUrl(): string {
  return getLawUrl('/gesetze/');
}

export function getRegulationsUrl(): string {
  return getLawUrl('/verordnungen/');
}

export function getAdministrativeRulesUrl(): string {
  return getLawUrl('/verwaltungsvorschriften/');
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

export function getReferencesUrl(): string {
  return getLawReferencesUrl();
}

export function getPublicationsUrl(): string {
  return getLawPublicationsUrl();
}

export function getPublicationUrl(slug: string): string {
  return getLawUrl(`/verkuendungen/${slug}/`);
}

export function getHelpUrl(): string {
  return getLawHelpUrl();
}

export function getLawPortalUrl(): string {
  return getLawHomeUrl();
}

export function getLawDevelopmentOverviewUrl(): string {
  return getLawDevelopmentUrl();
}

export function getNormCompareSelectionUrl(
  slug: string,
  fromVersionId: string,
  toVersionId: string,
): string {
  const params = new URLSearchParams({ von: fromVersionId, bis: toVersionId });
  return `${getNormCompareUrl(slug)}?${params}`;
}

export function getNormCompareDataUrl(
  slug: string,
  fromVersionId: string,
  toVersionId: string,
): string {
  return getLawUrl(`/norm/${slug}/vergleich/${fromVersionId}/${toVersionId}.json`);
}

export {
  getAccessibilityUrl,
  getHomeUrl,
  getImprintUrl,
  getLawConstitutionUrl,
  getLawDevelopmentUrl,
  getLawFundingUrl,
  getLawHelpUrl,
  getLawPublicationsUrl,
  getLawReferencesUrl,
  getPrivacyUrl,
  getServiceOverviewUrl,
};

export function getSubjectSlug(subject: string): string {
  return normalizeForSlug(subject);
}

export function getSubjectUrl(subject: string): string {
  return getLawUrl(`/sachgebiete/${getSubjectSlug(subject)}/`);
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
      norms: [...group.norms].sort((left, right) => {
        const leftTitle = getNormVersionIdentity(left, getApplicableVersion(left)).title;
        const rightTitle = getNormVersionIdentity(right, getApplicableVersion(right)).title;
        return leftTitle.localeCompare(rightTitle, 'de');
      }),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getSubjectAreaGroups(norms: NormRecord[]): SubjectAreaGroup[] {
  const subjectGroups = getSubjectGroups(norms);
  const knownSubjects = new Set<string>();
  const areaGroups = lawSubjectAreas.map((definition) => {
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
    const identity = getNormVersionIdentity(norm, getApplicableVersion(norm));
    const key = getGermanIndexLetter(identity.title);
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
      norms: [...entries].sort((left, right) => {
        const leftTitle = getNormVersionIdentity(left, getApplicableVersion(left)).title;
        const rightTitle = getNormVersionIdentity(right, getApplicableVersion(right)).title;
        return leftTitle.localeCompare(rightTitle, 'de');
      }),
    }));
}

/** Ä, Ö und Ü werden wie A, O und U gruppiert; # bleibt nichtalphabetischen Anfängen vorbehalten. */
export function getGermanIndexLetter(value: string): string {
  const letter = value.trim().charAt(0).toLocaleUpperCase('de-DE');
  const folded = ({ Ä: 'A', Ö: 'O', Ü: 'U' } as Record<string, string>)[letter] ?? letter;
  return /[A-Z]/u.test(folded) ? folded : '#';
}
