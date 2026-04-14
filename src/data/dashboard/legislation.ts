import { getTopicUrl } from '../../lib/portal/routes.ts';
import { getNormUrl } from '../../lib/norms/routes.ts';
import type { LegislativeTrackerItem } from '../../lib/portal/modules.ts';

export const legislationTrackerItems: LegislativeTrackerItem[] = [
  {
    id: 'wohnvergesellschaftungsgesetz',
    title: 'Wohnvergesellschaftungsgesetz',
    description:
      'Das Vorhaben überführt zentrale Wohnungsbestände in gemeinwohlorientierte Strukturen und wird durch flankierende Vollzugsnormen ergänzt.',
    ressort: 'Inneres und Kommunales',
    currentStage: 'inkrafttreten',
    topic: 'Wohnen & Vergesellschaftung',
    href: getNormUrl('wohnvergesellschaftungsgesetz'),
  },
  {
    id: 'transparenzundinformationsfreiheitsgesetz',
    title: 'Ostdeutsches Transparenz- und Informationsfreiheitsgesetz',
    description:
      'Das Gesetz stärkt Informationszugang, Transparenzpflichten und die Nachvollziehbarkeit staatlichen Handelns.',
    ressort: 'Rechtsstaatlichkeit',
    currentStage: 'inkrafttreten',
    topic: 'Transparenz & Lobbyregister',
    href: getNormUrl('ostdeutsches-transparenzund-informationsfreiheitsgesetz'),
  },
  {
    id: 'kulturpassgesetz',
    title: 'Ostdeutsches Kulturpassgesetz',
    description:
      'Der Kulturpass schafft einen unmittelbaren Zugang zu Kulturangeboten und macht Teilhabepolitik landesweit sichtbar.',
    ressort: 'Kultur und Wissenschaft',
    currentStage: 'inkrafttreten',
    topic: 'Kulturpass',
    href: getNormUrl('ostdeutsches-kulturpassgesetz'),
  },
  {
    id: 'krankenhausfonds',
    title: 'Krankenhaussicherungs- und Rekommunalisierungsfonds',
    description:
      'Das Vorhaben bündelt staatliche Sicherung und öffentliche Steuerung regionaler Krankenhausstandorte.',
    ressort: 'Soziale Fürsorge',
    currentStage: 'inkrafttreten',
    topic: 'Krankenhausfonds',
    href: getNormUrl('ostdeutsches-krankenhaussicherungsund-rekommunalisierungsfondsgesetz'),
  },
  {
    id: 'bildungsfreistellung',
    title: 'Bildungsfreistellungsgesetz',
    description:
      'Die Bildungsreform wird um ein landesweites Anspruchsmodell auf Bildungsfreistellung im Erwerbsleben ergänzt.',
    ressort: 'Bildung und Sport',
    currentStage: 'inkrafttreten',
    topic: 'Bildungsreform',
    href: getNormUrl('gesetz-uber-den-anspruch-auf-bildungsfreistellung-im-freistaat-ostdeutschland'),
  },
  {
    id: 'oepnv-ausbaugesetz',
    title: 'Ausbaugesetz öffentlicher Mobilitätsachsen',
    description:
      'Für Schienenreaktivierung, Knotenentwicklung und landesweite Standards wird ein eigenständiges Mobilitätsgesetz vorbereitet.',
    ressort: 'Mobilität und Infrastruktur',
    currentStage: 'entwurf',
    topic: 'ÖPNV & Mobilität',
    href: getTopicUrl('oepnv-und-mobilitaet'),
  },
  {
    id: 'tarifverordnung-ostdeutschlandtakt',
    title: 'Tarifverordnung für landesweite Verbundstandards',
    description:
      'Die Verordnung soll Tarifintegration und einheitliche Mindeststandards für den schrittweisen Aufbau des Ostdeutschlandtakts festlegen.',
    ressort: 'Mobilität und Infrastruktur',
    currentStage: 'kabinett',
    topic: 'ÖPNV & Mobilität',
    href: getTopicUrl('oepnv-und-mobilitaet'),
  },
  {
    id: 'fondsfortentwicklungsgesetz',
    title: 'Investitions- und Fondsfortentwicklungsgesetz',
    description:
      'Das Vorhaben bündelt nächste Ausbauschritte für Sondervermögen, Finanzierungsinstrumente und investive Schwerpunktsetzung.',
    ressort: 'Fiskus',
    currentStage: 'landtag',
    topic: 'Haushalt & Finanzen',
    href: getTopicUrl('haushalt-und-finanzen'),
  },
];

