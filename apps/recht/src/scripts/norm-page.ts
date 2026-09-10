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

/** Öffnet alle Gliederungsgruppen, in denen ein Eintrag liegt (nur geschlossene). */
function openGroupsOf(element: Element): void {
  for (let group = element.closest<HTMLDetailsElement>('[data-outline-group]'); group; group = group.parentElement?.closest<HTMLDetailsElement>('[data-outline-group]') ?? null) {
    if (!group.open) group.open = true;
  }
}

function setActive(id: string): void {
  for (const link of outlineLinks) {
    if (link.dataset.outlineLink === id) {
      link.setAttribute('aria-current', 'location');
      openGroupsOf(link);
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
    // Gliederungsabschnitte umschließen ihre Paragraphen und schneiden das Lesefenster daher
    // fast immer: Ein Ziel, das ein anderes sichtbares Ziel enthält, tritt zurück.
    const visible = entries.filter((entry) => entry.isIntersecting);
    const active = visible
      .filter((entry) => !visible.some((other) => other !== entry && entry.target.contains(other.target)))
      .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
    if (active?.target.id) setActive(active.target.id);
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

// Filter der Inhaltsübersicht: blendet Einträge aus, die den Text nicht enthalten; Gruppen mit
// Treffern öffnen sich, Gruppen ohne Treffer verschwinden. Ohne Filter bleibt der Zustand.
for (const input of document.querySelectorAll<HTMLInputElement>('[data-outline-search]')) {
  input.addEventListener('input', () => {
    const nav = input.closest('nav');
    const query = input.value.trim().toLocaleLowerCase('de-DE');
    const groups = Array.from(nav?.querySelectorAll<HTMLDetailsElement>('[data-outline-group]') ?? []);
    nav?.querySelectorAll<HTMLLIElement>('.norm-outline__list li').forEach((item) => {
      const own = item.querySelector(':scope > a, :scope > details > summary');
      item.hidden = Boolean(query) && !(own?.textContent ?? '').toLocaleLowerCase('de-DE').includes(query)
        && !Array.from(item.querySelectorAll('li > a')).some((link) => (link.textContent ?? '').toLocaleLowerCase('de-DE').includes(query));
    });
    for (const group of groups) {
      if (!query) continue;
      const hasMatch = Array.from(group.querySelectorAll<HTMLLIElement>('li')).some((item) => !item.hidden);
      const item = group.closest<HTMLLIElement>('li');
      if (item) item.hidden = !hasMatch && !(group.querySelector('summary')?.textContent ?? '').toLocaleLowerCase('de-DE').includes(query);
      if (hasMatch) group.open = true;
    }
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

// Die Fassungsfolge wechselt ihre Position im responsiven Leseraster: auf dem Smartphone steht
// sie als geschlossener Aufklappbereich über dem Text, sonst offen in der Seitenspalte.
const workspace = document.querySelector<HTMLElement>('.norm-workspace');
const mobile = window.matchMedia('(max-width: 47.99rem)');
const timeline = document.querySelector<HTMLElement>('.norm-aside__versions');
const versionsDetails = timeline?.querySelector<HTMLDetailsElement>('[data-versions-details]');
const aside = timeline?.parentElement;
function positionTimeline(): void {
  if (!timeline || !workspace || !aside) return;
  if (mobile.matches) workspace.prepend(timeline);
  else aside.prepend(timeline);
  if (versionsDetails) versionsDetails.open = !mobile.matches;
}
mobile.addEventListener('change', positionTimeline);
positionTimeline();
