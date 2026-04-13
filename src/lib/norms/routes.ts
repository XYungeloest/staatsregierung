import type { NormRecord } from './schema.ts';

const base = import.meta.env?.BASE_URL ?? '/';

function withBase(path: string): string {
  if (base === '/') {
    return path;
  }

  return `${base}${path.replace(/^\//, '')}`;
}

function normalizeForSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getNormUrl(slug: string): string {
  return withBase(`/norm/${slug}/`);
}

export function getNormHistoryUrl(slug: string): string {
  return withBase(`/norm/${slug}/history/`);
}

export function getNormVersionUrl(slug: string, versionId: string): string {
  return withBase(`/norm/${slug}/version/${versionId}/`);
}

export function getHomeUrl(): string {
  return withBase('/');
}

export function getIndexUrl(): string {
  return withBase('/index/');
}

export function getSearchUrl(): string {
  return withBase('/search/');
}

export function getSubjectsUrl(): string {
  return withBase('/subjects/');
}

export function getSubjectSlug(subject: string): string {
  return normalizeForSlug(subject);
}

export function getSubjectUrl(subject: string): string {
  return withBase(`/subjects/${getSubjectSlug(subject)}/`);
}

export interface SubjectGroup {
  name: string;
  slug: string;
  norms: NormRecord[];
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
      norms: [...group.norms].sort((left, right) => left.meta.title.localeCompare(right.meta.title)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
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
