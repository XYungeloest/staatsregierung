import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const baseUrl = site ?? new URL('https://freistaat-ostdeutschland.de');
  const body = [`User-agent: *`, `Allow: /`, `Sitemap: ${new URL('/sitemap.xml', baseUrl).toString()}`].join(
    '\n',
  );

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
