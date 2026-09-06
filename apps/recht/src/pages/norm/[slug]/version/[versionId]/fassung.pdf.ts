import type { APIRoute } from 'astro';

import { classifyNormVersion } from '@ostrecht/shared/lib/norms/versions.ts';

import { normVersionPdfFilename, renderNormVersionPdf } from '../../../../../lib/pdf/norm-pdf.ts';
import { getNormStore, notFound } from '../../../../../lib/runtime/context.ts';

/**
 * Portalfassung einer gespeicherten Fassung als PDF. Das Dokument wird bei der Anfrage aus
 * demselben Vorschriftentext erzeugt, den die Fassungsseite zeigt, und am Rand zwischengespeichert;
 * der Schlüssel enthält die Kennung des Datenstandes, damit geänderte Bezeichnungen oder
 * Vollzitate nie veraltet ausgeliefert werden. Fassungskörper selbst sind unveränderlich.
 */
export const prerender = false;

interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

/** Der Zwischenspeicher steht nur im Worker zur Verfügung; ohne ihn wird jedes Mal erzeugt. */
function edgeCache(): EdgeCache | null {
  return (globalThis as { caches?: { default?: EdgeCache } }).caches?.default ?? null;
}

export const GET: APIRoute = async ({ params, locals, url }) => {
  const { slug = '', versionId = '' } = params;
  if (!slug || !versionId) return notFound();

  const store = await getNormStore(locals);
  const fingerprint = await store.getProjectionFingerprint();
  const cache = edgeCache();
  const cacheKey = new Request(`${url.origin}${url.pathname}?bestand=${encodeURIComponent(fingerprint)}`);
  const cached = await cache?.match(cacheKey).catch(() => undefined);
  // Antworten aus dem Zwischenspeicher tragen unveränderliche Kopfzeilen; die Middleware ergänzt
  // die Buildkennung, deshalb wird die Antwort neu aufgebaut.
  if (cached) return new Response(cached.body, { status: cached.status, headers: new Headers(cached.headers) });

  const norm = await store.getNorm(slug, [versionId]);
  const version = norm?.versions.find((entry) => entry.versionId === versionId);
  if (!norm || !version) return notFound();
  const fullCitation = await store.getFullCitation(slug, versionId);

  const bytes = await renderNormVersionPdf({
    norm,
    version,
    ...(fullCitation ? { fullCitation } : {}),
    temporalKind: classifyNormVersion(norm, version),
  });

  const response = new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${normVersionPdfFilename(slug, versionId)}"`,
      'Cache-Control': 'public, max-age=300, s-maxage=86400',
      ETag: `"${fingerprint.slice(0, 16)}-${versionId}"`,
      'X-Robots-Tag': 'noindex',
    },
  });

  if (cache) await cache.put(cacheKey, response.clone()).catch(() => undefined);
  return response;
};
