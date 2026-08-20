import type { APIRoute } from 'astro';

import {
  buildStructuralVersionDiff,
  summarizeNormDiff,
} from '../../../../../../lib/norms/diff.ts';
import { loadAllNorms } from '../../../../../../lib/norms/content.ts';

export async function getStaticPaths() {
  const norms = await loadAllNorms();

  return norms.flatMap((norm) => norm.versions.flatMap((fromVersion) =>
    norm.versions
      .filter((toVersion) => toVersion.versionId !== fromVersion.versionId)
      .map((toVersion) => ({
        params: {
          slug: norm.meta.slug,
          fromVersionId: fromVersion.versionId,
          toVersionId: toVersion.versionId,
        },
        props: { fromVersion, toVersion },
      })),
  ));
}

export const GET: APIRoute = ({ props }) => {
  const { fromVersion, toVersion } = props;
  const diff = buildStructuralVersionDiff(fromVersion, toVersion);

  return new Response(JSON.stringify({
    fromVersion: {
      versionId: fromVersion.versionId,
      validFrom: fromVersion.validFrom,
    },
    toVersion: {
      versionId: toVersion.versionId,
      validFrom: toVersion.validFrom,
    },
    summary: summarizeNormDiff(diff),
    diff,
  }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
