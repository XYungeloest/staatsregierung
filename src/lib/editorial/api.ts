import { getRuntimeEnvironmentName } from '../dynamic/env.ts';
import { withBase } from '../portal/routes.ts';
import { hasEditorialWriteAccess } from './access.ts';
import type { EditorialEntryType } from './studio.ts';

function readOptionalString(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) ?? '').trim();
  return value || undefined;
}

export function getEditorialEditorUrl(type: EditorialEntryType, formData: FormData): string {
  const entryId = readOptionalString(formData, 'entryId');

  if (entryId) {
    return withBase(`/redaktion/inhalte/${type}/${entryId}/`);
  }

  const searchParams = new URLSearchParams();
  const sourceId = readOptionalString(formData, 'sourceId');
  const sourceOrigin = readOptionalString(formData, 'sourceOrigin');

  if (sourceId) {
    searchParams.set('source', sourceId);
  }

  if (sourceOrigin) {
    searchParams.set('origin', sourceOrigin);
  }

  const baseUrl = withBase(`/redaktion/inhalte/${type}/neu`);
  const query = searchParams.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}

export function withEditorialMessage(
  url: string,
  key: 'message' | 'error',
  message: string,
): string {
  const targetUrl = new URL(url, 'https://editor.local');
  targetUrl.searchParams.set(key, message);

  const search = targetUrl.searchParams.toString();
  return search ? `${targetUrl.pathname}?${search}` : targetUrl.pathname;
}

export function createEditorialRedirect(url: string, status = 303): Response {
  return new Response(null, {
    status,
    headers: {
      Location: url,
    },
  });
}

export function formatEditorialActionError(
  error: unknown,
  fallbackMessage: string,
  url?: URL,
): string {
  const runtime = getRuntimeEnvironmentName(url);
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (
    message.includes('Cloudflare-D1-Binding') ||
    message.includes('Cloudflare-R2-Binding')
  ) {
    return `${message} Bitte Wrangler-Bindings und die Zielumgebung (${runtime}) prüfen.`;
  }

  return message;
}

export function requireEditorialWriteAccess(
  request: Request,
  url: URL,
  redirectTo: string,
): Response | undefined {
  if (hasEditorialWriteAccess(request, url)) {
    return undefined;
  }

  return createEditorialRedirect(
    withEditorialMessage(
      redirectTo,
      'error',
      `Schreibzugriff blockiert. In ${getRuntimeEnvironmentName(url)} sind lokale Entwicklung oder ein aktueller Cloudflare-Access-Zugriff auf /redaktion/* erforderlich. Ein Editor-Cookie allein reicht nicht aus.`,
    ),
  );
}
