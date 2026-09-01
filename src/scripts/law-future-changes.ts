import { getBerlinCalendarDate, isStrictlyFutureEffectiveDate } from '../lib/norms/versions.ts';

const futureChanges = document.querySelector<HTMLElement>('[data-visual-section="law-future-changes"]');

if (futureChanges) {
  const today = getBerlinCalendarDate();
  const entries = Array.from(futureChanges.querySelectorAll<HTMLElement>('[data-law-future-change]'));
  let visible = 0;

  entries.forEach((entry) => {
    const effectiveDate = entry.dataset.effectiveDate;
    const isFuture = Boolean(effectiveDate && isStrictlyFutureEffectiveDate(effectiveDate, today));
    entry.hidden = !isFuture;
    if (isFuture) visible += 1;
  });

  futureChanges.hidden = visible === 0;
}
