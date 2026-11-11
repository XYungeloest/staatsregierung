/**
 * Redaktionelle Texte der Finanzierungsseite (content/haushalt/<periode>/finanzierung.json).
 *
 * Finanzierungsmaßnahmen tragen im Snapshot nur interne Kennungen und Arbeitsvermerke
 * (Bedingung, Rechtsgrundlage, Status). Öffentlich erscheinen sie ausschließlich mit Titel,
 * Erläuterung, Herkunft, Zweck, Voraussetzung und Planungsstatus aus diesem Overlay
 * (fail-closed): Maßnahmen ohne Eintrag werden nicht als Karte gezeigt. Das Overlay enthält
 * keine Beträge.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { enthaeltMetabegriff, enthaeltPaarform } from '../../../lib/haushalt/oeffentlich.ts';
import { resolveHaushaltRepositoryRoot } from '../../../lib/haushalt/snapshot.ts';

export interface MassnahmeText {
  titel: string;
  kategorie: string;
  erlaeuterung: string;
  herkunft: string;
  zweck: string;
  voraussetzung: string;
  rechtsbezug?: string;
  /** Projektkennung des Snapshots, deren Projektseite verlinkt wird (nur wenn sie existiert). */
  projekt?: string;
}

export interface FinanzierungOverlay {
  /** Öffentlicher Planungsstatus aller Maßnahmen. */
  planungsstatus: string;
  massnahmen: Record<string, MassnahmeText>;
  dienstrecht?: { kennung: string; titel: string; erlaeuterung: string };
  /** Ermächtigungsrahmen für Kassenverstärkungskredite laut Gesetzentwurf (Text mit Fundstelle, ohne Betrag). */
  kassenkredite?: { titel: string; text: string; rechtsbezug: string };
  kategorien: Record<string, string>;
  fondsarten: Record<string, string>;
}

const cache = new Map<string, FinanzierungOverlay>();

/** Keine Anzeigetexte: Kennungen der Quelle. */
const KENNUNGSFELDER = new Set(['kennung', 'projekt', 'kategorie']);
/** Der Planungsstatus benennt die Herkunftsklasse „Planungsannahme“ ausdrücklich (ORIGIN_LABELS). */
const OHNE_METABEGRIFFPRUEFUNG = new Set(['planungsstatus']);

function pruefeTexte(wert: unknown, pfad: string, datei: string, schluessel = ''): void {
  if (typeof wert === 'string') {
    if (enthaeltPaarform(wert)) throw new Error(`${datei} ${pfad}: nicht zulässige Personenbezeichnung in „${wert}“.`);
    if (!OHNE_METABEGRIFFPRUEFUNG.has(schluessel) && enthaeltMetabegriff(wert)) {
      throw new Error(`${datei} ${pfad}: interner Begriff in „${wert}“.`);
    }
    return;
  }
  if (wert && typeof wert === 'object') {
    for (const [key, eintrag] of Object.entries(wert)) {
      if (KENNUNGSFELDER.has(key)) continue;
      pruefeTexte(eintrag, `${pfad}.${key}`, datei, key);
    }
  }
}

/** content/haushalt/<periode>/finanzierung.json; fehlt die Datei, ist keine Maßnahme beschriftet. */
export function loadFinanzierungOverlay(periode: string): FinanzierungOverlay {
  const cached = cache.get(periode);
  if (cached) return cached;
  if (!/^\d{4}-\d{4}$/u.test(periode)) throw new Error(`Ungültige Haushaltsperiode „${periode}“.`);
  const datei = `content/haushalt/${periode}/finanzierung.json`;
  const pfad = join(resolveHaushaltRepositoryRoot(), datei);
  const leer: FinanzierungOverlay = { planungsstatus: '', massnahmen: {}, kategorien: {}, fondsarten: {} };
  if (!existsSync(pfad)) {
    cache.set(periode, leer);
    return leer;
  }
  let json: Partial<FinanzierungOverlay>;
  try {
    json = JSON.parse(readFileSync(pfad, 'utf8')) as Partial<FinanzierungOverlay>;
  } catch (error) {
    throw new Error(`${datei} enthält ungültiges JSON: ${(error as Error).message}`);
  }
  const overlay: FinanzierungOverlay = { ...leer, ...json };
  pruefeTexte(overlay, '', datei);
  for (const [kennung, text] of Object.entries(overlay.massnahmen)) {
    for (const feld of ['titel', 'erlaeuterung', 'herkunft', 'zweck', 'voraussetzung'] as const) {
      if (typeof text[feld] !== 'string' || text[feld].trim() === '') throw new Error(`${datei}: Maßnahme ${kennung} ohne „${feld}“.`);
    }
    if (/^[A-Z]\d{2}$/u.test(text.titel.trim())) throw new Error(`${datei}: Maßnahme ${kennung} braucht einen öffentlichen Titel statt der Kennung.`);
  }
  cache.set(periode, overlay);
  return overlay;
}
