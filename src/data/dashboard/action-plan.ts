import {
  getCabinetUrl,
  getLawConstitutionUrl,
  getMinisterPresidentUrl,
  getServiceUrl,
  getTopicUrl,
} from '../../lib/portal/routes.ts';
import type { ActionPlanItem } from '../../lib/portal/modules.ts';

export const actionPlanItems: ActionPlanItem[] = [
  {
    id: 'regierungssitz-dresden',
    title: 'Regierungskoordination in Dresden',
    description:
      'Die Staatsregierung ist mit sichtbarer Leitungsstruktur, klaren Zuständigkeiten und dauerhaftem Bezugspunkt Dresden im Portal verankert.',
    status: 'umgesetzt',
    ressort: 'Staatskanzlei',
    href: getMinisterPresidentUrl(),
  },
  {
    id: 'kabinett-und-ressorts',
    title: 'Kabinett und Ressorts',
    description:
      'Die Ressortstruktur, die Kabinettsmitglieder und die institutionelle Aufgabenordnung des Freistaates sind vollständig aufgebaut.',
    status: 'umgesetzt',
    ressort: 'Staatskanzlei',
    href: getCabinetUrl(),
  },
  {
    id: 'rechtsordnung-und-verkuendung',
    title: 'Verfassung, Verkündung und Rechtszugang',
    description:
      'Verfassung, Verkündungslogik und ein integrierter Zugang zu aktuellen und historischen Fassungen sind unter /recht/ gebündelt.',
    status: 'umgesetzt',
    ressort: 'Rechtsstaatlichkeit',
    href: getLawConstitutionUrl(),
    references: [
      {
        label: 'Verfassung',
        normSlug: 'gesetz-zur-veranderung-der-verfassung-zur-anderung-der-verku-437sg5',
      },
      {
        label: 'Gesetz über Verkündungen und Bekanntmachungen',
        normSlug: 'gesetz-uber-verkundungen-und-bekanntmachungen',
      },
    ],
  },
  {
    id: 'wohnen-und-vergesellschaftung',
    title: 'Wohnen und Vergesellschaftung',
    description:
      'Wohnraumschutz, Vergesellschaftung, Preisregulierung und Vollzugsinstrumente bilden ein tragendes Kernprojekt der Landespolitik.',
    status: 'umgesetzt',
    ressort: 'Inneres und Kommunales',
    href: getTopicUrl('wohnen-und-vergesellschaftung'),
    references: [
      { label: 'Vergesellschaftungsrahmengesetz', normSlug: 'vergesellschaftungsrahmengesetz' },
      { label: 'Wohnvergesellschaftungsgesetz', normSlug: 'wohnvergesellschaftungsgesetz' },
    ],
  },
  {
    id: 'mobilitaet-und-oepnv',
    title: 'ÖPNV und Mobilität',
    description:
      'Planung, Finanzierung und Strukturaufbau sind angelegt; fachrechtliche Vertiefungen für Tarif- und Reaktivierungsfragen folgen schrittweise.',
    status: 'teilweise_umgesetzt',
    ressort: 'Mobilität und Infrastruktur',
    href: getTopicUrl('oepnv-und-mobilitaet'),
  },
  {
    id: 'bildungsreform',
    title: 'Bildungsreform',
    description:
      'Schulneuordnung, Kita-Entlastung und ergänzende Verordnungen bilden bereits einen breiten Umsetzungsstand der Bildungsreform.',
    status: 'umgesetzt',
    ressort: 'Bildung und Sport',
    href: getTopicUrl('bildungsreform'),
    references: [
      {
        label: 'Gesetz zur Neuordnung des Ostdeutschen Schulsystems',
        normSlug: 'gesetz-zur-neuordnung-des-ostdeutschen-schulsystems',
      },
    ],
  },
  {
    id: 'kulturpass',
    title: 'Kulturpass und kulturelle Teilhabe',
    description:
      'Der Kulturpass ist als eigenständiges Leistungsinstrument aufgebaut und bereits direkt mit dem Rechtsportal verbunden.',
    status: 'umgesetzt',
    ressort: 'Kultur und Wissenschaft',
    href: getTopicUrl('kulturpass'),
    references: [
      { label: 'Ostdeutsches Kulturpassgesetz', normSlug: 'ostdeutsches-kulturpassgesetz' },
    ],
  },
  {
    id: 'demokratie-und-sicherheit',
    title: 'Demokratie und Sicherheit',
    description:
      'Rechtsstaatliche Kontrolle, Antidiskriminierung und sicherheitspolitische Handlungsfähigkeit werden gemeinsam fortgeführt.',
    status: 'umgesetzt',
    ressort: 'Rechtsstaatlichkeit',
    href: getTopicUrl('demokratie-und-sicherheit'),
  },
  {
    id: 'rundfunkreform',
    title: 'Rundfunkreform',
    description:
      'Die Rundfunkordnung des Freistaates wurde mit dem Ostdeutschen Fernsehfunk und staatsvertraglichen Anpassungen neu geordnet.',
    status: 'umgesetzt',
    ressort: 'Kultur und Wissenschaft',
    href: getTopicUrl('rundfunkreform'),
  },
  {
    id: 'krankenhausfonds',
    title: 'Krankenhausfonds und öffentliche Sicherung',
    description:
      'Der Krankenhaussicherungs- und Rekommunalisierungsfonds ist als zentrales Instrument staatlicher Daseinsvorsorge normativ verankert.',
    status: 'umgesetzt',
    ressort: 'Soziale Fürsorge',
    href: getTopicUrl('krankenhausfonds'),
    references: [
      {
        label: 'Krankenhaussicherungs- und Rekommunalisierungsfondsgesetz',
        normSlug: 'ostdeutsches-krankenhaussicherungsund-rekommunalisierungsfondsgesetz',
      },
    ],
  },
  {
    id: 'familie-und-soziales',
    title: 'Familie und Soziales',
    description:
      'Familienentlastung und soziale Sicherung sind angelegt und teilweise umgesetzt, insbesondere über Kita- und Fürsorgepolitik.',
    status: 'teilweise_umgesetzt',
    ressort: 'Soziale Fürsorge',
    href: getTopicUrl('familie-und-soziales'),
  },
  {
    id: 'nachbarschaft-und-europa',
    title: 'Nachbarschaft und Europa',
    description:
      'Grenzüberschreitende Zusammenarbeit mit Polen und Tschechien ist institutionell und normativ bereits fest verankert.',
    status: 'umgesetzt',
    ressort: 'Völkerfreundschaft',
    href: getTopicUrl('nachbarschaft-und-europa'),
  },
  {
    id: 'transparenz-und-lobbyregister',
    title: 'Transparenz und Lobbyregister',
    description:
      'Informationszugang, Transparenzpflichten und Beteiligtendokumentation sind mit tragenden Landesnormen im Portal eingebunden.',
    status: 'umgesetzt',
    ressort: 'Rechtsstaatlichkeit',
    href: getTopicUrl('transparenz-und-lobbyregister'),
    references: [
      {
        label: 'Ostdeutsches Transparenz- und Informationsfreiheitsgesetz',
        normSlug: 'ostdeutsches-transparenzund-informationsfreiheitsgesetz',
      },
    ],
  },
  {
    id: 'haushalt-und-finanzen',
    title: 'Haushalt und Finanzen',
    description:
      'Doppelhaushalt, Landesbank und Vergaberecht bilden die finanzpolitische Grundarchitektur des Landes.',
    status: 'umgesetzt',
    ressort: 'Fiskus',
    href: getTopicUrl('haushalt-und-finanzen'),
    references: [
      {
        label: 'Haushaltsgesetz 2025/2026',
        normSlug: 'gesetz-uber-die-feststellung-des-haushaltsplanes-des-freista-cc1hib-2',
      },
    ],
  },
  {
    id: 'service-und-verwaltungszugang',
    title: 'Service und Verwaltungszugang',
    description:
      'Servicewege, Kontakt, FAQ und Barrierefreiheit sind angelegt und werden schrittweise nutzerfreundlicher gebündelt.',
    status: 'angelegt',
    ressort: 'Staatskanzlei',
    href: getServiceUrl(),
  },
];
