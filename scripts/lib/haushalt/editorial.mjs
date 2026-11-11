import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { sammleTitelFreitexte } from './artefakte.mjs';
import { ProblemCollector, deepEqual } from './common.mjs';
import {
  EINZELPLAN_KATEGORIEN,
  PROJEKT_STATUS,
  RECHTSBEZUG_ARTEN,
  braucheBezeichnungsfassung,
  enthaeltPaarform,
  findeMetabegriffeOeffentlich,
} from '../../../apps/portal/src/lib/haushalt/oeffentlich.ts';

/**
 * Prüfung der redaktionellen Haushaltsdaten unter content/haushalt/: Periodenregister
 * (perioden.json) und Overlays je Periode (content/haushalt/<periode>/*.json).
 */

export const PERIODEN_STATUS = [
  'arbeitsentwurf',
  'regierungsentwurf',
  'parlamentarische-beratung',
  'beschlossen',
  'verkuendet',
  'historisch',
];
const DATENQUELLEN = ['snapshot', 'legacy-2025-2026'];
const OVERLAY_GELD_SCHLUESSEL = /^(?:betrag|betraege|einnahmen|ausgaben|kernhaushalt|haushaltsvolumen|summe|ansatz|volumen)$|_eur$/u;
const OVERLAY_ART = new Set(RECHTSBEZUG_ARTEN);

function readJson(path, problems, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    problems.add(`${label}: ungültiges JSON (${error.message})`);
    return undefined;
  }
}

function slugsOf(contentRoot, segment) {
  const directory = join(contentRoot, segment);
  const slugs = new Set();
  if (!existsSync(directory)) return slugs;
  for (const name of readdirSync(directory)) {
    if (!name.endsWith('.json')) continue;
    try {
      const json = JSON.parse(readFileSync(join(directory, name), 'utf8'));
      if (typeof json?.slug === 'string') slugs.add(json.slug);
    } catch {
      // Ungültige Dateien meldet check-content.mjs.
    }
  }
  return slugs;
}

function normExists(contentRoot, slug) {
  return typeof slug === 'string'
    && /^[a-z0-9][a-z0-9-]*$/u.test(slug)
    && existsSync(join(contentRoot, 'normen', slug, 'meta.json'));
}

/** Öffentlich ⇔ freigabe.oeffentlich === true und Status nicht „arbeitsentwurf“. */
export function isPeriodPublic(entry) {
  return entry?.freigabe?.oeffentlich === true && entry?.status !== 'arbeitsentwurf';
}

/**
 * @param {{ contentRoot: string, dataRoot: string }} roots
 * @returns {{ problems: string[], perioden: any[] }}
 */
export function validateEditorial({ contentRoot, dataRoot }) {
  const problems = new ProblemCollector();
  const registerPath = join(contentRoot, 'haushalt', 'perioden.json');
  const label = 'content/haushalt/perioden.json';
  if (!existsSync(registerPath)) {
    problems.add(`${label}: Periodenregister fehlt`);
    return { problems: problems.problems, perioden: [] };
  }
  const register = readJson(registerPath, problems, label);
  if (!register) return { problems: problems.problems, perioden: [] };
  if (!Array.isArray(register.perioden) || Object.keys(register).some((key) => key !== 'perioden')) {
    problems.add(`${label}: erwartet genau das Feld „perioden“ mit einer Liste`);
    return { problems: problems.problems, perioden: [] };
  }

  const ids = new Set();
  for (const [index, entry] of register.perioden.entries()) {
    const at = `${label} perioden[${index}]`;
    if (!entry || typeof entry !== 'object') {
      problems.add(`${at}: kein Objekt`);
      continue;
    }
    const match = /^(\d{4})-(\d{4})$/u.exec(entry.id ?? '');
    if (!match) {
      problems.add(`${at}: id „${entry.id}“ hat nicht die Form JJJJ-JJJJ`);
      continue;
    }
    if (ids.has(entry.id)) problems.add(`${at}: Periode ${entry.id} doppelt`);
    ids.add(entry.id);
    const years = [Number(match[1]), Number(match[2])];
    if (years[1] !== years[0] + 1) problems.add(`${at}: ${entry.id} sind keine aufeinanderfolgenden Jahre`);
    if (!deepEqual(entry.jahre, years)) problems.add(`${at}: jahre ${JSON.stringify(entry.jahre)} passen nicht zur id ${entry.id}`);
    if (typeof entry.bezeichnung !== 'string' || entry.bezeichnung.trim() === '') problems.add(`${at}: bezeichnung fehlt`);
    if (!PERIODEN_STATUS.includes(entry.status)) problems.add(`${at}: Status „${entry.status}“ ist nicht zulässig (${PERIODEN_STATUS.join(', ')})`);
    if (!DATENQUELLEN.includes(entry.datenquelle)) problems.add(`${at}: datenquelle „${entry.datenquelle}“ ist nicht zulässig`);

    const freigabe = entry.freigabe;
    if (!freigabe || typeof freigabe !== 'object' || typeof freigabe.oeffentlich !== 'boolean') {
      problems.add(`${at}: freigabe.oeffentlich fehlt`);
    } else if (freigabe.oeffentlich) {
      if (typeof freigabe.datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(freigabe.datum)) problems.add(`${at}: freigegebene Periode ohne Freigabedatum`);
      if (typeof freigabe.grundlage !== 'string' || freigabe.grundlage.trim() === '') problems.add(`${at}: freigegebene Periode ohne Freigabegrundlage`);
      if (entry.status === 'arbeitsentwurf') problems.add(`${at}: ein Arbeitsentwurf darf nicht freigegeben werden`);
    } else {
      if (freigabe.datum !== null || freigabe.grundlage !== null) problems.add(`${at}: nicht freigegebene Periode trägt Freigabedatum oder -grundlage`);
    }

    if (entry.rechtsgrundlage !== undefined) {
      if (!normExists(contentRoot, entry.rechtsgrundlage?.normSlug)) {
        problems.add(`${at}: rechtsgrundlage.normSlug „${entry.rechtsgrundlage?.normSlug}“ verweist auf keine Norm unter content/normen/`);
      }
    }
    if (entry.status === 'verkuendet' && entry.rechtsgrundlage === undefined) {
      problems.add(`${at}: verkündete Periode ohne Rechtsgrundlage`);
    }
    if (entry.nachtrag !== undefined) {
      if (!Number.isSafeInteger(entry.nachtrag?.nummer) || entry.nachtrag.nummer < 1) problems.add(`${at}: nachtrag.nummer muss eine positive ganze Zahl sein`);
      if (!PERIODEN_STATUS.includes(entry.nachtrag?.status)) problems.add(`${at}: nachtrag.status „${entry.nachtrag?.status}“ ist nicht zulässig`);
    }

    if (entry.datenquelle === 'snapshot') {
      const directory = join(dataRoot, entry.id);
      if (!existsSync(join(directory, 'periode.json'))) {
        problems.add(`${at}: datenquelle „snapshot“, aber data/haushalt/${entry.id}/ fehlt`);
      } else {
        const periode = readJson(join(directory, 'periode.json'), problems, `data/haushalt/${entry.id}/periode.json`);
        if (periode && !deepEqual(periode.jahre, years)) problems.add(`${at}: Jahre weichen vom Snapshot ab`);
      }
    }
  }

  // Jeder Snapshot muss im Register stehen.
  if (existsSync(dataRoot)) {
    for (const name of readdirSync(dataRoot)) {
      if (name.startsWith('.')) continue;
      if (!statSync(join(dataRoot, name)).isDirectory()) continue;
      const entry = register.perioden.find((item) => item?.id === name);
      if (!entry) problems.add(`data/haushalt/${name}/: Snapshot ohne Eintrag im Periodenregister`);
      else if (entry.datenquelle !== 'snapshot') problems.add(`data/haushalt/${name}/: Periode ist im Register nicht als Snapshot geführt`);
    }
  }

  validateOverlays({ contentRoot, problems, perioden: register.perioden });
  for (const entry of register.perioden) {
    if (entry?.datenquelle !== 'snapshot' || !/^\d{4}-\d{4}$/u.test(entry.id ?? '')) continue;
    const snapshotDirectory = join(dataRoot, entry.id);
    if (!existsSync(join(snapshotDirectory, 'periode.json'))) continue;
    validateSnapshotOverlays({ contentRoot, snapshotDirectory, periode: entry.id, problems });
  }
  return { problems: problems.problems, perioden: register.perioden };
}

function collectReferences(value, path, found) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectReferences(entry, `${path}[${index}]`, found));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    const at = path ? `${path}.${key}` : key;
    if (key === 'ministrySlug' || key === 'ministrySlugs') found.ministry.push(...[entry].flat().map((slug) => ({ slug, at })));
    else if (key === 'topicSlug' || key === 'topicSlugs') found.topic.push(...[entry].flat().map((slug) => ({ slug, at })));
    else if (key === 'normSlug' || key === 'normSlugs') found.norm.push(...[entry].flat().map((slug) => ({ slug, at })));
    if (OVERLAY_GELD_SCHLUESSEL.test(key) && (typeof entry === 'number' || (entry && typeof entry === 'object'))) {
      found.money.push(at);
    }
    if (key === 'art' && path.includes('rechtsbezuege') && !OVERLAY_ART.has(entry)) found.art.push({ at, value: entry });
    collectReferences(entry, at, found);
  }
}

function validateOverlays({ contentRoot, problems, perioden }) {
  const base = join(contentRoot, 'haushalt');
  if (!existsSync(base)) return;
  const ministries = slugsOf(contentRoot, 'ressorts');
  const topics = slugsOf(contentRoot, 'themen');
  for (const name of readdirSync(base)) {
    const directory = join(base, name);
    if (!statSync(directory).isDirectory()) continue;
    if (!perioden.some((entry) => entry?.id === name)) {
      problems.add(`content/haushalt/${name}/: Overlay-Verzeichnis ohne Periode im Register`);
    }
    const files = [];
    const walk = (current, prefix) => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(join(current, entry.name), `${prefix}${entry.name}/`);
        else if (entry.isFile() && entry.name.endsWith('.json')) files.push(`${prefix}${entry.name}`);
      }
    };
    walk(directory, '');
    for (const file of files.sort()) {
      const label = `content/haushalt/${name}/${file}`;
      const json = readJson(join(directory, file), problems, label);
      if (json === undefined) continue;
      const found = { ministry: [], topic: [], norm: [], money: [], art: [] };
      collectReferences(json, '', found);
      for (const { slug, at } of found.ministry) {
        if (!ministries.has(slug)) problems.add(`${label}: ${at} „${slug}“ ist kein Ressort unter content/ressorts/`);
      }
      for (const { slug, at } of found.topic) {
        if (!topics.has(slug)) problems.add(`${label}: ${at} „${slug}“ ist kein Thema unter content/themen/`);
      }
      for (const { slug, at } of found.norm) {
        if (!normExists(contentRoot, slug)) problems.add(`${label}: ${at} „${slug}“ verweist auf keine Norm unter content/normen/`);
      }
      for (const at of found.money) problems.add(`${label}: ${at} enthält Beträge; Overlays dürfen keine Beträge tragen`);
      for (const { at, value } of found.art) problems.add(`${label}: ${at} „${value}“ ist keine zulässige Art eines Rechtsbezugs`);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Overlays einer Snapshot-Periode: Freitext-Klassifikation, Einzelpläne, Projekte

const PROJEKT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const KLASSIFIZIERTE_FREITEXTE = ['rechtsgrundlage', 'finanzierung', 'erlaeuterung', 'vermerk'];
const FREITEXT_SCHLUESSEL = new Set([...KLASSIFIZIERTE_FREITEXTE, 'bezeichnungen']);
/** Schlüssel, unter denen der Snapshot öffentlich angezeigte Bezeichnungen führt. */
const BEZEICHNUNG_SCHLUESSEL = new Set([
  'bezeichnung',
  'zweckbestimmung',
  'gruppe_bezeichnung',
  'funktion_bezeichnung',
  'hauptfunktion_bezeichnung',
  'einheit',
  // Zuständigkeit eines Einzelplans, angezeigt, wenn ihm kein Ressort zugeordnet ist
  'ressort',
]);
/** Snapshotdateien ohne öffentlich angezeigte Bezeichnungen (Metadaten; Projekte über projekte.json-Overlay). */
const BEZEICHNUNG_AUSNAHMEN = new Set(['periode.json', 'projekte.json', 'import-manifest.json', 'qualitaet.json']);

function readSnapshotJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    // Fehlende oder ungültige Snapshotdateien meldet validateSnapshotDirectory.
    return undefined;
  }
}

/** Alle Freitexte der Titel eines Snapshots: Feld → Menge der verschiedenen Quelltexte. */
export function collectTitelFreitexte(snapshotDirectory) {
  const titelDirectory = join(snapshotDirectory, 'titel');
  if (!existsSync(titelDirectory)) return sammleTitelFreitexte([]);
  const dateien = readdirSync(titelDirectory).filter((file) => file.endsWith('.json')).sort().map((name) => readSnapshotJson(join(titelDirectory, name)));
  return sammleTitelFreitexte(dateien);
}

/**
 * Alle Bezeichnungen eines Snapshots (Zweckbestimmungen, Gruppen-, Funktions-, Kapitel- und
 * Einzelplanbezeichnungen, Mengeneinheiten), wie sie Seiten über publicBezeichnung anzeigen.
 */
export function collectSnapshotBezeichnungen(snapshotDirectory) {
  const found = new Set();
  const walk = (value, key) => {
    if (typeof value === 'string') {
      if (BEZEICHNUNG_SCHLUESSEL.has(key) && value.trim() !== '') found.add(value);
    } else if (Array.isArray(value)) {
      for (const entry of value) walk(entry, key);
    } else if (value && typeof value === 'object') {
      for (const [entryKey, entry] of Object.entries(value)) walk(entry, entryKey);
    }
  };
  if (!existsSync(snapshotDirectory)) return found;
  for (const name of readdirSync(snapshotDirectory).sort()) {
    const path = join(snapshotDirectory, name);
    if (name === 'titel' && statSync(path).isDirectory()) {
      for (const file of readdirSync(path).filter((entry) => entry.endsWith('.json')).sort()) walk(readSnapshotJson(join(path, file)), '');
    } else if (name.endsWith('.json') && !BEZEICHNUNG_AUSNAHMEN.has(name)) {
      walk(readSnapshotJson(path), '');
    }
  }
  return found;
}

/**
 * Redaktionelle öffentliche Texte: keine Arbeitsvermerke, keine Paarformen (AGENTS.md:
 * Doppelpunkt). Die vorgeschriebenen Formeln „Planungsannahme“ und „modellierte
 * Planäquivalente“ (oeffentlich.ts, OEFFENTLICHE_FORMELN) sind zulässig.
 */
function metaProblem(problems, label, at, text) {
  if (typeof text !== 'string') return;
  const treffer = findeMetabegriffeOeffentlich(text);
  if (treffer.length > 0) problems.add(`${label}: ${at} enthält interne Begriffe (${treffer.join(', ')}); öffentliche Texte dürfen keine Arbeitsvermerke enthalten`);
  if (enthaeltPaarform(text)) problems.add(`${label}: ${at} enthält eine Paarform; Personenbezeichnungen mit Doppelpunkt schreiben (z. B. „Schüler:innen“)`);
}

function normStatus(contentRoot, slug) {
  try {
    const meta = JSON.parse(readFileSync(join(contentRoot, 'normen', slug, 'meta.json'), 'utf8'));
    return typeof meta?.status === 'string' ? meta.status : null;
  } catch {
    return null;
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function validateFreitextOverlay({ contentRoot, snapshotDirectory, periode, problems }) {
  const label = `content/haushalt/${periode}/freitexte.json`;
  const path = join(contentRoot, 'haushalt', periode, 'freitexte.json');
  const texte = collectTitelFreitexte(snapshotDirectory);
  const bezeichnungen = collectSnapshotBezeichnungen(snapshotDirectory);
  if (!existsSync(path)) {
    if (KLASSIFIZIERTE_FREITEXTE.some((feld) => texte[feld].size > 0) || [...bezeichnungen].some(braucheBezeichnungsfassung)) {
      problems.add(`${label}: fehlt; jeder Freitext der Titel muss redaktionell klassifiziert sein`);
    }
    return;
  }
  const overlay = readJson(path, problems, label);
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) return;
  for (const key of Object.keys(overlay)) {
    if (!FREITEXT_SCHLUESSEL.has(key)) problems.add(`${label}: unbekannter Abschnitt „${key}“`);
  }
  for (const feld of KLASSIFIZIERTE_FREITEXTE) {
    const klassifikation = overlay[feld] ?? {};
    if (typeof klassifikation !== 'object' || Array.isArray(klassifikation)) {
      problems.add(`${label}: ${feld} muss ein Objekt Quelltext → Klassifikation sein`);
      continue;
    }
    const fehlend = [...texte[feld]].filter((text) => !Object.hasOwn(klassifikation, text));
    for (const text of fehlend.slice(0, 20)) {
      problems.add(`${label}: ${feld} „${text.slice(0, 120)}“ ist nicht klassifiziert (anzeige: öffentliche Formulierung oder null)`);
    }
    if (fehlend.length > 20) problems.add(`${label}: … sowie ${fehlend.length - 20} weitere nicht klassifizierte ${feld}-Texte`);
    const erlaubteFelder = feld === 'rechtsgrundlage' ? ['anzeige', 'normSlug', 'art', 'weitere'] : ['anzeige'];
    for (const [text, eintrag] of Object.entries(klassifikation)) {
      const at = `${feld} „${text.slice(0, 120)}“`;
      if (!texte[feld].has(text)) problems.add(`${label}: ${at} kommt im Snapshot nicht vor (veraltete Klassifikation entfernen)`);
      if (!eintrag || typeof eintrag !== 'object' || Array.isArray(eintrag) || !Object.hasOwn(eintrag, 'anzeige')) {
        problems.add(`${label}: ${at} braucht das Feld „anzeige“ (Text oder null)`);
        continue;
      }
      for (const key of Object.keys(eintrag)) {
        if (!erlaubteFelder.includes(key)) problems.add(`${label}: ${at} hat das unbekannte Feld „${key}“`);
      }
      if (eintrag.anzeige === null) {
        if (eintrag.normSlug !== undefined || eintrag.art !== undefined || eintrag.weitere !== undefined) {
          problems.add(`${label}: ${at} wird nicht angezeigt und darf weder normSlug noch art oder weitere tragen`);
        }
        continue;
      }
      if (!nonEmptyString(eintrag.anzeige)) {
        problems.add(`${label}: ${at}: anzeige muss ein nicht leerer Text oder null sein`);
        continue;
      }
      metaProblem(problems, label, `${at} → anzeige`, eintrag.anzeige);
      if (eintrag.art !== undefined && !RECHTSBEZUG_ARTEN.includes(eintrag.art)) {
        problems.add(`${label}: ${at}: art „${eintrag.art}“ ist nicht zulässig (${RECHTSBEZUG_ARTEN.join(', ')})`);
      }
      // normSlug prüft collectReferences (validateOverlays) gegen content/normen/. Bei „geltend“
      // und „verkuendet“ folgt die angezeigte Art dem Normstatus; die Norm muss dann verkündet sein.
      // Ein Entwurf verlinkt nie auf eine Norm: die verlinkte Fassung enthielte den Entwurfsinhalt nicht.
      const bezuege = [{ stelle: at, bezug: eintrag }];
      if (eintrag.weitere !== undefined) {
        if (!Array.isArray(eintrag.weitere) || eintrag.weitere.length === 0) {
          problems.add(`${label}: ${at}: weitere muss eine nicht leere Liste weiterer Bezüge sein`);
        } else {
          eintrag.weitere.forEach((bezug, index) => {
            const stelle = `${at} → weitere[${index}]`;
            if (!bezug || typeof bezug !== 'object' || Array.isArray(bezug)) {
              problems.add(`${label}: ${stelle} muss ein Objekt sein`);
              return;
            }
            for (const key of Object.keys(bezug)) {
              if (!['anzeige', 'normSlug', 'art'].includes(key)) problems.add(`${label}: ${stelle} hat das unbekannte Feld „${key}“`);
            }
            if (!nonEmptyString(bezug.anzeige)) problems.add(`${label}: ${stelle}: anzeige muss ein nicht leerer Text sein`);
            else metaProblem(problems, label, `${stelle} → anzeige`, bezug.anzeige);
            if (!RECHTSBEZUG_ARTEN.includes(bezug.art)) problems.add(`${label}: ${stelle}: art „${bezug.art}“ ist nicht zulässig (${RECHTSBEZUG_ARTEN.join(', ')})`);
            bezuege.push({ stelle, bezug });
          });
        }
      }
      for (const { stelle, bezug } of bezuege) {
        if (bezug.art === 'entwurf' && bezug.normSlug !== undefined) {
          problems.add(`${label}: ${stelle}: ein Entwurf verweist nicht auf eine Norm (normSlug entfernen; den geltenden Teil als eigenen Bezug unter „weitere“ führen)`);
        }
        if (typeof bezug.normSlug === 'string' && ['geltend', 'verkuendet'].includes(bezug.art)) {
          const status = normStatus(contentRoot, bezug.normSlug);
          if (status !== null && !['in-force', 'future-effective'].includes(status)) {
            problems.add(`${label}: ${stelle}: art „${bezug.art}“, die Norm ${bezug.normSlug} hat aber den Status „${status}“`);
          }
        }
      }
    }
  }

  const fassungen = overlay.bezeichnungen ?? {};
  if (typeof fassungen !== 'object' || Array.isArray(fassungen)) {
    problems.add(`${label}: bezeichnungen muss ein Objekt Quelltext → öffentliche Fassung sein`);
    return;
  }
  const ohneFassung = [...bezeichnungen].filter((text) => braucheBezeichnungsfassung(text) && !Object.hasOwn(fassungen, text));
  for (const text of ohneFassung.slice(0, 20)) {
    problems.add(`${label}: Bezeichnung „${text.slice(0, 120)}“ enthält einen internen Begriff oder eine Paarform und braucht eine öffentliche Fassung unter „bezeichnungen“`);
  }
  if (ohneFassung.length > 20) problems.add(`${label}: … sowie ${ohneFassung.length - 20} weitere Bezeichnungen ohne öffentliche Fassung`);
  for (const [text, fassung] of Object.entries(fassungen)) {
    const at = `bezeichnungen „${text.slice(0, 120)}“`;
    if (!bezeichnungen.has(text)) problems.add(`${label}: ${at} kommt im Snapshot nicht vor (veraltete Fassung entfernen)`);
    if (!nonEmptyString(fassung)) {
      problems.add(`${label}: ${at}: die öffentliche Fassung muss ein nicht leerer Text sein`);
      continue;
    }
    metaProblem(problems, label, `${at} → Fassung`, fassung);
  }
}

function validateEinzelplanOverlay({ contentRoot, snapshotDirectory, periode, problems }) {
  const label = `content/haushalt/${periode}/einzelplaene.json`;
  const path = join(contentRoot, 'haushalt', periode, 'einzelplaene.json');
  const snapshot = readSnapshotJson(join(snapshotDirectory, 'einzelplaene.json'));
  const eps = new Set((snapshot?.einzelplaene ?? []).map((entry) => entry.ep));
  if (!existsSync(path)) {
    problems.add(`${label}: fehlt; jeder Einzelplan braucht Kurztitel, Kategorie und Beschreibung`);
    return;
  }
  const overlay = readJson(path, problems, label);
  const eintraege = overlay?.einzelplaene;
  if (!eintraege || typeof eintraege !== 'object' || Array.isArray(eintraege)) {
    problems.add(`${label}: erwartet das Objekt „einzelplaene“ (Einzelplannummer → Angaben)`);
    return;
  }
  for (const ep of eps) if (!Object.hasOwn(eintraege, ep)) problems.add(`${label}: Einzelplan ${ep} fehlt`);
  for (const [ep, eintrag] of Object.entries(eintraege)) {
    const at = `einzelplaene.${ep}`;
    if (!eps.has(ep)) problems.add(`${label}: ${at} gibt es im Snapshot nicht`);
    if (!eintrag || typeof eintrag !== 'object') {
      problems.add(`${label}: ${at} ist kein Objekt`);
      continue;
    }
    for (const feld of ['kurztitel', 'beschreibung']) {
      if (!nonEmptyString(eintrag[feld])) problems.add(`${label}: ${at}.${feld} fehlt`);
      metaProblem(problems, label, `${at}.${feld}`, eintrag[feld]);
    }
    if (!EINZELPLAN_KATEGORIEN.includes(eintrag.kategorie)) {
      problems.add(`${label}: ${at}.kategorie „${eintrag.kategorie}“ ist nicht zulässig (${EINZELPLAN_KATEGORIEN.join(', ')})`);
    }
    for (const feld of ['ministrySlugs', 'topicSlugs']) {
      if (!Array.isArray(eintrag[feld])) problems.add(`${label}: ${at}.${feld} muss eine Liste sein`);
    }
    if (['Verfassungsorgan', 'Unabhängige Stelle'].includes(eintrag.kategorie) && eintrag.ministrySlugs?.length > 0) {
      problems.add(`${label}: ${at}: ${eintrag.kategorie} ohne Ressortzuordnung führen`);
    }
  }
}

function projektSumme(projekt) {
  return Object.values(projekt?.jahre ?? {}).reduce(
    (summe, jahr) => summe + Math.abs(jahr?.kernhaushalt ?? 0) + Math.abs(jahr?.einnahmen ?? 0),
    0,
  );
}

function validateProjektOverlay({ contentRoot, snapshotDirectory, periode, problems }) {
  const label = `content/haushalt/${periode}/projekte.json`;
  const path = join(contentRoot, 'haushalt', periode, 'projekte.json');
  const snapshot = readSnapshotJson(join(snapshotDirectory, 'projekte.json'));
  const projekte = new Map((snapshot?.projekte ?? []).map((projekt) => [projekt.id, projekt]));
  if (!existsSync(path)) {
    if (projekte.size > 0) problems.add(`${label}: fehlt; jedes Projekt braucht Slug, Titel, Status und Beschreibung`);
    return;
  }
  const overlay = readJson(path, problems, label);
  const eintraege = overlay?.projekte;
  if (!eintraege || typeof eintraege !== 'object' || Array.isArray(eintraege)) {
    problems.add(`${label}: erwartet das Objekt „projekte“ (Projektkennung → Angaben)`);
    return;
  }
  for (const id of projekte.keys()) if (!Object.hasOwn(eintraege, id)) problems.add(`${label}: Projekt „${id}“ fehlt`);
  const slugs = new Map();
  for (const [id, eintrag] of Object.entries(eintraege)) {
    const at = `projekte.${id}`;
    const projekt = projekte.get(id);
    if (!projekt) problems.add(`${label}: ${at} gibt es im Snapshot nicht`);
    if (!eintrag || typeof eintrag !== 'object') {
      problems.add(`${label}: ${at} ist kein Objekt`);
      continue;
    }
    if (typeof eintrag.slug !== 'string' || !PROJEKT_SLUG.test(eintrag.slug)) {
      problems.add(`${label}: ${at}.slug „${eintrag.slug}“ ist keine gültige Adresse (Kleinbuchstaben, Ziffern, Bindestriche)`);
    } else if (slugs.has(eintrag.slug)) {
      problems.add(`${label}: ${at}.slug „${eintrag.slug}“ ist bereits für ${slugs.get(eintrag.slug)} vergeben`);
    } else {
      slugs.set(eintrag.slug, id);
    }
    for (const feld of ['titel', 'fachbereich', 'statusText', 'beschreibung']) {
      if (!nonEmptyString(eintrag[feld])) problems.add(`${label}: ${at}.${feld} fehlt`);
      metaProblem(problems, label, `${at}.${feld}`, eintrag[feld]);
    }
    if (eintrag.ohneSumme !== undefined && typeof eintrag.ohneSumme !== 'boolean') {
      problems.add(`${label}: ${at}.ohneSumme muss true oder false sein`);
    }
    if (eintrag.betragshinweis !== undefined) {
      if (!nonEmptyString(eintrag.betragshinweis)) problems.add(`${label}: ${at}.betragshinweis muss ein nicht leerer Text sein`);
      metaProblem(problems, label, `${at}.betragshinweis`, eintrag.betragshinweis);
    }
    if (eintrag.ohneSumme === true && !nonEmptyString(eintrag.betragshinweis)) {
      problems.add(`${label}: ${at}: ohneSumme verlangt einen betragshinweis, der die Zuordnung der Titel erklärt`);
    }
    if (!PROJEKT_STATUS.includes(eintrag.status)) {
      problems.add(`${label}: ${at}.status „${eintrag.status}“ ist nicht zulässig (${PROJEKT_STATUS.join(', ')})`);
    }
    if (!Array.isArray(eintrag.topicSlugs)) problems.add(`${label}: ${at}.topicSlugs muss eine Liste sein`);
    if (!Array.isArray(eintrag.rechtsbezuege)) {
      problems.add(`${label}: ${at}.rechtsbezuege muss eine Liste sein`);
    } else {
      validateRechtsbezuege({ contentRoot, problems, label, at: `${at}.rechtsbezuege`, bezuege: eintrag.rechtsbezuege });
    }
    if (projekt) {
      const summe = projektSumme(projekt);
      if (eintrag.status === 'nicht-finanziert' && summe !== 0) {
        problems.add(`${label}: ${at} ist als „nicht-finanziert“ geführt, hat im Snapshot aber Beträge`);
      }
      if (projekt.status === 'option' && !['optional', 'nicht-finanziert'].includes(eintrag.status)) {
        problems.add(`${label}: ${at} ist in der Quelle eine Option und darf nur „optional“ oder „nicht-finanziert“ sein`);
      }
      if (summe === 0 && projekt.status === 'option' && eintrag.status !== 'nicht-finanziert') {
        problems.add(`${label}: ${at} ist eine Option ohne Ansatz und muss „nicht-finanziert“ sein`);
      }
    }
  }
}

/**
 * Rechtsbezüge eines Overlays: Bezeichnung vorhanden und unbedenklich; „geltend“/„verkuendet“
 * mit Normverweis nur auf verkündete Normen (in Kraft oder künftig wirksam); Entwürfe verweisen
 * nie auf eine Norm des Rechtsportals.
 */
function validateRechtsbezuege({ contentRoot, problems, label, at, bezuege }) {
  if (!Array.isArray(bezuege)) {
    problems.add(`${label}: ${at} muss eine Liste sein`);
    return;
  }
  bezuege.forEach((bezug, index) => {
    const stelle = `${at}[${index}]`;
    if (!nonEmptyString(bezug?.label)) problems.add(`${label}: ${stelle}.label fehlt`);
    metaProblem(problems, label, `${stelle}.label`, bezug?.label);
    if (bezug?.art === 'entwurf' && bezug.normSlug !== undefined) {
      problems.add(`${label}: ${stelle}: ein Entwurf verweist nicht auf eine Norm (normSlug entfernen)`);
    }
    if (typeof bezug?.normSlug === 'string' && ['geltend', 'verkuendet'].includes(bezug.art)) {
      const status = normStatus(contentRoot, bezug.normSlug);
      if (status !== null && !['in-force', 'future-effective'].includes(status)) {
        problems.add(`${label}: ${stelle}: art „${bezug.art}“, die Norm ${bezug.normSlug} hat aber den Status „${status}“`);
      }
    }
  });
}

/** Rechtsbezüge an beliebiger Stelle eines Overlays (Schlüssel „rechtsbezuege“). */
function validateAlleRechtsbezuege({ contentRoot, problems, label, value, at = '' }) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateAlleRechtsbezuege({ contentRoot, problems, label, value: entry, at: `${at}[${index}]` }));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    const stelle = at ? `${at}.${key}` : key;
    if (key === 'rechtsbezuege') validateRechtsbezuege({ contentRoot, problems, label, at: stelle, bezuege: entry });
    else validateAlleRechtsbezuege({ contentRoot, problems, label, value: entry, at: stelle });
  }
}

/** Jeder Text eines Overlays (Werte, nicht Schlüssel) ohne Arbeitsvermerke und Paarformen. */
function validateOverlayTexte({ problems, label, value, at = '' }) {
  if (typeof value === 'string') {
    metaProblem(problems, label, at || '(Wurzel)', value);
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) => validateOverlayTexte({ problems, label, value: entry, at: `${at}[${index}]` }));
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      // Verweise sind Kennungen, keine Texte.
      if (['normSlug', 'normSlugs', 'ministrySlug', 'ministrySlugs', 'topicSlug', 'topicSlugs', 'slug'].includes(key)) continue;
      validateOverlayTexte({ problems, label, value: entry, at: at ? `${at}.${key}` : key });
    }
  }
}

function objektSchluessel(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
}

/** Alle Titel eines Snapshots als „<kapitel>/<titel>“. */
function snapshotTitel(snapshotDirectory) {
  const titel = new Set();
  const directory = join(snapshotDirectory, 'titel');
  if (!existsSync(directory)) return titel;
  for (const name of readdirSync(directory).filter((file) => file.endsWith('.json'))) {
    for (const eintrag of readSnapshotJson(join(directory, name))?.titel ?? []) titel.add(`${eintrag.kapitel}/${eintrag.titel}`);
  }
  return titel;
}

function readOverlay(contentRoot, periode, datei, problems) {
  const path = join(contentRoot, 'haushalt', periode, datei);
  if (!existsSync(path)) return undefined;
  const label = `content/haushalt/${periode}/${datei}`;
  const overlay = readJson(path, problems, label);
  return overlay && typeof overlay === 'object' && !Array.isArray(overlay) ? { label, overlay } : undefined;
}

function pruefeSchluessel(problems, label, at, schluessel, bekannt, art) {
  for (const key of schluessel) {
    if (!bekannt.has(key)) problems.add(`${label}: ${at}.${key} ist keine ${art} im Snapshot`);
  }
}

/** Personal-Overlay: Bezeichnungen nur für Kennungen, die der Snapshot kennt. */
function validatePersonalOverlay({ contentRoot, snapshotDirectory, periode, problems }) {
  const gelesen = readOverlay(contentRoot, periode, 'personal.json', problems);
  if (!gelesen) return;
  const { label, overlay } = gelesen;
  const personal = readSnapshotJson(join(snapshotDirectory, 'personal.json')) ?? {};
  const mengen = {
    rechtsstaende: [new Set((personal.rechtsstaende ?? []).map((entry) => entry.code)), 'Rechtsstandskennung'],
    bloecke: [new Set((personal.regimevergleich ?? []).map((entry) => entry.block)), 'Vergleichsblock'],
    versorgungsteile: [new Set((personal.versorgung?.reihen ?? []).map((entry) => entry.teil)), 'Fallgruppe der Versorgung'],
    komponenten: [new Set((personal.reformwirkung?.komponenten ?? []).map((entry) => entry.komponente)), 'Komponente der Reformwirkung'],
    kennzahlen: [new Set((personal.kennzahlen ?? []).map((entry) => entry.kennzahl)), 'Kennzahl'],
    bereiche: [new Set((personal.stellen?.kapitel ?? []).map((entry) => entry.bereich)), 'Personalbereich'],
    wirkungsarten: [new Set(Object.keys(personal.reformwirkung?.jahre?.[0] ?? {}).filter((key) => key !== 'jahr')), 'Wirkungsart'],
  };
  for (const [abschnitt, [bekannt, art]] of Object.entries(mengen)) {
    pruefeSchluessel(problems, label, abschnitt, objektSchluessel(overlay[abschnitt]), bekannt, art);
  }
  const gruppen = new Set(objektSchluessel(overlay.komponentengruppen));
  for (const [key, komponente] of Object.entries(overlay.komponenten ?? {})) {
    if (!nonEmptyString(komponente?.bezeichnung)) problems.add(`${label}: komponenten.${key}.bezeichnung fehlt`);
    if (komponente?.gruppe !== undefined && !gruppen.has(komponente.gruppe)) {
      problems.add(`${label}: komponenten.${key}.gruppe „${komponente.gruppe}“ fehlt unter komponentengruppen`);
    }
  }
  validateOverlayTexte({ problems, label, value: overlay });
  validateAlleRechtsbezuege({ contentRoot, problems, label, value: overlay });
}

const KENNUNG = /^[A-Z]\d{2}$/u;

/** Finanzierungs-Overlay: öffentliche Fassung je Maßnahme des Snapshots, keine Kennungen als Titel. */
function validateFinanzierungOverlay({ contentRoot, snapshotDirectory, periode, problems }) {
  const gelesen = readOverlay(contentRoot, periode, 'finanzierung.json', problems);
  if (!gelesen) return;
  const { label, overlay } = gelesen;
  const finanzierung = readSnapshotJson(join(snapshotDirectory, 'finanzierung.json')) ?? {};
  const ruecklagen = readSnapshotJson(join(snapshotDirectory, 'ruecklagen.json')) ?? {};
  const massnahmen = new Set((finanzierung.massnahmen ?? []).map((entry) => entry.id));
  const kategorien = new Set(objektSchluessel(overlay.kategorien));
  pruefeSchluessel(problems, label, 'massnahmen', objektSchluessel(overlay.massnahmen), massnahmen, 'Finanzierungsmaßnahme');
  pruefeSchluessel(problems, label, 'fondsarten', objektSchluessel(overlay.fondsarten), new Set((ruecklagen.fonds_gegenposten ?? []).map((entry) => entry.art)), 'Fondsart');
  for (const [id, massnahme] of Object.entries(overlay.massnahmen ?? {})) {
    for (const feld of ['titel', 'erlaeuterung', 'herkunft', 'zweck', 'voraussetzung']) {
      if (!nonEmptyString(massnahme?.[feld])) problems.add(`${label}: massnahmen.${id}.${feld} fehlt`);
    }
    if (typeof massnahme?.titel === 'string' && KENNUNG.test(massnahme.titel.trim())) {
      problems.add(`${label}: massnahmen.${id}.titel ist eine Kennung; öffentlicher Titel erforderlich`);
    }
    if (massnahme?.kategorie !== undefined && !kategorien.has(massnahme.kategorie)) {
      problems.add(`${label}: massnahmen.${id}.kategorie „${massnahme.kategorie}“ fehlt unter kategorien`);
    }
  }
  if (overlay.kassenkredite !== undefined) {
    for (const feld of ['titel', 'text', 'rechtsbezug']) {
      if (!nonEmptyString(overlay.kassenkredite?.[feld])) problems.add(`${label}: kassenkredite.${feld} fehlt`);
    }
    if (/\d{1,3}(?:\.\d{3}){2,}/u.test(String(overlay.kassenkredite?.text ?? ''))) {
      problems.add(`${label}: kassenkredite.text nennt einen Betrag; Beträge kommen nur aus dem Snapshot`);
    }
  }
  if (overlay.dienstrecht?.kennung !== undefined && !massnahmen.has(overlay.dienstrecht.kennung)) {
    problems.add(`${label}: dienstrecht.kennung „${overlay.dienstrecht.kennung}“ ist keine Maßnahme im Snapshot`);
  }
  validateOverlayTexte({ problems, label, value: overlay });
  validateAlleRechtsbezuege({ contentRoot, problems, label, value: overlay });
}

const FONDSART_ZU_QUELLART = { zweckruecklage: 'earmarked', sondervermoegen: 'special_fund', versorgungsfonds: 'pension' };

/** Fonds-Overlay: jeder Fonds und jedes Landesunternehmen des Snapshots, passende Art, existierende Titel. */
function validateFondsOverlay({ contentRoot, snapshotDirectory, periode, problems }) {
  const gelesen = readOverlay(contentRoot, periode, 'fonds.json', problems);
  if (!gelesen) return;
  const { label, overlay } = gelesen;
  const ruecklagen = readSnapshotJson(join(snapshotDirectory, 'ruecklagen.json')) ?? {};
  const kapitel = new Set((readSnapshotJson(join(snapshotDirectory, 'kapitel.json'))?.kapitel ?? []).map((entry) => entry.kapitel));
  const projekte = new Set((readSnapshotJson(join(snapshotDirectory, 'projekte.json'))?.projekte ?? []).map((entry) => entry.id));
  const titel = snapshotTitel(snapshotDirectory);
  const quellArt = new Map((ruecklagen.fonds_gegenposten ?? []).map((entry) => [entry.fonds_id, entry.art]));
  const unternehmen = new Set((ruecklagen.wirtschaftsplaene ?? []).map((entry) => entry.id));
  const fonds = overlay.fonds ?? {};
  for (const id of quellArt.keys()) if (!Object.hasOwn(fonds, id)) problems.add(`${label}: Fonds „${id}“ fehlt`);
  for (const id of unternehmen) if (!Object.hasOwn(overlay.unternehmen ?? {}, id)) problems.add(`${label}: Landesunternehmen „${id}“ fehlt`);
  pruefeSchluessel(problems, label, 'unternehmen', objektSchluessel(overlay.unternehmen), unternehmen, 'Landesunternehmen');
  const arten = new Set(objektSchluessel(overlay.arten));
  const titelPruefen = (at, verweis) => {
    if (!verweis) return;
    if (!titel.has(`${verweis.kapitel}/${verweis.titel}`)) problems.add(`${label}: ${at} Titel ${verweis.kapitel}/${verweis.titel} gibt es im Snapshot nicht`);
  };
  for (const [id, eintrag] of Object.entries(fonds)) {
    const at = `fonds.${id}`;
    if (!quellArt.has(id)) problems.add(`${label}: ${at} gibt es im Snapshot nicht`);
    if (!nonEmptyString(eintrag?.name)) problems.add(`${label}: ${at}.name fehlt`);
    if (!arten.has(eintrag?.art)) problems.add(`${label}: ${at}.art „${eintrag?.art}“ fehlt unter arten`);
    const erwartet = FONDSART_ZU_QUELLART[eintrag?.art];
    if (quellArt.has(id) && erwartet && quellArt.get(id) !== erwartet) {
      problems.add(`${label}: ${at}.art „${eintrag.art}“ passt nicht zur Art „${quellArt.get(id)}“ im Snapshot`);
    }
    titelPruefen(`${at}.einnahmetitel`, eintrag?.einnahmetitel);
  }
  for (const [id, eintrag] of Object.entries(overlay.instrumente ?? {})) {
    for (const [index, verweis] of (eintrag?.kernhaushaltTitel ?? []).entries()) titelPruefen(`instrumente.${id}.kernhaushaltTitel[${index}]`, verweis);
  }
  for (const [id, eintrag] of Object.entries(overlay.unternehmen ?? {})) {
    const at = `unternehmen.${id}`;
    if (!nonEmptyString(eintrag?.name)) problems.add(`${label}: ${at}.name fehlt`);
    for (const nummer of eintrag?.kapitel ?? []) if (!kapitel.has(nummer)) problems.add(`${label}: ${at}.kapitel „${nummer}“ gibt es im Snapshot nicht`);
    for (const [index, verweis] of (eintrag?.gegenbuchung ?? []).entries()) titelPruefen(`${at}.gegenbuchung[${index}]`, verweis);
    if (eintrag?.projektId !== undefined && !projekte.has(eintrag.projektId)) problems.add(`${label}: ${at}.projektId „${eintrag.projektId}“ ist kein Projekt im Snapshot`);
  }
  validateOverlayTexte({ problems, label, value: overlay });
  validateAlleRechtsbezuege({ contentRoot, problems, label, value: overlay });
}

/** Suchzuordnungen: Wörter ohne Arbeitsvermerke, jedes Ziel existiert im Snapshot bzw. Projekt-Overlay. */
function validateSuchbegriffe({ contentRoot, snapshotDirectory, periode, problems }) {
  const gelesen = readOverlay(contentRoot, periode, 'suchbegriffe.json', problems);
  if (!gelesen) return;
  const { label, overlay } = gelesen;
  if (!Array.isArray(overlay.begriffe)) {
    problems.add(`${label}: erwartet die Liste „begriffe“`);
    return;
  }
  const eps = new Set((readSnapshotJson(join(snapshotDirectory, 'einzelplaene.json'))?.einzelplaene ?? []).map((entry) => entry.ep));
  const kapitel = new Set((readSnapshotJson(join(snapshotDirectory, 'kapitel.json'))?.kapitel ?? []).map((entry) => entry.kapitel));
  const gruppen = new Set((readSnapshotJson(join(snapshotDirectory, 'gesamtplan.json'))?.gruppierung ?? []).map((entry) => entry.gruppe));
  const projektOverlay = readSnapshotJson(join(contentRoot, 'haushalt', periode, 'projekte.json'))?.projekte ?? {};
  const titel = snapshotTitel(snapshotDirectory);
  overlay.begriffe.forEach((begriff, index) => {
    const at = `begriffe[${index}]`;
    if (!Array.isArray(begriff?.woerter) || begriff.woerter.length === 0 || !begriff.woerter.every(nonEmptyString)) {
      problems.add(`${label}: ${at}.woerter muss eine Liste nicht leerer Wörter sein`);
    }
    if (!Array.isArray(begriff?.ziele) || begriff.ziele.length === 0) {
      problems.add(`${label}: ${at}.ziele fehlt`);
      return;
    }
    begriff.ziele.forEach((ziel, zielIndex) => {
      const stelle = `${at}.ziele[${zielIndex}]`;
      const schluessel = Object.keys(ziel ?? {}).sort().join('+');
      if (!['projekt', 'einzelplan', 'kapitel', 'kapitel+titel', 'gruppe', 'gruppe+kapitel'].includes(schluessel)) {
        problems.add(`${label}: ${stelle} hat keine zulässige Form (projekt, einzelplan, kapitel, kapitel+titel, gruppe, gruppe+kapitel)`);
        return;
      }
      if (ziel.projekt !== undefined && !Object.hasOwn(projektOverlay, ziel.projekt)) problems.add(`${label}: ${stelle}.projekt „${ziel.projekt}“ hat kein Projekt-Overlay`);
      if (ziel.einzelplan !== undefined && !eps.has(ziel.einzelplan)) problems.add(`${label}: ${stelle}.einzelplan „${ziel.einzelplan}“ gibt es im Snapshot nicht`);
      if (ziel.gruppe !== undefined && !gruppen.has(ziel.gruppe)) problems.add(`${label}: ${stelle}.gruppe „${ziel.gruppe}“ gibt es im Snapshot nicht`);
      for (const nummer of [ziel.kapitel].flat().filter((value) => value !== undefined)) {
        if (!kapitel.has(nummer)) problems.add(`${label}: ${stelle}.kapitel „${nummer}“ gibt es im Snapshot nicht`);
      }
      if (ziel.titel !== undefined && !titel.has(`${ziel.kapitel}/${ziel.titel}`)) problems.add(`${label}: ${stelle}: Titel ${ziel.kapitel}/${ziel.titel} gibt es im Snapshot nicht`);
    });
  });
  validateOverlayTexte({ problems, label, value: overlay });
}

/**
 * Overlays einer Periode mit Snapshot: jeder Quelltext von Rechtsgrundlage und Finanzierung ist
 * klassifiziert, jeder Einzelplan und jedes Projekt hat eine redaktionelle Fassung, Personal-,
 * Finanzierungs-, Fonds- und Suchzuordnungen verweisen nur auf Kennungen des Snapshots, und kein
 * öffentlicher Text enthält Arbeitsvermerke.
 */
export function validateSnapshotOverlays({ contentRoot, snapshotDirectory, periode, problems }) {
  validateFreitextOverlay({ contentRoot, snapshotDirectory, periode, problems });
  validateEinzelplanOverlay({ contentRoot, snapshotDirectory, periode, problems });
  validateProjektOverlay({ contentRoot, snapshotDirectory, periode, problems });
  validatePersonalOverlay({ contentRoot, snapshotDirectory, periode, problems });
  validateFinanzierungOverlay({ contentRoot, snapshotDirectory, periode, problems });
  validateFondsOverlay({ contentRoot, snapshotDirectory, periode, problems });
  validateSuchbegriffe({ contentRoot, snapshotDirectory, periode, problems });
}
