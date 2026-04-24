export const prerender = false;

import type { APIRoute } from 'astro';
import { siteConfig } from '../../config/site.ts';
import { getDatabase } from '../../lib/dynamic/env.ts';
import { listPressReleases } from '../../lib/dynamic/repository.ts';
import { getPressReleaseUrl, getPressUrl } from '../../lib/portal/index.ts';

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

function absoluteUrl(path: string, site: URL): string {
  return new URL(path, site).toString();
}

export const GET: APIRoute = async ({ site }) => {
  const baseUrl = site ?? new URL(siteConfig.seo.siteUrl);
  const releases = await listPressReleases(getDatabase());
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    `<title>${escapeXml('Pressemitteilungen der Staatsregierung')}</title>`,
    `<link>${escapeXml(absoluteUrl(getPressUrl(), baseUrl))}</link>`,
    `<description>${escapeXml('Aktuelle Pressemitteilungen der Staatsregierung des Ostdeutschen Freistaates.')}</description>`,
    ...releases.slice(0, 30).map((release) => {
      const link = absoluteUrl(getPressReleaseUrl(release.slug), baseUrl);
      return [
        '<item>',
        `<title>${escapeXml(release.title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid>${escapeXml(link)}</guid>`,
        `<pubDate>${new Date(`${release.date}T12:00:00Z`).toUTCString()}</pubDate>`,
        `<description>${escapeXml(release.teaser)}</description>`,
        '</item>',
      ].join('');
    }),
    '</channel>',
    '</rss>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
