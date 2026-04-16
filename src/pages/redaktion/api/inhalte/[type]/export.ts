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
import { buildExportArtifact } from '../../../../../lib/editorial/transformers.ts';
import { withBase } from '../../../../../lib/portal/routes.ts';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, url }) => {
  if (!isEditorialEntryType(params.type)) {
    return new Response('Unbekannter Inhaltstyp', { status: 404 });
  }

  const type = params.type;
  const definition = getEditorialTypeDefinition(type);

  if (!definition.exportPathBuilder) {
    return new Response('Für diesen Typ steht kein JSON-Export zur Verfügung', { status: 405 });
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
        `Payload exportiert: ${exportArtifact.filename}`,
      ),
    );
  } catch (error) {
    const message = formatEditorialActionError(error, 'Export konnte nicht erzeugt werden.', url);
    return createEditorialRedirect(withEditorialMessage(fallbackUrl, 'error', message));
  }
};
