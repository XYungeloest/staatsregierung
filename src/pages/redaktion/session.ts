import type { APIRoute } from 'astro';
import { getRuntimeEnvironmentName } from '../../lib/dynamic/env.ts';
import { getEditorialAccessInfo, hasEditorialWriteAccess } from '../../lib/editorial/access.ts';
import {
  createClearedEditorialSessionCookie,
  createEditorialSessionCookie,
} from '../../lib/editorial/session.ts';
import { withBase } from '../../lib/portal/routes.ts';

export const prerender = false;

function getReturnTo(url: URL): string {
  const requested = url.searchParams.get('returnTo')?.trim();

  if (!requested || !requested.startsWith('/')) {
    return withBase('/redaktion/');
  }

  return requested;
}

function buildRedirectResponse(
  location: string,
  cookieHeader: string,
  key: 'message' | 'error',
  message: string,
): Response {
  const targetUrl = new URL(location, 'https://editor.local');
  targetUrl.searchParams.set(key, message);

  return new Response(null, {
    status: 303,
    headers: {
      Location: `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`,
      'Set-Cookie': cookieHeader,
    },
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  const returnTo = getReturnTo(url);
  const mode = url.searchParams.get('mode');

  if (mode === 'logout') {
    return buildRedirectResponse(
      returnTo,
      createClearedEditorialSessionCookie(url),
      'message',
      'Redaktionelle Sichtbarkeit auf öffentlichen Seiten beendet.',
    );
  }

  if (!hasEditorialWriteAccess(request, url)) {
    return buildRedirectResponse(
      returnTo,
      createClearedEditorialSessionCookie(url),
      'error',
      `Kein gültiger Cloudflare-Access-Zugriff erkannt. Öffnen Sie zuerst /redaktion/* in ${getRuntimeEnvironmentName(url)}.`,
    );
  }

  const accessInfo = getEditorialAccessInfo(request, url);

  try {
    const cookieHeader = await createEditorialSessionCookie(url, {
      email: accessInfo.email,
    });

    return buildRedirectResponse(
      returnTo,
      cookieHeader,
      'message',
      'Redaktionelle Sichtbarkeit für öffentliche Seiten aktiviert.',
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Editor-Sitzung konnte nicht eingerichtet werden.';

    return buildRedirectResponse(
      returnTo,
      createClearedEditorialSessionCookie(url),
      'error',
      message,
    );
  }
};
