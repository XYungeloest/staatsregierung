import { siteConfig, type PortalSectionKey } from '@ostrecht/shared/config/site.ts';
import {
  loadBudgetPages,
  loadEvents,
  loadFreestatePages,
  loadGovernmentMembers,
  loadJobOffers,
  loadMinistries,
  loadPressReleases,
  loadSpeeches,
  loadTopics,
} from '@ostrecht/shared/lib/portal/content.ts';
import {
  getAccessibilityUrl,
  getActionPlanUrl,
  getBudgetPageUrl,
  getBudgetPlanUrl,
  getBudgetUrl,
  getCabinetUrl,
  getCareerUrl,
  getContactUrl,
  getCoalitionUrl,
  getEasyLanguageUrl,
  getEducationAndSchoolUrl,
  getEventIndexUrl,
  getEventUrl,
  getFaqUrl,
  getFreestatePageUrl,
  getFreestateUrl,
  getGovernmentMemberUrl,
  getGovernmentMembersUrl,
  getGovernmentUrl,
  getHoldingsUrl,
  getHomeUrl,
  getImprintUrl,
  getJobUrl,
  getKreisreformUrl,
  getLawBridgeUrl,
  getMinisterPresidentUrl,
  getMinistryUrl,
  getPortalSearchUrl,
  getPressReleaseIndexUrl,
  getPressReleaseUrl,
  getPressUrl,
  getPreviousCabinetsUrl,
  getPrivacyUrl,
  getPublicationsUrl,
  getServiceOverviewUrl,
  getServiceUrl,
  getSchoolSystemUrl,
  getSignLanguageUrl,
  getSpeechIndexUrl,
  getSpeechUrl,
  getTopicUrl,
  getTopicsUrl,
} from '@ostrecht/shared/lib/portal/routes.ts';
import { budgetPlans } from '../data/haushalt.ts';

/**
 * Ein Eintrag des Portalinventars.
 *
 * `overview` steuert die Serviceübersicht, `sitemap` die `sitemap.xml`, `search` den Suchindex.
 * Werkzeugseiten (Suche, Fehlerseiten, Datenendpunkte) stehen nicht im Inventar; alles andere
 * steht genau einmal darin.
 */
export interface PortalRoute {
  path: string;
  title: string;
  section: PortalSectionKey;
  description: string;
  /** Einstieg eines Bereichs: steht in der Übersicht an erster Stelle seiner Gruppe. */
  landing?: boolean;
  overview: boolean;
  sitemap: boolean;
  search: boolean;
  lastmod?: string;
  /** Zusätzliche Suchwörter der statischen Seiten (Volltext liefern die Inhaltsquellen). */
  searchText?: string;
}

type StaticRoute = Omit<PortalRoute, 'overview' | 'sitemap' | 'search'> &
  Partial<Pick<PortalRoute, 'overview' | 'sitemap' | 'search'>>;

/**
 * Statische Seiten des Staatsportals mit ihrer Bereichszuordnung. Diese Liste ist die einzige
 * Stelle, an der eine Portalseite „existiert“: `sitemap.xml`, die Serviceübersicht und der
 * Suchindex lesen sie, statt je eigene Listen zu führen (Befund H1 der Designprüfung).
 */
function staticRoutes(): StaticRoute[] {
  return [
    {
      path: getHomeUrl(),
      title: 'Startseite',
      section: 'home',
      landing: true,
      description: 'Einstieg in das Staatsportal mit Suche, Portalwegen und aktuellem Regierungshandeln.',
      searchText: 'Startseite Portal Einstieg Übersicht Freistaat Ostdeutschland Staatsrat',
      overview: false,
    },

    {
      path: getFreestateUrl(),
      title: 'Über den Freistaat',
      section: 'freestate',
      landing: true,
      description: 'Staatsaufbau, Bezirke, Hoheitszeichen, Verfassung und Geschichte des Freistaates.',
      searchText: 'Freistaat Ostdeutschland Staatsaufbau Bezirke Hoheitszeichen Verfassung Staatsziele Geschichte Hauptstadt Land und Leute',
    },

    {
      path: getGovernmentUrl(),
      title: 'Staatsrat',
      section: 'government',
      landing: true,
      description: 'Der Staatsrat als Spitze der vollziehenden Gewalt: Mitglieder, Geschäftsbereiche und Vorhaben.',
      searchText: 'Staatsrat Staatsregierung Regierung Exekutive Staatspräsident Kabinett Geschäftsbereiche Regierungshandeln',
    },
    {
      path: getGovernmentMembersUrl(),
      title: 'Mitglieder des Staatsrates',
      section: 'government',
      description: 'Alle Mitglieder des Staatsrates mit Amt, Geschäftsbereich und Zuständigkeit.',
      searchText: 'Mitglieder Staatsrat Staatsräte Ämter Zuständigkeit Ressort Personen',
    },
    {
      path: getMinisterPresidentUrl(),
      title: 'Staatspräsident',
      section: 'government',
      description: 'Amt, Aufgaben und Richtlinienkompetenz des Staatspräsidenten.',
      searchText: 'Staatspräsident Regierungschef Richtlinien der Regierungspolitik Vorsitz Staatsrat',
    },
    {
      path: getCabinetUrl(),
      title: 'Erster Staatsrat',
      section: 'government',
      description: 'Die Staatssekretariate des Ersten Staatsrates mit Leitung und Aufgaben.',
      searchText: 'Kabinett Staatssekretariate Ressorts Geschäftsbereiche Leitung Aufgaben Erster Staatsrat',
    },
    {
      path: getHoldingsUrl(),
      title: 'Beteiligungsnavigator',
      section: 'government',
      description: 'Unmittelbare und mittelbare Beteiligungen des Freistaates mit Anteilen und Stand.',
      searchText: 'Beteiligungen Beteiligungsnavigator Unternehmen Anteile Gemeineigentum Sondervermögen Träger',
    },
    {
      path: getCoalitionUrl(),
      title: 'Koalition',
      section: 'government',
      description: 'Grundlagen und Vorhaben der tragenden Koalition.',
      searchText: 'Koalition Koalitionsvertrag Regierungsbündnis Fraktionen Vorhaben',
    },
    {
      path: getActionPlanUrl(),
      title: '15-Punkte-Plan II',
      section: 'government',
      description: 'Umsetzungsstand der fünfzehn Vorhaben des Regierungsprogramms.',
      searchText: '15-Punkte-Plan Regierungsprogramm Vorhaben Umsetzung Fortschritt Maßnahmen',
    },
    {
      path: getPreviousCabinetsUrl(),
      title: 'Frühere Kabinette',
      section: 'government',
      description: 'Übersicht der früheren Kabinette des Freistaates.',
      searchText: 'Frühere Kabinette Regierungsarchiv Honecker historische Regierungen',
    },
    {
      path: `${getPreviousCabinetsUrl()}honecker-i/`,
      title: 'Kabinett Honecker I',
      section: 'government',
      description: 'Zusammensetzung und Geschäftsbereiche des Kabinetts Honecker I.',
      searchText: 'Kabinett Honecker I Regierungsarchiv frühere Ressorts',
      overview: false,
    },

    {
      path: getTopicsUrl(),
      title: 'Themen & Projekte',
      section: 'topics',
      landing: true,
      description: 'Alle Vorhaben des Freistaates nach Fachgebiet, mit Status, Zuständigkeit und Rechtsgrundlagen.',
      searchText: 'Themen Projekte Vorhaben Reformen Politikfelder Umsetzungsstand Zuständigkeit',
    },
    {
      path: getEducationAndSchoolUrl(),
      title: 'Bildung und Schule',
      section: 'topics',
      description: 'Einstieg zu Schule, Bildungswegen, Zuständigkeiten und Rechtsgrundlagen.',
      searchText: 'Bildung Schule Schulsystem Schularten Bildungswege Abschlüsse zuständige Stelle Volksbildung Wissenschaft',
    },
    {
      path: getSchoolSystemUrl(),
      title: 'Schulsystem des Ostdeutschen Freistaates',
      section: 'topics',
      description:
        'POS von Klasse 1 bis 10, EOS in den Jahrgangsstufen 11 und 12 sowie berufliche und zweite Bildungswege.',
      searchText:
        'Schule Schulsystem Bildung Polytechnische Oberschule POS Erweiterte Oberschule EOS Primarstufe Sekundarstufe Förderschule Berufsschule Berufsfachschule Fachoberschule Berufliches Gymnasium Fachschule Hochschulreife Berufsausbildung Zweiter Bildungsweg Abendoberschule Abendgymnasium Kolleg Studienqualifizierung Fachhochschulreife Realschulabschluss Hauptschulabschluss Ethik Religion Weltanschauung Produktives Lernen Bildungsreform',
    },

    {
      path: getKreisreformUrl(),
      title: 'Kreis- und Bezirksreform 2026',
      section: 'kreisreform',
      landing: true,
      description: 'Gemeinden, Kreise und Bezirke in der neuen Verwaltungsgliederung suchen und vergleichen.',
      searchText:
        'Kreisreform Gebietsreform Bezirksreform Gemeinde suchen neuer Kreis neuer Bezirk Kreis- und Bezirksneuordnung Verwaltungsgliederung Gesetzgebungsverfahren 2026',
    },

    {
      path: getBudgetUrl(),
      title: 'Doppelhaushalt 2025/2026',
      section: 'budget',
      landing: true,
      description: 'Eckwerte, Einzelpläne und Sondervermögen des Doppelhaushalts 2025/2026.',
      searchText: 'Haushalt Doppelhaushalt Etat Einnahmen Ausgaben Einzelpläne Sondervermögen Finanzen Haushaltsplan Kernhaushalt',
    },

    {
      path: getPressUrl(),
      title: 'Presse & Aktuelles',
      section: 'press',
      landing: true,
      description: 'Pressemitteilungen, Reden und Termine des Staatsrates.',
      searchText: 'Presse Aktuelles Pressemitteilungen Reden Erklärungen Termine Pressestelle',
    },
    {
      path: getPressReleaseIndexUrl(),
      title: 'Pressemitteilungen',
      section: 'press',
      description: 'Alle Pressemitteilungen des Staatsrates nach Datum.',
      searchText: 'Pressemitteilungen Mitteilungen Presseinformationen Meldungen',
    },
    {
      path: getSpeechIndexUrl(),
      title: 'Reden & Erklärungen',
      section: 'press',
      description: 'Regierungserklärungen und Reden in der Volkskammer.',
      searchText: 'Reden Erklärungen Regierungserklärung Volkskammer Plenum Rednerin Redner',
    },
    {
      path: getEventIndexUrl(),
      title: 'Termine',
      section: 'press',
      description: 'Anstehende und vergangene Termine des Staatsrates.',
      searchText: 'Termine Kalender Sitzungen Veranstaltungen Pressekonferenz',
    },

    {
      path: getLawBridgeUrl(),
      title: 'Recht und Gesetzgebung',
      section: 'law',
      landing: true,
      description: 'Brücke zum Rechtsportal OstRecht mit Vorschriften, Verkündungen und Sachgebieten.',
      searchText: 'Recht Gesetze Verordnungen Verwaltungsvorschriften Rechtsportal OstRecht Verkündungen Sachgebiete Rechtsvorschriften Gesetzgebung',
    },

    {
      path: getServiceUrl(),
      title: 'Service',
      section: 'service',
      landing: true,
      description: 'Kontakt, Karriere, Hilfe und barrierearme Zugänge des Staatsportals.',
      searchText: 'Service Kontakt Karriere Hilfe FAQ Barrierefreiheit Leichte Sprache Gebärdensprache',
    },
    {
      path: getServiceOverviewUrl(),
      title: 'Übersicht',
      section: 'service',
      description: 'Alle Seiten des Staatsportals nach Bereichen geordnet.',
      searchText: 'Übersicht Seitenübersicht Sitemap alle Seiten Inhaltsverzeichnis',
    },
    {
      path: getCareerUrl(),
      title: 'Karriere',
      section: 'service',
      description: 'Stellenangebote und Rahmenbedingungen für die Arbeit im öffentlichen Dienst.',
      searchText: 'Karriere Stellen Stellenangebote Bewerbung Ausbildung öffentlicher Dienst Arbeitgeber',
    },
    {
      path: getContactUrl(),
      title: 'Kontakt',
      section: 'service',
      description: 'Zentrale Kontaktwege, Behördennummer und Zuständigkeitswegweiser.',
      searchText: 'Kontakt Anschrift Telefon E-Mail Bürgertelefon Behördennummer 115 Zuständigkeit',
    },
    {
      path: getFaqUrl(),
      title: 'FAQ',
      section: 'service',
      description: 'Häufige Fragen zur Nutzung des Staatsportals und des Rechtsportals.',
      searchText: 'FAQ häufige Fragen Antworten Hilfe Nutzung',
    },
    {
      path: getPublicationsUrl(),
      title: 'Publikationen und Downloads',
      section: 'service',
      description: 'Verkündungen, Presseformate und zentrale Downloadangebote.',
      searchText: 'Publikationen Downloads Verkündungen Presse RSS Kalender Broschüren',
    },
    {
      path: getEasyLanguageUrl(),
      title: 'Leichte Sprache',
      section: 'service',
      description: 'Kurze Orientierung zu den wichtigsten Portalbereichen in Leichter Sprache.',
      searchText: 'Leichte Sprache einfache Sprache Orientierung Staatsrat Themen Recht Kontakt',
    },
    {
      path: getSignLanguageUrl(),
      title: 'Hinweis zu Gebärdensprache',
      section: 'service',
      description: 'Informationen zum derzeitigen Angebot in Gebärdensprache und zu alternativen Zugängen.',
      searchText: 'Gebärdensprache Video Gebärdenvideo Barrierefreiheit Kontakt',
    },
    {
      path: getAccessibilityUrl(),
      title: 'Barrierefreiheit',
      section: 'service',
      description: 'Stand der Barrierefreiheit, bekannte Einschränkungen und Feedbackweg.',
      searchText: 'Barrierefreiheit Erklärung Zugänglichkeit Feedback Schlichtung Einschränkungen',
    },
    {
      path: getImprintUrl(),
      title: 'Impressum',
      section: 'service',
      description: 'Verantwortlichkeiten und Angaben zum Staatsportal.',
      searchText: 'Impressum Anbieter Verantwortlich Herausgeber Angaben',
    },
    {
      path: getPrivacyUrl(),
      title: 'Datenschutz',
      section: 'service',
      description: 'Datenschutzhinweise zur Webanalyse und zu den Kontaktwegen.',
      searchText: 'Datenschutz Datenschutzerklärung Webanalyse Einwilligung Rechte der betroffenen Personen',
    },
  ];
}

const BUDGET_PAGE_SEARCH_TEXT: Record<string, string> = {
  gesamtplan: 'Gesamtplan Haushalt Einnahmen Ausgaben Eckwerte Kernhaushalt',
  einzelplaene: 'Einzelpläne Haushalt Kapitel Ressorts Ansätze',
  sondervermoegen: 'Sondervermögen Fonds Rücklagen Haushalt Nebenhaushalte',
};

/**
 * Vollständiges Inventar der öffentlichen Portalseiten: statische Einstiege und die aus den
 * Inhaltsquellen abgeleiteten Detailseiten. Sortiert nach Bereich und Adresse.
 */
export async function buildPortalRouteInventory(): Promise<PortalRoute[]> {
  const [members, ministries, topics, pressReleases, speeches, events, budgetPages, freestatePages, jobOffers] =
    await Promise.all([
      loadGovernmentMembers(),
      loadMinistries(),
      loadTopics(),
      loadPressReleases(),
      loadSpeeches(),
      loadEvents(),
      loadBudgetPages(),
      loadFreestatePages(),
      loadJobOffers(),
    ]);

  const dynamic: StaticRoute[] = [
    ...freestatePages.map((page) => ({
      path: getFreestatePageUrl(page.slug),
      title: page.title,
      section: 'freestate' as const,
      description: page.body[0] ?? '',
      overview: false,
    })),
    ...members.map((member) => ({
      path: getGovernmentMemberUrl(member.slug),
      title: member.name,
      section: 'government' as const,
      description:
        member.currentOffices.length > 0
          ? member.currentOffices.map((office) => office.title).join('; ')
          : member.amt,
      overview: false,
    })),
    ...ministries.map((ministry) => ({
      path: getMinistryUrl(ministry.slug),
      title: ministry.name,
      section: 'government' as const,
      description: ministry.teaser,
      overview: false,
    })),
    ...topics.map((topic) => ({
      path: getTopicUrl(topic.slug),
      title: topic.title,
      section: 'topics' as const,
      description: topic.teaser,
      overview: false,
      lastmod: topic.updatedAt,
    })),
    ...budgetPages.map((page) => ({
      path: getBudgetPageUrl(page.slug),
      title: page.title,
      section: 'budget' as const,
      description: page.teaser,
      searchText: BUDGET_PAGE_SEARCH_TEXT[page.slug],
    })),
    ...budgetPlans.map((plan) => ({
      path: getBudgetPlanUrl(plan.number),
      title: `Einzelplan ${plan.number}: ${plan.title}`,
      section: 'budget' as const,
      description: `Haushaltsansätze und Kapitel des Einzelplans ${plan.number} im Doppelhaushalt 2025/2026.`,
      searchText: `Einzelplan ${plan.number} ${plan.title} ${plan.category} ${plan.responsibility} Haushalt Ansatz Kapitel`,
      overview: false,
    })),
    ...pressReleases.map((entry) => ({
      path: getPressReleaseUrl(entry.slug),
      title: entry.title,
      section: 'press' as const,
      description: entry.teaser,
      overview: false,
      lastmod: entry.date,
    })),
    ...speeches.map((entry) => ({
      path: getSpeechUrl(entry.slug),
      title: entry.title,
      section: 'press' as const,
      description: entry.teaser,
      overview: false,
      lastmod: entry.date,
    })),
    ...events.map((entry) => ({
      path: getEventUrl(entry.slug),
      title: entry.title,
      section: 'press' as const,
      description: entry.teaser,
      overview: false,
      lastmod: entry.date,
    })),
    ...jobOffers.map((entry) => ({
      path: getJobUrl(entry.slug),
      title: entry.title,
      section: 'service' as const,
      description: entry.teaser,
      overview: false,
      lastmod: entry.datePosted,
    })),
  ];

  const order = new Map(siteConfig.sections.map((section, index) => [section.key, index]));
  const routes = [...staticRoutes(), ...dynamic].map((route): PortalRoute => ({
    overview: true,
    sitemap: true,
    search: true,
    ...route,
  }));

  return routes.sort(
    (left, right) =>
      (order.get(left.section) ?? 0) - (order.get(right.section) ?? 0) ||
      Number(Boolean(right.landing)) - Number(Boolean(left.landing)) ||
      left.path.localeCompare(right.path, 'de'),
  );
}

/** Inventar nach Bereichen gruppiert, in der Reihenfolge der Bereichsliste. */
export function groupRoutesBySection(routes: PortalRoute[]): Array<{
  key: PortalSectionKey;
  label: string;
  path: string;
  description: string;
  routes: PortalRoute[];
}> {
  return siteConfig.sections
    .map((section) => ({
      key: section.key,
      label: section.label,
      path: section.path,
      description: section.description,
      routes: routes.filter((route) => route.section === section.key),
    }))
    .filter((group) => group.routes.length > 0);
}

/** Werkzeugseiten ohne Inhaltscharakter; sie stehen bewusst in keiner Übersicht. */
export const PORTAL_UTILITY_PATHS = [getPortalSearchUrl(), '/404/', '/500/'] as const;
