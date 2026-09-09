/** Native modale Blätter behalten Fokus, Escape und Hintergrundsperre im Browser. */
for (const selector of ['[data-outline-sheet]', '[data-search-advanced]']) {
  const details = document.querySelector<HTMLDetailsElement>(selector);
  if (!details) continue;
  const media = window.matchMedia(selector === '[data-outline-sheet]' ? '(max-width: 79.99rem)' : '(max-width: 47.99rem)');
  const dialog = document.createElement('dialog');
  dialog.className = selector === '[data-outline-sheet]' ? 'r-sheet r-sheet--outline' : 'r-sheet r-sheet--filters';
  dialog.setAttribute('aria-label', selector === '[data-outline-sheet]' ? 'Inhalt der Vorschrift' : 'Erweiterte Suche');
  const nodes = Array.from(details.children).filter((node) => node.tagName !== 'SUMMARY');
  let mounted = false;
  const sync = () => {
    if (media.matches && !mounted) {
      details.append(dialog);
      nodes.forEach((node) => dialog.append(node));
      mounted = true;
    } else if (!media.matches && mounted) {
      dialog.close();
      nodes.forEach((node) => details.append(node));
      dialog.remove();
      mounted = false;
    }
    if (mounted && details.open && !dialog.open) dialog.showModal();
    if (mounted && !details.open && dialog.open) dialog.close();
  };
  dialog.addEventListener('close', () => { if (mounted && media.matches) details.open = false; });
  details.addEventListener('toggle', sync);
  details.querySelector('[data-sheet-close]')?.addEventListener('click', () => { details.open = false; dialog.close(); });
  details.closest('form')?.addEventListener('submit', () => { if (media.matches) { details.open = false; dialog.close(); } });
  media.addEventListener('change', sync);
  sync();
}

// Auf dem Smartphone lassen sich Filtergruppen einzeln öffnen; Labels und Fieldsets bleiben erhalten.
const smallScreen = window.matchMedia('(max-width: 47.99rem)');
for (const fieldset of document.querySelectorAll<HTMLFieldSetElement>('.r-search__advanced-grid > fieldset')) {
  const legend = fieldset.querySelector('legend');
  if (!legend) continue;
  const group = document.createElement('details');
  group.className = 'r-filter-group';
  const summary = document.createElement('summary');
  summary.textContent = legend.textContent;
  group.append(summary);
  Array.from(fieldset.children).filter((child) => child !== legend).forEach((child) => group.append(child));
  fieldset.append(group);
  const syncGroup = () => {
    group.open = !smallScreen.matches || Boolean(group.querySelector('input:checked'));
    legend.classList.toggle('visually-hidden', smallScreen.matches);
  };
  smallScreen.addEventListener('change', syncGroup);
  syncGroup();
}
