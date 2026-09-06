import { isLawSite, lawPaths, portalPaths, siteTarget, siteUrls } from '@ostrecht/shared/config/site-routing.ts';
import { formatDate } from '@ostrecht/shared/lib/norms/display.ts';
import type { NormStatus } from '@ostrecht/shared/lib/norms/schema.ts';
import type { VersionTemporalKind } from '@ostrecht/shared/lib/norms/versions.ts';

/**
 * Öffentliche Grunddaten beider Websites: Bezeichnungen, Navigation, Kontakt, SEO und
 * Zielbezeichnungen. Reine Darstellung außerhalb der D1-Projektion. Origins, Zielsite und
 * Pfadtabellen kommen aus site-routing.ts (Teil der Projektion) und werden hier für die
 * vorhandenen Importe weitergereicht.
 */
export { isLawSite, siteTarget, siteUrls } from '@ostrecht/shared/config/site-routing.ts';
export type { LawSitePathKey, SitePathKey } from '@ostrecht/shared/config/site-routing.ts';

/**
 * Die Bereiche des Staatsportals: Bezeichnung, Adresse und Kurzbeschreibung stehen genau einmal
 * hier. Hauptnavigation, Brotkrumen, Serviceübersicht, `sitemap.xml`, Suchindex und Fehlerseite
 * lesen sie; niemand formuliert einen Bereichsnamen selbst (Befund „Bereichsname und Adresse“ der
 * Designprüfung vom 6. September 2026).
 *
 * Die Hauptnavigation führt ausschließlich Bereichseinstiege. Einzelne Themen — etwa das
 * Schulsystem — sind über die Themenseite, die Startseite und die Suche erreichbar, nicht als
 * zehnter Punkt neben acht Bereichen. Die Kreisreform bleibt ein eigener Bereich, weil sie nach
 * `AGENTS.md` ein zentraler Portalweg mit eigener Adresse ist.
 *
 * Der Bereich heißt „Staatsrat“, weil die Staatsverfassung das Organ an der Spitze der
 * vollziehenden Gewalt so nennt (Artikel „Der Staatsrat“). Seine Adresse bleibt
 * `/staatsregierung/`: sie benennt das Politikfeld, ist die eingeführte öffentliche Adresse und
 * liegt in `site-routing.ts` innerhalb des D1-Projektionsabschlusses — eine Umbenennung machte
 * aus einer reinen Darstellungsänderung eine Projektionsfreigabe, ohne dass Nutzende etwas
 * gewinnen. Titelzusatz und Brotkrume kommen aus `authorityName` beziehungsweise aus dieser
 * Liste, sodass Name, Adresse und Beschriftung nicht mehr auseinanderlaufen können.
 */
export const PORTAL_SECTIONS = [
  {
    key: 'home',
    label: 'Startseite',
    pathKey: 'home',
    path: portalPaths.home,
    description: 'Einstieg in das Staatsportal.',
    navigation: false,
  },
  {
    key: 'freestate',
    label: 'Freistaat',
    pathKey: 'freestate',
    path: portalPaths.freestate,
    description: 'Staatsaufbau, Bezirke, Hoheitszeichen und Geschichte.',
    navigation: true,
  },
  {
    key: 'government',
    label: 'Staatsrat',
    pathKey: 'government',
    path: portalPaths.government,
    description: 'Mitglieder, Geschäftsbereiche, Beteiligungen und Regierungsprogramm.',
    navigation: true,
  },
  {
    key: 'topics',
    label: 'Themen',
    pathKey: 'topics',
    path: portalPaths.topics,
    description: 'Vorhaben und Reformbereiche mit Stand, Zuständigkeit und Rechtsgrundlagen.',
    navigation: true,
  },
  {
    key: 'law',
    label: 'Recht',
    pathKey: 'lawBridge',
    path: portalPaths.lawBridge,
    description: 'Zugang zum Rechtsportal OstRecht.',
    navigation: true,
  },
  {
    key: 'kreisreform',
    label: 'Kreisreform',
    pathKey: 'kreisreform',
    path: portalPaths.kreisreform,
    description: 'Neue Kreise und Bezirke mit Gebietssuche und Tabellen.',
    navigation: true,
  },
  {
    key: 'budget',
    label: 'Haushalt',
    pathKey: 'budget',
    path: portalPaths.budget,
    description: 'Doppelhaushalt, Einzelpläne und Sondervermögen.',
    navigation: true,
  },
  {
    key: 'press',
    label: 'Presse',
    pathKey: 'press',
    path: portalPaths.press,
    description: 'Pressemitteilungen, Reden und Termine.',
    navigation: true,
  },
  {
    key: 'service',
    label: 'Service',
    pathKey: 'service',
    path: portalPaths.service,
    description: 'Kontakt, Karriere, Hilfe und barrierearme Zugänge.',
    navigation: true,
  },
] as const;

export type PortalSectionKey = (typeof PORTAL_SECTIONS)[number]['key'];

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
  sections: PORTAL_SECTIONS,
  mainNavigation: PORTAL_SECTIONS.filter((section) => section.navigation).map((section) => ({
    label: section.label,
    pathKey: section.pathKey,
  })),
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
  /**
   * Eine Wortliste für Stände und Stichtage. Dieselbe Sache heißt überall gleich, verschiedene
   * Sachen behalten verschiedene Wörter: `portalContentAsOf` ist der redaktionelle Stand einer
   * Portalseite, `dataAsOf` der Stand eines Datenbestands, `baselineDate` der Ausgangspunkt einer
   * Zeitreihe. Der `legalStatusAsOf` des Rechtsportals steht in `lawSiteConfig.vocabulary`; er
   * bezeichnet ein Datum der Rechtslage und wird hier bewusst nicht mit „Stand“ gleichgesetzt.
   */
  vocabulary: {
    portalContentAsOf: 'Stand',
    dataAsOf: 'Datenstand',
    baselineDate: 'Ausgangsstichtag',
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
    publications: 'Verkündungen',
    constitution: 'Verfassung',
    help: 'Hilfe',
  },
  /**
   * Eine Wortliste für Geltung, Fassung und Rechtsstand. Dieselbe Sache heißt überall gleich:
   * „Geltung“ ist der Status einer Vorschrift (in Kraft, künftig, außer Kraft, einmaliger
   * Rechtsakt), „Fassung“ die zeitliche Einordnung einer gespeicherten Fassung (geltend,
   * historisch, künftig), „Rechtsstand“ ein Datum. Filter, Facetten, Karten, Statuszeilen und
   * Vorschriftendaten lesen die Begriffe hier; niemand formuliert sie selbst.
   */
  vocabulary: {
    validity: {
      label: 'Geltung',
      any: 'Jede Geltung',
      byStatus: {
        'in-force': 'in Kraft',
        'future-effective': 'künftig in Kraft',
        'pending-effective': 'Inkrafttreten nicht belegt',
        repealed: 'außer Kraft',
        historical: 'außer Kraft',
        'one-time-act': 'einmaliger Rechtsakt',
        planned: 'nicht verkündet',
      } satisfies Record<NormStatus, string>,
    },
    version: {
      label: 'Fassung',
      any: 'Alle Fassungen',
      byKind: {
        current: { one: 'Geltende Fassung', many: 'Geltende Fassungen', adjective: 'geltend' },
        historical: { one: 'Historische Fassung', many: 'Historische Fassungen', adjective: 'historisch' },
        future: { one: 'Künftige Fassung', many: 'Künftige Fassungen', adjective: 'künftig' },
        'unknown-effective': { one: 'Fassung mit ungeklärtem Inkrafttreten', many: 'Fassungen mit ungeklärtem Inkrafttreten', adjective: 'ungeklärt' },
      } satisfies Record<VersionTemporalKind, { one: string; many: string; adjective: string }>,
    },
    legalStatus: {
      label: 'Rechtsstand',
      /** Satzmuster „Rechtsstand vom 4. September 2026“ für die geltende Fassung. */
      asOf: 'Rechtsstand vom',
    },
    /** Bezeichnung der Verfassung außerhalb des amtlichen Langtitels. */
    constitution: 'Verfassung',
    /** Fassungsnavigation und Verweise auf die Historienseite einer Vorschrift. */
    normHistory: 'Fassungen und Änderungen',
    normCompare: 'Fassungsvergleich',
    normCurrent: 'Aktuelle Fassung',
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
