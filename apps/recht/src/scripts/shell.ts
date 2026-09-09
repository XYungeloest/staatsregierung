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
    const url = new URL(window.location.href);
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
