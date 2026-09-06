import type { APIRoute } from 'astro';
import { buildLawSearchPayload } from '../lib/search-index.ts';

/**
 * Schmaler Rechtsindex für die Portalsuche. Er wird erst geladen, wenn der Bereichsfilter das
 * Recht einschließt; die Portalinhalte stehen in `/search-index.json`.
 */
export const GET: APIRoute = async () => {
  const payload = await buildLawSearchPayload();

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
