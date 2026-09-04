import type { APIRoute } from 'astro';

import { buildSearchVariants, parseQueryTokens } from '@ostrecht/recht-search/search-query.ts';
import type { SearchHitUnit, SearchIndexDocument, SearchPublication } from '@ostrecht/recht-search/search.ts';
import { NORM_ORIGIN_KINDS, type NormOriginKind } from '@ostrecht/shared/lib/norms/origin.ts';
import { EDITORIAL_REFERENCE_DATE } from '@ostrecht/shared/lib/norms/versions.ts';

import { getNormStore } from '../../lib/runtime/context.ts';

/**
 * Suchkandidaten aus der D1-Projektion. Der Server wählt über den FTS5-Index
 * der geltenden Fassungen (Titel, Kurzbezeichnung, Abkürzung, Provisionen)
 * eine begrenzte, nach Relevanz geordnete Kandidatenmenge; die feldbewusste
 * Bewertung, Filterung und Gruppierung erfolgt weiterhin mit derselben Logik
 * wie bisher im Browser (packages/recht-search/search-query.ts). Normtyp
 * (`type`) und Rechtsherkunft (`origin`, nur die vier Werte aus origin.ts;
 * andere werden ignoriert) filtern bereits die Kandidatenwahl in D1, damit
 * `total`, Pagination und Facette den Filter serverseitig berücksichtigen.
 * Für jede Kandidatennorm werden alle Fassungen als Suchdokumente geliefert,
 * die Provisionen jedoch nur für die geltende Fassung und nur, soweit sie zur
 * Anfrage passen.
 */
export const prerender = false;

const CANDIDATE_LIMIT = 120;
const MAX_OFFSET = 5000;

function ftsTerm(value: string): string {
  return `"${value.replace(/"/gu, '""')}"`;
}

/** Herkunftsfilter der Anfrage: nur bekannte Herkunftsarten, ohne Duplikate; Unbekanntes wird ignoriert (fail-safe). */
export function parseOriginFilter(values: string[]): NormOriginKind[] {
  const known = new Set<string>(NORM_ORIGIN_KINDS);
  return [...new Set(values.filter((value) => known.has(value)))] as NormOriginKind[];
}

/**
 * Ausgaben, deren Bezeichnung in der Anfrage vorkommt (OGVBl. 2026 Nr. 73, OVertrBl. 2026 Nr. 4,
 * auch ohne Punkte oder als Langtitel). Der Volltextindex enthält keine Fundstellen; die Normen
 * einer zitierten Ausgabe werden deshalb unabhängig davon Kandidaten (Wortgrenzen, damit
 * „Nr. 4“ nicht „Nr. 40“ trifft).
 */
export function citedPublications(query: string, publications: SearchPublication[]): SearchPublication[] {
  const haystacks = buildSearchVariants(query).filter(Boolean).map((variant) => ` ${variant} `);
  if (haystacks.length === 0) return [];
  return publications.filter((publication) => [publication.designation, ...(publication.aliases ?? [])]
    .flatMap((designation) => buildSearchVariants(designation))
    .some((variant) => variant.length >= 6 && haystacks.some((haystack) => haystack.includes(` ${variant} `))));
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
  const origins = parseOriginFilter(url.searchParams.getAll('origin'));
  const match = buildFtsMatch({ q, exact, citation });

  // Kandidaten über den FTS5-Index, Verkündungsdaten als eine vorberechnete Metadatenzeile;
  // der Normenbestand wird nicht geladen. Zitiert die Anfrage eine Ausgabe, kommen deren Normen
  // (eine law_publications-Zeile je Ausgabe) auf der ersten Seite vor die Volltextkandidaten.
  const [{ slugs: ftsSlugs, total: ftsTotal }, publications] = await Promise.all([
    store.searchCandidates({ match, limit: CANDIDATE_LIMIT, offset, types, origins }),
    store.listSearchPublications(),
  ]);
  const cited = offset === 0 ? citedPublications([q, citation].filter(Boolean).join(' '), publications).slice(0, 3) : [];
  const citedSlugs = (await Promise.all(cited.map((publication) => store.getPublication(publication.slug))))
    .flatMap((publication) => (publication?.entries ?? []).map((entry) => entry.normSlug).filter((slug): slug is string => Boolean(slug)));
  const ftsSet = new Set(ftsSlugs);
  const slugs = [...new Set([...citedSlugs, ...ftsSlugs])].slice(0, CANDIDATE_LIMIT);
  const total = ftsTotal + citedSlugs.filter((slug, index, all) => !ftsSet.has(slug) && all.indexOf(slug) === index).length;
  // Reihenfolge der Kandidaten bewahren (Relevanz bei Suchausdruck, sonst jüngstes Rechtsereignis):
  // getSearchDocuments liefert in Speicherreihenfolge, die Antwort trägt die Kandidatenreihenfolge.
  const candidateRank = new Map(slugs.map((slug, index) => [slug, index]));
  const candidates = (await store.getSearchDocuments(slugs, match ?? undefined))
    .sort((left, right) => (candidateRank.get(left.document.slug) ?? 0) - (candidateRank.get(right.document.slug) ?? 0) || left.document.validFrom.localeCompare(right.document.validFrom));
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
    // Redaktioneller Stichtag der Anzeige: Fassungsbezeichnungen werden erst im Browser gebildet.
    referenceDate: EDITORIAL_REFERENCE_DATE,
    query: { q, exact, citation, types, origins },
    total,
    offset,
    limit: CANDIDATE_LIMIT,
    candidateCount: slugs.length,
    documents,
    publications,
  }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=600',
    },
  });
};
