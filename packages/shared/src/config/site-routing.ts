/**
 * Grundlagen der Adressbildung beider Websites: Origins aus der Build-Umgebung, Zielsite und
 * die Pfadtabellen des Staatsportals und von OstRecht. Teil der D1-Projektion (Code-Abschluss
 * von scripts/sync-recht-d1.mjs über portal/routes.ts und norms/routes.ts): die Routenhelfer
 * schreiben Adressen in Suchdokumente und abgeleitete Daten. Öffentliche Bezeichnungen,
 * Navigation, Kontakt und SEO stehen in site.ts außerhalb des Abschlusses; dieses Modul
 * importiert site.ts nie.
 */

const DEFAULT_PORTAL_SITE_URL = 'https://freistaat-ostdeutschland.de';
const DEFAULT_LAW_SITE_URL = 'https://recht.freistaat-ostdeutschland.de';

function readBuildEnvironment(name: string, fallback: string): string {
  const metaEnvironment = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const processEnvironment = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  return metaEnvironment?.[name]?.trim() || processEnvironment?.trim() || fallback;
}

function normalizeSiteUrl(value: string): string {
  return value.replace(/\/+$/u, '');
}

export const siteUrls = {
  portal: normalizeSiteUrl(readBuildEnvironment('PORTAL_SITE_URL', DEFAULT_PORTAL_SITE_URL)),
  law: normalizeSiteUrl(readBuildEnvironment('LAW_SITE_URL', DEFAULT_LAW_SITE_URL)),
} as const;

export const siteTarget = readBuildEnvironment('SITE_TARGET', 'portal') === 'law' ? 'law' : 'portal';
export const isLawSite = siteTarget === 'law';

/** Pfade des Staatsportals (siteConfig.paths). */
export const portalPaths = {
  home: '/',
  search: '/suche/',
  government: '/staatsregierung/',
  governmentMembers: '/staatsregierung/mitglieder/',
  ministerPresident: '/staatsregierung/ministerpraesident/',
  cabinet: '/staatsregierung/kabinett/',
  holdings: '/staatsregierung/beteiligungen/',
  previousCabinets: '/staatsregierung/fruehere-kabinette/',
  coalition: '/staatsregierung/koalition/',
  actionPlan: '/staatsregierung/15-punkte-plan/',
  kreisreform: '/kreisreform/',
  topics: '/themen/',
  educationAndSchool: '/themen/bildung-und-schule/',
  schoolSystem: '/themen/bildung-und-schule/schulsystem/',
  press: '/presse/',
  pressReleases: '/presse/pressemitteilungen/',
  pressSpeeches: '/presse/reden/',
  pressDates: '/presse/termine/',
  budget: '/haushalt/',
  freestate: '/freistaat/',
  service: '/service/',
  serviceOverview: '/service/uebersicht/',
  career: '/service/karriere/',
  faq: '/service/faq/',
  lawBridge: '/recht/',
  contact: '/service/kontakt/',
  easyLanguage: '/service/leichte-sprache/',
  signLanguage: '/service/gebaerdensprache/',
  publications: '/service/publikationen/',
  imprint: '/service/impressum/',
  privacy: '/service/datenschutz/',
  accessibility: '/service/barrierefreiheit/',
} as const;

/** Pfade von OstRecht (lawSiteConfig.paths). */
export const lawPaths = {
  home: '/',
  search: '/suche/',
  laws: '/gesetze/',
  regulations: '/verordnungen/',
  administrativeRules: '/verwaltungsvorschriften/',
  index: '/archiv/',
  subjects: '/sachgebiete/',
  funding: '/foerderrichtlinien/',
  publications: '/verkuendungen/',
  constitution: '/norm/staatsverfassung-des-freistaates-ostdeutschland/',
  help: '/hilfe/',
} as const;

export type SitePathKey = keyof typeof portalPaths;
export type LawSitePathKey = keyof typeof lawPaths;
