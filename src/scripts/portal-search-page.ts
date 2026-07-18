export {};

interface PortalSearchEntry {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  description: string;
  url: string;
  text: string;
  date?: string;
}

interface PortalSearchPayload {
  entries: PortalSearchEntry[];
}

const PAGE_SIZE = 20;
const root = document.querySelector<HTMLElement>('[data-portal-search-root]');

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/ß/gu, 'ss');
}

function escapeHtml(value: string): string {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}

function highlight(value: string, terms: string[]): string {
  if (terms.length === 0) return escapeHtml(value);

  return value
    .split(/(\s+)/u)
    .map((part) => {
      const escaped = escapeHtml(part);
      return terms.some((term) => normalize(part).includes(term)) ? `<mark>${escaped}</mark>` : escaped;
    })
    .join('');
}

function scoreEntry(entry: PortalSearchEntry, terms: string[], query: string): number {
  const title = normalize(entry.title);
  const description = normalize(entry.description);
  const text = normalize(entry.text);
  const normalizedQuery = normalize(query);
  let score = 0;

  if (normalizedQuery && title === normalizedQuery) score += 80;
  else if (normalizedQuery && title.startsWith(normalizedQuery)) score += 35;

  for (const term of terms) {
    if (title === term) score += 30;
    else if (title.startsWith(term)) score += 18;
    else if (title.includes(term)) score += 12;
    if (description.includes(term)) score += 6;
    if (text.includes(term)) score += 2;
  }

  return score;
}

function hasSearchIntent(query: string, type: string): boolean {
  return Boolean(query.trim() || type);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(new Date(`${date}T12:00:00`));
}

if (root) {
  const form = root.querySelector<HTMLFormElement>('[data-portal-search-form]');
  const queryInput = root.querySelector<HTMLInputElement>('[data-portal-search-query]');
  const typeSelect = root.querySelector<HTMLSelectElement>('[data-portal-search-type]');
  const sortSelect = root.querySelector<HTMLSelectElement>('[data-portal-search-sort]');
  const statusNode = root.querySelector<HTMLElement>('[data-portal-search-status]');
  const resultNode = root.querySelector<HTMLElement>('[data-portal-search-results]');
  const emptyNode = root.querySelector<HTMLElement>('[data-portal-search-empty]');
  const errorNode = root.querySelector<HTMLElement>('[data-portal-search-error]');
  const examplesNode = root.querySelector<HTMLElement>('[data-portal-search-examples]');
  const moreWrap = root.querySelector<HTMLElement>('[data-portal-search-more-wrap]');
  const moreButton = root.querySelector<HTMLButtonElement>('[data-portal-search-more]');
  const indexUrl = root.dataset.indexUrl ?? '/search-index.json';
  const params = new URLSearchParams(window.location.search);
  let visibleCount = PAGE_SIZE;

  if (queryInput) queryInput.value = params.get('q') ?? '';
  if (typeSelect) typeSelect.value = params.get('type') ?? '';
  if (sortSelect && params.get('sort') === 'latest') sortSelect.value = 'latest';

  const initialQuery = queryInput?.value ?? '';
  const initialType = typeSelect?.value ?? '';
  if (hasSearchIntent(initialQuery, initialType) && statusNode) {
    statusNode.textContent = 'Suche läuft …';
    if (examplesNode) examplesNode.hidden = true;
  }

  fetch(indexUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Search index could not be loaded (${response.status})`);
      return (await response.json()) as PortalSearchPayload;
    })
    .then((payload) => {
      const entries = payload.entries;

      const update = (resetVisibleCount = true) => {
        const query = queryInput?.value.trim() ?? '';
        const type = typeSelect?.value ?? '';
        const sort = sortSelect?.value === 'latest' ? 'latest' : 'relevance';
        const terms = normalize(query).split(/\s+/u).filter(Boolean);
        const searching = hasSearchIntent(query, type);
        if (resetVisibleCount) visibleCount = PAGE_SIZE;

        if (!searching) {
          if (statusNode) statusNode.textContent = 'Wonach suchen Sie? Geben Sie einen Begriff ein, zum Beispiel Kreisreform, Haushalt, Kabinett, Kultur, Gesetz oder Bezirk.';
          if (emptyNode) emptyNode.hidden = true;
          if (errorNode) errorNode.hidden = true;
          if (examplesNode) examplesNode.hidden = false;
          if (moreWrap) moreWrap.hidden = true;
          if (resultNode) resultNode.innerHTML = '';
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }

        const matches = entries
          .map((entry) => ({ entry, score: terms.length > 0 ? scoreEntry(entry, terms, query) : 1 }))
          .filter(({ entry, score }) => (!type || entry.type === type) && score > 0)
          .sort((left, right) => {
            if (sort === 'latest') {
              const byDate = (right.entry.date ?? '').localeCompare(left.entry.date ?? '');
              if (byDate !== 0) return byDate;
            }
            return right.score - left.score || left.entry.title.localeCompare(right.entry.title, 'de');
          });
        const visibleMatches = matches.slice(0, visibleCount);

        if (examplesNode) examplesNode.hidden = true;
        if (errorNode) errorNode.hidden = true;
        if (emptyNode) emptyNode.hidden = matches.length > 0;
        if (moreWrap) moreWrap.hidden = visibleMatches.length >= matches.length;
        if (statusNode) {
          const searchContext = query || typeSelect?.selectedOptions[0]?.textContent || 'den gewählten Bereich';
          statusNode.textContent = matches.length === 0
            ? `Keine Treffer für „${searchContext}“`
            : `${matches.length} Treffer für „${searchContext}“; ${visibleMatches.length} werden angezeigt.`;
        }
        if (resultNode) {
          resultNode.innerHTML = visibleMatches
            .map(({ entry }) => `
              <li class="record-list__item search-hit">
                <div class="search-hit__header">
                  <h3><a class="inline-link" href="${escapeHtml(entry.url)}">${highlight(entry.title, terms)}</a></h3>
                  <span class="tag">${escapeHtml(entry.typeLabel)}</span>
                </div>
                <p class="search-hit__context">${highlight(entry.description, terms)}</p>
                ${entry.date ? `<p class="search-hit__meta"><time datetime="${escapeHtml(entry.date)}">${formatDate(entry.date)}</time></p>` : ''}
              </li>`)
            .join('');
        }

        const nextParams = new URLSearchParams();
        if (query) nextParams.set('q', query);
        if (type) nextParams.set('type', type);
        if (sort === 'latest') nextParams.set('sort', 'latest');
        const nextSearch = nextParams.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
      };

      form?.addEventListener('submit', (event) => {
        event.preventDefault();
        update();
      });
      queryInput?.addEventListener('input', () => update());
      typeSelect?.addEventListener('change', () => update());
      sortSelect?.addEventListener('change', () => update());
      moreButton?.addEventListener('click', () => {
        visibleCount += PAGE_SIZE;
        update(false);
      });
      update();
    })
    .catch(() => {
      if (statusNode) statusNode.textContent = 'Die Suche ist derzeit nicht erreichbar. Nutzen Sie vorübergehend die Bereiche Recht, Themen, Presse und Service.';
      if (errorNode) errorNode.hidden = false;
      if (emptyNode) emptyNode.hidden = true;
      if (examplesNode) examplesNode.hidden = true;
      if (moreWrap) moreWrap.hidden = true;
      if (resultNode) resultNode.innerHTML = '';
    });
}
