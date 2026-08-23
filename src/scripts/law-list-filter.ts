const roots = document.querySelectorAll<HTMLElement>('[data-law-list-filter]');

for (const root of roots) {
  const form = root.querySelector<HTMLFormElement>('[data-law-filter-form]');
  const summary = root.querySelector<HTMLElement>('[data-law-filter-summary]');
  const entries = Array.from(root.querySelectorAll<HTMLElement>('[data-law-filter-entry]'));
  const groups = Array.from(root.querySelectorAll<HTMLElement>('[data-law-filter-group]'));
  const letters = Array.from(root.querySelectorAll<HTMLElement>('[data-law-filter-letter]'));
  if (!form) continue;

  const readUrlIntoForm = () => {
    const params = new URLSearchParams(window.location.search);
    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement) || !element.name) continue;
      element.value = params.get(element.name) ?? '';
    }
  };

  const apply = ({ push = false, writeUrl = true } = {}) => {
    const data = new FormData(form);
    const filters: Record<string, string> = {};
    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement) || !element.name) continue;
      const value = String(data.get(element.name) ?? '').trim().toLocaleLowerCase('de-DE');
      if (value) filters[element.name] = value;
    }

    let visible = 0;
    entries.forEach((entry) => {
      const matches = Object.entries(filters).every(([key, value]) =>
        value.split('|').some((candidate) => (entry.dataset[key] ?? '').toLocaleLowerCase('de-DE').includes(candidate)),
      );
      entry.hidden = !matches;
      if (matches) visible += 1;
    });

    const visibleLetters = new Set<string>();
    groups.forEach((group) => {
      const hasVisibleEntry = Array.from(group.querySelectorAll<HTMLElement>('[data-law-filter-entry]'))
        .some((entry) => !entry.hidden);
      group.hidden = !hasVisibleEntry;
      if (hasVisibleEntry && group.dataset.lawFilterGroup) visibleLetters.add(group.dataset.lawFilterGroup);
    });
    letters.forEach((letter) => {
      letter.hidden = !visibleLetters.has(letter.dataset.lawFilterLetter ?? '');
    });

    if (summary) summary.textContent = visible === 1 ? '1 Eintrag' : `${visible} Einträge`;
    if (!writeUrl) return;

    const next = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => next.set(key, value));
    const target = next.size ? `${window.location.pathname}?${next}` : window.location.pathname;
    window.history[push ? 'pushState' : 'replaceState']({}, '', target);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    apply({ push: true });
  });
  // Keep the preview responsive, but let an explicit submit create the URL/history entry.
  // Otherwise the input's blur/change event replaces the previous submitted state just
  // before the submit event runs and browser Back cannot restore that state.
  form.addEventListener('change', () => apply({ writeUrl: false }));
  window.addEventListener('popstate', () => {
    readUrlIntoForm();
    apply({ writeUrl: false });
  });

  readUrlIntoForm();
  apply({ writeUrl: false });
}
