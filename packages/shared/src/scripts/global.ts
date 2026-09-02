document.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-print-page]')) {
    window.print();
  }
});

if (window.matchMedia('(max-width: 74rem)').matches) {
  document.querySelectorAll<HTMLDetailsElement>('.norm-info-panel[open]').forEach((panel) => {
    panel.open = false;
  });
}

if (window.matchMedia('(max-width: 56rem)').matches) {
  document.querySelectorAll<HTMLDetailsElement>('.law-search-filters-panel[open]').forEach((panel) => {
    panel.open = false;
  });
}
