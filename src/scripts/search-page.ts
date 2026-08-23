import {
  normalizeSearchText,
  parseQueryTokens,
  runNormSearch,
  type NormSearchState,
  type SearchScope,
  type SortKey,
  type VersionScope,
} from '../lib/norms/search-query.ts';
import type { SearchIndexDocument, SearchIndexPayload } from '../lib/norms/search.ts';

const PAGE_SIZE = 20;
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
const includeAmendmentsInput = document.querySelector<HTMLInputElement>('[data-search-filter="includeAmendments"]');
const filterPanels = Array.from(document.querySelectorAll<HTMLDetailsElement>('[data-search-filter-panel]'));
const indexUrl = root?.dataset.indexUrl ?? '';
let visibleGroups = PAGE_SIZE;
let lastResults: SearchIndexDocument[] = [];
let lastState: NormSearchState | undefined;

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
  return value === 'relevance' || value === 'title' || value === 'rechtsstand' ? value : 'publication';
}

function formValues(data: FormData, name: string): string[] {
  return data.getAll(name).map(String).map((value) => value.trim()).filter(Boolean);
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
    includeAmendments: false,
    geltungstag: '',
    validFrom: '',
    validTo: '',
    citation: '',
    publicationSources: [],
    publicationYears: [],
    publicationIssue: '',
    publicationPage: '',
    sort: 'publication',
  };
}

function getFormState(): NormSearchState {
  if (!form) return emptyState();
  const data = new FormData(form);
  return {
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
    includeAmendments: data.get('includeAmendments') === '1',
    geltungstag: String(data.get('geltungstag') ?? ''),
    validFrom: String(data.get('validFrom') ?? ''),
    validTo: String(data.get('validTo') ?? ''),
    citation: String(data.get('citation') ?? '').trim(),
    publicationSources: formValues(data, 'publicationSource'),
    publicationYears: formValues(data, 'publicationYear'),
    publicationIssue: String(data.get('publicationIssue') ?? '').trim(),
    publicationPage: String(data.get('publicationPage') ?? '').trim(),
    sort: normalizeSort(String(data.get('sort') ?? 'relevance')),
  };
}

function readStateFromUrl(): NormSearchState {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get('q') ?? '',
    exclude: params.get('exclude') ?? '',
    exact: params.get('exact') ?? '',
    scope: normalizeScope(params.get('scope') ?? 'all'),
    types: params.getAll('type'),
    ministries: params.getAll('ministry'),
    subjects: params.getAll('subject'),
    statuses: params.getAll('status'),
    origins: params.getAll('origin'),
    versionScope: normalizeVersionScope(params.get('versionScope') ?? 'current'),
    includeAmendments: params.get('includeAmendments') === '1',
    geltungstag: params.get('geltungstag') ?? '',
    validFrom: params.get('validFrom') ?? '',
    validTo: params.get('validTo') ?? '',
    citation: params.get('citation') ?? '',
    publicationSources: params.getAll('publicationSource'),
    publicationYears: params.getAll('publicationYear'),
    publicationIssue: params.get('publicationIssue') ?? '',
    publicationPage: params.get('publicationPage') ?? '',
    sort: normalizeSort(params.get('sort') ?? 'publication'),
  };
}

function applyStateToForm(state: NormSearchState): void {
  if (!form) return;
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
    } else if (typeof value === 'string') {
      element.value = value;
    }
  }
}

const filterDefaults: Record<string, string> = {
  scope: 'all',
  versionScope: 'current',
  sort: 'publication',
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
  includeAmendments: 'Änderungsvorschriften',
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
  return elements.filter(isActiveFilter).map((element) => ({
    name: element.name,
    value: element.value,
    label: `${filterLabels[element.name] ?? element.name}: ${filterValueLabel(element)}`,
  }));
}

function updateActiveFilterControls(): void {
  if (!activeFilters || !activeFilterList) return;
  const entries = collectActiveFilters();
  activeFilters.hidden = entries.length === 0;
  activeFilterList.replaceChildren(...entries.map((entry) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-filter-chip';
    button.dataset.searchRemoveFilter = entry.name;
    button.dataset.searchRemoveValue = entry.value;
    button.textContent = `${entry.label} ×`;
    button.setAttribute('aria-label', `Filter entfernen: ${entry.label}`);
    return button;
  }));

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
  if (state.versionScope !== 'current') params.set('versionScope', state.versionScope);
  if (state.includeAmendments) params.set('includeAmendments', '1');
  if (state.geltungstag) params.set('geltungstag', state.geltungstag);
  if (state.validFrom) params.set('validFrom', state.validFrom);
  if (state.validTo) params.set('validTo', state.validTo);
  if (state.citation) params.set('citation', state.citation);
  appendValues(params, 'publicationSource', state.publicationSources);
  appendValues(params, 'publicationYear', state.publicationYears);
  if (state.publicationIssue) params.set('publicationIssue', state.publicationIssue);
  if (state.publicationPage) params.set('publicationPage', state.publicationPage);
  if (state.sort !== 'publication') params.set('sort', state.sort);
  const target = params.size > 0 ? `${window.location.pathname}?${params}` : window.location.pathname;
  window.history[push ? 'pushState' : 'replaceState']({}, '', target);
}

function clipContext(documentEntry: SearchIndexDocument, state: NormSearchState): string {
  const tokens = parseQueryTokens(state.q || state.exact).map((token) => token.value);
  const candidates = [
    ...documentEntry.hitUnits.map((unit) => unit.text),
    ...documentEntry.contexts,
    documentEntry.summary,
  ].filter(Boolean);
  const source = candidates.find((entry) => {
    const normalized = normalizeSearchText(entry);
    return tokens.some((token) => normalized.includes(token));
  }) ?? candidates[0] ?? '';
  if (source.length <= 260) return source;
  return `${source.slice(0, 257).trimEnd()}…`;
}

function hitLinks(documentEntry: SearchIndexDocument, state: NormSearchState): string {
  const tokens = parseQueryTokens(state.q || state.exact).map((token) => token.value);
  if (tokens.length === 0) return '';
  const units = documentEntry.hitUnits.filter((unit) => {
    const text = normalizeSearchText(`${unit.label} ${unit.title} ${unit.text}`);
    return tokens.some((token) => text.includes(token));
  }).slice(0, 3);
  if (units.length === 0) return '';
  return `<p class="search-hit__meta">Trefferstellen: ${units.map((unit) => {
    const label = escapeHtml([unit.label, unit.title].filter(Boolean).join(' '));
    return `<a class="inline-link" href="${escapeHtml(documentEntry.url)}#${escapeHtml(unit.anchor)}">${label}</a>`;
  }).join('; ')}</p>`;
}

function badgeClass(entry: SearchIndexDocument): string {
  if (entry.versionKind === 'current') return 'status-badge--green';
  if (entry.versionKind === 'future' || entry.versionKind === 'unknown-effective') return 'status-badge--blue';
  return 'status-badge--amber';
}

function validityLabel(entry: SearchIndexDocument): string {
  const from = formatDate(entry.validFrom);
  if (entry.validTo) return `${from} bis ${formatDate(entry.validTo)}`;
  if (entry.versionKind === 'historical') return `ab ${from}; Gültigkeitsende nicht gespeichert`;
  if (entry.versionKind === 'unknown-effective') return `veröffentlicht ab ${from}; Inkrafttreten nicht belegt`;
  return `ab ${from}; Gültigkeitsende offen`;
}

function renderVersion(entry: SearchIndexDocument, state: NormSearchState, heading = true): string {
  const publication = entry.publicationTitle && entry.publicationUrl
    ? `<a class="inline-link" href="${escapeHtml(entry.publicationUrl)}">${escapeHtml(entry.publicationTitle)}</a>`
    : escapeHtml(entry.publication);
  return `
    <article class="search-hit">
      <div class="search-hit__header">
        <div class="search-hit__title">
          <span class="law-type-label">${escapeHtml(entry.typeLabel)}</span>
          ${heading ? `<h3><a class="inline-link" href="${escapeHtml(entry.url)}">${escapeHtml(entry.title)}</a></h3>${entry.abbr ? `<p>${escapeHtml(entry.abbr)}</p>` : ''}` : `<h4><a class="inline-link" href="${escapeHtml(entry.url)}">Fassung vom ${escapeHtml(formatDate(entry.validFrom))}</a></h4>`}
        </div>
        <span class="status-badge ${badgeClass(entry)}">${escapeHtml(entry.resultLabel)}</span>
      </div>
      ${entry.summary ? `<p class="search-hit__summary">${escapeHtml(entry.summary)}</p>` : ''}
      <dl class="search-hit__facts">
        <div><dt>Vollzitat</dt><dd>${escapeHtml(entry.citation)}</dd></div>
        <div><dt>Gültigkeit</dt><dd>${escapeHtml(validityLabel(entry))}</dd></div>
        <div><dt>Normtyp</dt><dd>${escapeHtml(entry.typeLabel)}</dd></div>
        <div><dt>Rechtsherkunft</dt><dd>${escapeHtml(entry.originLabel)}</dd></div>
        <div><dt>Ressort</dt><dd>${escapeHtml(entry.ministry) || 'keine Zuordnung'}</dd></div>
        ${entry.publication ? `<div><dt>Verkündung</dt><dd>${publication}</dd></div>` : ''}
      </dl>
      ${hitLinks(entry, state)}
      <p class="search-hit__context">${escapeHtml(clipContext(entry, state))}</p>
      <nav class="search-hit__actions" aria-label="Aktionen für ${escapeHtml(entry.shortTitle || entry.title)}">
        <a href="${escapeHtml(entry.url)}">Öffnen</a>
        ${entry.publicationUrl ? `<a href="${escapeHtml(entry.publicationUrl)}">Fundstelle</a>` : ''}
        <a href="${escapeHtml(`${entry.currentUrl}history/`)}">Änderungen anzeigen</a>
      </nav>
    </article>
  `;
}

function groupResults(results: SearchIndexDocument[]): Array<{ slug: string; entries: SearchIndexDocument[] }> {
  const groups = new Map<string, SearchIndexDocument[]>();
  for (const result of results) groups.set(result.slug, [...(groups.get(result.slug) ?? []), result]);
  return [...groups.entries()].map(([slug, entries]) => ({ slug, entries }));
}

function updateFacetCounts(results: SearchIndexDocument[]): void {
  const facets: Record<string, (entry: SearchIndexDocument) => string[]> = {
    type: (entry) => [entry.type],
    ministry: (entry) => [entry.ministry],
    subject: (entry) => entry.subjects,
    status: (entry) => [entry.status],
    origin: (entry) => [entry.origin],
    publicationSource: (entry) => entry.publicationSource ? [entry.publicationSource] : [],
    publicationYear: (entry) => entry.publicationYear ? [entry.publicationYear] : [],
  };
  document.querySelectorAll<HTMLInputElement>('[data-search-facet]').forEach((input) => {
    const getter = facets[input.dataset.searchFacet ?? ''];
    if (!getter) return;
    const counts = new Map<string, number>();
    results.forEach((entry) => getter(entry).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1)));
    const count = counts.get(input.value) ?? 0;
    const countElement = input.closest('label')?.querySelector<HTMLElement>('[data-search-facet-count]');
    if (countElement) countElement.textContent = `(${count})`;
  });
}

function renderResults(results: SearchIndexDocument[], state: NormSearchState): void {
  if (!summary || !resultsContainer || !moreButton) return;
  const groups = groupResults(results);
  const visible = groups.slice(0, visibleGroups);
  if (groups.length === 0) {
    summary.textContent = 'Keine Treffer für die aktuelle Suchanfrage.';
    resultsContainer.innerHTML = '';
    moreButton.hidden = true;
    return;
  }
  const versionLabel = results.length === 1 ? '1 passende Fassung' : `${results.length} passende Fassungen`;
  const normLabel = groups.length === 1 ? 'einer Vorschrift' : `${groups.length} Vorschriften`;
  summary.textContent = `${groups.length} Treffer: ${versionLabel} in ${normLabel}.`;
  resultsContainer.innerHTML = `<ol class="record-list search-results__list">${visible.map((group) => {
    const [primary, ...others] = group.entries;
    return `<li class="record-list__item search-result-group">
      ${renderVersion(primary, state)}
      ${others.length > 0 ? `<details class="search-result-group__versions"><summary>${others.length} weitere passende ${others.length === 1 ? 'Fassung' : 'Fassungen'}</summary>${others.map((entry) => renderVersion(entry, state, false)).join('')}</details>` : ''}
    </li>`;
  }).join('')}</ol>`;
  moreButton.hidden = visible.length >= groups.length;
  if (!moreButton.hidden) moreButton.textContent = `Weitere Treffer laden (${groups.length - visible.length} verbleibend)`;
}

async function setupSearch(): Promise<void> {
  if (!root || !form || !queryInput || !summary || !resultsContainer || !moreButton || !indexUrl) return;
  applyStateToForm(readStateFromUrl());
  let payload: SearchIndexPayload;
  try {
    const response = await fetch(indexUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    payload = await response.json() as SearchIndexPayload;
  } catch {
    summary.textContent = 'Der Suchindex konnte nicht geladen werden.';
    return;
  }

  const enableAmendmentsForExactSuggestion = () => {
    if (!includeAmendmentsInput || includeAmendmentsInput.checked) return;
    const query = normalizeSearchText(queryInput.value);
    if (!query) return;
    const selectedAmendment = payload.documents.some((entry) => entry.isAmendment
      && entry.versionKind === 'current'
      && [entry.title, entry.shortTitle, entry.abbr, ...entry.keywords]
        .some((value) => normalizeSearchText(value) === query));
    if (selectedAmendment) includeAmendmentsInput.checked = true;
  };

  const run = (push = false, synchronizeSuggestion = false) => {
    if (synchronizeSuggestion) enableAmendmentsForExactSuggestion();
    const state = getFormState();
    writeStateToUrl(state, push);
    visibleGroups = PAGE_SIZE;
    const scored = runNormSearch(payload.documents, state);
    lastResults = scored.map((entry) => entry.documentEntry);
    lastState = state;
    updateFacetCounts(lastResults);
    updateActiveFilterControls();
    renderResults(lastResults, state);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    run(true, true);
  });
  for (const input of filterInputs) {
    input.addEventListener('change', () => run(true));
  }
  queryInput.addEventListener('input', () => run(false, true));
  activeFilterList?.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLButtonElement)) return;
    const name = event.target.dataset.searchRemoveFilter;
    const value = event.target.dataset.searchRemoveValue;
    if (!name || value === undefined) return;
    clearFilter(name, value);
    run(true);
  });
  clearFiltersButton?.addEventListener('click', () => {
    clearAllFilters();
    run(true);
  });
  moreButton.addEventListener('click', () => {
    visibleGroups += PAGE_SIZE;
    if (lastState) renderResults(lastResults, lastState);
  });
  window.addEventListener('popstate', () => {
    applyStateToForm(readStateFromUrl());
    openPanelsWithActiveFilters();
    run();
  });
  openPanelsWithActiveFilters();
  run();
}

void setupSearch();
