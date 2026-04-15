import type { APIRoute } from 'astro';
import { getDatabase } from '../../lib/dynamic/env.ts';
import { listProjectStatuses } from '../../lib/dynamic/repository.ts';

export const prerender = false;

export const GET: APIRoute = async () => {
  const items = await listProjectStatuses(getDatabase());

  return new Response(
    JSON.stringify({
      count: items.length,
      items,
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
};
