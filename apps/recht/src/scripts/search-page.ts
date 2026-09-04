import {
  buildSearchCandidateParams,
  buildSearchVariants,
  candidateTotalMatchesResults,
  formatSearchResultLabel,
  getActiveSearchSort,
  getDefaultSearchSort,
  getDetectedNormTypeIntent,
  groupNormSearchResults,
  prepareSearchDocuments,
  removeDetectedTypeIntent,
  runNormSearch,
  type NormSearchState,
  type NormTypeIntent,
  type PreparedSearchDocument,
  type ScoredSearchResult,
  type SearchScope,
  type SortKey,
  type VersionScope,
} from '@ostrecht/recht-search/search-query.ts';
import type { SearchIndexDocument, SearchPublication } from '@ostrecht/recht-search/search.ts';
import { NORM_ORIGIN_KINDS, describeNormOriginKind, formatNormOriginBadge, type NormOriginKind } from '@ostrecht/shared/lib/norms/origin.ts';
import { EDITORIAL_REFERENCE_DATE } from '@ostrecht/shared/lib/norms/versions.ts';

const PAGE_SIZE = 20;
const INPUT_DEBOUNCE_MS = 120;
const root = document.querySelector<HTMLElement>('[data-search-root]');
const form = document.querySelector<HTMLFormElement>('[data-search-form]');
const queryInput = document.querySelector<HTMLInputElement>('[data-search-query]');
const filterInputs = Array.from(
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-search-filter]'),
);
const summary = document.querySelector<HTMLElement>('[data-search-summary]');
const resultsContainer = document.querySelector<HTMLElement>('[data-search-results]');
const moreButton = document.querySelector<HTMLButtonElement>('[data-search-more]');
const activeFilters = document.querySelector<HTMLElement>('[data-search-active-filters]');
const activeFilterList = document.querySelector<HTMLElement>('[data-search-active-list]');
const clearFiltersButton = document.querySelector<HTMLButtonElement>('[data-search-clear-filters]');
const filterPanels = Array.from(document.querySelectorAll<HTMLDetailsElement>('[data-search-filter-panel]'));
const searchApiUrl = root?.dataset.searchApi ?? '';
const REQUEST_DEBOUNCE_MS = 250;
let activeRequest: AbortController | undefined;
let loadedDocuments: PreparedSearchDocument[] = [];
let loadedPublications: SearchPublication[] = [];
// Redaktioneller Stichtag der Anzeige; die Such-API liefert ihn mit jeder Antwort.
let referenceDate = EDITORIAL_REFERENCE_DATE;
let lastTotal = 0;
/** Kandidatenvorschriften, die die Antwort bislang abgedeckt hat (nie mehr als `lastTotal`). */
let checkedCandidates = 0;
let lastQueryKey = '';
let visibleGroups = PAGE_SIZE;
let lastResults: ScoredSearchResult[] = [];
let lastState: NormSearchState | undefined;
let inputTimer: number | undefined;

const FACET_VALUE_GETTERS: Record<string, (entry: SearchIndexDocument) => readonly string[]> = {
  type: (entry) => [entry.type],
  ministry: (entry) => [entry.ministry],
  subject: (entry) => entry.subjects,
  status: (entry) => [entry.status],
  origin: (entry) => [originOf(entry)],
  publicationSource: (entry) => entry.publicationSource ? [entry.publicationSource] : [],
  publicationYear: (entry) => entry.publicationYear ? [entry.publicationYear] : [],
};

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map((entry) => Number.parseInt(entry, 10));
  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

function normalizeScope(value: string): SearchScope {
  return value === 'title' || value === 'metadata' || value === 'body' ? value : 'all';
}

function normalizeVersionScope(value: string): VersionScope {
  return value === 'future'
    || value === 'historical'
    || value === 'unknown-effective'
    || value === 'all'
    ? value
    : 'current';
}

function normalizeSort(value: string): SortKey {
  return value === 'relevance' || value === 'title' || value === 'rechtsstand' || value === 'publication' ? value : 'activity';
}

function formValues(data: FormData, name: string): string[] {
  return [...new Set(data.getAll(name).map(String).map((value) => value.trim()).filter(Boolean))];
}

function sortIsExplicit(): boolean {
  return form?.dataset.searchSortExplicit === 'true';
}

function setSortExplicit(value: boolean): void {
  if (form) form.dataset.searchSortExplicit = String(value);
}

function versionScopeIsExplicit(): boolean {
  return form?.dataset.searchVersionScopeExplicit === 'true';
}

function setVersionScopeExplicit(value: boolean): void {
  if (form) form.dataset.searchVersionScopeExplicit = String(value);
}

function withSort(state: Omit<NormSearchState, 'sort' | 'sortExplicit'>, explicit: boolean, rawSort: string): NormSearchState {
  return {
    ...state,
    sort: explicit ? normalizeSort(rawSort) : getDefaultSearchSort(state),
    sortExplicit: explicit,
  };
}

function emptyState(): NormSearchState {
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

function getFormState(): NormSearchState {
  if (!form) return emptyState();
  const data = new FormData(form);
  return withSort({
    q: String(data.get('q') ?? '').trim(),
    exclude: String(data.get('exclude') ?? '').trim(),
    exact: String(data.get('exact') ?? '').trim(),
    scope: normalizeScope(String(data.get('scope') ?? 'all')),
    types: formValues(data, 'type'),
    ministries: formValues(data, 'ministry'),
    subjects: formValues(data, 'subject'),
    statuses: formValues(data, 'status'),
    origins: formValues(data, 'origin'),
    versionScope: normalizeVersionScope(String(data.get('versionScope') ?? 'current')),
    versionScopeExplicit: versionScopeIsExplicit(),
    includeAmendments: data.get('includeAmendments') === '1',
    geltungstag: String(data.get('geltungstag') ?? ''),
    validFrom: String(data.get('validFrom') ?? ''),
    validTo: String(data.get('validTo') ?? ''),
    citation: String(data.get('citation') ?? '').trim(),
    publicationSources: formValues(data, 'publicationSource'),
    publicationYears: formValues(data, 'publicationYear'),
    publicationIssue: String(data.get('publicationIssue') ?? '').trim(),
    publicationPage: String(data.get('publicationPage') ?? '').trim(),
  }, sortIsExplicit(), String(data.get('sort') ?? 'activity'));
}

function readStateFromUrl(): NormSearchState {
  const params = new URLSearchParams(window.location.search);
  return withSort({
    q: params.get('q') ?? '',
    exclude: params.get('exclude') ?? '',
    exact: params.get('exact') ?? '',
    scope: normalizeScope(params.get('scope') ?? 'all'),
    types: params.getAll('type'),
    ministries: params.getAll('ministry'),
    subjects: params.getAll('subject'),
    statuses: params.getAll('status'),
    // Wie die Such-API: unbekannte Herkunftsarten werden verworfen, nicht als leerer Filter gezählt.
    origins: params.getAll('origin').filter((value) => (NORM_ORIGIN_KINDS as readonly string[]).includes(value)),
    versionScope: normalizeVersionScope(params.get('versionScope') ?? 'current'),
    versionScopeExplicit: params.has('versionScope'),
    includeAmendments: params.get('includeAmendments') === '1',
    geltungstag: params.get('geltungstag') ?? '',
    validFrom: params.get('validFrom') ?? '',
    validTo: params.get('validTo') ?? '',
    citation: params.get('citation') ?? '',
    publicationSources: params.getAll('publicationSource'),
    publicationYears: params.getAll('publicationYear'),
    publicationIssue: params.get('publicationIssue') ?? '',
    publicationPage: params.get('publicationPage') ?? '',
  }, params.has('sort'), params.get('sort') ?? 'activity');
}

function applyStateToForm(state: NormSearchState): void {
  if (!form) return;
  setSortExplicit(state.sortExplicit === true);
  setVersionScopeExplicit(state.versionScopeExplicit === true);
  const values: Record<string, string | string[] | boolean> = {
    q: state.q,
    exclude: state.exclude,
    exact: state.exact,
    scope: state.scope,
    type: state.types,
    ministry: state.ministries,
    subject: state.subjects,
    status: state.statuses,
    origin: state.origins,
    versionScope: state.versionScope,
    includeAmendments: state.includeAmendments,
    geltungstag: state.geltungstag,
    validFrom: state.validFrom,
    validTo: state.validTo,
    citation: state.citation,
    publicationSource: state.publicationSources,
    publicationYear: state.publicationYears,
    publicationIssue: state.publicationIssue,
    publicationPage: state.publicationPage,
    sort: state.sort,
  };
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement) || !element.name) continue;
    const value = values[element.name];
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      element.checked = value === true || (Array.isArray(value) && value.includes(element.value));
    } else if (element instanceof HTMLSelectElement && element.multiple) {
      const selected = Array.isArray(value) ? value : [];
      Array.from(element.options).forEach((option) => {
        option.selected = selected.includes(option.value);
      });
    } else if (element instanceof HTMLSelectElement && Array.isArray(value)) {
      element.value = value[0] ?? '';
    } else if (typeof value === 'string') {
      element.value = value;
    }
  }
}

const filterDefaults: Record<string, string> = {
  scope: 'all',
  versionScope: 'current',
};

const filterLabels: Record<string, string> = {
  scope: 'Suchbereich',
  exclude: 'Ohne Begriff',
  exact: 'Exakte Wortfolge',
  citation: 'Fundstelle',
  type: 'Normtyp',
  ministry: 'Ressort',
  subject: 'Sachgebiet',
  status: 'Status',
  origin: 'Rechtsherkunft',
  versionScope: 'Fassung',
  sort: 'Sortierung',
  includeAmendments: 'Änderungsvorschriften vollständig',
  geltungstag: 'Geltungstag',
  validFrom: 'Gültig ab',
  validTo: 'Gültig bis',
  publicationSource: 'Verkündungsblatt',
  publicationYear: 'Jahr',
  publicationIssue: 'Ausgabennummer',
  publicationPage: 'Seite',
};

interface ActiveFilter {
  name: string;
  value: string;
  label: string;
}

function isActiveFilter(element: HTMLInputElement | HTMLSelectElement): boolean {
  if (element.name === 'q') return false;
  if (element.name === 'sort') return sortIsExplicit();
  if (element instanceof HTMLInputElement && element.type === 'checkbox') return element.checked;
  return Boolean(element.value) && element.value !== filterDefaults[element.name];
}

function filterValueLabel(element: HTMLInputElement | HTMLSelectElement): string {
  if (element instanceof HTMLInputElement && element.type === 'checkbox') {
    return element.dataset.baseLabel
      ?? element.closest('label')?.querySelector<HTMLElement>('[data-search-facet-label]')?.textContent?.trim()
      ?? (element.name === 'includeAmendments' ? 'einbezogen' : element.value);
  }
  if (element instanceof HTMLSelectElement) {
    return element.selectedOptions[0]?.textContent?.trim() ?? element.value;
  }
  return element.value;
}

function collectActiveFilters(elements: Array<HTMLInputElement | HTMLSelectElement> = filterInputs): ActiveFilter[] {
  const seen = new Set<string>();
  return elements.filter(isActiveFilter).flatMap((element) => {
    const key = `${element.name}:${element.value}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      name: element.name,
      value: element.value,
      label: `${filterLabels[element.name] ?? element.name}: ${filterValueLabel(element)}`,
    }];
  });
}

function createFilterChip(label: string, name: string, value: string, intent = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'search-filter-chip';
  button.dataset.searchRemoveFilter = name;
  button.dataset.searchRemoveValue = value;
  if (intent) button.dataset.searchRemoveIntent = 'type';
  button.textContent = `${label} ×`;
  button.setAttribute('aria-label', `${intent ? 'Automatisch erkannten Normtyp entfernen' : 'Filter entfernen'}: ${label}`);
  return button;
}

function updateActiveFilterControls(intent?: NormTypeIntent): void {
  if (!activeFilters || !activeFilterList) return;
  const entries = collectActiveFilters();
  const showIntent = intent && getFormState().types.length === 0;
  activeFilters.hidden = entries.length === 0 && !showIntent;
  activeFilterList.replaceChildren(
    ...entries.map((entry) => createFilterChip(entry.label, entry.name, entry.value)),
    ...(showIntent ? [createFilterChip(`Erkannter Normtyp: ${intent.label}`, 'typeIntent', intent.type, true)] : []),
  );

  for (const panel of filterPanels) {
    const count = collectActiveFilters(Array.from(panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-search-filter]'))).length;
    const countElement = panel.querySelector<HTMLElement>('[data-search-panel-count]');
    if (countElement) countElement.textContent = count > 0 ? `${count} aktiv` : '';
  }
}

function openPanelsWithActiveFilters(): void {
  for (const panel of filterPanels) {
    const entries = Array.from(panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-search-filter]'));
    if (collectActiveFilters(entries).length > 0) panel.open = true;
  }
}

function clearFilter(name: string, value: string): void {
  if (!form) return;
  if (name === 'sort') setSortExplicit(false);
  if (name === 'versionScope') setVersionScopeExplicit(false);
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement) || element.name !== name) continue;
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      if (element.value === value) element.checked = false;
    } else {
      element.value = filterDefaults[name] ?? '';
    }
  }
}

function clearAllFilters(): void {
  setSortExplicit(false);
  setVersionScopeExplicit(false);
  for (const element of filterInputs) {
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      element.checked = false;
    } else {
      element.value = filterDefaults[element.name] ?? '';
    }
  }
}

function appendValues(params: URLSearchParams, key: string, values: string[]): void {
  values.forEach((value) => params.append(key, value));
}

function writeStateToUrl(state: NormSearchState, push = false): void {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.exclude) params.set('exclude', state.exclude);
  if (state.exact) params.set('exact', state.exact);
  if (state.scope !== 'all') params.set('scope', state.scope);
  appendValues(params, 'type', state.types);
  appendValues(params, 'ministry', state.ministries);
  appendValues(params, 'subject', state.subjects);
  appendValues(params, 'status', state.statuses);
  appendValues(params, 'origin', state.origins);
  if (state.versionScopeExplicit || state.versionScope !== 'current') params.set('versionScope', state.versionScope);
  if (state.includeAmendments) params.set('includeAmendments', '1');
  if (state.geltungstag) params.set('geltungstag', state.geltungstag);
  if (state.validFrom) params.set('validFrom', state.validFrom);
  if (state.validTo) params.set('validTo', state.validTo);
  if (state.citation) params.set('citation', state.citation);
  appendValues(params, 'publicationSource', state.publicationSources);
  appendValues(params, 'publicationYear', state.publicationYears);
  if (state.publicationIssue) params.set('publicationIssue', state.publicationIssue);
  if (state.publicationPage) params.set('publicationPage', state.publicationPage);
  if (state.sortExplicit) params.set('sort', state.sort);
  const target = params.size > 0 ? `${window.location.pathname}?${params}` : window.location.pathname;
  window.history[push ? 'pushState' : 'replaceState']({}, '', target);
}

function clipContext(source: string): string {
  const text = source.trim();
  if (text.length <= 280) return text;
  return `${text.slice(0, 277).trimEnd()}…`;
}

function bestHitMarkup(result: ScoredSearchResult): string {
  const unit = result.bestHitUnit;
  if (!unit) return '';
  const label = [unit.label, unit.title].filter(Boolean).join(' ');
  const href = `${result.documentEntry.url}#${unit.anchor}`;
  return `<p class="search-hit__best"><strong>Beste Trefferstelle:</strong> <a class="inline-link" href="${escapeHtml(href)}">${escapeHtml(label || 'Vorschrift öffnen')}</a></p>`;
}

function badgeClass(entry: SearchIndexDocument): string {
  if (entry.versionKind === 'current') return 'status-badge--green';
  if (entry.versionKind === 'future' || entry.versionKind === 'unknown-effective') return 'status-badge--blue';
  return 'status-badge--amber';
}

/**
 * Rechtsherkunft eines Suchdokuments fail-safe lesen. Während eines Rollouts kann ein älterer
 * Worker kurzzeitig neuere Suchdokumente lesen (Expand/Contract, docs/DEPLOYMENT_RUNBOOK.md):
 * ein fehlender oder unbekannter Wert wird als „ungeklärt“ dargestellt, nie als leerer Text.
 */
function originOf(entry: SearchIndexDocument): NormOriginKind {
  return (NORM_ORIGIN_KINDS as readonly string[]).includes(entry.origin) ? entry.origin : 'origin-unresolved';
}

/** Kompakte Metazeile unter dem Titel: Normtyp und Rechtsherkunft (zentrale Semantik aus origin.ts). */
function originBadgeMarkup(entry: SearchIndexDocument): string {
  const origin = originOf(entry);
  return `<span class="origin-badge origin-badge--${escapeHtml(origin)} origin-badge--full" data-origin-kind="${escapeHtml(origin)}" title="${escapeHtml(describeNormOriginKind(origin))}"><span class="origin-badge__dot" aria-hidden="true"></span><span class="origin-badge__label">${escapeHtml(formatNormOriginBadge(origin, 'full'))}</span></span>`;
}

function validityLabel(entry: SearchIndexDocument): string {
  const from = formatDate(entry.validFrom);
  if (entry.validTo) return `${from} bis ${formatDate(entry.validTo)}`;
  if (entry.versionKind === 'historical') return `ab ${from}; Gültigkeitsende nicht gespeichert`;
  if (entry.versionKind === 'unknown-effective') return `veröffentlicht ab ${from}; Inkrafttreten nicht belegt`;
  return `ab ${from}; Gültigkeitsende offen`;
}

function renderVersion(result: ScoredSearchResult, heading = true): string {
  const entry = result.documentEntry;
  const publication = entry.publicationTitle && entry.publicationUrl
    ? `<a class="inline-link" href="${escapeHtml(entry.publicationUrl)}">${escapeHtml(entry.publicationTitle)}</a>`
    : escapeHtml(entry.publication);
  const context = result.bestHitUnit?.text || entry.summary;
  const secondaryTitle = entry.shortTitle && entry.shortTitle !== entry.title
    ? `<p class="search-hit__short-title">${escapeHtml(entry.shortTitle)}</p>`
    : '';
  const identity = heading
    ? `<h3><a class="inline-link" href="${escapeHtml(entry.url)}">${escapeHtml(entry.title)}</a></h3>${secondaryTitle}${entry.abbr ? `<p class="search-hit__abbr">${escapeHtml(entry.abbr)}</p>` : ''}`
    : `<h4><a class="inline-link" href="${escapeHtml(entry.url)}">Fassung vom ${escapeHtml(formatDate(entry.validFrom))}</a></h4>`;
  const metaLine = heading
    ? `<p class="search-hit__meta-line"><span class="law-type-label">${escapeHtml(entry.typeLabel ?? '')}</span><span class="search-hit__meta-separator" aria-hidden="true">·</span>${originBadgeMarkup(entry)}</p>`
    : '';
  return `
    <article class="search-hit">
      <div class="search-hit__header">
        <div class="search-hit__title">
          ${identity}
          ${metaLine}
        </div>
        <span class="status-badge ${badgeClass(entry)}">${escapeHtml(formatSearchResultLabel(entry, referenceDate))}</span>
      </div>
      <p class="search-hit__match" data-search-match-kind="${escapeHtml(result.matchKind)}">${escapeHtml(result.matchLabel)}</p>
      ${bestHitMarkup(result)}
      ${context ? `<p class="search-hit__context">${escapeHtml(clipContext(context))}</p>` : ''}
      ${entry.publication ? `<p class="search-hit__publication"><span>Fundstelle</span> ${publication}</p>` : ''}
      <details class="search-hit__details">
        <summary>Weitere Angaben</summary>
        <dl class="search-hit__facts">
          <div><dt>Vollzitat</dt><dd>${escapeHtml(entry.citation)}</dd></div>
          <div><dt>Gültigkeit</dt><dd>${escapeHtml(validityLabel(entry))}</dd></div>
          <div><dt>Ressort</dt><dd>${escapeHtml(entry.ministry) || 'keine Zuordnung'}</dd></div>
        </dl>
      </details>
      <nav class="search-hit__actions" aria-label="Aktionen für ${escapeHtml(entry.shortTitle || entry.title)}">
        <a href="${escapeHtml(entry.url)}">Öffnen</a>
        ${entry.publicationUrl ? `<a href="${escapeHtml(entry.publicationUrl)}">Fundstelle</a>` : ''}
        <a href="${escapeHtml(`${entry.currentUrl}history/`)}">Änderungen</a>
      </nav>
    </article>
  `;
}

function updateFacetCounts(results: ScoredSearchResult[]): void {
  const countsByFacet = new Map<string, Map<string, number>>(
    Object.keys(FACET_VALUE_GETTERS).map((facet) => [facet, new Map<string, number>()]),
  );
  for (const { documentEntry } of results) {
    for (const [facet, getter] of Object.entries(FACET_VALUE_GETTERS)) {
      const counts = countsByFacet.get(facet);
      if (!counts) continue;
      for (const value of getter(documentEntry)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
  }

  document.querySelectorAll<HTMLInputElement>('[data-search-facet]').forEach((input) => {
    const counts = countsByFacet.get(input.dataset.searchFacet ?? '');
    if (!counts) return;
    const count = counts.get(input.value) ?? 0;
    const countElement = input.closest('label')?.querySelector<HTMLElement>('[data-search-facet-count]');
    if (countElement) countElement.textContent = `(${count})`;
    const label = input.dataset.baseLabel ?? input.value;
    input.setAttribute('aria-label', `${label}, ${count} passende Fassungen in der aktuellen Auswahl`);
  });
}

function findPublicationDirectHit(publications: SearchPublication[], query: string): SearchPublication | undefined {
  const queryForms = buildSearchVariants(query);
  if (queryForms.length === 0) return undefined;
  return publications.find((publication) => [publication.designation, ...publication.aliases]
    .some((designation) => buildSearchVariants(designation).some((value) => queryForms.includes(value))));
}

function renderPublicationDirectHit(publication: SearchPublication | undefined): string {
  if (!publication) return '';
  return `<article class="search-publication-direct-hit">
    <span class="law-type-label">Verkündungsblatt</span>
    <div>
      <h3><a class="inline-link" href="${escapeHtml(publication.url)}">${escapeHtml(publication.designation)}</a></h3>
      <p>${escapeHtml(publication.title)}</p>
    </div>
    <a class="inline-link" href="${escapeHtml(publication.url)}">Ausgabe öffnen</a>
  </article>`;
}

function sortLabel(state: NormSearchState): string {
  const labels: Record<SortKey, string> = {
    activity: 'jüngster Rechtsänderung',
    relevance: 'Relevanz',
    publication: 'neuester Verkündung',
    title: 'Titel A–Z',
    rechtsstand: 'neuestem Rechtsstand',
  };
  return labels[getActiveSearchSort(state)];
}

interface ResultCount {
  /** Angezeigte Vorschriften. */
  shown: number;
  /** Geladene und bewertete Vorschriften mit Treffer. */
  loaded: number;
  /** Gesamtzahl der Treffer, sofern sie feststeht; sonst null. */
  total: number | null;
  /** Bereits bewertete Kandidatenvorschriften; nur Rechengröße, nicht Teil der Anzeigetexte. */
  checked: number;
  /** Noch nicht bewertete Kandidatenvorschriften; entscheidet, ob `total` feststeht. */
  unchecked: number;
}

/**
 * Einzige Stelle, an der Trefferzahl und Nachladezähler entstehen. Überschrift und Nachladeknopf
 * lesen ausschließlich hieraus, damit sie nie zwei verschiedene Mengen beschreiben.
 *
 * Die Gesamtzahl steht fest, wenn entweder alle Kandidaten geladen und bewertet sind (dann ist die
 * geladene Menge die vollständige) oder die Kandidatenabfrage genau dieselbe Menge zählt wie die
 * Anzeige (candidateTotalMatchesResults). Sonst bleibt sie offen und die Oberfläche sagt
 * „mindestens“ – eine falsche Gesamtzahl wird in keinem Fall behauptet.
 */
function countResults(groupCount: number, state: NormSearchState): ResultCount {
  const unchecked = Math.max(0, lastTotal - checkedCandidates);
  const shown = Math.min(visibleGroups, groupCount);
  const total = unchecked === 0
    ? groupCount
    : candidateTotalMatchesResults(state) ? lastTotal : null;
  return { shown, loaded: groupCount, total, checked: checkedCandidates, unchecked };
}

/**
 * Überschrift der Trefferliste. Eine Gesamtzahl steht nur dort, wo sie feststeht; ist sie offen,
 * trägt „mindestens“ die Unvollständigkeit. Die Texte sprechen über Treffer und Vorschriften,
 * nicht über das Abrufverfahren.
 */
function summaryText(count: ResultCount, versionCount: number, state: NormSearchState): string {
  const sorted = `Sortiert nach ${sortLabel(state)}.`;
  if (count.total === null) {
    return count.loaded === 0 ? 'Bisher keine Treffer.' : `Mindestens ${count.loaded} Treffer. ${sorted}`;
  }
  if (count.total === 0) return 'Keine Treffer für die aktuelle Suchanfrage.';
  if (count.total > count.loaded) return `${count.total} Treffer. ${sorted}`;
  const versionLabel = versionCount === 1 ? '1 passende Fassung' : `${versionCount} passende Fassungen`;
  const normLabel = count.loaded === 1 ? 'einer Vorschrift' : `${count.loaded} Vorschriften`;
  return `${count.total} Treffer: ${versionLabel} in ${normLabel}. ${sorted}`;
}

/** Beschriftung des Nachladeknopfs aus derselben Zählung; null verbirgt den Knopf. */
function moreButtonLabel(count: ResultCount): string | null {
  if (count.total !== null) {
    const remaining = count.total - count.shown;
    return remaining > 0 ? `Weitere Treffer laden (${remaining} verbleibend)` : null;
  }
  // Offene Gesamtzahl: erst die schon gefundenen Treffer zeigen, dann weitersuchen.
  return count.shown < count.loaded ? 'Weitere Treffer anzeigen' : 'Weitere Vorschriften durchsuchen';
}

function renderResults(results: ScoredSearchResult[], state: NormSearchState, publication?: SearchPublication): void {
  if (!summary || !resultsContainer || !moreButton) return;
  const groups = groupNormSearchResults(results, state);
  const count = countResults(groups.length, state);
  const visible = groups.slice(0, count.shown);
  const label = moreButtonLabel(count);
  summary.textContent = summaryText(count, results.length, state);
  moreButton.hidden = label === null;
  if (label !== null) moreButton.textContent = label;
  if (groups.length === 0) {
    resultsContainer.innerHTML = renderPublicationDirectHit(publication);
    return;
  }
  resultsContainer.innerHTML = `${renderPublicationDirectHit(publication)}<ol class="record-list search-results__list">${visible.map((group) => {
    const [primary, ...others] = group.entries;
    return `<li class="record-list__item search-result-group">
      ${renderVersion(primary)}
      ${others.length > 0 ? `<details class="search-result-group__versions"><summary>${others.length} weitere passende ${others.length === 1 ? 'Fassung' : 'Fassungen'}</summary>${others.map((entry) => renderVersion(entry, false)).join('')}</details>` : ''}
    </li>`;
  }).join('')}</ol>`;
}

/** Kennung der Kandidatenanfrage: ändert sie sich, muss die Kandidatenmenge neu geladen werden. */
function candidateQueryKey(state: NormSearchState): string {
  return JSON.stringify(buildSearchCandidateParams(state));
}

/**
 * Kandidatenanfrage an /api/suche.json. Alle Filter, die die D1-Projektion trägt, gehen mit,
 * damit `total` dieselbe Menge zählt wie die Trefferliste (buildSearchCandidateParams).
 */
function buildCandidateUrl(state: NormSearchState, offset: number): string {
  const filters = buildSearchCandidateParams(state);
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.exact) params.set('exact', filters.exact);
  if (filters.citation) params.set('citation', filters.citation);
  const lists: Array<[string, string[]]> = [
    ['type', filters.types],
    ['origin', filters.origins],
    ['ministry', filters.ministries],
    ['subject', filters.subjects],
    ['status', filters.statuses],
    ['publicationSource', filters.publicationSources],
    ['publicationYear', filters.publicationYears],
  ];
  for (const [name, values] of lists) for (const value of values) params.append(name, value);
  for (const [name, value] of [['geltungstag', filters.geltungstag], ['validFrom', filters.validFrom], ['validTo', filters.validTo]] as const) {
    if (value) params.set(name, value);
  }
  if (filters.versionScope !== 'all') params.set('versionScope', filters.versionScope);
  params.set('includeAmendments', filters.includeAmendments ? '1' : '0');
  if (offset > 0) params.set('offset', String(offset));
  return `${searchApiUrl}?${params.toString()}`;
}

interface CandidatePayload {
  referenceDate?: string;
  total: number;
  offset: number;
  limit: number;
  documents: SearchIndexDocument[];
  publications: SearchPublication[];
}

/**
 * Lädt die Kandidaten der Anfrage aus der D1-gestützten Such-API. Die
 * feldbewusste Bewertung und Filterung läuft anschließend wie bisher lokal
 * über runNormSearch, jetzt aber nur über die gelieferte Kandidatenmenge.
 */
async function loadCandidates(state: NormSearchState, offset: number, append: boolean): Promise<boolean> {
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  try {
    const response = await fetch(buildCandidateUrl(state, offset), { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as CandidatePayload;
    if (controller.signal.aborted) return false;
    const prepared = prepareSearchDocuments(payload.documents);
    loadedDocuments = append ? [...loadedDocuments, ...prepared] : prepared;
    loadedPublications = payload.publications ?? [];
    if (payload.referenceDate) referenceDate = payload.referenceDate;
    lastTotal = payload.total;
    // Geprüft ist alles bis zum Ende dieser Seite, höchstens aber die Kandidatenmenge selbst.
    checkedCandidates = Math.min(payload.offset + payload.limit, payload.total);
    lastQueryKey = candidateQueryKey(state);
    return true;
  } catch (error) {
    if ((error as Error).name === 'AbortError') return false;
    if (summary) summary.textContent = 'Die Suche konnte nicht geladen werden. Bitte versuchen Sie es erneut.';
    return false;
  }
}

function hasMoreCandidates(): boolean {
  return checkedCandidates < lastTotal;
}

async function setupSearch(): Promise<void> {
  if (!root || !form || !queryInput || !summary || !resultsContainer || !moreButton || !searchApiUrl) return;
  applyStateToForm(readStateFromUrl());

  const evaluate = (state: NormSearchState) => {
    lastResults = runNormSearch(loadedDocuments, state);
    lastState = state;
    updateFacetCounts(lastResults);
    const typeIntent = getDetectedNormTypeIntent(loadedDocuments, state.q);
    updateActiveFilterControls(typeIntent);
    // Zahl und Beschriftung entstehen ausschließlich in renderResults (countResults).
    renderResults(lastResults, state, findPublicationDirectHit(loadedPublications, state.q));
  };

  const run = async (push = false) => {
    const state = getFormState();
    const sortInput = form.querySelector<HTMLSelectElement>('select[name="sort"]');
    if (sortInput && !state.sortExplicit) sortInput.value = state.sort;
    writeStateToUrl(state, push);
    visibleGroups = PAGE_SIZE;
    if (candidateQueryKey(state) !== lastQueryKey || loadedDocuments.length === 0) {
      summary.textContent = 'Treffer werden geladen.';
      if (!(await loadCandidates(state, 0, false))) return;
    }
    evaluate(state);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (inputTimer) window.clearTimeout(inputTimer);
    void run(true);
  });
  for (const input of filterInputs) {
    input.addEventListener('change', () => {
      if (input.name === 'sort') setSortExplicit(true);
      if (input.name === 'versionScope') setVersionScopeExplicit(true);
      void run(true);
    });
  }
  queryInput.addEventListener('input', () => {
    if (inputTimer) window.clearTimeout(inputTimer);
    inputTimer = window.setTimeout(() => void run(false), REQUEST_DEBOUNCE_MS);
  });
  activeFilterList?.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLButtonElement)) return;
    if (event.target.dataset.searchRemoveIntent === 'type') {
      const intent = getDetectedNormTypeIntent(loadedDocuments, queryInput.value);
      if (intent) queryInput.value = removeDetectedTypeIntent(queryInput.value, intent);
      void run(true);
      return;
    }
    const name = event.target.dataset.searchRemoveFilter;
    const value = event.target.dataset.searchRemoveValue;
    if (!name || value === undefined) return;
    clearFilter(name, value);
    void run(true);
  });
  clearFiltersButton?.addEventListener('click', () => {
    clearAllFilters();
    void run(true);
  });
  moreButton.addEventListener('click', () => {
    void (async () => {
      const groups = groupNormSearchResults(lastResults, lastState ?? getFormState());
      if (visibleGroups < groups.length) {
        visibleGroups += PAGE_SIZE;
      } else if (hasMoreCandidates() && lastState) {
        summary.textContent = 'Weitere Treffer werden geladen.';
        if (!(await loadCandidates(lastState, checkedCandidates, true))) return;
        visibleGroups += PAGE_SIZE;
      }
      if (lastState) evaluate(lastState);
    })();
  });
  window.addEventListener('popstate', () => {
    applyStateToForm(readStateFromUrl());
    openPanelsWithActiveFilters();
    void run();
  });
  openPanelsWithActiveFilters();
  void run();
}

void setupSearch();
