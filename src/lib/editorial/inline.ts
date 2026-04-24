import { buildDraftFromContent, buildEditorialFormValues, entryToWriteInput, type EditorialFormValues } from './drafts.ts';
import { getEditorialSourceDraft } from './sources.ts';
import { getEditorialEntryStateByTypeAndSlug, listMediaAssets } from './repository.ts';
import type { EditorialEntry, EditorialEntryState, EditorialEntryWriteInput, EditorialVersion, MediaAsset } from './schema.ts';
import { getEditorialTypeDefinition, isEditorialOverrideType, type EditorialEntryType, type EditorialSourceOrigin } from './studio.ts';
import { withBase } from '../portal/routes.ts';

export interface EditorialInlineFieldDefinition {
  key: string;
  label: string;
  description: string;
  fields: string[];
  mediaFields?: string[];
}

export interface EditorialInlineSectionState {
  definition: EditorialInlineFieldDefinition;
  fallbackValues: Record<string, string>;
  liveValues: Record<string, string>;
  draftValues: Record<string, string>;
  usesMedia: boolean;
  hasOverrideValue: boolean;
  hasDraftChanges: boolean;
  sourceLabel: string;
}

export interface EditorialInlinePanelState {
  type: EditorialEntryType;
  slug: string;
  title: string;
  fieldKey: string;
  sourceOrigin: EditorialSourceOrigin;
  field: EditorialInlineSectionState;
  entry?: EditorialEntry;
  entryState: EditorialEntryState;
  currentDraft: EditorialEntryWriteInput;
  fallbackDraft: EditorialEntryWriteInput;
  mediaAssets: MediaAsset[];
  returnTo: string;
}

const inlineFieldDefinitions: Record<EditorialEntryType, EditorialInlineFieldDefinition[]> = {
  pressemitteilung: [
    {
      key: 'hero',
      label: 'Kopfbereich',
      description: 'Titel, Teaser, Ressort, Datum und Hervorhebung.',
      fields: ['title', 'teaser', 'ressort', 'date', 'isFeatured'],
    },
    {
      key: 'media',
      label: 'Medienblock',
      description: 'Bildquelle, Alt-Text und Credit.',
      fields: ['imageUrl', 'mediaKey', 'imageAlt', 'imageCredit'],
      mediaFields: ['imageUrl', 'mediaKey', 'imageAlt', 'imageCredit'],
    },
    {
      key: 'body',
      label: 'Meldungstext',
      description: 'Haupttext der Pressemitteilung.',
      fields: ['bodyText'],
    },
  ],
  termin: [],
  stellenangebot: [],
  projektstatus: [],
  'service-seite': [
    {
      key: 'hero',
      label: 'Seitentitel',
      description: 'Überschrift der Serviceseite.',
      fields: ['title'],
    },
    {
      key: 'body',
      label: 'Inhaltsblock',
      description: 'Textabschnitte der Serviceseite.',
      fields: ['bodyText'],
    },
  ],
  themenseite: [
    {
      key: 'hero',
      label: 'Hero',
      description: 'Titel, Hero-Text, Teaser und Zuständigkeit.',
      fields: ['title', 'hero', 'teaser', 'topicStatus', 'federfuehrendesRessort', 'mitzeichnungsressortsText'],
    },
    {
      key: 'beschlossen',
      label: 'Beschlossen',
      description: 'Beschlossene Maßnahmen des Themas.',
      fields: ['beschlossenText'],
    },
    {
      key: 'umgesetzt',
      label: 'Umgesetzt',
      description: 'Bereits umgesetzte Punkte.',
      fields: ['umgesetztText'],
    },
    {
      key: 'naechste-schritte',
      label: 'Nächste Schritte',
      description: 'Laufende oder nächste Umsetzungsschritte.',
      fields: ['naechsteSchritteText'],
    },
    {
      key: 'faq',
      label: 'FAQ',
      description: 'FAQ-Block der Themenseite.',
      fields: ['faqText'],
    },
  ],
  ressort: [
    {
      key: 'hero',
      label: 'Ressortkopf',
      description: 'Name, Kurzname, Leitung und Teaser.',
      fields: ['name', 'kurzname', 'leitung', 'teaser'],
    },
    {
      key: 'media',
      label: 'Medienblock',
      description: 'Titelbild des Ressorts mit Metadaten.',
      fields: ['imageUrl', 'mediaKey', 'imageAlt', 'imageCredit'],
      mediaFields: ['imageUrl', 'mediaKey', 'imageAlt', 'imageCredit'],
    },
    {
      key: 'aufgaben',
      label: 'Aufgaben',
      description: 'Aufgabenliste des Ressorts.',
      fields: ['aufgabenText'],
    },
    {
      key: 'kontakt',
      label: 'Kontaktblock',
      description: 'Kontaktangaben des Ressorts.',
      fields: ['contactName', 'contactEmail', 'contactTelefon', 'contactReferat'],
    },
  ],
  regierungsmitglied: [
    {
      key: 'hero',
      label: 'Profilkopf',
      description: 'Name, Amt, Ressort und Reihenfolge.',
      fields: ['name', 'amt', 'ressort', 'reihenfolge'],
    },
    {
      key: 'media',
      label: 'Porträt',
      description: 'Bild, Alt-Text und Credit.',
      fields: ['imageUrl', 'mediaKey', 'imageAlt', 'imageCredit'],
      mediaFields: ['imageUrl', 'mediaKey', 'imageAlt', 'imageCredit'],
    },
    {
      key: 'biografie',
      label: 'Biografie',
      description: 'Kurzbiografie, Langbiografie und Zitat.',
      fields: ['kurzbiografie', 'langbiografieText', 'zitat'],
    },
    {
      key: 'kontakt',
      label: 'Kontaktblock',
      description: 'Kontaktangaben des Regierungsmitglieds.',
      fields: ['contactName', 'contactEmail', 'contactTelefon', 'contactReferat'],
    },
  ],
};

function getSourceOriginForType(type: EditorialEntryType): EditorialSourceOrigin {
  return getEditorialTypeDefinition(type).publishMode === 'direct' ? 'd1' : 'file';
}

function cloneDraft(input: EditorialEntryWriteInput): EditorialEntryWriteInput {
  return JSON.parse(JSON.stringify(input)) as EditorialEntryWriteInput;
}

function createVersionDraftFromEntry(
  entry: EditorialEntry | undefined,
  version: EditorialVersion | undefined,
  type: EditorialEntryType,
  slug: string,
  sourceOrigin: EditorialSourceOrigin,
): EditorialEntryWriteInput | undefined {
  if (!entry || !version) {
    return undefined;
  }

  return buildDraftFromContent(type, slug, entry.title, version.content, {
    entryId: entry.id,
    route: entry.route,
    author: version.author ?? entry.author,
    status: version.status,
    sourceId: entry.metadata.sourceId,
    sourceOrigin: entry.metadata.sourceOrigin ?? sourceOrigin,
  });
}

function pickFields(
  values: EditorialFormValues,
  definition: EditorialInlineFieldDefinition,
): Record<string, string> {
  return Object.fromEntries(
    definition.fields.map((field) => {
      const rawValue = values[field];

      if (typeof rawValue === 'boolean') {
        return [field, rawValue ? 'on' : ''];
      }

      if (typeof rawValue === 'number') {
        return [field, String(rawValue)];
      }

      return [field, typeof rawValue === 'string' ? rawValue : ''];
    }),
  );
}

function serializeInlineValues(value: Record<string, string>): string {
  return JSON.stringify(value);
}

function buildReturnUrl(baseUrl: URL, fieldKey?: string, message?: string, error?: string): string {
  const nextUrl = new URL(baseUrl.pathname + baseUrl.search, baseUrl);

  nextUrl.searchParams.delete('message');
  nextUrl.searchParams.delete('error');
  nextUrl.searchParams.delete('editor');

  if (fieldKey) {
    nextUrl.searchParams.set('editor', fieldKey);
  }

  if (message) {
    nextUrl.searchParams.set('message', message);
  }

  if (error) {
    nextUrl.searchParams.set('error', error);
  }

  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
}

export function listInlineFields(type: EditorialEntryType): EditorialInlineFieldDefinition[] {
  return inlineFieldDefinitions[type] ?? [];
}

export function getInlineFieldDefinition(
  type: EditorialEntryType,
  key: string,
): EditorialInlineFieldDefinition | undefined {
  return listInlineFields(type).find((entry) => entry.key === key);
}

export function buildInlineEditHref(currentUrl: URL, fieldKey: string): string {
  return buildReturnUrl(currentUrl, fieldKey);
}

export function buildInlineCloseHref(currentUrl: URL): string {
  return buildReturnUrl(currentUrl);
}

export async function getInlineBaseDraft(
  database: D1Database,
  type: EditorialEntryType,
  slug: string,
): Promise<{
  sourceOrigin: EditorialSourceOrigin;
  entryState: EditorialEntryState;
  fallbackDraft: EditorialEntryWriteInput;
  currentDraft: EditorialEntryWriteInput;
  publishedDraft?: EditorialEntryWriteInput;
}> {
  const sourceOrigin = getSourceOriginForType(type);
  const entryState = await getEditorialEntryStateByTypeAndSlug(database, type, slug);
  const fallbackDraft =
    (await getEditorialSourceDraft(database, type, sourceOrigin === 'd1' ? 'd1' : 'file', slug)) ??
    buildDraftFromContent(type, slug, slug, {} as EditorialEntryWriteInput['content'], {
      sourceId: slug,
      sourceOrigin,
    });
  const currentDraft = entryState.entry ? entryToWriteInput(entryState.entry) : cloneDraft(fallbackDraft);
  const publishedDraft = createVersionDraftFromEntry(
    entryState.entry,
    entryState.publishedVersion,
    type,
    slug,
    sourceOrigin,
  );

  return {
    sourceOrigin,
    entryState,
    fallbackDraft,
    currentDraft,
    publishedDraft,
  };
}

export function buildInlineSectionState(
  type: EditorialEntryType,
  definition: EditorialInlineFieldDefinition,
  sourceOrigin: EditorialSourceOrigin,
  fallbackDraft: EditorialEntryWriteInput,
  currentDraft: EditorialEntryWriteInput,
  publishedDraft?: EditorialEntryWriteInput,
): EditorialInlineSectionState {
  const fallbackValues = pickFields(buildEditorialFormValues(fallbackDraft), definition);
  const liveValues = pickFields(
    buildEditorialFormValues(publishedDraft ?? fallbackDraft),
    definition,
  );
  const draftValues = pickFields(buildEditorialFormValues(currentDraft), definition);
  const hasOverrideValue = serializeInlineValues(liveValues) !== serializeInlineValues(fallbackValues);
  const hasDraftChanges = serializeInlineValues(draftValues) !== serializeInlineValues(liveValues);

  return {
    definition,
    fallbackValues,
    liveValues,
    draftValues,
    usesMedia: Boolean(definition.mediaFields?.length),
    hasOverrideValue,
    hasDraftChanges,
    sourceLabel: hasDraftChanges
      ? 'Entwurf überschreibt den aktuell ausgelieferten Wert.'
      : hasOverrideValue
        ? isEditorialOverrideType(type)
          ? 'Redaktioneller Stand aktiv.'
          : 'Aktueller Veröffentlichungsstand.'
        : sourceOrigin === 'file'
          ? 'Feld stammt aus dem freigegebenen Grundstand.'
          : 'Feld stammt aus dem aktuellen Veröffentlichungsstand.',
  };
}

export function getInlineSectionStatusLabel(state: EditorialInlineSectionState): string {
  if (state.hasDraftChanges) {
    return 'Entwurf offen';
  }

  if (state.hasOverrideValue) {
    return 'Überschrieben';
  }

  return 'Ausgangsstand';
}

export async function getInlinePanelState(
  database: D1Database,
  currentUrl: URL,
  type: EditorialEntryType,
  slug: string,
  fieldKey: string,
): Promise<EditorialInlinePanelState | undefined> {
  const definition = getInlineFieldDefinition(type, fieldKey);

  if (!definition) {
    return undefined;
  }

  const { sourceOrigin, entryState, fallbackDraft, currentDraft, publishedDraft } = await getInlineBaseDraft(
    database,
    type,
    slug,
  );

  const field = buildInlineSectionState(
    type,
    definition,
    sourceOrigin,
    fallbackDraft,
    currentDraft,
    publishedDraft,
  );
  const mediaAssets = definition.mediaFields && definition.mediaFields.length > 0
    ? await listMediaAssets(database)
    : [];

  return {
    type,
    slug,
    title: currentDraft.title,
    fieldKey,
    sourceOrigin,
    field,
    entry: entryState.entry,
    entryState,
    currentDraft,
    fallbackDraft,
    mediaAssets,
    returnTo: buildReturnUrl(currentUrl, fieldKey),
  };
}

export function mergeFormValuesIntoFormData(values: EditorialFormValues): FormData {
  const formData = new FormData();

  for (const [key, rawValue] of Object.entries(values)) {
    if (typeof rawValue === 'undefined') {
      continue;
    }

    if (typeof rawValue === 'boolean') {
      if (rawValue) {
        formData.set(key, 'on');
      }
      continue;
    }

    formData.set(key, String(rawValue));
  }

  return formData;
}

export function overlayFieldValues(
  target: FormData,
  definition: EditorialInlineFieldDefinition,
  sourceValues: Record<string, string>,
): void {
  for (const field of definition.fields) {
    target.delete(field);

    const value = sourceValues[field] ?? '';
    if (value.length > 0) {
      target.set(field, value);
    }
  }
}

export function buildInlineStudioHref(type: EditorialEntryType, slug: string, entryId?: string): string {
  if (entryId) {
    return withBase(`/redaktion/inhalte/${type}/${entryId}/`);
  }

  const params = new URLSearchParams({
    source: slug,
    origin: getSourceOriginForType(type),
  });

  return withBase(`/redaktion/inhalte/${type}/neu?${params.toString()}`);
}
