import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getRedaktionellerStichtag } from './perioden.ts';
import { resolveHaushaltRepositoryRoot } from './snapshot.ts';
import type { Projekt, Titel, TitelJahr } from './types.ts';

/**
 * Öffentliche Darstellung der Haushaltsfreitexte – fail-closed.
 *
 * Der Snapshot übernimmt Freitexte der Haushaltsaufstellung unverändert. Viele davon sind
 * Arbeitsvermerke (Modellierungs-, Nachweis- und Simulationsvermerke, interne Kennungen) oder
 * verwenden Paarformen. Auf öffentlichen Seiten, im Suchindex und in Downloads erscheint deshalb
 * nur, was hier ausdrücklich freigegeben ist:
 *
 * - Rechtsgrundlage, Finanzierung, Erläuterung und Haushaltsvermerk eines Titels: nur über die
 *   redaktionelle Klassifikation in content/haushalt/<periode>/freitexte.json (Schlüssel =
 *   exakter Quelltext → `anzeige` als öffentliche Fassung oder `null`). Ein nicht klassifizierter
 *   Text wird nie angezeigt; `npm run haushalt:check` lässt einen Snapshot mit unklassifizierten
 *   Texten nicht durch.
 * - Bezeichnungen (Zweckbestimmungen, Gruppen-, Funktions-, Kapitel- und Einzelplanbezeichnungen,
 *   Mengeneinheiten): grundsätzlich unverändert; Bezeichnungen mit Metabegriff oder Paarform
 *   brauchen eine öffentliche Fassung im Abschnitt `bezeichnungen`, sonst bricht
 *   `publicBezeichnung` (und `npm run haushalt:check`) ab.
 *
 * Projekt- und Einzelplanbeschreibungen kommen ausschließlich aus den redaktionellen Overlays
 * (content/haushalt/<periode>/projekte.json und einzelplaene.json).
 */

export interface Metabegriff {
  id: string;
  muster: RegExp;
  /** Warum der Begriff einen Text als Arbeitsvermerk kennzeichnet. */
  begruendung: string;
}

/**
 * Begriffe, die einen Text als internen Arbeitsvermerk der Haushaltsaufstellung kennzeichnen.
 * Abgeleitet aus den tatsächlichen Erläuterungen, Vermerken, Rechtsgrundlagen und
 * Projektbeschreibungen des Snapshots 2027/2028.
 */
export const METABEGRIFFE: readonly Metabegriff[] = [
  { id: 'simulation', muster: /simul/iu, begruendung: 'Verweis auf die Simulation („Simulationsbund“, „Simulations-GG“, „simuliert“).' },
  {
    id: 'modell',
    muster: /modell(?!vorhaben|projekt|region)/iu,
    begruendung: 'Modellannahmen der Haushaltsaufstellung („Modellannahme“, „Versorgungsmodell“, „Modell: …“); Modellvorhaben und -projekte bleiben zulässig.',
  },
  { id: 'prognosestand', muster: /\bW2\b/u, begruendung: 'Interne Kennung eines Prognosestands („Prognose W2“, „Steuerschätzung W2“).' },
  { id: 'referenz', muster: /referenz/iu, begruendung: 'Hinweis auf Referenzdaten außerhalb des Freistaates („Referenzvektor“, „als Referenz“).' },
  {
    id: 'nachweis',
    muster: /nicht (?:nachgewiesen|belegt)|Nachweis weiterhin offen|offen bezeichnet|Auslieferungsnachweis/iu,
    begruendung: 'Interner Prüf- und Nachweisstand der Aufstellung.',
  },
  { id: 'originaldaten', muster: /Original(?:titel|daten)/iu, begruendung: 'Herkunft aus Originaltiteln der Ausgangshaushalte (Datenherleitung).' },
  { id: 'arbeitsvermerk', muster: /Arbeitsvermerk|Platzhalter/iu, begruendung: 'Ausdrücklicher Arbeitsvermerk.' },
  { id: 'real', muster: /\bReal(?:e[snr]?)?\b/u, begruendung: 'Bezug auf reale Vorbilder („Reales FAG“).' },
  { id: 'datenstand', muster: /Datenpaket|Solver|\bRun\b|Basisrun|Quell(?:en)?matrix|Quellgewicht|Mapping/iu, begruendung: 'Begriffe der Datenaufbereitung.' },
  { id: 'rechenstand', muster: /\bc0\b|c0-|\bC0\b/u, begruendung: 'Interne Kennung des Finanzrahmens („c0-v2“).' },
  { id: 'korrekturvorlage', muster: /\bK-0\d/u, begruendung: 'Interne Korrekturvorlagen („K-01“, „K-02a“).' },
  {
    id: 'kennung',
    muster: /\b[FQDV]-?\d{2}\b/u,
    begruendung: 'Interne Kennungen von Maßnahmen und Entscheidungen („F09“, „Q37“, „D-57“, „V01“); öffentliche Titel kommen aus den Overlays.',
  },
  { id: 'basis', muster: /Basis(?:haushalt|bereinigung|run)/iu, begruendung: 'Interne Rechenschritte („Basishaushalt“, „Basisbereinigung“).' },
  { id: 'vorbild', muster: /Vorbild|sächsisch/iu, begruendung: 'Herleitung aus Vorbildhaushalten einzelner Ausgangsländer.' },
  { id: 'fiktion', muster: /Einnahmefiktion|fingier/iu, begruendung: 'Interne Plausibilitätsvermerke.' },
  {
    id: 'unternehmensname',
    muster: /\btegut\b/iu,
    begruendung: 'Name eines realen Handelsunternehmens aus einer nicht veranschlagten Übernahmeüberlegung; öffentlich „Übernahme bestehender Filialen“.',
  },
  { id: 'projektregister', muster: /Projektregister|Projekt-\/Spezialrecht/iu, begruendung: 'Verweis auf das interne Projektregister.' },
  {
    id: 'rechenvermerk',
    muster: /\bgerechnet\b|Planungsannahme|Planungsäquivalent|Vollaufbau|Sammelansatz gekennzeichnet/iu,
    begruendung:
      'Interne Rechen- und Plausibilitätsvermerke („wird nicht zusätzlich gerechnet“, „Planungsannahme“, „Planungsäquivalent“, „Kein zweiter Vollaufbau“, „als Sammelansatz gekennzeichnet“); „angerechnet“ bleibt zulässig.',
  },
];

/** Kennungen der Metabegriffe, die in `text` vorkommen (leer = unauffällig). */
export function findeMetabegriffe(text: string): string[] {
  return METABEGRIFFE.filter((begriff) => begriff.muster.test(text)).map((begriff) => begriff.id);
}

export function enthaeltMetabegriff(text: string): boolean {
  return findeMetabegriffe(text).length > 0;
}

/**
 * Vorgeschriebene öffentliche Formeln, die ein Muster der METABEGRIFFE treffen, aber ausdrücklich
 * so lauten sollen: die Herkunftsbezeichnung „Planungsannahme“ (Herkunft S, ORIGIN_LABELS) und
 * die Kennzeichnung „modellierte Planäquivalente“ der Personalangaben. Sie gelten nur für
 * redaktionelle Texte (Overlays, Seitentexte), nie für Quelltexte des Snapshots: Bezeichnungen
 * und Freitexte der Quelle prüft weiterhin `findeMetabegriffe` ohne Ausnahme.
 */
export const OEFFENTLICHE_FORMELN: readonly RegExp[] = [/\bPlanungsannahmen?\b/gu, /\bmodellierten? Planäquivalenten?\b/gu];

/** Metabegriffe eines redaktionellen öffentlichen Textes, ohne die vorgeschriebenen Formeln. */
export function findeMetabegriffeOeffentlich(text: string): string[] {
  const bereinigt = OEFFENTLICHE_FORMELN.reduce((rest, formel) => rest.replace(formel, ' '), text);
  return findeMetabegriffe(bereinigt);
}

/**
 * Nicht zulässige Schreibweisen von Personenbezeichnungen (AGENTS.md: einheitlich mit
 * Doppelpunkt, z. B. „Schüler:innen“): Paarformen („Schülerinnen und Schüler“, „Erzieherinnen
 * und -erzieher“, „Beamtinnen, Beamte“), Schrägstrich, Binnen-I, Stern und Unterstrich.
 */
const PAARFORM_MUSTER: readonly RegExp[] = [
  /(\p{L}{3,})innen\s*(?:,|und|oder|bzw\.)\s*(?:-\p{L}+|\1(?:e|en|er|n)?\b)/u,
  /(\p{L}{3,})\s+(?:und|oder)\s+\1innen\b/u,
  /\p{L}\/-?innen/u,
  /\p{Ll}Innen\b/u,
  /[*_]innen\b/u,
];

/** Enthält `text` eine Paarform oder eine andere nicht zulässige Genderschreibweise? */
export function enthaeltPaarform(text: string): boolean {
  return PAARFORM_MUSTER.some((muster) => muster.test(text));
}

// ---------------------------------------------------------------------------------------------
// Overlays

export const RECHTSBEZUG_ARTEN = ['geltend', 'verkuendet', 'entwurf', 'haushaltsregelung', 'verwaltungsabkommen'] as const;
export type RechtsbezugArt = (typeof RECHTSBEZUG_ARTEN)[number];

/** Öffentliche Bezeichnungen der Arten eines Rechtsbezugs. */
export const RECHTSBEZUG_ART_LABELS: Record<RechtsbezugArt, string> = {
  geltend: 'Geltendes Recht',
  verkuendet: 'Verkündet, noch nicht in Kraft',
  entwurf: 'Entwurf',
  haushaltsregelung: 'Haushaltsrechtliche Regelung',
  verwaltungsabkommen: 'Verwaltungsabkommen',
};

export interface FreitextKlassifikation {
  /** Öffentliche Formulierung oder null (nicht anzeigen). */
  anzeige: string | null;
  /** Nur Rechtsgrundlagen: existierende content/normen/<slug>/; verlinkt über getNormUrl(). */
  normSlug?: string;
  /**
   * Nur Rechtsgrundlagen. Bei „geltend“/„verkuendet“ mit normSlug entscheidet der Normstatus zum
   * redaktionellen Stichtag (content/normen/<slug>/meta.json) über die angezeigte Art.
   */
  art?: RechtsbezugArt;
  /**
   * Nur Rechtsgrundlagen: weitere Bezüge desselben Quelltextes, wenn er mehrere Vorschriften mit
   * verschiedenem Stand nennt (z. B. eine geltende und eine erst verkündete Norm). Jeder Bezug
   * trägt seine eigene Art und gegebenenfalls seinen eigenen Normverweis.
   */
  weitere?: Array<{ anzeige: string; normSlug?: string; art: RechtsbezugArt }>;
}

export interface FreitextOverlay {
  rechtsgrundlage: Record<string, FreitextKlassifikation>;
  finanzierung: Record<string, FreitextKlassifikation>;
  /** Jede Erläuterung des Snapshots: Quelltext → öffentliche Fassung oder null. */
  erlaeuterung: Record<string, FreitextKlassifikation>;
  /** Jeder Haushaltsvermerk des Snapshots: Quelltext → öffentliche Fassung oder null. */
  vermerk: Record<string, FreitextKlassifikation>;
  /** Bezeichnungen mit Metabegriff oder Paarform: Quelltext → öffentliche Fassung. */
  bezeichnungen: Record<string, string>;
}

export const EINZELPLAN_KATEGORIEN = ['Ressort', 'Verfassungsorgan', 'Unabhängige Stelle', 'Zentrale Verwaltung', 'Querschnitt'] as const;
export type EinzelplanKategorie = (typeof EINZELPLAN_KATEGORIEN)[number];

export interface EinzelplanOverlay {
  kurztitel: string;
  kategorie: EinzelplanKategorie;
  beschreibung: string;
  ministrySlugs: string[];
  topicSlugs: string[];
}

export const PROJEKT_STATUS = ['beschlossen', 'geplant', 'im-entwurf', 'in-umsetzung', 'optional', 'nicht-finanziert'] as const;
export type ProjektStatus = (typeof PROJEKT_STATUS)[number];

/** Öffentliche Bezeichnungen der Projektstatus. */
export const PROJEKT_STATUS_LABELS: Record<ProjektStatus, string> = {
  // „Vorhaben beschlossen“: der Status betrifft das Vorhaben, nicht die Mittel (diese stehen im Haushaltsentwurf).
  beschlossen: 'Vorhaben beschlossen',
  geplant: 'Geplant',
  'im-entwurf': 'Im Entwurf',
  'in-umsetzung': 'In Umsetzung',
  optional: 'Option',
  'nicht-finanziert': 'Nicht finanziert',
};

export interface ProjektRechtsbezug {
  normSlug?: string;
  label: string;
  art: RechtsbezugArt;
}

export interface ProjektOverlay {
  /** Deutscher URL-Slug (/haushalt/<periode>/projekte/<slug>/), je Periode eindeutig. */
  slug: string;
  titel: string;
  fachbereich: string;
  status: ProjektStatus;
  statusText: string;
  topicSlugs: string[];
  ministrySlug?: string;
  beschreibung: string;
  rechtsbezuege: ProjektRechtsbezug[];
  /**
   * true: Die Titel des Projekts sind nicht ausschließlich diesem Vorhaben gewidmet. Seiten zeigen
   * dann keine Projektsumme und keine Projektbeträge in Übersichten, sondern nur die Titel mit
   * ihren Ansätzen und `betragshinweis`.
   */
  ohneSumme?: boolean;
  /** Pflichthinweis neben Beträgen des Projekts (Pflicht bei `ohneSumme`). */
  betragshinweis?: string;
}

const overlayCache = new Map<string, unknown>();

function overlayPfad(periode: string, datei: string): string {
  if (!/^\d{4}-\d{4}$/u.test(periode)) throw new Error(`Ungültige Haushaltsperiode „${periode}“.`);
  return join(resolveHaushaltRepositoryRoot(), 'content', 'haushalt', periode, datei);
}

function ladeOverlay<T>(periode: string, datei: string, leer: () => T): T {
  const key = `${periode}/${datei}`;
  if (overlayCache.has(key)) return overlayCache.get(key) as T;
  const pfad = overlayPfad(periode, datei);
  let wert: T;
  if (!existsSync(pfad)) {
    wert = leer();
  } else {
    try {
      wert = JSON.parse(readFileSync(pfad, 'utf8')) as T;
    } catch (error) {
      throw new Error(`content/haushalt/${periode}/${datei} enthält ungültiges JSON: ${(error as Error).message}`);
    }
  }
  overlayCache.set(key, wert);
  return wert;
}

/** Leert den Overlay-Zwischenspeicher (für Tests). */
export function clearOverlayCache(): void {
  overlayCache.clear();
  normStatusCache.clear();
  kuenftigeFassungCache.clear();
}

/** Normalisiert ein (ggf. unvollständiges) Freitext-Overlay; fehlende Teile sind leer (= nichts freigegeben). */
export function normalizeFreitextOverlay(value: Partial<FreitextOverlay> | null | undefined): FreitextOverlay {
  return {
    rechtsgrundlage: value?.rechtsgrundlage ?? {},
    finanzierung: value?.finanzierung ?? {},
    erlaeuterung: value?.erlaeuterung ?? {},
    vermerk: value?.vermerk ?? {},
    bezeichnungen: value?.bezeichnungen ?? {},
  };
}

/** content/haushalt/<periode>/freitexte.json; fehlt die Datei, ist nichts freigegeben. */
export function loadFreitextOverlay(periode: string): FreitextOverlay {
  return normalizeFreitextOverlay(ladeOverlay<Partial<FreitextOverlay>>(periode, 'freitexte.json', () => ({})));
}

/** content/haushalt/<periode>/einzelplaene.json, nach Einzelplannummer. */
export function loadEinzelplanOverlays(periode: string): Record<string, EinzelplanOverlay> {
  return ladeOverlay<{ einzelplaene?: Record<string, EinzelplanOverlay> }>(periode, 'einzelplaene.json', () => ({})).einzelplaene ?? {};
}

export function getEinzelplanOverlay(periode: string, ep: string): EinzelplanOverlay | undefined {
  return loadEinzelplanOverlays(periode)[ep];
}

/** content/haushalt/<periode>/projekte.json, nach Projektkennung des Snapshots. */
export function loadProjektOverlays(periode: string): Record<string, ProjektOverlay> {
  return ladeOverlay<{ projekte?: Record<string, ProjektOverlay> }>(periode, 'projekte.json', () => ({})).projekte ?? {};
}

export function getProjektOverlay(periode: string, projektId: string): ProjektOverlay | undefined {
  return loadProjektOverlays(periode)[projektId];
}

/** Projektkennung zu einem öffentlichen Slug. */
export function findProjektIdBySlug(periode: string, slug: string): string | undefined {
  return Object.entries(loadProjektOverlays(periode)).find(([, overlay]) => overlay.slug === slug)?.[0];
}

/**
 * Eigene Projektseite: Projekte mit Titelbezug oder mit einem anderen Status als
 * „nicht-finanziert“. Ein nicht finanziertes Projekt ohne Titel erscheint nur in der
 * Projektübersicht (ohne Betrag), damit es nie wie ein finanziertes Vorhaben wirkt.
 * Ohne Overlay gibt es keine Seite.
 */
export function hasProjektseite(projekt: Pick<Projekt, 'titel'>, overlay: ProjektOverlay | undefined): boolean {
  if (!overlay) return false;
  return projekt.titel.length > 0 || overlay.status !== 'nicht-finanziert';
}

// ---------------------------------------------------------------------------------------------
// Öffentliche Texte

export interface OeffentlicheRechtsgrundlage {
  text: string;
  normSlug?: string;
  art?: RechtsbezugArt;
  /** Weitere Bezüge desselben Quelltextes mit eigener Art (siehe FreitextKlassifikation.weitere). */
  weitere?: OeffentlicheRechtsgrundlage[];
}

/** Alle Bezüge einer öffentlichen Rechtsgrundlage: der erste und die weiteren. */
export function rechtsgrundlageBezuege(rechtsgrundlage: OeffentlicheRechtsgrundlage | null | undefined): OeffentlicheRechtsgrundlage[] {
  if (!rechtsgrundlage) return [];
  const { weitere, ...erster } = rechtsgrundlage;
  return [erster, ...(weitere ?? [])];
}

const normStatusCache = new Map<string, string | null>();
const kuenftigeFassungCache = new Map<string, boolean>();

/** Status einer Norm laut content/normen/<slug>/meta.json (z. B. „in-force“, „future-effective“) oder null. */
export function getNormStatus(normSlug: string): string | null {
  if (normStatusCache.has(normSlug)) return normStatusCache.get(normSlug) ?? null;
  let status: string | null = null;
  if (/^[a-z0-9][a-z0-9-]*$/u.test(normSlug)) {
    const pfad = join(resolveHaushaltRepositoryRoot(), 'content', 'normen', normSlug, 'meta.json');
    if (existsSync(pfad)) {
      const meta = JSON.parse(readFileSync(pfad, 'utf8')) as { status?: unknown };
      status = typeof meta.status === 'string' ? meta.status : null;
    }
  }
  normStatusCache.set(normSlug, status);
  return status;
}

/**
 * Hat die Norm eine verkündete, zum redaktionellen Stichtag noch nicht wirksame Fassung
 * (Historieneintrag nach dem Stichtag laut content/normen/<slug>/history.json)?
 */
export function hatKuenftigeFassung(normSlug: string, stichtag: string = getRedaktionellerStichtag()): boolean {
  const key = `${normSlug}@${stichtag}`;
  const cached = kuenftigeFassungCache.get(key);
  if (cached !== undefined) return cached;
  let ergebnis = false;
  if (/^[a-z0-9][a-z0-9-]*$/u.test(normSlug)) {
    const pfad = join(resolveHaushaltRepositoryRoot(), 'content', 'normen', normSlug, 'history.json');
    if (existsSync(pfad)) {
      const historie = JSON.parse(readFileSync(pfad, 'utf8')) as { entries?: Array<{ date?: unknown; type?: unknown }> };
      ergebnis = (historie.entries ?? []).some(
        (entry) =>
          typeof entry.date === 'string'
          && entry.date > stichtag
          && (entry.type === 'amendment' || entry.type === 'initial' || entry.type === 'repeal'),
      );
    }
  }
  kuenftigeFassungCache.set(key, ergebnis);
  return ergebnis;
}

/**
 * Angezeigte Art eines Rechtsbezugs: Bei „geltend“ oder „verkuendet“ mit Normverweis folgt die
 * Art dem Normstatus zum redaktionellen Stichtag (noch nicht in Kraft → „verkuendet“, in Kraft →
 * „geltend“); sonst gilt die redaktionelle Einstufung. Ausnahme: Ein ausdrücklich als
 * „verkuendet“ eingestufter Bezug auf eine geltende Norm mit noch nicht wirksamer Änderungs-
 * fassung meint diese Änderung und bleibt „verkuendet“, bis der Stichtag sie erreicht.
 */
export function resolveRechtsbezugArt(
  art: RechtsbezugArt | undefined,
  normSlug: string | undefined,
  normStatus: (slug: string) => string | null = getNormStatus,
  kuenftigeFassung: (slug: string) => boolean = (slug) => hatKuenftigeFassung(slug),
): RechtsbezugArt | undefined {
  if (!normSlug || (art !== 'geltend' && art !== 'verkuendet')) return art;
  const status = normStatus(normSlug);
  if (status === 'future-effective') return 'verkuendet';
  if (status === 'in-force') return art === 'verkuendet' && kuenftigeFassung(normSlug) ? 'verkuendet' : 'geltend';
  return art;
}

/** Öffentliche Rechtsgrundlage eines Titels oder null (nicht klassifiziert oder unterdrückt). */
export function publicRechtsgrundlage(quelltext: string | undefined, overlay: FreitextOverlay): OeffentlicheRechtsgrundlage | null {
  if (!quelltext) return null;
  const eintrag = overlay.rechtsgrundlage[quelltext];
  if (!eintrag || typeof eintrag.anzeige !== 'string' || eintrag.anzeige.trim() === '') return null;
  const art = resolveRechtsbezugArt(eintrag.art, eintrag.normSlug);
  const weitere = (eintrag.weitere ?? [])
    .filter((bezug) => typeof bezug?.anzeige === 'string' && bezug.anzeige.trim() !== '')
    .map((bezug): OeffentlicheRechtsgrundlage => {
      const bezugArt = resolveRechtsbezugArt(bezug.art, bezug.normSlug);
      return { text: bezug.anzeige, ...(bezug.normSlug ? { normSlug: bezug.normSlug } : {}), ...(bezugArt ? { art: bezugArt } : {}) };
    });
  return {
    text: eintrag.anzeige,
    ...(eintrag.normSlug ? { normSlug: eintrag.normSlug } : {}),
    ...(art ? { art } : {}),
    ...(weitere.length > 0 ? { weitere } : {}),
  };
}

function klassifizierterText(text: string | undefined, klassifikation: Record<string, FreitextKlassifikation>): string | null {
  if (!text || text.trim() === '') return null;
  const eintrag = klassifikation[text];
  return eintrag && typeof eintrag.anzeige === 'string' && eintrag.anzeige.trim() !== '' ? eintrag.anzeige.trim() : null;
}

/** Öffentlicher Finanzierungsvermerk eines Titels oder null. */
export function publicFinanzierung(quelltext: string | undefined, overlay: FreitextOverlay): string | null {
  return klassifizierterText(quelltext, overlay.finanzierung);
}

/** Öffentliche Erläuterung oder null (nicht klassifiziert oder unterdrückt). */
export function publicErlaeuterung(text: string | undefined, overlay: FreitextOverlay): string | null {
  return klassifizierterText(text, overlay.erlaeuterung);
}

/** Öffentlicher Haushaltsvermerk oder null (nicht klassifiziert oder unterdrückt). */
export function publicVermerk(text: string | undefined, overlay: FreitextOverlay): string | null {
  return klassifizierterText(text, overlay.vermerk);
}

/** Braucht eine Bezeichnung eine öffentliche Fassung (Metabegriff oder Paarform)? */
export function braucheBezeichnungsfassung(text: string): boolean {
  return enthaeltMetabegriff(text) || enthaeltPaarform(text);
}

/**
 * Öffentliche Fassung einer Bezeichnung aus dem Snapshot (Zweckbestimmung, Gruppen-, Funktions-,
 * Hauptfunktions-, Kapitel- und Einzelplanbezeichnung, Mengeneinheit). Unauffällige Bezeichnungen
 * bleiben unverändert; eine Bezeichnung mit Metabegriff oder Paarform ohne öffentliche Fassung im
 * Abschnitt `bezeichnungen` bricht den Build ab.
 */
export function publicBezeichnung(text: string, overlay: FreitextOverlay): string;
export function publicBezeichnung(text: string | undefined, overlay: FreitextOverlay): string | undefined;
export function publicBezeichnung(text: string | undefined, overlay: FreitextOverlay): string | undefined {
  if (text === undefined) return undefined;
  const fassung = overlay.bezeichnungen[text];
  if (typeof fassung === 'string' && fassung.trim() !== '') return fassung;
  if (braucheBezeichnungsfassung(text)) {
    throw new Error(`Haushaltsbezeichnung ohne öffentliche Fassung (freitexte.json, Abschnitt „bezeichnungen“): „${text}“`);
  }
  return text;
}

export interface OeffentlicheTiteltexte {
  rechtsgrundlage: OeffentlicheRechtsgrundlage | null;
  finanzierung: string | null;
  erlaeuterung: string | null;
  vermerk: string | null;
}

/**
 * Öffentliche Freitexte eines Titels für ein Jahr. Jahresabhängige Felder (unter `jahre`) gehen
 * den jahresinvarianten vor.
 */
export function publicTiteltexte(titel: Titel, jahr: string, overlay: FreitextOverlay): OeffentlicheTiteltexte {
  const jahresdaten: Partial<TitelJahr> = titel.jahre[jahr as `${number}`] ?? {};
  const pick = <K extends 'rechtsgrundlage' | 'finanzierung' | 'erlaeuterung' | 'vermerk'>(key: K) =>
    (jahresdaten[key] ?? titel[key]) as string | undefined;
  return {
    rechtsgrundlage: publicRechtsgrundlage(pick('rechtsgrundlage'), overlay),
    finanzierung: publicFinanzierung(pick('finanzierung'), overlay),
    erlaeuterung: publicErlaeuterung(pick('erlaeuterung'), overlay),
    vermerk: publicVermerk(pick('vermerk'), overlay),
  };
}

/** Projekt-Suchbegriffe ohne interne Kennungen und Metabegriffe. */
export function publicSuchbegriffe(begriffe: readonly string[]): string[] {
  return begriffe.filter((begriff) => begriff.trim() !== '' && !enthaeltMetabegriff(begriff));
}

// ---------------------------------------------------------------------------------------------
// Nummern in amtlicher Schreibweise

/** „0407“ → „04 07“. */
export function formatKapitelnummer(kapitel: string): string {
  return /^\d{4}$/u.test(kapitel) ? `${kapitel.slice(0, 2)} ${kapitel.slice(2)}` : kapitel;
}

/** „63361“ → „633 61“. */
export function formatTitelnummer(titel: string): string {
  return /^\d{5}$/u.test(titel) ? `${titel.slice(0, 3)} ${titel.slice(3)}` : titel;
}
