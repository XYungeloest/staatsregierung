import { isLawSite, lawPaths, portalPaths, siteTarget, siteUrls } from '@ostrecht/shared/config/site-routing.ts';
import { formatDate } from '@ostrecht/shared/lib/norms/display.ts';

/**
 * Öffentliche Grunddaten beider Websites: Bezeichnungen, Navigation, Kontakt, SEO und
 * Zielbezeichnungen. Reine Darstellung außerhalb der D1-Projektion. Origins, Zielsite und
 * Pfadtabellen kommen aus site-routing.ts (Teil der Projektion) und werden hier für die
 * vorhandenen Importe weitergereicht.
 */
export { isLawSite, siteTarget, siteUrls } from '@ostrecht/shared/config/site-routing.ts';
export type { LawSitePathKey, SitePathKey } from '@ostrecht/shared/config/site-routing.ts';

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
  paths: portalPaths,
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
  paths: lawPaths,
  /**
   * Je Ziel genau eine öffentliche Bezeichnung. Navigation, Fußzeile, Startseitenkarten,
   * Hilfe, Fehlerseite und Seitenköpfe lesen sie hier; niemand formuliert sie selbst.
   */
  targetLabels: {
    home: 'Start',
    search: 'Rechtssuche',
    laws: 'Gesetze',
    regulations: 'Verordnungen',
    administrativeRules: 'Verwaltungsvorschriften',
    index: 'Vorschriften A–Z',
    subjects: 'Sachgebiete',
    funding: 'Förderrichtlinien',
    references: 'Fundstellennachweise',
    publications: 'Verkündungen',
    constitution: 'Verfassung',
    development: 'Rechtsentwicklung',
    help: 'Hilfe',
  },
  mainNavigation: [
    { label: 'Gesetze', pathKey: 'laws' },
    { label: 'Verordnungen', pathKey: 'regulations' },
    { label: 'Verwaltungsvorschriften', pathKey: 'administrativeRules' },
    { label: 'Verfassung', pathKey: 'constitution' },
    { label: 'Verkündungen', pathKey: 'publications' },
    { label: 'Sachgebiete', pathKey: 'subjects' },
  ],
} as const;

export const activeSiteConfig = isLawSite ? lawSiteConfig : siteConfig;
