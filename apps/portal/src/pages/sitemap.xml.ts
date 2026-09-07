import type { APIRoute } from 'astro';
import { siteUrls } from '@ostrecht/shared/config/site.ts';
import { buildPortalRouteInventory } from '../lib/route-inventory.ts';

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

/**
 * Die Sitemap führt genau die Seiten des Portalinventars (`lib/route-inventory.ts`). Dieselbe
 * Quelle trägt die Serviceübersicht und den Suchindex; eine zweite Seitenliste gibt es nicht.
 */
export const GET: APIRoute = async ({ site }) => {
  const baseUrl = site ?? new URL(siteUrls.portal);
  const routes = (await buildPortalRouteInventory()).filter((route) => route.sitemap);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...routes.map((route) => {
      const absoluteUrl = new URL(route.path, baseUrl).toString();
      return `  <url><loc>${escapeXml(absoluteUrl)}</loc>${route.lastmod ? `<lastmod>${route.lastmod}</lastmod>` : ''}</url>`;
    }),
    '</urlset>',
  ].join('\n');

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
