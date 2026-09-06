import {
  buildSnippet,
  rankEntries,
  toSearchTerms,
  type RankableEntry,
  type ScoredEntry,
} from '../lib/search-ranking.ts';

export {};

interface PortalEntry extends RankableEntry {
  section: string;
  type: string;
}

const PAGE_SIZE = 20;
const root = document.querySelector<HTMLElement>('[data-portal-search-root]');

function escapeHtml(value: string): string {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}

/** Markiert Zeichenbereiche, ohne dass Inhalt jemals als HTML interpretiert wird. */
function markRanges(text: string, marks: Array<{ start: number; end: number }>): string {
  let cursor = 0;
  let html = '';
  for (const mark of marks) {
    html += escapeHtml(text.slice(cursor, mark.start));
    html += `<mark>${escapeHtml(text.slice(mark.start, mark.end))}</mark>`;
    cursor = mark.end;
  }
  return html + escapeHtml(text.slice(cursor));
}

function highlightWords(value: string, terms: string[]): string {
  const snippet = buildSnippet(value, terms, value.length + 1);
  return snippet && snippet.marks.length > 0 ? markRanges(snippet.text, snippet.marks) : escapeHtml(value);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(new Date(`${date}T12:00:00`));
}

function formatCount(count: number): string {
  return `${count} ${count === 1 ? 'Treffer' : 'Treffer'}`;
}

if (root) {
  const form = root.querySelector<HTMLFormElement>('[data-portal-search-form]');
  const queryInput = root.querySelector<HTMLInputElement>('[data-portal-search-query]');
  const areaSelect = root.querySelector<HTMLSelectElement>('[data-portal-search-area]');
  const sortSelect = root.querySelector<HTMLSelectElement>('[data-portal-search-sort]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-portal-search-reset]');
  const statusNode = root.querySelector<HTMLElement>('[data-portal-search-status]');
  const groupsNode = root.querySelector<HTMLElement>('[data-portal-search-groups]');
  const emptyNode = root.querySelector<HTMLElement>('[data-portal-search-empty]');
  const errorNode = root.querySelector<HTMLElement>('[data-portal-search-error]');
  const examplesNode = root.querySelector<HTMLElement>('[data-portal-search-examples]');
  const moreWrap = root.querySelector<HTMLElement>('[data-portal-search-more-wrap]');
  const moreButton = root.querySelector<HTMLButtonElement>('[data-portal-search-more]');
  const indexUrl = root.dataset.indexUrl ?? '/search-index.json';
  const lawIndexUrl = root.dataset.lawIndexUrl ?? '/search-index-recht.json';
  const lawSearchUrl = root.dataset.lawSearchUrl ?? '';
  const params = new URLSearchParams(window.location.search);

  let portalEntries: PortalEntry[] = [];
  let lawEntries: RankableEntry[] = [];
  let lawRequest: Promise<void> | null = null;
  let visibleCount = PAGE_SIZE;

  if (queryInput) queryInput.value = params.get('q') ?? '';
  if (areaSelect) areaSelect.value = params.get('bereich') ?? '';
  if (sortSelect && params.get('sort') === 'latest') sortSelect.value = 'latest';

  const currentArea = () => areaSelect?.value ?? '';
  const wantsLaw = () => {
    const area = currentArea();
    return area === '' || area === 'law';
  };
  const wantsPortal = () => currentArea() !== 'law';
  const hasSearchIntent = () => Boolean(queryInput?.value.trim());

  /**
   * Der Rechtsindex wird erst geholt, wenn der Bereichsfilter ihn einschließt und tatsächlich
   * gesucht wird. Ein Portaltreffer steht damit vor der ersten Übertragung des Rechtsbestands.
   */
  const ensureLawIndex = (): Promise<void> => {
    if (lawRequest) return lawRequest;
    lawRequest = fetch(lawIndexUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Law index unavailable (${response.status})`);
        const payload = (await response.json()) as { origin: string; entries: RankableEntry[] };
        lawEntries = payload.entries.map((entry) => ({
          ...entry,
          id: entry.url,
          url: `${payload.origin}${entry.url}`,
        }));
      })
      .catch(() => {
        lawEntries = [];
      });
    return lawRequest;
  };

  const renderHit = (hit: ScoredEntry, terms: string[]): string => {
    const entry = hit.entry;
    const snippet = hit.matchedIn === 'text' ? buildSnippet(entry.text, terms) : null;
    const body = snippet
      ? markRanges(snippet.text, snippet.marks)
      : highlightWords(entry.description, terms);
    return `
      <li class="record-list__item search-hit">
        <div class="search-hit__header">
          <h3><a class="inline-link" href="${escapeHtml(entry.url)}">${highlightWords(entry.title, terms)}</a></h3>
          <span class="tag">${escapeHtml(entry.typeLabel)}</span>
        </div>
        ${body ? `<p class="search-hit__context">${body}</p>` : ''}
        ${entry.date ? `<p class="search-hit__meta"><time datetime="${escapeHtml(entry.date)}">${formatDate(entry.date)}</time></p>` : ''}
      </li>`;
  };

  const renderGroups = (hits: ScoredEntry[], terms: string[], lawPending: boolean) => {
    if (!groupsNode) return;
    const groups: Array<{ key: 'portal' | 'law'; label: string; hint: string }> = [
      { key: 'portal', label: 'Staatsportal', hint: 'Seiten des Staatsportals' },
      { key: 'law', label: 'Recht', hint: 'Vorschriften und Verkündungen im Rechtsportal' },
    ];
    groupsNode.innerHTML = groups
      .map((group) => {
        const all = hits.filter((hit) => hit.area === group.key);
        if (all.length === 0) {
          return group.key === 'law' && lawPending
            ? `<section class="search-group"><h2>${group.label}</h2><p class="search-feedback">Der Rechtsbestand wird geladen …</p></section>`
            : '';
        }
        const shown = all.slice(0, visibleCount);
        const more =
          group.key === 'law' && lawSearchUrl
            ? `<p class="search-group__more"><a class="inline-link" href="${escapeHtml(lawSearchUrl)}?q=${encodeURIComponent(queryInput?.value.trim() ?? '')}">Alle Treffer in der Rechtssuche</a></p>`
            : '';
        return `
          <section class="search-group" aria-labelledby="search-group-${group.key}">
            <div class="search-group__header">
              <h2 id="search-group-${group.key}">${group.label}</h2>
              <p>${formatCount(all.length)} · ${group.hint}</p>
            </div>
            <ol class="record-list search-results__list">${shown.map((hit) => renderHit(hit, terms)).join('')}</ol>
            ${more}
          </section>`;
      })
      .join('');
  };

  const update = (resetVisibleCount = true) => {
    const query = queryInput?.value.trim() ?? '';
    const sort = sortSelect?.value === 'latest' ? 'latest' : 'relevance';
    const terms = toSearchTerms(query);
    if (resetVisibleCount) visibleCount = PAGE_SIZE;

    if (!hasSearchIntent()) {
      if (statusNode) {
        statusNode.textContent =
          'Geben Sie einen Begriff ein, zum Beispiel Kreisreform, Haushalt, Kabinett oder eine Gesetzesabkürzung.';
      }
      if (emptyNode) emptyNode.hidden = true;
      if (errorNode) errorNode.hidden = true;
      if (examplesNode) examplesNode.hidden = false;
      if (moreWrap) moreWrap.hidden = true;
      if (groupsNode) groupsNode.innerHTML = '';
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    const area = currentArea();
    const sectionFilter = area.startsWith('portal:') ? area.slice('portal:'.length) : '';
    const portalPool = wantsPortal()
      ? portalEntries.filter((entry) => !sectionFilter || entry.section === sectionFilter)
      : [];
    const lawPool = wantsLaw() ? lawEntries : [];
    const lawPending = wantsLaw() && lawEntries.length === 0;
    const hits = rankEntries(portalPool, lawPool, query, { sort });

    if (examplesNode) examplesNode.hidden = true;
    if (errorNode) errorNode.hidden = true;
    if (emptyNode) emptyNode.hidden = hits.length > 0 || lawPending;
    if (moreWrap) {
      moreWrap.hidden = hits.every((hit) => hits.filter((other) => other.area === hit.area).length <= visibleCount);
    }
    if (statusNode) {
      const portalCount = hits.filter((hit) => hit.area === 'portal').length;
      const lawCount = hits.filter((hit) => hit.area === 'law').length;
      statusNode.textContent =
        hits.length === 0
          ? `Keine Treffer für „${query}“`
          : `${hits.length} Treffer für „${query}“: ${portalCount} im Staatsportal, ${lawCount} im Recht.`;
    }
    renderGroups(hits, terms, lawPending);

    const nextParams = new URLSearchParams();
    if (query) nextParams.set('q', query);
    if (area) nextParams.set('bereich', area);
    if (sort === 'latest') nextParams.set('sort', 'latest');
    const nextSearch = nextParams.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);

    if (lawPending) void ensureLawIndex().then(() => update(false));
  };

  if (hasSearchIntent() && statusNode) {
    statusNode.textContent = 'Suche läuft …';
    if (examplesNode) examplesNode.hidden = true;
  }

  fetch(indexUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Search index could not be loaded (${response.status})`);
      return (await response.json()) as { entries: PortalEntry[] };
    })
    .then((payload) => {
      portalEntries = payload.entries;

      form?.addEventListener('submit', (event) => {
        event.preventDefault();
        update();
      });
      resetButton?.addEventListener('click', () => {
        window.setTimeout(() => update(), 0);
      });
      queryInput?.addEventListener('input', () => update());
      areaSelect?.addEventListener('change', () => update());
      sortSelect?.addEventListener('change', () => update());
      moreButton?.addEventListener('click', () => {
        visibleCount += PAGE_SIZE;
        update(false);
      });
      update();
    })
    .catch(() => {
      if (statusNode) {
        statusNode.textContent =
          'Die Suche ist derzeit nicht erreichbar. Nutzen Sie vorübergehend die Bereiche Recht, Themen, Presse und Service.';
      }
      if (errorNode) errorNode.hidden = false;
      if (emptyNode) emptyNode.hidden = true;
      if (examplesNode) examplesNode.hidden = true;
      if (moreWrap) moreWrap.hidden = true;
      if (groupsNode) groupsNode.innerHTML = '';
    });
}
