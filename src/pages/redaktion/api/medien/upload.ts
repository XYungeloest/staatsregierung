import type { APIRoute } from 'astro';
import { getDatabase, getMediaBucket } from '../../../../lib/dynamic/env.ts';
import {
  createEditorialRedirect,
  formatEditorialActionError,
  requireEditorialWriteAccess,
  withEditorialMessage,
} from '../../../../lib/editorial/api.ts';
import { getEditorialAuthor } from '../../../../lib/editorial/access.ts';
import { buildEditorialMediaKey, inferMediaTitle } from '../../../../lib/editorial/media.ts';
import { saveMediaAsset } from '../../../../lib/editorial/repository.ts';
import { withBase } from '../../../../lib/portal/routes.ts';

export const prerender = false;

function getRedirectTarget(formData: FormData): string {
  const returnTo = String(formData.get('returnTo') ?? '').trim();
  return returnTo || withBase('/redaktion/medien/');
}

function redirectToMedia(formData: FormData, key: 'message' | 'error', message: string): Response {
  return createEditorialRedirect(withEditorialMessage(getRedirectTarget(formData), key, message));
}

export const POST: APIRoute = async ({ request, url }) => {
  const formData = await request.formData();
  const file = formData.get('file');
  const deniedResponse = requireEditorialWriteAccess(request, url, getRedirectTarget(formData));

  if (deniedResponse) {
    return deniedResponse;
  }

  if (!(file instanceof File) || file.size === 0) {
    return redirectToMedia(formData, 'error', 'Bitte eine Datei auswählen.');
  }

  try {
    const key = buildEditorialMediaKey(file.name);
    const title = String(formData.get('title') ?? '').trim() || inferMediaTitle(file.name);
    const altText = String(formData.get('altText') ?? '').trim();
    const credit = String(formData.get('credit') ?? '').trim() || undefined;

    if (!altText) {
      return redirectToMedia(formData, 'error', 'Alt-Text ist erforderlich.');
    }

    await getMediaBucket().put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
    });

    await saveMediaAsset(getDatabase(), {
      key,
      title,
      altText,
      credit,
      mimeType: file.type || 'application/octet-stream',
      byteSize: file.size,
      filename: file.name,
      author: getEditorialAuthor(request),
    });

    return redirectToMedia(formData, 'message', `Medium gespeichert: ${key}`);
  } catch (error) {
    const message = formatEditorialActionError(error, 'Upload fehlgeschlagen.', url);
    return redirectToMedia(formData, 'error', message);
  }
};
