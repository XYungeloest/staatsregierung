import { buildSearchVariants, parseQueryTokens } from '@ostrecht/recht-search/search-query.ts';
import type { SearchSuggestion, SearchSuggestionPayload } from '@ostrecht/recht-search/search.ts';

const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-law-norm-autocomplete]'));
let suggestionRequest: Promise<SearchSuggestion[]> | undefined;
let nextListId = 0;
const VIEWPORT_GUTTER = 8;
const LIST_GAP = 4;
const DESIRED_LIST_HEIGHT = 9 * 44;
const PREFERRED_MINIMUM_HEIGHT = 180;

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

function suggestionSearchText(suggestion: SearchSuggestion): string[] {
  return [
    suggestion.title,
    suggestion.shortTitle,
    suggestion.abbr,
    ...suggestion.aliases,
  ].flatMap(buildSearchVariants);
}

function matchesSuggestion(suggestion: SearchSuggestion, query: string): boolean {
  const tokens = parseQueryTokens(query);
  if (tokens.length === 0) return false;
  const fields = suggestionSearchText(suggestion);
  return tokens.every((token) => token.variants.some((variant) => fields.some((field) =>
    token.prefix
      ? field.split(' ').some((word) => word.startsWith(variant))
      : field.includes(variant),
  )));
}

function suggestionLabel(suggestion: SearchSuggestion): string {
  return [
    suggestion.shortTitle && suggestion.shortTitle !== suggestion.title ? suggestion.shortTitle : '',
    suggestion.abbr,
    suggestion.typeLabel,
  ].filter(Boolean).join(' · ');
}

for (const input of inputs) {
  const sourceUrl = input.dataset.lawSuggestionsUrl;
  if (!sourceUrl) continue;

  const list = document.createElement('ul');
  const listId = `law-norm-suggestions-${nextListId += 1}`;
  list.id = listId;
  list.className = 'law-norm-suggestions';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Vorschlagsliste für Normen');
  list.hidden = true;
  document.body.append(list);

  let current: SearchSuggestion[] = [];
  let activeIndex = -1;
  let isOpen = false;

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', listId);
  input.setAttribute('aria-expanded', 'false');

  const positionList = () => {
    if (!isOpen) return;
    const box = input.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(Math.max(0, viewportWidth - 2 * VIEWPORT_GUTTER), box.width);
    const left = Math.min(
      Math.max(VIEWPORT_GUTTER, box.left),
      Math.max(VIEWPORT_GUTTER, viewportWidth - VIEWPORT_GUTTER - width),
    );
    const spaceBelow = Math.max(0, viewportHeight - box.bottom - LIST_GAP - VIEWPORT_GUTTER);
    const spaceAbove = Math.max(0, box.top - LIST_GAP - VIEWPORT_GUTTER);
    const opensAbove = spaceBelow < PREFERRED_MINIMUM_HEIGHT && spaceAbove > spaceBelow;
    const availableSpace = opensAbove ? spaceAbove : spaceBelow;
    const height = Math.min(
      DESIRED_LIST_HEIGHT,
      availableSpace,
      Math.max(0, viewportHeight - 2 * VIEWPORT_GUTTER),
    );
    const intendedTop = opensAbove ? box.top - LIST_GAP - height : box.bottom + LIST_GAP;
    const top = Math.min(
      Math.max(VIEWPORT_GUTTER, intendedTop),
      Math.max(VIEWPORT_GUTTER, viewportHeight - VIEWPORT_GUTTER - height),
    );

    list.style.left = `${left}px`;
    list.style.top = `${top}px`;
    list.style.width = `${width}px`;
    list.style.maxHeight = `${height}px`;
    list.dataset.position = opensAbove ? 'above' : 'below';
  };

  const close = () => {
    isOpen = false;
    activeIndex = -1;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const select = (index: number) => {
    const selected = current[index];
    if (!selected) return;
    window.location.assign(selected.url);
  };

  const updateActiveOption = () => {
    Array.from(list.children).forEach((option, index) => {
      option.setAttribute('aria-selected', String(index === activeIndex));
    });
    const active = list.children.item(activeIndex) as HTMLElement | null;
    if (active) input.setAttribute('aria-activedescendant', active.id);
    else input.removeAttribute('aria-activedescendant');
  };

  const render = () => {
    list.replaceChildren(...current.map((suggestion, index) => {
      const option = document.createElement('li');
      option.id = `${listId}-option-${index}`;
      option.className = 'law-norm-suggestions__option';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      const title = document.createElement('strong');
      title.textContent = suggestion.title;
      option.append(title);
      const label = suggestionLabel(suggestion);
      if (label) {
        const detail = document.createElement('span');
        detail.textContent = label;
        option.append(detail);
      }
      option.addEventListener('pointerdown', (event) => event.preventDefault());
      option.addEventListener('click', () => select(index));
      return option;
    }));
    activeIndex = -1;
    isOpen = current.length > 0;
    list.hidden = !isOpen;
    input.setAttribute('aria-expanded', String(isOpen));
    updateActiveOption();
    positionList();
  };

  const refresh = async () => {
    const query = input.value.trim();
    if (!query) {
      current = [];
      close();
      return;
    }
    try {
      const suggestions = await loadSuggestions(sourceUrl);
      if (query !== input.value.trim()) return;
      current = suggestions.filter((suggestion) => matchesSuggestion(suggestion, query)).slice(0, 8);
      render();
    } catch {
      close();
    }
  };

  input.addEventListener('input', () => { void refresh(); });
  input.addEventListener('focus', () => { if (input.value.trim()) void refresh(); });
  input.addEventListener('blur', () => window.setTimeout(close, 120));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (current.length === 0) return;
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      activeIndex = (activeIndex + direction + current.length) % current.length;
      updateActiveOption();
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      select(activeIndex);
    }
  });

  window.addEventListener('resize', positionList);
  window.addEventListener('scroll', positionList, true);
  window.addEventListener('orientationchange', positionList);
}
