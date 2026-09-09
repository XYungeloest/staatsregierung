import type { NormSearchState } from '@ostrecht/recht-search/search-query.ts';
import type { NormType } from '@ostrecht/shared/lib/norms/schema.ts';

import type { NormStore } from './runtime/store.ts';

/** Leerer Suchzustand der Standardsuche (geltende Fassungen, Grundmenge) für Facettenzählungen. */
export function defaultSearchState(): NormSearchState {
  return {
    q: '',
    exclude: '',
    exact: '',
    scope: 'all',
    types: [],
    ministries: [],
    subjects: [],
    statuses: [],
    origins: [],
    versionScope: 'current',
    versionScopeExplicit: false,
    includeAmendments: false,
    geltungstag: '',
    validFrom: '',
    validTo: '',
    citation: '',
    publicationSources: [],
    publicationYears: [],
    publicationIssue: '',
    publicationPage: '',
    sort: 'activity',
    sortExplicit: false,
  };
}

/** Vorschriften je Normtyp in der Grundmenge (geltende Fassungen) – dieselbe Zählung wie die Suchfacette. */
export async function countNormTypes(store: NormStore): Promise<Partial<Record<NormType, number>>> {
  const facets = await store.countSearchFacets({
    match: null,
    limit: 0,
    offset: 0,
    versionScope: 'current',
    includeAmendments: false,
    state: defaultSearchState(),
  });
  return facets.type as Partial<Record<NormType, number>>;
}
