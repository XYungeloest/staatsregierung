import { siteConfig, type SitePathKey } from '../../config/site.ts';

const base = import.meta.env?.BASE_URL ?? '/';
const specialProtocolPattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/iu;

export function withBase(path: string): string {
  if (base === '/') {
    return path;
  }

  return `${base}${path.replace(/^\//, '')}`;
}

export function resolvePortalPath(path: string): string {
  if (!path || specialProtocolPattern.test(path) || !path.startsWith('/')) {
    return path;
  }

  return withBase(path);
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
  return getCabinetUrl();
}

export function getMinistryUrl(slug: string): string {
  return withBase(`${siteConfig.paths.cabinet}${slug}/`);
}

export function getTopicsUrl(): string {
  return getSiteUrl('topics');
}

export function getTopicUrl(slug: string): string {
  return withBase(`${siteConfig.paths.topics}${slug}/`);
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

export function getSpeechIndexUrl(): string {
  return getSiteUrl('pressSpeeches');
}

export function getSpeechUrl(slug: string): string {
  return withBase(`${siteConfig.paths.pressSpeeches}${slug}/`);
}

export function getEventIndexUrl(): string {
  return getSiteUrl('pressDates');
}

export function getEventUrl(slug: string): string {
  return withBase(`${siteConfig.paths.pressDates}${slug}/`);
}

export function getBudgetUrl(): string {
  return getSiteUrl('budget');
}

export function getBudgetPageUrl(slug: string): string {
  return withBase(`${siteConfig.paths.budget}${slug}/`);
}

export function getFreestateUrl(): string {
  return getSiteUrl('freestate');
}

export function getFreestatePageUrl(slug: string): string {
  return withBase(`${siteConfig.paths.freestate}${slug}/`);
}

export function getServiceUrl(): string {
  return getSiteUrl('service');
}

export function getCareerUrl(): string {
  return getSiteUrl('career');
}

export function getServiceOverviewUrl(): string {
  return getSiteUrl('serviceOverview');
}

export function getJobUrl(slug: string): string {
  return withBase(`${siteConfig.paths.career}${slug}/`);
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
