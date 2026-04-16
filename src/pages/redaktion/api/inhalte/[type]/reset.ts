import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../../lib/dynamic/env.ts';
import { createEditorialRedirect, getEditorialEditorUrl, withEditorialMessage } from '../../../../../lib/editorial/api.ts';
import { getEditorialAuthor } from '../../../../../lib/editorial/access.ts';
import { getEditorialEntryById, saveEditorialEntry, writePublishLog } from '../../../../../lib/editorial/repository.ts';
import { entryToWriteInput } from '../../../../../lib/editorial/drafts.ts';
import { getEditorialTypeDefinition, isEditorialEntryType } from '../../../../../lib/editorial/studio.ts';
import { withBase } from '../../../../../lib/portal/routes.ts';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  if (!isEditorialEntryType(params.type)) {
    return new Response('Unbekannter Inhaltstyp', { status: 404 });
  }

  const type = params.type;
  const definition = getEditorialTypeDefinition(type);
  const formData = await request.formData();
  const fallbackUrl = getEditorialEditorUrl(type, formData);
  const entryId = String(formData.get('entryId') ?? '').trim();

  if (!entryId) {
    return createEditorialRedirect(withEditorialMessage(fallbackUrl, 'error', 'Kein Redaktionsstand angegeben.'));
  }

  try {
    const database = getDatabase();
    const entry = await getEditorialEntryById(database, entryId);

    if (!entry || entry.type !== type) {
      return new Response('Entwurf nicht gefunden', { status: 404 });
    }

    const writeInput = {
      ...entryToWriteInput(entry, 'draft_save'),
      summary: 'Live-Override deaktiviert; statischer Fallback wieder aktiv.',
      author: getEditorialAuthor(request, entry.author),
      liveBehavior: 'reset' as const,
      status: 'draft' as const,
      publishMode: definition.publishMode,
    };

    const result = await saveEditorialEntry(database, writeInput);
    await writePublishLog(database, {
      entryId: result.entryId,
      versionId: result.versionId,
      targetType: type,
      targetIdentifier: entry.slug,
      mode: definition.publishMode,
      status: 'prepared',
      detail: 'Live-Override deaktiviert; Seite fällt auf statischen Inhalt zurück.',
    });

    return createEditorialRedirect(
      withEditorialMessage(
        withBase(`/redaktion/inhalte/${type}/${result.entryId}/`),
        'message',
        'Override deaktiviert. Die öffentliche Seite nutzt wieder den statischen Fallback.',
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Override konnte nicht deaktiviert werden.';
    return createEditorialRedirect(withEditorialMessage(fallbackUrl, 'error', message));
  }
};
