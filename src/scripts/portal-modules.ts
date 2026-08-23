function filterActionPlanModule(root: HTMLElement): void {
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-action-plan-item]'));
  const statusSelect = root.querySelector<HTMLSelectElement>('[data-action-plan-filter="status"]');
  const ressortSelect = root.querySelector<HTMLSelectElement>('[data-action-plan-filter="ressort"]');
  const countNode = root.querySelector<HTMLElement>('[data-action-plan-count]');
  const emptyNode = root.querySelector<HTMLElement>('[data-action-plan-empty]');

  const update = () => {
    const status = statusSelect?.value ?? '';
    const ressort = ressortSelect?.value ?? '';
    let visibleCount = 0;

    for (const card of cards) {
      const matchesStatus = !status || card.dataset.status === status;
      const matchesRessort = !ressort || card.dataset.ressort === ressort;
      const visible = matchesStatus && matchesRessort;
      card.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    }

    if (countNode) {
      countNode.textContent = String(visibleCount);
    }

    if (emptyNode) {
      emptyNode.hidden = visibleCount > 0;
    }
  };

  statusSelect?.addEventListener('change', update);
  ressortSelect?.addEventListener('change', update);
  update();
}

function filterTimelineModule(root: HTMLElement): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-timeline-item]'));
  const typeSelect = root.querySelector<HTMLSelectElement>('[data-timeline-filter="type"]');
  const ressortSelect = root.querySelector<HTMLSelectElement>('[data-timeline-filter="ressort"]');
  const emptyNode = root.querySelector<HTMLElement>('[data-timeline-empty]');

  const update = () => {
    const type = typeSelect?.value ?? '';
    const ressort = ressortSelect?.value ?? '';
    let visibleCount = 0;

    for (const item of items) {
      const matchesType = !type || item.dataset.type === type;
      const matchesRessort = !ressort || item.dataset.ressort === ressort;
      const visible = matchesType && matchesRessort;
      item.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    }

    if (emptyNode) {
      emptyNode.hidden = visibleCount > 0;
    }
  };

  typeSelect?.addEventListener('change', update);
  ressortSelect?.addEventListener('change', update);
  update();
}

function filterBudgetModule(root: HTMLElement): void {
  const yearButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-budget-year]'));
  const queryInput = root.querySelector<HTMLInputElement>('[data-budget-filter="query"]');
  const categorySelect = root.querySelector<HTMLSelectElement>('[data-budget-filter="category"]');
  const stateSelect = root.querySelector<HTMLSelectElement>('[data-budget-filter="state"]');
  const entries = Array.from(root.querySelectorAll<HTMLElement>('[data-budget-entry]'));
  const investmentEntries = Array.from(root.querySelectorAll<HTMLElement>('[data-budget-investment-entry]'));
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-budget-row]'));
  const comparisonRows = Array.from(root.querySelectorAll<HTMLElement>('[data-budget-comparison]'));
  const yearPanels = Array.from(root.querySelectorAll<HTMLElement>('[data-budget-year-panel]'));
  const viewButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-budget-view]'));
  const viewPanels = Array.from(root.querySelectorAll<HTMLElement>('[data-budget-panel]'));
  const statusNode = root.querySelector<HTMLElement>('[data-budget-status]');
  const emptyNode = root.querySelector<HTMLElement>('[data-budget-empty]');

  let activeYear = '2025';
  let activeView = 'overview';

  const setActiveView = (view: string, moveFocus = false) => {
    if (!viewPanels.some((panel) => panel.dataset.budgetPanel === view)) {
      return;
    }

    activeView = view;
    for (const button of viewButtons) {
      const isActive = button.dataset.budgetView === activeView;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
      if (moveFocus && isActive) {
        button.focus();
      }
    }

    for (const panel of viewPanels) {
      panel.hidden = panel.dataset.budgetPanel !== activeView;
    }
  };

  const update = () => {
    const query = (queryInput?.value ?? '').trim().toLocaleLowerCase('de-DE');
    const category = categorySelect?.value ?? '';
    const state = stateSelect?.value ?? '';
    let visibleCount = 0;

    for (const button of yearButtons) {
      button.classList.toggle('is-active', button.dataset.budgetYear === activeYear);
      button.setAttribute('aria-pressed', button.dataset.budgetYear === activeYear ? 'true' : 'false');
    }

    for (const panel of yearPanels) {
      panel.hidden = panel.dataset.year !== activeYear;
    }

    const matchesCommonFilters = (element: HTMLElement, withYear = true) => {
      const matchesYear = element.dataset.year === activeYear;
      const matchesState = !state || element.dataset.state === state;
      const matchesCategory = !category || element.dataset.category === category;
      const label = element.dataset.label ?? '';
      const matchesQuery = !query || label.includes(query);
      return (!withYear || matchesYear) && matchesState && matchesCategory && matchesQuery;
    };

    for (const entry of entries) {
      const visible = matchesCommonFilters(entry);
      entry.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    }

    for (const entry of investmentEntries) {
      entry.hidden = !matchesCommonFilters(entry);
    }

    for (const row of rows) {
      row.hidden = !matchesCommonFilters(row);
    }

    for (const row of comparisonRows) {
      row.hidden = !matchesCommonFilters(row, false);
    }

    if (statusNode) {
      statusNode.textContent = `${visibleCount} ${visibleCount === 1 ? 'Einzelplan ist' : 'Einzelpläne sind'} für ${activeYear} sichtbar.`;
    }

    if (emptyNode) {
      emptyNode.hidden = visibleCount > 0 || ['overview', 'revenue', 'funds'].includes(activeView);
    }
  };

  for (const button of yearButtons) {
    button.addEventListener('click', () => {
      activeYear = button.dataset.budgetYear ?? '2025';
      update();
    });
  }

  for (const button of viewButtons) {
    button.addEventListener('click', () => {
      setActiveView(button.dataset.budgetView ?? 'overview');
      update();
    });

    button.addEventListener('keydown', (event) => {
      const currentIndex = viewButtons.indexOf(button);
      let nextIndex = currentIndex;

      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % viewButtons.length;
      if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + viewButtons.length) % viewButtons.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = viewButtons.length - 1;

      if (nextIndex !== currentIndex) {
        event.preventDefault();
        setActiveView(viewButtons[nextIndex].dataset.budgetView ?? 'overview', true);
        update();
      }
    });
  }

  const updateViewFromHash = () => {
    const view = window.location.hash.replace(/^#budget-tab-/u, '');
    if (view && view !== window.location.hash) {
      setActiveView(view);
      update();
    }
  };

  queryInput?.addEventListener('input', update);
  categorySelect?.addEventListener('change', update);
  stateSelect?.addEventListener('change', update);
  window.addEventListener('hashchange', updateViewFromHash);
  updateViewFromHash();
  update();
}

function initFaqModules(): void {
  const roots = document.querySelectorAll<HTMLElement>('[data-faq-root]');

  for (const root of roots) {
    const allowMultiple = root.dataset.allowMultiple !== 'false';

    if (allowMultiple) {
      continue;
    }

    const details = Array.from(root.querySelectorAll<HTMLDetailsElement>('details'));
    for (const item of details) {
      item.addEventListener('toggle', () => {
        if (!item.open) {
          return;
        }

        for (const other of details) {
          if (other !== item) {
            other.open = false;
          }
        }
      });
    }
  }
}

function initCareerFilterModule(): void {
  const form = document.querySelector<HTMLFormElement>('[data-role="career-filter"]');
  if (!form) {
    return;
  }

  const cards = Array.from(document.querySelectorAll<HTMLElement>('.job-filter-card'));
  const countNode = document.getElementById('career-filter-count');
  const emptyNode = document.getElementById('career-filter-empty');

  const update = () => {
    const data = new FormData(form);
    const query = String(data.get('query') ?? '').trim().toLowerCase();
    const ressort = String(data.get('ressort') ?? '');
    const standort = String(data.get('standort') ?? '');
    const employmentType = String(data.get('employmentType') ?? '');

    let visibleCount = 0;

    for (const card of cards) {
      const matchesQuery = !query || String(card.getAttribute('data-search') ?? '').includes(query);
      const matchesRessort = !ressort || card.getAttribute('data-ressort') === ressort;
      const matchesStandort = !standort || card.getAttribute('data-standort') === standort;
      const matchesEmployment =
        !employmentType || card.getAttribute('data-employment-type') === employmentType;
      const visible = matchesQuery && matchesRessort && matchesStandort && matchesEmployment;

      card.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    }

    if (countNode) {
      countNode.textContent = `${visibleCount} Stellenangebote sichtbar`;
    }

    if (emptyNode) {
      emptyNode.hidden = visibleCount !== 0;
    }
  };

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();
}

function initPressReleaseFilterModule(): void {
  const form = document.querySelector<HTMLFormElement>('[data-role="press-release-filter"]');
  if (!form) {
    return;
  }

  const cards = Array.from(document.querySelectorAll<HTMLElement>('.press-release-filter-card'));
  const countNode = document.getElementById('press-release-filter-count');
  const emptyNode = document.getElementById('press-release-filter-empty');

  const update = () => {
    const data = new FormData(form);
    const query = String(data.get('query') ?? '').trim().toLocaleLowerCase('de-DE');
    const ressort = String(data.get('ressort') ?? '');
    const year = String(data.get('year') ?? '');
    const tag = String(data.get('tag') ?? '');
    let visibleCount = 0;

    for (const card of cards) {
      const tags = String(card.dataset.tags ?? '').split('|');
      const visible =
        (!query || String(card.dataset.search ?? '').includes(query)) &&
        (!ressort || card.dataset.ressort === ressort) &&
        (!year || card.dataset.year === year) &&
        (!tag || tags.includes(tag));

      card.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    }

    if (countNode) {
      countNode.textContent = `${visibleCount} Mitteilungen sichtbar`;
    }

    if (emptyNode) {
      emptyNode.hidden = visibleCount !== 0;
    }
  };

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();
}

function initContactRouterModule(): void {
  const form = document.querySelector<HTMLFormElement>('[data-role="contact-router"]');
  if (!form) {
    return;
  }

  const cards = Array.from(document.querySelectorAll<HTMLElement>('.contact-route-card'));
  const status = document.querySelector<HTMLElement>('[data-contact-router-status]');

  const update = () => {
    const data = new FormData(form);
    const topic = String(data.get('topic') ?? '');

    for (const card of cards) {
      const key = card.getAttribute('data-route-key');
      card.hidden = !topic || key !== topic;
    }

    const selectedCard = cards.find((card) => card.getAttribute('data-route-key') === topic);
    if (status) {
      status.textContent = selectedCard
        ? `Kontaktweg angezeigt: ${selectedCard.dataset.routeTitle ?? 'passender Kontaktweg'}.`
        : 'Wählen Sie ein Anliegen aus. Das passende Ergebnis erscheint anschließend unterhalb der Auswahl.';
    }
  };

  form.addEventListener('change', update);
  update();
}

function initBudgetYearSwitchers(): void {
  const roots = document.querySelectorAll<HTMLElement>('[data-budget-year-switcher]');

  for (const root of roots) {
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-budget-year-option]'));
    const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-budget-year-content]'));
    const status = root.querySelector<HTMLElement>('[data-budget-year-status]');
    let selected = buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.budgetYearOption ?? '2026';

    const update = () => {
      for (const button of buttons) {
        const active = button.dataset.budgetYearOption === selected;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      }

      for (const panel of panels) {
        panel.hidden = panel.dataset.budgetYearContent !== selected;
      }

      if (status) {
        status.textContent = selected === 'vergleich'
          ? 'Der Vergleich der Haushaltsjahre 2025 und 2026 wird angezeigt.'
          : `Die Kennzahlen für das Haushaltsjahr ${selected} werden angezeigt.`;
      }
    };

    for (const button of buttons) {
      button.addEventListener('click', () => {
        selected = button.dataset.budgetYearOption ?? selected;
        update();
      });
    }

    update();
  }
}

function initBudgetPlanTables(): void {
  const roots = document.querySelectorAll<HTMLElement>('[data-budget-plan-table]');

  for (const root of roots) {
    const category = root.querySelector<HTMLSelectElement>('[data-budget-plan-filter="category"]');
    const sort = root.querySelector<HTMLSelectElement>('[data-budget-plan-filter="sort"]');
    const query = root.querySelector<HTMLInputElement>('[data-budget-plan-filter="query"]');
    const body = root.querySelector<HTMLTableSectionElement>('tbody');
    const rows = Array.from(root.querySelectorAll<HTMLTableRowElement>('[data-budget-plan-row]'));
    const status = root.querySelector<HTMLElement>('[data-budget-plan-status]');
    const empty = root.querySelector<HTMLElement>('[data-budget-plan-empty]');

    const update = () => {
      const categoryValue = category?.value ?? '';
      const queryValue = (query?.value ?? '').trim().toLocaleLowerCase('de-DE');
      const sortValue = sort?.value ?? 'number';
      const visibleRows = rows.filter((row) => {
        const matchesCategory = !categoryValue || row.dataset.category === categoryValue;
        const matchesQuery = !queryValue || (row.dataset.search ?? '').includes(queryValue);
        row.hidden = !(matchesCategory && matchesQuery);
        return !row.hidden;
      });

      visibleRows.sort((left, right) => {
        if (sortValue === 'expenses') return Number(right.dataset.expenses) - Number(left.dataset.expenses);
        if (sortValue === 'change') return Number(right.dataset.change) - Number(left.dataset.change);
        if (sortValue === 'category') return (left.dataset.category ?? '').localeCompare(right.dataset.category ?? '', 'de');
        return Number(left.dataset.number) - Number(right.dataset.number);
      });

      for (const row of visibleRows) {
        body?.append(row);
      }

      if (status) {
        status.textContent = `${visibleRows.length} von ${rows.length} Einzelplänen sichtbar.`;
      }
      if (empty) {
        empty.hidden = visibleRows.length > 0;
      }
    };

    category?.addEventListener('change', update);
    sort?.addEventListener('change', update);
    query?.addEventListener('input', update);
    update();
  }
}

for (const root of document.querySelectorAll<HTMLElement>('[data-action-plan-root]')) {
  filterActionPlanModule(root);
}

for (const root of document.querySelectorAll<HTMLElement>('[data-timeline-root]')) {
  filterTimelineModule(root);
}

for (const root of document.querySelectorAll<HTMLElement>('[data-budget-root]')) {
  filterBudgetModule(root);
}

initBudgetYearSwitchers();
initBudgetPlanTables();
initFaqModules();
initCareerFilterModule();
initPressReleaseFilterModule();
initContactRouterModule();
