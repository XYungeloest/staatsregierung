import type { NormOutlineItem } from '@ostrecht/shared/lib/norms/display.ts';
import type { NormPublicationReference } from '@ostrecht/shared/lib/norms/publications.ts';
import type { NormRecord, NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';
import { classifyNormVersions, getCurrentVersion } from '@ostrecht/shared/lib/norms/versions.ts';

import { latestAmendment } from './norm-head.ts';
import type { NormStore } from './runtime/store.ts';

/** Gemeinsame Daten für die eigenständigen Daten- und Beziehungsansichten. */
export async function loadNormSection(store: NormStore, slug: string, versionId?: string) {
  const norm = await store.getNorm(slug, versionId ? [versionId] : 'current');
  if (!norm) return null;
  const version = versionId ? norm.versions.find((entry) => entry.versionId === versionId) : getCurrentVersion(norm);
  if (!version) return null;
  const view = await loadNormView(store, norm, version);
  return view ? { norm, version, view } : null;
}

/**
 * Gemeinsame Ladeschritte der Normansichten (Text, Fassung): abgeleitete Daten, Vollzitat,
 * Fundstelle der angezeigten und der nächsten künftigen Fassung, Bezeichnungen der
 * Änderungsvorschriften. Jede Seite lädt nur, was sie zeigt.
 */
export async function loadNormView(store: NormStore, norm: NormRecord, version: NormVersion) {
  const slug = norm.meta.slug;
  const future = classifyNormVersions(norm)
    .filter((entry) => entry.kind === 'future' && entry.version.validFrom > version.validFrom)
    .sort((left, right) => left.version.validFrom.localeCompare(right.version.validFrom))[0]?.version;
  const [derived, fullCitation, publicationReference, nextFutureReference] = await Promise.all([
    store.getDerived(slug),
    store.getFullCitation(slug, version.versionId),
    store.getPublicationReference(slug, version.versionId),
    future ? store.getPublicationReference(slug, future.versionId) : Promise.resolve(undefined),
  ]);
  if (!derived) return null;
  const amendment = latestAmendment(norm);
  const labelSlugs = [
    ...derived.origin.ownChanges.map((entry) => entry.relatedNormSlug),
    amendment?.relatedNorm,
    ...norm.history.entries.map((entry) => entry.relatedNorm),
  ].filter((entry): entry is string => Boolean(entry));
  const [publication, amendmentLabels] = await Promise.all([
    publicationReference ? store.getPublication(publicationReference.publicationSlug) : Promise.resolve(null),
    store.getNormLabels(labelSlugs),
  ]);
  return {
    derived,
    fullCitation: fullCitation ?? version.citation,
    publicationReference: publicationReference as NormPublicationReference | undefined,
    nextFutureReference: nextFutureReference as NormPublicationReference | undefined,
    publication: publication ?? undefined,
    amendmentLabels,
  };
}

/** Kurzangabe zum Umfang für die Fußzeile der Inhaltsübersicht („80 §§ · 3 Anlagen“). */
export function outlineSummary(items: NormOutlineItem[]): string {
  let units = 0;
  let articles = 0;
  let annexes = 0;
  const visit = (entries: NormOutlineItem[]) => {
    for (const entry of entries) {
      if (entry.label && /^§/u.test(entry.label)) units += 1;
      else if (entry.label && /^(Art\.|Artikel)/u.test(entry.label)) articles += 1;
      else if (/^Anlage/u.test(entry.label ?? entry.title)) annexes += 1;
      visit(entry.children);
    }
  };
  visit(items);
  return [
    units > 0 ? `${units} §§` : '',
    articles > 0 ? `${articles} Artikel` : '',
    annexes > 0 ? `${annexes} ${annexes === 1 ? 'Anlage' : 'Anlagen'}` : '',
  ].filter(Boolean).join(' · ');
}
