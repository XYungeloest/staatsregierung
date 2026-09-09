import { buildSearchVariants, parseQueryTokens } from '@ostrecht/recht-search/search-query.ts';
import type { SearchSuggestion, SearchSuggestionPayload } from '@ostrecht/recht-search/search.ts';

/**
 * Vorschlagsliste der Einstiegssuchen (Amtsband, Startseite, Verzeichnisse): öffnet ab dem
 * zweiten Zeichen, höchstens fünf Vorschriften plus die Volltextsuche als letzter Eintrag. Das
 * Eingabefeld behält den DOM-Fokus (aria-activedescendant); Pfeiltasten wählen zyklisch, Enter
 * öffnet den markierten Eintrag (ohne Markierung die Trefferliste), Escape schließt ohne zu
 * leeren, Tab verlässt das Feld und schließt. Ohne JavaScript bleibt das Formular ein Formular.
 */
const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-law-norm-autocomplete]'));
let suggestionRequest: Promise<SearchSuggestion[]> | undefined;
let nextListId = 0;
const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 5;
const VIEWPORT_GUTTER = 8;
const LIST_GAP = 4;
const DESIRED_LIST_HEIGHT = 7 * 48;
const PREFERRED_MINIMUM_HEIGHT = 180;

type SuggestionKind = 'Vorschrift' | 'Abkürzung' | 'Kurztitel';
interface Option {
  kind: SuggestionKind | 'Suche';
  text: string;
  detail: string;
  url: string;
}

function loadSuggestions(url: string): Promise<SearchSuggestion[]> {
  if (!suggestionRequest) {
    suggestionRequest = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<SearchSuggestionPayload>;
      })
      .then((payload) => payload.suggestions);
  }
  return suggestionRequest;
}

function fieldsOf(suggestion: SearchSuggestion): Array<{ kind: SuggestionKind; variants: string[] }> {
  return [
    { kind: 'Vorschrift', variants: buildSearchVariants(suggestion.title) },
    { kind: 'Kurztitel', variants: suggestion.shortTitle && suggestion.shortTitle !== suggestion.title ? buildSearchVariants(suggestion.shortTitle) : [] },
    { kind: 'Abkürzung', variants: [suggestion.abbr, ...suggestion.aliases].filter(Boolean).flatMap(buildSearchVariants) },
  ];
}

/** Trifft die Anfrage die Vorschrift? Liefert die Art des Treffers (Abkürzung vor Kurztitel vor Titel). */
function matchKind(suggestion: SearchSuggestion, query: string): SuggestionKind | null {
  const tokens = parseQueryTokens(query);
  if (tokens.length === 0) return null;
  const fields = fieldsOf(suggestion);
  const matches = (variants: string[]) => tokens.every((token) => token.variants.some((variant) => variants.some((field) =>
    token.prefix ? field.split(' ').some((word) => word.startsWith(variant)) : field.includes(variant),
  )));
  for (const kind of ['Abkürzung', 'Kurztitel'] as const) {
    const field = fields.find((entry) => entry.kind === kind);
    if (field && field.variants.length > 0 && matches(field.variants)) return kind;
  }
  const all = fields.flatMap((entry) => entry.variants);
  return matches(all) ? 'Vorschrift' : null;
}

function detailOf(suggestion: SearchSuggestion, kind: SuggestionKind): string {
  if (kind === 'Kurztitel') return `→ ${suggestion.abbr || suggestion.title}`;
  return [
    suggestion.shortTitle && suggestion.shortTitle !== suggestion.title ? suggestion.shortTitle : '',
    suggestion.abbr,
    suggestion.typeLabel,
  ].filter(Boolean).join(' · ');
}

function textOf(suggestion: SearchSuggestion, kind: SuggestionKind): string {
  if (kind === 'Abkürzung') return suggestion.abbr || suggestion.title;
  if (kind === 'Kurztitel') return suggestion.shortTitle;
  return suggestion.title;
}

for (const input of inputs) {
  const sourceUrl = input.dataset.lawSuggestionsUrl;
  if (!sourceUrl) continue;
  const form = input.closest('form');
  const searchUrl = input.dataset.lawSearchUrl ?? form?.getAttribute('action') ?? '';

  const list = document.createElement('ul');
  const listId = `law-norm-suggestions-${nextListId += 1}`;
  list.id = listId;
  list.className = 'r-ac';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Vorschlagsliste für Normen');
  list.hidden = true;
  document.body.append(list);

  const live = document.createElement('div');
  live.className = 'visually-hidden';
  live.setAttribute('aria-live', 'polite');
  input.insertAdjacentElement('afterend', live);

  let current: Option[] = [];
  let activeIndex = -1;
  let isOpen = false;

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', listId);
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-haspopup', 'listbox');

  const positionList = () => {
    if (!isOpen) return;
    const box = input.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const desiredWidth = Math.max(box.width, Math.min(38 * 16, viewportWidth - 2 * VIEWPORT_GUTTER));
    const width = Math.min(Math.max(0, viewportWidth - 2 * VIEWPORT_GUTTER), desiredWidth);
    const left = Math.min(Math.max(VIEWPORT_GUTTER, box.left), Math.max(VIEWPORT_GUTTER, viewportWidth - VIEWPORT_GUTTER - width));
    const spaceBelow = Math.max(0, viewportHeight - box.bottom - LIST_GAP - VIEWPORT_GUTTER);
    const spaceAbove = Math.max(0, box.top - LIST_GAP - VIEWPORT_GUTTER);
    const opensAbove = spaceBelow < PREFERRED_MINIMUM_HEIGHT && spaceAbove > spaceBelow;
    const availableSpace = opensAbove ? spaceAbove : spaceBelow;
    const height = Math.min(DESIRED_LIST_HEIGHT, availableSpace, Math.max(0, viewportHeight - 2 * VIEWPORT_GUTTER));
    const intendedTop = opensAbove ? box.top - LIST_GAP - height : box.bottom + LIST_GAP;
    const top = Math.min(Math.max(VIEWPORT_GUTTER, intendedTop), Math.max(VIEWPORT_GUTTER, viewportHeight - VIEWPORT_GUTTER - height));
    list.style.left = `${left}px`;
    list.style.top = `${top}px`;
    list.style.width = `${width}px`;
    list.style.maxHeight = `${height}px`;
  };

  const close = () => {
    isOpen = false;
    activeIndex = -1;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const searchOption = (query: string, empty: boolean): Option => ({
    kind: 'Suche',
    text: empty ? `Kein Vorschlag zu „${query}“ – Enter sucht im gesamten Landesrecht` : `„${query}“ im gesamten Landesrecht suchen`,
    detail: empty ? '' : 'Trefferliste öffnen',
    url: searchUrl ? `${searchUrl}?q=${encodeURIComponent(query)}` : '',
  });

  const select = (index: number) => {
    const selected = current[index];
    if (!selected) return;
    if (selected.kind === 'Suche' && (!selected.url || input.hasAttribute('data-search-query'))) {
      form?.requestSubmit();
      return;
    }
    window.location.assign(selected.url);
  };

  const updateActiveOption = () => {
    const options = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
    options.forEach((option, index) => option.setAttribute('aria-selected', String(index === activeIndex)));
    const active = options[activeIndex];
    if (active) {
      input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
    options.forEach((option, index) => {
      const hint = option.querySelector<HTMLElement>('.r-ac__hint');
      if (hint) hint.textContent = index === activeIndex ? 'Enter öffnet' : '';
    });
  };

  const render = () => {
    const options = current.map((option, index) => {
      const item = document.createElement('li');
      item.id = `${listId}-option-${index}`;
      item.className = 'r-ac__option';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      const kind = document.createElement('span');
      kind.className = 'r-ac__kind';
      kind.textContent = option.kind;
      const text = document.createElement('span');
      text.className = 'r-ac__text';
      text.textContent = option.text;
      if (option.detail) {
        const detail = document.createElement('span');
        detail.className = 'r-ac__detail';
        detail.textContent = ` · ${option.detail}`;
        text.append(detail);
      }
      const hint = document.createElement('span');
      hint.className = 'r-ac__hint';
      item.append(kind, text, hint);
      item.addEventListener('pointerdown', (event) => event.preventDefault());
      item.addEventListener('click', () => select(index));
      return item;
    });
    const keys = document.createElement('li');
    keys.className = 'r-ac__keys';
    keys.setAttribute('aria-hidden', 'true');
    keys.innerHTML = '<kbd>↑</kbd><kbd>↓</kbd> auswählen · <kbd>Enter</kbd> öffnen · <kbd>Esc</kbd> schließen · <kbd>Tab</kbd> verlässt das Feld';
    list.replaceChildren(...options, keys);
    activeIndex = -1;
    isOpen = current.length > 0;
    list.hidden = !isOpen;
    input.setAttribute('aria-expanded', String(isOpen));
    updateActiveOption();
    positionList();
    const count = current.filter((option) => option.kind !== 'Suche').length;
    live.textContent = count === 0 ? 'Kein Vorschlag' : `${count} ${count === 1 ? 'Vorschlag' : 'Vorschläge'}`;
  };

  const refresh = async () => {
    const query = input.value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      current = [];
      close();
      live.textContent = '';
      return;
    }
    try {
      const suggestions = await loadSuggestions(sourceUrl);
      if (query !== input.value.trim()) return;
      const matched: Option[] = [];
      for (const suggestion of suggestions) {
        const kind = matchKind(suggestion, query);
        if (!kind) continue;
        matched.push({ kind, text: textOf(suggestion, kind), detail: detailOf(suggestion, kind), url: suggestion.url });
        if (matched.length >= MAX_SUGGESTIONS) break;
      }
      current = [...matched, searchOption(query, matched.length === 0)];
      render();
    } catch {
      close();
    }
  };

  input.addEventListener('input', () => { void refresh(); });
  input.addEventListener('focus', () => { if (input.value.trim().length >= MIN_QUERY_LENGTH) void refresh(); });
  input.addEventListener('blur', () => window.setTimeout(close, 120));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (isOpen) event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab') {
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (current.length === 0) return;
      event.preventDefault();
      if (!isOpen) {
        render();
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      activeIndex = (activeIndex + direction + current.length) % current.length;
      updateActiveOption();
      return;
    }
    if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      event.preventDefault();
      select(activeIndex);
    }
  });

  window.addEventListener('resize', positionList);
  window.addEventListener('scroll', positionList, true);
  window.addEventListener('orientationchange', positionList);
}
