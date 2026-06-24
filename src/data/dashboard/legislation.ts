import { getTopicUrl } from '../../lib/portal/routes.ts';
import { getNormUrl } from '../../lib/norms/routes.ts';
import type { LegislativeTrackerItem } from '../../lib/portal/modules.ts';

export const legislationTrackerItems: LegislativeTrackerItem[] = [
  {
    id: 'wohnvergesellschaftungsgesetz',
    title: 'Wohnvergesellschaftungsgesetz',
    description:
      'Das Vorhaben überführt zentrale Wohnungsbestände in gemeinwohlorientierte Strukturen und wird durch flankierende Vollzugsnormen ergänzt.',
    ressort: 'Inneres und Wohnungswirtschaft',
    currentStage: 'inkraft',
    topic: 'Wohnen & Vergesellschaftung',
    href: getNormUrl('wohnvergesellschaftungsgesetz'),
  },
  {
    id: 'transparenzundinformationsfreiheitsgesetz',
    title: 'Ostdeutsches Transparenz- und Informationsfreiheitsgesetz',
    description:
      'Das Gesetz stärkt Informationszugang, Transparenzpflichten und die Nachvollziehbarkeit staatlichen Handelns.',
    ressort: 'Rechtsstaatlichkeit',
    currentStage: 'inkraft',
    topic: 'Transparenz & Lobbyregister',
    href: getNormUrl('ostdeutsches-transparenzund-informationsfreiheitsgesetz'),
  },
  {
    id: 'kulturpassgesetz',
    title: 'Ostdeutsches Kulturpassgesetz',
    description:
      'Der Kulturpass schafft einen unmittelbaren Zugang zu Kulturangeboten und macht Teilhabepolitik landesweit sichtbar.',
    ressort: 'Rechtsstaatlichkeit und kulturelle Emanzipation',
    currentStage: 'inkraft',
    topic: 'Kulturpass',
    href: getNormUrl('ostdeutsches-kulturpassgesetz'),
  },
  {
    id: 'krankenhausfonds',
    title: 'Krankenhaussicherungs- und Rekommunalisierungsfonds',
    description:
      'Das Vorhaben bündelt staatliche Sicherung und öffentliche Steuerung regionaler Krankenhausstandorte.',
    ressort: 'Gesundheits- und Sozialwesen',
    currentStage: 'inkraft',
    topic: 'Krankenhausfonds',
    href: getNormUrl('ostdeutsches-krankenhaussicherungsund-rekommunalisierungsfondsgesetz'),
  },
  {
    id: 'bildungsfreistellung',
    title: 'Bildungsfreistellungsgesetz',
    description:
      'Die Bildungsreform wird um ein landesweites Anspruchsmodell auf Bildungsfreistellung im Erwerbsleben ergänzt.',
    ressort: 'Volksbildung und Wissenschaft',
    currentStage: 'inkraft',
    topic: 'Bildungsreform',
    href: getNormUrl('gesetz-uber-den-anspruch-auf-bildungsfreistellung-im-freistaat-ostdeutschland'),
  },
  {
    id: 'oepnv-ausbaugesetz',
    title: 'Gesetz zur Errichtung der Ostdeutschen Eisenbahn',
    description:
      'Der Entwurf soll die Ostdeutsche Eisenbahn als gemeinwirtschaftliche Trägerin öffentlicher Verkehrsleistungen aufbauen und Verkehrsproduktionsmittel dauerhaft öffentlich sichern.',
    ressort: 'Mobilität und regionale Entwicklung',
    currentStage: 'entwurf',
    topic: 'ÖPNV & Mobilität',
    href: getTopicUrl('oepnv-und-mobilitaet'),
  },
  {
    id: 'energie-und-waermevergesellschaftungsgesetz',
    title: 'Energie- und Wärmevergesellschaftungsgesetz',
    description:
      'Der Entwurf konkretisiert den Vergesellschaftungsrahmen für Energie- und Wärmeinfrastruktur, soziale Energiepreise und öffentliche Trägerstrukturen.',
    ressort: 'Nachhaltigkeit und Energie',
    currentStage: 'entwurf',
    topic: 'Energie & Klima',
    href: getTopicUrl('energie-und-klima'),
  },
  {
    id: 'tarifverordnung-ostdeutschlandtakt',
    title: 'Tarifverordnung für landesweite Verbundstandards',
    description:
      'Die Verordnung soll Tarifintegration und einheitliche Mindeststandards für den schrittweisen Aufbau des Ostdeutschlandtakts festlegen.',
    ressort: 'Mobilität und regionale Entwicklung',
    currentStage: 'in-beratung',
    topic: 'ÖPNV & Mobilität',
    href: getTopicUrl('oepnv-und-mobilitaet'),
  },
  {
    id: 'fondsfortentwicklungsgesetz',
    title: 'Investitions- und Fondsfortentwicklungsgesetz',
    description:
      'Das Vorhaben bündelt nächste Ausbauschritte für Sondervermögen, Finanzierungsinstrumente und investive Schwerpunktsetzung.',
    ressort: 'Finanzen',
    currentStage: 'eingebracht',
    topic: 'Haushalt & Finanzen',
    href: getTopicUrl('haushalt-und-finanzen'),
  },
];
