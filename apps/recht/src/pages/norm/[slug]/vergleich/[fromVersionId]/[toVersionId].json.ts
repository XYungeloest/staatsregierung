import type { APIRoute } from 'astro';

import { buildProvisionVersionDiff } from '@ostrecht/shared/lib/norms/diff.ts';
import { getNormUnitKind } from '@ostrecht/shared/lib/norms/units.ts';

import { getNormStore, notFound } from '../../../../../lib/runtime/context.ts';

// Ein Fassungsvergleich wird nur für die tatsächlich angefragte Paarung aus zwei
// D1-Fassungen berechnet; es werden keine n × (n − 1) Paare mehr vorgebaut.
export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const { slug = '', fromVersionId = '', toVersionId = '' } = params;
  if (!slug || !fromVersionId || !toVersionId || fromVersionId === toVersionId) return notFound();
  const store = await getNormStore(locals);
  const norm = await store.getNorm(slug, [fromVersionId, toVersionId]);
  const fromVersion = norm?.versions.find((version) => version.versionId === fromVersionId);
  const toVersion = norm?.versions.find((version) => version.versionId === toVersionId);
  if (!norm || !fromVersion || !toVersion) return notFound();
  const provisions = buildProvisionVersionDiff(fromVersion, toVersion);
  const unitKind = getNormUnitKind([...fromVersion.body, ...toVersion.body]);

  return new Response(JSON.stringify({
    fromVersion: { versionId: fromVersion.versionId, validFrom: fromVersion.validFrom },
    toVersion: { versionId: toVersion.versionId, validFrom: toVersion.validFrom },
    provisions,
    unitKind,
  }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=86400',
    },
  });
};
