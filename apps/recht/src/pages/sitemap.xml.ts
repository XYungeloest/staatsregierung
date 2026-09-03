import type { APIRoute } from 'astro';
import { lawSiteConfig } from '@ostrecht/shared/config/site.ts';
import {
  classifyNormVersion,
  getNormCompareUrl,
  getNormHistoryUrl,
  getNormUrl,
  getNormVersionUrl,
  getPublicationUrl,
  getSubjectGroups,
  getSubjectUrl,
} from '@ostrecht/shared/lib/norms/index.ts';

import { getNormStore } from '../lib/runtime/context.ts';

// Die Sitemap wird aus der D1-Projektion erzeugt und am Rand gecacht.
export const prerender = false;

function escapeXml(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/'/gu, '&apos;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

export const GET: APIRoute = async ({ site, locals }) => {
  const baseUrl = site ?? new URL(lawSiteConfig.seo.siteUrl);
  const store = getNormStore(locals);
  const [norms, publications] = await Promise.all([store.listNorms(), store.listPublications()]);
  const staticPaths = [
    lawSiteConfig.paths.home, lawSiteConfig.paths.index, lawSiteConfig.paths.subjects,
    lawSiteConfig.paths.funding, lawSiteConfig.paths.references, lawSiteConfig.paths.publications,
    lawSiteConfig.paths.constitution, lawSiteConfig.paths.development, lawSiteConfig.paths.help,
  ];
  const dynamicPaths = [
    ...norms.flatMap((norm) => [
      getNormUrl(norm.meta.slug),
      getNormHistoryUrl(norm.meta.slug),
      ...(norm.versions.length > 1 ? [getNormCompareUrl(norm.meta.slug)] : []),
      ...norm.versions.filter((version) => classifyNormVersion(norm, version) !== 'current').map((version) => getNormVersionUrl(norm.meta.slug, version.versionId)),
    ]),
    ...publications.map((publication) => getPublicationUrl(publication.slug)),
    ...getSubjectGroups(norms).map((group) => getSubjectUrl(group.name)),
  ];
  const lastmodByPath = new Map<string, string>();
  for (const publication of publications) lastmodByPath.set(getPublicationUrl(publication.slug), publication.date);
  for (const norm of norms) {
    const lastmod = [...norm.versions.map((version) => version.validFrom), ...norm.history.entries.map((entry) => entry.date)].sort().at(-1);
    if (!lastmod) continue;
    lastmodByPath.set(getNormUrl(norm.meta.slug), lastmod);
    lastmodByPath.set(getNormHistoryUrl(norm.meta.slug), lastmod);
    if (norm.versions.length > 1) lastmodByPath.set(getNormCompareUrl(norm.meta.slug), lastmod);
    for (const version of norm.versions.filter((entry) => classifyNormVersion(norm, entry) !== 'current')) {
      lastmodByPath.set(getNormVersionUrl(norm.meta.slug, version.versionId), version.validFrom);
    }
  }

  const paths = [...new Set([...staticPaths, ...dynamicPaths])];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => {
      const lastmod = lastmodByPath.get(path);
      return `  <url><loc>${escapeXml(new URL(path, baseUrl).toString())}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
    }),
    '</urlset>',
  ].join('\n');
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=21600' },
  });
};
