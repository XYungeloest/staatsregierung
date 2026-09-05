import { EDITORIAL_REFERENCE_DATE, partitionDatedEntries } from '@ostrecht/shared/lib/norms/versions.ts';

const currentChanges = document.querySelector<HTMLElement>('[data-visual-section="law-latest-status"]');
const currentList = document.querySelector<HTMLOListElement>('[data-law-current-change-list]');
const futureChanges = document.querySelector<HTMLElement>('[data-visual-section="law-future-changes"]');
const futureList = document.querySelector<HTMLOListElement>('[data-law-future-change-list]');

if (currentChanges && currentList) {
  const entries = Array.from(document.querySelectorAll<HTMLElement>('[data-law-change]'))
    .flatMap((element) => {
      const date = element.dataset.effectiveDate;
      return date ? [{ date, element }] : [];
    });
  // Maßgeblich ist der redaktionelle Stichtag (Rechtsstand), nicht die Uhr des Browsers.
  const { current, future } = partitionDatedEntries(entries, EDITORIAL_REFERENCE_DATE);
  const placeEntries = (
    candidates: typeof entries,
    list: HTMLOListElement,
    isFuture: boolean,
    limit: number,
  ) => {
    candidates
      .sort((left, right) => isFuture
        ? left.date.localeCompare(right.date)
        : right.date.localeCompare(left.date))
      .forEach(({ element }, index) => {
        const label = element.querySelector<HTMLElement>('[data-law-change-label]');
        const labelText = isFuture ? element.dataset.futureLabel : element.dataset.currentLabel;
        if (label && labelText) {
          label.textContent = labelText;
          label.classList.toggle('law-type-label--future', isFuture);
        }
        element.hidden = index >= limit;
        list.append(element);
      });
  };

  // Beide Spalten zeigen dieselbe Anzahl Einträge (Startseite: HOME_CURRENT_CHANGE_LIMIT/HOME_FUTURE_CHANGE_LIMIT).
  placeEntries(current, currentList, false, 4);
  if (futureList) placeEntries(future, futureList, true, 4);

  currentChanges.hidden = current.length === 0;
  const futureEmpty = document.querySelector<HTMLElement>('[data-law-future-empty]');
  if (futureEmpty) futureEmpty.hidden = future.length > 0;
}
