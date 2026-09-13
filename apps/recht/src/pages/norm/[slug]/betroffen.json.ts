import type { APIRoute } from 'astro';

import { formatAffectedUnits } from '@ostrecht/shared/lib/norms/affected-units.ts';
import { toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';

import { describeChangeAgent } from '../../../lib/history-labels.ts';
import { loadAffectedUnitsForVersions, previousVersionOf } from '../../../lib/norm-view.ts';
import { getNormStore, notFound } from '../../../lib/runtime/context.ts';
import type { AffectedVersionEntry } from '../../../lib/unit-history.ts';

/**
 * Betroffene Einheiten je Fassung (REVOSax „Betroffen“): für jede gespeicherte Fassung mit
 * Vorfassung die geänderten, neuen und entfallenen Einheiten samt Bezeichnungen der
 * Änderungsvorschriften, die sie bewirkt haben. Speist die Spalte „Betroffen“ des
 * Änderungsprotokolls und den Verlauf je Einheit im Normtext; die Vergleiche liegen im
 * Worker-Cache (norm-view.ts). `?fassung=<versionId>` beschränkt auf eine Fassung.
 */
export const prerender = false;

export const GET: APIRoute = async ({ params, url, locals }) => {
  const slug = params.slug ?? '';
  if (!slug) return notFound();
  const store = await getNormStore(locals);
  const norm = await store.getNorm(slug, 'none');
  if (!norm) return notFound();
  const requested = url.searchParams.get('fassung');
  const versions = [...norm.versions]
    .sort((left, right) => left.validFrom.localeCompare(right.validFrom))
    .filter((version) => previousVersionOf(norm, version) && (!requested || version.versionId === requested));
  const labels = await store.getNormLabels(norm.history.entries.map((entry) => entry.relatedNorm).filter((entry): entry is string => Boolean(entry)));
  const affectedByVersion = await loadAffectedUnitsForVersions(store, norm, versions);
  const entries: Array<AffectedVersionEntry & { text: string }> = [];
  for (const version of versions) {
    const loaded = affectedByVersion.get(version.versionId);
    if (!loaded) continue;
    const amendments = norm.history.entries
      .filter((entry) => entry.affectingVersionId === version.versionId && entry.type !== 'initial')
      .map((entry) => {
        const label = entry.relatedNorm ? labels.get(entry.relatedNorm) : undefined;
        return toDisplayText(label?.shortTitle || label?.title || '') || describeChangeAgent(entry);
      })
      .filter(Boolean);
    entries.push({
      versionId: version.versionId,
      validFrom: version.validFrom,
      previousVersionId: loaded.previousVersionId,
      amendments,
      changed: loaded.affected.changed.map(({ anchor, label }) => ({ anchor, label })),
      added: loaded.affected.added.map(({ anchor, label }) => ({ anchor, label })),
      removed: loaded.affected.removed,
      text: formatAffectedUnits(loaded.affected),
    });
  }
  return new Response(JSON.stringify({ slug, versions: entries }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=86400',
    },
  });
};
