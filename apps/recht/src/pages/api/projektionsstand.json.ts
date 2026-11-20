import type { APIRoute } from 'astro';
import { publishedProjectionFingerprint } from '../../lib/runtime/context.ts';

export const prerender = false;
export const GET: APIRoute = async () => {
  const fingerprint = await publishedProjectionFingerprint();
  return Response.json({ fingerprint }, {
    status: fingerprint ? 200 : 503,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
};
