export {};

interface PortalSearchEntry {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  description: string;
  url: string;
  text: string;
}

interface PortalSearchPayload {
  entries: PortalSearchEntry[];
}

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

function scoreEntry(entry: PortalSearchEntry, terms: string[]): number {
  const title = normalize(entry.title);
  const description = normalize(entry.description);
  const text = normalize(entry.text);
  let score = 0;

  for (const term of terms) {
    if (title.includes(term)) score += 12;
    if (description.includes(term)) score += 6;
    if (text.includes(term)) score += 2;
  }

  return score;
}

function hasSearchIntent(query: string, type: string): boolean {
  return Boolean(query.trim() || type);
}

if (root) {
  const form = root.querySelector<HTMLFormElement>('[data-portal-search-form]');
  const queryInput = root.querySelector<HTMLInputElement>('[data-portal-search-query]');
  const typeSelect = root.querySelector<HTMLSelectElement>('[data-portal-search-type]');
  const statusNode = root.querySelector<HTMLElement>('[data-portal-search-status]');
  const resultNode = root.querySelector<HTMLElement>('[data-portal-search-results]');
  const emptyNode = root.querySelector<HTMLElement>('[data-portal-search-empty]');
  const errorNode = root.querySelector<HTMLElement>('[data-portal-search-error]');
  const examplesNode = root.querySelector<HTMLElement>('[data-portal-search-examples]');
  const indexUrl = root.dataset.indexUrl ?? '/search-index.json';
  const params = new URLSearchParams(window.location.search);

  if (queryInput) queryInput.value = params.get('q') ?? '';
  if (typeSelect) typeSelect.value = params.get('type') ?? '';

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

      const update = () => {
        const query = queryInput?.value.trim() ?? '';
        const type = typeSelect?.value ?? '';
        const terms = normalize(query).split(/\s+/u).filter(Boolean);
        const searching = hasSearchIntent(query, type);

        if (!searching) {
          if (statusNode) {
            statusNode.textContent = 'Wonach suchen Sie? Geben Sie einen Begriff ein, zum Beispiel Kreisreform, Haushalt, Kabinett, Kultur, Gesetz oder Bezirk.';
          }
          if (emptyNode) emptyNode.hidden = true;
          if (errorNode) errorNode.hidden = true;
          if (examplesNode) examplesNode.hidden = false;
          if (resultNode) resultNode.innerHTML = '';
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }

        const matches = entries
          .map((entry) => ({ entry, score: terms.length > 0 ? scoreEntry(entry, terms) : 1 }))
          .filter(({ entry, score }) => (!type || entry.type === type) && score > 0)
          .sort((left, right) => right.score - left.score || left.entry.title.localeCompare(right.entry.title, 'de'))
          .slice(0, 50);

        if (examplesNode) examplesNode.hidden = true;
        if (errorNode) errorNode.hidden = true;
        if (statusNode) {
          const searchContext = query || typeSelect?.selectedOptions[0]?.textContent || 'den gewählten Bereich';
          statusNode.textContent = matches.length === 0
            ? 'Keine Treffer gefunden. Prüfen Sie die Schreibweise oder suchen Sie in einem anderen Bereich.'
            : `${matches.length} Treffer für „${searchContext}“`;
        }
        if (emptyNode) emptyNode.hidden = true;
        if (resultNode) {
          resultNode.innerHTML = matches
            .map(
              ({ entry }) => `
                <li class="record-list__item search-hit">
                  <div class="search-hit__header">
                    <h3><a class="inline-link" href="${entry.url}">${escapeHtml(entry.title)}</a></h3>
                    <span class="tag">${escapeHtml(entry.typeLabel)}</span>
                  </div>
                  <p class="search-hit__context">${escapeHtml(entry.description)}</p>
                </li>`,
            )
            .join('');
        }

        const nextParams = new URLSearchParams();
        if (query) nextParams.set('q', query);
        if (type) nextParams.set('type', type);
        const nextSearch = nextParams.toString();
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`,
        );
      };

      form?.addEventListener('submit', (event) => {
        event.preventDefault();
        update();
      });
      queryInput?.addEventListener('input', update);
      typeSelect?.addEventListener('change', update);
      update();
    })
    .catch(() => {
      if (statusNode) statusNode.textContent = 'Die Suche ist derzeit nicht erreichbar. Nutzen Sie vorübergehend die Bereiche Recht, Themen, Presse und Service.';
      if (errorNode) errorNode.hidden = true;
      if (emptyNode) emptyNode.hidden = true;
      if (examplesNode) examplesNode.hidden = true;
      if (resultNode) resultNode.innerHTML = '';
    });
}
