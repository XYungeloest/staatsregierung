import { readFileSync } from 'node:fs';

import { expect, type APIRequestContext } from '@playwright/test';

/**
 * Laufzeitdaten des gebauten OstRecht-Workers für Browser- und Barrierefreiheitstests: die Tests
 * leiten Slugs, Titel und Filterwerte aus der Kandidaten-API, den Vorschlägen und dem
 * Verkündungsindex ab, statt konkrete Normen fest zu verdrahten. Sie laufen damit unverändert
 * gegen das Testfixture und den Vollbestand; eine redaktionelle Umbenennung bricht keinen Test.
 * Strukturelle Rollen, die keine API liefert (Tabelle im Normtext, Portalbezüge), stehen als
 * `roles` im Fixture (data/recht/runtime-fixture.json).
 */
export const LAW_ORIGIN = 'http://127.0.0.1:4322';
export const lawUrl = (path: string): string => new URL(path, LAW_ORIGIN).toString();

export interface ApiDocument {
  slug: string;
  versionId: string;
  url: string;
  currentUrl: string;
  isCurrent: boolean;
  versionKind: 'current' | 'historical' | 'future' | 'unknown-effective' | string;
  isAmendment: boolean;
  origin: 'ostdeutsch-original' | 'inherited-unchanged' | 'inherited-amended' | 'origin-unresolved' | string;
  title: string;
  shortTitle: string;
  abbr: string;
  type: string;
  typeLabel: string;
  status: string;
  citation: string;
  publication: string;
  publicationSlug?: string;
  publicationIssue?: string;
  publicationSource?: string;
  validFrom: string;
  validTo: string | null;
  lastChangeDate?: string;
}

export interface ApiPublication {
  slug: string;
  url: string;
  title: string;
  designation: string;
  aliases: string[];
  date: string;
  publication: string;
  year: string;
  issue: string;
}

export interface ApiPayload {
  total: number;
  candidateCount: number;
  documents: ApiDocument[];
  publications: ApiPublication[];
  query: { origins: string[]; [key: string]: unknown };
}

export interface Suggestion {
  slug: string;
  url: string;
  title: string;
  shortTitle: string;
  abbr: string;
  aliases: string[];
  typeLabel: string;
}

/** Redaktioneller Stichtag aus packages/shared/src/config/editorial.json (derselbe wie im Build). */
export function editorialReferenceDate(): string {
  const editorial = JSON.parse(readFileSync(new URL('../../packages/shared/src/config/editorial.json', import.meta.url), 'utf8')) as { referenceDate: string };
  return editorial.referenceDate;
}

const CONNECTION_LOST = /ECONNREFUSED|ECONNRESET|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|ERR_CONNECTION_RESET|socket hang up/u;

/**
 * Der lokale OstRecht-Worker (wrangler dev) startet sich nach einer vom Browser abgebrochenen
 * Antwort neu (scripts/serve-law-worker.mjs); ein Aufruf, der genau in dieses Fenster fällt, wartet
 * auf die Rückkehr des Workers und wird einmal wiederholt. Fachliche Fehler werden nicht wiederholt.
 */
export async function withWorkerRecovery<T>(request: APIRequestContext, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (!CONNECTION_LOST.test(error instanceof Error ? error.message : String(error))) throw error;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const probe = await request.get(lawUrl('/hilfe/'), { timeout: 5000 }).catch(() => null);
      if (probe?.ok()) return await action();
    }
    throw error;
  }
}

export async function searchApi(request: APIRequestContext, query = ''): Promise<ApiPayload> {
  return withWorkerRecovery(request, async () => {
    const response = await request.get(lawUrl(`/api/suche.json${query}`));
    expect(response.ok(), `/api/suche.json${query}`).toBe(true);
    return await response.json() as ApiPayload;
  });
}

export async function suggestions(request: APIRequestContext): Promise<Suggestion[]> {
  return withWorkerRecovery(request, async () => {
    const response = await request.get(lawUrl('/search-suggestions.json'));
    expect(response.ok()).toBe(true);
    return ((await response.json()) as { suggestions: Suggestion[] }).suggestions;
  });
}

export async function publicationIndex(request: APIRequestContext): Promise<{ latestPublication: { slug: string; date: string; publication: string; year: number; issue: string } | null; publications: Array<{ slug: string; label: string; aliases: string[]; issue: string; publication: string; entries: Array<{ normSlug?: string }> }> }> {
  return withWorkerRecovery(request, async () => {
    const response = await request.get(lawUrl('/verkuendungen/index.json'));
    expect(response.ok()).toBe(true);
    return await response.json();
  });
}

/** Geltende Vorschriften (eine je Norm) in der Reihenfolge der Kandidaten-API (jüngstes Rechtsereignis zuerst). */
export async function currentDocuments(request: APIRequestContext, query = ''): Promise<ApiDocument[]> {
  const payload = await searchApi(request, `?versionScope=current${query}`);
  const seen = new Set<string>();
  return payload.documents.filter((document) => document.isCurrent && !seen.has(document.slug) && seen.add(document.slug));
}

/** Norm mit mindestens zwei gespeicherten Fassungen, darunter eine geltende und eine historische. */
export async function multiVersionNorm(request: APIRequestContext): Promise<{ slug: string; current: ApiDocument; historical: ApiDocument }> {
  const payload = await searchApi(request, '?versionScope=all&includeAmendments=1');
  const bySlug = new Map<string, ApiDocument[]>();
  for (const document of payload.documents) bySlug.set(document.slug, [...(bySlug.get(document.slug) ?? []), document]);
  for (const [slug, documents] of bySlug) {
    const current = documents.find((document) => document.versionKind === 'current');
    const historical = documents.find((document) => document.versionKind === 'historical');
    if (current && historical) return { slug, current, historical };
  }
  throw new Error('Kein Kandidat mit geltender und historischer Fassung in der Kandidaten-API');
}

/** Erste geltende Norm der gewünschten Rechtsherkunft. */
export async function currentNormOfOrigin(request: APIRequestContext, origin: string): Promise<ApiDocument> {
  const [document] = await currentDocuments(request, `&origin=${origin}`);
  expect(document, `geltende Norm mit Herkunft ${origin}`).toBeTruthy();
  return document;
}

/** Ein Wort aus einem Titel, das als Suchbegriff taugt (mindestens fünf Buchstaben, kein Funktionswort). */
export function searchWordOf(title: string): string {
  const word = title.split(/[\s,;:()/–-]+/u).find((token) => /^\p{L}{5,}$/u.test(token) && !/^(?:Gesetz|Verordnung|Freistaat|Ostdeutschland|Ostdeutsche[nrs]?|Sächsische[nrs]?|Änderung|Freistaates|Staatsministeriums|Staatsregierung|Verwaltungsvorschrift|Bekanntmachung)$/u.test(token));
  if (!word) throw new Error(`Kein Suchwort im Titel „${title}“`);
  return word;
}

/** Slugs mit einer strukturellen Rolle aus dem Testfixture (auch im Vollbestand enthalten). */
export function fixtureSlugsWithRole(role: string): string[] {
  const fixture = JSON.parse(readFileSync(new URL('../../data/recht/runtime-fixture.json', import.meta.url), 'utf8')) as { slugs: Array<string | { slug: string; roles?: string[] }> };
  return fixture.slugs.flatMap((entry) => (typeof entry === 'object' && entry.roles?.includes(role) ? [entry.slug] : []));
}

/** Datum als deutsche Langform, wie sie die Oberfläche ausgibt („4. September 2026“). */
export function formatGermanDate(isoDate: string): string {
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));
}
