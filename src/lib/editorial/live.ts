import { isEditorialToolsEnabled } from '../../config/features.ts';
import { getDatabase } from '../dynamic/env.ts';
import {
  parseMinisterium,
  parseRegierungMitglied,
  parseSeite,
  parseThemenseite,
  type Ministerium,
  type RegierungMitglied,
  type Seite,
  type Themenseite,
} from '../portal/schema.ts';
import { withBase } from '../portal/routes.ts';
import { hasEditorialSession } from './access.ts';
import type { EditorialEntryState } from './schema.ts';
import { getEditorialEntryStateByTypeAndSlug } from './repository.ts';
import type { EditorialEntryType, EditorialSourceOrigin } from './studio.ts';

export interface EditorialPublicState {
  entryState: EditorialEntryState;
  sourceOrigin: EditorialSourceOrigin;
  studioHref: string;
  sourceLabel: string;
  liveLabel: string;
}

export function shouldRenderEditorialUi(request: Request, url: URL): boolean {
  if (!isEditorialToolsEnabled()) {
    return false;
  }

  return hasEditorialSession(request, url);
}

export function getEditorialStudioHref(
  type: EditorialEntryType,
  slug: string,
  sourceOrigin: EditorialSourceOrigin,
  entryId?: string,
): string {
  if (entryId) {
    return withBase(`/redaktion/inhalte/${type}/${entryId}/`);
  }

  const searchParams = new URLSearchParams({
    source: slug,
    origin: sourceOrigin,
  });

  return withBase(`/redaktion/inhalte/${type}/neu?${searchParams.toString()}`);
}

export async function getEditorialPublicState(
  type: EditorialEntryType,
  slug: string,
  sourceOrigin: EditorialSourceOrigin,
): Promise<EditorialPublicState> {
  const entryState = await getEditorialEntryStateByTypeAndSlug(getDatabase(), type, slug);
  const sourceLabel = entryState.hasLiveVersion ? 'Live-Override aktiv' : 'Statischer Fallback';
  const liveLabel = entryState.hasPendingChanges
    ? 'Unveröffentlichte Änderungen vorhanden'
    : entryState.hasLiveVersion
      ? 'Veröffentlichter Override wird ausgeliefert'
      : 'Öffentliche Seite kommt aus dem Repository';

  return {
    entryState,
    sourceOrigin,
    studioHref: getEditorialStudioHref(type, slug, sourceOrigin, entryState.entry?.id),
    sourceLabel,
    liveLabel,
  };
}

function resolvePublishedPayload<T>(state: EditorialPublicState): T | undefined {
  return state.entryState.publishedVersion?.publishedPayload as T | undefined;
}

export async function resolveTopicPageContent(slug: string, fallback: Themenseite | undefined) {
  const editorial = await getEditorialPublicState('themenseite', slug, 'file');
  const publishedPayload = resolvePublishedPayload<unknown>(editorial);
  const topic = publishedPayload
    ? parseThemenseite(publishedPayload, `editorial.live.themenseite[${slug}]`)
    : fallback;

  return {
    topic,
    editorial,
    sourceKind: publishedPayload ? 'override' : 'fallback',
  } as const;
}

export async function resolveMinistryPageContent(slug: string, fallback: Ministerium | undefined) {
  const editorial = await getEditorialPublicState('ressort', slug, 'file');
  const publishedPayload = resolvePublishedPayload<unknown>(editorial);
  const ministry = publishedPayload
    ? parseMinisterium(publishedPayload, `editorial.live.ressort[${slug}]`)
    : fallback;

  return {
    ministry,
    editorial,
    sourceKind: publishedPayload ? 'override' : 'fallback',
  } as const;
}

export async function resolveGovernmentMemberPageContent(
  slug: string,
  fallback: RegierungMitglied | undefined,
) {
  const editorial = await getEditorialPublicState('regierungsmitglied', slug, 'file');
  const publishedPayload = resolvePublishedPayload<unknown>(editorial);
  const member = publishedPayload
    ? parseRegierungMitglied(publishedPayload, `editorial.live.regierungsmitglied[${slug}]`)
    : fallback;

  return {
    member,
    editorial,
    sourceKind: publishedPayload ? 'override' : 'fallback',
  } as const;
}

export async function resolveServicePageContent(slug: string, fallback: Seite | undefined) {
  const editorial = await getEditorialPublicState('service-seite', slug, 'file');
  const publishedPayload = resolvePublishedPayload<unknown>(editorial);
  const page = publishedPayload
    ? parseSeite(publishedPayload, `editorial.live.service-seite[${slug}]`)
    : fallback;

  return {
    page,
    editorial,
    sourceKind: publishedPayload ? 'override' : 'fallback',
  } as const;
}
