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
  return value === 'title' || value === 'rechtsstand' ? value : 'relevance';
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
    sort: 'relevance',
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
    sort: normalizeSort(params.get('sort') ?? 'relevance'),
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
  if (state.sort !== 'relevance') params.set('sort', state.sort);
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
        ${heading ? `<h3><a class="inline-link" href="${escapeHtml(entry.url)}">${escapeHtml(entry.title)}</a></h3>` : `<h4><a class="inline-link" href="${escapeHtml(entry.url)}">Fassung vom ${escapeHtml(formatDate(entry.validFrom))}</a></h4>`}
        <span class="status-badge ${badgeClass(entry)}">${escapeHtml(entry.resultLabel)}</span>
      </div>
      <dl class="search-hit__facts">
        <div><dt>Vollzitat</dt><dd>${escapeHtml(entry.citation)}</dd></div>
        <div><dt>Gültigkeit</dt><dd>${escapeHtml(validityLabel(entry))}</dd></div>
        <div><dt>Normtyp</dt><dd>${escapeHtml(entry.typeLabel)}</dd></div>
        <div><dt>Ressort</dt><dd>${escapeHtml(entry.ministry) || 'keine Zuordnung'}</dd></div>
        ${entry.publication ? `<div><dt>Verkündung</dt><dd>${publication}</dd></div>` : ''}
      </dl>
      ${hitLinks(entry, state)}
      <p class="search-hit__context">${escapeHtml(clipContext(entry, state))}</p>
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
    publicationSource: (entry) => entry.publicationSource ? [entry.publicationSource] : [],
    publicationYear: (entry) => entry.publicationYear ? [entry.publicationYear] : [],
  };
  document.querySelectorAll<HTMLSelectElement>('[data-search-facet]').forEach((select) => {
    const getter = facets[select.dataset.searchFacet ?? ''];
    if (!getter) return;
    const counts = new Map<string, number>();
    results.forEach((entry) => getter(entry).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1)));
    Array.from(select.options).forEach((option) => {
      const label = option.dataset.baseLabel ?? option.textContent ?? option.value;
      option.textContent = `${label} (${counts.get(option.value) ?? 0})`;
    });
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

  const run = (push = false) => {
    const state = getFormState();
    writeStateToUrl(state, push);
    visibleGroups = PAGE_SIZE;
    const scored = runNormSearch(payload.documents, state);
    lastResults = scored.map((entry) => entry.documentEntry);
    lastState = state;
    updateFacetCounts(lastResults);
    renderResults(lastResults, state);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    run(true);
  });
  for (const input of filterInputs) {
    input.addEventListener('change', () => run());
  }
  queryInput.addEventListener('input', () => run());
  moreButton.addEventListener('click', () => {
    visibleGroups += PAGE_SIZE;
    if (lastState) renderResults(lastResults, lastState);
  });
  window.addEventListener('popstate', () => {
    applyStateToForm(readStateFromUrl());
    run();
  });
  run();
}

void setupSearch();
