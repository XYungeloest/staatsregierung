import type { APIRoute } from 'astro';
import { getPublicationLabel, getPublicationSearchAliases } from '@ostrecht/shared/lib/norms/index.ts';

import { getNormStore } from '../../lib/runtime/context.ts';

// Verkündungsliste aus der D1-Projektion.
export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const publications = await getNormStore(locals).listPublications();

  return new Response(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      buildCommit: import.meta.env.PORTAL_BUILD_COMMIT,
      latestPublication: publications[0]
        ? {
            slug: publications[0].slug,
            date: publications[0].date,
            publication: publications[0].publication,
            year: publications[0].year,
            issue: publications[0].issue,
          }
        : null,
      publications: publications.map((publication) => ({
        slug: publication.slug,
        title: publication.title,
        label: getPublicationLabel(publication),
        aliases: getPublicationSearchAliases(publication),
        year: publication.year,
        issue: publication.issue,
        date: publication.date,
        publication: publication.publication,
        pdf: publication.pdf,
        entries: publication.entries,
      })),
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    },
  );
};
