export type SchoolTrackCategory =
  | 'primary'
  | 'secondaryI'
  | 'secondaryII'
  | 'vocationalTraining'
  | 'studyQualification'
  | 'advancedVocational'
  | 'continuingEducation'
  | 'higherEducation'
  | 'support';

export interface SchoolSystemLegendItem {
  id: SchoolTrackCategory;
  label: string;
  group: 'Allgemeinbildende Schulen' | 'Berufsbildende Schulen' | 'Anschlusswege';
}

export interface SchoolSystemZone {
  id: string;
  label: string;
  category: SchoolTrackCategory;
  startGrade: number;
  endGrade: number;
  columnStart: number;
  columnSpan: number;
}

export interface SchoolSystemTrack {
  id: string;
  label: string;
  subtitle?: string;
  category: SchoolTrackCategory;
  startGrade: number;
  endGrade: number;
  columnStart: number;
  columnSpan: number;
  completion?: string;
  linksTo?: string[];
  notes?: string[];
  compact?: boolean;
}

export interface SchoolSystemContinuation {
  id: string;
  label: string;
  subtitle?: string;
  category: SchoolTrackCategory;
  columnStart: number;
  columnSpan: number;
  note?: string;
}

export interface SchoolSystemGuide {
  id: string;
  orientation: 'horizontal' | 'vertical';
  label: string;
  afterGrade?: number;
  columnLine?: number;
  startGrade?: number;
  endGrade?: number;
}

export interface SchoolSystemTableRow {
  id: string;
  label: string;
  period: string;
  completion: string;
  connections: string;
}

export interface SchoolTypeInfo {
  id: string;
  title: string;
  group: 'Allgemeinbildende Schulen' | 'Berufsbildende Schulen' | 'Weitere Bildungswege';
  text: string[];
}

export const schoolSystemGrades = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

export const schoolSystemColumnCount = 27;

export const schoolSystemLegendItems: SchoolSystemLegendItem[] = [
  { id: 'primary', label: 'Primarstufe', group: 'Allgemeinbildende Schulen' },
  { id: 'secondaryI', label: 'Sekundarstufe I', group: 'Allgemeinbildende Schulen' },
  { id: 'secondaryII', label: 'Sekundarstufe II', group: 'Allgemeinbildende Schulen' },
  { id: 'vocationalTraining', label: 'Berufliche Ausbildung', group: 'Berufsbildende Schulen' },
  { id: 'studyQualification', label: 'Studienqualifizierung', group: 'Berufsbildende Schulen' },
  { id: 'advancedVocational', label: 'Doppelqualifizierung und Fachschule', group: 'Berufsbildende Schulen' },
  { id: 'continuingEducation', label: 'Berufliche Weiterbildung', group: 'Anschlusswege' },
  { id: 'higherEducation', label: 'Hochschule', group: 'Anschlusswege' },
];

export const schoolSystemZones: SchoolSystemZone[] = [
  {
    id: 'primary-zone',
    label: 'Primarstufe',
    category: 'primary',
    startGrade: 1,
    endGrade: 4,
    columnStart: 1,
    columnSpan: schoolSystemColumnCount,
  },
  {
    id: 'secondary-i-zone',
    label: 'Sekundarstufe I',
    category: 'secondaryI',
    startGrade: 5,
    endGrade: 10,
    columnStart: 1,
    columnSpan: schoolSystemColumnCount,
  },
  {
    id: 'secondary-ii-zone',
    label: 'Sekundarstufe II',
    category: 'secondaryII',
    startGrade: 11,
    endGrade: 12,
    columnStart: 22,
    columnSpan: 6,
  },
];

// Reference: context/21_08_23_schulsystem.pdf
export const schoolSystemTracks: SchoolSystemTrack[] = [
  {
    id: 'foerderschule-primary',
    label: 'Förderschule',
    category: 'support',
    startGrade: 1,
    endGrade: 4,
    columnStart: 1,
    columnSpan: 3,
    completion: 'individuelle Förderung',
    linksTo: ['foerderschule-secondary', 'oberschule'],
  },
  {
    id: 'grundschule',
    label: 'Grundschule',
    subtitle: 'Klassenstufen 1 bis 4',
    category: 'primary',
    startGrade: 1,
    endGrade: 4,
    columnStart: 4,
    columnSpan: 18,
    linksTo: ['oberschule', 'gymnasium-secondary-i', 'gemeinschaftsschule-secondary-i'],
  },
  {
    id: 'gemeinschaftsschule-primary',
    label: 'Gemeinschaftsschule',
    subtitle: 'Primarstufe oder Kooperation Grundschule',
    category: 'primary',
    startGrade: 1,
    endGrade: 4,
    columnStart: 24,
    columnSpan: 4,
    linksTo: ['gemeinschaftsschule-secondary-i'],
    compact: true,
  },
  {
    id: 'foerderschule-secondary',
    label: 'Förderschule',
    subtitle: 'Abschlüsse allgemeinbildender Schularten',
    category: 'support',
    startGrade: 5,
    endGrade: 10,
    columnStart: 1,
    columnSpan: 3,
    completion: 'Hauptschulabschluss oder Realschulabschluss möglich',
    linksTo: ['berufsvorbereitung', 'berufsschule'],
  },
  {
    id: 'oberschule',
    label: 'Oberschule',
    subtitle: 'einschließlich Oberschule+',
    category: 'secondaryI',
    startGrade: 5,
    endGrade: 10,
    columnStart: 4,
    columnSpan: 15,
    completion: 'Hauptschulabschluss oder Realschulabschluss',
    linksTo: ['berufsschule', 'berufsfachschule', 'fachoberschule', 'berufliches-gymnasium'],
  },
  {
    id: 'gymnasium-secondary-i',
    label: 'Gymnasium',
    category: 'secondaryI',
    startGrade: 5,
    endGrade: 10,
    columnStart: 22,
    columnSpan: 2,
    completion: 'orientierende Klassenstufen',
    linksTo: ['gymnasium-secondary-ii'],
    compact: true,
  },
  {
    id: 'gemeinschaftsschule-secondary-i',
    label: 'Gemeinschaftsschule',
    category: 'secondaryI',
    startGrade: 5,
    endGrade: 10,
    columnStart: 24,
    columnSpan: 4,
    completion: 'Hauptschulabschluss oder Realschulabschluss',
    linksTo: ['gemeinschaftsschule-secondary-ii'],
  },
  {
    id: 'berufsvorbereitung',
    label: 'Berufsvorbereitungsjahr',
    subtitle: 'Bildungsvorbereitende Maßnahmen',
    category: 'vocationalTraining',
    startGrade: 10,
    endGrade: 12,
    columnStart: 1,
    columnSpan: 2,
    completion: 'Berufsfähigkeit',
    linksTo: ['berufsschule'],
    compact: true,
  },
  {
    id: 'berufsfachschule',
    label: 'Berufsfachschule',
    subtitle: 'Berufsabschluss; Zuerkennung des mittleren Schulabschlusses möglich',
    category: 'vocationalTraining',
    startGrade: 10,
    endGrade: 11,
    columnStart: 4,
    columnSpan: 3,
    completion: 'Berufsabschluss',
    linksTo: ['fachschule', 'fachoberschule'],
  },
  {
    id: 'fachoberschule',
    label: 'Fachoberschule',
    category: 'studyQualification',
    startGrade: 12,
    endGrade: 12,
    columnStart: 4,
    columnSpan: 3,
    completion: 'Fachhochschulreife',
    linksTo: ['hochschule', 'fachschule'],
  },
  {
    id: 'berufsschule',
    label: 'Berufsschule',
    subtitle: 'Berufsvorbereitungsjahr, Vorbereitungsklassen, Berufsgrundbildungsjahr, duale Berufsausbildung',
    category: 'vocationalTraining',
    startGrade: 10,
    endGrade: 12,
    columnStart: 8,
    columnSpan: 6,
    completion: 'Berufsabschluss; Zuerkennung des mittleren Schulabschlusses möglich',
    linksTo: ['fachschule', 'fachoberschule'],
  },
  {
    id: 'fachoberschule-anschluss',
    label: 'Fachoberschule',
    category: 'studyQualification',
    startGrade: 13,
    endGrade: 13,
    columnStart: 8,
    columnSpan: 2,
    completion: 'Fachhochschulreife',
    linksTo: ['hochschule', 'fachschule'],
  },
  {
    id: 'berufsfachschule-anschluss',
    label: 'Berufsfachschule',
    category: 'vocationalTraining',
    startGrade: 11,
    endGrade: 12,
    columnStart: 14,
    columnSpan: 3,
    completion: 'Berufsabschluss',
    linksTo: ['fachschule', 'hochschule'],
  },
  {
    id: 'fachoberschule-kurz',
    label: 'Fachoberschule',
    category: 'studyQualification',
    startGrade: 12,
    endGrade: 13,
    columnStart: 15,
    columnSpan: 2,
    completion: 'Fachhochschulreife',
    linksTo: ['hochschule'],
    compact: true,
  },
  {
    id: 'fos-plus',
    label: 'FOS+',
    category: 'studyQualification',
    startGrade: 11,
    endGrade: 14,
    columnStart: 17,
    columnSpan: 1,
    completion: 'Studienqualifizierung',
    linksTo: ['hochschule'],
    compact: true,
  },
  {
    id: 'berufliches-gymnasium',
    label: 'Berufliches Gymnasium',
    subtitle: 'Allgemeine Hochschulreife',
    category: 'studyQualification',
    startGrade: 11,
    endGrade: 13,
    columnStart: 18,
    columnSpan: 2,
    completion: 'Allgemeine Hochschulreife',
    linksTo: ['hochschule'],
    compact: true,
  },
  {
    id: 'dubas',
    label: 'DUBAS',
    category: 'advancedVocational',
    startGrade: 11,
    endGrade: 14,
    columnStart: 20,
    columnSpan: 1,
    completion: 'Doppelqualifizierung',
    linksTo: ['hochschule', 'fachschule'],
    compact: true,
  },
  {
    id: 'gymnasium-secondary-ii',
    label: 'Gymnasium',
    subtitle: 'Allgemeine Hochschulreife',
    category: 'secondaryII',
    startGrade: 11,
    endGrade: 12,
    columnStart: 22,
    columnSpan: 2,
    completion: 'Allgemeine Hochschulreife',
    linksTo: ['hochschule'],
    compact: true,
  },
  {
    id: 'gemeinschaftsschule-secondary-ii',
    label: 'Gemeinschaftsschule',
    subtitle: 'Allgemeine Hochschulreife',
    category: 'secondaryII',
    startGrade: 11,
    endGrade: 12,
    columnStart: 24,
    columnSpan: 4,
    completion: 'Allgemeine Hochschulreife',
    linksTo: ['hochschule'],
  },
];

export const schoolSystemContinuations: SchoolSystemContinuation[] = [
  {
    id: 'hochschule',
    label: 'Hochschule',
    category: 'higherEducation',
    columnStart: 4,
    columnSpan: 24,
    note: 'Zugang nach schulischer oder beruflicher Studienqualifizierung.',
  },
  {
    id: 'fachschule-a',
    label: 'Fachschule',
    subtitle: 'Fachschulabschluss',
    category: 'advancedVocational',
    columnStart: 4,
    columnSpan: 3,
  },
  {
    id: 'fachschule-b',
    label: 'Fachschule',
    category: 'advancedVocational',
    columnStart: 8,
    columnSpan: 3,
  },
  {
    id: 'fachschule-c',
    label: 'Fachschule',
    category: 'advancedVocational',
    columnStart: 14,
    columnSpan: 3,
  },
  {
    id: 'fachschule-d',
    label: 'Fachschule',
    category: 'advancedVocational',
    columnStart: 18,
    columnSpan: 3,
  },
];

export const schoolSystemGuides: SchoolSystemGuide[] = [
  {
    id: 'transition-primary-secondary',
    orientation: 'horizontal',
    label: 'Übergang nach der Primarstufe',
    afterGrade: 4,
  },
  {
    id: 'orientation-grade-six',
    orientation: 'horizontal',
    label: 'Klassenstufen mit orientierender Funktion',
    afterGrade: 6,
  },
  {
    id: 'secondary-transition',
    orientation: 'horizontal',
    label: 'Übergang zu Sekundarstufe II und beruflicher Bildung',
    afterGrade: 10,
  },
  {
    id: 'support-to-general',
    orientation: 'vertical',
    label: 'Wechsel zwischen Förderschule und allgemeinbildenden Schulen',
    columnLine: 4,
    startGrade: 1,
    endGrade: 10,
  },
  {
    id: 'vocational-to-general',
    orientation: 'vertical',
    label: 'Übergänge zwischen beruflicher Bildung und allgemeinbildenden Wegen',
    columnLine: 21,
    startGrade: 5,
    endGrade: 14,
  },
  {
    id: 'gymnasium-to-community',
    orientation: 'vertical',
    label: 'Übergang zwischen Gymnasium und Gemeinschaftsschule',
    columnLine: 24,
    startGrade: 5,
    endGrade: 12,
  },
];

export const schoolSystemTableRows: SchoolSystemTableRow[] = [
  {
    id: 'grundschule-row',
    label: 'Grundschule',
    period: 'Klassenstufen 1 bis 4',
    completion: 'Übergang in weiterführende allgemeinbildende Schulen',
    connections: 'Oberschule, Gymnasium, Gemeinschaftsschule oder Förderschule nach individuellem Bedarf',
  },
  {
    id: 'foerderschule-row',
    label: 'Förderschule',
    period: 'je nach Förderschwerpunkt in Primarstufe und Sekundarstufe I',
    completion: 'Berufsfähigkeit, Hauptschulabschluss oder Realschulabschluss möglich',
    connections: 'allgemeinbildende Schulen, berufsvorbereitende Angebote oder berufliche Ausbildung',
  },
  {
    id: 'oberschule-row',
    label: 'Oberschule und Oberschule+',
    period: 'Klassenstufen 5 bis 10',
    completion: 'Hauptschulabschluss oder Realschulabschluss',
    connections: 'Berufsschule, Berufsfachschule, Fachoberschule, Berufliches Gymnasium oder Ausbildung',
  },
  {
    id: 'gymnasium-row',
    label: 'Gymnasium',
    period: 'Sekundarstufe I und II',
    completion: 'Allgemeine Hochschulreife',
    connections: 'Hochschule, Berufsausbildung, DUBAS oder weitere Qualifizierungswege',
  },
  {
    id: 'gemeinschaftsschule-row',
    label: 'Gemeinschaftsschule',
    period: 'Primarstufe, Sekundarstufe I und Sekundarstufe II',
    completion: 'Hauptschulabschluss, Realschulabschluss oder allgemeine Hochschulreife',
    connections: 'berufliche Bildung, Hochschule oder Weiterbildung',
  },
  {
    id: 'berufsschule-row',
    label: 'Berufsschule',
    period: 'in der Regel nach Sekundarstufe I',
    completion: 'Berufsabschluss; mittlerer Schulabschluss möglich',
    connections: 'Fachschule, Fachoberschule, berufliche Weiterbildung oder Erwerbstätigkeit',
  },
  {
    id: 'berufsfachschule-row',
    label: 'Berufsfachschule',
    period: 'mehrjährige vollzeitschulische Bildungsgänge',
    completion: 'Berufsabschluss; mittlerer Schulabschluss möglich',
    connections: 'Fachoberschule, Fachschule, berufliche Weiterbildung oder Ausbildung',
  },
  {
    id: 'fachoberschule-row',
    label: 'Fachoberschule und FOS+',
    period: 'anschließend an mittleren Schulabschluss oder berufliche Bildung',
    completion: 'Fachhochschulreife',
    connections: 'Hochschule, Fachschule oder berufliche Weiterbildung',
  },
  {
    id: 'berufliches-gymnasium-row',
    label: 'Berufliches Gymnasium',
    period: 'Sekundarstufe II',
    completion: 'Allgemeine Hochschulreife',
    connections: 'Hochschule, Berufsausbildung oder weitere berufliche Qualifizierung',
  },
  {
    id: 'fachschule-row',
    label: 'Fachschule',
    period: 'nach beruflicher Erstausbildung und Berufspraxis',
    completion: 'Fachschulabschluss',
    connections: 'gehobene berufliche Tätigkeit, Weiterbildung oder Hochschulzugang nach Maßgabe der Regelungen',
  },
  {
    id: 'dubas-row',
    label: 'DUBAS und Doppelqualifizierung',
    period: 'berufliche und schulische Qualifizierung in verbundenen Bildungsgängen',
    completion: 'Berufsabschluss und Studienqualifizierung möglich',
    connections: 'Hochschule, Fachschule oder berufliche Weiterbildung',
  },
];

export const schoolTypes: SchoolTypeInfo[] = [
  {
    id: 'grundschule-card',
    group: 'Allgemeinbildende Schulen',
    title: 'Grundschule',
    text: [
      'Die Grundschule umfasst die ersten vier Klassenstufen und legt die Grundlagen für Lesen, Schreiben, Mathematik, Sachunterricht und gemeinsames Lernen.',
      'Am Ende der Primarstufe schließen sich die weiterführenden Bildungswege an.',
    ],
  },
  {
    id: 'oberschule-card',
    group: 'Allgemeinbildende Schulen',
    title: 'Oberschule',
    text: [
      'Die Oberschule führt in der Sekundarstufe I zu Hauptschulabschluss und Realschulabschluss.',
      'Die Oberschule+ verbindet zusätzliche Orientierungs- und Anschlussmöglichkeiten mit den regulären Bildungsgängen.',
    ],
  },
  {
    id: 'gymnasium-card',
    group: 'Allgemeinbildende Schulen',
    title: 'Gymnasium',
    text: [
      'Das Gymnasium bereitet in Sekundarstufe I und II auf die allgemeine Hochschulreife vor.',
      'Es ermöglicht den direkten Übergang an Hochschulen sowie in anspruchsvolle berufliche Bildungswege.',
    ],
  },
  {
    id: 'gemeinschaftsschule-card',
    group: 'Allgemeinbildende Schulen',
    title: 'Gemeinschaftsschule',
    text: [
      'Die Gemeinschaftsschule verbindet längeres gemeinsames Lernen mit unterschiedlichen Abschlusswegen.',
      'Je nach Bildungsgang sind Hauptschulabschluss, Realschulabschluss und allgemeine Hochschulreife möglich.',
    ],
  },
  {
    id: 'foerderschule-card',
    group: 'Allgemeinbildende Schulen',
    title: 'Förderschule',
    text: [
      'Förderschulen unterstützen Schüler:innen mit besonderem Förderbedarf in geeigneten Bildungsgängen.',
      'Übergänge in andere Schularten und anerkannte Abschlüsse bleiben nach individueller Entwicklung möglich.',
    ],
  },
  {
    id: 'berufsschule-card',
    group: 'Berufsbildende Schulen',
    title: 'Berufsschule',
    text: [
      'Die Berufsschule begleitet die duale Ausbildung und berufsvorbereitende Bildungsgänge.',
      'Sie verbindet betriebliche Praxis mit schulischer Fachbildung und kann zusätzliche schulische Abschlüsse ermöglichen.',
    ],
  },
  {
    id: 'berufsfachschule-card',
    group: 'Berufsbildende Schulen',
    title: 'Berufsfachschule',
    text: [
      'Berufsfachschulen vermitteln berufliche Grundbildung oder führen in vollzeitschulischen Bildungsgängen zu Berufsabschlüssen.',
      'Je nach Bildungsgang kann der mittlere Schulabschluss zuerkannt werden.',
    ],
  },
  {
    id: 'fachoberschule-card',
    group: 'Berufsbildende Schulen',
    title: 'Fachoberschule',
    text: [
      'Die Fachoberschule führt zur Fachhochschulreife und öffnet den Weg in ein fachbezogenes Studium.',
      'Sie baut auf schulischen und beruflichen Vorleistungen auf.',
    ],
  },
  {
    id: 'berufliches-gymnasium-card',
    group: 'Berufsbildende Schulen',
    title: 'Berufliches Gymnasium',
    text: [
      'Das Berufliche Gymnasium verbindet die gymnasiale Oberstufe mit beruflich geprägten Schwerpunkten.',
      'Der Bildungsgang führt zur allgemeinen Hochschulreife.',
    ],
  },
  {
    id: 'fachschule-card',
    group: 'Berufsbildende Schulen',
    title: 'Fachschule',
    text: [
      'Fachschulen dienen der beruflichen Weiterbildung nach Ausbildung und Berufserfahrung.',
      'Sie führen zu Fachschulabschlüssen und qualifizieren für gehobene berufliche Verantwortung.',
    ],
  },
  {
    id: 'zweiter-bildungsweg-card',
    group: 'Weitere Bildungswege',
    title: 'Zweiter Bildungsweg',
    text: [
      'Der zweite Bildungsweg eröffnet Erwachsenen die Möglichkeit, Schulabschlüsse nachzuholen oder zu erweitern.',
      'Die konkrete Ausgestaltung richtet sich nach Vorbildung, beruflicher Erfahrung und angestrebtem Abschluss.',
    ],
  },
  {
    id: 'freie-traegerschaft-card',
    group: 'Weitere Bildungswege',
    title: 'Schulen in freier Trägerschaft',
    text: [
      'Schulen in freier Trägerschaft ergänzen das öffentliche Schulangebot und unterliegen staatlicher Genehmigung oder Anerkennung.',
      'Für Abschlüsse und Übergänge gelten die jeweils maßgeblichen schulrechtlichen Anforderungen.',
    ],
  },
  {
    id: 'foerderangebote-card',
    group: 'Weitere Bildungswege',
    title: 'Förderangebote',
    text: [
      'Förderung und Unterstützung setzen dort an, wo Schüler:innen besondere Lern-, Sprach-, Sozial- oder Entwicklungsbedarfe haben.',
      'Ziel ist ein möglichst passender Bildungsweg mit verlässlichen Übergängen.',
    ],
  },
  {
    id: 'studienqualifizierung-card',
    group: 'Weitere Bildungswege',
    title: 'Studienqualifizierung und Hochschulzugang',
    text: [
      'Allgemeine Hochschulreife, Fachhochschulreife und berufliche Qualifikationen können den Zugang zu Hochschulen eröffnen.',
      'Die Grafik zeigt die wichtigsten schulischen und beruflichen Wege in vereinfachter Form.',
    ],
  },
];

export const educationPathNavItems = [
  { label: 'Überblick', href: '#ueberblick' },
  { label: 'Allgemeinbildende Schulen', href: '#allgemeinbildende-schulen' },
  { label: 'Berufsbildende Schulen', href: '#berufsbildende-schulen' },
  { label: 'Zweiter Bildungsweg', href: '#zweiter-bildungsweg' },
  { label: 'Schulen in freier Trägerschaft', href: '#schulen-in-freier-traegerschaft' },
  { label: 'Förderung und Unterstützung', href: '#foerderung-und-unterstuetzung' },
  { label: 'Rechtsgrundlagen', href: '#rechtsgrundlagen' },
  { label: 'Zuständige Stellen', href: '#zustaendige-stellen' },
] as const;
