/**
 * Seitenrahmen der Fachseiten „Personal und Versorgung“ und „Finanzierung und Schulden“ einer
 * Snapshot-Periode: statische Pfade (nur sichtbare Snapshot-Perioden), Statusangaben,
 * Datenstand, Bereichsnavigation, Brotkrume und Props für `HaushaltLayout`. Alle Angaben stammen
 * aus dem Periodenregister (`perioden.ts`) und dem Snapshot (`snapshot.ts`).
 *
 * Die Navigation folgt derselben Reihenfolge und denselben Bezeichnungen wie die übrigen
 * Periodenseiten.
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
import {
  getPeriodenBrotkrume,
  getPeriodenQuelle,
  getPeriodNavItems,
  getWeiterePeriodenNav,
  type NavEintrag,
} from '../../../lib/haushalt/seite.ts';

export type { NavEintrag } from '../../../lib/haushalt/seite.ts';

/** Statische Pfade: nur sichtbare Perioden mit Snapshot (ohne Vorschau keine Entwurfsperioden). */
export function getFachseitenPfade() {
  return getVisibleSnapshotPeriods().map((periode) => ({ params: { periode: periode.id } }));
}

export interface FachseitenKontext {
  id: string;
  periode: Haushaltsperiode;
  status: PeriodenStatusInfo;
  /** Haushaltsjahre als Schlüssel ("2027", "2028"). */
  jahre: string[];
  datenstand: string;
  datenversion: string;
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
  breadcrumbs: Array<{ label: string; href?: string }>;
}

/** Kontext einer Fachseite; bricht ab, wenn die Periode in diesem Build nicht sichtbar ist. */
export function getFachseitenKontext(id: string, slug: string, seitentitel: string): FachseitenKontext {
  const periode = getVisiblePeriode(id);
  if (!periode || periode.datenquelle !== 'snapshot') {
    throw new Error(`Haushaltsperiode „${id}“ ist in diesem Build nicht sichtbar oder hat keinen Datenbestand.`);
  }
  const status = getPeriodeStatusInfo(periode);
  const meta = loadPeriodMeta(id);
  const manifest = loadImportManifest(id);
  const jahre = periode.jahre.map(String);
  for (const jahr of jahre) {
    if (!meta.jahre.map(String).includes(jahr)) throw new Error(`Haushaltsperiode ${id}: Jahr ${jahr} fehlt im Datenbestand.`);
  }
  return {
    id,
    periode,
    status,
    jahre,
    datenstand: meta.stand,
    datenversion: manifest.quelle.commit_kurz,
    quelle: getPeriodenQuelle(periode),
    layout: {
      periodLabel: periode.bezeichnung,
      statusLabel: status.label,
      statusTone: status.tone,
      statusText: status.text,
      datenstand: meta.stand,
      datenversion: manifest.quelle.commit_kurz,
      preview: isPreviewOnly(periode),
      navItems: getPeriodNavItems(periode, slug),
      otherPeriods: getWeiterePeriodenNav(id, slug),
    },
    breadcrumbs: getPeriodenBrotkrume(periode, [{ label: seitentitel }]),
  };
}

/** Jahresschlüssel als Zahl sortiert. */
export function sortierteJahre(werte: Record<string, unknown>): string[] {
  return Object.keys(werte).sort((left, right) => Number(left) - Number(right));
}

/** Art eines Jahres: Haushaltsjahr der Periode oder Finanzplanung (Projektion). */
export function jahresart(jahr: string | number, haushaltsjahre: readonly string[]): 'haushaltsjahr' | 'projektion' {
  return haushaltsjahre.includes(String(jahr)) ? 'haushaltsjahr' : 'projektion';
}
