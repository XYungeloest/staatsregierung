import type { APIRoute } from 'astro';

import { buildSearchVariants, parseQueryTokens } from '@ostrecht/recht-search/search-query.ts';
import { buildSearchPublications, type SearchHitUnit, type SearchIndexDocument } from '@ostrecht/recht-search/search.ts';

import { getNormStore } from '../../lib/runtime/context.ts';

/**
 * Suchkandidaten aus der D1-Projektion. Der Server wählt über den FTS5-Index
 * der geltenden Fassungen (Titel, Kurzbezeichnung, Abkürzung, Provisionen)
 * eine begrenzte, nach Relevanz geordnete Kandidatenmenge; die feldbewusste
 * Bewertung, Filterung und Gruppierung erfolgt weiterhin mit derselben Logik
 * wie bisher im Browser (packages/recht-search/search-query.ts). Für jede
 * Kandidatennorm werden alle Fassungen als Suchdokumente geliefert, die
 * Provisionen jedoch nur für die geltende Fassung und nur, soweit sie zur
 * Anfrage passen.
 */
export const prerender = false;

const CANDIDATE_LIMIT = 120;
const MAX_OFFSET = 5000;

function ftsTerm(value: string): string {
  return `"${value.replace(/"/gu, '""')}"`;
}

export function buildFtsMatch({ q, exact, citation }: { q: string; exact: string; citation: string }): string | null {
  const groups: string[] = [];
  for (const token of parseQueryTokens(q)) {
    const variants = [...new Set([token.value, ...token.variants])].filter((variant) => variant.length >= 2);
    if (variants.length === 0) continue;
    groups.push(`(${variants.map((variant) => `${ftsTerm(variant)}*`).join(' OR ')})`);
  }
  for (const phrase of [exact, citation]) {
    const cleaned = phrase.replace(/[^\p{L}\p{N}\s.]/gu, ' ').replace(/\s+/gu, ' ').trim();
    if (!cleaned) continue;
    const variants = [...new Set(buildSearchVariants(cleaned))].filter(Boolean);
    groups.push(`(${variants.map((variant) => ftsTerm(variant)).join(' OR ')})`);
  }
  if (groups.length === 0) return null;
  // Kandidaten großzügig (ODER) sammeln; die Verknüpfungslogik der Anfrage wendet der Client an.
  return groups.join(' OR ');
}

export const GET: APIRoute = async ({ url, locals }) => {
  const store = await getNormStore(locals);
  const q = (url.searchParams.get('q') ?? '').slice(0, 200);
  const exact = (url.searchParams.get('exact') ?? '').slice(0, 200);
  const citation = (url.searchParams.get('citation') ?? '').slice(0, 120);
  const offset = Math.min(Math.max(Number.parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0), MAX_OFFSET);
  const types = url.searchParams.getAll('type').filter((value) => /^[a-z-]+$/u.test(value)).slice(0, 12);
  const match = buildFtsMatch({ q, exact, citation });

  const [{ slugs, total }, publications] = await Promise.all([
    store.searchCandidates({ match, limit: CANDIDATE_LIMIT, offset, types }),
    store.listPublications(),
  ]);
  const candidates = await store.getSearchDocuments(slugs, match ?? undefined);
  const documents: SearchIndexDocument[] = candidates.map(({ document, units }) => ({
    ...document,
    hitUnits: units
      .filter((unit) => unit.blockType !== 'supplement')
      .map((unit): SearchHitUnit => ({
        type: unit.blockType,
        label: unit.label,
        title: unit.heading,
        text: unit.body,
        anchor: unit.anchor,
        ...(unit.references ? { references: unit.references } : {}),
      })),
    bodySupplement: units.find((unit) => unit.blockType === 'supplement')?.body ?? '',
  }));

  return new Response(JSON.stringify({
    generatedAt: new Date().toISOString(),
    query: { q, exact, citation, types },
    total,
    offset,
    limit: CANDIDATE_LIMIT,
    candidateCount: slugs.length,
    documents,
    publications: buildSearchPublications(publications),
  }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=600',
    },
  });
};
