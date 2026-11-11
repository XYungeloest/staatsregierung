/**
 * Rücklagen, Fonds und Landesunternehmen: redaktionelles Overlay und abgeleitete Sichten.
 *
 * Beträge kommen ausschließlich aus dem Snapshot (ruecklagen.json, Titel). Öffentliche Namen,
 * Zwecke, Rechtsträger, Rechtsbezüge und Status stehen in content/haushalt/<periode>/fonds.json
 * (keine Beträge). Erlaubte Ableitungen: Summen je Fonds, Art und Jahr (Kontrollsummen) und der
 * Abgleich mit den Einnahmetiteln des Kernhaushalts. Ein Fonds oder Unternehmen ohne Overlay,
 * ein unzulässiger Text oder ein Verweis auf eine nicht vorhandene Norm bricht den Build ab.
 *
 * Die Quellfelder `einnahmetitel_kernhaushalt`, `verwendungsart`, `kapitel` der Fondsgegenposten
 * und `rechtsgrundlage` der Wirtschaftspläne werden nicht angezeigt; der Bezug zum Kernhaushalt
 * entsteht aus den redaktionellen Titelverweisen, die hier gegen die Ansätze geprüft werden.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getBudgetProjectUrl, getBudgetTitleUrl, getBudgetChapterUrl } from '@ostrecht/shared/lib/portal/routes.ts';

import {
  enthaeltMetabegriff,
  enthaeltPaarform,
  findeMetabegriffe,
  formatKapitelnummer,
  formatTitelnummer,
  hasProjektseite,
  loadFreitextOverlay,
  loadProjektOverlays,
  publicBezeichnung,
  RECHTSBEZUG_ART_LABELS,
  RECHTSBEZUG_ARTEN,
  resolveRechtsbezugArt,
  type RechtsbezugArt,
} from '../../../lib/haushalt/oeffentlich.ts';
import {
  loadAllTitel,
  loadKapitel,
  loadProjekte,
  loadRuecklagen,
  resolveHaushaltRepositoryRoot,
} from '../../../lib/haushalt/snapshot.ts';
import type { Fondsgegenposten, Titel, Wirtschaftsplanjahr } from '../../../lib/haushalt/types.ts';
import type { OriginCode } from '../format.ts';

// ---------------------------------------------------------------------------------------------
// Overlay

export interface TitelVerweis {
  kapitel: string;
  titel: string;
}

export interface OverlayRechtsbezug {
  normSlug?: string;
  label: string;
  art: RechtsbezugArt;
}

export type FondsArt = 'zweckruecklage' | 'sondervermoegen' | 'versorgungsfonds';
export const FONDS_ARTEN: readonly FondsArt[] = ['zweckruecklage', 'sondervermoegen', 'versorgungsfonds'];

/** Zuordnung der Quellart eines Gegenpostens zur öffentlichen Art. */
const QUELLART: Record<string, FondsArt> = {
  earmarked: 'zweckruecklage',
  special_fund: 'sondervermoegen',
  pension: 'versorgungsfonds',
};

export type InstrumentStatus = 'entwurf' | 'beschlussentwurf' | 'option';

export const INSTRUMENT_STATUS_LABELS: Record<InstrumentStatus, string> = {
  entwurf: 'Im Entwurf',
  beschlussentwurf: 'Beschlussentwurf',
  option: 'Option, nicht finanziert',
};

export interface InstrumentOverlay {
  name: string;
  zweck: string;
  rechtstraeger: string;
  rechtsbezuege: OverlayRechtsbezug[];
  kernhaushaltTitel: TitelVerweis[];
  status: InstrumentStatus;
  statusText: string;
}

export interface ArtOverlay {
  label: string;
  plural: string;
  rechtstraeger: string;
  rechtsbezuege: OverlayRechtsbezug[];
  statusText: string;
  rechtsaenderungText: string;
}

export interface FondsOverlay {
  name: string;
  art: FondsArt;
  vorgaengerland?: string;
  bereich: string;
  zweck: string;
  einnahmetitel: TitelVerweis;
}

export interface UnternehmenOverlay {
  name: string;
  rechtsform: string;
  zweck: string;
  rechtsbezuege: OverlayRechtsbezug[];
  kapitel: string[];
  gegenbuchung?: TitelVerweis[];
  projektId?: string;
  status: InstrumentStatus;
  statusText: string;
}

export interface FondsOverlayDatei {
  instrumente: { 'allgemeine-ruecklage': InstrumentOverlay; liquiditaetsruecklage: InstrumentOverlay };
  arten: Record<FondsArt, ArtOverlay>;
  fonds: Record<string, FondsOverlay>;
  unternehmen: Record<string, UnternehmenOverlay>;
}

const overlayCache = new Map<string, FondsOverlayDatei>();

function pruefeText(at: string, text: unknown): void {
  if (typeof text !== 'string' || text.trim() === '') throw new Error(`fonds.json ${at}: Text fehlt.`);
  if (enthaeltMetabegriff(text)) throw new Error(`fonds.json ${at}: interner Begriff (${findeMetabegriffe(text).join(', ')}) in „${text}“.`);
  if (enthaeltPaarform(text)) throw new Error(`fonds.json ${at}: Paarform in „${text}“; Personenbezeichnungen mit Doppelpunkt schreiben.`);
}

function normExistiert(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/u.test(slug) && existsSync(join(resolveHaushaltRepositoryRoot(), 'content', 'normen', slug, 'meta.json'));
}

function pruefeRechtsbezuege(at: string, bezuege: unknown): void {
  if (!Array.isArray(bezuege)) throw new Error(`fonds.json ${at}: rechtsbezuege fehlen.`);
  bezuege.forEach((bezug: OverlayRechtsbezug, index) => {
    pruefeText(`${at}[${index}].label`, bezug.label);
    if (!(RECHTSBEZUG_ARTEN as readonly string[]).includes(bezug.art)) throw new Error(`fonds.json ${at}[${index}]: Art „${bezug.art}“ unzulässig.`);
    if (bezug.normSlug !== undefined && !normExistiert(bezug.normSlug)) {
      throw new Error(`fonds.json ${at}[${index}]: Norm „${bezug.normSlug}“ existiert nicht.`);
    }
  });
}

function pruefeVerweis(at: string, verweis: unknown): void {
  const value = verweis as Partial<TitelVerweis> | undefined;
  if (!value || !/^\d{4}$/u.test(value.kapitel ?? '') || !/^\d{5}$/u.test(value.titel ?? '')) {
    throw new Error(`fonds.json ${at}: Titelverweis ungültig.`);
  }
}

function pruefeStatus(at: string, status: unknown): void {
  if (typeof status !== 'string' || !(status in INSTRUMENT_STATUS_LABELS)) throw new Error(`fonds.json ${at}: Status „${String(status)}“ unzulässig.`);
}

/** content/haushalt/<periode>/fonds.json, geprüft (zwischengespeichert). */
export function loadFondsOverlay(periode: string): FondsOverlayDatei {
  const cached = overlayCache.get(periode);
  if (cached) return cached;
  if (!/^\d{4}-\d{4}$/u.test(periode)) throw new Error(`Ungültige Haushaltsperiode „${periode}“.`);
  const pfad = join(resolveHaushaltRepositoryRoot(), 'content', 'haushalt', periode, 'fonds.json');
  if (!existsSync(pfad)) throw new Error(`content/haushalt/${periode}/fonds.json fehlt.`);
  const datei = JSON.parse(readFileSync(pfad, 'utf8')) as FondsOverlayDatei;

  for (const [key, instrument] of Object.entries(datei.instrumente ?? {})) {
    const at = `instrumente.${key}`;
    for (const feld of ['name', 'zweck', 'rechtstraeger', 'statusText'] as const) pruefeText(`${at}.${feld}`, instrument[feld]);
    pruefeRechtsbezuege(`${at}.rechtsbezuege`, instrument.rechtsbezuege);
    instrument.kernhaushaltTitel.forEach((verweis, index) => pruefeVerweis(`${at}.kernhaushaltTitel[${index}]`, verweis));
    pruefeStatus(`${at}.status`, instrument.status);
  }
  if (!datei.instrumente?.['allgemeine-ruecklage'] || !datei.instrumente?.liquiditaetsruecklage) {
    throw new Error('fonds.json: Angaben zur allgemeinen Rücklage oder zur Liquiditätsrücklage fehlen.');
  }
  for (const art of FONDS_ARTEN) {
    const eintrag = datei.arten?.[art];
    if (!eintrag) throw new Error(`fonds.json: Art „${art}“ fehlt.`);
    for (const feld of ['label', 'plural', 'rechtstraeger', 'statusText', 'rechtsaenderungText'] as const) pruefeText(`arten.${art}.${feld}`, eintrag[feld]);
    pruefeRechtsbezuege(`arten.${art}.rechtsbezuege`, eintrag.rechtsbezuege);
  }
  for (const [id, fonds] of Object.entries(datei.fonds ?? {})) {
    const at = `fonds.${id}`;
    for (const feld of ['name', 'bereich', 'zweck'] as const) pruefeText(`${at}.${feld}`, fonds[feld]);
    if (fonds.vorgaengerland !== undefined) pruefeText(`${at}.vorgaengerland`, fonds.vorgaengerland);
    if (!FONDS_ARTEN.includes(fonds.art)) throw new Error(`fonds.json ${at}: Art „${fonds.art}“ unzulässig.`);
    pruefeVerweis(`${at}.einnahmetitel`, fonds.einnahmetitel);
  }
  for (const [id, unternehmen] of Object.entries(datei.unternehmen ?? {})) {
    const at = `unternehmen.${id}`;
    for (const feld of ['name', 'rechtsform', 'zweck', 'statusText'] as const) pruefeText(`${at}.${feld}`, unternehmen[feld]);
    pruefeRechtsbezuege(`${at}.rechtsbezuege`, unternehmen.rechtsbezuege);
    pruefeStatus(`${at}.status`, unternehmen.status);
    unternehmen.kapitel.forEach((kapitel) => {
      if (!/^\d{4}$/u.test(kapitel)) throw new Error(`fonds.json ${at}.kapitel: „${kapitel}“ ist keine Kapitelnummer.`);
    });
    (unternehmen.gegenbuchung ?? []).forEach((verweis, index) => pruefeVerweis(`${at}.gegenbuchung[${index}]`, verweis));
  }
  overlayCache.set(periode, datei);
  return datei;
}

// ---------------------------------------------------------------------------------------------
// Rechtsbezüge

export interface AngezeigterRechtsbezug {
  label: string;
  normSlug?: string;
  art: RechtsbezugArt;
  artLabel: string;
}

/** Rechtsbezüge mit der zum Stichtag angezeigten Art (Normstatus bei Normverweisen). */
export function zeigeRechtsbezuege(bezuege: readonly OverlayRechtsbezug[]): AngezeigterRechtsbezug[] {
  return bezuege.map((bezug) => {
    const art = resolveRechtsbezugArt(bezug.art, bezug.normSlug) ?? bezug.art;
    return { label: bezug.label, ...(bezug.normSlug ? { normSlug: bezug.normSlug } : {}), art, artLabel: RECHTSBEZUG_ART_LABELS[art] };
  });
}

// ---------------------------------------------------------------------------------------------
// Titelbezüge

export interface TitelInfo {
  kapitel: string;
  titel: string;
  nummer: string;
  kapitelNummer: string;
  zweckbestimmung: string;
  seite: Titel['seite'];
  betraege: Record<string, number>;
  href: string;
}

function titelIndex(periode: string): Map<string, Titel> {
  return new Map(loadAllTitel(periode).map((titel) => [`${titel.kapitel}/${titel.titel}`, titel]));
}

function kapitelSet(periode: string): Set<string> {
  return new Set(loadKapitel(periode).map((kapitel) => kapitel.kapitel));
}

function titelInfo(periode: string, titel: Titel, jahre: readonly string[]): TitelInfo {
  const freitexte = loadFreitextOverlay(periode);
  return {
    kapitel: titel.kapitel,
    titel: titel.titel,
    nummer: formatTitelnummer(titel.titel),
    kapitelNummer: formatKapitelnummer(titel.kapitel),
    zweckbestimmung: publicBezeichnung(titel.zweckbestimmung ?? '', freitexte),
    seite: titel.seite,
    betraege: Object.fromEntries(jahre.map((jahr) => [jahr, titel.jahre[jahr as `${number}`]?.betrag ?? 0])),
    href: getBudgetTitleUrl(periode, titel.kapitel.slice(0, 2), titel.kapitel, titel.titel),
  };
}

/** Titel zu Verweisen; nicht vorhandene Titel entfallen. */
export function findeTitel(periode: string, verweise: readonly TitelVerweis[], jahre: readonly string[]): TitelInfo[] {
  const index = titelIndex(periode);
  const kapitel = kapitelSet(periode);
  return verweise.flatMap((verweis) => {
    const titel = index.get(`${verweis.kapitel}/${verweis.titel}`);
    return titel && kapitel.has(titel.kapitel) ? [titelInfo(periode, titel, jahre)] : [];
  });
}

/**
 * Rücklagenbewegungen im Kernhaushalt: alle Titel der Obergruppen 35 (Entnahmen aus Rücklagen,
 * Fonds und Stöcken) und 91 (Zuführungen an Rücklagen, Fonds und Stöcke) sowie der Gruppe 234
 * (Zuweisungen von Sondervermögen), nach Kapitel und Titel geordnet.
 */
export function getRuecklagentitel(periode: string, jahre: readonly string[]): TitelInfo[] {
  const kapitel = kapitelSet(periode);
  return loadAllTitel(periode)
    .filter((titel) => kapitel.has(titel.kapitel) && (titel.obergruppe === '35' || titel.obergruppe === '91' || titel.gruppe === '234'))
    .sort((left, right) => left.kapitel.localeCompare(right.kapitel) || left.titel.localeCompare(right.titel))
    .map((titel) => titelInfo(periode, titel, jahre));
}

// ---------------------------------------------------------------------------------------------
// Fonds

export interface FondsZeile {
  id: string;
  /** Laufende Nummer in der Reihenfolge des Verwendungsplans (für stabile Anker). */
  anker: string;
  overlay: FondsOverlay;
  art: ArtOverlay;
  /** Verwendung je Jahr (alle Jahre der Quelle); fehlende Jahre fehlen. */
  betraege: Record<string, number>;
  eliminierung: Record<string, number>;
  rechtsaenderung: boolean;
  zielkapitel: Array<{ kapitel: string; nummer: string; href: string }>;
  herkunft: OriginCode[];
  /** Einnahmetitel im Kernhaushalt, nur wenn der Abgleich der Summen stimmt. */
  einnahmetitel: TitelInfo | null;
}

function summeJe<T>(eintraege: readonly T[], schluessel: (eintrag: T) => string, wert: (eintrag: T) => number): Record<string, number> {
  const ergebnis: Record<string, number> = {};
  for (const eintrag of eintraege) {
    const key = schluessel(eintrag);
    ergebnis[key] = (ergebnis[key] ?? 0) + wert(eintrag);
  }
  return ergebnis;
}

function herkunftCodes(posten: readonly Fondsgegenposten[]): OriginCode[] {
  const codes = new Set<string>();
  for (const eintrag of posten) for (const code of eintrag.herkunft.split('/')) codes.add(code.trim());
  return (['O', 'D', 'S', 'P'] as const).filter((code) => codes.has(code));
}

/**
 * Fonds und Zweckrücklagen mit Verwendung je Jahr. Prüft die Abdeckung durch das Overlay, die
 * Art und den Abgleich der Einnahmetitel (Summe der Fonds je Titel und Haushaltsjahr = Ansatz).
 */
export function getFondsZeilen(periode: string, haushaltsjahre: readonly string[]): FondsZeile[] {
  const overlay = loadFondsOverlay(periode);
  const posten = loadRuecklagen(periode).fonds_gegenposten;
  const kapitel = kapitelSet(periode);
  const reihenfolge: string[] = [];
  for (const eintrag of posten) if (!reihenfolge.includes(eintrag.fonds_id)) reihenfolge.push(eintrag.fonds_id);

  for (const id of reihenfolge) {
    const fonds = overlay.fonds[id];
    if (!fonds) throw new Error(`fonds.json: Fonds „${id}“ fehlt.`);
    for (const eintrag of posten.filter((entry) => entry.fonds_id === id)) {
      if (QUELLART[eintrag.art] !== fonds.art) throw new Error(`fonds.json: Art von „${id}“ passt nicht zur Quelle (${eintrag.art}).`);
    }
  }

  // Abgleich: Summe der Fonds je Einnahmetitel und Haushaltsjahr gegen den Ansatz des Titels.
  const titel = titelIndex(periode);
  const bestaetigt = new Map<string, boolean>();
  const gruppen = new Map<string, string[]>();
  for (const id of reihenfolge) {
    const key = `${overlay.fonds[id].einnahmetitel.kapitel}/${overlay.fonds[id].einnahmetitel.titel}`;
    gruppen.set(key, [...(gruppen.get(key) ?? []), id]);
  }
  for (const [key, ids] of gruppen) {
    const eintrag = titel.get(key);
    const stimmt =
      Boolean(eintrag) &&
      haushaltsjahre.every((jahr) => {
        const summe = posten.filter((entry) => ids.includes(entry.fonds_id) && String(entry.jahr) === jahr).reduce((sum, entry) => sum + entry.betrag, 0);
        return summe === (eintrag?.jahre[jahr as `${number}`]?.betrag ?? 0);
      });
    bestaetigt.set(key, stimmt);
  }

  return reihenfolge.map((id, index) => {
    const fonds = overlay.fonds[id];
    const eigene = posten.filter((entry) => entry.fonds_id === id);
    const ziel = [...new Set(eigene.flatMap((entry) => entry.zielkapitel))].sort();
    const key = `${fonds.einnahmetitel.kapitel}/${fonds.einnahmetitel.titel}`;
    const einnahme = titel.get(key);
    return {
      id,
      anker: `fonds-${String(index + 1).padStart(2, '0')}`,
      overlay: fonds,
      art: overlay.arten[fonds.art],
      betraege: summeJe(eigene, (entry) => String(entry.jahr), (entry) => entry.betrag),
      eliminierung: summeJe(eigene, (entry) => String(entry.jahr), (entry) => entry.konsolidierungseliminierung),
      rechtsaenderung: eigene.some((entry) => entry.rechtsaenderung_erforderlich),
      zielkapitel: ziel
        .filter((nummer) => kapitel.has(nummer))
        .map((nummer) => ({ kapitel: nummer, nummer: formatKapitelnummer(nummer), href: getBudgetChapterUrl(periode, nummer.slice(0, 2), nummer) })),
      herkunft: herkunftCodes(eigene),
      einnahmetitel: einnahme && bestaetigt.get(key) && kapitel.has(einnahme.kapitel) ? titelInfo(periode, einnahme, haushaltsjahre) : null,
    };
  });
}

export interface ArtSumme {
  art: FondsArt;
  overlay: ArtOverlay;
  anzahl: number;
  betraege: Record<string, number>;
  eliminierung: Record<string, number>;
}

/** Kontrollsummen je Art und Jahr. */
export function getArtSummen(zeilen: readonly FondsZeile[]): ArtSumme[] {
  return FONDS_ARTEN.map((art) => {
    const eigene = zeilen.filter((zeile) => zeile.overlay.art === art);
    const betraege: Record<string, number> = {};
    const eliminierung: Record<string, number> = {};
    for (const zeile of eigene) {
      for (const [jahr, wert] of Object.entries(zeile.betraege)) betraege[jahr] = (betraege[jahr] ?? 0) + wert;
      for (const [jahr, wert] of Object.entries(zeile.eliminierung)) eliminierung[jahr] = (eliminierung[jahr] ?? 0) + wert;
    }
    return { art, overlay: zeilen.find((zeile) => zeile.overlay.art === art)?.art as ArtOverlay, anzahl: eigene.length, betraege, eliminierung };
  }).filter((summe) => summe.anzahl > 0);
}

// ---------------------------------------------------------------------------------------------
// Landesunternehmen

export interface UnternehmenSicht {
  id: string;
  overlay: UnternehmenOverlay;
  jahre: Wirtschaftsplanjahr[];
  kapitel: Array<{ kapitel: string; nummer: string; href: string }>;
  /** Titel der Gegenbuchung, nur wenn ihre Summe je Haushaltsjahr der Zuführung laut Wirtschaftsplan entspricht. */
  gegenbuchung: TitelInfo[] | null;
  projekt: { titel: string; href: string } | null;
}

export function getUnternehmen(periode: string, haushaltsjahre: readonly string[]): UnternehmenSicht[] {
  const overlay = loadFondsOverlay(periode);
  const plaene = loadRuecklagen(periode).wirtschaftsplaene;
  const kapitel = kapitelSet(periode);
  const projekte = new Map(loadProjekte(periode).map((projekt) => [projekt.id, projekt]));
  const projektOverlays = loadProjektOverlays(periode);
  const reihenfolge: string[] = [];
  for (const plan of plaene) if (!reihenfolge.includes(plan.id)) reihenfolge.push(plan.id);

  return reihenfolge.map((id) => {
    const eintrag = overlay.unternehmen[id];
    if (!eintrag) throw new Error(`fonds.json: Unternehmen „${id}“ fehlt.`);
    const jahre = plaene.filter((plan) => plan.id === id).sort((left, right) => left.jahr - right.jahr);
    let gegenbuchung: TitelInfo[] | null = null;
    if (eintrag.gegenbuchung && eintrag.gegenbuchung.length > 0) {
      const titel = findeTitel(periode, eintrag.gegenbuchung, haushaltsjahre);
      const stimmt =
        titel.length === eintrag.gegenbuchung.length &&
        haushaltsjahre.every((jahr) => {
          const plan = jahre.find((entry) => String(entry.jahr) === jahr);
          return plan !== undefined && titel.reduce((sum, entry) => sum + (entry.betraege[jahr] ?? 0), 0) === plan.kernhaushalt;
        });
      gegenbuchung = stimmt ? titel : null;
    }
    const projekt = eintrag.projektId ? projekte.get(eintrag.projektId) : undefined;
    const projektOverlay = eintrag.projektId ? projektOverlays[eintrag.projektId] : undefined;
    return {
      id,
      overlay: eintrag,
      jahre,
      kapitel: eintrag.kapitel
        .filter((nummer) => kapitel.has(nummer))
        .map((nummer) => ({ kapitel: nummer, nummer: formatKapitelnummer(nummer), href: getBudgetChapterUrl(periode, nummer.slice(0, 2), nummer) })),
      gegenbuchung,
      projekt:
        projekt && projektOverlay && hasProjektseite(projekt, projektOverlay)
          ? { titel: projektOverlay.titel, href: getBudgetProjectUrl(periode, projektOverlay.slug) }
          : null,
    };
  });
}
