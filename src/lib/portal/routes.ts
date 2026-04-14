import { siteConfig, type SitePathKey } from '../../config/site.ts';

const base = import.meta.env?.BASE_URL ?? '/';

export function withBase(path: string): string {
  if (base === '/') {
    return path;
  }

  return `${base}${path.replace(/^\//, '')}`;
}

export function getSiteUrl(pathKey: SitePathKey): string {
  return withBase(siteConfig.paths[pathKey]);
}

export function getHomeUrl(): string {
  return getSiteUrl('home');
}

export function getGovernmentUrl(): string {
  return getSiteUrl('government');
}

export function getGovernmentMembersUrl(): string {
  return getSiteUrl('governmentMembers');
}

export function getGovernmentMemberUrl(slug: string): string {
  return withBase(`${siteConfig.paths.governmentMembers}${slug}/`);
}

export function getCabinetUrl(): string {
  return getSiteUrl('cabinet');
}

export function getMinistriesUrl(): string {
  return getSiteUrl('ministries');
}

export function getMinistryUrl(slug: string): string {
  return withBase(`${siteConfig.paths.ministries}${slug}/`);
}

export function getPressUrl(): string {
  return getSiteUrl('press');
}

export function getPressReleaseUrl(slug: string): string {
  return withBase(`${siteConfig.paths.press}${slug}/`);
}

export function getCareerUrl(): string {
  return getSiteUrl('career');
}

export function getJobsUrl(): string {
  return getSiteUrl('jobs');
}

export function getJobUrl(slug: string): string {
  return withBase(`${siteConfig.paths.jobs}${slug}/`);
}

export function getContactUrl(): string {
  return getSiteUrl('contact');
}

export function getImprintUrl(): string {
  return getSiteUrl('imprint');
}

export function getPrivacyUrl(): string {
  return getSiteUrl('privacy');
}

export function getAccessibilityUrl(): string {
  return getSiteUrl('accessibility');
}

export function getOverviewUrl(): string {
  return getSiteUrl('overview');
}

export function getLawHomeUrl(): string {
  return getSiteUrl('lawHome');
}

export function getLawSearchUrl(): string {
  return getSiteUrl('lawSearch');
}

export function getLawIndexUrl(): string {
  return getSiteUrl('lawIndex');
}

export function getLawSubjectsUrl(): string {
  return getSiteUrl('lawSubjects');
}

export function getEditorialUrl(): string {
  return getSiteUrl('editorial');
}
