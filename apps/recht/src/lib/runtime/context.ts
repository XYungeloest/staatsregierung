import type { D1Database } from './d1-types.ts';
import { createD1NormStore, createFileNormStore, type NormStore } from './store.ts';

export interface OstRechtEnv {
  APP_ENV?: string;
  ostrecht_recht?: D1Database;
}

let fileStorePromise: Promise<NormStore> | null = null;
let workerEnvPromise: Promise<OstRechtEnv | null> | null = null;

/**
 * Bindings des Cloudflare-Workers. Seit Astro 6 werden sie über das Modul
 * `cloudflare:workers` bereitgestellt; außerhalb des Workers (Prerendering im
 * Node-Build, Tests, lokale Entwicklung ohne Wrangler) existiert das Modul nicht.
 */
async function resolveWorkerEnv(): Promise<OstRechtEnv | null> {
  workerEnvPromise ??= (async () => {
    try {
      const module = await import(/* @vite-ignore */ 'cloudflare:workers') as { env?: OstRechtEnv };
      return module.env ?? null;
    } catch {
      return null;
    }
  })();
  return workerEnvPromise;
}

/**
 * Dateivariante über `content/`. Die Loader lesen mit `node:fs`; sie werden
 * deshalb erst hier dynamisch importiert, damit das Worker-Bundle die
 * Node-Module nie auflösen muss (workerd kennt `node:fs/promises` nicht).
 */
function createFileStore(): Promise<NormStore> {
  fileStorePromise ??= (async () => {
    const [
      { loadAllNorms },
      { loadAllVerkuendungen },
      { loadKeywordRegister },
      { loadPressReleases, loadTopics },
      { getPressReleaseUrl, getTopicUrl },
      { buildSearchDocument },
    ] = await Promise.all([
      import('@ostrecht/shared/lib/norms/loader.ts'),
      import('@ostrecht/shared/lib/norms/publications.ts'),
      import('@ostrecht/shared/lib/norms/register.ts'),
      import('@ostrecht/shared/lib/portal/content.ts'),
      import('@ostrecht/shared/lib/portal/routes.ts'),
      import('@ostrecht/recht-search/search.ts'),
    ]);
    return createFileNormStore({
      loadAllNorms,
      loadAllVerkuendungen,
      loadRegister: loadKeywordRegister,
      loadTopics,
      loadPressReleases,
      topicUrl: getTopicUrl,
      pressReleaseUrl: getPressReleaseUrl,
      buildSearchDocument,
    });
  })();
  return fileStorePromise;
}

/**
 * Liefert den Datenzugriff für eine Anfrage. Im Cloudflare-Worker ist das die
 * D1-Projektion (`ostrecht_recht`); ohne Binding – lokale Entwicklung ohne
 * Wrangler-Proxy, Prerendering, Tests – die Dateivariante über `content/`.
 */
export async function getNormStore(_locals?: App.Locals): Promise<NormStore> {
  const env = await resolveWorkerEnv();
  const db = env?.ostrecht_recht;
  if (db) return createD1NormStore(db);
  if (env) {
    // Im Worker ohne D1-Binding gibt es keinen sinnvollen Rückfall: die
    // Dateivariante hätte dort keinen Zugriff auf content/.
    throw new Error('Das D1-Binding ostrecht_recht fehlt in der Worker-Konfiguration.');
  }
  return createFileStore();
}

export function notFound(message = 'Nicht gefunden'): Response {
  return new Response(message, { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

/** Alle drei Metadaten aus demselben SQLite-Lesestand. Ein Fixture oder laufender Sync ist kein Vollbestandsnachweis. */
export async function publishedProjectionFingerprint(): Promise<string | null> {
  const db = (await resolveWorkerEnv())?.ostrecht_recht;
  if (!db) return null;
  const row = await db.prepare(`
    SELECT value FROM law_runtime_meta WHERE key = 'projection_fingerprint'
    AND EXISTS (SELECT 1 FROM law_runtime_meta WHERE key = 'projection_scope' AND value = 'full')
    AND EXISTS (SELECT 1 FROM law_runtime_meta WHERE key = 'sync_state' AND value = 'complete')
  `).first<{ value: string }>();
  return row && /^[a-f0-9]{64}$/u.test(row.value) ? row.value : null;
}
