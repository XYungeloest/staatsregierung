import { getPageState } from '@ostrecht/shared/lib/portal/pagination.ts';
import {
  formatHoldingCurrentPercent,
  formatHoldingCurrentStatus,
  formatHoldingCutoffStatus,
  formatHoldingLevel,
  formatHoldingPercent,
  formatHoldingRelation,
  getHoldingStakeBand,
} from '@ostrecht/shared/lib/portal/holdings.ts';
import type { BeteiligungsInventar, BeteiligungsInventarPosition } from '@ostrecht/shared/lib/portal/schema.ts';

type SortKey = 'name' | 'origin' | 'stake' | 'legalForm' | 'status';
type Direction = 'asc' | 'desc';
type View = 'list' | 'tree';

interface HoldingsState {
  q: string;
  origin: string;
  level: string;
  form: string;
  relation: string;
  cutoff: string;
  current: string;
  stake: string;
  sort: SortKey;
  direction: Direction;
  page: number;
  perPage: number;
  view: View;
}

const defaults: HoldingsState = {
  q: '',
  origin: '',
  level: '',
  form: '',
  relation: '',
  cutoff: '',
  current: '',
  stake: '',
  sort: 'name',
  direction: 'asc',
  page: 1,
  perPage: 25,
  view: 'list',
};

const sortKeys = new Set<SortKey>(['name', 'origin', 'stake', 'legalForm', 'status']);
const filterKeys = ['q', 'origin', 'level', 'form', 'relation', 'cutoff', 'current', 'stake'] as const;
const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('de-DE')
    .replace(/\s+/gu, ' ')
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function readPositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readState(): HoldingsState {
  const parameters = new URLSearchParams(window.location.search);
  const sort = parameters.get('sort') as SortKey | null;
  const direction = parameters.get('direction');
  const view = parameters.get('view');
  const perPage = readPositiveInteger(parameters.get('perPage'), defaults.perPage);
  return {
    q: parameters.get('q')?.trim() ?? '',
    origin: parameters.get('origin') ?? '',
    level: parameters.get('level') ?? '',
    form: parameters.get('form') ?? '',
    relation: parameters.get('relation') ?? '',
    cutoff: parameters.get('cutoff') ?? '',
    current: parameters.get('current') ?? '',
    stake: parameters.get('stake') ?? '',
    sort: sort && sortKeys.has(sort) ? sort : defaults.sort,
    direction: direction === 'desc' ? 'desc' : 'asc',
    page: readPositiveInteger(parameters.get('page'), defaults.page),
    perPage: [25, 50, 100].includes(perPage) ? perPage : defaults.perPage,
    view: view === 'tree' ? 'tree' : 'list',
  };
}

function createDetails(position: BeteiligungsInventarPosition): string {
  const items: Array<[string, string]> = [
    ['Herkunft', position.origin],
    ['Ebene', formatHoldingLevel(position.level)],
    ['Rechtsform', position.legalForm],
    ['Beziehung', formatHoldingRelation(position.relation)],
  ];
  if (position.parent) items.push(['Mutterunternehmen', position.parent]);
  if (position.stakePercent !== null) items.push(['Anteil des Herkunftslandes am 1. Dezember 2023', formatHoldingPercent(position.stakePercent)]);
  if (position.effectivePublicPercent !== null) items.push(['Effektiver öffentlicher Anteil', formatHoldingPercent(position.effectivePublicPercent)]);
  if (position.currentStakePercent !== null) items.push(['Heutiger Einzelanteil', formatHoldingPercent(position.currentStakePercent)]);
  if (position.consolidatedInheritedPercent !== null) items.push(['Gebündelte Position am Stichtag', formatHoldingPercent(position.consolidatedInheritedPercent)]);
  if (position.currentConsolidatedPercent !== null) items.push(['Heutige ostdeutsche Gesamtposition', formatHoldingPercent(position.currentConsolidatedPercent)]);
  items.push(['Status am Stichtag', formatHoldingCutoffStatus(position.cutoffStatus)]);
  items.push(['Heutiger Status', formatHoldingCurrentStatus(position.currentStatus)]);
  if (position.change2023To2026) items.push(['Veränderung 2023–2026', position.change2023To2026]);

  return `<details class="holding-position-details"><summary>Details</summary><dl>${items.map(([label, value]) => (
    `<div${label === 'Veränderung 2023–2026' ? ' class="holding-position-details__wide"' : ''}><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
  )).join('')}</dl></details>`;
}

function createTableRow(position: BeteiligungsInventarPosition): string {
  const status = formatHoldingCurrentStatus(position.currentStatus);
  return `<tr>
    <td><strong>${escapeHtml(position.name)}</strong>${createDetails(position)}</td>
    <td>${escapeHtml(position.origin)}</td>
    <td>${escapeHtml(formatHoldingLevel(position.level))}</td>
    <td>${escapeHtml(position.legalForm)}<span>${escapeHtml(formatHoldingRelation(position.relation))}</span></td>
    <td>${escapeHtml(formatHoldingPercent(position.stakePercent))}</td>
    <td>${escapeHtml(formatHoldingCurrentPercent(position))}</td>
    <td><span class="holdings-status holdings-status--${escapeHtml(position.currentStatus)}">${escapeHtml(status)}</span></td>
  </tr>`;
}

function createMobileCard(position: BeteiligungsInventarPosition): string {
  const status = formatHoldingCurrentStatus(position.currentStatus);
  return `<article class="holdings-result-card">
    <div class="holdings-result-card__heading"><h3>${escapeHtml(position.name)}</h3><span class="holdings-status holdings-status--${escapeHtml(position.currentStatus)}">${escapeHtml(status)}</span></div>
    <p>${escapeHtml(position.origin)} · ${escapeHtml(position.legalForm)}</p>
    <dl>
      <div><dt>Ebene</dt><dd>${escapeHtml(formatHoldingLevel(position.level))}</dd></div>
      <div><dt>Anteil 1.12.2023</dt><dd>${escapeHtml(formatHoldingPercent(position.stakePercent))}</dd></div>
      <div><dt>Heute</dt><dd>${escapeHtml(formatHoldingCurrentPercent(position))}</dd></div>
    </dl>
    ${createDetails(position)}
  </article>`;
}

function getSearchText(position: BeteiligungsInventarPosition): string {
  return normalizeSearch([
    position.name,
    position.parent ?? '',
    position.origin,
    position.legalForm,
    position.legalFormGroup,
    formatHoldingRelation(position.relation),
    formatHoldingLevel(position.level),
  ].join(' '));
}

function createTreeNode(
  position: BeteiligungsInventarPosition,
  childrenByParent: Map<string, BeteiligungsInventarPosition[]>,
  visited: Set<string>,
): string {
  if (visited.has(position.key)) return '';
  visited.add(position.key);
  const children = (childrenByParent.get(position.key) ?? [])
    .sort((left, right) => collator.compare(left.name, right.name));
  const summary = `<span><strong>${escapeHtml(position.name)}</strong><small>${escapeHtml(position.legalForm)} · ${escapeHtml(formatHoldingLevel(position.level))}</small></span>`;
  if (children.length === 0) {
    return `<li><div class="holdings-tree-node">${summary}${createDetails(position)}</div></li>`;
  }
  return `<li><details class="holdings-tree-branch"><summary>${summary}<span>${children.length} Unterposition${children.length === 1 ? '' : 'en'}</span></summary>${createDetails(position)}<ul>${children.map((child) => createTreeNode(child, childrenByParent, visited)).join('')}</ul></details></li>`;
}

function createTree(positions: BeteiligungsInventarPosition[]): string {
  if (positions.length === 0) return '<p class="holdings-empty">Für diese Auswahl gibt es keine Konzernstruktur.</p>';
  const byOrigin = new Map<string, BeteiligungsInventarPosition[]>();
  for (const position of positions) {
    byOrigin.set(position.origin, [...(byOrigin.get(position.origin) ?? []), position]);
  }

  return [...byOrigin.entries()]
    .sort(([left], [right]) => collator.compare(left, right))
    .map(([origin, originPositions], originIndex) => {
      const positionByKey = new Map(originPositions.map((position) => [position.key, position]));
      const childrenByParent = new Map<string, BeteiligungsInventarPosition[]>();
      const virtualParents = new Map<string, BeteiligungsInventarPosition[]>();
      const roots: BeteiligungsInventarPosition[] = [];

      for (const position of originPositions) {
        if (position.parentKey && positionByKey.has(position.parentKey)) {
          childrenByParent.set(position.parentKey, [...(childrenByParent.get(position.parentKey) ?? []), position]);
        } else if (position.parent) {
          virtualParents.set(position.parent, [...(virtualParents.get(position.parent) ?? []), position]);
        } else {
          roots.push(position);
        }
      }

      const visited = new Set<string>();
      const rootNodes = roots
        .sort((left, right) => collator.compare(left.name, right.name))
        .map((position) => createTreeNode(position, childrenByParent, visited));
      const virtualNodes = [...virtualParents.entries()]
        .sort(([left], [right]) => collator.compare(left, right))
        .map(([parent, children]) => `<li><details class="holdings-tree-branch holdings-tree-branch--virtual"><summary><span><strong>${escapeHtml(parent)}</strong><small>Belegtes Mutterunternehmen</small></span><span>${children.length} Position${children.length === 1 ? '' : 'en'}</span></summary><ul>${children.sort((left, right) => collator.compare(left.name, right.name)).map((child) => createTreeNode(child, childrenByParent, visited)).join('')}</ul></details></li>`);
      const remaining = originPositions
        .filter((position) => !visited.has(position.key))
        .sort((left, right) => collator.compare(left.name, right.name))
        .map((position) => createTreeNode(position, childrenByParent, visited));

      return `<details class="holdings-tree-origin"${originIndex === 0 ? ' open' : ''}><summary><strong>${escapeHtml(origin)}</strong><span>${originPositions.length} Position${originPositions.length === 1 ? '' : 'en'}</span></summary><ul>${rootNodes.join('')}${virtualNodes.join('')}${remaining.join('')}</ul></details>`;
    })
    .join('');
}

function initializeHoldingsNavigator(root: HTMLElement): void {
  const sourceUrl = root.dataset.sourceUrl;
  if (!sourceUrl) return;

  const requireElement = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Beteiligungsnavigator: Element ${selector} fehlt.`);
    return element;
  };
  const form = requireElement<HTMLFormElement>('[data-holdings-filter-form]');
  const search = requireElement<HTMLInputElement>('[data-holdings-search]');
  const resultCount = requireElement<HTMLElement>('[data-holdings-result-count]');
  const tableBody = requireElement<HTMLTableSectionElement>('[data-holdings-table-body]');
  const mobileResults = requireElement<HTMLElement>('[data-holdings-mobile-results]');
  const activeFilters = requireElement<HTMLElement>('[data-holdings-active-filters]');
  const filterSummary = requireElement<HTMLElement>('[data-holdings-filter-summary]');
  const pagination = requireElement<HTMLElement>('[data-pagination="holdings"]');
  const range = requireElement<HTMLElement>('[data-pagination-range]');
  const paginationTotal = requireElement<HTMLElement>('[data-pagination-total]');
  const pageLabel = requireElement<HTMLElement>('[data-pagination-page]');
  const tree = requireElement<HTMLElement>('[data-holdings-tree]');
  const sortSelect = requireElement<HTMLSelectElement>('[data-holdings-sort-select]');
  const directionButton = requireElement<HTMLButtonElement>('[data-holdings-sort-direction]');
  const pageSize = requireElement<HTMLSelectElement>('[data-holdings-page-size]');
  const filterPanel = root.querySelector<HTMLDetailsElement>('[data-holdings-filter-panel]');

  if (filterPanel && window.matchMedia('(max-width: 47.99rem)').matches) filterPanel.open = false;

  let inventory: BeteiligungsInventar | null = null;
  let state = readState();

  function syncControls(): void {
    search.value = state.q;
    for (const key of filterKeys.slice(1)) {
      const control = form.elements.namedItem(key) as HTMLSelectElement | null;
      if (control) control.value = state[key];
    }
    sortSelect.value = state.sort;
    pageSize.value = String(state.perPage);
    directionButton.value = state.direction;
    directionButton.textContent = state.direction === 'asc' ? 'A–Z' : 'Z–A';
    directionButton.setAttribute('aria-label', `Sortierreihenfolge ${state.direction === 'asc' ? 'aufsteigend' : 'absteigend'}`);

    root.querySelectorAll<HTMLButtonElement>('[data-holdings-view]').forEach((button) => {
      const active = button.dataset.holdingsView === state.view;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    root.querySelectorAll<HTMLElement>('[data-holdings-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.holdingsPanel !== state.view;
    });
    const listControls = root.querySelector<HTMLElement>('[data-holdings-list-controls]');
    if (listControls) listControls.hidden = state.view !== 'list';
  }

  function writeUrl(mode: 'push' | 'replace'): void {
    const url = new URL(window.location.href);
    for (const key of filterKeys) {
      if (state[key]) url.searchParams.set(key, state[key]);
      else url.searchParams.delete(key);
    }
    const optionalDefaults: Array<[string, string, string]> = [
      ['sort', state.sort, defaults.sort],
      ['direction', state.direction, defaults.direction],
      ['page', String(state.page), String(defaults.page)],
      ['perPage', String(state.perPage), String(defaults.perPage)],
      ['view', state.view, defaults.view],
    ];
    for (const [key, value, defaultValue] of optionalDefaults) {
      if (value === defaultValue) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', url);
  }

  function getSelectLabel(key: typeof filterKeys[number], value: string): string {
    if (key === 'q') return `Suche: ${value}`;
    const control = form.elements.namedItem(key) as HTMLSelectElement | null;
    const optionLabel = control?.selectedOptions[0]?.textContent?.replace(/ \(\d+\)$/u, '') ?? value;
    const headings: Record<string, string> = {
      origin: 'Herkunft', level: 'Stufe', form: 'Rechtsform', relation: 'Beziehung',
      cutoff: 'Status 2023', current: 'Status heute', stake: 'Anteil',
    };
    return `${headings[key]}: ${optionLabel}`;
  }

  function renderActiveFilters(): void {
    const entries = filterKeys.filter((key) => Boolean(state[key]));
    activeFilters.hidden = entries.length === 0;
    activeFilters.innerHTML = entries.map((key) => (
      `<button type="button" data-remove-filter="${key}">${escapeHtml(getSelectLabel(key, state[key]))}<span aria-hidden="true">×</span><span class="visually-hidden"> entfernen</span></button>`
    )).join('');
    filterSummary.textContent = entries.length === 0 ? 'Alle Positionen' : `${entries.length} Filter aktiv`;
  }

  function comparePositions(left: BeteiligungsInventarPosition, right: BeteiligungsInventarPosition): number {
    if (state.sort === 'stake') {
      const leftValue = left.stakePercent ?? -1;
      const rightValue = right.stakePercent ?? -1;
      return leftValue - rightValue || collator.compare(left.name, right.name);
    }
    const values: Record<Exclude<SortKey, 'stake'>, [string, string]> = {
      name: [left.name, right.name],
      origin: [left.origin, right.origin],
      legalForm: [left.legalFormGroup, right.legalFormGroup],
      status: [formatHoldingCurrentStatus(left.currentStatus), formatHoldingCurrentStatus(right.currentStatus)],
    };
    const [leftValue, rightValue] = values[state.sort];
    return collator.compare(leftValue, rightValue) || collator.compare(left.name, right.name);
  }

  function getFilteredPositions(): BeteiligungsInventarPosition[] {
    if (!inventory) return [];
    const query = normalizeSearch(state.q);
    return inventory.positions
      .filter((position) => !query || getSearchText(position).includes(query))
      .filter((position) => !state.origin || position.origin === state.origin)
      .filter((position) => !state.level || position.level === state.level)
      .filter((position) => !state.form || position.legalFormGroup === state.form)
      .filter((position) => !state.relation || position.relation === state.relation)
      .filter((position) => !state.cutoff || position.cutoffStatus === state.cutoff)
      .filter((position) => !state.current || position.currentStatus === state.current)
      .filter((position) => !state.stake || getHoldingStakeBand(position.stakePercent) === state.stake)
      .sort((left, right) => (state.direction === 'asc' ? 1 : -1) * comparePositions(left, right));
  }

  function render(): void {
    if (!inventory) return;
    syncControls();
    renderActiveFilters();
    const filtered = getFilteredPositions();
    const pageState = getPageState(filtered.length, state.page, state.perPage);
    state.page = pageState.page;
    const pagePositions = filtered.slice(pageState.start, pageState.end);

    resultCount.textContent = `${filtered.length} von ${inventory.totals.positionRows} Positionen`;
    tableBody.innerHTML = pagePositions.length > 0
      ? pagePositions.map(createTableRow).join('')
      : '<tr><td colspan="7"><p class="holdings-empty">Keine Position entspricht dieser Auswahl.</p></td></tr>';
    mobileResults.innerHTML = pagePositions.length > 0
      ? pagePositions.map(createMobileCard).join('')
      : '<p class="holdings-empty">Keine Position entspricht dieser Auswahl.</p>';
    range.textContent = pageState.rangeLabel;
    pageLabel.textContent = pageState.pageLabel;
    const previous = pagination.querySelector<HTMLButtonElement>('[data-page-action="previous"]');
    const next = pagination.querySelector<HTMLButtonElement>('[data-page-action="next"]');
    if (previous) previous.disabled = !pageState.hasPrevious;
    if (next) next.disabled = !pageState.hasNext;
    paginationTotal.textContent = String(filtered.length);
    tree.innerHTML = createTree(filtered);

    root.querySelectorAll<HTMLTableCellElement>('thead th').forEach((heading) => heading.removeAttribute('aria-sort'));
    const activeSort = root.querySelector<HTMLButtonElement>(`[data-holdings-sort="${state.sort}"]`);
    activeSort?.closest('th')?.setAttribute('aria-sort', state.direction === 'asc' ? 'ascending' : 'descending');
  }

  function updateState(changes: Partial<HoldingsState>, mode: 'push' | 'replace' = 'push'): void {
    state = { ...state, ...changes };
    render();
    writeUrl(mode);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    updateState({ q: search.value.trim(), page: 1 });
  });
  search.addEventListener('input', () => updateState({ q: search.value.trim(), page: 1 }, 'replace'));
  form.addEventListener('change', (event) => {
    const target = event.target as HTMLSelectElement;
    const key = target.dataset.holdingsFilter as keyof HoldingsState | undefined;
    if (key) updateState({ [key]: target.value, page: 1 });
  });
  root.querySelector('[data-holdings-reset]')?.addEventListener('click', () => {
    updateState({ q: '', origin: '', level: '', form: '', relation: '', cutoff: '', current: '', stake: '', page: 1 });
  });
  activeFilters.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove-filter]');
    const key = button?.dataset.removeFilter as keyof HoldingsState | undefined;
    if (key) updateState({ [key]: '', page: 1 });
  });
  root.addEventListener('click', (event) => {
    const sortButton = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-holdings-sort]');
    if (!sortButton) return;
    const sort = sortButton.dataset.holdingsSort as SortKey;
    updateState({ sort, direction: state.sort === sort && state.direction === 'asc' ? 'desc' : 'asc', page: 1 });
  });
  sortSelect.addEventListener('change', () => updateState({ sort: sortSelect.value as SortKey, page: 1 }));
  directionButton.addEventListener('click', () => updateState({ direction: state.direction === 'asc' ? 'desc' : 'asc', page: 1 }));
  pageSize.addEventListener('change', () => updateState({ perPage: Number(pageSize.value), page: 1 }));
  pagination.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-page-action]')?.dataset.pageAction;
    if (action === 'previous') updateState({ page: Math.max(1, state.page - 1) });
    if (action === 'next') updateState({ page: state.page + 1 });
  });

  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-holdings-view]')];
  for (const tab of tabs) {
    tab.addEventListener('click', () => updateState({ view: tab.dataset.holdingsView as View }));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const current = tabs.indexOf(tab);
      const next = event.key === 'ArrowRight' ? (current + 1) % tabs.length : (current - 1 + tabs.length) % tabs.length;
      tabs[next].focus();
      tabs[next].click();
    });
  }

  document.querySelectorAll<HTMLAnchorElement>('[data-holdings-origin-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      state = { ...defaults, origin: link.dataset.origin ?? '' };
      render();
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('origin', state.origin);
      url.hash = 'beteiligungsnavigator';
      window.history.pushState({}, '', url);
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  window.addEventListener('popstate', () => {
    state = readState();
    render();
  });

  syncControls();
  fetch(sourceUrl, { headers: { Accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error(`Datensatz konnte nicht geladen werden (${response.status}).`);
      return response.json() as Promise<BeteiligungsInventar>;
    })
    .then((value) => {
      inventory = value;
      render();
      root.dataset.holdingsReady = 'true';
    })
    .catch(() => {
      resultCount.textContent = 'Die interaktive Inventur konnte nicht geladen werden. Die Downloads bleiben verfügbar.';
    });
}

document.querySelectorAll<HTMLElement>('[data-holdings-root]').forEach(initializeHoldingsNavigator);
