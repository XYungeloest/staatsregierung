/**
 * Gemeinsamer Seitenkontext der Periodenseiten „Rücklagen, Fonds und Landesunternehmen“ und
 * „Downloads“: Periode aus dem Register, Statusangabe, Datenstand, Bereichsnavigation, weitere
 * Perioden und Brotkrume. Seiten entstehen nur für sichtbare Snapshot-Perioden
 * (`getVisibleSnapshotPeriods`); ohne Vorschau also nie für eine nicht freigegebene Periode.
 */
import {
  formatPeriodenjahre,
  getPeriodeStatusInfo,
  getVisibleSnapshotPeriods,
  isPreviewOnly,
  type Haushaltsperiode,
  type PeriodenStatusInfo,
} from '../../../lib/haushalt/perioden.ts';
import { loadImportManifest, loadPeriodMeta } from '../../../lib/haushalt/snapshot.ts';
import type { ImportManifest, Periodenmeta } from '../../../lib/haushalt/types.ts';
import {
  getPeriodenBrotkrume,
  getPeriodenQuelle,
  getPeriodNavItems,
  getWeiterePeriodenNav,
  type NavEintrag,
} from '../../../lib/haushalt/seite.ts';

export type { NavEintrag } from '../../../lib/haushalt/seite.ts';

export interface PeriodenSeite {
  periode: Haushaltsperiode;
  status: PeriodenStatusInfo;
  meta: Periodenmeta;
  manifest: ImportManifest;
  /** Haushaltsjahre als Schlüssel, z. B. ["2027", "2028"]. */
  jahre: string[];
  /** „2027/2028“. */
  jahreText: string;
  preview: boolean;
  datenstand: string;
  datenversion: string;
  /** Öffentliche Quellenangabe für SourceNote. */
  quelle: string;
  navItems: NavEintrag[];
  otherPeriods: NavEintrag[];
  breadcrumbs: Array<{ label: string; href?: string }>;
}

/** getStaticPaths-Quelle: je sichtbarer Snapshot-Periode ein Pfad. */
export function getSnapshotPeriodenPfade(): Array<{ params: { periode: string } }> {
  return getVisibleSnapshotPeriods().map((periode) => ({ params: { periode: periode.id } }));
}

/** Kontext einer Periodenseite; wirft, wenn die Periode im aktuellen Build nicht sichtbar ist. */
export function getPeriodenSeite(id: string, slug: string, seitentitel: string): PeriodenSeite {
  const periode = getVisibleSnapshotPeriods().find((entry) => entry.id === id);
  if (!periode) throw new Error(`Haushaltsperiode „${id}“ ist in diesem Build nicht sichtbar.`);
  const meta = loadPeriodMeta(id);
  const manifest = loadImportManifest(id);
  return {
    periode,
    status: getPeriodeStatusInfo(periode),
    meta,
    manifest,
    jahre: periode.jahre.map(String),
    jahreText: formatPeriodenjahre(periode),
    preview: isPreviewOnly(periode),
    datenstand: meta.stand,
    datenversion: manifest.quelle.commit_kurz,
    quelle: getPeriodenQuelle(periode),
    navItems: getPeriodNavItems(periode, slug),
    otherPeriods: getWeiterePeriodenNav(id, slug),
    breadcrumbs: getPeriodenBrotkrume(periode, [{ label: seitentitel }]),
  };
}

/** Jahresart einer Jahreszahl relativ zur Periode: Haushaltsjahr oder Projektion. */
export function jahresart(periode: Haushaltsperiode, jahr: number | string): 'haushaltsjahr' | 'projektion' {
  const value = Number(jahr);
  return periode.jahre.includes(value) ? 'haushaltsjahr' : 'projektion';
}
