import { getTopicUrl } from '../../lib/portal/routes.ts';
import type { ActionPlanItem } from '../../lib/portal/modules.ts';

export const actionPlanItems: ActionPlanItem[] = [
  {
    id: 'zweite-wohn-und-bodenoffensive',
    title: 'Zweite Wohn- und Bodenoffensive',
    description:
      'Bodenpolitik, Wohnraumschutz, öffentliche Wohnungsaufsicht und gemeinwohlorientierte Träger werden zur zweiten Wohn- und Bodenoffensive ausgebaut.',
    status: 'teilweise_umgesetzt',
    ressort: 'Inneres und Wohnungswirtschaft',
    href: getTopicUrl('wohnen-und-vergesellschaftung'),
    references: [
      { label: 'Vergesellschaftungsrahmengesetz', normSlug: 'vergesellschaftungsrahmengesetz' },
      { label: 'Wohnvergesellschaftungsgesetz', normSlug: 'wohnvergesellschaftungsgesetz' },
    ],
  },
  {
    id: 'gute-arbeit',
    title: 'Gute Arbeit wird zur verbindlichen Norm',
    description:
      'Tarifbindung, Mitbestimmung, Entfristung und gute Löhne sollen verbindliche Grundlage öffentlicher Mittel, Aufträge und Unternehmen werden.',
    status: 'teilweise_umgesetzt',
    ressort: 'Wirtschaft und Arbeit',
    href: getTopicUrl('gute-arbeit'),
    references: [
      { label: 'Ostdeutsches Tariftreue- und Vergabegesetz', normSlug: 'ostdeutsches-tariftreueund-vergabegesetz' },
    ],
  },
  {
    id: 'oeffentliche-wirtschaft-und-strukturwandel',
    title: 'Öffentliche Wirtschaft und Strukturwandel sichern',
    description:
      'Öffentliche Wirtschaft, Rekommunalisierung, Gemeinwohlkriterien und strategische Industriepolitik sollen regionale Wertschöpfung sichern.',
    status: 'angelegt',
    ressort: 'Wirtschaft und Arbeit',
    href: getTopicUrl('oeffentliche-wirtschaft-und-strukturwandel'),
  },
  {
    id: 'gesundheit-und-pflege',
    title: 'Gesundheit in Reichweite, Pflege mit Würde',
    description:
      'Regionale Gesundheitszentren, Krankenhausplanung, öffentliche Pflege und kommunale Gesundheitsinfrastruktur werden als Daseinsvorsorge fortgeführt.',
    status: 'teilweise_umgesetzt',
    ressort: 'Gesundheits- und Sozialwesen',
    href: getTopicUrl('krankenhausfonds'),
    references: [
      {
        label: 'Krankenhaussicherungs- und Rekommunalisierungsfondsgesetz',
        normSlug: 'ostdeutsches-krankenhaussicherungsund-rekommunalisierungsfondsgesetz',
      },
    ],
  },
  {
    id: 'familien-entlasten',
    title: 'Familien entlasten und Kinder stärken',
    description:
      'Familienservicehäuser, Gebührenbremse, soziale Orte, bessere Betreuung und erreichbare Beratung sollen Familien im Alltag entlasten.',
    status: 'angelegt',
    ressort: 'Gesundheits- und Sozialwesen',
    href: getTopicUrl('familie-und-soziales'),
  },
  {
    id: 'bildungsreform-und-wissenschaft',
    title: 'Bildungsreform vertiefen, Forschung und Fachkräfte stärken',
    description:
      'Schulreform, Hochschulselbstverwaltung, Forschung, Transfer und Fachkräftesicherung werden im Ressort Volksbildung und Wissenschaft gebündelt.',
    status: 'teilweise_umgesetzt',
    ressort: 'Volksbildung und Wissenschaft',
    href: getTopicUrl('bildungsreform'),
    references: [
      {
        label: 'Gesetz zur Neuordnung des Ostdeutschen Schulsystems',
        normSlug: 'gesetz-zur-neuordnung-des-ostdeutschen-schulsystems',
      },
    ],
  },
  {
    id: 'mobilitaet-und-digitale-teilhabe',
    title: 'Mobilität und digitale Teilhabe öffentlich sichern',
    description:
      'Verkehrsverbund, Ostdeutschlandtakt, Mobilitätsgarantie, digitale Grundversorgung und öffentliche Plattformen werden zusammengeführt.',
    status: 'teilweise_umgesetzt',
    ressort: 'Mobilität und regionale Entwicklung',
    href: getTopicUrl('oepnv-und-mobilitaet'),
  },
  {
    id: 'energie-klima-umwelt',
    title: 'Energie sicher, Klima sozial, Umwelt geschützt',
    description:
      'Energie, Wärme, Wasser, Kreislaufwirtschaft und Klimaanpassung sollen sozial, öffentlich und planbar organisiert werden.',
    status: 'angelegt',
    ressort: 'Nachhaltigkeit und Energie',
    href: getTopicUrl('energie-und-klima'),
  },
  {
    id: 'demokratie-und-sicherheit',
    title: 'Demokratie schützen, Sicherheit rechtsstaatlich stärken',
    description:
      'Sicherheitsbehörden, Prävention, Antidiskriminierung, Opferberatung und demokratische Kontrolle werden als gemeinsamer Sicherheitsrahmen fortentwickelt.',
    status: 'teilweise_umgesetzt',
    ressort: 'Rechtsstaatlichkeit und Staats- und Grenzsicherheit',
    href: getTopicUrl('demokratie-und-sicherheit'),
  },
  {
    id: 'kultur-erinnerung-medien',
    title: 'Kultur stärken, Erinnerung gestalten, Medien regional verankern',
    description:
      'Kulturpass, Gedenkstätten, Kulturhäuser, regionale Medien und Erinnerungspolitik werden im neuen Kulturzuschnitt weitergeführt.',
    status: 'teilweise_umgesetzt',
    ressort: 'Rechtsstaatlichkeit und kulturelle Emanzipation',
    href: getTopicUrl('kultur-erinnerung-und-medien'),
    references: [
      { label: 'Ostdeutsches Kulturpassgesetz', normSlug: 'ostdeutsches-kulturpassgesetz' },
      { label: 'Ostdeutsches Fernsehfunkgesetz', normSlug: 'ostdeutsches-fernsehfunkgesetz' },
    ],
  },
  {
    id: 'verwaltung-transparenz-buergernaehe',
    title: 'Verwaltung modernisieren, Transparenz und Bürgernähe stärken',
    description:
      'Analoges Amt, Verwaltungsmodernisierung, Transparenz, Bürgerräte, Antikorruption und verständliche Verwaltung werden fortgeführt.',
    status: 'teilweise_umgesetzt',
    ressort: 'Rechtsstaatlichkeit und kulturelle Emanzipation',
    href: getTopicUrl('transparenz-und-lobbyregister'),
    references: [
      {
        label: 'Ostdeutsches Transparenz- und Informationsfreiheitsgesetz',
        normSlug: 'ostdeutsches-transparenzund-informationsfreiheitsgesetz',
      },
    ],
  },
  {
    id: 'kommunen-regionen-berlin',
    title: 'Kommunen, Regionen und Berlin handlungsfähig machen',
    description:
      'Kommunale Finanzen, Konnexität, soziale Infrastruktur, regionale Entwicklung und Berlin-Sonderrecht werden als eigener Schwerpunkt gesetzt.',
    status: 'angelegt',
    ressort: 'Inneres und Wohnungswirtschaft',
    href: getTopicUrl('kommunen-regionen-und-berlin'),
  },
  {
    id: 'soziale-sicherheit-teilhabe',
    title: 'Soziale Sicherheit, Rente und Teilhabe ausbauen',
    description:
      'Sozialpass, Housing First, Gebührenbremse, soziale Rechte und Teilhabeinfrastruktur sollen Armut und Ausgrenzung entgegenwirken.',
    status: 'angelegt',
    ressort: 'Gesundheits- und Sozialwesen',
    href: getTopicUrl('soziale-sicherheit-und-teilhabe'),
  },
  {
    id: 'nachbarschaft-ostsee-stimme',
    title: 'Nachbarschaft, Ostsee und ostdeutsche Stimme stärken',
    description:
      'Grenzraumkooperation, Ostseestrategie, Bundesratsinitiativen und ostdeutsche Interessenvertretung werden ausgebaut.',
    status: 'teilweise_umgesetzt',
    ressort: 'Völkerfreundschaft und Nachbarschaftspolitik',
    href: getTopicUrl('nachbarschaft-und-europa'),
  },
  {
    id: 'finanzen-soziale-prioritaeten',
    title: 'Finanzen mit sozialen Prioritäten',
    description:
      'Der Haushalt wird auf öffentliche Investitionen, soziale Sicherheit, Daseinsvorsorge, regionale Wertschöpfung und demokratische Kontrolle ausgerichtet.',
    status: 'teilweise_umgesetzt',
    ressort: 'Finanzen',
    href: getTopicUrl('haushalt-und-finanzen'),
    references: [
      {
        label: 'Haushaltsgesetz 2025/2026',
        normSlug: 'gesetz-uber-die-feststellung-des-haushaltsplanes-des-freista-cc1hib-2',
      },
    ],
  },
];
