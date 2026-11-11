/**
 * Gemeinsamer Seitenrahmen aller Periodenseiten des Haushaltsinformationssystems: Bereichs-
 * navigation (eine Reihenfolge, eine Bezeichnung je Bereich), Verweise auf die übrigen sichtbaren
 * Perioden im Statuskopf, Brotkrume und Quellenangabe. Seiten- und Komponentenhelfer
 * (gesamtplan/periode.ts, browser/kontext.ts, personal/periodenseite.ts, ruecklagen/seite.ts,
 * projekte/daten.ts, 2025-2026/_periode.ts) beziehen diese Angaben ausschließlich von hier.
 */
import {
  getBudgetPageUrl,
  getBudgetPeriodPageUrl,
  getBudgetPeriodUrl,
  getBudgetSearchUrl,
  getBudgetUrl,
  getHomeUrl,
} from '@ostrecht/shared/lib/portal/routes.ts';

import { formatPeriodenjahre, getVisiblePeriods, type Haushaltsperiode } from './perioden.ts';

export interface NavEintrag {
  label: string;
  href: string;
  current?: boolean;
}

export interface Brotkrume {
  label: string;
  href?: string;
}

/** Bereiche einer Snapshot-Periode in der Reihenfolge der Bereichsnavigation (ohne Überblick). */
export const SNAPSHOT_PERIODEN_SEITEN: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: 'gesamtplan', label: 'Gesamtplan' },
  { slug: 'einzelplaene', label: 'Einzelpläne' },
  { slug: 'projekte', label: 'Vorhaben' },
  { slug: 'personal', label: 'Personal' },
  { slug: 'finanzierung', label: 'Finanzierung' },
  { slug: 'ruecklagen', label: 'Rücklagen und Fonds' },
  { slug: 'finanzplanung', label: 'Finanzplanung' },
  { slug: 'downloads', label: 'Downloads' },
  { slug: 'suche', label: 'Suche' },
];

/** Bereiche des Doppelhaushalts 2025/2026 (bisheriger Datenbestand). */
export const LEGACY_PERIODEN_SEITEN: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: 'gesamtplan', label: 'Gesamtplan' },
  { slug: 'einzelplaene', label: 'Einzelpläne' },
];

function seitenDerPeriode(periode: Pick<Haushaltsperiode, 'datenquelle'>) {
  return periode.datenquelle === 'snapshot' ? SNAPSHOT_PERIODEN_SEITEN : LEGACY_PERIODEN_SEITEN;
}

function seitenUrl(id: string, slug: string): string {
  return slug === 'suche' ? getBudgetSearchUrl(id) : getBudgetPeriodPageUrl(id, slug);
}

/**
 * Bereichsnavigation einer Periode. `aktuell` ist der Bereich der Seite (`null` = Überblick der
 * Periode); Einzelplan-, Kapitel- und Projektseiten markieren ihren übergeordneten Bereich.
 */
export function getPeriodNavItems(periode: Pick<Haushaltsperiode, 'id' | 'datenquelle'>, aktuell: string | null): NavEintrag[] {
  return [
    { label: 'Überblick', href: getBudgetPeriodUrl(periode.id), current: aktuell === null },
    ...seitenDerPeriode(periode).map((seite) => ({
      label: seite.label,
      href: seitenUrl(periode.id, seite.slug),
      current: aktuell === seite.slug,
    })),
  ];
}

/** Kurzbezeichnung einer Periode für Statuskopf und Periodenwahl, z. B. „Entwurf 2027/2028“. */
export function getPeriodenKurzname(periode: Haushaltsperiode): string {
  const jahre = formatPeriodenjahre(periode);
  return ['arbeitsentwurf', 'regierungsentwurf', 'parlamentarische-beratung'].includes(periode.status)
    ? `Entwurf ${jahre}`
    : `Haushalt ${jahre}`;
}

/**
 * Übrige sichtbare Perioden für den Statuskopf („Weitere Perioden“). Gibt es den Bereich `slug`
 * auch in der anderen Periode, führt der Verweis dorthin, sonst zu ihrem Überblick.
 */
export function getWeiterePeriodenNav(id: string, slug: string | null = null): NavEintrag[] {
  return getVisiblePeriods()
    .filter((periode) => periode.id !== id)
    .map((periode) => ({
      label: getPeriodenKurzname(periode),
      href: slug && seitenDerPeriode(periode).some((seite) => seite.slug === slug)
        ? seitenUrl(periode.id, slug)
        : getBudgetPeriodUrl(periode.id),
    }));
}

/**
 * Brotkrume einer Periodenseite: Startseite › Haushalt › <Periode> › … . Ohne `pfad` ist die
 * Periode selbst die aktuelle Seite (ohne Link).
 */
export function getPeriodenBrotkrume(periode: Pick<Haushaltsperiode, 'id' | 'bezeichnung'>, pfad: Brotkrume[] = []): Brotkrume[] {
  return [
    { label: 'Startseite', href: getHomeUrl() },
    { label: 'Haushalt', href: getBudgetUrl() },
    pfad.length > 0 ? { label: periode.bezeichnung, href: getBudgetPeriodUrl(periode.id) } : { label: periode.bezeichnung },
    ...pfad,
  ];
}

/** Öffentliche Quellenangabe der Datenstandszeile einer Snapshot-Periode. */
export function getPeriodenQuelle(periode: Pick<Haushaltsperiode, 'status' | 'bezeichnung'>): string {
  if (periode.status === 'arbeitsentwurf') return `Entwurf zum ${periode.bezeichnung}`;
  return ['regierungsentwurf', 'parlamentarische-beratung'].includes(periode.status)
    ? `Regierungsentwurf zum ${periode.bezeichnung}`
    : `Haushaltsplan zum ${periode.bezeichnung}`;
}

/** Periodenbezeichnung im Genitiv: „des Doppelhaushalts 2027/2028“. */
export function getPeriodenGenitiv(periode: Pick<Haushaltsperiode, 'bezeichnung'>): string {
  return periode.bezeichnung.replace(/^(Doppelhaushalt|Nachtragshaushalt|Haushalt)(?=\s)/u, '$1s');
}

/**
 * Bereichsnavigation der periodenübergreifenden Haushaltsseiten (/haushalt/ und
 * /haushalt/sondervermoegen/): Überblick, jede sichtbare Periode (älteste zuerst) und
 * Sondervermögen und Fonds.
 */
export function getHaushaltNavItems(aktuell: 'ueberblick' | 'sondervermoegen'): NavEintrag[] {
  const perioden = [...getVisiblePeriods()].sort((left, right) => left.jahre[0] - right.jahre[0]);
  return [
    { label: 'Überblick', href: getBudgetUrl(), current: aktuell === 'ueberblick' },
    ...perioden.map((periode) => ({ label: getPeriodenKurzname(periode), href: getBudgetPeriodUrl(periode.id), current: false })),
    { label: 'Sondervermögen und Fonds', href: getBudgetPageUrl('sondervermoegen'), current: aktuell === 'sondervermoegen' },
  ];
}
