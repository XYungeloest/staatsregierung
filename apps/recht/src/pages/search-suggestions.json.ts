import type { APIRoute } from 'astro';

import { buildSearchSuggestions } from '@ostrecht/recht-search/search.ts';

import { getNormStore } from '../lib/runtime/context.ts';

// Autovervollständigung aus der D1-Projektion (Bezeichnungen der geltenden Fassungen).
export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const records = await getNormStore(locals).listNorms();
  return new Response(JSON.stringify({
    generatedAt: new Date().toISOString(),
    suggestions: buildSearchSuggestions(records),
  }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=3600',
    },
  });
};
