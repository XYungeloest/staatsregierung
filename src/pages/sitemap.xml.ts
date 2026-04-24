import type { APIRoute } from 'astro';
import { isEditorialToolsEnabled } from '../config/features.ts';
import { siteConfig } from '../config/site.ts';
import {
  getActionPlanUrl,
  getAccessibilityUrl,
  getBudgetPageUrl,
  getBudgetUrl,
  getCabinetUrl,
  getCareerUrl,
  getCoalitionUrl,
  getContactUrl,
  getEventIndexUrl,
  getEventUrl,
  getFaqUrl,
  getFreestatePageUrl,
  getFreestateUrl,
  getGovernmentMemberUrl,
  getGovernmentMembersUrl,
  getGovernmentUrl,
  getHomeUrl,
  getImprintUrl,
  getJobUrl,
  getLawConstitutionUrl,
  getLawHomeUrl,
  getLawIndexUrl,
  getMinistryUrl,
  getMinisterPresidentUrl,
  getPortalSearchUrl,
  getPressReleaseIndexUrl,
  getPressReleaseUrl,
  getPressUrl,
  getPrivacyUrl,
  getServiceOverviewUrl,
  getServiceUrl,
  getSpeechIndexUrl,
  getSpeechUrl,
  getTopicUrl,
  getTopicsUrl,
} from '../lib/portal/index.ts';
import {
  loadBudgetPages,
  loadEvents,
  loadFreestatePages,
  loadGovernmentMembers,
  loadJobOffers,
  loadMinistries,
  loadPressReleases,
  loadSpeeches,
  loadTopics,
} from '../lib/portal/content.ts';
import {
  getNormHistoryUrl,
  getNormUrl,
  getNormVersionUrl,
  getSubjectGroups,
  getSubjectUrl,
} from '../lib/norms/index.ts';
import { loadAllNorms } from '../lib/norms/content.ts';

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function toAbsoluteUrl(path: string, site: URL): string {
  return new URL(path, site).toString();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

export const GET: APIRoute = async ({ site }) => {
  const baseUrl = site ?? new URL(siteConfig.seo.siteUrl);
  const [
    governmentMembers,
    ministries,
    topics,
    pressReleases,
    speeches,
    events,
    budgetPages,
    freestatePages,
    jobOffers,
    norms,
  ] = await Promise.all([
    loadGovernmentMembers(),
    loadMinistries(),
    loadTopics(),
    loadPressReleases(),
    loadSpeeches(),
    loadEvents(),
    loadBudgetPages(),
    loadFreestatePages(),
    loadJobOffers(),
    loadAllNorms(),
  ]);

  const staticPaths = [
    getHomeUrl(),
    getPortalSearchUrl(),
    getGovernmentUrl(),
    getGovernmentMembersUrl(),
    getMinisterPresidentUrl(),
    getCabinetUrl(),
    getCoalitionUrl(),
    getActionPlanUrl(),
    getTopicsUrl(),
    getPressUrl(),
    getPressReleaseIndexUrl(),
    getSpeechIndexUrl(),
    getEventIndexUrl(),
    getBudgetUrl(),
    getFreestateUrl(),
    getServiceUrl(),
    getServiceOverviewUrl(),
    getCareerUrl(),
    getContactUrl(),
    getFaqUrl(),
    getAccessibilityUrl(),
    getImprintUrl(),
    getPrivacyUrl(),
    getLawHomeUrl(),
    getLawIndexUrl(),
    getLawConstitutionUrl(),
    `${getLawHomeUrl()}sachgebiete/`,
  ];

  const dynamicPaths = [
    ...governmentMembers.map((entry) => getGovernmentMemberUrl(entry.slug)),
    ...ministries.map((entry) => getMinistryUrl(entry.slug)),
    ...topics.map((entry) => getTopicUrl(entry.slug)),
    ...pressReleases.map((entry) => getPressReleaseUrl(entry.slug)),
    ...speeches.map((entry) => getSpeechUrl(entry.slug)),
    ...events.map((entry) => getEventUrl(entry.slug)),
    ...budgetPages.map((entry) => getBudgetPageUrl(entry.slug)),
    ...freestatePages.map((entry) => getFreestatePageUrl(entry.slug)),
    ...jobOffers.map((entry) => getJobUrl(entry.slug)),
    ...norms.flatMap((norm) => [
      getNormUrl(norm.meta.slug),
      getNormHistoryUrl(norm.meta.slug),
      ...norm.versions
        .filter((version) => !version.isCurrent)
        .map((version) => getNormVersionUrl(norm.meta.slug, version.versionId)),
    ]),
    ...getSubjectGroups(norms).map((group) => getSubjectUrl(group.name)),
  ];

  const editorialPaths = isEditorialToolsEnabled() ? [siteConfig.paths.editorial] : [];
  const paths = unique([...staticPaths, ...dynamicPaths, ...editorialPaths]).filter(
    (path) => path !== siteConfig.paths.lawSearch && path !== siteConfig.paths.editorial,
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map(
      (path) => `  <url><loc>${escapeXml(toAbsoluteUrl(path, baseUrl))}</loc></url>`,
    ),
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
