import { loadAllNorms } from '@ostrecht/shared/lib/norms/loader.ts';
import { loadAllVerkuendungen } from '@ostrecht/shared/lib/norms/publications.ts';
import { loadPressReleases, loadTopics } from '@ostrecht/shared/lib/portal/content.ts';
import { getPressReleaseUrl, getTopicUrl } from '@ostrecht/shared/lib/portal/routes.ts';
import { buildSearchDocument } from '@ostrecht/recht-search/search.ts';

import { createD1NormStore, createFileNormStore, type NormStore } from './store.ts';

let fileStore: NormStore | null = null;

/**
 * Liefert den Datenzugriff für eine Anfrage. Im Cloudflare-Worker ist das die
 * D1-Projektion (`ostrecht_recht`); ohne Binding – lokale Entwicklung ohne
 * Wrangler-Proxy, Prerendering, Tests – die Dateivariante über `content/`.
 */
export function getNormStore(locals: App.Locals | undefined): NormStore {
  const db = locals?.runtime?.env?.ostrecht_recht;
  if (db) return createD1NormStore(db);
  fileStore ??= createFileNormStore({
    loadAllNorms,
    loadAllVerkuendungen,
    loadTopics,
    loadPressReleases,
    topicUrl: getTopicUrl,
    pressReleaseUrl: getPressReleaseUrl,
    buildSearchDocument,
  });
  return fileStore;
}

export function notFound(message = 'Nicht gefunden'): Response {
  return new Response(message, { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
