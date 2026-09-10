/**
 * Hülle: Drucken über [data-print-page], „/“ fokussiert die Suche, Aufklappmenüs schließen
 * bei Klick außerhalb und mit Escape, Kopieren von Adressen und Zitaten mit Rückmeldung.
 */
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-print-page]')) window.print();
  for (const menu of document.querySelectorAll<HTMLDetailsElement>('.law-mobile-nav[open]')) {
    if (!menu.contains(event.target)) menu.open = false;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    for (const menu of document.querySelectorAll<HTMLDetailsElement>('.law-mobile-nav[open]')) {
      menu.open = false;
      menu.querySelector<HTMLElement>('summary')?.focus();
    }
    return;
  }
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
  const field = document.querySelector<HTMLInputElement>('[data-search-query]') ?? document.querySelector<HTMLInputElement>('#law-header-search');
  if (!field || field.offsetParent === null) return;
  event.preventDefault();
  field.focus();
  field.select();
});

/**
 * Kopieren: [data-copy-text] kopiert den Inhalt von [data-copy-source] oder den eigenen Text,
 * [data-copy-url] die Seitenadresse (ohne Anker, mit optionalem Anker aus data-copy-url).
 * Rückmeldung in [data-copy-feedback] derselben Gruppe ([data-copy-group]) oder direkt daneben.
 */
function feedbackFor(button: HTMLElement): HTMLElement | null {
  const group = button.closest<HTMLElement>('[data-copy-group]');
  return group?.querySelector<HTMLElement>('[data-copy-feedback]') ?? button.parentElement?.querySelector<HTMLElement>('[data-copy-feedback]') ?? null;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

document.addEventListener('click', async (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLElement>('[data-copy-text], [data-copy-url]');
  if (!button) return;
  if (button instanceof HTMLAnchorElement) {
    // Der Link kopiert die Adresse; die Seite springt nicht, der Anker steht danach in der Adresszeile.
    event.preventDefault();
    if (button.dataset.copyUrl) window.history.replaceState(null, '', `#${button.dataset.copyUrl}`);
  }
  const feedback = feedbackFor(button);
  let text = '';
  let done = '';
  let failed = '';
  if (button.hasAttribute('data-copy-url')) {
    const url = new URL(button.dataset.copyHref ?? window.location.href, window.location.href);
    url.search = url.searchParams.size > 0 && button.dataset.copyKeepQuery === 'true' ? url.search : '';
    url.hash = button.dataset.copyUrl ?? '';
    text = url.toString();
    done = button.dataset.copyDone ?? 'Link wurde kopiert.';
    failed = 'Der Link kann aus der Adresszeile kopiert werden.';
  } else {
    const sourceId = button.dataset.copyText;
    const source = sourceId ? document.getElementById(sourceId) : null;
    text = (source?.textContent ?? button.dataset.copyValue ?? '').replace(/\s+/gu, ' ').trim();
    done = button.dataset.copyDone ?? 'Wurde kopiert.';
    failed = 'Kann aus der Seite kopiert werden.';
  }
  const ok = text ? await copy(text) : false;
  if (feedback) feedback.textContent = ok ? done : failed;
});

import './sheets.ts';

/** Das Amtsband bleibt im Fluss. Nur seine Transformation folgt der Leserichtung. */
const header = document.querySelector<HTMLElement>('.law-header');
const backToTop = document.querySelector<HTMLButtonElement>('[data-back-to-top]');
if (header && backToTop) {
  const root = document.documentElement;
  const menu = header.querySelector<HTMLDetailsElement>('.law-mobile-nav');
  const consent = document.querySelector<HTMLElement>('.consent-banner');
  const footer = document.querySelector<HTMLElement>('.law-footer');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hideAfter = 100;
  const directionThreshold = 12;
  let lastY = Math.max(0, window.scrollY);
  let movement = 0;
  let frame = 0;
  let footerVisible = false;

  const showHeader = (visible: boolean) => {
    header.classList.toggle('is-scroll-hidden', !visible);
    header.classList.toggle('is-scroll-visible', visible);
  };
  const update = () => {
    frame = 0;
    const y = Math.max(0, window.scrollY);
    const delta = y - lastY;
    lastY = y;
    const interacting = header.contains(document.activeElement) || Boolean(menu?.open)
      || Boolean(header.querySelector('[aria-expanded="true"]'));
    if (y <= hideAfter || interacting) {
      showHeader(true);
      movement = 0;
    } else if (delta !== 0) {
      movement = Math.sign(delta) === Math.sign(movement) ? movement + delta : delta;
      if (Math.abs(movement) >= directionThreshold) {
        showHeader(movement < 0);
        movement = 0;
      }
    }
    const blocked = Boolean(menu?.open) || Boolean(consent && !consent.hidden)
      || Boolean(document.querySelector('dialog[open]')) || footerVisible;
    const hideButton = y < Math.max(600, window.innerHeight) || blocked;
    if (backToTop.hidden !== hideButton) backToTop.hidden = hideButton;
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const measureHeader = () => {
    root.style.setProperty('--law-header-height', `${header.offsetHeight}px`);
    schedule();
  };
  new ResizeObserver(measureHeader).observe(header);
  measureHeader();
  showHeader(true);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  header.addEventListener('focusin', () => { showHeader(true); movement = 0; schedule(); });
  header.addEventListener('focusout', schedule);
  menu?.addEventListener('toggle', () => { movement = 0; schedule(); });
  // Menüs, native Dialoge und Einwilligung können sich ohne Scroll-Ereignis ändern.
  new MutationObserver(schedule).observe(document.body, {
    subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'aria-expanded'],
  });
  if (footer) new IntersectionObserver(([entry]) => {
    footerVisible = entry.isIntersecting;
    schedule();
  }).observe(footer);
  backToTop.addEventListener('click', () => {
    showHeader(true);
    // Der verschwindende Knopf lässt den Tastaturfokus am erreichbaren Seitenanfang zurück.
    header.querySelector<HTMLElement>('.law-wordmark')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  });
  schedule();
}
