import { buildSearchSuggestionPayload } from '@ostrecht/shared/lib/norms/search.ts';

export const prerender = true;

export async function GET() {
  const payload = await buildSearchSuggestionPayload();

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
