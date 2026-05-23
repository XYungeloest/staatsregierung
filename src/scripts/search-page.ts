type SearchScope = 'all' | 'title' | 'metadata' | 'body';
type VersionScope = 'all' | 'current' | 'historical';
type SortKey = 'relevance' | 'title' | 'rechtsstand';

interface SearchState {
  q: string;
  exclude: string;
  exact: string;
  scope: SearchScope;
  type: string;
  ministry: string;
  subject: string;
  status: string;
  versionScope: VersionScope;
  geltungstag: string;
  validFrom: string;
  validTo: string;
  citation: string;
  sort: SortKey;
}

interface SearchHitUnit {
  type: string;
  label: string;
  title: string;
  text: string;
  anchor: string;
}

interface SearchDocument {
  id: string;
  slug: string;
  versionId: string;
  url: string;
  currentUrl: string;
  isCurrent: boolean;
  title: string;
  shortTitle: string;
  abbr: string;
  type: string;
  typeLabel: string;
  ministry: string;
  subjects: string[];
  keywords: string[];
  status: string;
  statusLabel: string;
  summary: string;
  initialCitation: string;
  citation: string;
  publication: string;
  publicationSlug?: string;
  publicationUrl?: string;
  publicationTitle?: string;
  publicationDate?: string;
  publicationIssue?: string;
  publicationEntryTitle?: string;
  changeNote: string;
  validFrom: string;
  validTo: string | null;
  bodyText: string;
  contexts: string[];
  hitUnits: SearchHitUnit[];
  resultLabel: string;
}

interface SearchPayload {
  documents: SearchDocument[];
}

interface SearchResultEntry {
  documentEntry: SearchDocument;
  score: number;
}

const root = document.querySelector<HTMLElement>('[data-search-root]');
const form = document.querySelector<HTMLFormElement>('[data-search-form]');
const queryInput = document.querySelector<HTMLInputElement>('[data-search-query]');
const filterInputs = Array.from(
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-search-filter]'),
);
const summary = document.querySelector<HTMLElement>('[data-search-summary]');
const resultsContainer = document.querySelector<HTMLElement>('[data-search-results]');
const indexUrl = root?.dataset.indexUrl ?? '';
const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function splitTokens(value: string): string[] {
  const normalized = normalizeSearchText(value);
  return normalized ? [...new Set(normalized.split(' '))] : [];
}

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

function getEmptyState(): SearchState {
  return {
    q: '',
    exclude: '',
    exact: '',
    scope: 'all',
    type: '',
    ministry: '',
    subject: '',
    status: '',
    versionScope: 'all',
    geltungstag: '',
    validFrom: '',
    validTo: '',
    citation: '',
    sort: 'relevance',
  };
}

function normalizeScope(value: string): SearchScope {
  return value === 'title' || value === 'metadata' || value === 'body' ? value : 'all';
}

function normalizeVersionScope(value: string): VersionScope {
  return value === 'current' || value === 'historical' ? value : 'all';
}

function normalizeSortKey(value: string): SortKey {
  return value === 'title' || value === 'rechtsstand' ? value : 'relevance';
}

function getFormState(): SearchState {
  if (!form) {
    return getEmptyState();
  }

  const formData = new FormData(form);
  return {
    q: String(formData.get('q') ?? '').trim(),
    exclude: String(formData.get('exclude') ?? '').trim(),
    exact: String(formData.get('exact') ?? '').trim(),
    scope: normalizeScope(String(formData.get('scope') ?? 'all')),
    type: String(formData.get('type') ?? '').trim(),
    ministry: String(formData.get('ministry') ?? '').trim(),
    subject: String(formData.get('subject') ?? '').trim(),
    status: String(formData.get('status') ?? '').trim(),
    versionScope: normalizeVersionScope(String(formData.get('versionScope') ?? 'all')),
    geltungstag: String(formData.get('geltungstag') ?? '').trim(),
    validFrom: String(formData.get('validFrom') ?? '').trim(),
    validTo: String(formData.get('validTo') ?? '').trim(),
    citation: String(formData.get('citation') ?? '').trim(),
    sort: normalizeSortKey(String(formData.get('sort') ?? 'relevance')),
  };
}

function applyStateToForm(state: SearchState): void {
  if (!(queryInput instanceof HTMLInputElement)) {
    return;
  }

  queryInput.value = state.q;

  for (const input of filterInputs) {
    const key = input.name as keyof SearchState;
    input.value = state[key] ?? '';
  }
}

function readStateFromUrl(): SearchState {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get('q') ?? '',
    exclude: params.get('exclude') ?? '',
    exact: params.get('exact') ?? '',
    scope: normalizeScope(params.get('scope') ?? 'all'),
    type: params.get('type') ?? '',
    ministry: params.get('ministry') ?? '',
    subject: params.get('subject') ?? '',
    status: params.get('status') ?? '',
    versionScope: normalizeVersionScope(params.get('versionScope') ?? 'all'),
    geltungstag: params.get('geltungstag') ?? '',
    validFrom: params.get('validFrom') ?? '',
    validTo: params.get('validTo') ?? '',
    citation: params.get('citation') ?? '',
    sort: normalizeSortKey(params.get('sort') ?? 'relevance'),
  };
}

function writeStateToUrl(state: SearchState): void {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(state) as Array<[keyof SearchState, string]>) {
    if (
      value &&
      !(key === 'scope' && value === 'all') &&
      !(key === 'versionScope' && value === 'all') &&
      !(key === 'sort' && value === 'relevance')
    ) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  const target = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, '', target);
}

function getNormalizedFields(documentEntry: SearchDocument): Record<SearchScope, string> {
  const title = normalizeSearchText(
    [documentEntry.title, documentEntry.shortTitle, documentEntry.abbr].join(' '),
  );
  const metadata = normalizeSearchText(
    [
      documentEntry.typeLabel,
      documentEntry.ministry,
      ...documentEntry.subjects,
      ...documentEntry.keywords,
      documentEntry.statusLabel,
      documentEntry.summary,
      documentEntry.initialCitation,
      documentEntry.citation,
      documentEntry.publication,
      documentEntry.publicationTitle,
      documentEntry.publicationDate,
      documentEntry.publicationIssue,
      documentEntry.publicationEntryTitle,
      documentEntry.changeNote,
    ].join(' '),
  );
  const body = normalizeSearchText(documentEntry.bodyText);

  return {
    all: `${title} ${metadata} ${body}`.trim(),
    title,
    metadata,
    body,
  };
}

function clipContext(text: string, tokens: string[]): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  if (tokens.length === 0 && trimmed.length <= 240) {
    return trimmed;
  }

  const normalized = normalizeSearchText(trimmed);
  let index = -1;

  for (const token of tokens) {
    index = normalized.indexOf(token);
    if (index >= 0) {
      break;
    }
  }

  if (index < 0) {
    return trimmed.length > 240 ? `${trimmed.slice(0, 237).trimEnd()}...` : trimmed;
  }

  const start = Math.max(0, index - 80);
  const end = Math.min(trimmed.length, start + 240);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < trimmed.length ? '...' : '';

  return `${prefix}${trimmed.slice(start, end).trim()}${suffix}`;
}

function buildContext(documentEntry: SearchDocument, tokens: string[]): string {
  const contexts = [
    ...documentEntry.hitUnits.map((unit) => unit.text),
    ...documentEntry.contexts,
    documentEntry.summary,
    documentEntry.changeNote,
    documentEntry.citation,
  ].filter(Boolean);

  if (tokens.length === 0) {
    return clipContext(contexts[0] ?? documentEntry.summary, []);
  }

  for (const context of contexts) {
    const normalized = normalizeSearchText(context);
    if (tokens.every((token) => normalized.includes(token)) || tokens.some((token) => normalized.includes(token))) {
      return clipContext(context, tokens);
    }
  }

  return clipContext(documentEntry.summary || documentEntry.bodyText, tokens);
}

function findHitUnits(documentEntry: SearchDocument, tokens: string[]): SearchHitUnit[] {
  if (tokens.length === 0) {
    return [];
  }

  return documentEntry.hitUnits
    .filter((unit) => {
      const normalized = normalizeSearchText(`${unit.label} ${unit.title} ${unit.text}`);
      return tokens.some((token) => normalized.includes(token));
    })
    .slice(0, 3);
}

function isDateInRange(date: string, start: string, end: string | null): boolean {
  return start <= date && (!end || date <= end);
}

function matchesFilters(documentEntry: SearchDocument, state: SearchState): boolean {
  if (state.type && documentEntry.type !== state.type) {
    return false;
  }

  if (state.ministry && documentEntry.ministry !== state.ministry) {
    return false;
  }

  if (state.subject && !documentEntry.subjects.includes(state.subject)) {
    return false;
  }

  if (state.status && documentEntry.status !== state.status) {
    return false;
  }

  if (state.versionScope === 'current' && !documentEntry.isCurrent) {
    return false;
  }

  if (state.versionScope === 'historical' && documentEntry.isCurrent) {
    return false;
  }

  if (state.geltungstag && !isDateInRange(state.geltungstag, documentEntry.validFrom, documentEntry.validTo)) {
    return false;
  }

  if (state.validFrom && documentEntry.validTo && documentEntry.validTo < state.validFrom) {
    return false;
  }

  if (state.validTo && documentEntry.validFrom > state.validTo) {
    return false;
  }

  if (state.citation) {
    const citation = normalizeSearchText(
      [
        documentEntry.citation,
        documentEntry.initialCitation,
        documentEntry.publication,
        documentEntry.publicationTitle,
        documentEntry.publicationDate,
        documentEntry.publicationIssue,
        documentEntry.publicationEntryTitle,
      ].join(' '),
    );
    if (!splitTokens(state.citation).every((token) => citation.includes(token))) {
      return false;
    }
  }

  return true;
}

function scoreDocument(
  documentEntry: SearchDocument,
  state: SearchState,
  normalizedQuery: string,
  tokens: string[],
): number {
  const fields = getNormalizedFields(documentEntry);
  const searchable = fields[state.scope];

  if (normalizedQuery && !tokens.every((token) => searchable.includes(token))) {
    return -1;
  }

  const exact = normalizeSearchText(state.exact);
  if (exact && !searchable.includes(exact)) {
    return -1;
  }

  const excludedTokens = splitTokens(state.exclude);
  if (excludedTokens.some((token) => fields.all.includes(token))) {
    return -1;
  }

  let score = 0;

  for (const token of tokens) {
    if (normalizeSearchText(documentEntry.abbr).includes(token)) {
      score += 18;
    }

    if (fields.title.includes(token)) {
      score += 14;
    }

    if (fields.metadata.includes(token)) {
      score += 6;
    }

    if (fields.body.includes(token)) {
      score += 2;
    }
  }

  if (normalizedQuery) {
    if (fields.title.includes(normalizedQuery)) {
      score += 18;
    }

    if (fields.metadata.includes(normalizedQuery)) {
      score += 8;
    }

    if (fields.body.includes(normalizedQuery)) {
      score += 4;
    }
  }

  if (documentEntry.isCurrent) {
    score += 2;
  }

  return score;
}

function getResultBadgeClass(result: SearchDocument): string {
  if (result.status === 'repealed') {
    return 'status-badge--amber';
  }

  if (result.status === 'planned') {
    return 'status-badge--blue';
  }

  return result.isCurrent ? 'status-badge--green' : 'status-badge--blue';
}

function compareResults(left: SearchResultEntry, right: SearchResultEntry, state: SearchState): number {
  if (state.sort === 'title') {
    if (left.documentEntry.title !== right.documentEntry.title) {
      return left.documentEntry.title.localeCompare(right.documentEntry.title, 'de');
    }

    return right.documentEntry.validFrom.localeCompare(left.documentEntry.validFrom);
  }

  if (state.sort === 'rechtsstand') {
    if (left.documentEntry.validFrom !== right.documentEntry.validFrom) {
      return right.documentEntry.validFrom.localeCompare(left.documentEntry.validFrom);
    }

    return left.documentEntry.title.localeCompare(right.documentEntry.title, 'de');
  }

  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (left.documentEntry.title !== right.documentEntry.title) {
    return left.documentEntry.title.localeCompare(right.documentEntry.title, 'de');
  }

  return right.documentEntry.validFrom.localeCompare(left.documentEntry.validFrom);
}

function renderResults(results: SearchDocument[], state: SearchState): void {
  if (!summary || !resultsContainer) {
    return;
  }

  const hasQuery = Boolean(state.q.trim() || state.exact.trim() || state.exclude.trim());
  const hasFilters = Boolean(
    state.type ||
      state.ministry ||
      state.subject ||
      state.status ||
      state.versionScope !== 'all' ||
      state.geltungstag ||
      state.validFrom ||
      state.validTo ||
      state.citation ||
      state.sort !== 'relevance',
  );

  if (!hasQuery && !hasFilters) {
    summary.textContent = 'Bitte geben Sie einen Suchbegriff ein oder wählen Sie mindestens einen Filter.';
    resultsContainer.innerHTML = '';
    return;
  }

  if (results.length === 0) {
    summary.textContent = 'Keine Treffer für die aktuelle Suchanfrage.';
    resultsContainer.innerHTML = '';
    return;
  }

  const label = results.length === 1 ? '1 Treffer' : `${results.length} Treffer`;
  summary.textContent = `${label} gefunden.`;

  resultsContainer.innerHTML = `
    <ol class="record-list search-results__list">
      ${results
        .map((result) => {
          const tokens = splitTokens(state.q || state.exact);
          const context = buildContext(result, tokens);
          const hitUnits = findHitUnits(result, tokens);
          const validFromLabel = formatDate(result.validFrom);
          const validUntilLabel = result.validTo ? formatDate(result.validTo) : 'aktuell';
          const publicationLabel = result.publicationTitle
            ? `${result.publicationTitle}${result.publicationDate ? `, ${formatDate(result.publicationDate)}` : ''}`
            : result.publication;
          const publicationMarkup =
            publicationLabel && result.publicationUrl
              ? `<a class="inline-link" href="${escapeHtml(result.publicationUrl)}">${escapeHtml(publicationLabel)}</a>`
              : escapeHtml(publicationLabel);

          return `
            <li class="record-list__item search-hit">
              <div class="search-hit__header">
                <h3><a class="inline-link" href="${result.url}">${escapeHtml(result.title)}</a></h3>
                <span class="status-badge ${getResultBadgeClass(result)}">${escapeHtml(result.resultLabel)} · ${escapeHtml(result.statusLabel)}</span>
              </div>
              <dl class="search-hit__facts">
                <div><dt>Fundstelle</dt><dd>${escapeHtml(result.citation)}</dd></div>
                <div><dt>Gültigkeit</dt><dd>${escapeHtml(validFromLabel)} bis ${escapeHtml(validUntilLabel)}</dd></div>
                <div><dt>Normtyp</dt><dd>${escapeHtml(result.typeLabel)}</dd></div>
                <div><dt>Ressort</dt><dd>${escapeHtml(result.ministry)}</dd></div>
                ${
                  publicationLabel
                    ? `<div><dt>Verkündung</dt><dd>${publicationMarkup}</dd></div>`
                    : ''
                }
              </dl>
              <p class="search-hit__meta">
                Status: ${escapeHtml(result.statusLabel)} | Sachgebiete: ${escapeHtml(result.subjects.join(', ')) || 'keine Zuordnung'}
              </p>
              ${
                hitUnits.length > 0
                  ? `<p class="search-hit__meta">Trefferstellen: ${hitUnits
                      .map((unit) => {
                        const label = escapeHtml([unit.label, unit.title].filter(Boolean).join(' '));
                        const href = unit.anchor ? `${result.url}#${escapeHtml(unit.anchor)}` : result.url;
                        return `<a class="inline-link" href="${href}">${label}</a>`;
                      })
                      .join('; ')}</p>`
                  : ''
              }
              ${
                result.isCurrent
                  ? ''
                  : `<p class="search-hit__meta"><a class="inline-link" href="${result.currentUrl}">Aktuelle Fassung öffnen</a></p>`
              }
              <p class="search-hit__context">${escapeHtml(context)}</p>
            </li>
          `;
        })
        .join('')}
    </ol>
  `;
}

async function setupSearch(): Promise<void> {
  if (!root || !form || !queryInput || !summary || !resultsContainer || !indexUrl) {
    return;
  }

  const initialState = readStateFromUrl();
  applyStateToForm(initialState);

  let payload: SearchPayload;

  try {
    const response = await fetch(indexUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    payload = (await response.json()) as SearchPayload;
  } catch (error) {
    summary.textContent = 'Der Suchindex konnte nicht geladen werden.';
    resultsContainer.innerHTML = '';
    return;
  }

  const runSearch = () => {
    const state = getFormState();
    writeStateToUrl(state);

    const normalizedQuery = normalizeSearchText(state.q);
    const tokens = splitTokens(state.q);

    const results = payload.documents
      .filter((documentEntry) => matchesFilters(documentEntry, state))
      .map((documentEntry): SearchResultEntry => ({
        documentEntry,
        score: scoreDocument(documentEntry, state, normalizedQuery, tokens),
      }))
      .filter((entry: SearchResultEntry) => (normalizedQuery || state.exact || state.exclude ? entry.score >= 0 : true))
      .sort((left: SearchResultEntry, right: SearchResultEntry) => compareResults(left, right, state))
      .map((entry: SearchResultEntry) => entry.documentEntry);

    renderResults(results, state);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runSearch();
  });

  queryInput.addEventListener('input', runSearch);
  for (const input of filterInputs) {
    input.addEventListener('input', runSearch);
    input.addEventListener('change', runSearch);
  }

  window.addEventListener('popstate', () => {
    const state = readStateFromUrl();
    applyStateToForm(state);
    runSearch();
  });

  runSearch();
}

void setupSearch();
