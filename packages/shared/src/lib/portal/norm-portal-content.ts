import { portalCollections } from '@ostrecht/shared/lib/portal/collections.ts';
import { loadCollection } from '@ostrecht/shared/lib/portal/json-collection.ts';
import {
  parsePressemitteilung,
  parseThemenseite,
  type Pressemitteilung,
  type Themenseite,
} from '@ostrecht/shared/lib/portal/schema.ts';

/**
 * Themen und Pressemitteilungen: die einzigen Portalinhalte, die der D1-Sync liest
 * (Portalbezüge in law_norm_derived). Teil des Code-Abschlusses von scripts/sync-recht-d1.mjs;
 * der vollständige Portal-Loader (loader.ts mit Organisations- und Stichtagslogik) bleibt
 * außerhalb und exportiert diese Funktionen für die Portalseiten weiter.
 */

export async function loadPressReleases(): Promise<Pressemitteilung[]> {
  const entries = await loadCollection(
    portalCollections.pressemitteilung.directorySegments,
    parsePressemitteilung,
  );
  return entries.sort((left, right) => right.date.localeCompare(left.date));
}

export async function loadTopics(): Promise<Themenseite[]> {
  const entries = await loadCollection(portalCollections.themenseite.directorySegments, parseThemenseite);
  return entries.sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

export async function loadTopicBySlug(slug: string): Promise<Themenseite | undefined> {
  const entries = await loadTopics();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadPressReleaseBySlug(
  slug: string,
): Promise<Pressemitteilung | undefined> {
  const entries = await loadPressReleases();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadFeaturedPressReleases(limit = 3): Promise<Pressemitteilung[]> {
  const entries = await loadPressReleases();
  return entries.filter((entry) => entry.isFeatured).slice(0, limit);
}

export async function loadRecentPressReleases(limit = 3): Promise<Pressemitteilung[]> {
  const entries = await loadPressReleases();
  return entries.slice(0, limit);
}
