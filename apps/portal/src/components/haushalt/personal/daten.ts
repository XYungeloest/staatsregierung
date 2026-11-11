/**
 * Aufbereitung der Personaldaten einer Snapshot-Periode für die Seite „Personal und Versorgung“.
 *
 * Hier wird nur gruppiert, summiert (Kontrollsummen), verglichen und beschriftet; kein Betrag
 * wird neu berechnet. Jede Summe, die einer Quellsumme entsprechen muss, wird gegen sie geprüft
 * und bricht bei einer Abweichung ab. Kennungen ohne redaktionelle Bezeichnung
 * (`personal.json`-Overlay) erscheinen nicht einzeln.
 */
import { getKennzahlen, getPersonalKategorien, type KategorieWert } from '../../../lib/haushalt/kennzahlen.ts';
import { getEinzelplanOverlay, loadFreitextOverlay, publicBezeichnung } from '../../../lib/haushalt/oeffentlich.ts';
import { loadEinzelplaene, loadGesamtplan, loadPersonal } from '../../../lib/haushalt/snapshot.ts';
import type { PersonalDatei, Reformwirkungsjahr } from '../../../lib/haushalt/types.ts';
import { loadPersonalOverlay, type PersonalOverlay } from './overlay.ts';

type JahrKey = `${number}`;

/** Rechtsstände in der Reihenfolge der Darstellung; A/A2 (Vergleichsstände) bleiben unbeschriftet. */
export const RECHTSSTAND_REIHENFOLGE = ['R0', 'B', 'C'] as const;

export function summe(werte: readonly number[]): number {
  return werte.reduce((total, wert) => total + wert, 0);
}

// ---------------------------------------------------------------------------------------------
// Personalausgaben

export interface PersonalausgabenJahr {
  jahr: string;
  betrag: number;
  ausgaben: number;
  anteil: number | null;
}

export function getPersonalausgaben(periode: string, jahre: readonly string[]): PersonalausgabenJahr[] {
  const gesamtplan = loadGesamtplan(periode);
  return jahre.map((jahr) => {
    const block = getKennzahlen(gesamtplan, jahr);
    return {
      jahr,
      betrag: block.personal.betrag,
      ausgaben: block.ausgaben.betrag,
      anteil: block.ausgaben.betrag === 0 ? null : block.personal.betrag / block.ausgaben.betrag,
    };
  });
}

export interface PersonalKategorieZeile {
  id: string;
  label: string;
  definition: string;
  umfang: string;
  werte: Record<string, number>;
}

/** Personalausgaben nach Arten (lückenlose Kategorien aus kennzahlen.ts) für alle Jahre. */
export function getPersonalArten(periode: string, jahre: readonly string[]): PersonalKategorieZeile[] {
  const gesamtplan = loadGesamtplan(periode);
  const je = jahre.map((jahr) => getPersonalKategorien(gesamtplan, jahr, { mitLeeren: true }));
  const erste: KategorieWert[] = je[0] ?? [];
  return erste
    .map((kategorie) => ({
      id: kategorie.id,
      label: kategorie.label,
      definition: kategorie.definition,
      umfang: je.map((liste) => liste.find((wert) => wert.id === kategorie.id)?.umfang ?? '').find((text) => text !== '') ?? kategorie.umfang,
      werte: Object.fromEntries(jahre.map((jahr, index) => [jahr, je[index].find((wert) => wert.id === kategorie.id)?.betrag ?? 0])),
    }))
    .filter((zeile) => Object.values(zeile.werte).some((wert) => wert !== 0));
}

export interface EinzelplanPersonal {
  ep: string;
  name: string;
  werte: Record<string, number>;
  ausgaben: Record<string, number>;
}

/** HG 4 je Einzelplan; die Summe muss je Jahr der Hauptgruppe 4 des Gesamtplans entsprechen. */
export function getPersonalNachEinzelplan(periode: string, jahre: readonly string[]): EinzelplanPersonal[] {
  const gesamtplan = loadGesamtplan(periode);
  const freitexte = loadFreitextOverlay(periode);
  const plaene = loadEinzelplaene(periode).map((plan) => ({
    ep: plan.ep,
    name: getEinzelplanOverlay(periode, plan.ep)?.kurztitel ?? publicBezeichnung(plan.bezeichnung, freitexte),
    werte: Object.fromEntries(jahre.map((jahr) => [jahr, plan.jahre[jahr as JahrKey]?.hauptgruppen['4'] ?? 0])),
    ausgaben: Object.fromEntries(jahre.map((jahr) => [jahr, plan.jahre[jahr as JahrKey]?.ausgaben ?? 0])),
  }));
  for (const jahr of jahre) {
    const soll = gesamtplan.jahre[jahr as JahrKey]?.hauptgruppen['4'];
    const ist = summe(plaene.map((plan) => plan.werte[jahr]));
    if (soll !== ist) throw new Error(`Personalausgaben ${jahr}: Summe der Einzelpläne ${ist} weicht von Hauptgruppe 4 (${soll}) ab.`);
  }
  return plaene;
}

// ---------------------------------------------------------------------------------------------
// Planäquivalente

export interface StrukturZeile {
  bereich: string;
  label: string;
  /** Je Jahr: Beamt:innen (einschließlich Anwärter:innen), Anwärter:innen, Arbeitnehmer:innen, Auszubildende, insgesamt. */
  jahre: Record<string, { beamte: number; anwaerter: number; arbeitnehmer: number; auszubildende: number; summe: number }>;
}

/** Planäquivalente je Personalbereich; nur Bereiche mit Bezeichnung, Rest als eigene Zeile. */
export function getPlanaequivalente(personal: PersonalDatei, overlay: PersonalOverlay, jahre: readonly string[]): StrukturZeile[] {
  const zeilen = new Map<string, StrukturZeile>();
  for (const kapitel of personal.stellen.kapitel) {
    const bereich = overlay.bereiche[kapitel.bereich] ? kapitel.bereich : 'uebrige';
    let zeile = zeilen.get(bereich);
    if (!zeile) {
      zeile = {
        bereich,
        label: overlay.bereiche[bereich] ?? 'Übrige Bereiche',
        jahre: Object.fromEntries(jahre.map((jahr) => [jahr, { beamte: 0, anwaerter: 0, arbeitnehmer: 0, auszubildende: 0, summe: 0 }])),
      };
      zeilen.set(bereich, zeile);
    }
    for (const jahr of jahre) {
      const daten = kapitel.jahre[jahr as JahrKey];
      if (!daten) continue;
      const ziel = zeile.jahre[jahr];
      ziel.beamte += daten.beamte;
      ziel.anwaerter += daten.anwaerter;
      ziel.arbeitnehmer += daten.arbeitnehmer;
      ziel.auszubildende += daten.auszubildende;
      ziel.summe += daten.summe;
    }
  }
  for (const zeile of zeilen.values()) {
    for (const jahr of jahre) {
      const werte = zeile.jahre[jahr];
      if (werte.beamte + werte.arbeitnehmer + werte.auszubildende !== werte.summe) {
        throw new Error(`Planäquivalente ${zeile.bereich} ${jahr}: Teilsummen ergeben nicht die Gesamtzahl.`);
      }
    }
  }
  const reihenfolge = Object.keys(overlay.bereiche);
  return [...zeilen.values()].sort((left, right) => {
    const a = reihenfolge.indexOf(left.bereich);
    const b = reihenfolge.indexOf(right.bereich);
    return (a < 0 ? 99 : a) - (b < 0 ? 99 : b);
  });
}

export interface PersonalstrukturJahr {
  jahr: string;
  bestandsbeamte: number;
  ruhestandszugaenge: number;
  wiederbesetzungBisher: number;
  einstellungenO: number;
  einstellungenR: number;
  arbeitsverhaeltnis: number;
  arbeitsverhaeltnisKumuliert: number;
}

/** Bestand und Wiederbesetzung je Jahr, über alle Bereiche zusammengefasst (Schätzung). */
export function getPersonalstrukturJahre(personal: PersonalDatei): PersonalstrukturJahr[] {
  const map = new Map<string, PersonalstrukturJahr>();
  for (const zeile of personal.personalstruktur) {
    const jahr = String(zeile.jahr);
    let eintrag = map.get(jahr);
    if (!eintrag) {
      eintrag = { jahr, bestandsbeamte: 0, ruhestandszugaenge: 0, wiederbesetzungBisher: 0, einstellungenO: 0, einstellungenR: 0, arbeitsverhaeltnis: 0, arbeitsverhaeltnisKumuliert: 0 };
      map.set(jahr, eintrag);
    }
    eintrag.bestandsbeamte += zeile.bestandsbeamte_im_dienst ?? 0;
    eintrag.ruhestandszugaenge += zeile.ruhestandszugaenge ?? 0;
    eintrag.wiederbesetzungBisher += zeile.einstellungen_beamte_bisher ?? 0;
    eintrag.einstellungenO += zeile.einstellungen_o_reform ?? 0;
    eintrag.einstellungenR += zeile.einstellungen_r_unveraendert ?? 0;
    eintrag.arbeitsverhaeltnis += zeile.einstellungen_tarif_statt_beamte ?? 0;
    eintrag.arbeitsverhaeltnisKumuliert += zeile.tarifstellen_statt_beamte_kumuliert ?? 0;
  }
  return [...map.values()].sort((left, right) => Number(left.jahr) - Number(right.jahr));
}

// ---------------------------------------------------------------------------------------------
// Rechtsstände, Komponenten, Wirkung

export interface RegimeBlock {
  block: string;
  label: string;
  jahre: string[];
  /** Je Rechtsstand (R0, B, C) die Werte je Jahr. */
  werte: Record<string, Record<string, number>>;
}

/** Vergleichsreihen je Block für die beschrifteten Rechtsstände R0, B und C. */
export function getRegimeBloecke(personal: PersonalDatei, overlay: PersonalOverlay): RegimeBlock[] {
  const bloecke: RegimeBlock[] = [];
  for (const [block, label] of Object.entries(overlay.bloecke)) {
    const reihen = personal.regimevergleich.filter((reihe) => reihe.block === block);
    const werte: Record<string, Record<string, number>> = {};
    for (const code of RECHTSSTAND_REIHENFOLGE) {
      if (!overlay.rechtsstaende[code]) continue;
      const reihe = reihen.find((eintrag) => eintrag.rechtsstand === code);
      if (reihe) werte[code] = reihe.jahre as Record<string, number>;
    }
    if (!werte.B || !werte.C) continue;
    const jahre = Object.keys(werte.C).sort((left, right) => Number(left) - Number(right));
    bloecke.push({ block, label, jahre, werte });
  }
  return bloecke;
}

export interface KomponentenGruppe {
  id: string;
  label: string;
  zeilen: Array<{ id: string; label: string; werte: Record<string, number> }>;
}

/**
 * Änderung gegenüber dem bisherigen Planniveau (C − B) je Ausgabekomponente und Jahr. Die
 * Rücknahme der bisherigen pauschalen Versorgungsvorbuchung ist keine Wirkung des Entwurfs
 * gegenüber dem Planniveau und gehört nicht hierher; Einnahmekomponenten (Lohnsteuer,
 * Versorgungsfonds) erscheinen in der veranschlagten Wirkung. Komponenten ohne Bezeichnung
 * stehen gesammelt in „Weitere Bestandteile“, damit die Summe vollständig bleibt.
 */
export function getKomponenten(personal: PersonalDatei, overlay: PersonalOverlay, jahre: readonly string[]): KomponentenGruppe[] {
  const ausgaben = personal.reformwirkung.komponenten.filter((komponente) => komponente.seite === 'Ausgabe' && komponente.komponente !== 'versorgung_vorbuchung');
  const gruppen = new Map<string, KomponentenGruppe>();
  for (const [id, label] of Object.entries(overlay.komponentengruppen)) gruppen.set(id, { id, label, zeilen: [] });
  const weitere: KomponentenGruppe = { id: 'weitere', label: 'Weitere Bestandteile', zeilen: [] };
  for (const komponente of ausgaben) {
    const text = overlay.komponenten[komponente.komponente];
    const gruppe = (text && gruppen.get(text.gruppe)) || weitere;
    const zeilenId = text ? komponente.komponente : 'weitere';
    let zeile = gruppe.zeilen.find((eintrag) => eintrag.id === zeilenId);
    if (!zeile) {
      zeile = { id: zeilenId, label: text?.bezeichnung ?? 'Weitere Bestandteile', werte: Object.fromEntries(jahre.map((jahr) => [jahr, 0])) };
      gruppe.zeilen.push(zeile);
    }
    const jahr = String(komponente.jahr);
    if (jahr in zeile.werte) zeile.werte[jahr] += komponente.betrag;
  }
  return [...gruppen.values(), weitere].filter((gruppe) => gruppe.zeilen.length > 0);
}

export const WIRKUNG_AUSGABEN: ReadonlyArray<keyof Reformwirkungsjahr> = ['besoldung', 'versorgung', 'beihilfe', 'tarif', 'verwaltung'];
export const WIRKUNG_EINNAHMEN: ReadonlyArray<keyof Reformwirkungsjahr> = ['steuer', 'fonds'];

/** Veranschlagte Wirkung je Jahr; prüft Ausgaben- und Einnahmensummen sowie den Saldo. */
export function getWirkungJahre(personal: PersonalDatei): Reformwirkungsjahr[] {
  const jahre = [...personal.reformwirkung.jahre].sort((left, right) => left.jahr - right.jahr);
  for (const jahr of jahre) {
    if (summe(WIRKUNG_AUSGABEN.map((feld) => jahr[feld] as number)) !== jahr.ausgaben) throw new Error(`Reformwirkung ${jahr.jahr}: Ausgabensumme weicht ab.`);
    if (summe(WIRKUNG_EINNAHMEN.map((feld) => jahr[feld] as number)) !== jahr.einnahmen) throw new Error(`Reformwirkung ${jahr.jahr}: Einnahmensumme weicht ab.`);
    if (jahr.ausgaben - jahr.einnahmen !== jahr.netto) throw new Error(`Reformwirkung ${jahr.jahr}: Nettowirkung weicht ab.`);
  }
  return jahre;
}

// ---------------------------------------------------------------------------------------------
// Besoldungstabellen

/** Dezimaltext „2420.66“ → Cent als ganze Zahl (exakt, ohne Gleitkommarundung). */
export function centAusDezimaltext(text: string): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/u.exec(text.trim());
  if (!match) throw new Error(`Besoldungsbetrag „${text}“ ist kein Dezimaltext.`);
  const cent = Number(match[2]) * 100 + Number((match[3] ?? '0').padEnd(2, '0'));
  return match[1] === '-' ? -cent : cent;
}

const centFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Monatsbetrag aus Cent: „2.420,66 €“ (geschütztes Leerzeichen, typografisches Minus). */
export function formatCent(cent: number, vorzeichen = false): string {
  const text = `${centFormat.format(Math.abs(cent) / 100)} €`;
  if (cent < 0) return `−${text}`;
  if (vorzeichen) return cent === 0 ? `±${text}` : `+${text}`;
  return text;
}

export interface BesoldungsZeile {
  gruppe: string;
  stufe: string;
  geltend: number | null;
  entwurf: number | null;
}

function stufen(eintrag: unknown): Array<[string, string]> {
  if (typeof eintrag === 'string') return [['', eintrag]];
  if (eintrag && typeof eintrag === 'object') {
    return Object.entries(eintrag as Record<string, string>).sort((left, right) => Number(left[0]) - Number(right[0]));
  }
  return [];
}

/**
 * Ausgewählte Besoldungsgruppen: jeweils erste und letzte Stufe, die in beiden Tabellen vorkommt;
 * feste Grundgehälter ohne Stufen als eine Zeile.
 */
export function getBesoldungsvergleich(personal: PersonalDatei, overlay: PersonalOverlay): BesoldungsZeile[] {
  const { geltend, entwurf, gruppen } = overlay.besoldungstabellen;
  const alt = personal.besoldungstabellen[geltend.schluessel]?.tabellen;
  const neu = personal.besoldungstabellen[entwurf.schluessel]?.tabellen;
  if (!alt || !neu) return [];
  const zeilen: BesoldungsZeile[] = [];
  for (const { ordnung, gruppe } of gruppen) {
    const altStufen = stufen((alt[ordnung] as Record<string, unknown> | undefined)?.[gruppe]);
    const neuStufen = stufen((neu[ordnung] as Record<string, unknown> | undefined)?.[gruppe]);
    if (altStufen.length === 0 || neuStufen.length === 0) continue;
    const gemeinsam = altStufen.map(([stufe]) => stufe).filter((stufe) => neuStufen.some(([andere]) => andere === stufe));
    const auswahl = gemeinsam.length > 1 ? [gemeinsam[0], gemeinsam[gemeinsam.length - 1]] : gemeinsam;
    for (const stufe of auswahl) {
      const a = altStufen.find(([key]) => key === stufe)?.[1];
      const b = neuStufen.find(([key]) => key === stufe)?.[1];
      zeilen.push({ gruppe, stufe, geltend: a ? centAusDezimaltext(a) : null, entwurf: b ? centAusDezimaltext(b) : null });
    }
  }
  return zeilen;
}

export interface ZuschlagZeile {
  bezeichnung: string;
  geltend: number;
  entwurf: number;
}

export function getZuschlagsvergleich(personal: PersonalDatei, overlay: PersonalOverlay): ZuschlagZeile[] {
  const { geltend, entwurf, zuschlaege } = overlay.besoldungstabellen;
  const alt = personal.besoldungstabellen[geltend.schluessel]?.tabellen;
  const neu = personal.besoldungstabellen[entwurf.schluessel]?.tabellen;
  if (!alt || !neu) return [];
  return zuschlaege.flatMap((eintrag) => {
    const a = (alt[eintrag.tabelle] as Record<string, unknown> | undefined)?.[eintrag.schluessel];
    const b = (neu[eintrag.tabelle] as Record<string, unknown> | undefined)?.[eintrag.schluessel];
    if (typeof a !== 'string' || typeof b !== 'string') return [];
    return [{ bezeichnung: eintrag.bezeichnung, geltend: centAusDezimaltext(a), entwurf: centAusDezimaltext(b) }];
  });
}

/** Feste Grundgehälter der neuen Besoldungsordnung O (nur im Entwurf). */
export function getBesoldungsordnungO(personal: PersonalDatei, overlay: PersonalOverlay): Array<{ gruppe: string; betrag: number }> {
  const neu = personal.besoldungstabellen[overlay.besoldungstabellen.entwurf.schluessel]?.tabellen;
  const ordnung = neu?.O as Record<string, unknown> | undefined;
  if (!ordnung) return [];
  return Object.entries(ordnung)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .sort((left, right) => Number(left[0].replace(/\D/gu, '')) - Number(right[0].replace(/\D/gu, '')))
    .map(([gruppe, betrag]) => ({ gruppe, betrag: centAusDezimaltext(betrag) }));
}

export { loadPersonal, loadPersonalOverlay };
