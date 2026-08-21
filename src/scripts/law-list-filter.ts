const roots = document.querySelectorAll<HTMLElement>('[data-law-list-filter]');

for (const root of roots) {
  const form = root.querySelector<HTMLFormElement>('[data-law-filter-form]');
  const summary = root.querySelector<HTMLElement>('[data-law-filter-summary]');
  const entries = Array.from(root.querySelectorAll<HTMLElement>('[data-law-filter-entry]'));
  if (!form) continue;

  const params = new URLSearchParams(window.location.search);
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
      const value = params.get(element.name);
      if (value !== null) element.value = value;
    }
  }

  const apply = (push = false) => {
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
    if (summary) summary.textContent = visible === 1 ? '1 Eintrag' : `${visible} Einträge`;

    const next = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    const target = next.size ? `${window.location.pathname}?${next}` : window.location.pathname;
    window.history[push ? 'pushState' : 'replaceState']({}, '', target);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    apply(true);
  });
  form.addEventListener('change', () => apply());
  apply();
}
