/**
 * Projektsicht des Haushaltsinformationssystems: bereitet Vorhaben einer Snapshot-Periode für
 * die Projektübersicht, die Projektseiten und die Themenseiten auf.
 *
 * Alle Beträge kommen unverändert aus dem Snapshot (`snapshot.ts`); abgeleitet werden nur
 * Veränderungen, Anteile, Gruppierungen und Kontrollsummen. Öffentliche Texte stammen aus den
 * redaktionellen Overlays (`oeffentlich.ts`); Arbeitsvermerke der Quelle (Rechtsgrundlage,
 * Beschreibung, Kredithinweis, Bezahlstand) werden nie ausgegeben.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  getBudgetChapterUrl,
  getBudgetPeriodPageUrl,
  getBudgetPeriodPlanUrl,
  getBudgetPeriodUrl,
  getBudgetProjectUrl,
  getBudgetTitleUrl,
  getBudgetUrl,
  getHomeUrl,
} from '@ostrecht/shared/lib/portal/routes.ts';

import {
  braucheBezeichnungsfassung,
  formatKapitelnummer,
  formatTitelnummer,
  getEinzelplanOverlay,
  getNormStatus,
  hasProjektseite,
  hatKuenftigeFassung,
  loadFreitextOverlay,
  loadProjektOverlays,
  PROJEKT_STATUS_LABELS,
  publicBezeichnung,
  publicSuchbegriffe,
  RECHTSBEZUG_ART_LABELS,
  resolveRechtsbezugArt,
  type ProjektOverlay,
  type ProjektRechtsbezug,
  type ProjektStatus,
  type RechtsbezugArt,
} from '../../../lib/haushalt/oeffentlich.ts';
import {
  formatPeriodenjahre,
  getPeriodeStatusInfo,
  getRedaktionellerStichtag,
  getVisibleSnapshotPeriods,
  isPreviewOnly,
  type Haushaltsperiode,
} from '../../../lib/haushalt/perioden.ts';
import {
  loadEinzelplaene,
  loadFinanzierung,
  loadImportManifest,
  loadKapitel,
  loadPeriodMeta,
  loadProjekte,
  loadTitelForKapitel,
  resolveHaushaltRepositoryRoot,
} from '../../../lib/haushalt/snapshot.ts';
import type { Kapitel, Projekt, Titel, Verpflichtungsermaechtigung } from '../../../lib/haushalt/types.ts';
import type { StatusTone } from '../format.ts';
import { getPeriodenQuelle, getPeriodNavItems, getWeiterePeriodenNav, type NavEintrag } from '../../../lib/haushalt/seite.ts';

export type { NavEintrag } from '../../../lib/haushalt/seite.ts';

// ---------------------------------------------------------------------------------------------
// Periodenrahmen (Layout, Navigation, Quellenangabe)

export interface PeriodenRahmen {
  periode: Haushaltsperiode;
  id: string;
  jahre: string[];
  jahreText: string;
  preview: boolean;
  periodLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
  statusText: string;
  datenstand: string;
  datenversion: string;
  navItems: NavEintrag[];
  otherPeriods: NavEintrag[];
  quelle: string;
  downloadsHref: string;
  breadcrumbsBasis: { label: string; href?: string }[];
}

export function getPeriodenRahmen(periode: Haushaltsperiode, aktuell: string): PeriodenRahmen {
  const id = periode.id;
  const meta = loadPeriodMeta(id);
  const manifest = loadImportManifest(id);
  const status = getPeriodeStatusInfo(periode);
  const jahreText = formatPeriodenjahre(periode);
  return {
    periode,
    id,
    jahre: periode.jahre.map(String),
    jahreText,
    preview: isPreviewOnly(periode),
    periodLabel: periode.bezeichnung,
    statusLabel: status.label,
    statusTone: status.tone,
    statusText: status.text,
    datenstand: meta.stand,
    datenversion: manifest.quelle.commit_kurz,
    navItems: getPeriodNavItems(periode, aktuell === '' ? null : aktuell),
    otherPeriods: getWeiterePeriodenNav(id, aktuell === '' ? null : aktuell),
    quelle: getPeriodenQuelle(periode),
    downloadsHref: getBudgetPeriodPageUrl(id, 'downloads'),
    breadcrumbsBasis: [
      { label: 'Startseite', href: getHomeUrl() },
      { label: 'Haushalt', href: getBudgetUrl() },
      { label: periode.bezeichnung, href: getBudgetPeriodUrl(id) },
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Rechtsbezüge

export interface AngezeigterRechtsbezug {
  label: string;
  normSlug?: string;
  art: RechtsbezugArt;
  artLabel: string;
}

/**
 * Öffentliche Art eines Projekt-Rechtsbezugs zum redaktionellen Stichtag (`resolveRechtsbezugArt`:
 * Normstatus; ein ausdrücklich als „verkündet“ eingestufter Bezug auf eine geltende Norm mit noch
 * nicht wirksamer Änderungsfassung bleibt „verkündet“).
 */
export function getRechtsbezugAnzeige(bezug: ProjektRechtsbezug, stichtag = getRedaktionellerStichtag()): AngezeigterRechtsbezug {
  const art: RechtsbezugArt =
    resolveRechtsbezugArt(bezug.art, bezug.normSlug, getNormStatus, (slug) => hatKuenftigeFassung(slug, stichtag)) ?? bezug.art;
  return {
    label: bezug.label,
    ...(bezug.normSlug ? { normSlug: bezug.normSlug } : {}),
    art,
    artLabel: RECHTSBEZUG_ART_LABELS[art],
  };
}

// ---------------------------------------------------------------------------------------------
// Projektsicht

export const PROJEKT_STATUS_REIHENFOLGE: readonly ProjektStatus[] = [
  'beschlossen',
  'in-umsetzung',
  'geplant',
  'im-entwurf',
  'optional',
  'nicht-finanziert',
];

/** Darstellung der Projektbeträge. */
export type BetragsArt =
  /** Eigene Titel mit Ansätzen: Projektbeträge werden gezeigt. */
  | 'betraege'
  /** Titel sind nicht ausschließlich dem Vorhaben gewidmet (`ohneSumme`): kein Projektbetrag. */
  | 'ohne-summe'
  /** Vorhaben ohne eigene Titel und ohne Ansatz, aber nicht als „nicht finanziert“ geführt. */
  | 'kein-eigener-ansatz'
  /** Nicht finanziert: kein Haushaltsansatz. */
  | 'kein-ansatz';

export interface KapitelBezug {
  kapitel: string;
  nummer: string;
  ep: string;
  bezeichnung: string;
  href: string;
  ausgaben: Record<string, number>;
  einnahmen: Record<string, number>;
}

export interface EinzelplanBezug {
  ep: string;
  bezeichnung: string;
  href: string;
}

export interface TitelZeile {
  id: string;
  kapitel: string;
  ep: string;
  titel: string;
  nummer: string;
  kapitelNummer: string;
  zweck: string;
  seite: 'Einnahme' | 'Ausgabe';
  hauptgruppe: string;
  betraege: Record<string, number>;
  href: string;
}

export interface ProjektSicht {
  id: string;
  slug: string;
  titel: string;
  fachbereich: string;
  status: ProjektStatus;
  statusLabel: string;
  statusText: string;
  beschreibung: string;
  href?: string;
  ministrySlug?: string;
  topicSlugs: string[];
  einzelplaene: EinzelplanBezug[];
  kapitel: KapitelBezug[];
  betragsArt: BetragsArt;
  betragshinweis?: string;
  /** Ausgaben im Kernhaushalt je Jahr (Projektsicht derselben Titel). */
  ausgaben: Record<string, number>;
  /** Einnahmen je Jahr, getrennt von den Ausgaben. */
  einnahmen: Record<string, number>;
  hatEinnahmen: boolean;
  suchtext: string;
  rechtsbezuege: AngezeigterRechtsbezug[];
  projekt: Projekt;
  overlay: ProjektOverlay;
}

const kapitelCache = new Map<string, Map<string, Kapitel>>();

function kapitelLookup(periode: string): Map<string, Kapitel> {
  let lookup = kapitelCache.get(periode);
  if (!lookup) {
    lookup = new Map(loadKapitel(periode).map((entry) => [entry.kapitel, entry]));
    kapitelCache.set(periode, lookup);
  }
  return lookup;
}

function einzelplanName(periode: string, ep: string): string {
  const overlay = getEinzelplanOverlay(periode, ep);
  if (overlay) return overlay.kurztitel;
  const plan = loadEinzelplaene(periode).find((entry) => entry.ep === ep);
  return plan ? publicBezeichnung(plan.bezeichnung, loadFreitextOverlay(periode)) : `Einzelplan ${ep}`;
}

function jahresWerte(projekt: Projekt, jahre: string[], feld: 'kernhaushalt' | 'einnahmen'): Record<string, number> {
  return Object.fromEntries(jahre.map((jahr) => [jahr, projekt.jahre[jahr as `${number}`]?.[feld] ?? 0]));
}

function betragsArt(projekt: Projekt, overlay: ProjektOverlay, jahre: string[]): BetragsArt {
  if (overlay.status === 'nicht-finanziert') return 'kein-ansatz';
  if (overlay.ohneSumme === true) return 'ohne-summe';
  const summe = jahre.reduce(
    (wert, jahr) => wert + Math.abs(projekt.jahre[jahr as `${number}`]?.kernhaushalt ?? 0) + Math.abs(projekt.jahre[jahr as `${number}`]?.einnahmen ?? 0),
    0,
  );
  return projekt.titel.length === 0 || summe === 0 ? 'kein-eigener-ansatz' : 'betraege';
}

const titelCache = new Map<string, Map<string, Titel>>();

function titelNachKonzept(periode: string, kapitel: string): Map<string, Titel> {
  const key = `${periode}/${kapitel}`;
  let lookup = titelCache.get(key);
  if (!lookup) {
    lookup = new Map(loadTitelForKapitel(periode, kapitel).map((entry) => [entry.konzept_id, entry]));
    titelCache.set(key, lookup);
  }
  return lookup;
}

/** Haushaltstitel eines Vorhabens mit öffentlicher Zweckbestimmung, sortiert nach Kapitel und Titel. */
export function getProjektTitel(periode: string, projekt: Projekt, jahre: string[]): TitelZeile[] {
  const freitexte = loadFreitextOverlay(periode);
  const zeilen = projekt.titel.map((bezug): TitelZeile => {
    const titel = titelNachKonzept(periode, bezug.kapitel).get(bezug.konzept_id);
    if (!titel) throw new Error(`Haushaltstitel ${bezug.kapitel}/${bezug.titel} des Vorhabens ${projekt.id} fehlt im Titelplan.`);
    const ep = titel.kapitel.slice(0, 2);
    return {
      id: `titel-${titel.kapitel}-${titel.titel}`,
      kapitel: titel.kapitel,
      ep,
      titel: titel.titel,
      nummer: formatTitelnummer(titel.titel),
      kapitelNummer: formatKapitelnummer(titel.kapitel),
      zweck: publicBezeichnung(titel.zweckbestimmung ?? '', freitexte),
      seite: titel.seite,
      hauptgruppe: titel.hauptgruppe,
      betraege: Object.fromEntries(jahre.map((jahr) => [jahr, titel.jahre[jahr as `${number}`]?.betrag ?? 0])),
      href: getBudgetTitleUrl(periode, ep, titel.kapitel, titel.titel),
    };
  });
  return zeilen.sort((left, right) => left.kapitel.localeCompare(right.kapitel) || left.titel.localeCompare(right.titel));
}

function normalisiere(value: string): string {
  return value
    .toLocaleLowerCase('de-DE')
    .replace(/ä/gu, 'ae')
    .replace(/ö/gu, 'oe')
    .replace(/ü/gu, 'ue')
    .replace(/ß/gu, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

const sichtCache = new Map<string, ProjektSicht[]>();

/**
 * Alle Vorhaben einer Periode mit Overlay, in der Reihenfolge des Snapshots. Vorhaben ohne
 * redaktionelle Fassung erscheinen nicht.
 */
export function getProjektSichten(periode: Haushaltsperiode): ProjektSicht[] {
  const cached = sichtCache.get(periode.id);
  if (cached) return cached;
  const id = periode.id;
  const jahre = periode.jahre.map(String);
  const overlays = loadProjektOverlays(id);
  const freitexte = loadFreitextOverlay(id);
  const kapitel = kapitelLookup(id);
  const stichtag = getRedaktionellerStichtag();

  const sichten = loadProjekte(id).flatMap((projekt): ProjektSicht[] => {
    const overlay = overlays[projekt.id];
    if (!overlay) return [];
    const titelZeilen = getProjektTitel(id, projekt, jahre);
    const kapitelCodes = [...new Set([...projekt.kapitel, ...titelZeilen.map((zeile) => zeile.kapitel)])].sort();
    const kapitelBezuege = kapitelCodes.flatMap((code): KapitelBezug[] => {
      const eintrag = kapitel.get(code);
      if (!eintrag) return [];
      return [
        {
          kapitel: code,
          nummer: formatKapitelnummer(code),
          ep: eintrag.einzelplan,
          bezeichnung: publicBezeichnung(eintrag.bezeichnung, freitexte),
          href: getBudgetChapterUrl(id, eintrag.einzelplan, code),
          ausgaben: Object.fromEntries(jahre.map((jahr) => [jahr, eintrag.jahre[jahr as `${number}`]?.ausgaben ?? 0])),
          einnahmen: Object.fromEntries(jahre.map((jahr) => [jahr, eintrag.jahre[jahr as `${number}`]?.einnahmen ?? 0])),
        },
      ];
    });
    // Einzelpläne folgen den tatsächlich zugeordneten Kapiteln; ohne Kapitel gilt die Angabe des Vorhabens.
    const epCodes = kapitelBezuege.length > 0 ? [...new Set(kapitelBezuege.map((entry) => entry.ep))] : [projekt.einzelplan];
    const einzelplaene = epCodes.map((ep) => ({ ep, bezeichnung: einzelplanName(id, ep), href: getBudgetPeriodPlanUrl(id, ep) }));
    const art = betragsArt(projekt, overlay, jahre);
    const ausgaben = jahresWerte(projekt, jahre, 'kernhaushalt');
    const einnahmen = jahresWerte(projekt, jahre, 'einnahmen');
    const suchtext = normalisiere(
      [
        overlay.titel,
        overlay.fachbereich,
        overlay.beschreibung,
        PROJEKT_STATUS_LABELS[overlay.status],
        ...publicSuchbegriffe(projekt.suchbegriffe),
        ...titelZeilen.map((zeile) => zeile.zweck),
        ...kapitelBezuege.flatMap((entry) => [entry.kapitel, entry.nummer, entry.bezeichnung]),
        ...einzelplaene.flatMap((entry) => [`Einzelplan ${entry.ep}`, entry.bezeichnung]),
      ].join(' '),
    );
    return [
      {
        id: projekt.id,
        slug: overlay.slug,
        titel: overlay.titel,
        fachbereich: overlay.fachbereich,
        status: overlay.status,
        statusLabel: PROJEKT_STATUS_LABELS[overlay.status],
        statusText: overlay.statusText,
        beschreibung: overlay.beschreibung,
        href: hasProjektseite(projekt, overlay) ? getBudgetProjectUrl(id, overlay.slug) : undefined,
        ministrySlug: overlay.ministrySlug,
        topicSlugs: overlay.topicSlugs,
        einzelplaene,
        kapitel: kapitelBezuege,
        betragsArt: art,
        betragshinweis: overlay.betragshinweis,
        ausgaben,
        einnahmen,
        hatEinnahmen: art === 'betraege' && jahre.some((jahr) => einnahmen[jahr] !== 0),
        suchtext,
        rechtsbezuege: overlay.rechtsbezuege.map((bezug) => getRechtsbezugAnzeige(bezug, stichtag)),
        projekt,
        overlay,
      },
    ];
  });
  sichtCache.set(id, sichten);
  return sichten;
}

/** Projektseiten aller sichtbaren Snapshot-Perioden (für getStaticPaths). */
export function getProjektseitenPfade(): Array<{ params: { periode: string; slug: string }; props: { periodeId: string; projektId: string } }> {
  return getVisibleSnapshotPeriods().flatMap((periode) =>
    getProjektSichten(periode)
      .filter((sicht) => sicht.href)
      .map((sicht) => ({ params: { periode: periode.id, slug: sicht.slug }, props: { periodeId: periode.id, projektId: sicht.id } })),
  );
}

/** Übersichtsseiten der sichtbaren Snapshot-Perioden (für getStaticPaths). */
export function getPeriodenPfade(): Array<{ params: { periode: string }; props: { periodeId: string } }> {
  return getVisibleSnapshotPeriods().map((periode) => ({ params: { periode: periode.id }, props: { periodeId: periode.id } }));
}

export function getSichtbareSnapshotPeriode(id: string): Haushaltsperiode {
  const periode = getVisibleSnapshotPeriods().find((entry) => entry.id === id);
  if (!periode) throw new Error(`Haushaltsperiode ${id} ist in diesem Build nicht sichtbar.`);
  return periode;
}

/** Vorhaben mit einem Thema aus allen sichtbaren Snapshot-Perioden (neueste Periode zuerst). */
export function getProjekteZumThema(topicSlug: string): Array<{ rahmen: PeriodenRahmen; projekte: ProjektSicht[] }> {
  return getVisibleSnapshotPeriods().flatMap((periode) => {
    const projekte = getProjektSichten(periode).filter((sicht) => sicht.topicSlugs.includes(topicSlug));
    return projekte.length > 0 ? [{ rahmen: getPeriodenRahmen(periode, 'projekte'), projekte: sortiereNachAusgaben(projekte, periode.jahre.map(String)[0]) }] : [];
  });
}

/** Vorhaben mit Beträgen absteigend nach Ausgaben eines Jahres; Vorhaben ohne Projektbetrag danach. */
export function sortiereNachAusgaben(projekte: ProjektSicht[], jahr: string): ProjektSicht[] {
  const collator = new Intl.Collator('de');
  return [...projekte].sort((left, right) => {
    const a = left.betragsArt === 'betraege' ? left.ausgaben[jahr] : null;
    const b = right.betragsArt === 'betraege' ? right.ausgaben[jahr] : null;
    if (a !== null && b !== null && a !== b) return b - a;
    if (a === null && b !== null) return 1;
    if (a !== null && b === null) return -1;
    return collator.compare(left.titel, right.titel);
  });
}

// ---------------------------------------------------------------------------------------------
// Finanzierung, Verpflichtungsermächtigungen

export function getVerpflichtungen(periode: string, projektId: string): Verpflichtungsermaechtigung[] {
  return loadFinanzierung(periode).verpflichtungen.filter((entry) => entry.projekt === projektId);
}

/** Öffentliche Begründung einer Verpflichtungsermächtigung oder null (fail-closed). */
export function publicBegruendung(text: string | undefined): string | null {
  if (!text || text.trim() === '') return null;
  return braucheBezeichnungsfassung(text) ? null : text.trim();
}

export interface Finanzierungsmassnahme {
  id: string;
  titel: string;
  erlaeuterung?: string;
  jahre: Record<string, { einnahmen: number; einsparungen: number; kosten: number; nettoentlastung: number }>;
}

function overlayText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' && !braucheBezeichnungsfassung(value) ? value.trim() : undefined;
}

/**
 * Öffentliche Titel der Finanzierungsmaßnahmen aus content/haushalt/<periode>/finanzierung.json.
 * Ohne Datei oder ohne öffentlichen Titel einer Maßnahme wird sie nicht genannt.
 */
function ladeMassnahmenOverlay(periode: string): Map<string, { titel: string; erlaeuterung?: string }> {
  const pfad = join(resolveHaushaltRepositoryRoot(), 'content', 'haushalt', periode, 'finanzierung.json');
  const ergebnis = new Map<string, { titel: string; erlaeuterung?: string }>();
  if (!existsSync(pfad)) return ergebnis;
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(pfad, 'utf8'));
  } catch {
    return ergebnis;
  }
  const massnahmen = (json as { massnahmen?: unknown } | null)?.massnahmen;
  const eintraege: Array<[string, Record<string, unknown>]> = Array.isArray(massnahmen)
    ? massnahmen.flatMap((entry) => {
        const record = entry as Record<string, unknown>;
        const kennung = typeof record.id === 'string' ? record.id : typeof record.kennung === 'string' ? record.kennung : undefined;
        return kennung ? [[kennung, record] as [string, Record<string, unknown>]] : [];
      })
    : massnahmen && typeof massnahmen === 'object'
      ? Object.entries(massnahmen as Record<string, Record<string, unknown>>)
      : [];
  for (const [kennung, record] of eintraege) {
    if (!record || typeof record !== 'object') continue;
    const titel = overlayText(record.titel) ?? overlayText(record.oeffentlicherTitel) ?? overlayText(record.bezeichnung);
    if (!titel) continue;
    const erlaeuterung = overlayText(record.erlaeuterung) ?? overlayText(record.zweck);
    ergebnis.set(kennung, { titel, ...(erlaeuterung ? { erlaeuterung } : {}) });
  }
  return ergebnis;
}

/**
 * Finanzierungsmaßnahmen, die dem Vorhaben eindeutig über ihre Kennung zugeordnet sind
 * (Kennung als Suchbegriff des Vorhabens oder in der Zweckbestimmung eines Projekttitels) und
 * eine öffentliche Bezeichnung haben.
 */
export function getProjektMassnahmen(periode: string, projekt: Projekt): Finanzierungsmassnahme[] {
  const massnahmen = loadFinanzierung(periode).massnahmen;
  if (massnahmen.length === 0) return [];
  const bekannte = new Set(massnahmen.map((entry) => entry.id));
  const kennungen = new Set<string>();
  for (const begriff of projekt.suchbegriffe) if (bekannte.has(begriff.trim())) kennungen.add(begriff.trim());
  for (const bezug of projekt.titel) {
    const titel = titelNachKonzept(periode, bezug.kapitel).get(bezug.konzept_id);
    for (const treffer of (titel?.zweckbestimmung ?? '').matchAll(/\b([A-Z]\d{2})\b/gu)) {
      if (bekannte.has(treffer[1])) kennungen.add(treffer[1]);
    }
  }
  if (kennungen.size === 0) return [];
  const overlay = ladeMassnahmenOverlay(periode);
  return massnahmen.flatMap((massnahme): Finanzierungsmassnahme[] => {
    const text = overlay.get(massnahme.id);
    if (!kennungen.has(massnahme.id) || !text) return [];
    return [{ id: massnahme.id, titel: text.titel, ...(text.erlaeuterung ? { erlaeuterung: text.erlaeuterung } : {}), jahre: massnahme.jahre }];
  });
}

/** Beschaffungsangaben des Vorhabens, soweit öffentlich darstellbar. */
export function getBeschaffung(projekt: Projekt): { gegenstand?: string; stueckzahl?: number; gesamtkosten?: number } | null {
  const zusatz = projekt.zusatz;
  if (!zusatz) return null;
  const gegenstand = overlayText(zusatz.gegenstand);
  const stueckzahl = typeof zusatz.stueckzahl === 'number' && zusatz.stueckzahl > 0 ? zusatz.stueckzahl : undefined;
  const gesamtkosten = typeof zusatz.gesamtkosten === 'number' && zusatz.gesamtkosten > 0 ? zusatz.gesamtkosten : undefined;
  if (!gegenstand && stueckzahl === undefined && gesamtkosten === undefined) return null;
  return { ...(gegenstand ? { gegenstand } : {}), ...(stueckzahl !== undefined ? { stueckzahl } : {}), ...(gesamtkosten !== undefined ? { gesamtkosten } : {}) };
}

/** Jahresschlüssel einer Jahresabbildung, aufsteigend. */
export function jahreVon(werte: Record<string, number> | undefined): string[] {
  return Object.keys(werte ?? {}).filter((jahr) => /^\d{4}$/u.test(jahr)).sort();
}
