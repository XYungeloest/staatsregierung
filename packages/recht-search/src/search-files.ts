/**
 * Dateibasierte Suchartefakte für Node-Werkzeuge und Tests. Die Funktionen laden
 * den Bestand aus `content/` und liegen bewusst getrennt von `search.ts`, damit
 * das Worker-Bundle von OstRecht keine `node:fs`-Abhängigkeit erhält.
 */
import { loadAllNorms } from '@ostrecht/shared/lib/norms/loader.ts';
import { buildNormRecordLookup } from '@ostrecht/shared/lib/norms/citation.ts';
import { buildNormPublicationReferenceLookup, loadAllVerkuendungen } from '@ostrecht/shared/lib/norms/publications.ts';

import {
  buildFilterOptions,
  buildSearchDocument,
  buildSearchPublications,
  buildSearchSuggestions,
  compareStrings,
  type SearchIndexPayload,
  type SearchSuggestionPayload,
} from './search.ts';

export async function buildSearchSuggestionPayload(): Promise<SearchSuggestionPayload> {
  const records = await loadAllNorms();
  return {
    generatedAt: new Date().toISOString(),
    suggestions: buildSearchSuggestions(records),
  };
}

export async function buildSearchIndexPayload(): Promise<SearchIndexPayload> {
  const [records, publications] = await Promise.all([loadAllNorms(), loadAllVerkuendungen()]);
  const recordsBySlug = buildNormRecordLookup(records);
  const publicationReferences = buildNormPublicationReferenceLookup(publications);
  const documents = records
    .flatMap((record) =>
      record.versions.map((version) =>
        buildSearchDocument(
          record,
          version,
          recordsBySlug,
          publicationReferences.get(`${record.meta.slug}:${version.versionId}`),
        ),
      ),
    )
    .sort((left, right) => {
      if (left.title !== right.title) {
        return left.title.localeCompare(right.title, 'de');
      }

      return right.validFrom.localeCompare(left.validFrom);
    });
  const filters = buildFilterOptions(records);
  filters.publications = [...new Set(documents.map((entry) => entry.publicationSource).filter(Boolean) as string[])].sort(compareStrings);
  filters.years = [...new Set(documents.map((entry) => entry.publicationYear).filter(Boolean) as string[])].sort((left, right) => right.localeCompare(left));

  return {
    generatedAt: new Date().toISOString(),
    buildCommit: import.meta.env?.PORTAL_BUILD_COMMIT ?? process.env.PORTAL_BUILD_COMMIT ?? 'development',
    documentCount: documents.length,
    latestPublication: publications[0]
      ? {
          slug: publications[0].slug,
          date: publications[0].date,
          publication: publications[0].publication,
          year: publications[0].year,
          issue: publications[0].issue,
        }
      : undefined,
    filters,
    documents,
    publications: buildSearchPublications(publications),
  };
}

let searchIndexPayloadOnce: Promise<SearchIndexPayload> | null = null;

/**
 * Einmal je Prozess aufgebauter Suchindex für Tests und Werkzeuge, die den
 * Bestand mehrfach lesen; der Aufbau über den vollen Rechtsbestand dauert
 * spürbar, der Inhalt ändert sich innerhalb eines Laufs nicht.
 */
export function loadSearchIndexPayloadOnce(): Promise<SearchIndexPayload> {
  searchIndexPayloadOnce ??= buildSearchIndexPayload();
  return searchIndexPayloadOnce;
}
