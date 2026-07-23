export interface LawSubjectAreaDefinition {
  name: string;
  description: string;
  subjects: string[];
}

/**
 * Redaktionelle Gruppierung der tatsächlich in Normmetadaten verwendeten Sachgebiete.
 * Sie ist keine amtliche Fundstellensystematik und vergibt bewusst keine Systemnummern.
 */
export const lawSubjectAreas: LawSubjectAreaDefinition[] = [
  {
    name: 'Staat, Verwaltung und Sicherheit',
    description: 'Verfassung, Verwaltung, Transparenz, öffentliche Ordnung und allgemeines Landesrecht.',
    subjects: [
      'Landesrecht',
      'Staats- und Verfassungsrecht',
      'Kommunal- und Verwaltungsrecht',
      'Verwaltungsrecht',
      'Sicherheit und Ordnung',
      'Transparenz und Informationszugang',
      'Verordnungsrecht',
    ],
  },
  {
    name: 'Wirtschaft, Arbeit und soziale Sicherung',
    description: 'Wirtschaftsrecht, Förderung, Arbeit, Soziales, Wohnen und Bodenordnung.',
    subjects: [
      'Arbeit und Soziales',
      'Gesundheit und Soziales',
      'Wirtschaft und Förderung',
      'Öffentliche Wirtschaft',
      'Wohnen und Bodenordnung',
      'Haushaltsrecht',
    ],
  },
  {
    name: 'Bildung, Kultur und Gesellschaft',
    description: 'Bildung, Sport, Medien, Rundfunk, Feiertage und gesellschaftliches Leben.',
    subjects: [
      'Bildung und Weiterbildung',
      'Sport und Bildung',
      'Rundfunk und Medien',
      'Feiertage und gesellschaftliches Leben',
    ],
  },
  {
    name: 'Umwelt, Raum, Mobilität und Nachbarschaft',
    description: 'Umwelt, Energie, Kreislaufwirtschaft, Raumordnung, Mobilität und Staatsverträge.',
    subjects: [
      'Umwelt, Energie und Klimaschutz',
      'Kreislaufwirtschaft',
      'Raumordnung und Landesplanung',
      'Mobilität und öffentliche Infrastruktur',
      'Völkerrecht und Staatsverträge',
    ],
  },
];
