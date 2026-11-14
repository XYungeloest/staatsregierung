import { imageSize } from 'image-size';
import { MAX_SKETCH_BYTES, MAX_SKETCH_PIXELS } from './images.ts';
import type { CampaignEnv, PrivateSketches } from './server.ts';

export const REVIEW_PREFIX = '/fresswuerfel-sichtung/';
export const REVIEW_PAGE_SIZE = 24;
export const reviewHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
export function hasReviewAccess(token: string | undefined, env: CampaignEnv): boolean {
  if (env.APP_ENV === 'preview') return false;
  const expected = env.FRESSWUERFEL_REVIEW_TOKEN;
  if (!expected || !token || !/^[A-Za-z0-9_-]{43,128}$/.test(token) || token.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < token.length; i++) difference |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
export function reviewUnavailable(status = 404): Response {
  return new Response(status === 404 ? 'Seite nicht gefunden.' : 'Die Übersicht ist vorübergehend nicht verfügbar.', { status, headers: reviewHeaders });
}
export interface ReviewEntry { number: string; name: string; description: string; created_at: number; has_image: number }
export async function loadReview(env: CampaignEnv, url: URL, now = Date.now()) {
  if (!env.FRESSWUERFEL_DB) throw new Error('Sichtungsspeicher fehlt');
  const sort = url.searchParams.get('sort') ?? 'neu';
  const order = sort === 'alt' ? 'created_at ASC, number ASC' : sort === 'name' ? 'name COLLATE NOCASE ASC, number ASC' : 'created_at DESC, number ASC';
  const pageParameter = url.searchParams.get('seite') ?? '1';
  const requestedPage = /^\d{1,6}$/.test(pageParameter) ? Math.max(1, Number(pageParameter)) : 1;
  const counts = await env.FRESSWUERFEL_DB.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(sketch_key IS NOT NULL), 0) AS with_images FROM submissions WHERE expires_at > ?').bind(now).first<{ total: number; with_images: number }>();
  const total = counts?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / REVIEW_PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  // Explizite Spaltenauswahl: Kontaktadressen, Dateischlüssel und Anfragebezeichner verlassen den Server nicht.
  const rows = await env.FRESSWUERFEL_DB.prepare(`SELECT number, name, description, created_at, sketch_key IS NOT NULL AS has_image FROM submissions WHERE expires_at > ? ORDER BY ${order} LIMIT ? OFFSET ?`).bind(now, REVIEW_PAGE_SIZE, (page - 1) * REVIEW_PAGE_SIZE).all<ReviewEntry>();
  return { entries: rows.results, total, withImages: counts?.with_images ?? 0, page, pages, sort: ['alt', 'name'].includes(sort) ? sort : 'neu' };
}
export const reviewImageKey = (number: string) => `review/${number}.webp`;

export async function createReviewImage(bytes: Uint8Array): Promise<Uint8Array> {
  if (!bytes.length || bytes.length > MAX_SKETCH_BYTES) throw new Error('Ungültige Bildgröße');
  const info = imageSize(bytes);
  if (!['png', 'jpg', 'webp'].includes(info.type ?? '') || !info.width || !info.height || info.width > 4096 || info.height > 4096 || info.width * info.height > MAX_SKETCH_PIXELS) throw new Error('Ungültige Bildmaße');
  const { PhotonImage, SamplingFilter, resize, rotate, fliph, flipv } = await import('@cf-wasm/photon');
  const original = PhotonImage.new_from_byteslice(bytes);
  let oriented = original;
  let output = original;
  try {
    if (original.get_width() !== info.width || original.get_height() !== info.height) throw new Error('Ungültige Bildmaße');
    // EXIF-Ausrichtung anwenden; neu codierte Pixel enthalten anschließend keine ursprünglichen Metadaten.
    switch (info.orientation) {
      case 2: fliph(original); break;
      case 3: oriented = rotate(original, 180); break;
      case 4: flipv(original); break;
      case 5: oriented = rotate(original, 90); fliph(oriented); break;
      case 6: oriented = rotate(original, 90); break;
      case 7: oriented = rotate(original, 90); flipv(oriented); break;
      case 8: oriented = rotate(original, 270); break;
    }
    const scale = Math.min(1, 1400 / Math.max(oriented.get_width(), oriented.get_height()));
    output = scale < 1 ? resize(oriented, Math.max(1, Math.round(oriented.get_width() * scale)), Math.max(1, Math.round(oriented.get_height() * scale)), SamplingFilter.Lanczos3) : oriented;
    return output.get_bytes_webp();
  } finally {
    if (output !== original && output !== oriented) output.free();
    if (oriented !== original) oriented.free();
    original.free();
  }
}
export async function getReviewImage(request: Request, token: string | undefined, number: string | undefined, env: CampaignEnv, now = Date.now()): Promise<Response> {
  if (!hasReviewAccess(token, env) || !number || !/^FW-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(number)) return reviewUnavailable();
  const db = env.FRESSWUERFEL_DB;
  const bucket = env.FRESSWUERFEL_SKETCHES as PrivateSketches | undefined;
  if (!db || !bucket) return reviewUnavailable(503);
  try {
    const row = await db.prepare('SELECT sketch_key FROM submissions WHERE number = ? AND expires_at > ? AND sketch_key IS NOT NULL').bind(number, now).first<{ sketch_key: string }>();
    if (!row) return reviewUnavailable();
    const headers = { ...reviewHeaders, 'Content-Type': 'image/webp', 'Content-Disposition': `inline; filename="${number}.webp"` };
    const cached = await bucket.get(reviewImageKey(number));
    if (cached) return new Response(request.method === 'HEAD' ? null : cached.body, { headers });
    const original = await bucket.get(row.sketch_key);
    if (!original) return reviewUnavailable();
    const preview = await createReviewImage(new Uint8Array(await original.arrayBuffer()));
    await bucket.put(reviewImageKey(number), preview, { httpMetadata: { contentType: 'image/webp' } });
    return new Response(request.method === 'HEAD' ? null : new Uint8Array(preview).buffer, { headers });
  } catch { return reviewUnavailable(503); }
}
