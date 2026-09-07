import {
  buildSnippet,
  findTermRanges,
  rankEntries,
  toSearchTerms,
  type RankableEntry,
  type ScoredEntry,
} from '../lib/search-ranking.ts';
import { lawGroupStatus, nextLawState, type LawIndexState, type LawGroupStatus } from '../lib/search-law-state.ts';

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

/**
 * Markiert die Suchbegriffe im vollständigen Wert. Anders als `buildSnippet` bildet diese Stelle
 * kein Fenster: Überschriften und Kurzbeschreibungen sollen ganz dastehen, nicht angeschnitten.
 */
function highlightWords(value: string, terms: string[]): string {
  const ranges = findTermRanges(value, terms);
  return ranges.length > 0 ? markRanges(value, ranges) : escapeHtml(value);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(new Date(`${date}T12:00:00`));
}

function formatCount(count: number): string {
  return `${count} Treffer`;
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
  let lawState: LawIndexState = 'idle';
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
   *
   * Genau eine Anfrage je Seitenaufruf: `lawState` führt den Zustand, statt ihn aus der Länge von
   * `lawEntries` zu erraten. `loaded` und `error` sind Endzustände; ein Fehlschlag wird nicht
   * wiederholt, und kein Rendern stößt eine zweite Anfrage an. Ein bewusster Neuversuch wäre ein
   * Bedienelement, das `lawState` zurücksetzt – absichtlich nicht Teil dieses Ablaufs.
   */
  const ensureLawIndex = (): void => {
    if (lawState !== 'idle') return;
    lawState = nextLawState(lawState, 'request');
    void fetch(lawIndexUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Law index unavailable (${response.status})`);
        const payload = (await response.json()) as { origin: string; entries: RankableEntry[] };
        lawEntries = payload.entries.map((entry) => ({
          ...entry,
          id: entry.url,
          url: `${payload.origin}${entry.url}`,
        }));
        // Auch ein leerer Bestand ist geladen, nicht fehlerhaft.
        lawState = nextLawState(lawState, 'success');
      })
      .catch(() => {
        lawEntries = [];
        lawState = nextLawState(lawState, 'failure');
      })
      // Genau ein Nachrendern, gleich welcher Ausgang; es hängt an keiner Bedingung, die der
      // Fehlerpfad offen lassen könnte.
      .finally(() => update(false));
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

  const renderGroups = (hits: ScoredEntry[], terms: string[], lawStatus: LawGroupStatus) => {
    if (!groupsNode) return;
    const groups: Array<{ key: 'portal' | 'law'; label: string; hint: string }> = [
      { key: 'portal', label: 'Staatsportal', hint: 'Seiten des Staatsportals' },
      { key: 'law', label: 'Recht', hint: 'Vorschriften und Verkündungen im Rechtsportal' },
    ];
    groupsNode.innerHTML = groups
      .map((group) => {
        const all = hits.filter((hit) => hit.area === group.key);
        if (all.length === 0) {
          // Ein geladener, aber leerer Rechtsbestand braucht keinen eigenen Kasten; dafür gibt es
          // die allgemeine Leermeldung. Laden und Ausfall dagegen sind eigene Zustände.
          if (group.key !== 'law' || lawStatus === 'off' || lawStatus === 'loaded') return '';
          const body =
            lawStatus === 'loading'
              ? '<p class="search-feedback">Die Vorschriften werden geladen …</p>'
              : `<p class="search-feedback search-feedback--warning">Der Rechtsbestand konnte nicht geladen werden. Die Treffer des Staatsportals stehen oben unverändert.${lawSearchUrl ? ` <a class="inline-link" href="${escapeHtml(lawSearchUrl)}?q=${encodeURIComponent(queryInput?.value.trim() ?? '')}">Zur Rechtssuche</a>` : ''}</p>`;
          return `<section class="search-group" data-portal-search-law-status="${lawStatus}" aria-labelledby="search-group-law"><div class="search-group__header"><h2 id="search-group-law">${group.label}</h2></div>${body}</section>`;
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
    // Der Anstoß steht vor dem Rendern, damit schon das erste Bild den Ladezustand zeigt.
    if (wantsLaw()) ensureLawIndex();
    const lawPool = wantsLaw() ? lawEntries : [];
    const lawStatus = lawGroupStatus(lawState, wantsLaw());
    const hits = rankEntries(portalPool, lawPool, query, { sort });
    root.dataset.lawStatus = lawStatus;

    if (examplesNode) examplesNode.hidden = true;
    if (errorNode) errorNode.hidden = true;
    // Beim Ausfall trägt die Gruppe „Recht“ die Meldung; zwei Warnungen zu einer Lage wären
    // widersprüchlich (tests/browser-smoke.spec.ts: Zustände schließen sich gegenseitig aus).
    if (emptyNode) emptyNode.hidden = hits.length > 0 || lawStatus === 'loading' || lawStatus === 'error';
    if (moreWrap) {
      moreWrap.hidden = hits.every((hit) => hits.filter((other) => other.area === hit.area).length <= visibleCount);
    }
    if (statusNode) {
      const portalCount = hits.filter((hit) => hit.area === 'portal').length;
      const lawCount = hits.filter((hit) => hit.area === 'law').length;
      // Der Ladezustand hat einen eigenen Text in der Statuszeile (aria-live); der Hinweis auf den
      // Ausfall hängt an der Trefferzeile, damit ihn auch hört, wer die Gruppe nicht erreicht.
      const note = lawStatus === 'error' ? ' Der Rechtsbestand ist nicht erreichbar; die Treffer des Staatsportals bleiben vollständig.' : '';
      statusNode.textContent =
        lawStatus === 'loading'
          ? `Suche läuft für „${query}“: die Vorschriften werden geladen …`
          : hits.length === 0
            ? `Keine Treffer für „${query}“.${note}`
            : `${hits.length} Treffer für „${query}“: ${portalCount} im Staatsportal, ${lawCount} im Recht.${note}`;
    }
    renderGroups(hits, terms, lawStatus);

    const nextParams = new URLSearchParams();
    if (query) nextParams.set('q', query);
    if (area) nextParams.set('bereich', area);
    if (sort === 'latest') nextParams.set('sort', 'latest');
    const nextSearch = nextParams.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
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
    // Fällt der Portalindex aus, bleibt die Seite ohne Bedienung: die Ereignisbehandler oben
    // werden nie gebunden, das Formular fällt auf seine eigene GET-Adresse zurück. `errorNode`
    // gilt nur diesem Fall; der Ausfall des Rechtsindex steht in der Gruppe „Recht“.
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
