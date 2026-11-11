import {
  isLawSite,
  lawPaths,
  portalPaths,
  siteUrls,
  type LawSitePathKey,
  type SitePathKey,
} from '@ostrecht/shared/config/site-routing.ts';

const base = import.meta.env?.BASE_URL ?? '/';
const specialProtocolPattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/iu;

export function withBase(path: string): string {
  if (base === '/') {
    return path;
  }

  return `${base}${path.replace(/^\//, '')}`;
}

function absoluteUrl(origin: string, path: string): string {
  return new URL(path, `${origin}/`).toString();
}

export function getPortalUrl(path: string): string {
  return isLawSite ? absoluteUrl(siteUrls.portal, path) : withBase(path);
}

export function getLawUrl(path: string): string {
  return isLawSite ? withBase(path) : absoluteUrl(siteUrls.law, path);
}

export function resolvePortalPath(path: string): string {
  if (!path || specialProtocolPattern.test(path) || !path.startsWith('/')) {
    return path;
  }

  if (path.startsWith('/recht/') && path !== portalPaths.lawBridge) {
    return getLawUrl(path.slice('/recht'.length));
  }

  return getPortalUrl(path);
}

export function getSiteUrl(pathKey: SitePathKey): string {
  return getPortalUrl(portalPaths[pathKey]);
}

export function getLawSiteUrl(pathKey: LawSitePathKey): string {
  return getLawUrl(lawPaths[pathKey]);
}

export function getHomeUrl(): string {
  return getSiteUrl('home');
}

export function getPortalSearchUrl(): string {
  return getSiteUrl('search');
}

export function getGovernmentUrl(): string {
  return getSiteUrl('government');
}

export function getGovernmentMembersUrl(): string {
  return getSiteUrl('governmentMembers');
}

export function getGovernmentMemberUrl(slug: string): string {
  return getPortalUrl(`${portalPaths.governmentMembers}${slug}/`);
}

export function getMinisterPresidentUrl(): string {
  return getSiteUrl('ministerPresident');
}

export function getCabinetUrl(): string {
  return getSiteUrl('cabinet');
}

export function getHoldingsUrl(): string {
  return getSiteUrl('holdings');
}

export function getPreviousCabinetsUrl(): string {
  return getSiteUrl('previousCabinets');
}

export function getCoalitionUrl(): string {
  return getSiteUrl('coalition');
}

export function getActionPlanUrl(): string {
  return getSiteUrl('actionPlan');
}

export function getKreisreformUrl(): string {
  return getSiteUrl('kreisreform');
}

export function getMinistriesUrl(): string {
  return getCabinetUrl();
}

export function getMinistryUrl(slug: string): string {
  return getPortalUrl(`${portalPaths.cabinet}${slug}/`);
}

export function getTopicsUrl(): string {
  return getSiteUrl('topics');
}

export function getTopicUrl(slug: string): string {
  return getPortalUrl(`${portalPaths.topics}${slug}/`);
}

export function getEducationAndSchoolUrl(): string {
  return getSiteUrl('educationAndSchool');
}

export function getSchoolSystemUrl(): string {
  return getSiteUrl('schoolSystem');
}

export function getPressUrl(): string {
  return getSiteUrl('press');
}

export function getPressReleaseIndexUrl(): string {
  return getSiteUrl('pressReleases');
}

export function getPressReleaseUrl(slug: string): string {
  return getPortalUrl(`${portalPaths.pressReleases}${slug}/`);
}

export function getSpeechIndexUrl(): string {
  return getSiteUrl('pressSpeeches');
}

export function getSpeechUrl(slug: string): string {
  return getPortalUrl(`${portalPaths.pressSpeeches}${slug}/`);
}

export function getEventIndexUrl(): string {
  return getSiteUrl('pressDates');
}

export function getEventUrl(slug: string): string {
  return getPortalUrl(`${portalPaths.pressDates}${slug}/`);
}

/**
 * Haushaltsperiode, deren Seiten aus dem bisherigen Datenbestand stammen. Ihre Gesamtplan- und
 * Einzelplanseiten liegen unter /haushalt/2025-2026/; die früheren Adressen ohne Periode leiten
 * dorthin weiter.
 */
export const LEGACY_BUDGET_PERIOD_ID = '2025-2026';

/** Seiten des bisherigen Bestands, die zur Periode 2025/2026 gehören (alle übrigen bleiben periodenübergreifend). */
const LEGACY_BUDGET_PERIOD_PAGES = new Set(['gesamtplan', 'einzelplaene']);

const BUDGET_PERIOD_PATTERN = /^\d{4}-\d{4}$/u;
const BUDGET_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;
const BUDGET_DATA_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

function budgetPeriodPath(periodId: string): string {
  if (!BUDGET_PERIOD_PATTERN.test(periodId)) {
    throw new Error(`Ungültige Haushaltsperiode „${periodId}“ (erwartet JJJJ-JJJJ).`);
  }
  return `${portalPaths.budget}${periodId}/`;
}

function budgetSegment(value: string, label: string): string {
  if (!BUDGET_SEGMENT_PATTERN.test(value)) throw new Error(`Ungültige ${label} „${value}“.`);
  return value;
}

function budgetCode(value: string, length: number, label: string): string {
  const code = value.padStart(length, '0');
  if (!new RegExp(`^\\d{${length}}$`, 'u').test(code)) throw new Error(`Ungültige ${label} „${value}“.`);
  return code;
}

/** Einstieg des Haushaltsbereichs (/haushalt/). */
export function getBudgetUrl(): string {
  return getSiteUrl('budget');
}

/**
 * Seite des Haushaltsbereichs. „gesamtplan“ und „einzelplaene“ gehören zur Periode 2025/2026
 * (/haushalt/2025-2026/…/); alle übrigen (z. B. „sondervermoegen“) bleiben periodenübergreifend
 * unter /haushalt/<slug>/.
 */
export function getBudgetPageUrl(slug: string): string {
  if (LEGACY_BUDGET_PERIOD_PAGES.has(slug)) return getBudgetPeriodPageUrl(LEGACY_BUDGET_PERIOD_ID, slug);
  return getPortalUrl(`${portalPaths.budget}${slug}/`);
}

/** Einzelplanseite des Doppelhaushalts 2025/2026 (/haushalt/2025-2026/einzelplaene/<nr>/). */
export function getBudgetPlanUrl(planNumber: string): string {
  return getBudgetPeriodPlanUrl(LEGACY_BUDGET_PERIOD_ID, planNumber);
}

/** Periodenstart, z. B. /haushalt/2027-2028/. */
export function getBudgetPeriodUrl(periodId: string): string {
  return getPortalUrl(budgetPeriodPath(periodId));
}

/** Unterseite einer Periode, z. B. getBudgetPeriodPageUrl('2027-2028', 'gesamtplan'). */
export function getBudgetPeriodPageUrl(periodId: string, slug: string): string {
  return getPortalUrl(`${budgetPeriodPath(periodId)}${budgetSegment(slug, 'Haushaltsseite')}/`);
}

/** Einzelplanseite einer Periode; die Nummer wird zweistellig geführt. */
export function getBudgetPeriodPlanUrl(periodId: string, planNumber: string): string {
  return getPortalUrl(`${budgetPeriodPath(periodId)}einzelplaene/${budgetCode(planNumber, 2, 'Einzelplannummer')}/`);
}

/** Kapitelseite: /haushalt/<periode>/einzelplaene/<ep>/kapitel/<kapitel>/. */
export function getBudgetChapterUrl(periodId: string, planNumber: string, chapter: string): string {
  const plan = budgetCode(planNumber, 2, 'Einzelplannummer');
  const code = budgetCode(chapter, 4, 'Kapitelnummer');
  if (!code.startsWith(plan)) throw new Error(`Kapitel ${code} gehört nicht zum Einzelplan ${plan}.`);
  return getPortalUrl(`${budgetPeriodPath(periodId)}einzelplaene/${plan}/kapitel/${code}/`);
}

/** Anker eines Titels auf seiner Kapitelseite (je Kapitel eindeutig), z. B. „titel-63361“. */
export function getBudgetTitleAnchor(title: string): string {
  return `titel-${budgetCode(title, 5, 'Titelnummer')}`;
}

/** Titel auf seiner Kapitelseite: Kapitel-URL mit Anker #titel-<titelnummer>. */
export function getBudgetTitleUrl(periodId: string, planNumber: string, chapter: string, title: string): string {
  return `${getBudgetChapterUrl(periodId, planNumber, chapter)}#${getBudgetTitleAnchor(title)}`;
}

/** Projektseite: /haushalt/<periode>/projekte/<slug>/. */
export function getBudgetProjectUrl(periodId: string, slug: string): string {
  return getPortalUrl(`${budgetPeriodPath(periodId)}projekte/${budgetSegment(slug, 'Projektadresse')}/`);
}

/** Datendatei einer Periode ohne abschließenden Schrägstrich, z. B. …/daten/titel.csv. */
export function getBudgetDataUrl(periodId: string, fileName: string): string {
  if (!BUDGET_DATA_FILE_PATTERN.test(fileName)) throw new Error(`Ungültiger Dateiname „${fileName}“.`);
  return getPortalUrl(`${budgetPeriodPath(periodId)}daten/${fileName}`);
}

/** Haushaltssuche einer Periode, optional mit Suchbegriff (?q=…). */
export function getBudgetSearchUrl(periodId: string, query?: string): string {
  const url = getPortalUrl(`${budgetPeriodPath(periodId)}suche/`);
  const term = query?.trim();
  return term ? `${url}?q=${encodeURIComponent(term)}` : url;
}

export function getFreestateUrl(): string {
  return getSiteUrl('freestate');
}

export function getFreestatePageUrl(slug: string): string {
  return getPortalUrl(`${portalPaths.freestate}${slug}/`);
}

export function getServiceUrl(): string {
  return getSiteUrl('service');
}

export function getCareerUrl(): string {
  return getSiteUrl('career');
}

export function getServiceOverviewUrl(): string {
  return getSiteUrl('serviceOverview');
}

export function getJobUrl(slug: string): string {
  return getPortalUrl(`${portalPaths.career}${slug}/`);
}

export function getContactUrl(): string {
  return getSiteUrl('contact');
}

export function getFaqUrl(): string {
  return getSiteUrl('faq');
}

export function getImprintUrl(): string {
  return getSiteUrl('imprint');
}

export function getPrivacyUrl(): string {
  return getSiteUrl('privacy');
}

export function getAccessibilityUrl(): string {
  return getSiteUrl('accessibility');
}

export function getLawHomeUrl(): string {
  return getLawSiteUrl('home');
}

export function getLawBridgeUrl(): string {
  return getSiteUrl('lawBridge');
}

export function getLawSearchUrl(): string {
  return getLawSiteUrl('search');
}

export function getLawIndexUrl(): string {
  return getLawSiteUrl('index');
}

export function getLawSubjectsUrl(): string {
  return getLawSiteUrl('subjects');
}

export function getLawFundingUrl(): string {
  return getLawSiteUrl('funding');
}

export function getLawPublicationsUrl(): string {
  return getLawSiteUrl('publications');
}

export function getLawConstitutionUrl(): string {
  return getLawSiteUrl('constitution');
}

export function getLawHelpUrl(): string {
  return getLawSiteUrl('help');
}

export function getEasyLanguageUrl(): string {
  return getSiteUrl('easyLanguage');
}

export function getSignLanguageUrl(): string {
  return getSiteUrl('signLanguage');
}

export function getPublicationsUrl(): string {
  return getSiteUrl('publications');
}
