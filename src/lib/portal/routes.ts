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

export function getMinisterPresidentUrl(): string {
  return getSiteUrl('ministerPresident');
}

export function getCabinetUrl(): string {
  return getSiteUrl('cabinet');
}

export function getCoalitionUrl(): string {
  return getSiteUrl('coalition');
}

export function getActionPlanUrl(): string {
  return getSiteUrl('actionPlan');
}

export function getMinistriesUrl(): string {
  return getSiteUrl('ministries');
}

export function getMinistryUrl(slug: string): string {
  return withBase(`${siteConfig.paths.ministries}${slug}/`);
}

export function getTopicsUrl(): string {
  return getSiteUrl('topics');
}

export function getPressUrl(): string {
  return getSiteUrl('press');
}

export function getPressReleaseIndexUrl(): string {
  return getSiteUrl('pressReleases');
}

export function getPressReleaseUrl(slug: string): string {
  return withBase(`${siteConfig.paths.pressReleases}${slug}/`);
}

export function getBudgetUrl(): string {
  return getSiteUrl('budget');
}

export function getFreestateUrl(): string {
  return getSiteUrl('freestate');
}

export function getServiceUrl(): string {
  return getSiteUrl('service');
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

export function getFaqUrl(): string {
  return getSiteUrl('faq');
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
  return getServiceUrl();
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

export function getLawConstitutionUrl(): string {
  return getSiteUrl('lawConstitution');
}

export function getEditorialUrl(): string {
  return getSiteUrl('editorial');
}
