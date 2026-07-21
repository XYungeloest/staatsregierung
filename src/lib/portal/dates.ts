import type { Stellenangebot, Termin } from './schema.ts';
import editorialConfig from '../../config/editorial.json' with { type: 'json' };

/**
 * Editorial reference date for the static portal build. Content that is no longer
 * current is kept in its archive, but is not presented as an upcoming item.
 */
export const PORTAL_REFERENCE_DATE = editorialConfig.referenceDate;

export function isCurrentOrFuture(date: string, referenceDate = PORTAL_REFERENCE_DATE): boolean {
  return date >= referenceDate;
}

export function isPast(date: string, referenceDate = PORTAL_REFERENCE_DATE): boolean {
  return date < referenceDate;
}

export function isToday(date: string, referenceDate = PORTAL_REFERENCE_DATE): boolean {
  return date === referenceDate;
}

export function splitEventsByDate(
  entries: Termin[],
  referenceDate = PORTAL_REFERENCE_DATE,
): { upcoming: Termin[]; past: Termin[] } {
  const upcoming = entries
    .filter((entry) => isCurrentOrFuture(entry.date, referenceDate))
    .sort((left, right) => left.date.localeCompare(right.date));
  const past = entries
    .filter((entry) => isPast(entry.date, referenceDate))
    .sort((left, right) => right.date.localeCompare(left.date));

  return { upcoming, past };
}

export function splitJobOffersByDeadline(
  entries: Stellenangebot[],
  referenceDate = PORTAL_REFERENCE_DATE,
): { current: Stellenangebot[]; expired: Stellenangebot[] } {
  const current = entries
    .filter((entry) => isCurrentOrFuture(entry.applicationDeadline, referenceDate))
    .sort((left, right) => right.datePosted.localeCompare(left.datePosted));
  const expired = entries
    .filter((entry) => isPast(entry.applicationDeadline, referenceDate))
    .sort((left, right) => right.applicationDeadline.localeCompare(left.applicationDeadline));

  return { current, expired };
}
