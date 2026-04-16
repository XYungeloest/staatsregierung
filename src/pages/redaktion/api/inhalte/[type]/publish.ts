import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../../lib/dynamic/env.ts';
import {
  createEditorialRedirect,
  formatEditorialActionError,
  getEditorialEditorUrl,
  requireEditorialWriteAccess,
  withEditorialMessage,
} from '../../../../../lib/editorial/api.ts';
import { getEditorialAuthor } from '../../../../../lib/editorial/access.ts';
import { parseEditorialFormData } from '../../../../../lib/editorial/forms.ts';
import { saveEditorialEntry, writePublishLog } from '../../../../../lib/editorial/repository.ts';
import { getEditorialTypeDefinition, isEditorialEntryType } from '../../../../../lib/editorial/studio.ts';
import { buildContentPayload, publishDirectContent } from '../../../../../lib/editorial/transformers.ts';
import { withBase } from '../../../../../lib/portal/routes.ts';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, url }) => {
  if (!isEditorialEntryType(params.type)) {
    return new Response('Unbekannter Inhaltstyp', { status: 404 });
  }

  const type = params.type;
  const definition = getEditorialTypeDefinition(type);

  if (definition.publishMode !== 'direct' && definition.publishMode !== 'override') {
    return new Response('Veröffentlichung für diesen Typ nicht erlaubt', { status: 405 });
  }

  const formData = await request.formData();
  const fallbackUrl = getEditorialEditorUrl(type, formData);
  const deniedResponse = requireEditorialWriteAccess(request, url, fallbackUrl);

  if (deniedResponse) {
    return deniedResponse;
  }

  try {
    const parsed = parseEditorialFormData(formData, type);
    const author = getEditorialAuthor(request, parsed.author);
    const previewInput = {
      ...parsed,
      author,
      status: 'published' as const,
      publishMode: definition.publishMode,
      action: 'publish' as const,
      liveBehavior: 'publish' as const,
    };

    const publishedPayload = buildContentPayload(previewInput);
    const writeInput = {
      ...previewInput,
      publishedPayload,
    };

    if (definition.publishMode === 'direct') {
      await publishDirectContent(getDatabase(), writeInput);
    }
    const result = await saveEditorialEntry(getDatabase(), writeInput);
    await writePublishLog(getDatabase(), {
      entryId: result.entryId,
      versionId: result.versionId,
      targetType: type,
      targetIdentifier: parsed.slug,
      mode: definition.publishMode,
      status: 'success',
      detail:
        definition.publishMode === 'direct'
          ? 'Direkt in D1 veröffentlicht.'
          : 'Live-Override für die öffentliche Seite aktiviert.',
      payload: publishedPayload,
    });

    return createEditorialRedirect(
      withEditorialMessage(
        withBase(`/redaktion/inhalte/${type}/${result.entryId}/`),
        'message',
        definition.publishMode === 'direct'
          ? 'Eintrag direkt veröffentlicht.'
          : 'Live-Override veröffentlicht.',
      ),
    );
  } catch (error) {
    const message = formatEditorialActionError(error, 'Veröffentlichung fehlgeschlagen.', url);
    return createEditorialRedirect(withEditorialMessage(fallbackUrl, 'error', message));
  }
};
