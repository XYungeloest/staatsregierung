interface SearchState {
  q: string;
  type: string;
  ministry: string;
  subject: string;
  status: string;
}

interface SearchDocument {
  id: string;
  slug: string;
  versionId: string;
  url: string;
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
  changeNote: string;
  validFrom: string;
  validTo: string | null;
  bodyText: string;
  contexts: string[];
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
const filterInputs = Array.from(document.querySelectorAll<HTMLSelectElement>('[data-search-filter]'));
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
  return { q: '', type: '', ministry: '', subject: '', status: '' };
}

function getFormState(): SearchState {
  if (!form) {
    return getEmptyState();
  }

  const formData = new FormData(form);
  return {
    q: String(formData.get('q') ?? '').trim(),
    type: String(formData.get('type') ?? '').trim(),
    ministry: String(formData.get('ministry') ?? '').trim(),
    subject: String(formData.get('subject') ?? '').trim(),
    status: String(formData.get('status') ?? '').trim(),
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
    type: params.get('type') ?? '',
    ministry: params.get('ministry') ?? '',
    subject: params.get('subject') ?? '',
    status: params.get('status') ?? '',
  };
}

function writeStateToUrl(state: SearchState): void {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(state) as Array<[keyof SearchState, string]>) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  const target = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, '', target);
}

function clipContext(text: string, tokens: string[]): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  if (tokens.length === 0 && trimmed.length <= 220) {
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
    return trimmed.length > 220 ? `${trimmed.slice(0, 217).trimEnd()}...` : trimmed;
  }

  const start = Math.max(0, index - 70);
  const end = Math.min(trimmed.length, start + 220);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < trimmed.length ? '...' : '';

  return `${prefix}${trimmed.slice(start, end).trim()}${suffix}`;
}

function buildContext(documentEntry: SearchDocument, tokens: string[]): string {
  const contexts = [
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

  return true;
}

function scoreDocument(
  documentEntry: SearchDocument,
  normalizedQuery: string,
  tokens: string[],
): number {
  const fields = {
    title: normalizeSearchText(documentEntry.title),
    shortTitle: normalizeSearchText(documentEntry.shortTitle),
    abbr: normalizeSearchText(documentEntry.abbr),
    metadata: normalizeSearchText(
      [
        documentEntry.typeLabel,
        documentEntry.ministry,
        ...documentEntry.subjects,
        ...documentEntry.keywords,
        documentEntry.statusLabel,
        documentEntry.summary,
        documentEntry.initialCitation,
        documentEntry.citation,
        documentEntry.changeNote,
      ].join(' '),
    ),
    body: normalizeSearchText(documentEntry.bodyText),
  };

  const combined = `${fields.title} ${fields.shortTitle} ${fields.abbr} ${fields.metadata} ${fields.body}`.trim();

  if (normalizedQuery && !tokens.every((token) => combined.includes(token))) {
    return -1;
  }

  let score = 0;

  for (const token of tokens) {
    if (fields.abbr.includes(token)) {
      score += 18;
    }

    if (fields.title.includes(token)) {
      score += 14;
    }

    if (fields.shortTitle.includes(token)) {
      score += 11;
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

    if (fields.shortTitle.includes(normalizedQuery)) {
      score += 12;
    }

    if (fields.metadata.includes(normalizedQuery)) {
      score += 8;
    }

    if (fields.body.includes(normalizedQuery)) {
      score += 4;
    }
  }

  if (documentEntry.isCurrent) {
    score += 1;
  }

  return score;
}

function renderResults(results: SearchDocument[], state: SearchState): void {
  if (!summary || !resultsContainer) {
    return;
  }

  const hasQuery = Boolean(state.q.trim());
  const hasFilters = Boolean(state.type || state.ministry || state.subject || state.status);

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
          const context = buildContext(result, splitTokens(state.q));
          const validFromLabel = formatDate(result.validFrom);
          const validUntilLabel = result.validTo ? formatDate(result.validTo) : 'heute';

          return `
            <li class="record-list__item search-hit">
              <div class="search-hit__header">
                <h3><a class="inline-link" href="${result.url}">${escapeHtml(result.title)}</a></h3>
                <span>${escapeHtml(result.resultLabel)}</span>
              </div>
              <p class="search-hit__meta">
                ${escapeHtml(result.typeLabel)} | ${escapeHtml(result.abbr)} | ${escapeHtml(result.ministry)}
              </p>
              <p class="search-hit__meta">
                Rechtsstand ${escapeHtml(validFromLabel)} bis ${escapeHtml(validUntilLabel)} | Status: ${escapeHtml(result.statusLabel)}
              </p>
              <p class="search-hit__meta">
                Sachgebiete: ${escapeHtml(result.subjects.join(', ')) || 'keine Zuordnung'}
              </p>
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
        score: scoreDocument(documentEntry, normalizedQuery, tokens),
      }))
      .filter((entry: SearchResultEntry) => (normalizedQuery ? entry.score >= 0 : true))
      .sort((left: SearchResultEntry, right: SearchResultEntry) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (left.documentEntry.title !== right.documentEntry.title) {
          return left.documentEntry.title.localeCompare(right.documentEntry.title, 'de');
        }

        return right.documentEntry.validFrom.localeCompare(left.documentEntry.validFrom);
      })
      .map((entry: SearchResultEntry) => entry.documentEntry);

    renderResults(results, state);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runSearch();
  });

  queryInput.addEventListener('input', runSearch);
  for (const input of filterInputs) {
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
