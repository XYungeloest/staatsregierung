import type { APIRoute } from 'astro';
import { getMediaBucket } from '../../lib/dynamic/env.ts';
import { decodeMediaKey } from '../../lib/dynamic/media.ts';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const key = decodeMediaKey(params.key);

  if (!key) {
    return new Response('Media object not found', { status: 404 });
  }

  const object = await getMediaBucket().get(key, {
    onlyIf: request.headers,
    range: request.headers,
  });

  if (object === null) {
    return new Response('Media object not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'public, max-age=3600');
  }

  return new Response('body' in object ? object.body : undefined, {
    status: 'body' in object ? 200 : 412,
    headers,
  });
};

export const HEAD = GET;
