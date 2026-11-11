/**
 * Gemeinsame Angaben der Seiten des Doppelhaushalts 2025/2026 (bisheriger Datenbestand,
 * lib/haushalt/legacy-2025-2026.ts): Periode aus dem Register, Statuskopf, Brotkrume,
 * Bereichsnavigation der Periode und Verweise auf die übrigen sichtbaren Perioden.
 * Dateien mit führendem Unterstrich erzeugen keine Route.
 */
import { LEGACY_BUDGET_PERIOD_ID, getBudgetPeriodUrl } from '@ostrecht/shared/lib/portal/routes.ts';
import { getPeriodenBrotkrume, getPeriodNavItems, getWeiterePeriodenNav } from '../../../lib/haushalt/seite.ts';
import {
  getPeriode,
  getPeriodeStatusInfo,
  isPeriodeVisible,
  isPreviewOnly,
  type Haushaltsperiode,
} from '../../../lib/haushalt/perioden.ts';
import type { StatusTone } from '../../../components/haushalt/format.ts';

export interface LegacyBreadcrumb {
  label: string;
  href?: string;
}

export interface LegacyNavItem {
  label: string;
  href: string;
  current?: boolean;
}

/** Bereich der Periodennavigation, auf dem eine Seite steht. */
export type LegacyBereich = 'start' | 'gesamtplan' | 'einzelplaene';

/** Die Periode 2025/2026 aus dem Register; bricht ab, wenn sie fehlt oder nicht sichtbar ist. */
export function getLegacyPeriode(): Haushaltsperiode {
  const periode = getPeriode(LEGACY_BUDGET_PERIOD_ID);
  if (!periode || periode.datenquelle !== 'legacy-2025-2026') {
    throw new Error(`Periodenregister: Periode ${LEGACY_BUDGET_PERIOD_ID} mit Datenquelle „legacy-2025-2026“ fehlt.`);
  }
  if (!isPeriodeVisible(periode)) {
    throw new Error(`Periode ${LEGACY_BUDGET_PERIOD_ID} ist nicht freigegeben; ihre Seiten dürfen nicht entstehen.`);
  }
  return periode;
}

export { getPeriodenKurzname } from '../../../lib/haushalt/seite.ts';

export interface LegacyLayoutAngaben {
  breadcrumbs: LegacyBreadcrumb[];
  periodLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
  statusText: string;
  datenstand?: string;
  preview: boolean;
  navItems: LegacyNavItem[];
  otherPeriods: LegacyNavItem[];
}

/**
 * Props für HaushaltLayout auf einer Seite der Periode 2025/2026. `pfad` sind die Brotkrumen
 * unterhalb der Periode (z. B. Gesamtplan); die letzte Krume trägt keinen Link.
 */
export function getLegacyLayoutAngaben(bereich: LegacyBereich, pfad: LegacyBreadcrumb[] = []): LegacyLayoutAngaben {
  const periode = getLegacyPeriode();
  const status = getPeriodeStatusInfo(periode);
  const breadcrumbs: LegacyBreadcrumb[] = getPeriodenBrotkrume(periode, pfad);
  return {
    breadcrumbs,
    periodLabel: periode.bezeichnung,
    statusLabel: status.label,
    statusTone: status.tone,
    statusText: status.text,
    datenstand: periode.freigabe.datum ?? undefined,
    preview: isPreviewOnly(periode),
    navItems: getPeriodNavItems(periode, bereich === 'start' ? null : bereich),
    otherPeriods: getWeiterePeriodenNav(periode.id, bereich === 'start' ? null : bereich),
  };
}

/** Haushaltsdaten der Periode als CSV (/haushalt/2025-2026/daten.csv). */
export function getLegacyCsvUrl(): string {
  return `${getBudgetPeriodUrl(LEGACY_BUDGET_PERIOD_ID)}daten.csv`;
}

/** Quellenangabe der Periode für die Datenstandszeile. */
export function getLegacyQuelle(): string {
  const periode = getLegacyPeriode();
  return periode.freigabe.grundlage ?? periode.bezeichnung;
}
