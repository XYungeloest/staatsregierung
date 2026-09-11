import { buildNormChangeMarks, type NormChangeMarks } from '@ostrecht/shared/lib/norms/change-marks.ts';
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

/** Unmittelbare Vorfassung der angezeigten Fassung (nach Gültigkeitsbeginn), falls gespeichert. */
export function previousVersionOf(norm: NormRecord, version: NormVersion): NormVersion | undefined {
  return [...norm.versions]
    .filter((entry) => entry.validFrom < version.validFrom)
    .sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0];
}

/** Marken am Ort der Änderung samt Vorfassung und Wirksamkeitsdatum der angezeigten Fassung. */
export interface NormChangeMarkSet {
  marks: NormChangeMarks;
  previousVersionId: string;
  validFrom: string;
}

/**
 * Der Vergleich gegen die Vorfassung kostet bei langen Vorschriften deutlich mehr als 50 ms je
 * Anfrage (Verfassung: 70–90 ms); die Marken bleiben je (Slug, Vorfassung, Fassung) im Speicher
 * des Workers – nicht in der D1-Projektion. Fassungen sind unveränderlich, der Schlüssel reicht.
 */
const MARK_CACHE_LIMIT = 200;
const markCache = new Map<string, NormChangeMarks>();

function cachedMarks(key: string, compute: () => NormChangeMarks): NormChangeMarks {
  const hit = markCache.get(key);
  if (hit) return hit;
  const marks = compute();
  if (markCache.size >= MARK_CACHE_LIMIT) markCache.delete(markCache.keys().next().value!);
  markCache.set(key, marks);
  return marks;
}

async function loadChangeMarks(store: NormStore, norm: NormRecord, version: NormVersion): Promise<NormChangeMarkSet | undefined> {
  const previous = previousVersionOf(norm, version);
  if (!previous || version.body.length === 0) return undefined;
  const key = `${norm.meta.slug}|${previous.versionId}|${version.versionId}`;
  if (markCache.has(key)) return { marks: markCache.get(key)!, previousVersionId: previous.versionId, validFrom: version.validFrom };
  const previousBody = previous.body.length > 0
    ? previous.body
    : (await store.getNorm(norm.meta.slug, [previous.versionId]))?.versions.find((entry) => entry.versionId === previous.versionId)?.body;
  if (!previousBody) return undefined;
  return { marks: cachedMarks(key, () => buildNormChangeMarks({ body: previousBody }, version)), previousVersionId: previous.versionId, validFrom: version.validFrom };
}

/**
 * Gemeinsame Ladeschritte der Normansichten (Text, Fassung): abgeleitete Daten, Vollzitat,
 * Fundstelle der angezeigten und der nächsten künftigen Fassung, Bezeichnungen der
 * Änderungsvorschriften, Marken am Ort der Änderung gegen die Vorfassung. Jede Seite lädt nur,
 * was sie zeigt (Daten- und Beziehungsseiten übergeben keine Normkörper und erhalten keine Marken).
 */
export async function loadNormView(store: NormStore, norm: NormRecord, version: NormVersion) {
  const slug = norm.meta.slug;
  const future = classifyNormVersions(norm)
    .filter((entry) => entry.kind === 'future' && entry.version.validFrom > version.validFrom)
    .sort((left, right) => left.version.validFrom.localeCompare(right.version.validFrom))[0]?.version;
  const [derived, fullCitation, publicationReference, nextFutureReference, changeMarks] = await Promise.all([
    store.getDerived(slug),
    store.getFullCitation(slug, version.versionId),
    store.getPublicationReference(slug, version.versionId),
    future ? store.getPublicationReference(slug, future.versionId) : Promise.resolve(undefined),
    loadChangeMarks(store, norm, version),
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
    changeMarks,
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
