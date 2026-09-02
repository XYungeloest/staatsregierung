import type { APIRoute } from 'astro';
import { siteUrls } from '@ostrecht/shared/config/site.ts';
import {
  getAccessibilityUrl,
  getActionPlanUrl,
  getBudgetPageUrl,
  getBudgetUrl,
  getCabinetUrl,
  getCareerUrl,
  getCoalitionUrl,
  getContactUrl,
  getEducationAndSchoolUrl,
  getEasyLanguageUrl,
  getEventIndexUrl,
  getEventUrl,
  getFaqUrl,
  getFreestatePageUrl,
  getFreestateUrl,
  getGovernmentMemberUrl,
  getGovernmentMembersUrl,
  getGovernmentUrl,
  getHoldingsUrl,
  getHomeUrl,
  getImprintUrl,
  getJobUrl,
  getKreisreformUrl,
  getLawBridgeUrl,
  getMinistryUrl,
  getMinisterPresidentUrl,
  getPressReleaseIndexUrl,
  getPressReleaseUrl,
  getPressUrl,
  getPreviousCabinetsUrl,
  getPrivacyUrl,
  getPublicationsUrl,
  getServiceOverviewUrl,
  getServiceUrl,
  getSchoolSystemUrl,
  getSignLanguageUrl,
  getSpeechIndexUrl,
  getSpeechUrl,
  getTopicUrl,
  getTopicsUrl,
} from '@ostrecht/shared/lib/portal/routes.ts';
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
} from '@ostrecht/shared/lib/portal/content.ts';

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

export const GET: APIRoute = async ({ site }) => {
  const baseUrl = site ?? new URL(siteUrls.portal);
  const [governmentMembers, ministries, topics, pressReleases, speeches, events, budgetPages, freestatePages, jobOffers] = await Promise.all([
    loadGovernmentMembers(),
    loadMinistries(),
    loadTopics(),
    loadPressReleases(),
    loadSpeeches(),
    loadEvents(),
    loadBudgetPages(),
    loadFreestatePages(),
    loadJobOffers(),
  ]);

  const staticPaths = [
    getHomeUrl(), getGovernmentUrl(), getGovernmentMembersUrl(), getHoldingsUrl(), getMinisterPresidentUrl(),
    getCabinetUrl(), getCoalitionUrl(), getActionPlanUrl(), getKreisreformUrl(), getTopicsUrl(),
    getEducationAndSchoolUrl(), getSchoolSystemUrl(), getPressUrl(), getPressReleaseIndexUrl(),
    getSpeechIndexUrl(), getEventIndexUrl(), getBudgetUrl(), getFreestateUrl(), getServiceUrl(),
    getServiceOverviewUrl(), getCareerUrl(), getContactUrl(), getFaqUrl(), getPublicationsUrl(),
    getEasyLanguageUrl(), getSignLanguageUrl(), getAccessibilityUrl(), getImprintUrl(), getPrivacyUrl(),
    getLawBridgeUrl(), getPreviousCabinetsUrl(), `${getPreviousCabinetsUrl()}honecker-i/`,
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
  ];
  const lastmodByPath = new Map<string, string>();
  for (const entry of pressReleases) lastmodByPath.set(getPressReleaseUrl(entry.slug), entry.date);
  for (const entry of speeches) lastmodByPath.set(getSpeechUrl(entry.slug), entry.date);
  for (const entry of events) lastmodByPath.set(getEventUrl(entry.slug), entry.date);
  for (const entry of jobOffers) lastmodByPath.set(getJobUrl(entry.slug), entry.datePosted);

  const paths = [...new Set([...staticPaths, ...dynamicPaths])];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => {
      const lastmod = lastmodByPath.get(path);
      const absoluteUrl = new URL(path, baseUrl).toString();
      return `  <url><loc>${escapeXml(absoluteUrl)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
    }),
    '</urlset>',
  ].join('\n');

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
