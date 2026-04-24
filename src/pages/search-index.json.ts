import type { APIRoute } from 'astro';
import { buildPortalSearchPayload } from '../lib/portal/search.ts';

export const GET: APIRoute = async () => {
  const payload = await buildPortalSearchPayload();

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
