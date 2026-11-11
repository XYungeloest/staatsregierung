import type { PortalSectionKey } from '@ostrecht/shared/config/site.ts';
import {
  LEGACY_BUDGET_PERIOD_ID,
  getBudgetChapterUrl,
  getBudgetPageUrl,
  getBudgetPeriodPageUrl,
  getBudgetPeriodPlanUrl,
  getBudgetPeriodUrl,
  getBudgetPlanUrl,
  getBudgetProjectUrl,
  getBudgetUrl,
} from '@ostrecht/shared/lib/portal/routes.ts';

import {
  formatPeriodenjahre,
  getPeriodeStatusInfo,
  getVisiblePeriode,
  getVisibleSnapshotPeriods,
  isPreviewOnly,
  type Haushaltsperiode,
  type PeriodenOptionen,
} from './perioden.ts';
import {
  formatKapitelnummer,
  hasProjektseite,
  loadEinzelplanOverlays,
  loadFreitextOverlay,
  loadProjektOverlays,
  publicBezeichnung,
  publicSuchbegriffe,
} from './oeffentlich.ts';
import { loadEinzelplaene, loadKapitel, loadProjekte } from './snapshot.ts';

/**
 * Haushaltsrouten für das Portalinventar (apps/portal/src/lib/route-inventory.ts).
 *
 * Das Inventar ist die einzige Seitenliste für Sitemap, Serviceübersicht und Suchindex. Hier
 * entstehen die Einträge des Haushaltsbereichs, gefiltert nach der Sichtbarkeit der Perioden
 * (`perioden.ts`):
 *
 * - periodenübergreifend: /haushalt/ und die Seiten aus content/haushalt/*.json außerhalb der
 *   Periode 2025/2026 (z. B. /haushalt/sondervermoegen/);
 * - Periode 2025/2026 (bisheriger Bestand): Start, Gesamtplan, Einzelpläne und Einzelplanseiten;
 * - jede sichtbare Snapshot-Periode: Start, Gesamtplan, Einzelpläne, Einzelplan- und
 *   Kapitelseiten, Projekte und Projektseiten, Personal, Finanzierung, Rücklagen,
 *   Finanzplanung, Downloads.
 *
 * Projektseiten entstehen für Projekte mit Titelbezug oder mit einem anderen Status als
 * „nicht-finanziert“ (`hasProjektseite`); ein nicht finanziertes Projekt ohne Titel steht nur
 * in der Projektübersicht. Die Haushaltssuche (/haushalt/<periode>/suche/) und die Datenendpunkte
 * (/haushalt/<periode>/daten/…, /haushalt/daten.csv) sind Werkzeug- bzw. Datenseiten und stehen
 * nicht im Inventar.
 *
 * Seiten nur in der Vorschau sichtbarer Perioden: `sitemap: false`, `overview: false`,
 * `search: true` (der Suchindex eines Vorschau-Builds wird nie veröffentlicht).
 */

export interface HaushaltRoute {
  path: string;
  title: string;
  section: PortalSectionKey;
  description: string;
  landing?: boolean;
  overview: boolean;
  sitemap: boolean;
  search: boolean;
  lastmod?: string;
  searchText?: string;
}

/** Seiten des bisherigen Bestands (content/haushalt/*.json), wie sie loadBudgetPages() liefert. */
export interface HaushaltSeite {
  slug: string;
  title: string;
  teaser: string;
}

/** Einzelpläne 2025/2026 aus den bisherigen Haushaltsdaten. */
export interface LegacyEinzelplan {
  number: string;
  title: string;
  category: string;
  responsibility: string;
}

export interface HaushaltInventarEingaben {
  budgetPages: readonly HaushaltSeite[];
  legacyPlans: readonly LegacyEinzelplan[];
  /** Für Tests: eigenes Register, Vorschaumodus und Snapshot-Prüfung. */
  perioden?: PeriodenOptionen & { hatSnapshot?: (id: string) => boolean };
}

const LEGACY_SEARCH_TEXT: Record<string, string> = {
  gesamtplan: 'Gesamtplan Haushalt Einnahmen Ausgaben Eckwerte Kernhaushalt Hauptgruppen 2025 2026',
  einzelplaene: 'Einzelpläne Haushalt Kapitel Ressorts Ansätze 2025 2026',
  sondervermoegen: 'Sondervermögen Fonds Rücklagen Haushalt Nebenhaushalte Kooperationsfonds',
};

const LEGACY_PERIOD_PAGES = new Set(['gesamtplan', 'einzelplaene']);

function sichtbarkeit(periode: Haushaltsperiode, overview: boolean): Pick<HaushaltRoute, 'overview' | 'sitemap' | 'search'> {
  return isPreviewOnly(periode) ? { overview: false, sitemap: false, search: true } : { overview, sitemap: true, search: true };
}

function knapp(text: string, maximum = 240): string {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  if (normalized.length <= maximum) return normalized;
  const cut = normalized.slice(0, maximum);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/u, '')} …`;
}

function periodenUebergreifend(eingaben: HaushaltInventarEingaben): HaushaltRoute[] {
  return [
    {
      path: getBudgetUrl(),
      title: 'Haushalt',
      section: 'budget',
      landing: true,
      description: 'Doppelhaushalte des Freistaates mit Eckwerten, Einzelplänen, Sondervermögen und Haushaltsstand.',
      searchText: 'Haushalt Doppelhaushalt Haushaltsplan Etat Einnahmen Ausgaben Einzelpläne Sondervermögen Finanzen Kernhaushalt Haushaltsperioden',
      overview: true,
      sitemap: true,
      search: true,
    },
    ...eingaben.budgetPages
      .filter((page) => !LEGACY_PERIOD_PAGES.has(page.slug))
      .map((page): HaushaltRoute => ({
        path: getBudgetPageUrl(page.slug),
        title: page.title,
        section: 'budget',
        description: page.teaser,
        searchText: LEGACY_SEARCH_TEXT[page.slug],
        overview: true,
        sitemap: true,
        search: true,
      })),
  ];
}

function legacyPeriode(periode: Haushaltsperiode, eingaben: HaushaltInventarEingaben): HaushaltRoute[] {
  const jahre = formatPeriodenjahre(periode);
  const status = getPeriodeStatusInfo(periode, eingaben.perioden).label;
  return [
    {
      path: getBudgetPeriodUrl(periode.id),
      title: periode.bezeichnung,
      section: 'budget',
      description: `${periode.bezeichnung} (${status}): Eckwerte, Gesamtplan und Einzelpläne.`,
      searchText: `${periode.bezeichnung} Haushalt ${jahre} Eckwerte Einnahmen Ausgaben Einzelpläne Investitionen Personalausgaben`,
      ...sichtbarkeit(periode, true),
    },
    ...eingaben.budgetPages
      .filter((page) => LEGACY_PERIOD_PAGES.has(page.slug))
      .map((page): HaushaltRoute => ({
        // Gleiche Adresse wie getBudgetPageUrl(page.slug): Der Suchindex ordnet darüber den Fließtext zu.
        path: getBudgetPeriodPageUrl(periode.id, page.slug),
        title: page.title,
        section: 'budget',
        description: page.teaser,
        searchText: LEGACY_SEARCH_TEXT[page.slug],
        ...sichtbarkeit(periode, true),
      })),
    ...eingaben.legacyPlans.map((plan): HaushaltRoute => ({
      path: getBudgetPlanUrl(plan.number),
      title: `Einzelplan ${plan.number}: ${plan.title}`,
      section: 'budget',
      description: `Haushaltsansätze und Kapitel des Einzelplans ${plan.number} im ${periode.bezeichnung}.`,
      searchText: `Einzelplan ${plan.number} ${plan.title} ${plan.category} ${plan.responsibility} Haushalt ${jahre} Ansatz Kapitel`,
      ...sichtbarkeit(periode, false),
    })),
  ];
}

const SNAPSHOT_SEITEN: ReadonlyArray<{ slug: string; title: string; description: string; searchText: string }> = [
  {
    slug: 'gesamtplan',
    title: 'Gesamtplan',
    description: 'Einnahmen und Ausgaben nach Hauptgruppen, Kategorien und Aufgabenbereichen sowie die Kennzahlen des Gesamtplans.',
    searchText: 'Gesamtplan Einnahmen Ausgaben Hauptgruppen Gruppierungsplan Funktionenplan Steuern Personalausgaben Investitionen Zinsen Tilgung Rücklagen',
  },
  {
    slug: 'einzelplaene',
    title: 'Einzelpläne',
    description: 'Alle Einzelpläne mit Einnahmen, Ausgaben, Personalausgaben, Investitionen und Anteil am Gesamthaushalt.',
    searchText: 'Einzelpläne Ressorts Verwaltungsbereiche Kapitel Ansätze Anteile',
  },
  {
    slug: 'projekte',
    title: 'Vorhaben und Projekte',
    description: 'Vorhaben mit ihren Haushaltstiteln, Status und Finanzplanung als eigene Sicht auf den Haushalt.',
    searchText: 'Projekte Vorhaben Programme Investitionen Beschaffungen Status Titel',
  },
  {
    slug: 'personal',
    title: 'Personal und Versorgung',
    description: 'Personalausgaben, Planäquivalente, Versorgung und die Wirkung der Personalreform im Überblick.',
    searchText: 'Personal Personalausgaben Stellen Planäquivalente Vollzeitäquivalente Beamte Tarifbeschäftigte Versorgung Beihilfe Besoldung Personalreform',
  },
  {
    slug: 'finanzierung',
    title: 'Finanzierung und Schulden',
    description: 'Finanzierungsmaßnahmen, Kreditfinanzierungsplan und Verpflichtungsermächtigungen.',
    searchText: 'Finanzierung Finanzierungsmaßnahmen Kredit Kreditaufnahme Tilgung Nettotilgung Zinsen Schuldenstand Verpflichtungsermächtigungen',
  },
  {
    slug: 'ruecklagen',
    title: 'Rücklagen, Fonds und Landesunternehmen',
    description: 'Allgemeine Rücklage und Liquiditätsrücklage, Fonds und Sondervermögen sowie Wirtschaftspläne der Landesunternehmen.',
    searchText: 'Rücklagen Liquiditätsrücklage Fonds Sondervermögen Landesunternehmen Wirtschaftspläne Konsolidierung',
  },
  {
    slug: 'finanzplanung',
    title: 'Finanzplanung',
    description: 'Mittelfristige Finanzplanung über die Haushaltsjahre hinaus; spätere Jahre sind Planungswerte und nicht bewilligt.',
    searchText: 'Finanzplanung Finanzplan mittelfristig Projektion Planungswerte Haushaltsvolumen Schuldenstand',
  },
  {
    slug: 'downloads',
    title: 'Downloads',
    description: 'Haushaltsdaten zum Herunterladen.',
    searchText: 'Downloads Daten CSV JSON Tabellen Haushaltsdaten herunterladen',
  },
];

function snapshotPeriode(periode: Haushaltsperiode, eingaben: HaushaltInventarEingaben): HaushaltRoute[] {
  const id = periode.id;
  const jahre = formatPeriodenjahre(periode);
  const statusLabel = getPeriodeStatusInfo(periode, eingaben.perioden).label;
  const zusatz = `${periode.bezeichnung} (${statusLabel})`;
  const plaene = loadEinzelplaene(id);
  const planOverlays = loadEinzelplanOverlays(id);
  const kapitel = loadKapitel(id);
  const projekte = loadProjekte(id);
  const projektOverlays = loadProjektOverlays(id);
  const freitexte = loadFreitextOverlay(id);
  // Seitentitel nennen den redaktionellen Kurztitel; die amtliche Bezeichnung bleibt durchsuchbar.
  const planNamen = new Map(
    plaene.map((plan) => [plan.ep, planOverlays[plan.ep]?.kurztitel ?? publicBezeichnung(plan.bezeichnung, freitexte)]),
  );

  const routes: HaushaltRoute[] = [
    {
      path: getBudgetPeriodUrl(id),
      title: periode.bezeichnung,
      section: 'budget',
      description: `${zusatz}: Eckwerte, Einzelpläne, Vorhaben und Finanzplanung.`,
      searchText: `${periode.bezeichnung} Haushalt ${jahre} ${statusLabel} Eckwerte Einnahmen Ausgaben Haushaltsvolumen`,
      ...sichtbarkeit(periode, true),
    },
    ...SNAPSHOT_SEITEN.map((seite): HaushaltRoute => ({
      path: getBudgetPeriodPageUrl(id, seite.slug),
      title: `${seite.title} – ${periode.bezeichnung}`,
      section: 'budget',
      description: `${seite.description} ${zusatz}.`,
      searchText: `${seite.searchText} ${jahre}`,
      ...sichtbarkeit(periode, true),
    })),
    ...plaene.map((plan): HaushaltRoute => {
      const overlay = planOverlays[plan.ep];
      const amtlich = publicBezeichnung(plan.bezeichnung, freitexte);
      const kapitelNamen = kapitel
        .filter((entry) => entry.einzelplan === plan.ep)
        .map((entry) => publicBezeichnung(entry.bezeichnung, freitexte));
      return {
        path: getBudgetPeriodPlanUrl(id, plan.ep),
        title: `Einzelplan ${plan.ep}: ${planNamen.get(plan.ep) ?? amtlich}`,
        section: 'budget',
        description: overlay ? knapp(overlay.beschreibung) : `Einnahmen, Ausgaben und Kapitel des Einzelplans ${plan.ep} im ${zusatz}.`,
        searchText: knapp(
          [...new Set([`Einzelplan ${plan.ep}`, overlay?.kurztitel, amtlich, overlay?.kategorie, jahre, ...kapitelNamen].filter(Boolean))].join(' '),
          600,
        ),
        ...sichtbarkeit(periode, false),
      };
    }),
    ...kapitel.map((entry): HaushaltRoute => {
      const nummer = formatKapitelnummer(entry.kapitel);
      const bezeichnung = publicBezeichnung(entry.bezeichnung, freitexte);
      return {
        path: getBudgetChapterUrl(id, entry.einzelplan, entry.kapitel),
        title: `Kapitel ${nummer}: ${bezeichnung}`,
        section: 'budget',
        description: `Titel und Ansätze des Kapitels ${nummer} im Einzelplan ${entry.einzelplan} (${planNamen.get(entry.einzelplan) ?? ''}), ${zusatz}.`,
        // Knapp: Nummer in beiden Schreibweisen und Bezeichnung; die Titel durchsucht die Haushaltssuche.
        searchText: `Kapitel ${entry.kapitel} ${nummer} ${bezeichnung} ${jahre}`,
        ...sichtbarkeit(periode, false),
      };
    }),
    ...projekte.flatMap((projekt): HaushaltRoute[] => {
      const overlay = projektOverlays[projekt.id];
      if (!overlay || !hasProjektseite(projekt, overlay)) return [];
      return [
        {
          path: getBudgetProjectUrl(id, overlay.slug),
          title: overlay.titel,
          section: 'budget',
          description: knapp(overlay.beschreibung),
          searchText: knapp(
            [overlay.titel, overlay.fachbereich, 'Vorhaben', jahre, ...publicSuchbegriffe(projekt.suchbegriffe)].join(' '),
            400,
          ),
          ...sichtbarkeit(periode, false),
        },
      ];
    }),
  ];
  return routes;
}

/**
 * Alle Haushaltsrouten des aktuellen Builds. Nicht sichtbare Perioden tragen nichts bei; dieselbe
 * Liste steuert Sitemap, Übersicht und Suchindex.
 */
export function buildHaushaltRoutes(eingaben: HaushaltInventarEingaben): HaushaltRoute[] {
  const routes = [...periodenUebergreifend(eingaben)];
  const legacy = getVisiblePeriode(LEGACY_BUDGET_PERIOD_ID, eingaben.perioden);
  if (legacy && legacy.datenquelle === 'legacy-2025-2026') routes.push(...legacyPeriode(legacy, eingaben));
  for (const periode of getVisibleSnapshotPeriods(eingaben.perioden)) routes.push(...snapshotPeriode(periode, eingaben));
  const seen = new Set<string>();
  for (const route of routes) {
    if (seen.has(route.path)) throw new Error(`Haushaltsinventar: Adresse ${route.path} doppelt.`);
    seen.add(route.path);
  }
  return routes;
}
