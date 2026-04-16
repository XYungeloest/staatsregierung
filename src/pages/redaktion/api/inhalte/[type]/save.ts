import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../../lib/dynamic/env.ts';
import { createEditorialRedirect, getEditorialEditorUrl, withEditorialMessage } from '../../../../../lib/editorial/api.ts';
import { getEditorialAuthor } from '../../../../../lib/editorial/access.ts';
import { parseEditorialFormData } from '../../../../../lib/editorial/forms.ts';
import { saveEditorialEntry } from '../../../../../lib/editorial/repository.ts';
import { getEditorialTypeDefinition, isEditorialEntryType } from '../../../../../lib/editorial/studio.ts';
import { buildContentPayload } from '../../../../../lib/editorial/transformers.ts';
import { withBase } from '../../../../../lib/portal/routes.ts';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  if (!isEditorialEntryType(params.type)) {
    return new Response('Unbekannter Inhaltstyp', { status: 404 });
  }

  const type = params.type;
  const formData = await request.formData();
  const fallbackUrl = getEditorialEditorUrl(type, formData);

  try {
    const parsed = parseEditorialFormData(formData, type);
    const definition = getEditorialTypeDefinition(type);
    const author = getEditorialAuthor(request, parsed.author);
    const writeInput = {
      ...parsed,
      author,
      status: 'draft' as const,
      publishMode: definition.publishMode,
      action: 'draft_save' as const,
      liveBehavior: 'preserve' as const,
    };

    buildContentPayload(writeInput);
    const result = await saveEditorialEntry(getDatabase(), writeInput);

    return createEditorialRedirect(
      withEditorialMessage(
        withBase(`/redaktion/inhalte/${type}/${result.entryId}/`),
        'message',
        'Entwurf gespeichert.',
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Entwurf konnte nicht gespeichert werden.';
    return createEditorialRedirect(withEditorialMessage(fallbackUrl, 'error', message));
  }
};
