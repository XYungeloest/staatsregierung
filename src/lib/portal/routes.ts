import {
  isLawSite,
  lawSiteConfig,
  siteConfig,
  siteUrls,
  type LawSitePathKey,
  type SitePathKey,
} from '../../config/site.ts';

const base = import.meta.env?.BASE_URL ?? '/';
const specialProtocolPattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/iu;

export function withBase(path: string): string {
  if (base === '/') {
    return path;
  }

  return `${base}${path.replace(/^\//, '')}`;
}

function absoluteUrl(origin: string, path: string): string {
  return new URL(path, `${origin}/`).toString();
}

export function getPortalUrl(path: string): string {
  return isLawSite ? absoluteUrl(siteUrls.portal, path) : withBase(path);
}

export function getLawUrl(path: string): string {
  return isLawSite ? withBase(path) : absoluteUrl(siteUrls.law, path);
}

export function resolvePortalPath(path: string): string {
  if (!path || specialProtocolPattern.test(path) || !path.startsWith('/')) {
    return path;
  }

  if (path.startsWith('/recht/') && path !== siteConfig.paths.lawBridge) {
    return getLawUrl(path.slice('/recht'.length));
  }

  return getPortalUrl(path);
}

export function getSiteUrl(pathKey: SitePathKey): string {
  return getPortalUrl(siteConfig.paths[pathKey]);
}

export function getLawSiteUrl(pathKey: LawSitePathKey): string {
  return getLawUrl(lawSiteConfig.paths[pathKey]);
}

export function getHomeUrl(): string {
  return getSiteUrl('home');
}

export function getPortalSearchUrl(): string {
  return getSiteUrl('search');
}

export function getGovernmentUrl(): string {
  return getSiteUrl('government');
}

export function getGovernmentMembersUrl(): string {
  return getSiteUrl('governmentMembers');
}

export function getGovernmentMemberUrl(slug: string): string {
  return getPortalUrl(`${siteConfig.paths.governmentMembers}${slug}/`);
}

export function getMinisterPresidentUrl(): string {
  return getSiteUrl('ministerPresident');
}

export function getCabinetUrl(): string {
  return getSiteUrl('cabinet');
}

export function getHoldingsUrl(): string {
  return getSiteUrl('holdings');
}

export function getPreviousCabinetsUrl(): string {
  return getSiteUrl('previousCabinets');
}

export function getCoalitionUrl(): string {
  return getSiteUrl('coalition');
}

export function getActionPlanUrl(): string {
  return getSiteUrl('actionPlan');
}

export function getKreisreformUrl(): string {
  return getSiteUrl('kreisreform');
}

export function getMinistriesUrl(): string {
  return getCabinetUrl();
}

export function getMinistryUrl(slug: string): string {
  return getPortalUrl(`${siteConfig.paths.cabinet}${slug}/`);
}

export function getTopicsUrl(): string {
  return getSiteUrl('topics');
}

export function getTopicUrl(slug: string): string {
  return getPortalUrl(`${siteConfig.paths.topics}${slug}/`);
}

export function getEducationAndSchoolUrl(): string {
  return getSiteUrl('educationAndSchool');
}

export function getSchoolSystemUrl(): string {
  return getSiteUrl('schoolSystem');
}

export function getPressUrl(): string {
  return getSiteUrl('press');
}

export function getPressReleaseIndexUrl(): string {
  return getSiteUrl('pressReleases');
}

export function getPressReleaseUrl(slug: string): string {
  return getPortalUrl(`${siteConfig.paths.pressReleases}${slug}/`);
}

export function getSpeechIndexUrl(): string {
  return getSiteUrl('pressSpeeches');
}

export function getSpeechUrl(slug: string): string {
  return getPortalUrl(`${siteConfig.paths.pressSpeeches}${slug}/`);
}

export function getEventIndexUrl(): string {
  return getSiteUrl('pressDates');
}

export function getEventUrl(slug: string): string {
  return getPortalUrl(`${siteConfig.paths.pressDates}${slug}/`);
}

export function getBudgetUrl(): string {
  return getSiteUrl('budget');
}

export function getBudgetPageUrl(slug: string): string {
  return getPortalUrl(`${siteConfig.paths.budget}${slug}/`);
}

export function getBudgetPlanUrl(planNumber: string): string {
  return getPortalUrl(`${siteConfig.paths.budget}einzelplaene/${planNumber.padStart(2, '0')}/`);
}

export function getFreestateUrl(): string {
  return getSiteUrl('freestate');
}

export function getFreestatePageUrl(slug: string): string {
  return getPortalUrl(`${siteConfig.paths.freestate}${slug}/`);
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
  return getPortalUrl(`${siteConfig.paths.career}${slug}/`);
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
  return getLawSiteUrl('home');
}

export function getLawBridgeUrl(): string {
  return getSiteUrl('lawBridge');
}

export function getLawSearchUrl(): string {
  return getLawSiteUrl('search');
}

export function getLawIndexUrl(): string {
  return getLawSiteUrl('index');
}

export function getLawSubjectsUrl(): string {
  return getLawSiteUrl('subjects');
}

export function getLawFundingUrl(): string {
  return getLawSiteUrl('funding');
}

export function getLawReferencesUrl(): string {
  return getLawSiteUrl('references');
}

export function getLawPublicationsUrl(): string {
  return getLawSiteUrl('publications');
}

export function getLawConstitutionUrl(): string {
  return getLawSiteUrl('constitution');
}

export function getLawDevelopmentUrl(): string {
  return getLawSiteUrl('development');
}

export function getLawHelpUrl(): string {
  return getLawSiteUrl('help');
}

export function getEasyLanguageUrl(): string {
  return getSiteUrl('easyLanguage');
}

export function getSignLanguageUrl(): string {
  return getSiteUrl('signLanguage');
}

export function getPublicationsUrl(): string {
  return getSiteUrl('publications');
}
