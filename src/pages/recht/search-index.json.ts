import { buildSearchIndexPayload } from '../../lib/norms/search.ts';

export const prerender = true;

export async function GET() {
  const payload = await buildSearchIndexPayload();

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
