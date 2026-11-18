import type { APIRoute } from 'astro';

import { siteUrls } from '@ostrecht/shared/config/site-routing.ts';
import { enactedNormReferences, presentEnactedArticles } from '@ostrecht/shared/lib/norms/enacted-articles.ts';
import { getNormUrl } from '@ostrecht/shared/lib/norms/routes.ts';
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

/**
 * Kennung der Darstellung des Vorschriftentextes in der PDF, Teil von Zwischenspeicherschlüssel und
 * ETag. Bei jeder Änderung der Darstellung ohne geänderten Datenstand erhöhen, damit nach dem
 * Deployment keine PDF in der alten Form ausgeliefert wird.
 */
const PDF_PRESENTATION = '2';

/** Absolute Adresse des Stammeintrags; die PDF kennt keine Verweise. */
const absoluteNormUrl = (slug: string): string => new URL(getNormUrl(slug), `${siteUrls.law}/`).toString();

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
  const cacheKey = new Request(`${url.origin}${url.pathname}?bestand=${encodeURIComponent(fingerprint)}&darstellung=${PDF_PRESENTATION}`);
  const cached = await cache?.match(cacheKey).catch(() => undefined);
  // Antworten aus dem Zwischenspeicher tragen unveränderliche Kopfzeilen; die Middleware ergänzt
  // die Buildkennung, deshalb wird die Antwort neu aufgebaut.
  if (cached) return new Response(cached.body, { status: cached.status, headers: new Headers(cached.headers) });

  const norm = await store.getNorm(slug, [versionId]);
  const version = norm?.versions.find((entry) => entry.versionId === versionId);
  if (!norm || !version) return notFound();
  const [fullCitation, derived] = await Promise.all([store.getFullCitation(slug, versionId), store.getDerived(slug)]);
  // Wie die Fassungsseite: eingeführte Gesetze erscheinen mit ihrer Bezeichnung statt als Zitat,
  // darunter die Adresse des Stammeintrags.
  const body = presentEnactedArticles(version.body, enactedNormReferences(derived?.relations), { hrefFor: absoluteNormUrl, addressLine: true }).body;

  const bytes = await renderNormVersionPdf({
    norm,
    version: body === version.body ? version : { ...version, body },
    ...(fullCitation ? { fullCitation } : {}),
    temporalKind: classifyNormVersion(norm, version),
  });

  const response = new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${normVersionPdfFilename(slug, versionId)}"`,
      'Cache-Control': 'public, max-age=300, s-maxage=86400',
      ETag: `"${fingerprint.slice(0, 16)}-${versionId}-d${PDF_PRESENTATION}"`,
      'X-Robots-Tag': 'noindex',
    },
  });

  if (cache) await cache.put(cacheKey, response.clone()).catch(() => undefined);
  return response;
};
