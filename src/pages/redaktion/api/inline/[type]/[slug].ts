import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../../lib/dynamic/env.ts';
import {
  createEditorialRedirect,
  formatEditorialActionError,
  requireEditorialWriteAccess,
} from '../../../../../lib/editorial/api.ts';
import { getEditorialAuthor } from '../../../../../lib/editorial/access.ts';
import { parseEditorialFormData } from '../../../../../lib/editorial/forms.ts';
import {
  getInlineBaseDraft,
  getInlineFieldDefinition,
  mergeFormValuesIntoFormData,
  overlayFieldValues,
} from '../../../../../lib/editorial/inline.ts';
import { getEditorialTypeDefinition, isEditorialEntryType } from '../../../../../lib/editorial/studio.ts';
import { buildContentPayload, publishDirectContent } from '../../../../../lib/editorial/transformers.ts';
import { buildEditorialFormValues } from '../../../../../lib/editorial/drafts.ts';
import { saveEditorialEntry, writePublishLog } from '../../../../../lib/editorial/repository.ts';

export const prerender = false;

function withEditorMessage(returnTo: string, key: 'message' | 'error', value: string): string {
  const nextUrl = new URL(returnTo, 'https://portal.invalid');
  nextUrl.searchParams.delete('message');
  nextUrl.searchParams.delete('error');
  nextUrl.searchParams.set(key, value);
  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
}

export const POST: APIRoute = async ({ params, request, url }) => {
  if (!isEditorialEntryType(params.type)) {
    return new Response('Unbekannter Inhaltstyp', { status: 404 });
  }

  const type = params.type;
  const slug = params.slug ?? '';
  const formData = await request.formData();
  const fieldKey = String(formData.get('fieldKey') ?? '').trim();
  const returnTo = String(formData.get('returnTo') ?? '').trim() || '/';
  const intent = String(formData.get('intent') ?? 'save').trim();
  const definition = getInlineFieldDefinition(type, fieldKey);
  const deniedResponse = requireEditorialWriteAccess(request, url, returnTo);

  if (!definition || !slug) {
    return createEditorialRedirect(withEditorMessage(returnTo, 'error', 'Redaktionsblock nicht gefunden.'));
  }

  if (deniedResponse) {
    return deniedResponse;
  }

  try {
    const database = getDatabase();
    const { sourceOrigin, fallbackDraft, currentDraft } = await getInlineBaseDraft(database, type, slug);
    const baseDraft = currentDraft;
    const baseValues = buildEditorialFormValues(baseDraft);
    const mergedFormData = mergeFormValuesIntoFormData(baseValues);

    if (intent === 'use_fallback') {
      const fallbackValues = buildEditorialFormValues(fallbackDraft);
      overlayFieldValues(mergedFormData, definition, Object.fromEntries(
        definition.fields.map((field: string) => [field, String(fallbackValues[field] ?? '')]),
      ));
    } else {
      for (const field of definition.fields) {
        mergedFormData.delete(field);

        if (field === 'isFeatured') {
          if (formData.get(field) === 'on') {
            mergedFormData.set(field, 'on');
          }
          continue;
        }

        const value = String(formData.get(field) ?? '');
        if (value.length > 0) {
          mergedFormData.set(field, value);
        }
      }
    }

    if (formData.get('summary')) {
      mergedFormData.set('summary', String(formData.get('summary') ?? ''));
    }

    const parsed = parseEditorialFormData(mergedFormData, type);
    const author = getEditorialAuthor(request, parsed.author);
    const writeInput = {
      ...parsed,
      author,
      publishMode: getEditorialTypeDefinition(type).publishMode,
      action: intent === 'publish' ? 'publish' as const : 'draft_save' as const,
      status: intent === 'publish' ? 'published' as const : 'draft' as const,
      liveBehavior:
        intent === 'publish'
          ? 'publish' as const
          : intent === 'reset'
            ? 'reset' as const
            : 'preserve' as const,
    };

    if (intent === 'reset') {
      const resetResult = await saveEditorialEntry(database, {
        ...writeInput,
        status: 'draft',
        summary: parsed.summary || `Inline-Reset: ${definition.label}`,
      });

      await writePublishLog(database, {
        entryId: resetResult.entryId,
        versionId: resetResult.versionId,
        targetType: type,
        targetIdentifier: slug,
        mode: getEditorialTypeDefinition(type).publishMode,
        status: 'prepared',
        detail: `Override für ${definition.label} zurückgesetzt`,
      });

      return createEditorialRedirect(withEditorMessage(returnTo, 'message', 'Override zurückgesetzt.'));
    }

    let publishedPayload: unknown = undefined;

    if (intent === 'publish') {
      publishedPayload = buildContentPayload(writeInput);

      if (getEditorialTypeDefinition(type).publishMode === 'direct') {
        await publishDirectContent(database, writeInput);
      }
    }

    const result = await saveEditorialEntry(database, {
      ...writeInput,
      publishedPayload,
      summary:
        parsed.summary ||
        (intent === 'publish'
          ? `Inline-Veröffentlichung: ${definition.label}`
          : intent === 'use_fallback'
            ? `Fallback übernommen: ${definition.label}`
            : `Inline-Entwurf aktualisiert: ${definition.label}`),
      metadata: {
        sourceId: baseDraft.metadata.sourceId ?? slug,
        sourceOrigin: baseDraft.metadata.sourceOrigin ?? sourceOrigin,
      },
    });

    if (intent === 'publish') {
      await writePublishLog(database, {
        entryId: result.entryId,
        versionId: result.versionId,
        targetType: type,
        targetIdentifier: slug,
        mode: getEditorialTypeDefinition(type).publishMode,
        status: 'success',
        detail: `Inline veröffentlicht: ${definition.label}`,
        payload: publishedPayload,
      });
    }

    return createEditorialRedirect(
      withEditorMessage(
        returnTo,
        'message',
        intent === 'publish'
          ? 'Änderung veröffentlicht.'
          : intent === 'use_fallback'
            ? 'Statischer Wert in den Entwurf übernommen.'
            : 'Entwurf gespeichert.',
      ),
    );
  } catch (error) {
    const message = formatEditorialActionError(
      error,
      'Inline-Bearbeitung fehlgeschlagen.',
      url,
    );
    return createEditorialRedirect(withEditorMessage(returnTo, 'error', message));
  }
};
