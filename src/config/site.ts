import { formatDate } from '../lib/norms/presentation.ts';

export const siteConfig = {
  authorityName: 'Staatsregierung des Ostdeutschen Freistaates',
  portalTitle: 'Regierungsportal',
  portalSubtitle: 'Informationen, Presse, Karriere, Recht und Service',
  portalClaim: 'Sachlich. Statisch. Behördennah.',
  simulationNotice:
    'Dies ist eine fiktive Website innerhalb einer politischen Simulation des Ostdeutschen Freistaates.',
  footerNote:
    'Statische Website der Staatsregierung des Ostdeutschen Freistaates mit integriertem Rechtsbereich innerhalb einer fiktiven Politiksimulation.',
  officialFlagAssetPath: '/images/ui/ost-flagge.png',
  officialFlagFallback: 'OF',
  searchLabel: 'Suche im Rechtsbereich',
  searchPlaceholder: 'z. B. Normtitel, Sachgebiet oder Ressort',
  paths: {
    home: '/',
    government: '/regierung/',
    governmentMembers: '/regierung/mitglieder/',
    cabinet: '/regierung/kabinett/',
    ministries: '/ministerien/',
    press: '/presse/',
    career: '/karriere/',
    jobs: '/karriere/stellen/',
    lawHome: '/recht/',
    lawSearch: '/recht/suche/',
    lawIndex: '/recht/index/',
    lawSubjects: '/recht/subjects/',
    contact: '/kontakt/',
    imprint: '/impressum/',
    privacy: '/datenschutz/',
    accessibility: '/barrierefreiheit/',
    overview: '/uebersicht/',
    editorial: '/redaktion/',
  },
  mainNavigation: [
    { label: 'Staatsregierung', pathKey: 'government' },
    { label: 'Ministerien', pathKey: 'ministries' },
    { label: 'Presse', pathKey: 'press' },
    { label: 'Karriere', pathKey: 'career' },
    { label: 'Recht', pathKey: 'lawHome' },
    { label: 'Kontakt', pathKey: 'contact' },
  ],
  serviceNavigation: [
    { label: 'Übersicht', pathKey: 'overview' },
    { label: 'Kontakt', pathKey: 'contact' },
    { label: 'Impressum', pathKey: 'imprint' },
    { label: 'Datenschutz', pathKey: 'privacy' },
    { label: 'Barrierefreiheit', pathKey: 'accessibility' },
  ],
  contact: {
    authorityShort: 'Staatsregierung des Ostdeutschen Freistaates',
    addressLines: ['Archivstraße 1', '01097 Dresden'],
    postalAddress: 'Staatskanzlei des Ostdeutschen Freistaates, Archivstraße 1, 01097 Dresden',
    citizenService: {
      label: 'Bürgertelefon',
      phone: '+49 351 100-0',
      email: 'service@osten.de',
    },
    pressOffice: {
      label: 'Pressestelle der Staatsregierung',
      phone: '+49 351 100-1111',
      email: 'pressestelle@osten.de',
    },
    officeHours: ['Montag bis Donnerstag: 9.00 bis 17.00 Uhr', 'Freitag: 9.00 bis 15.00 Uhr'],
  },
  currentGovernment: {
    cabinetName: 'Kabinett Honecker',
    formedOn: '2025-12-20',
    coalition: 'Volksfront und Bündnis Demokratie Europa',
    coalitionShort: 'VF + DEMOS',
    headOfGovernment: 'Karl Honecker',
    deputyHead: 'Mia Wollrath',
    legislature: '6. Ostdeutscher Landtag',
    predecessor: 'Kabinett Delgado',
  },
  ministries: [
    {
      slug: 'staatskanzlei',
      name: 'Staatskanzlei',
      shortName: 'Staatskanzlei',
    },
    {
      slug: 'inneres-bau-und-kommunale-angelegenheiten',
      name: 'Staatsministerium für Inneres, Bau und kommunale Angelegenheiten',
      shortName: 'Inneres, Bau und Kommunales',
    },
    {
      slug: 'kapitalakkumulation-des-fiskus',
      name: 'Staatsministerium für Kapitalakkumulation des Fiskus',
      shortName: 'Fiskus',
    },
    {
      slug: 'grenzschutz-faschismusbekaempfung-und-bewaffnete-organe',
      name: 'Staatsministerium für Grenzschutz, Faschismusbekämpfung und für die bewaffneten Organe',
      shortName: 'Grenzschutz und bewaffnete Organe',
    },
    {
      slug: 'voelkerfreundschaft-und-nachbarschaftspolitik',
      name: 'Staatsministerium für Völkerfreundschaft und Nachbarschaftspolitik',
      shortName: 'Völkerfreundschaft',
    },
    {
      slug: 'soziale-und-gesundheitliche-fuersorge',
      name: 'Staatsministerium für soziale und gesundheitliche Fürsorge',
      shortName: 'Soziale Fürsorge',
    },
    {
      slug: 'mobilitaet-infrastruktur-und-landesentwicklung',
      name: 'Staatsministerium für Mobilität, Infrastruktur und Landesentwicklung',
      shortName: 'Mobilität und Infrastruktur',
    },
    {
      slug: 'rechtsstaatlichkeit-und-angelegenheiten-des-staates',
      name: 'Staatsministerium für Rechtsstaatlichkeit und Angelegenheiten des Staates',
      shortName: 'Rechtsstaatlichkeit',
    },
    {
      slug: 'kultur-wissenschaft-und-tourismus',
      name: 'Staatsministerium für Kultur, Wissenschaft und Tourismus',
      shortName: 'Kultur und Wissenschaft',
    },
    {
      slug: 'bildung-und-sportliche-ertuechtigung',
      name: 'Staatsministerium für Bildung und sportliche Ertüchtigung',
      shortName: 'Bildung und Sport',
    },
    {
      slug: 'umwelt-energie-und-klimaschutz',
      name: 'Staatsministerium für Umwelt, Energie und Klimaschutz',
      shortName: 'Umwelt und Energie',
    },
    {
      slug: 'kueste-fischerei-forst-und-landwirtschaft',
      name: 'Staatsministerium für Küste, Fischerei, Forst und Landwirtschaft',
      shortName: 'Küste und Landwirtschaft',
    },
    {
      slug: 'wirtschaft-arbeitsmarkt-und-beschaeftigung',
      name: 'Staatsministerium für Wirtschaft, Arbeitsmarkt und Beschäftigung',
      shortName: 'Wirtschaft und Arbeitsmarkt',
    },
  ],
  date: {
    formatLong: formatDate,
  },
} as const;

export type SiteConfig = typeof siteConfig;
export type SitePathKey = keyof typeof siteConfig.paths;
