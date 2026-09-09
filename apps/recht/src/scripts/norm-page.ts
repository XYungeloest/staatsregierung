/**
 * Normansicht: aktuelle Stelle in der Inhaltsübersicht, Filter der Übersicht, Zitat der
 * aktuellen Stelle in der Seitenspalte, mobile Übersicht, Einzeldruck eines Paragraphen.
 * Kopieren von Links und Zitaten übernimmt shell.ts ([data-copy-url], [data-copy-text]).
 */
const outlineLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-outline-link]'));
const cite = document.querySelector<HTMLElement>('[data-norm-cite]');
const citeText = cite?.querySelector<HTMLElement>('[data-cite-text]');
const citeLink = cite?.querySelector<HTMLButtonElement>('[data-cite-link]');
const citeAbbr = cite?.dataset.citeAbbr ?? '';
const citeSuffix = cite?.dataset.citeSuffix ?? '';
const citeLinkDefault = citeLink?.textContent ?? '';

function setActive(id: string): void {
  for (const link of outlineLinks) {
    if (link.dataset.outlineLink === id) {
      link.setAttribute('aria-current', 'location');
      const container = link.closest<HTMLElement>('.norm-outline--desktop');
      if (container) {
        const box = link.getBoundingClientRect();
        const frame = container.getBoundingClientRect();
        if (box.top < frame.top || box.bottom > frame.bottom) link.scrollIntoView({ block: 'nearest' });
      }
    } else {
      link.removeAttribute('aria-current');
    }
  }
  const unit = document.getElementById(id);
  const label = unit?.matches('[data-norm-unit]') ? unit.dataset.unitLabel : unit?.closest<HTMLElement>('[data-norm-unit]')?.dataset.unitLabel;
  if (citeText) citeText.textContent = label ? `${label} ${citeAbbr}${citeSuffix}` : `${citeAbbr}${citeSuffix}`;
  if (citeLink) {
    const unitId = unit?.matches('[data-norm-unit]') ? unit.id : unit?.closest<HTMLElement>('[data-norm-unit]')?.id;
    citeLink.dataset.copyUrl = unitId ?? '';
    citeLink.textContent = label ? `Link zu ${label} kopieren` : citeLinkDefault;
  }
}

const targets = [...new Set(outlineLinks.map((link) => link.dataset.outlineLink).filter(Boolean))]
  .map((id) => document.getElementById(id!))
  .filter((entry): entry is HTMLElement => Boolean(entry));

if (targets.length > 0 && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
    if (visible?.target.id) setActive(visible.target.id);
  }, { rootMargin: '-12% 0px -72% 0px' });
  targets.forEach((target) => observer.observe(target));
}

for (const link of outlineLinks) {
  link.addEventListener('click', () => {
    setActive(link.dataset.outlineLink ?? '');
    const sheet = link.closest<HTMLDetailsElement>('[data-outline-sheet]');
    if (sheet) sheet.open = false;
  });
}

// Filter der Inhaltsübersicht: blendet Einträge aus, die den Text nicht enthalten.
for (const input of document.querySelectorAll<HTMLInputElement>('[data-outline-search]')) {
  input.addEventListener('input', () => {
    const nav = input.closest('nav');
    const query = input.value.trim().toLocaleLowerCase('de-DE');
    nav?.querySelectorAll<HTMLLIElement>('.norm-outline__list li').forEach((item) => {
      item.hidden = Boolean(query) && !(item.textContent ?? '').toLocaleLowerCase('de-DE').includes(query);
    });
  });
}

// Schaltfläche „Inhalt“: öffnet die mobile Übersicht und setzt den Fokus in ihr Filterfeld.
for (const opener of document.querySelectorAll<HTMLAnchorElement>('[data-outline-open]')) {
  opener.addEventListener('click', (event) => {
    const sheet = document.querySelector<HTMLDetailsElement>('[data-outline-sheet]');
    if (!sheet || sheet.offsetParent === null && getComputedStyle(sheet).display === 'none') return;
    event.preventDefault();
    sheet.open = true;
    sheet.scrollIntoView({ block: 'start' });
    sheet.querySelector<HTMLInputElement>('[data-outline-search]')?.focus();
  });
}

// Einzeldruck: nur die gewählte Einheit.
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLElement>('[data-print-unit]');
  if (!button?.dataset.printUnit) return;
  const target = document.getElementById(button.dataset.printUnit);
  document.body.classList.add('print-single-norm-unit');
  target?.classList.add('print-target');
  window.print();
  document.body.classList.remove('print-single-norm-unit');
  target?.classList.remove('print-target');
});

// Anker der Adresse beim Laden in Übersicht und Zitat übernehmen.
if (window.location.hash) {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (document.getElementById(id)) setActive(id);
}

// Bereiche bleiben ohne JavaScript als verlinkte Dokumentabschnitte erreichbar.
const workspace = document.querySelector<HTMLElement>('.norm-workspace');
const facts = document.querySelector<HTMLElement>('.norm-facts');
const relations = document.querySelector<HTMLElement>('.norm-relations');
const detailsArea = document.querySelector<HTMLElement>('.norm-details');
const mobileOutline = document.querySelector<HTMLElement>('.norm-outline-mobile');
const tabs = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-norm-tab]'));
const mobile = window.matchMedia('(max-width: 47.99rem)');
const factsDisclosure = document.createElement('details');
factsDisclosure.className = 'norm-facts-disclosure';
const factsSummary = document.createElement('summary');
factsSummary.textContent = 'Vorschriftendaten';
factsDisclosure.append(factsSummary);
if (facts) { facts.before(factsDisclosure); factsDisclosure.append(facts); }

const timeline = document.querySelector<HTMLElement>('.norm-aside__versions');
const aside = timeline?.parentElement;
function updateNormView(): void {
  const section = location.hash === '#vorschriftendaten' ? 'facts' : location.hash === '#rechtsbeziehungen' ? 'relations' : 'text';
  if (workspace) workspace.hidden = section !== 'text';
  if (mobileOutline) mobileOutline.hidden = section !== 'text';
  if (detailsArea) detailsArea.hidden = section === 'text' && !mobile.matches;
  if (facts) facts.hidden = section === 'relations';
  factsDisclosure.hidden = section === 'relations';
  factsDisclosure.open = !mobile.matches || section === 'facts';
  if (relations) relations.hidden = section === 'facts';
  tabs.forEach((tab) => {
    if (tab.dataset.normTab === section) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  if (timeline && workspace && aside) {
    if (mobile.matches) workspace.prepend(timeline);
    else aside.prepend(timeline);
    const selected = timeline.querySelector<HTMLElement>('.norm-timeline__entry--shown');
    const track = timeline.querySelector<HTMLElement>('.norm-timeline');
    if (mobile.matches && track && selected) track.scrollLeft = selected.offsetLeft - track.offsetLeft - (track.clientWidth - selected.clientWidth) / 2;
  }
}
for (const tab of tabs) {
  if (tab.dataset.normTab === 'versions') continue;
  tab.addEventListener('click', (event) => {
    event.preventDefault();
    history.pushState(null, '', tab.href);
    updateNormView();
    const target = tab.dataset.normTab === 'facts' ? facts : tab.dataset.normTab === 'relations' ? relations : workspace;
    target?.setAttribute('tabindex', '-1');
    target?.focus({ preventScroll: true });
  });
}
window.addEventListener('hashchange', updateNormView);
window.addEventListener('popstate', updateNormView);
mobile.addEventListener('change', updateNormView);
updateNormView();

window.addEventListener('beforeprint', () => {
  for (const element of [workspace, detailsArea, facts, relations, factsDisclosure]) if (element) element.hidden = false;
  factsDisclosure.open = true;
});
window.addEventListener('afterprint', updateNormView);
