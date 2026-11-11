/**
 * Gemeinsamer Seitenkontext der Periodenseiten Überblick, Gesamtplan und Finanzplanung:
 * statische Pfade (nur sichtbare Snapshot-Perioden), Statusangaben, Datenstand, Bereichs-
 * navigation, Brotkrume und die Props für `HaushaltLayout`. Alle Angaben stammen aus dem
 * Periodenregister (`perioden.ts`) und dem Snapshot (`snapshot.ts`).
 */
import {
  getPeriodeStatusInfo,
  getVisiblePeriode,
  getVisibleSnapshotPeriods,
  isPreviewOnly,
  type Haushaltsperiode,
  type PeriodenStatusInfo,
} from '../../../lib/haushalt/perioden.ts';
import { loadImportManifest, loadPeriodMeta } from '../../../lib/haushalt/snapshot.ts';
import type { Periodenmeta } from '../../../lib/haushalt/types.ts';
import {
  getPeriodenBrotkrume,
  getPeriodenQuelle,
  getPeriodNavItems,
  getWeiterePeriodenNav,
  type NavEintrag,
} from '../../../lib/haushalt/seite.ts';

export type { NavEintrag } from '../../../lib/haushalt/seite.ts';

/** Statische Pfade: nur sichtbare Perioden mit Snapshot (ohne Vorschau keine Entwurfsperioden). */
export function getPeriodenPfade() {
  return getVisibleSnapshotPeriods().map((periode) => ({ params: { periode: periode.id } }));
}

export interface PeriodenKontext {
  id: string;
  periode: Haushaltsperiode;
  status: PeriodenStatusInfo;
  meta: Periodenmeta;
  /** Haushaltsjahre als Schlüssel ("2027", "2028"). */
  jahre: string[];
  datenstand: string;
  datenversion: string;
  vorschau: boolean;
  /** Öffentliche Quellenangabe für SourceNote. */
  quelle: string;
  layout: {
    periodLabel: string;
    statusLabel: string;
    statusTone: PeriodenStatusInfo['tone'];
    statusText: string;
    datenstand: string;
    datenversion: string;
    preview: boolean;
    navItems: NavEintrag[];
    otherPeriods: NavEintrag[];
  };
  breadcrumbs: (seite?: string) => Array<{ label: string; href?: string }>;
}

/** Kontext einer sichtbaren Snapshot-Periode; bricht ab, wenn die Periode nicht sichtbar ist. */
export function getPeriodenKontext(id: string, aktuell: string | null): PeriodenKontext {
  const periode = getVisiblePeriode(id);
  if (!periode || periode.datenquelle !== 'snapshot') {
    throw new Error(`Haushaltsperiode „${id}“ ist in diesem Build nicht sichtbar oder hat keinen Datenbestand.`);
  }
  const status = getPeriodeStatusInfo(periode);
  const meta = loadPeriodMeta(id);
  const manifest = loadImportManifest(id);
  const vorschau = isPreviewOnly(periode);
  const jahre = periode.jahre.map(String);
  for (const jahr of jahre) {
    if (!meta.jahre.map(String).includes(jahr)) throw new Error(`Haushaltsperiode ${id}: Jahr ${jahr} fehlt im Datenbestand.`);
  }
  return {
    id,
    periode,
    status,
    meta,
    jahre,
    datenstand: meta.stand,
    datenversion: manifest.quelle.commit_kurz,
    vorschau,
    quelle: getPeriodenQuelle(periode),
    layout: {
      periodLabel: periode.bezeichnung,
      statusLabel: status.label,
      statusTone: status.tone,
      statusText: status.text,
      datenstand: meta.stand,
      datenversion: manifest.quelle.commit_kurz,
      preview: vorschau,
      navItems: getPeriodNavItems(periode, aktuell),
      otherPeriods: getWeiterePeriodenNav(id, aktuell),
    },
    breadcrumbs: (seite?: string) => getPeriodenBrotkrume(periode, seite ? [{ label: seite }] : []),
  };
}
