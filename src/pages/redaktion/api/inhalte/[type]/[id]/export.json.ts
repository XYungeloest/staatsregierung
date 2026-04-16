import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../../../lib/dynamic/env.ts';
import { entryToWriteInput } from '../../../../../../lib/editorial/drafts.ts';
import { getEditorialEntryById } from '../../../../../../lib/editorial/repository.ts';
import { getEditorialTypeDefinition, isEditorialEntryType } from '../../../../../../lib/editorial/studio.ts';
import { buildExportArtifact } from '../../../../../../lib/editorial/transformers.ts';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  if (!isEditorialEntryType(params.type)) {
    return new Response('Unbekannter Inhaltstyp', { status: 404 });
  }

  const type = params.type;
  const definition = getEditorialTypeDefinition(type);

  if (!definition.exportPathBuilder) {
    return new Response('Für diesen Typ steht kein JSON-Export bereit.', { status: 405 });
  }

  const entryId = params.id ?? '';
  const entry = entryId ? await getEditorialEntryById(getDatabase(), entryId) : undefined;

  if (!entry || entry.type !== type) {
    return new Response('Entwurf nicht gefunden', { status: 404 });
  }

  const artifact = buildExportArtifact(entryToWriteInput(entry, 'export'));

  return new Response(JSON.stringify(artifact.payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${artifact.filename}"`,
    },
  });
};
