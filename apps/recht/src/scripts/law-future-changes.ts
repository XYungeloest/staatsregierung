import { EDITORIAL_REFERENCE_DATE, partitionDatedEntries } from '@ostrecht/shared/lib/norms/versions.ts';

/**
 * Änderungsdienst der Startseite: Maßgeblich ist der redaktionelle Stichtag (Rechtsstand), nicht
 * die Uhr des Browsers. Einträge werden nach Datum auf die drei Spalten verteilt: Ereignisse nach
 * dem Stichtag stehen unter „Verkündet, noch nicht in Kraft“, Aufhebungen bis zum Stichtag unter
 * „Außer Kraft getreten“, alles andere unter „Neu in Kraft getreten“.
 */
const LIMIT = 5;
const lists = {
  current: document.querySelector<HTMLOListElement>('[data-law-change-list="current"]'),
  future: document.querySelector<HTMLOListElement>('[data-law-change-list="future"]'),
  repealed: document.querySelector<HTMLOListElement>('[data-law-change-list="repealed"]'),
};

if (lists.current && lists.future && lists.repealed) {
  const entries = Array.from(document.querySelectorAll<HTMLElement>('[data-law-change]'))
    .flatMap((element) => {
      const date = element.dataset.effectiveDate;
      return date ? [{ date, element }] : [];
    });
  const { current, future } = partitionDatedEntries(entries, EDITORIAL_REFERENCE_DATE);
  const repealed = current.filter((entry) => entry.element.dataset.changeType === 'repeal');
  const inForce = current.filter((entry) => entry.element.dataset.changeType !== 'repeal');

  const place = (candidates: typeof entries, list: HTMLOListElement, isFuture: boolean) => {
    candidates
      .sort((left, right) => (isFuture ? left.date.localeCompare(right.date) : right.date.localeCompare(left.date)))
      .forEach(({ element }, index) => {
        const label = element.querySelector<HTMLElement>('[data-law-change-label]');
        const labelText = isFuture ? element.dataset.futureLabel : element.dataset.currentLabel;
        if (label && labelText) label.textContent = labelText;
        const time = element.querySelector<HTMLTimeElement>('time');
        if (time) {
          const short = time.dateTime.split('-').reverse().join('.');
          time.textContent = isFuture ? `ab ${short}` : short;
          time.classList.toggle('r-future-text', isFuture);
          time.classList.toggle('r-muted', !isFuture);
        }
        element.hidden = index >= LIMIT;
        list.append(element);
      });
    const empty = list.parentElement?.querySelector<HTMLElement>('[data-law-change-empty]');
    if (empty) empty.hidden = candidates.length > 0;
  };

  place(inForce, lists.current, false);
  place(future, lists.future, true);
  place(repealed, lists.repealed, false);
}
