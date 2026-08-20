import { formatDate } from '../lib/norms/presentation.ts';

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

export const siteConfig = {
  authorityName: 'Staatsrat des Ostdeutschen Freistaates',
  portalTitle: 'Freistaat Ostdeutschland',
  portalSubtitle: 'Website des Staatsrates mit Recht, Themen, Presse, Haushalt und Service',
  seo: {
    siteName: 'Freistaat Ostdeutschland',
    siteUrl: siteUrls.portal,
    locale: 'de_DE',
    defaultDescription:
      'Staatsportal des Ostdeutschen Freistaates mit Staatsrat, Reformprojekten, Rechtsportal, Presse und Service.',
    simulationDescription:
      'Fiktives Regierungsportal des Ostdeutschen Freistaates innerhalb einer politischen Simulation.',
    defaultSocialImage: {
      url: '/images/social/portal-preview.png',
      alt: 'Freistaat Ostdeutschland – fiktives Regierungsportal einer Politiksimulation',
      width: 1200,
      height: 630,
      type: 'image/png',
    },
  },
  simulationNotice:
    'Dies ist eine fiktive Website innerhalb einer politischen Simulation des Ostdeutschen Freistaates.',
  footerNote: 'Staatsportal des Ostdeutschen Freistaates.',
  officialFlagAssetPath: '/images/ui/ost-flagge.png',
  officialFlagSmallAssetPath: '/images/generated/ui/ost-flagge-480.webp',
  officialCoatOfArmsAssetPath: '/favicon.svg',
  officialFlagText: 'OF',
  searchLabel: 'Portal durchsuchen',
  searchPlaceholder: 'z. B. Thema, Ressort, Recht oder Presse',
  paths: {
    home: '/',
    search: '/suche/',
    government: '/staatsregierung/',
    governmentMembers: '/staatsregierung/mitglieder/',
    ministerPresident: '/staatsregierung/ministerpraesident/',
    cabinet: '/staatsregierung/kabinett/',
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
  },
  mainNavigation: [
    { label: 'Freistaat', pathKey: 'freestate' },
    { label: 'Staatsrat', pathKey: 'government' },
    { label: 'Themen', pathKey: 'topics' },
    { label: 'Schulsystem', pathKey: 'schoolSystem' },
    { label: 'Recht', pathKey: 'lawBridge' },
    { label: 'Kreisreform', pathKey: 'kreisreform' },
    { label: 'Haushalt', pathKey: 'budget' },
    { label: 'Presse', pathKey: 'press' },
    { label: 'Service', pathKey: 'service' },
  ],
  serviceNavigation: [
    { label: 'Leichte Sprache', pathKey: 'easyLanguage' },
    { label: 'Gebärdensprache', pathKey: 'signLanguage' },
    { label: 'Barrierefreiheit', pathKey: 'accessibility' },
    { label: 'Kontakt', pathKey: 'contact' },
  ],
  contact: {
    authorityShort: 'Staatsrat des Ostdeutschen Freistaates',
    addressLines: ['Archivstraße 1', '01097 Dresden'],
    postalAddress: 'Staatskanzlei des Ostdeutschen Freistaates, Archivstraße 1, 01097 Dresden',
    citizenService: {
      label: 'Bürgertelefon',
      phone: '+49 351 100-0',
      email: 'service@freistaat-ostdeutschland.de',
    },
    authorityNumber: {
      label: 'Behördennummer',
      number: '115',
      description:
        'Informationen zur Behördennummer 115 und die Kontaktwege des Staatsrates finden Sie im Kontaktbereich.',
      pathKey: 'contact',
      directPhoneLink: false,
    },
    pressOffice: {
      label: 'Presse- und Informationsamt des Staatsrates',
      phone: '+49 351 100-1200',
      email: 'presse@freistaat-ostdeutschland.de',
    },
    editorialOffice: {
      label: 'Portalredaktion',
      email: 'redaktion@freistaat-ostdeutschland.de',
    },
    portalOperations: {
      label: 'Referat Digitale Infrastruktur und Portalbetrieb',
      email: 'portalbetrieb@freistaat-ostdeutschland.de',
    },
    officeHours: ['Montag bis Donnerstag: 9.00 bis 17.00 Uhr', 'Freitag: 9.00 bis 15.00 Uhr'],
  },
  date: {
    formatLong: formatDate,
  },
} as const;

export const lawSiteConfig = {
  brand: 'OstRecht',
  subtitle: 'Rechtsportal des Ostdeutschen Freistaates',
  authorityName: siteConfig.authorityName,
  seo: {
    siteName: 'OstRecht – Rechtsportal des Ostdeutschen Freistaates',
    siteUrl: siteUrls.law,
    locale: siteConfig.seo.locale,
    defaultDescription:
      'OstRecht erschließt geltendes und historisches Recht, Fassungen, Fundstellen und Verkündungen des Ostdeutschen Freistaates.',
    simulationDescription: siteConfig.seo.simulationDescription,
    defaultSocialImage: {
      url: '/images/social/recht-preview.png',
      alt: 'OstRecht – Rechtsportal des Ostdeutschen Freistaates',
      width: 1200,
      height: 630,
      type: 'image/png',
    },
  },
  simulationNotice: siteConfig.simulationNotice,
  footerNote: 'Rechtsportal des Ostdeutschen Freistaates.',
  officialCoatOfArmsAssetPath: siteConfig.officialCoatOfArmsAssetPath,
  officialFlagSmallAssetPath: siteConfig.officialFlagSmallAssetPath,
  officialFlagText: siteConfig.officialFlagText,
  searchLabel: 'Recht durchsuchen',
  searchPlaceholder: 'Gesetze, Verordnungen und Verwaltungsvorschriften durchsuchen',
  paths: {
    home: '/',
    search: '/suche/',
    index: '/archiv/',
    subjects: '/sachgebiete/',
    funding: '/foerderrichtlinien/',
    references: '/fundstellen/',
    publications: '/verkuendungen/',
    constitution: '/verfassung/',
    development: '/rechtsentwicklung/',
    help: '/hilfe/',
  },
  mainNavigation: [
    { label: 'Suche', pathKey: 'search' },
    { label: 'A–Z', pathKey: 'index' },
    { label: 'Sachgebiete', pathKey: 'subjects' },
    { label: 'Verkündungen', pathKey: 'publications' },
    { label: 'Fundstellen', pathKey: 'references' },
    { label: 'Verfassung', pathKey: 'constitution' },
    { label: 'Rechtsentwicklung', pathKey: 'development' },
  ],
} as const;

export const activeSiteConfig = isLawSite ? lawSiteConfig : siteConfig;

export type SiteConfig = typeof siteConfig;
export type SitePathKey = keyof typeof siteConfig.paths;
export type LawSitePathKey = keyof typeof lawSiteConfig.paths;
