/**
 * Gemeinsame Hilfen der Seiten „Einzelpläne“, „Einzelplan“ und „Kapitel“ einer Snapshot-Periode
 * (/haushalt/<periode>/einzelplaene/…).
 *
 * Alle Beträge kommen unverändert aus dem Snapshot (`lib/haushalt/snapshot.ts`). Hier entstehen
 * nur zulässige Ableitungen: Gruppierungen, Anteile, Veränderungen und Kontrollsummen. Jede
 * Kontrollsumme, die nicht aufgeht, bricht den Build ab, statt eine abweichende Zahl zu zeigen.
 * Freitexte der Quelle erscheinen ausschließlich über `lib/haushalt/oeffentlich.ts`.
 */
import { loadMinistries, loadTopics } from '@ostrecht/shared/lib/portal/loader.ts';
import {
  getBudgetChapterUrl,
  getBudgetPeriodPageUrl,
  getBudgetPeriodPlanUrl,
  getBudgetPeriodUrl,
  getBudgetProjectUrl,
  getBudgetTitleAnchor,
  getBudgetUrl,
  getHomeUrl,
  getMinistryUrl,
  getTopicUrl,
} from '@ostrecht/shared/lib/portal/routes.ts';

import {
  formatPeriodenjahre,
  getPeriodeStatusInfo,
  getVisibleSnapshotPeriods,
  isPreviewOnly,
  type Haushaltsperiode,
} from '../../../lib/haushalt/perioden.ts';
import {
  hasProjektseite,
  loadEinzelplanOverlays,
  loadFreitextOverlay,
  loadProjektOverlays,
  publicBezeichnung,
  publicTiteltexte,
  rechtsgrundlageBezuege,
  RECHTSBEZUG_ART_LABELS,
  type EinzelplanOverlay,
  type FreitextOverlay,
  type ProjektOverlay,
  type RechtsbezugArt,
} from '../../../lib/haushalt/oeffentlich.ts';
import {
  loadEinzelplaene,
  loadImportManifest,
  loadKapitelForPlan,
  loadPeriodMeta,
  loadProjekte,
  loadTitelForPlan,
} from '../../../lib/haushalt/snapshot.ts';
import type { Einzelplan, Herkunft, Kapitel, Periodenmeta, Projekt, Qualitaetsklasse, Seite, Titel } from '../../../lib/haushalt/types.ts';
import type { StatusTone } from '../format.ts';
import { getPeriodenQuelle, getPeriodNavItems, getWeiterePeriodenNav, type NavEintrag } from '../../../lib/haushalt/seite.ts';

export type { NavEintrag } from '../../../lib/haushalt/seite.ts';

// ---------------------------------------------------------------------------------------------
// Routen

export interface PeriodenProps {
  periode: Haushaltsperiode;
}

/** Pfade je sichtbarer Snapshot-Periode (ohne Vorschau keine Seiten nicht freigegebener Perioden). */
export function periodenPfade() {
  return getVisibleSnapshotPeriods().map((periode) => ({ params: { periode: periode.id }, props: { periode } }));
}

export interface EinzelplanProps extends PeriodenProps {
  plan: Einzelplan;
}

export function einzelplanPfade() {
  return getVisibleSnapshotPeriods().flatMap((periode) =>
    loadEinzelplaene(periode.id).map((plan) => ({ params: { periode: periode.id, ep: plan.ep }, props: { periode, plan } })),
  );
}

export interface KapitelProps extends EinzelplanProps {
  kapitel: Kapitel;
}

export function kapitelPfade() {
  return getVisibleSnapshotPeriods().flatMap((periode) =>
    loadEinzelplaene(periode.id).flatMap((plan) => {
      const kapitel = loadKapitelForPlan(periode.id, plan.ep);
      const codes = kapitel.map((entry) => entry.kapitel).sort();
      const erwartet = [...plan.kapitel].sort();
      if (codes.join(',') !== erwartet.join(',')) {
        throw new Error(`Einzelplan ${plan.ep}: Kapitelliste (${erwartet.join(', ')}) passt nicht zu kapitel.json (${codes.join(', ')}).`);
      }
      return kapitel.map((entry) => ({
        params: { periode: periode.id, ep: plan.ep, kapitel: entry.kapitel },
        props: { periode, plan, kapitel: entry },
      }));
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Seitenrahmen

export interface LayoutKontext {
  periodLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
  statusText: string;
  datenstand: string;
  datenversion: string;
  preview: boolean;
  navItems: NavEintrag[];
  otherPeriods: NavEintrag[];
}

export interface SeitenKontext {
  id: string;
  jahre: string[];
  periodeLabel: string;
  jahreLabel: string;
  meta: Periodenmeta;
  freitexte: FreitextOverlay;
  layout: LayoutKontext;
  /** Brotkrume bis zur Periode (Startseite › Haushalt › Doppelhaushalt …). */
  brotkrume: Array<{ label: string; href?: string }>;
  downloadsHref: string;
  /** Öffentliche Quellenangabe für SourceNote. */
  quelle: string;
}

/**
 * Rahmenangaben einer Seite des Einzelplanbereichs. `andere` bestimmt, wohin die Verweise auf
 * andere Perioden führen: zur Einzelplanübersicht der Periode oder zu ihrem Einstieg (Einzelpläne
 * werden zwischen Perioden neu zugeschnitten, Einzelplanseiten sind nicht vergleichbar).
 */
export function getSeitenKontext(periode: Haushaltsperiode, andere: 'einzelplaene' | 'start'): SeitenKontext {
  const id = periode.id;
  const meta = loadPeriodMeta(id);
  const manifest = loadImportManifest(id);
  const status = getPeriodeStatusInfo(periode);
  const jahre = meta.jahre.map(String);
  const seite = (slug: string) => getBudgetPeriodPageUrl(id, slug);
  return {
    id,
    jahre,
    periodeLabel: periode.bezeichnung,
    jahreLabel: formatPeriodenjahre(periode),
    meta,
    freitexte: loadFreitextOverlay(id),
    layout: {
      periodLabel: periode.bezeichnung,
      statusLabel: status.label,
      statusTone: status.tone,
      statusText: status.text,
      datenstand: meta.stand,
      datenversion: manifest.quelle.commit_kurz,
      preview: isPreviewOnly(periode),
      navItems: getPeriodNavItems(periode, 'einzelplaene'),
      otherPeriods: getWeiterePeriodenNav(id, andere === 'einzelplaene' ? 'einzelplaene' : null),
    },
    brotkrume: [
      { label: 'Startseite', href: getHomeUrl() },
      { label: 'Haushalt', href: getBudgetUrl() },
      { label: periode.bezeichnung, href: getBudgetPeriodUrl(id) },
    ],
    downloadsHref: seite('downloads'),
    quelle: getPeriodenQuelle(periode),
  };
}

// ---------------------------------------------------------------------------------------------
// Öffentliche Texte

/**
 * Öffentliche Fassung einer Bezeichnung oder null, wenn keine unbedenkliche Fassung vorliegt
 * (fail-closed; `publicBezeichnung` würde den Build abbrechen). Für Angaben, die ohne Fassung
 * entfallen oder zusammengefasst werden können.
 */
export function sichereBezeichnung(text: string | undefined, freitexte: FreitextOverlay): string | null {
  if (!text || text.trim() === '') return null;
  try {
    return publicBezeichnung(text, freitexte);
  } catch {
    return null;
  }
}

export interface Verweis {
  label: string;
  href: string;
}

let ministerienCache: Promise<Map<string, Verweis>> | null = null;
let themenCache: Promise<Map<string, Verweis>> | null = null;

async function ministerien(): Promise<Map<string, Verweis>> {
  ministerienCache ??= loadMinistries().then(
    (entries) => new Map(entries.map((entry) => [entry.slug, { label: entry.name, href: getMinistryUrl(entry.slug) }])),
  );
  return ministerienCache;
}

async function themen(): Promise<Map<string, Verweis>> {
  themenCache ??= loadTopics().then((entries) => new Map(entries.map((entry) => [entry.slug, { label: entry.title, href: getTopicUrl(entry.slug) }])));
  return themenCache;
}

export interface Zustaendigkeit {
  /** Ressorts laut Overlay (verlinkt). */
  ressorts: Verweis[];
  /** Zuständigkeit laut Quelle, wenn kein Ressort zugeordnet ist und der Text unbedenklich ist. */
  text: string | null;
}

/** Zuständige Ressorts eines Einzelplans: Overlay `ministrySlugs`, sonst der unbedenkliche Quelltext. */
export async function getZustaendigkeit(plan: Einzelplan, overlay: EinzelplanOverlay | undefined, freitexte: FreitextOverlay): Promise<Zustaendigkeit> {
  const verzeichnis = await ministerien();
  const ressorts = (overlay?.ministrySlugs ?? []).map((slug) => {
    const eintrag = verzeichnis.get(slug);
    if (!eintrag) throw new Error(`Einzelplan ${plan.ep}: Ressort „${slug}“ fehlt unter content/ressorts/.`);
    return eintrag;
  });
  return { ressorts, text: ressorts.length > 0 ? null : sichereBezeichnung(plan.ressort, freitexte) };
}

/** Themenseiten laut Overlay `topicSlugs`. */
export async function getThemen(overlay: EinzelplanOverlay | undefined): Promise<Verweis[]> {
  const verzeichnis = await themen();
  return (overlay?.topicSlugs ?? []).map((slug) => {
    const eintrag = verzeichnis.get(slug);
    if (!eintrag) throw new Error(`Themenseite „${slug}“ fehlt unter content/themen/.`);
    return eintrag;
  });
}

export interface PlanName {
  /** Redaktioneller Kurztitel, sonst die öffentliche Bezeichnung. */
  kurz: string;
  /** Öffentliche amtliche Bezeichnung. */
  amtlich: string;
}

export function getPlanName(plan: Einzelplan, overlay: EinzelplanOverlay | undefined, freitexte: FreitextOverlay): PlanName {
  const amtlich = publicBezeichnung(plan.bezeichnung, freitexte);
  return { kurz: overlay?.kurztitel ?? amtlich, amtlich };
}

export function getPlanOverlays(periode: string): Record<string, EinzelplanOverlay> {
  return loadEinzelplanOverlays(periode);
}

// ---------------------------------------------------------------------------------------------
// Zahlen und Kontrollsummen

/** Bricht ab, wenn eine Kontrollsumme nicht mit dem Bezugswert übereinstimmt. */
export function pruefeSumme(bezeichnung: string, ist: number, soll: number): void {
  if (ist !== soll) throw new Error(`Kontrollsumme ${bezeichnung}: ${ist} weicht von ${soll} ab.`);
}

export function summe(werte: readonly number[]): number {
  return werte.reduce((total, wert) => total + wert, 0);
}

/** Betrag eines Titels in einem Jahr (fehlt das Jahr, ist der Ansatz 0). */
export function betrag(titel: Titel, jahr: string): number {
  return titel.jahre[jahr as `${number}`]?.betrag ?? 0;
}

const titelOrdnung = new Intl.Collator('de', { numeric: true });

/** Titel aufsteigend nach Titelnummer. */
export function nachTitelnummer(left: Titel, right: Titel): number {
  return titelOrdnung.compare(left.titel, right.titel);
}

/**
 * Prüft die Sprungziele eines Kapitels: jede Titelnummer ergibt genau einen Anker
 * `titel-<nummer>`. Eine Doppelung bricht den Build ab.
 */
export function pruefeTitelanker(kapitel: string, titel: readonly Titel[]): Map<string, string> {
  const anker = new Map<string, string>();
  for (const eintrag of titel) {
    const id = getBudgetTitleAnchor(eintrag.titel);
    const vorhanden = anker.get(id);
    if (vorhanden) throw new Error(`Kapitel ${kapitel}: Sprungziel ${id} doppelt (${vorhanden}, ${eintrag.konzept_id}).`);
    anker.set(id, eintrag.konzept_id);
  }
  return anker;
}

/**
 * Prüft je Seite (Einnahme/Ausgabe) und Jahr: Σ Titel = Kapitelsumme, Σ Titel je Hauptgruppe =
 * Hauptgruppe des Kapitels.
 */
export function pruefeKapitelsummen(kapitel: Kapitel, titel: readonly Titel[], jahre: readonly string[]): void {
  for (const jahr of jahre) {
    const daten = kapitel.jahre[jahr as `${number}`];
    if (!daten) throw new Error(`Kapitel ${kapitel.kapitel}: Jahr ${jahr} fehlt.`);
    const seiten: Array<[Seite, number]> = [
      ['Einnahme', daten.einnahmen],
      ['Ausgabe', daten.ausgaben],
    ];
    for (const [seite, soll] of seiten) {
      pruefeSumme(`Kapitel ${kapitel.kapitel} ${seite} ${jahr}`, summe(titel.filter((entry) => entry.seite === seite).map((entry) => betrag(entry, jahr))), soll);
    }
    for (const [hg, soll] of Object.entries(daten.hauptgruppen)) {
      pruefeSumme(
        `Kapitel ${kapitel.kapitel} Hauptgruppe ${hg} ${jahr}`,
        summe(titel.filter((entry) => entry.hauptgruppe === hg).map((entry) => betrag(entry, jahr))),
        soll,
      );
    }
  }
}

/** Prüft je Jahr: Σ Kapitel = Einzelplan (Einnahmen, Ausgaben, Hauptgruppen). */
export function pruefePlansummen(plan: Einzelplan, kapitel: readonly Kapitel[], jahre: readonly string[]): void {
  for (const jahr of jahre) {
    const soll = plan.jahre[jahr as `${number}`];
    if (!soll) throw new Error(`Einzelplan ${plan.ep}: Jahr ${jahr} fehlt.`);
    const daten = kapitel.map((entry) => entry.jahre[jahr as `${number}`]);
    pruefeSumme(`Einzelplan ${plan.ep} Einnahmen ${jahr}`, summe(daten.map((entry) => entry.einnahmen)), soll.einnahmen);
    pruefeSumme(`Einzelplan ${plan.ep} Ausgaben ${jahr}`, summe(daten.map((entry) => entry.ausgaben)), soll.ausgaben);
    for (const [hg, wert] of Object.entries(soll.hauptgruppen)) {
      pruefeSumme(`Einzelplan ${plan.ep} Hauptgruppe ${hg} ${jahr}`, summe(daten.map((entry) => entry.hauptgruppen[hg as '0'])), wert);
    }
  }
}

/**
 * Exakter Dezimaltext in deutscher Schreibweise: „407.28“ → „407,28“, „1122.00“ → „1.122,00“,
 * „419250000“ → „419.250.000“. Rechnet nicht, damit keine Stelle verloren geht.
 */
export function formatDezimaltext(text: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/u.exec(text.trim());
  if (!match) return text;
  const [, minus, ganz, bruch] = match;
  const gruppiert = ganz.replace(/\B(?=(\d{3})+(?!\d))/gu, '.');
  return `${minus ? '−' : ''}${gruppiert}${bruch ? `,${bruch}` : ''}`;
}

// ---------------------------------------------------------------------------------------------
// Vorhaben

export interface ProjektVerweis {
  id: string;
  titel: string;
  href: string | null;
  overlay: ProjektOverlay;
}

/** Öffentlicher Verweis auf ein Vorhaben (nur mit Overlay; Link nur bei eigener Projektseite). */
export function getProjektVerweis(periode: string, projekt: Projekt | undefined): ProjektVerweis | null {
  if (!projekt) return null;
  const overlay = loadProjektOverlays(periode)[projekt.id];
  if (!overlay) return null;
  return {
    id: projekt.id,
    titel: overlay.titel,
    href: hasProjektseite(projekt, overlay) ? getBudgetProjectUrl(periode, overlay.slug) : null,
    overlay,
  };
}

export function getProjekteNachId(periode: string): Map<string, Projekt> {
  return new Map(loadProjekte(periode).map((projekt) => [projekt.id, projekt]));
}

export interface PlanProjekt extends ProjektVerweis {
  /** Titel dieses Vorhabens im Einzelplan. */
  titel_im_plan: Titel[];
  /** Ausgabetitel des Vorhabens im Einzelplan je Jahr (Gruppierung derselben Titel). */
  ausgaben: Record<string, number>;
  einnahmen: Record<string, number>;
}

/**
 * Vorhaben eines Einzelplans: Vorhaben mit Titeln in seinen Kapiteln sowie Vorhaben ohne
 * zugeordnete Kapitel, die der Quelle nach zum Einzelplan gehören. Wie in der Projektübersicht
 * (getProjektSichten) folgt der Einzelplan den tatsächlich zugeordneten Kapiteln; das Feld
 * `einzelplan` der Quelle gilt nur für Vorhaben ohne Kapitel. Reihenfolge: nach den
 * Ausgabetiteln im Einzelplan.
 */
export function getPlanProjekte(periode: string, plan: Einzelplan, titel: readonly Titel[], jahre: readonly string[]): PlanProjekt[] {
  const ergebnis: PlanProjekt[] = [];
  for (const projekt of loadProjekte(periode)) {
    const eigene = titel.filter((entry) => entry.projekt_id === projekt.id);
    const ohneKapitel = projekt.kapitel.length === 0 && projekt.titel.length === 0;
    const kapitelImPlan = projekt.kapitel.some((kapitel) => plan.kapitel.includes(kapitel));
    if (eigene.length === 0 && !kapitelImPlan && !(ohneKapitel && projekt.einzelplan === plan.ep)) continue;
    const verweis = getProjektVerweis(periode, projekt);
    if (!verweis) continue;
    const proJahr = (seite: Seite) =>
      Object.fromEntries(jahre.map((jahr) => [jahr, summe(eigene.filter((entry) => entry.seite === seite).map((entry) => betrag(entry, jahr)))]));
    ergebnis.push({ ...verweis, titel_im_plan: [...eigene].sort(nachTitelnummer), ausgaben: proJahr('Ausgabe'), einnahmen: proJahr('Einnahme') });
  }
  const gewicht = (projekt: PlanProjekt) => summe(Object.values(projekt.ausgaben).map(Math.abs)) + summe(Object.values(projekt.einnahmen).map(Math.abs));
  return ergebnis.sort((left, right) => gewicht(right) - gewicht(left) || left.titel.localeCompare(right.titel, 'de'));
}

// ---------------------------------------------------------------------------------------------
// Rechtsbezüge

export interface Rechtsbezug {
  text: string;
  normSlug?: string;
  art?: RechtsbezugArt;
  artLabel: string | null;
  /** Vorhaben mit diesem Rechtsbezug. */
  vorhaben: Array<{ label: string; href: string | null }>;
  /** Titel mit dieser Rechtsgrundlage, nach Kapitel (Kapitelnummer → Titel). */
  titel: Array<{ kapitel: string; titel: Array<{ label: string; href: string }> }>;
}

/**
 * Rechtsbezüge eines Einzelplans: redaktionelle Rechtsbezüge seiner Vorhaben und die
 * freigegebenen Rechtsgrundlagen seiner Titel (nur über `publicRechtsgrundlage`).
 */
export function getRechtsbezuege(
  projekte: readonly PlanProjekt[],
  titel: readonly Titel[],
  jahre: readonly string[],
  freitexte: FreitextOverlay,
  titelHref: (entry: Titel) => string,
): Rechtsbezug[] {
  const map = new Map<string, Rechtsbezug>();
  const eintragFuer = (eintrag: { text: string; normSlug?: string; art?: RechtsbezugArt }): Rechtsbezug => {
    const key = `${eintrag.normSlug ?? ''}|${eintrag.text}|${eintrag.art ?? ''}`;
    let vorhanden = map.get(key);
    if (!vorhanden) {
      vorhanden = { ...eintrag, artLabel: eintrag.art ? RECHTSBEZUG_ART_LABELS[eintrag.art] : null, vorhaben: [], titel: [] };
      map.set(key, vorhanden);
    }
    return vorhanden;
  };
  for (const projekt of projekte) {
    for (const bezug of projekt.overlay.rechtsbezuege) {
      const ziel = eintragFuer({ text: bezug.label, normSlug: bezug.normSlug, art: bezug.art });
      if (!ziel.vorhaben.some((entry) => entry.label === projekt.titel)) ziel.vorhaben.push({ label: projekt.titel, href: projekt.href });
    }
  }
  for (const eintrag of [...titel].sort((left, right) => left.kapitel.localeCompare(right.kapitel) || nachTitelnummer(left, right))) {
    const gesehen = new Set<string>();
    for (const jahr of jahre) {
      for (const rechtsgrundlage of rechtsgrundlageBezuege(publicTiteltexte(eintrag, jahr, freitexte).rechtsgrundlage)) {
        if (gesehen.has(rechtsgrundlage.text)) continue;
        gesehen.add(rechtsgrundlage.text);
        const ziel = eintragFuer(rechtsgrundlage);
        let gruppe = ziel.titel.find((entry) => entry.kapitel === eintrag.kapitel);
        if (!gruppe) {
          gruppe = { kapitel: eintrag.kapitel, titel: [] };
          ziel.titel.push(gruppe);
        }
        gruppe.titel.push({ label: `${eintrag.titel.slice(0, 3)} ${eintrag.titel.slice(3)}`, href: titelHref(eintrag) });
      }
    }
  }
  return [...map.values()].sort((left, right) => left.text.localeCompare(right.text, 'de'));
}

// ---------------------------------------------------------------------------------------------
// Herkunft und Qualität der Kapitelwerte

export interface QualitaetsZeile {
  /** Öffentliche Bezeichnung der Ansatzart oder Sammelbezeichnung. */
  label: string;
  herkunft: Herkunft;
  klassen: Qualitaetsklasse[];
  werte: Record<string, number>;
  anteile: Record<string, number | null>;
}

/**
 * Ausgaben (bzw. Einnahmen) eines Kapitels nach Ansatzart (Qualitätsklasse der Titel) je Jahr.
 * Die Bezeichnungen stammen aus der Legende der Periode und erscheinen nur in öffentlicher
 * Fassung; Ansatzarten ohne solche Fassung werden je Herkunft zusammengefasst.
 */
export function getQualitaetsZeilen(
  titel: readonly Titel[],
  seite: Seite,
  jahre: readonly string[],
  meta: Periodenmeta,
  freitexte: FreitextOverlay,
  sammelLabel: (herkunft: Herkunft) => string,
): QualitaetsZeile[] {
  const auswahl = titel.filter((entry) => entry.seite === seite);
  const gesamt = Object.fromEntries(jahre.map((jahr) => [jahr, summe(auswahl.map((entry) => betrag(entry, jahr)))]));
  const zeilen = new Map<string, QualitaetsZeile>();
  for (const eintrag of auswahl) {
    const klasse = eintrag.qualitaet;
    if (!klasse) continue;
    const legende = meta.legenden.qualitaet.find((entry) => entry.kennung === klasse);
    // Die Spalte „Herkunft“ folgt dem Herkunftskennzeichen der Titel (wie in der Titeltabelle);
    // die Qualitätsklasse bestimmt nur die Art des Ansatzes.
    const herkunft = (eintrag.herkunft ?? legende?.herkunft ?? 'S') as Herkunft;
    const oeffentlich = sichereBezeichnung(legende?.bezeichnung, freitexte);
    const label = oeffentlich ? oeffentlich.charAt(0).toLocaleUpperCase('de-DE') + oeffentlich.slice(1) : sammelLabel(herkunft);
    const key = `${herkunft}|${label}`;
    let zeile = zeilen.get(key);
    if (!zeile) {
      zeile = { label, herkunft, klassen: [], werte: Object.fromEntries(jahre.map((jahr) => [jahr, 0])), anteile: {} };
      zeilen.set(key, zeile);
    }
    if (!zeile.klassen.includes(klasse)) zeile.klassen.push(klasse);
    for (const jahr of jahre) zeile.werte[jahr] += betrag(eintrag, jahr);
  }
  const reihenfolge = meta.legenden.qualitaet.map((entry) => entry.kennung);
  const ergebnis = [...zeilen.values()].sort(
    (left, right) => reihenfolge.indexOf(left.klassen[0]) - reihenfolge.indexOf(right.klassen[0]),
  );
  for (const zeile of ergebnis) {
    for (const jahr of jahre) zeile.anteile[jahr] = gesamt[jahr] === 0 ? null : zeile.werte[jahr] / gesamt[jahr];
  }
  for (const jahr of jahre) pruefeSumme(`Ansatzarten ${seite} ${jahr}`, summe(ergebnis.map((zeile) => zeile.werte[jahr])), gesamt[jahr]);
  return ergebnis;
}

// ---------------------------------------------------------------------------------------------
// Adressen

export function planHref(periode: string, ep: string): string {
  return getBudgetPeriodPlanUrl(periode, ep);
}

export function kapitelHref(periode: string, kapitel: Kapitel): string {
  return getBudgetChapterUrl(periode, kapitel.einzelplan, kapitel.kapitel);
}

export function loadPlanTitel(periode: string, ep: string): Titel[] {
  return loadTitelForPlan(periode, ep);
}
