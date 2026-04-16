import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../../lib/dynamic/env.ts';
import { createEditorialRedirect, getEditorialEditorUrl, withEditorialMessage } from '../../../../../lib/editorial/api.ts';
import { getEditorialAuthor } from '../../../../../lib/editorial/access.ts';
import { parseEditorialFormData } from '../../../../../lib/editorial/forms.ts';
import { saveEditorialEntry, writePublishLog } from '../../../../../lib/editorial/repository.ts';
import { getEditorialTypeDefinition, isEditorialEntryType } from '../../../../../lib/editorial/studio.ts';
import { buildExportArtifact } from '../../../../../lib/editorial/transformers.ts';
import { withBase } from '../../../../../lib/portal/routes.ts';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  if (!isEditorialEntryType(params.type)) {
    return new Response('Unbekannter Inhaltstyp', { status: 404 });
  }

  const type = params.type;
  const definition = getEditorialTypeDefinition(type);

  if (definition.publishMode !== 'export') {
    return new Response('Exportmodus für diesen Typ nicht erlaubt', { status: 405 });
  }

  const formData = await request.formData();
  const fallbackUrl = getEditorialEditorUrl(type, formData);

  try {
    const parsed = parseEditorialFormData(formData, type);
    const author = getEditorialAuthor(request, parsed.author);
    const previewInput = {
      ...parsed,
      author,
      status: 'export_ready' as const,
      publishMode: definition.publishMode,
      action: 'export' as const,
    };

    const exportArtifact = buildExportArtifact(previewInput);
    const writeInput = {
      ...previewInput,
      publishedPayload: exportArtifact.payload,
    };

    const result = await saveEditorialEntry(getDatabase(), writeInput);
    await writePublishLog(getDatabase(), {
      entryId: result.entryId,
      versionId: result.versionId,
      targetType: type,
      targetIdentifier: exportArtifact.path,
      mode: definition.publishMode,
      status: 'prepared',
      detail: exportArtifact.path,
      payload: exportArtifact.payload,
    });

    return createEditorialRedirect(
      withEditorialMessage(
        withBase(`/redaktion/inhalte/${type}/${result.entryId}/`),
        'message',
        `Export vorbereitet: ${exportArtifact.filename}`,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export konnte nicht vorbereitet werden.';
    return createEditorialRedirect(withEditorialMessage(fallbackUrl, 'error', message));
  }
};
