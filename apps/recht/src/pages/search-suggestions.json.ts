import type { APIRoute } from 'astro';

import { getNormStore } from '../lib/runtime/context.ts';

// Autovervollständigung aus der D1-Projektion (Bezeichnungen der geltenden Fassungen).
export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const store = await getNormStore(locals);
  // Bezeichnungen und Aliasse der geltenden Fassungen aus law_norms; keine Fassungs-JSONs.
  const suggestions = await store.listSearchSuggestions();
  return new Response(JSON.stringify({
    generatedAt: new Date().toISOString(),
    suggestions,
  }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=3600',
    },
  });
};
