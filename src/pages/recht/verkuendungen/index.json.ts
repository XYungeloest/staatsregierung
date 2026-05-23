import { getPublicationLabel, loadAllVerkuendungen } from '../../../lib/norms/index.ts';

export const prerender = true;

export async function GET() {
  const publications = await loadAllVerkuendungen();

  return new Response(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
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
