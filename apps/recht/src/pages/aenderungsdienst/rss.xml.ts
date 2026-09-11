import type { APIRoute } from 'astro';
import { lawSiteConfig } from '@ostrecht/shared/config/site.ts';

import { buildChangeFeed, loadChangeService } from '../../lib/change-service.ts';
import { getNormStore } from '../../lib/runtime/context.ts';

// RSS des Änderungsdiensts: dieselben drei Spalten wie die Startseite, aus der D1-Projektion.
export const prerender = false;

export const GET: APIRoute = async ({ site, locals }) => {
  const baseUrl = site ?? new URL(lawSiteConfig.seo.siteUrl);
  const store = await getNormStore(locals);
  const columns = await loadChangeService(store);
  return new Response(buildChangeFeed(columns, { baseUrl }), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
};
