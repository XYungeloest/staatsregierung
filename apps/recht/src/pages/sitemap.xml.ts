import type { APIRoute } from 'astro';
import { lawSiteConfig } from '@ostrecht/shared/config/site.ts';
import {
  getNormCompareUrl,
  getNormHistoryUrl,
  getNormUrl,
  getNormVersionUrl,
  getPublicationUrl,
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
  const store = await getNormStore(locals);
  // Schmale Zeilen: Übersichten (Slug, Fassungszahl, letzte Änderung), Fassungsübersicht
  // (Slug, Fassung, Beginn, Einordnung), Verkündungen und Sachgebiete – keine Normkörper.
  const [norms, versions, publications, subjects] = await Promise.all([
    store.listNormSummaries(), store.listVersionSummaries(), store.listPublications(), store.listSubjectSummaries(),
  ]);
  const versionsBySlug = new Map<string, typeof versions>();
  for (const version of versions) {
    const list = versionsBySlug.get(version.slug) ?? [];
    list.push(version);
    versionsBySlug.set(version.slug, list);
  }
  const staticPaths = [
    lawSiteConfig.paths.home, lawSiteConfig.paths.index, lawSiteConfig.paths.subjects,
    lawSiteConfig.paths.funding, lawSiteConfig.paths.references, lawSiteConfig.paths.publications,
    lawSiteConfig.paths.constitution, lawSiteConfig.paths.development, lawSiteConfig.paths.help,
  ];
  const dynamicPaths = [
    ...norms.flatMap((norm) => [
      getNormUrl(norm.slug),
      getNormHistoryUrl(norm.slug),
      ...(norm.versionCount > 1 ? [getNormCompareUrl(norm.slug)] : []),
      ...(versionsBySlug.get(norm.slug) ?? []).filter((version) => version.temporalKind !== 'current').map((version) => getNormVersionUrl(norm.slug, version.versionId)),
    ]),
    ...publications.map((publication) => getPublicationUrl(publication.slug)),
    ...subjects.map((subject) => getSubjectUrl(subject.name)),
  ];
  const lastmodByPath = new Map<string, string>();
  for (const publication of publications) lastmodByPath.set(getPublicationUrl(publication.slug), publication.date);
  for (const norm of norms) {
    // lastmod meint die zuletzt geänderte Darstellung, nicht die Rechtsänderung: ein reiner
    // Hinweis erscheint auf der Norm- und Historienseite und zählt deshalb mit.
    const lastmod = norm.lastActivityDate ?? norm.lastChangeDate;
    if (!lastmod) continue;
    lastmodByPath.set(getNormUrl(norm.slug), lastmod);
    lastmodByPath.set(getNormHistoryUrl(norm.slug), lastmod);
    if (norm.versionCount > 1) lastmodByPath.set(getNormCompareUrl(norm.slug), lastmod);
    for (const version of (versionsBySlug.get(norm.slug) ?? []).filter((entry) => entry.temporalKind !== 'current')) {
      lastmodByPath.set(getNormVersionUrl(norm.slug, version.versionId), version.validFrom);
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
