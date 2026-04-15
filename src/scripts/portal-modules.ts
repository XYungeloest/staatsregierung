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

function filterLegislationModule(root: HTMLElement): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-legislation-item]'));
  const stageSelect = root.querySelector<HTMLSelectElement>('[data-legislation-filter="stage"]');
  const ressortSelect = root.querySelector<HTMLSelectElement>('[data-legislation-filter="ressort"]');
  const emptyNode = root.querySelector<HTMLElement>('[data-legislation-empty]');

  const update = () => {
    const stage = stageSelect?.value ?? '';
    const ressort = ressortSelect?.value ?? '';
    let visibleCount = 0;

    for (const item of items) {
      const matchesStage = !stage || item.dataset.stage === stage;
      const matchesRessort = !ressort || item.dataset.ressort === ressort;
      const visible = matchesStage && matchesRessort;
      item.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    }

    if (emptyNode) {
      emptyNode.hidden = visibleCount > 0;
    }
  };

  stageSelect?.addEventListener('change', update);
  ressortSelect?.addEventListener('change', update);
  update();
}

function filterBudgetModule(root: HTMLElement): void {
  const yearButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-budget-year]'));
  const queryInput = root.querySelector<HTMLInputElement>('[data-budget-filter="query"]');
  const categorySelect = root.querySelector<HTMLSelectElement>('[data-budget-filter="category"]');
  const entries = Array.from(root.querySelectorAll<HTMLElement>('[data-budget-entry]'));
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-budget-row]'));
  const summaries = Array.from(root.querySelectorAll<HTMLElement>('[data-budget-summary]'));
  const emptyNode = root.querySelector<HTMLElement>('[data-budget-empty]');

  let activeYear = '2025';

  const update = () => {
    const query = (queryInput?.value ?? '').trim().toLocaleLowerCase('de-DE');
    const category = categorySelect?.value ?? '';
    let visibleCount = 0;

    for (const button of yearButtons) {
      button.classList.toggle('is-active', button.dataset.budgetYear === activeYear);
      button.setAttribute('aria-pressed', button.dataset.budgetYear === activeYear ? 'true' : 'false');
    }

    for (const summary of summaries) {
      summary.hidden = summary.dataset.year !== activeYear;
    }

    const matchesCommonFilters = (element: HTMLElement) => {
      const matchesYear = element.dataset.year === activeYear;
      const matchesCategory = !category || element.dataset.category === category;
      const label = element.dataset.label ?? '';
      const matchesQuery = !query || label.includes(query);
      return matchesYear && matchesCategory && matchesQuery;
    };

    for (const entry of entries) {
      const visible = matchesCommonFilters(entry);
      entry.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    }

    for (const row of rows) {
      row.hidden = !matchesCommonFilters(row);
    }

    if (emptyNode) {
      emptyNode.hidden = visibleCount > 0;
    }
  };

  for (const button of yearButtons) {
    button.addEventListener('click', () => {
      activeYear = button.dataset.budgetYear ?? '2025';
      update();
    });
  }

  queryInput?.addEventListener('input', update);
  categorySelect?.addEventListener('change', update);
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

function initContactRouterModule(): void {
  const form = document.querySelector<HTMLFormElement>('[data-role="contact-router"]');
  if (!form) {
    return;
  }

  const cards = Array.from(document.querySelectorAll<HTMLElement>('.contact-route-card'));

  const update = () => {
    const data = new FormData(form);
    const topic = String(data.get('topic') ?? '');

    for (const card of cards) {
      const key = card.getAttribute('data-route-key');
      card.hidden = !topic || key !== topic;
    }
  };

  form.addEventListener('change', update);
  update();
}

for (const root of document.querySelectorAll<HTMLElement>('[data-action-plan-root]')) {
  filterActionPlanModule(root);
}

for (const root of document.querySelectorAll<HTMLElement>('[data-timeline-root]')) {
  filterTimelineModule(root);
}

for (const root of document.querySelectorAll<HTMLElement>('[data-legislation-root]')) {
  filterLegislationModule(root);
}

for (const root of document.querySelectorAll<HTMLElement>('[data-budget-root]')) {
  filterBudgetModule(root);
}

initFaqModules();
initCareerFilterModule();
initContactRouterModule();
