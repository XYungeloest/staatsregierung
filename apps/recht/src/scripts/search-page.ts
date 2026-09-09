import {
  getActiveSearchSort,
  getDefaultSearchSort,
  removeDetectedTypeIntent,
  SEARCH_FACETS,
  type NormSearchState,
  type SearchFacet,
  type SearchFacetCounts,
  type SearchHit,
  type SearchScope,
  type SortKey,
  type VersionScope,
} from '@ostrecht/recht-search/search-query.ts';
import { getNormTitleBlock } from '@ostrecht/shared/lib/norms/display.ts';
import { NORM_ORIGIN_KINDS, type NormOriginKind } from '@ostrecht/shared/lib/norms/origin.ts';
import { describeNormOriginKind, formatNormOriginBadge } from '@ostrecht/shared/lib/norms/origin-presentation.ts';
import type { NormType } from '@ostrecht/shared/lib/norms/schema.ts';
import { EDITORIAL_REFERENCE_DATE } from '@ostrecht/shared/lib/norms/versions.ts';

import { countNoun } from '../lib/counts.ts';
import { formatShortDate } from '../lib/dates.ts';
import { NORM_HISTORY_LABEL, referenceDateLabel, VALIDITY_FIELD_LABEL, VERSION_FIELD_LABEL, versionKindLabel } from '../lib/vocabulary.ts';

/**
 * Rechtssuche im Browser: Formularzustand, Adresse, Filterchips und Anzeige. Ausgewertet,
 * sortiert und gezählt wird ausschließlich in der Such-API (/api/suche.json); je Suchzustand
 * geht genau eine Anfrage hinaus, das Nachladen holt die nächste Seite über `offset`.
 */
const PAGE_SIZE = 20;
const REQUEST_DEBOUNCE_MS = 250;
/** Fassung des Antwortvertrags; ältere zwischengespeicherte Antworten laufen so nie in diese Seite. */
const API_VERSION = '2';

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
const filterPanels = Array.from(document.querySelectorAll<HTMLDetailsElement>('[data-search-filter-panel]'));
const searchApiUrl = root?.dataset.searchApi ?? '';
const indexUrl = root?.dataset.indexUrl ?? '';
const subjectsUrl = root?.dataset.subjectsUrl ?? '';
const advancedPanel = document.querySelector<HTMLDetailsElement>('[data-search-advanced]');
const filtersSheet = document.querySelector<HTMLDetailsElement>('[data-search-filters]');
/** Anzahl der Zeichen eines Textausschnitts in der Trefferliste. */
const SNIPPET_CHARS = 220;

let activeRequest: AbortController | undefined;
// Redaktioneller Stichtag der Anzeige; die Such-API liefert ihn mit jeder Antwort.
let referenceDate = EDITORIAL_REFERENCE_DATE;
let loadedHits: SearchHit[] = [];
let loadedFacets: SearchFacetCounts | undefined;
let directHit: SearchPageResponse['publicationDirectHit'];
let typeIntent: SearchPageResponse['typeIntent'];
let lastTotal = 0;
let lastRequestKey = '';
let lastState: NormSearchState | undefined;
let inputTimer: number | undefined;

interface SearchPageResponse {
  referenceDate?: string;
  total: number;
  offset: number;
  limit: number;
  hits: SearchHit[];
  facets?: SearchFacetCounts;
  publicationDirectHit?: { slug: string; url: string; designation: string; title: string };
  typeIntent?: { type: string; label: string };
}

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
  status: VALIDITY_FIELD_LABEL,
  origin: 'Rechtsherkunft',
  versionScope: VERSION_FIELD_LABEL,
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
  button.className = 'r-chip search-filter-chip';
  button.dataset.searchRemoveFilter = name;
  button.dataset.searchRemoveValue = value;
  if (intent) button.dataset.searchRemoveIntent = 'type';
  button.textContent = label;
  button.setAttribute('aria-label', `${intent ? 'Automatisch erkannten Normtyp entfernen' : 'Filter entfernen'}: ${label}`);
  return button;
}

function updateActiveFilterControls(): void {
  if (!activeFilters || !activeFilterList) return;
  const entries = collectActiveFilters();
  const showIntent = typeIntent && getFormState().types.length === 0;
  activeFilters.hidden = entries.length === 0 && !showIntent;
  activeFilterList.replaceChildren(
    ...entries.map((entry) => createFilterChip(entry.label, entry.name, entry.value)),
    ...(showIntent && typeIntent ? [createFilterChip(`Erkannter Normtyp: ${typeIntent.label}`, 'typeIntent', typeIntent.type, true)] : []),
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

/**
 * Statusmarke eines Treffers: Geltung der Vorschrift als Wort im Rahmen (Farbe nur unterstützend).
 */
function statusRole(status: string): string {
  if (status === 'in-force') return 'in-force';
  if (status === 'future-effective') return 'future';
  if (status === 'repealed' || status === 'historical') return 'repealed';
  if (status === 'one-time-act') return 'one-time';
  return 'pending';
}

function statusMarkup(hit: SearchHit): string {
  return `<span class="r-status r-status--sm r-status--${statusRole(hit.status)}">${escapeHtml(hit.statusLabel)}</span>`;
}

/** Fassungsangabe eines Treffers: geltend seit, oder Art und Zeitraum einer anderen Fassung. */
function versionText(hit: SearchHit): string {
  if (hit.versionKind === 'current') return `geltende Fassung seit ${formatShortDate(hit.validFrom)}`;
  if (hit.versionKind === 'future') return `${versionKindLabel('future')} ab ${formatShortDate(hit.validFrom)}`;
  if (hit.versionKind === 'historical') return `${versionKindLabel('historical')} ${formatShortDate(hit.validFrom)}${hit.validTo ? ` – ${formatShortDate(hit.validTo)}` : ''}`;
  return versionKindLabel('unknown-effective');
}

/**
 * Rechtsherkunft eines Treffers fail-safe lesen. Während eines Rollouts kann ein älterer
 * Worker kurzzeitig neuere Antworten liefern (Expand/Contract, docs/DEPLOYMENT_RUNBOOK.md):
 * ein fehlender oder unbekannter Wert wird als „ungeklärt“ dargestellt, nie als leerer Text.
 */
function originOf(hit: SearchHit): NormOriginKind {
  return (NORM_ORIGIN_KINDS as readonly string[]).includes(hit.origin) ? hit.origin as NormOriginKind : 'origin-unresolved';
}

/** Herkunft als Textangabe in der Metazeile (Richtung E: kein Abzeichen, ein Wort). */
function originMarkup(origin: NormOriginKind): string {
  return `<span class="r-muted" title="${escapeHtml(describeNormOriginKind(origin))}">${escapeHtml(formatNormOriginBadge(origin, 'full'))}</span>`;
}

function trimSnippet(value: string): string {
  if (value.length <= SNIPPET_CHARS) return value;
  const cut = value.slice(0, SNIPPET_CHARS);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), SNIPPET_CHARS - 30))} …`;
}

/**
 * Trefferstelle: Adresse (§ 12 Abs. 3) links, Ausschnitt in der Serife rechts. Ohne Textstelle
 * nennt die Adresse die Art des Treffers (etwa „Treffer im Titel“).
 */
function placesMarkup(hit: SearchHit): string {
  if (!hit.snippet && !hit.unitAnchor) return '';
  const prefixLabel = [hit.unitLabel, hit.unitTitle].filter(Boolean).join(' ') || hit.matchLabel;
  const prefix = hit.unitAnchor
    ? `<a class="search-hit__place" href="${escapeHtml(`${hit.url}#${hit.unitAnchor}`)}">${escapeHtml(prefixLabel)}</a>`
    : `<span class="search-hit__place r-muted">${escapeHtml(prefixLabel)}</span>`;
  return `<ul class="search-hit__places"><li data-search-match-kind="${escapeHtml(hit.matchKind)}">${prefix}<span class="search-hit__context">${hit.snippet ? escapeHtml(trimSnippet(hit.snippet)) : ''}</span></li></ul>`;
}

/**
 * Ein Treffer (P2): Bezeichnung nach der gemeinsamen Titelregel, Metazeile mit Geltung, Fassung,
 * letzter Rechtsänderung, Fundstelle und Herkunft, darunter die Trefferstelle und die Wege zu den
 * Fassungen. Nicht jede Angabe steht an jedem Treffer.
 */
function renderHit(hit: SearchHit, state: NormSearchState): string {
  const block = getNormTitleBlock({ title: hit.title, shortTitle: hit.shortTitle, abbr: hit.abbr });
  const publication = hit.publicationTitle && hit.publicationUrl
    ? `<a href="${escapeHtml(hit.publicationUrl)}">${escapeHtml(hit.publicationTitle)}</a>`
    : escapeHtml(hit.publication);
  const origin = originOf(hit);
  const ident = [block.abbr, hit.typeLabel].filter(Boolean).join(' · ');
  const meta = [
    statusMarkup(hit),
    `<span>${escapeHtml(versionText(hit))}</span>`,
    hit.lastChangeDate && hit.lastChangeDate !== hit.validFrom ? `<span>zuletzt geändert mit Wirkung vom ${escapeHtml(formatShortDate(hit.lastChangeDate))}</span>` : '',
    hit.publication ? `<span>Fundstelle ${publication}</span>` : '',
    origin !== 'inherited-unchanged' ? originMarkup(origin) : '',
  ].filter(Boolean).join('');
  void state;
  return `
    <article class="search-hit">
      <div class="search-hit__title">
        <h3><a href="${escapeHtml(hit.url)}">${escapeHtml(block.heading)}</a></h3>
        ${ident ? `<span class="search-hit__ident">${escapeHtml(ident)}</span>` : ''}
        ${block.longTitle ? `<span class="search-hit__long r-meta">${escapeHtml(block.longTitle)}</span>` : ''}
      </div>
      <div class="search-hit__meta">${meta}</div>
      ${placesMarkup(hit)}
      <div class="search-hit__links"><a href="${escapeHtml(`${hit.currentUrl}history/`)}">${escapeHtml(NORM_HISTORY_LABEL)}</a>${hit.ministry ? ` · <span class="r-muted">${escapeHtml(hit.ministry)}</span>` : ''}</div>
    </article>
  `;
}

/** Weitere passende Fassungen derselben Vorschrift. */
function otherVersionsMarkup(hit: SearchHit): string {
  if (hit.otherVersions.length === 0) return '';
  const label = countNoun(hit.otherVersions.length, 'Fassung', 'Fassungen');
  return `<details class="search-result-group__versions"><summary>${hit.otherVersions.length} weitere passende ${label}</summary><ul>${hit.otherVersions.map((version) => `
    <li><span class="r-status r-status--sm r-status--${version.versionKind === 'current' ? 'in-force' : version.versionKind === 'historical' ? 'historical' : version.versionKind === 'future' ? 'future' : 'pending'}">${escapeHtml(versionKindLabel(version.versionKind, 'adjective'))}</span><a href="${escapeHtml(version.url)}">Fassung vom ${escapeHtml(formatShortDate(version.validFrom))}</a></li>`).join('')}</ul></details>`;
}

/** Leerzustand (P2): Anfrage zitieren, Auswahl nennen, konkrete Auswege. */
function renderEmptyState(state: NormSearchState): string {
  const active = collectActiveFilters();
  const query = state.q.trim();
  const selection = active.map((entry) => entry.label).join(' · ');
  const ways = [
    active.length > 0 ? `<li><button class="r-link-btn" type="button" data-search-empty-clear>Filter zurücksetzen (${active.length})</button></li>` : '',
    state.versionScope !== 'all' ? `<li><button class="r-link-btn" type="button" data-search-empty-all-versions>Außer Kraft getretene und künftige Fassungen einbeziehen</button></li>` : '',
    indexUrl ? `<li>Im <a href="${escapeHtml(indexUrl)}">Stichwortregister</a> oder über <a href="${escapeHtml(indexUrl)}">A–Z</a> nachsehen.</li>` : '',
    subjectsUrl ? `<li>Über die <a href="${escapeHtml(subjectsUrl)}">Sachgebiete</a> systematisch einsteigen.</li>` : '',
  ].join('');
  const reason = query
    ? `Zu „${escapeHtml(query)}“ passt keine Vorschrift${active.length > 0 ? ` in der aktuellen Auswahl (${escapeHtml(selection)})` : ''}.`
    : `Zur aktuellen Auswahl${active.length > 0 ? ` (${escapeHtml(selection)})` : ''} passt keine Vorschrift.`;
  return `<section class="search-empty" data-search-empty aria-labelledby="search-empty-title">
    <h3 id="search-empty-title">Keine Vorschrift gefunden</h3>
    <p>${reason}</p>
    <ul class="search-empty__ways">${ways}</ul>
  </section>`;
}

/** Facettenzähler aus der Antwort: Zahl passender Vorschriften, Werte ohne Treffer sind inaktiv. */
function updateFacetCounts(): void {
  const groupsWithSelection = new Set(
    Array.from(document.querySelectorAll<HTMLInputElement>('[data-search-facet]:checked')).map((input) => input.dataset.searchFacet ?? ''),
  );
  document.querySelectorAll<HTMLInputElement>('[data-search-facet]').forEach((input) => {
    const facet = input.dataset.searchFacet ?? '';
    if (!(SEARCH_FACETS as readonly string[]).includes(facet)) return;
    const counts = loadedFacets?.[facet as SearchFacet];
    const count = counts?.[input.value] ?? 0;
    const countElement = input.closest('label')?.querySelector<HTMLElement>('[data-search-facet-count]');
    if (countElement) countElement.textContent = counts ? `(${count})` : '';
    const label = input.dataset.baseLabel ?? input.value;
    input.setAttribute('aria-label', counts ? `${label}, ${count} passende Vorschriften in der aktuellen Auswahl` : label);
    // Facetten ohne Treffer sind ausgegraut und nicht anklickbar.
    input.disabled = Boolean(counts) && count === 0 && !input.checked && !groupsWithSelection.has(facet);
    const option = input.closest<HTMLElement>('label');
    option?.classList.toggle('r-check--empty', input.disabled);
    // Lange Facetten (Normtyp, Sachgebiet, Ressort, Reihe, Jahr) zeigen nur belegte Werte; die
    // Geltung bleibt vollständig sichtbar, damit der Standard „in Kraft“ erklärbar bleibt.
    if (option && facet !== 'status' && facet !== 'origin') option.hidden = input.disabled;
  });
}

function renderPublicationDirectHit(): string {
  if (!directHit) return '';
  return `<article class="search-publication-direct-hit">
    <span class="r-label">Ausgabe</span>
    <h3><a href="${escapeHtml(directHit.url)}">${escapeHtml(directHit.designation)}</a></h3>
    <span class="r-muted">${escapeHtml(directHit.title)}</span>
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

/** Überschrift der Trefferliste: die Gesamtzahl steht fest, weil die Suche vollständig zählt. */
function summaryText(state: NormSearchState): string {
  if (lastTotal === 0) return 'Keine Treffer für die aktuelle Suchanfrage.';
  const scope = state.versionScope === 'current' ? 'geltende Fassungen' : state.versionScope === 'all' ? 'alle Fassungen' : versionKindLabel(state.versionScope, 'many');
  return `${lastTotal} Treffer · ${countNoun(lastTotal, 'Vorschrift', 'Vorschriften')} · ${scope} · ${referenceDateLabel(referenceDate)} · sortiert nach ${sortLabel(state)}`;
}

function renderResults(state: NormSearchState): void {
  if (!summary || !resultsContainer || !moreButton) return;
  summary.innerHTML = summaryText(state).replace(/^(\d+ Treffer)/u, '<strong>$1</strong>');
  const remaining = Math.max(0, lastTotal - loadedHits.length);
  moreButton.hidden = remaining === 0;
  if (remaining > 0) moreButton.textContent = `Weitere Treffer laden (${remaining} verbleibend)`;
  if (loadedHits.length === 0) {
    resultsContainer.innerHTML = `${renderPublicationDirectHit()}${renderEmptyState(state)}`;
    return;
  }
  resultsContainer.innerHTML = `${renderPublicationDirectHit()}<ol class="search-results__list">${loadedHits.map((hit) => `<li class="search-result-group">
      ${renderHit(hit, state)}
      ${otherVersionsMarkup(hit)}
    </li>`).join('')}</ol>`;
}

/** Kennung des Suchzustands: ändert sie sich, wird die Trefferliste neu geladen. */
function requestKey(state: NormSearchState): string {
  return JSON.stringify({ ...state, sort: getActiveSearchSort(state), sortExplicit: undefined });
}

/** Anfrageadresse einer Trefferseite. Jeder Bestandteil des Suchzustands geht an den Server. */
function buildRequestUrl(state: NormSearchState, offset: number): string {
  const params = new URLSearchParams();
  params.set('v', API_VERSION);
  if (state.q) params.set('q', state.q);
  if (state.exact) params.set('exact', state.exact);
  if (state.exclude) params.set('exclude', state.exclude);
  if (state.citation) params.set('citation', state.citation);
  if (state.scope !== 'all') params.set('scope', state.scope);
  for (const [name, values] of [
    ['type', state.types],
    ['origin', state.origins],
    ['ministry', state.ministries],
    ['subject', state.subjects],
    ['status', state.statuses],
    ['publicationSource', state.publicationSources],
    ['publicationYear', state.publicationYears],
  ] as Array<[string, string[]]>) for (const value of values) params.append(name, value);
  for (const [name, value] of [
    ['geltungstag', state.geltungstag],
    ['validFrom', state.validFrom],
    ['validTo', state.validTo],
    ['publicationIssue', state.publicationIssue],
    ['publicationPage', state.publicationPage],
  ] as Array<[string, string]>) if (value) params.set(name, value);
  // Nur eine ausdrücklich gewählte Fassungsart geht mit: eine Fundstellensuche darf den
  // stillschweigenden Standard „geltende Fassungen“ auf alle Fassungen anheben.
  if (state.versionScopeExplicit || state.versionScope !== 'current') params.set('versionScope', state.versionScope);
  params.set('includeAmendments', state.includeAmendments ? '1' : '0');
  params.set('sort', getActiveSearchSort(state));
  params.set('limit', String(PAGE_SIZE));
  if (offset > 0) params.set('offset', String(offset));
  else params.set('facets', '1');
  return `${searchApiUrl}?${params.toString()}`;
}

/**
 * Eine Trefferseite laden. Genau eine Anfrage je Suchzustand; `append` hängt die nächste Seite an.
 * Eine Antwort ohne `hits` stammt aus einem älteren Vertrag: sie gilt als Ladefehler und wird
 * einmal ohne Zwischenspeicher wiederholt.
 */
async function loadPage(state: NormSearchState, offset: number, append: boolean): Promise<boolean> {
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  const url = buildRequestUrl(state, offset);
  try {
    let payload = await requestPage(url, controller.signal);
    if (payload && !Array.isArray(payload.hits)) payload = await requestPage(url, controller.signal, true);
    if (controller.signal.aborted) return false;
    if (!payload || !Array.isArray(payload.hits)) throw new Error('Antwort ohne Treffer');
    loadedHits = append ? [...loadedHits, ...payload.hits] : payload.hits;
    if (payload.referenceDate) referenceDate = payload.referenceDate;
    if (!append) {
      loadedFacets = payload.facets;
      directHit = payload.publicationDirectHit;
      typeIntent = payload.typeIntent;
    }
    lastTotal = payload.total;
    lastRequestKey = requestKey(state);
    lastState = state;
    return true;
  } catch (error) {
    if ((error as Error).name === 'AbortError') return false;
    if (summary) summary.textContent = 'Die Suche konnte nicht geladen werden. Bitte versuchen Sie es erneut.';
    return false;
  }
}

async function requestPage(url: string, signal: AbortSignal, retry = false): Promise<SearchPageResponse | null> {
  const response = await fetch(retry ? `${url}&r=1` : url, {
    signal,
    headers: { accept: 'application/json' },
    ...(retry ? { cache: 'reload' as RequestCache } : {}),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as SearchPageResponse;
}

async function setupSearch(): Promise<void> {
  if (!root || !form || !queryInput || !summary || !resultsContainer || !moreButton || !searchApiUrl) return;
  applyStateToForm(readStateFromUrl());

  const run = async (push = false) => {
    const state = getFormState();
    const sortInput = form.querySelector<HTMLSelectElement>('select[name="sort"]');
    if (sortInput && !state.sortExplicit) sortInput.value = state.sort;
    writeStateToUrl(state, push);
    if (requestKey(state) !== lastRequestKey || lastState === undefined) {
      summary.textContent = 'Treffer werden geladen.';
      if (!(await loadPage(state, 0, false))) return;
    }
    updateFacetCounts();
    updateActiveFilterControls();
    renderResults(state);
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
      if (typeIntent) queryInput.value = removeDetectedTypeIntent(queryInput.value, { type: typeIntent.type as NormType, label: typeIntent.label, matchedText: typeIntent.label });
      void run(true);
      return;
    }
    const name = event.target.dataset.searchRemoveFilter;
    const value = event.target.dataset.searchRemoveValue;
    if (!name || value === undefined) return;
    clearFilter(name, value);
    void run(true);
  });
  document.querySelectorAll<HTMLElement>('[data-search-clear-filters], [data-search-reset-link]').forEach((control) => control.addEventListener('click', (event) => {
    event.preventDefault();
    clearAllFilters();
    void run(true);
  }));
  // Auswege des Leerzustands: Filter zurücksetzen oder auf alle Fassungen erweitern.
  resultsContainer.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest('[data-search-empty-clear]')) {
      clearAllFilters();
      void run(true);
    } else if (event.target.closest('[data-search-empty-all-versions]')) {
      const scopeSelect = form.querySelector<HTMLSelectElement>('select[name="versionScope"]');
      if (scopeSelect) scopeSelect.value = 'all';
      setVersionScopeExplicit(true);
      void run(true);
    }
  });
  moreButton.addEventListener('click', () => {
    void (async () => {
      const state = lastState ?? getFormState();
      if (loadedHits.length >= lastTotal) return;
      summary.textContent = 'Weitere Treffer werden geladen.';
      if (!(await loadPage(state, loadedHits.length, true))) return;
      renderResults(state);
    })();
  });
  window.addEventListener('popstate', () => {
    applyStateToForm(readStateFromUrl());
    openPanelsWithActiveFilters();
    void run();
  });
  document.querySelectorAll<HTMLElement>('[data-search-open-advanced]').forEach((link) => link.addEventListener('click', (event) => {
    if (!advancedPanel) return;
    event.preventDefault();
    advancedPanel.open = true;
    advancedPanel.scrollIntoView({ block: 'start' });
    advancedPanel.querySelector<HTMLElement>('input, select, button')?.focus();
  }));
  const initialParams = new URLSearchParams(window.location.search);
  if (advancedPanel && (initialParams.get('filter') === 'erweitert' || window.location.hash === '#erweiterte-suche')) advancedPanel.open = true;
  // Auf kleinen Bildschirmen beginnt die Filterspalte geschlossen; aktive Filter öffnen sie.
  if (filtersSheet && window.matchMedia('(max-width: 48rem)').matches && collectActiveFilters(Array.from(filtersSheet.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-search-filter]'))).length === 0) {
    filtersSheet.open = false;
  }
  openPanelsWithActiveFilters();
  void run();
}

void setupSearch();
