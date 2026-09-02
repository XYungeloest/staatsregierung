import { buildSearchSuggestionPayload } from '@ostrecht/recht-search/search.ts';

export const prerender = true;

export async function GET() {
  const payload = await buildSearchSuggestionPayload();

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
