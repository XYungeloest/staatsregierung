/**
 * Schlanker Suchindex der Haushaltssuche einer Snapshot-Periode (/haushalt/<periode>/daten/suchindex.json).
 *
 * Enthält ausschließlich öffentliche Texte: Einzelplan- und Projekttitel aus den redaktionellen
 * Overlays, Bezeichnungen über `publicBezeichnung`, Projekt-Suchbegriffe über
 * `publicSuchbegriffe` und die Zuordnungen aus content/haushalt/<periode>/suchbegriffe.json.
 * Freitexte der Titel (Rechtsgrundlage, Finanzierung, Erläuterung, Vermerk) stehen nicht darin.
 * Beträge kommen unverändert aus dem Snapshot (ganze Euro). Nicht freigegebene Perioden erzeugen
 * ohne Vorschau keinen Index (`getVisibleSnapshotPeriods`).
 */
import type { APIRoute } from 'astro';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getBudgetChapterUrl,
  getBudgetPeriodPageUrl,
  getBudgetPeriodPlanUrl,
  getBudgetPeriodUrl,
  getBudgetProjectUrl,
} from '@ostrecht/shared/lib/portal/routes.ts';

import { buildHaushaltRoutes } from '../../../../lib/haushalt/inventory.ts';
import {
  PROJEKT_STATUS_LABELS,
  hasProjektseite,
  loadEinzelplanOverlays,
  loadFreitextOverlay,
  loadProjektOverlays,
  publicBezeichnung,
  publicSuchbegriffe,
} from '../../../../lib/haushalt/oeffentlich.ts';
import { getVisibleSnapshotPeriods, type Haushaltsperiode } from '../../../../lib/haushalt/perioden.ts';
import {
  loadEinzelplaene,
  loadGesamtplan,
  loadKapitel,
  loadProjekte,
  loadTitelForPlan,
  resolveHaushaltRepositoryRoot,
} from '../../../../lib/haushalt/snapshot.ts';
import type { SuchindexDatei, SuchindexTitel, Suchziel } from '../../../../scripts/haushalt-suche.ts';

export const prerender = true;

export function getStaticPaths() {
  return getVisibleSnapshotPeriods().map((periode) => ({ params: { periode: periode.id }, props: { periode } }));
}

interface Suchbegriffseintrag {
  woerter: string[];
  ziele: Array<{ projekt?: string; einzelplan?: string; kapitel?: string | string[]; titel?: string; gruppe?: string }>;
}

function ladeSuchbegriffe(periode: string): Suchbegriffseintrag[] {
  const pfad = join(resolveHaushaltRepositoryRoot(), 'content', 'haushalt', periode, 'suchbegriffe.json');
  if (!existsSync(pfad)) return [];
  const json = JSON.parse(readFileSync(pfad, 'utf8')) as { begriffe?: Suchbegriffseintrag[] };
  return json.begriffe ?? [];
}

/** Werte je Jahr in der Reihenfolge der Periodenjahre; fehlende Jahre oder Nicht-Ganzzahlen brechen ab. */
function jahresreihe<T>(jahre: string[], werte: Record<string, T> | undefined, feld: (wert: T) => number): number[] {
  return jahre.map((jahr) => {
    const wert = werte?.[jahr];
    if (wert === undefined) throw new Error(`Haushaltssuche: Jahr ${jahr} fehlt.`);
    const betrag = feld(wert);
    if (!Number.isSafeInteger(betrag)) throw new Error(`Haushaltssuche: Betrag für ${jahr} ist keine ganze Zahl.`);
    return betrag;
  });
}

const betrag = (wert: number): number => wert;

function buildSuchindex(periode: Haushaltsperiode): SuchindexDatei {
  const id = periode.id;
  const jahre = periode.jahre.map(String);
  const freitexte = loadFreitextOverlay(id);
  const planOverlays = loadEinzelplanOverlays(id);
  const projektOverlays = loadProjektOverlays(id);
  const plaene = loadEinzelplaene(id);
  const kapitel = loadKapitel(id);
  const gesamtplan = loadGesamtplan(id);

  const einzelplaene: SuchindexDatei['einzelplaene'] = plaene.map((plan) => {
    const amtlich = publicBezeichnung(plan.bezeichnung, freitexte);
    const overlay = planOverlays[plan.ep];
    const titel = overlay?.kurztitel ?? amtlich;
    return {
      n: plan.ep,
      t: titel,
      ...(amtlich !== titel ? { a: amtlich } : {}),
      ...(overlay?.kategorie ? { k: overlay.kategorie } : {}),
      u: getBudgetPeriodPlanUrl(id, plan.ep),
      x: jahresreihe(jahre, plan.jahre, (wert) => wert.ausgaben),
      e: jahresreihe(jahre, plan.jahre, (wert) => wert.einnahmen),
    };
  });

  const kapitelEintraege: SuchindexDatei['kapitel'] = kapitel.map((entry) => ({
    n: entry.kapitel,
    t: publicBezeichnung(entry.bezeichnung, freitexte),
    f: entry.funktion,
    u: getBudgetChapterUrl(id, entry.einzelplan, entry.kapitel),
    x: jahresreihe(jahre, entry.jahre, (wert) => wert.ausgaben),
    e: jahresreihe(jahre, entry.jahre, (wert) => wert.einnahmen),
  }));
  const kapitelCodes = new Set(kapitel.map((entry) => entry.kapitel));

  const gruppen: SuchindexDatei['gruppen'] = {};
  for (const zeile of gesamtplan.gruppierung) {
    gruppen[zeile.gruppe] = [publicBezeichnung(zeile.bezeichnung, freitexte), ...jahresreihe(jahre, zeile.jahre, betrag)];
  }
  const funktionen: SuchindexDatei['funktionen'] = {};
  for (const zeile of gesamtplan.funktionen) {
    funktionen[zeile.funktion] = [publicBezeichnung(zeile.bezeichnung, freitexte), ...jahresreihe(jahre, zeile.jahre, betrag)];
  }

  // Projekte: nur mit redaktionellem Overlay; Seite nur, wo eine Projektseite entsteht.
  const projekte: SuchindexDatei['projekte'] = [];
  const projektIndex = new Map<string, number>();
  for (const projekt of loadProjekte(id)) {
    const overlay = projektOverlays[projekt.id];
    if (!overlay) continue;
    const mitSeite = hasProjektseite(projekt, overlay);
    const ohneBetrag = overlay.ohneSumme === true || overlay.status === 'nicht-finanziert';
    const betraege = ohneBetrag ? null : jahresreihe(jahre, projekt.jahre, (wert) => wert.kernhaushalt);
    projektIndex.set(projekt.id, projekte.length);
    projekte.push({
      i: projekt.id,
      t: overlay.titel,
      u: mitSeite ? getBudgetProjectUrl(id, overlay.slug) : getBudgetPeriodPageUrl(id, 'projekte'),
      s: PROJEKT_STATUS_LABELS[overlay.status],
      f: overlay.fachbereich,
      ep: projekt.einzelplan,
      w: [...new Set(publicSuchbegriffe(projekt.suchbegriffe))],
      x: betraege && betraege.some((betrag) => betrag !== 0) ? betraege : null,
      ...(overlay.betragshinweis ? { h: overlay.betragshinweis } : {}),
    });
  }

  const titel: SuchindexTitel[] = [];
  const titelSchluessel = new Set<string>();
  const titelGruppen = new Map<string, Set<string>>();
  for (const plan of plaene) {
    for (const entry of loadTitelForPlan(id, plan.ep)) {
      if (!kapitelCodes.has(entry.kapitel)) throw new Error(`Haushaltssuche: Titel ${entry.konzept_id} ohne Kapitel.`);
      const zweck = publicBezeichnung(entry.zweckbestimmung ?? '', freitexte);
      const projekt = entry.projekt_id !== undefined ? projektIndex.get(entry.projekt_id) ?? -1 : -1;
      titel.push([
        entry.kapitel,
        entry.titel,
        entry.titelgruppe ?? '',
        zweck,
        entry.gruppe,
        entry.funktion ?? '',
        projekt,
        entry.seite === 'Einnahme' ? 'E' : 'A',
        ...jahresreihe(jahre, entry.jahre, (wert) => wert.betrag),
      ]);
      titelSchluessel.add(`${entry.kapitel}/${entry.titel}`);
      const kapitelDerGruppe = titelGruppen.get(entry.gruppe) ?? new Set<string>();
      kapitelDerGruppe.add(entry.kapitel);
      titelGruppen.set(entry.gruppe, kapitelDerGruppe);
    }
  }

  // Redaktionelle Zuordnungen: jedes Ziel muss im Snapshot existieren (sonst Buildabbruch).
  const synonyme: SuchindexDatei['synonyme'] = ladeSuchbegriffe(id).map((eintrag, index) => {
    const ort = `content/haushalt/${id}/suchbegriffe.json begriffe[${index}]`;
    if (!Array.isArray(eintrag.woerter) || eintrag.woerter.length === 0) throw new Error(`${ort}: woerter fehlen.`);
    if (!Array.isArray(eintrag.ziele) || eintrag.ziele.length === 0) throw new Error(`${ort}: ziele fehlen.`);
    const ziele = eintrag.ziele.map((ziel): Suchziel => {
      if (ziel.projekt !== undefined) {
        if (!projektIndex.has(ziel.projekt)) throw new Error(`${ort}: Projekt „${ziel.projekt}“ ohne öffentliche Fassung.`);
        return `p:${ziel.projekt}`;
      }
      if (ziel.einzelplan !== undefined) {
        if (!plaene.some((plan) => plan.ep === ziel.einzelplan)) throw new Error(`${ort}: Einzelplan „${ziel.einzelplan}“ fehlt.`);
        return `e:${ziel.einzelplan}`;
      }
      if (ziel.gruppe !== undefined) {
        const vorhanden = titelGruppen.get(ziel.gruppe);
        if (!vorhanden || !gruppen[ziel.gruppe]) throw new Error(`${ort}: Gruppe „${ziel.gruppe}“ ohne Titel.`);
        const eingeschraenkt = ziel.kapitel === undefined ? [] : [ziel.kapitel].flat();
        for (const code of eingeschraenkt) {
          if (!vorhanden.has(code)) throw new Error(`${ort}: Gruppe ${ziel.gruppe} kommt im Kapitel ${code} nicht vor.`);
        }
        return eingeschraenkt.length > 0 ? `g:${ziel.gruppe}@${eingeschraenkt.join(',')}` : `g:${ziel.gruppe}`;
      }
      if (typeof ziel.kapitel === 'string' && ziel.titel !== undefined) {
        if (!titelSchluessel.has(`${ziel.kapitel}/${ziel.titel}`)) throw new Error(`${ort}: Titel ${ziel.kapitel}/${ziel.titel} fehlt.`);
        return `t:${ziel.kapitel}/${ziel.titel}`;
      }
      if (typeof ziel.kapitel === 'string') {
        if (!kapitelCodes.has(ziel.kapitel)) throw new Error(`${ort}: Kapitel „${ziel.kapitel}“ fehlt.`);
        return `k:${ziel.kapitel}`;
      }
      throw new Error(`${ort}: Ziel ohne Art.`);
    });
    return { w: eintrag.woerter, z: ziele };
  });

  // Fachseiten der Periode aus dem Routeninventar (einzige Seitenliste des Portals).
  const periodeUrl = getBudgetPeriodUrl(id);
  const seiten: SuchindexDatei['seiten'] = buildHaushaltRoutes({ budgetPages: [], legacyPlans: [] })
    .filter((route) => route.path === periodeUrl || (route.path.startsWith(periodeUrl) && /^[a-z-]+\/$/u.test(route.path.slice(periodeUrl.length))))
    .map((route) => ({
      t: route.title.replace(` – ${periode.bezeichnung}`, ''),
      u: route.path,
      d: route.description,
      w: route.searchText ?? '',
    }));

  return {
    schema: 'haushalt-suchindex/1',
    periode: id,
    bezeichnung: periode.bezeichnung,
    jahre,
    einzelplaene,
    kapitel: kapitelEintraege,
    gruppen,
    funktionen,
    projekte,
    titel,
    synonyme,
    seiten,
  };
}

export const GET: APIRoute = ({ props }) => {
  const { periode } = props as { periode: Haushaltsperiode };
  return new Response(JSON.stringify(buildSuchindex(periode)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
