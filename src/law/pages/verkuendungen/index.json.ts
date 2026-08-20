import { getPublicationLabel, loadAllVerkuendungen } from '../../../lib/norms/index.ts';

export const prerender = true;

export async function GET() {
  const publications = await loadAllVerkuendungen();

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
      },
    },
  );
}
