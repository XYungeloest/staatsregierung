import type { APIRoute } from 'astro';
import { lawSiteConfig } from '../../config/site.ts';

export const GET: APIRoute = ({ site }) => {
  const baseUrl = site ?? new URL(lawSiteConfig.seo.siteUrl);
  const body = ['User-agent: *', 'Allow: /', `Sitemap: ${new URL('/sitemap.xml', baseUrl).toString()}`].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
