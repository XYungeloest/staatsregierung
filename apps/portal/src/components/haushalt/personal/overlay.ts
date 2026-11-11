/**
 * Redaktionelle Beschriftungen der Personalseite (content/haushalt/<periode>/personal.json).
 *
 * Der Snapshot führt Rechtsstände, Fallgruppen der Versorgung, Reformkomponenten, Kennzahlen und
 * Personalbereiche nur als Kennungen oder mit Bezeichnungen der Haushaltsaufstellung. Öffentlich
 * erscheint ausschließlich, was hier eine Bezeichnung hat (fail-closed): Kennungen ohne Eintrag
 * werden nicht einzeln gezeigt. Das Overlay enthält keine Beträge.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { enthaeltMetabegriff, enthaeltPaarform, RECHTSBEZUG_ARTEN, type RechtsbezugArt } from '../../../lib/haushalt/oeffentlich.ts';
import { resolveHaushaltRepositoryRoot } from '../../../lib/haushalt/snapshot.ts';

export interface RechtsstandText {
  kurz: string;
  bezeichnung: string;
  erlaeuterung: string;
}

export interface PersonalRechtsbezug {
  normSlug?: string;
  label: string;
  art: RechtsbezugArt;
}

export interface PersonalOverlay {
  rechtsstaende: Record<string, RechtsstandText>;
  bloecke: Record<string, string>;
  versorgungsteile: Record<string, string>;
  komponentengruppen: Record<string, string>;
  komponenten: Record<string, { gruppe: string; bezeichnung: string }>;
  wirkungsarten: Record<string, string>;
  kennzahlen: Record<string, string>;
  bereiche: Record<string, string>;
  besoldungstabellen: {
    geltend: { schluessel: string; bezeichnung: string; erlaeuterung: string };
    entwurf: { schluessel: string; bezeichnung: string; erlaeuterung: string };
    gruppen: Array<{ ordnung: string; gruppe: string }>;
    zuschlaege: Array<{ tabelle: string; schluessel: string; bezeichnung: string }>;
    besoldungsordnungO?: string;
  };
  reformpunkte: string[];
  rechtsbezuege: PersonalRechtsbezug[];
}

const cache = new Map<string, PersonalOverlay>();

/** Prüft jeden sichtbaren Text auf Metabegriffe und nicht zulässige Genderschreibweisen. */
function pruefeTexte(wert: unknown, pfad: string, datei: string): void {
  if (typeof wert === 'string') {
    if (enthaeltPaarform(wert)) throw new Error(`${datei} ${pfad}: nicht zulässige Personenbezeichnung in „${wert}“.`);
    if (enthaeltMetabegriff(wert)) throw new Error(`${datei} ${pfad}: interner Begriff in „${wert}“.`);
    return;
  }
  if (Array.isArray(wert)) {
    wert.forEach((eintrag, index) => pruefeTexte(eintrag, `${pfad}[${index}]`, datei));
    return;
  }
  if (wert && typeof wert === 'object') {
    for (const [key, eintrag] of Object.entries(wert)) {
      // Schlüssel (Kennungen der Quelle) und Normslugs sind keine Anzeigetexte.
      if (key === 'normSlug' || key === 'schluessel' || key === 'tabelle' || key === 'ordnung' || key === 'gruppe') continue;
      pruefeTexte(eintrag, `${pfad}.${key}`, datei);
    }
  }
}

/** content/haushalt/<periode>/personal.json; fehlt die Datei, ist nichts beschriftet. */
export function loadPersonalOverlay(periode: string): PersonalOverlay {
  const cached = cache.get(periode);
  if (cached) return cached;
  if (!/^\d{4}-\d{4}$/u.test(periode)) throw new Error(`Ungültige Haushaltsperiode „${periode}“.`);
  const datei = `content/haushalt/${periode}/personal.json`;
  const pfad = join(resolveHaushaltRepositoryRoot(), datei);
  const leer: PersonalOverlay = {
    rechtsstaende: {},
    bloecke: {},
    versorgungsteile: {},
    komponentengruppen: {},
    komponenten: {},
    wirkungsarten: {},
    kennzahlen: {},
    bereiche: {},
    besoldungstabellen: {
      geltend: { schluessel: '', bezeichnung: '', erlaeuterung: '' },
      entwurf: { schluessel: '', bezeichnung: '', erlaeuterung: '' },
      gruppen: [],
      zuschlaege: [],
    },
    reformpunkte: [],
    rechtsbezuege: [],
  };
  if (!existsSync(pfad)) {
    cache.set(periode, leer);
    return leer;
  }
  let json: Partial<PersonalOverlay>;
  try {
    json = JSON.parse(readFileSync(pfad, 'utf8')) as Partial<PersonalOverlay>;
  } catch (error) {
    throw new Error(`${datei} enthält ungültiges JSON: ${(error as Error).message}`);
  }
  const overlay: PersonalOverlay = { ...leer, ...json, besoldungstabellen: { ...leer.besoldungstabellen, ...json.besoldungstabellen } };
  pruefeTexte(overlay, '', datei);
  for (const bezug of overlay.rechtsbezuege) {
    if (!(RECHTSBEZUG_ARTEN as readonly string[]).includes(bezug.art)) throw new Error(`${datei}: unbekannte Art „${bezug.art}“ eines Rechtsbezugs.`);
    if (bezug.art === 'entwurf' && bezug.normSlug) throw new Error(`${datei}: Ein Entwurf wird nicht mit einer Vorschrift verlinkt („${bezug.label}“).`);
  }
  cache.set(periode, overlay);
  return overlay;
}
