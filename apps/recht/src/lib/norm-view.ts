import { summarizeAffectedUnits, type AffectedUnits } from '@ostrecht/shared/lib/norms/affected-units.ts';
import { marksFromAffectedUnits, type NormChangeMarks } from '@ostrecht/shared/lib/norms/change-marks.ts';
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
 * Der Vergleich gegen die Vorfassung ist je Fassungspaar einmal zu rechnen (Verfassung nach der
 * dokumentweiten Paarung rund 11 ms, zuvor 70–90 ms); die betroffenen Einheiten bleiben je
 * (Slug, Vorfassung, Fassung) im Speicher des Workers – nicht in der D1-Projektion. Fassungen sind
 * unveränderlich, der Schlüssel reicht. Marken, Protokollspalte „Betroffen“ und der Verlauf je
 * Einheit lesen denselben Eintrag.
 */
const AFFECTED_CACHE_LIMIT = 200;
const affectedCache = new Map<string, AffectedUnits>();

/** Betroffene Einheiten einer Fassung gegenüber ihrer Vorfassung; lädt fehlende Normkörper nach. */
export async function loadAffectedUnits(store: NormStore, norm: NormRecord, version: NormVersion): Promise<{ affected: AffectedUnits; previousVersionId: string } | undefined> {
  const previous = previousVersionOf(norm, version);
  if (!previous) return undefined;
  const key = `${norm.meta.slug}|${previous.versionId}|${version.versionId}`;
  const cached = affectedCache.get(key);
  if (cached) return { affected: cached, previousVersionId: previous.versionId };
  const bodies = new Map<string, NormVersion['body']>();
  for (const entry of [previous, version]) if (entry.body.length > 0) bodies.set(entry.versionId, entry.body);
  const missing = [previous, version].filter((entry) => !bodies.has(entry.versionId)).map((entry) => entry.versionId);
  if (missing.length > 0) {
    const loaded = await store.getNorm(norm.meta.slug, missing);
    for (const entry of loaded?.versions ?? []) if (missing.includes(entry.versionId) && entry.body.length > 0) bodies.set(entry.versionId, entry.body);
  }
  const previousBody = bodies.get(previous.versionId);
  const shownBody = bodies.get(version.versionId);
  if (!previousBody || !shownBody) return undefined;
  const affected = summarizeAffectedUnits({ body: previousBody }, { body: shownBody });
  if (affectedCache.size >= AFFECTED_CACHE_LIMIT) affectedCache.delete(affectedCache.keys().next().value!);
  affectedCache.set(key, affected);
  return { affected, previousVersionId: previous.versionId };
}

/**
 * Betroffene Einheiten für mehrere Fassungen einer Vorschrift (Protokoll, Endpunkt): Treffer aus
 * dem Cache, die fehlenden Normkörper in einem Zugriff nachgeladen, jede Fassung einmal gerechnet.
 */
export async function loadAffectedUnitsForVersions(store: NormStore, norm: NormRecord, versions: NormVersion[]): Promise<Map<string, { affected: AffectedUnits; previousVersionId: string }>> {
  const result = new Map<string, { affected: AffectedUnits; previousVersionId: string }>();
  const pending: Array<{ version: NormVersion; previous: NormVersion; key: string }> = [];
  for (const version of versions) {
    const previous = previousVersionOf(norm, version);
    if (!previous) continue;
    const key = `${norm.meta.slug}|${previous.versionId}|${version.versionId}`;
    const cached = affectedCache.get(key);
    if (cached) result.set(version.versionId, { affected: cached, previousVersionId: previous.versionId });
    else pending.push({ version, previous, key });
  }
  if (pending.length === 0) return result;
  const bodies = new Map<string, NormVersion['body']>();
  for (const entry of norm.versions) if (entry.body.length > 0) bodies.set(entry.versionId, entry.body);
  const missing = [...new Set(pending.flatMap(({ version, previous }) => [version.versionId, previous.versionId]))].filter((id) => !bodies.has(id));
  if (missing.length > 0) {
    const loaded = await store.getNorm(norm.meta.slug, missing);
    for (const entry of loaded?.versions ?? []) if (missing.includes(entry.versionId) && entry.body.length > 0) bodies.set(entry.versionId, entry.body);
  }
  for (const { version, previous, key } of pending) {
    const previousBody = bodies.get(previous.versionId);
    const shownBody = bodies.get(version.versionId);
    if (!previousBody || !shownBody) continue;
    const affected = summarizeAffectedUnits({ body: previousBody }, { body: shownBody });
    if (affectedCache.size >= AFFECTED_CACHE_LIMIT) affectedCache.delete(affectedCache.keys().next().value!);
    affectedCache.set(key, affected);
    result.set(version.versionId, { affected, previousVersionId: previous.versionId });
  }
  return result;
}

async function loadChangeMarks(store: NormStore, norm: NormRecord, version: NormVersion): Promise<NormChangeMarkSet | undefined> {
  if (version.body.length === 0) return undefined;
  const loaded = await loadAffectedUnits(store, norm, version);
  return loaded ? { marks: marksFromAffectedUnits(loaded.affected), previousVersionId: loaded.previousVersionId, validFrom: version.validFrom } : undefined;
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
