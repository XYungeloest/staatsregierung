import { formatSubjectLabel } from '@ostrecht/shared/config/law-subjects.ts';
import { lawSiteConfig } from '@ostrecht/shared/config/site.ts';
import { NORM_ORIGIN_KINDS, formatNormOriginKind, type NormOriginKind } from '@ostrecht/shared/lib/norms/origin.ts';

import { formatCount } from '../counts.ts';
import { VALIDITY_FIELD_LABEL, validityOptions } from '../vocabulary.ts';
import { buildPagination, pageUrl, type Pagination } from './pagination.ts';
import { DEFAULT_PAGE_SIZE, normalizePage, type IndexLetterCount, type NormPage, type NormStore } from './store.ts';

/**
 * Gemeinsamer Zustand der Normverzeichnisse (Gesetze, Verordnungen, Verwaltungsvorschriften,
 * Förderrichtlinien, Sachgebiet): Filter und Seiten laufen serverseitig über GET-Parameter, die
 * Buchstabenleiste ist die Sprungnavigation zwischen den Seiten. Ein Aufruf liefert nie mehr
 * als eine Seite (DEFAULT_PAGE_SIZE) Übersichtszeilen.
 *
 * Parameter: `q` Titel/Abkürzung/Stichwort, `subject` Sachgebiet, `type` Normtyp, `status`
 * Rechtsstand, `origin` Rechtsherkunft, `aenderungen` übernommene Änderungsvorschriften,
 * `buchstabe` Buchstabengruppe, `seite` Seite.
 */

export interface DirectoryScope {
  types?: string[];
  subjectSlug?: string;
}

export type DirectoryFieldName = 'q' | 'subject' | 'type' | 'status' | 'origin' | 'aenderungen';

/**
 * Auswahl des Felds „Übernommene Änderungsvorschriften“. Ohne Auswahl zeigt ein Verzeichnis die
 * Grundmenge; `uebernommen` bezieht die übernommenen Änderungsvorschriften wieder ein.
 */
export const INHERITED_AMENDMENT_VALUE = 'uebernommen';

export interface DirectoryFieldOption {
  value: string;
  label: string;
}

export interface DirectoryField {
  name: DirectoryFieldName;
  label: string;
  value: string;
  options?: DirectoryFieldOption[];
  allLabel?: string;
  placeholder?: string;
}

export interface DirectoryUnit {
  singular: string;
  plural: string;
}

export interface NormDirectoryView {
  basePath: string;
  letter: string;
  letters: IndexLetterCount[];
  result: NormPage;
  pagination: Pagination;
  fields: DirectoryField[];
  /** Mindestens ein Filter (ohne Buchstabe) ist aktiv. */
  active: boolean;
  resetHref: string;
  canonical: string;
  noindex: boolean;
  count: string;
  firstIndex: number;
  lastIndex: number;
  /** Parameter, die ein Filterformular als versteckte Felder mitführt. */
  hidden: Record<string, string>;
  hrefForLetter(letter: string): string;
}

/**
 * Geltung der Filterauswahl. Die Wörter stammen aus der gemeinsamen Wortliste
 * (lawSiteConfig.vocabulary); gleich benannte Rechtsstände stehen in einer Auswahl.
 */
export const DIRECTORY_STATUS_OPTIONS: Array<DirectoryFieldOption & { statuses: string[] }> =
  validityOptions(['in-force', 'future-effective', 'pending-effective', 'repealed', 'historical', 'one-time-act']);

const ORIGIN_OPTIONS: DirectoryFieldOption[] = NORM_ORIGIN_KINDS.map((kind) => ({ value: kind, label: formatNormOriginKind(kind) }));

/**
 * Übernommene Änderungsvorschriften wieder einbeziehen. Beschriftung und Werte stehen einmal
 * hier; A–Z und Sachgebietsseiten verwenden dieselbe Auswahl.
 */
export const INHERITED_AMENDMENT_FIELD: { label: string; allLabel: string; options: DirectoryFieldOption[] } = {
  label: 'Übernommene Änderungsvorschriften',
  allLabel: 'Nicht einbeziehen',
  options: [{ value: INHERITED_AMENDMENT_VALUE, label: 'Einbeziehen' }],
};

function clean(value: string | null, allowed?: readonly string[], maxLength = 200): string {
  const text = (value ?? '').trim().slice(0, maxLength);
  if (!text) return '';
  return allowed && !allowed.includes(text) ? '' : text;
}

/** Zähltext unter der Filterleiste – die einzige Stelle, an der ein Verzeichnis seine Zahl nennt. */
export function describeDirectoryCount(result: NormPage, unit: DirectoryUnit, { active, letter }: { active: boolean; letter: string }): string {
  if (result.total === 0) return active || letter ? `Keine ${unit.plural} passen zur Auswahl.` : `Keine ${unit.plural} vorhanden.`;
  const firstIndex = (result.page - 1) * result.pageSize + 1;
  const lastIndex = Math.min(result.page * result.pageSize, result.total);
  const scope = letter ? ` in der Buchstabengruppe ${letter === '#' ? 'Ziffern und Sonderzeichen' : letter}` : '';
  const qualifier = active ? ' passen zur Auswahl' : '';
  const shown = result.total > result.pageSize ? `; angezeigt ${firstIndex}–${lastIndex}` : '';
  return `${formatCount(result.total, unit.singular, unit.plural)}${qualifier}${scope}${shown}.`;
}

export async function loadNormDirectory(store: NormStore, {
  basePath,
  scope,
  searchParams,
  fields,
  unit = { singular: 'Vorschrift', plural: 'Vorschriften' },
  filterOptions = {},
}: {
  basePath: string;
  scope: DirectoryScope;
  searchParams: URLSearchParams;
  fields: DirectoryFieldName[];
  unit?: DirectoryUnit;
  filterOptions?: { subjects?: string[]; types?: DirectoryFieldOption[] };
}): Promise<NormDirectoryView> {
  const state = {
    q: fields.includes('q') ? clean(searchParams.get('q')) : '',
    subject: fields.includes('subject') ? clean(searchParams.get('subject'), filterOptions.subjects ?? [], 120) : '',
    type: fields.includes('type') ? clean(searchParams.get('type'), (filterOptions.types ?? []).map((entry) => entry.value), 40) : '',
    status: fields.includes('status') ? clean(searchParams.get('status'), DIRECTORY_STATUS_OPTIONS.map((entry) => entry.value), 40) : '',
    origin: fields.includes('origin') ? clean(searchParams.get('origin'), NORM_ORIGIN_KINDS, 40) : '',
    aenderungen: fields.includes('aenderungen') ? clean(searchParams.get('aenderungen'), [INHERITED_AMENDMENT_VALUE], 40) : '',
  };
  const includeInheritedAmendments = state.aenderungen === INHERITED_AMENDMENT_VALUE;
  const letters = await store.listIndexLetters({ ...scope, includeInheritedAmendments });
  const availableLetters = letters.map((entry) => entry.letter);
  const requestedLetter = (searchParams.get('buchstabe') ?? '').trim().toLocaleUpperCase('de-DE').slice(0, 1);
  const letter = availableLetters.includes(requestedLetter) ? requestedLetter : '';
  const { page } = normalizePage(searchParams.get('seite'));
  const statuses = DIRECTORY_STATUS_OPTIONS.find((entry) => entry.value === state.status)?.statuses;
  const result = await store.queryNormSummaries({
    types: state.type ? [state.type] : scope.types,
    subjectSlug: scope.subjectSlug,
    letter: letter || undefined,
    q: state.q || undefined,
    subject: state.subject || undefined,
    statuses,
    originKind: (state.origin || undefined) as NormOriginKind | undefined,
    includeInheritedAmendments,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: 'title',
  });
  const active = Boolean(state.q || state.subject || state.type || state.status || state.origin || state.aenderungen);
  const filterParams: Record<string, string> = { q: state.q, subject: state.subject, type: state.type, status: state.status, origin: state.origin, aenderungen: state.aenderungen };
  const params = { ...filterParams, buchstabe: letter };
  const firstIndex = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const lastIndex = Math.min(result.page * result.pageSize, result.total);
  const fieldList: DirectoryField[] = fields.map((name): DirectoryField => {
    if (name === 'q') return { name, label: 'Titel, Abkürzung oder Stichwort', value: state.q, placeholder: 'z. B. Gemeindeordnung' };
    if (name === 'subject') return { name, label: 'Sachgebiet', value: state.subject, allLabel: 'Alle Sachgebiete', options: (filterOptions.subjects ?? []).map((entry) => ({ value: entry, label: formatSubjectLabel(entry, { withNumber: true, short: true }) })) };
    if (name === 'type') return { name, label: 'Normtyp', value: state.type, allLabel: 'Alle Normtypen', options: filterOptions.types ?? [] };
    if (name === 'status') return { name, label: VALIDITY_FIELD_LABEL, value: state.status, allLabel: lawSiteConfig.vocabulary.validity.any, options: DIRECTORY_STATUS_OPTIONS.map(({ value, label }) => ({ value, label })) };
    if (name === 'aenderungen') return { name, ...INHERITED_AMENDMENT_FIELD, value: state.aenderungen };
    return { name, label: 'Rechtsherkunft', value: state.origin, allLabel: 'Alle Herkunftsarten', options: ORIGIN_OPTIONS };
  });
  return {
    basePath,
    letter,
    letters,
    result,
    pagination: buildPagination({ page: result.page, pageCount: result.pageCount, basePath, params }),
    fields: fieldList,
    active,
    resetHref: basePath,
    canonical: pageUrl(basePath, { ...params, seite: result.page }),
    noindex: active,
    count: describeDirectoryCount(result, unit, { active, letter }),
    firstIndex,
    lastIndex,
    hidden: letter ? { buchstabe: letter } : {},
    hrefForLetter: (target) => pageUrl(basePath, { ...filterParams, buchstabe: target }),
  };
}
