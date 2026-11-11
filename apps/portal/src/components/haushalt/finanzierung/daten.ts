/**
 * Aufbereitung der Finanzierungsdaten einer Snapshot-Periode für die Seite „Finanzierung und
 * Schulden“. Es wird nur gruppiert, summiert (Kontrollsummen) und gegen die Quellsummen geprüft;
 * kein Betrag wird neu berechnet. Kreditbewegungen, Anschlussfinanzierung, strukturelle
 * Nettokreditaufnahme und Schuldenstand bleiben getrennte Größen.
 */
import { getBudgetProjectUrl, getBudgetTitleUrl } from '@ostrecht/shared/lib/portal/routes.ts';

import { getProjektOverlay, hasProjektseite } from '../../../lib/haushalt/oeffentlich.ts';
import { loadFinanzierung, loadGesamtplan, loadProjekte, loadRuecklagen, loadTitelForKapitel } from '../../../lib/haushalt/snapshot.ts';
import type { Finanzierungsmassnahme, Kreditfinanzierungsjahr } from '../../../lib/haushalt/types.ts';
import { loadFinanzierungOverlay, type FinanzierungOverlay, type MassnahmeText } from './overlay.ts';

type JahrKey = `${number}`;

export function summe(werte: readonly number[]): number {
  return werte.reduce((total, wert) => total + wert, 0);
}

/**
 * Kreditfinanzierungsplan, aufsteigend nach Jahr. Für die Haushaltsjahre wird er gegen den
 * Gesamtplan geprüft (Kreditaufnahme, Tilgung, Nettotilgung, Zinsen, strukturelle
 * Nettokreditaufnahme); jede Abweichung bricht ab.
 */
export function getKreditplan(periode: string, haushaltsjahre: readonly string[]): Kreditfinanzierungsjahr[] {
  const plan = [...loadFinanzierung(periode).kreditfinanzierungsplan].sort((left, right) => left.jahr - right.jahr);
  const gesamtplan = loadGesamtplan(periode);
  for (const eintrag of plan) {
    if (eintrag.kreditaufnahme - eintrag.tilgung !== eintrag.nettokreditaufnahme) {
      throw new Error(`Kreditfinanzierungsplan ${eintrag.jahr}: Nettokreditaufnahme passt nicht zu Kreditaufnahme und Tilgung.`);
    }
    const jahr = String(eintrag.jahr);
    if (!haushaltsjahre.includes(jahr)) continue;
    const daten = gesamtplan.jahre[jahr as JahrKey];
    if (!daten) throw new Error(`Gesamtplan ${periode}: Jahr ${jahr} fehlt.`);
    const vergleiche: Array<[string, number | undefined, number]> = [
      ['Kreditaufnahme', daten.kredit_brutto, eintrag.kreditaufnahme],
      ['Tilgung', daten.tilgung, eintrag.tilgung],
      ['Zinsen', daten.zinsen, eintrag.zinsen],
      ['strukturelle Nettokreditaufnahme', daten.strukturelle_nka, eintrag.strukturelle_nka],
      ['Nettotilgung', daten.nettotilgung, -eintrag.nettokreditaufnahme],
    ];
    for (const [name, soll, ist] of vergleiche) {
      if (typeof soll === 'number' && soll !== ist) {
        throw new Error(`Kreditfinanzierungsplan ${jahr}: ${name} ${ist} weicht vom Gesamtplan (${soll}) ab.`);
      }
    }
  }
  return plan;
}

export interface FondsGruppe {
  art: string;
  label: string;
  /** Je Haushaltsjahr: Verwendung und Konsolidierungseliminierung. */
  jahre: Record<string, { betrag: number; eliminierung: number; anzahl: number }>;
}

/**
 * Fondsverwendungen mit Kernhaushaltsbezug, zusammengefasst nach Art und Haushaltsjahr. Die
 * Beträge werden nie zu den Einnahmen oder Ausgaben des Kernhaushalts addiert.
 */
export function getFondsverwendungen(periode: string, haushaltsjahre: readonly string[], overlay: FinanzierungOverlay): FondsGruppe[] {
  const gruppen = new Map<string, FondsGruppe>();
  const leer = () => Object.fromEntries(haushaltsjahre.map((jahr) => [jahr, { betrag: 0, eliminierung: 0, anzahl: 0 }]));
  for (const posten of loadRuecklagen(periode).fonds_gegenposten) {
    const jahr = String(posten.jahr);
    if (!haushaltsjahre.includes(jahr)) continue;
    const art = overlay.fondsarten[posten.art] ? posten.art : 'weitere';
    let gruppe = gruppen.get(art);
    if (!gruppe) {
      gruppe = { art, label: overlay.fondsarten[art] ?? 'Weitere Fonds und Rücklagen', jahre: leer() };
      gruppen.set(art, gruppe);
    }
    gruppe.jahre[jahr].betrag += posten.betrag;
    gruppe.jahre[jahr].eliminierung += posten.konsolidierungseliminierung;
    gruppe.jahre[jahr].anzahl += 1;
  }
  const reihenfolge = Object.keys(overlay.fondsarten);
  return [...gruppen.values()].sort((left, right) => {
    const a = reihenfolge.indexOf(left.art);
    const b = reihenfolge.indexOf(right.art);
    return (a < 0 ? 99 : a) - (b < 0 ? 99 : b);
  });
}

export interface MassnahmeAnsicht {
  id: string;
  text: MassnahmeText;
  daten: Finanzierungsmassnahme;
  jahre: string[];
  projektHref: string | null;
  projektTitel: string | null;
}

function projektVerweis(periode: string, projektId: string | undefined): { href: string; titel: string } | null {
  if (!projektId) return null;
  const projekt = loadProjekte(periode).find((eintrag) => eintrag.id === projektId);
  const overlay = getProjektOverlay(periode, projektId);
  if (!projekt || !overlay || !hasProjektseite(projekt, overlay)) return null;
  return { href: getBudgetProjectUrl(periode, overlay.slug), titel: overlay.titel };
}

/**
 * Finanzierungsmaßnahmen mit öffentlichem Text (fail-closed: ohne Overlay-Eintrag keine Karte).
 * Die Haushaltswirkung des Dienstrechtsentwurfs ist keine Finanzierungsmaßnahme und wird getrennt
 * geliefert.
 */
export function getMassnahmen(periode: string, overlay: FinanzierungOverlay): { massnahmen: MassnahmeAnsicht[]; dienstrecht: Finanzierungsmassnahme | null; ohneText: number } {
  const alle = loadFinanzierung(periode).massnahmen;
  const dienstrechtKennung = overlay.dienstrecht?.kennung;
  const massnahmen: MassnahmeAnsicht[] = [];
  let ohneText = 0;
  for (const daten of alle) {
    if (daten.id === dienstrechtKennung) continue;
    const text = overlay.massnahmen[daten.id];
    if (!text) {
      ohneText += 1;
      continue;
    }
    const verweis = projektVerweis(periode, text.projekt);
    massnahmen.push({
      id: daten.id,
      text,
      daten,
      jahre: Object.keys(daten.jahre).sort((left, right) => Number(left) - Number(right)),
      projektHref: verweis?.href ?? null,
      projektTitel: verweis?.titel ?? null,
    });
  }
  const dienstrecht = dienstrechtKennung ? alle.find((eintrag) => eintrag.id === dienstrechtKennung) ?? null : null;
  return { massnahmen, dienstrecht, ohneText };
}

export interface VerpflichtungAnsicht {
  titel: string;
  projektHref: string | null;
  kapitel: string;
  titelnummer: string;
  titelHref: string | null;
  herkunft: string;
  ve: Record<string, number>;
  faelligkeiten: Record<string, number>;
}

/**
 * Verpflichtungsermächtigungen mit öffentlichem Vorhabentitel aus dem Projekt-Overlay. Ohne
 * Overlay erscheint die Zeile unter einer neutralen Bezeichnung mit Kapitel und Titel; ein
 * Titellink entsteht nur, wenn der Titel im Kapitel vorhanden ist.
 */
export function getVerpflichtungen(periode: string): VerpflichtungAnsicht[] {
  return loadFinanzierung(periode).verpflichtungen.map((eintrag) => {
    const overlay = getProjektOverlay(periode, eintrag.projekt);
    const verweis = projektVerweis(periode, eintrag.projekt);
    const titelVorhanden = /^\d{4}$/u.test(eintrag.kapitel) && loadTitelForKapitel(periode, eintrag.kapitel).some((titel) => titel.titel === eintrag.titel);
    return {
      titel: overlay?.titel ?? 'Weiteres Vorhaben',
      projektHref: verweis?.href ?? null,
      kapitel: eintrag.kapitel,
      titelnummer: eintrag.titel,
      titelHref: titelVorhanden ? getBudgetTitleUrl(periode, eintrag.kapitel.slice(0, 2), eintrag.kapitel, eintrag.titel) : null,
      herkunft: eintrag.herkunft,
      ve: eintrag.ve as Record<string, number>,
      faelligkeiten: eintrag.faelligkeiten as Record<string, number>,
    };
  });
}

export { loadFinanzierungOverlay };
