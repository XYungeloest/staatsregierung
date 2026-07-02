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

export type SchoolSystemChartTextKind = 'title' | 'emphasis' | 'small' | 'tiny';

export interface SchoolSystemChartTextLine {
  text: string;
  kind?: SchoolSystemChartTextKind;
}

export interface SchoolSystemChartZone {
  id: string;
  category: SchoolTrackCategory;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SchoolSystemChartConnector {
  id: string;
  category: SchoolTrackCategory;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SchoolSystemChartBlock {
  id: string;
  category: SchoolTrackCategory | 'none';
  x: number;
  y: number;
  width: number;
  height: number;
  lines?: SchoolSystemChartTextLine[];
  anchor?: 'start' | 'middle';
  lineHeight?: number;
  textX?: number;
  textY?: number;
  rotate?: number;
  noBox?: boolean;
  border?: boolean;
}

export interface SchoolSystemChartGuideLine {
  id: string;
  orientation: 'horizontal' | 'vertical';
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface SchoolSystemChartSpec {
  width: number;
  height: number;
  axisWidth: number;
  plotX: number;
  plotWidth: number;
  topBandHeight: number;
  gridY: number;
  gradeHeight: number;
  footerY: number;
  footerHeight: number;
  zones: SchoolSystemChartZone[];
  connectors: SchoolSystemChartConnector[];
  blocks: SchoolSystemChartBlock[];
  guides: SchoolSystemChartGuideLine[];
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

export const schoolSystemChart: SchoolSystemChartSpec = {
  width: 1768,
  height: 1052,
  axisWidth: 48,
  plotX: 54,
  plotWidth: 1714,
  topBandHeight: 138,
  gridY: 216,
  gradeHeight: 55,
  footerY: 994,
  footerHeight: 50,
  zones: [
    { id: 'chart-primary', category: 'primary', x: 54, y: 766, width: 1714, height: 220 },
    { id: 'chart-secondary-i', category: 'secondaryI', x: 54, y: 436, width: 1714, height: 330 },
    { id: 'chart-secondary-ii-gymnasium', category: 'secondaryII', x: 1410, y: 326, width: 145, height: 110 },
    { id: 'chart-secondary-ii-community', category: 'secondaryII', x: 1556, y: 326, width: 212, height: 110 },
  ],
  connectors: [
    { id: 'work-connector-left', category: 'advancedVocational', x: 406, y: 138, width: 7, height: 298 },
    { id: 'work-connector-mid-a', category: 'advancedVocational', x: 530, y: 138, width: 7, height: 188 },
    { id: 'work-connector-mid-b', category: 'advancedVocational', x: 612, y: 138, width: 7, height: 188 },
    { id: 'work-connector-mid-c', category: 'advancedVocational', x: 713, y: 138, width: 7, height: 132 },
    { id: 'work-connector-mid-d', category: 'advancedVocational', x: 807, y: 138, width: 7, height: 188 },
    { id: 'work-connector-right-a', category: 'advancedVocational', x: 1022, y: 138, width: 7, height: 188 },
    { id: 'work-connector-right-b', category: 'advancedVocational', x: 1110, y: 138, width: 7, height: 188 },
    { id: 'study-connector-fos-plus', category: 'advancedVocational', x: 1183, y: 138, width: 7, height: 78 },
    { id: 'study-connector-bg', category: 'advancedVocational', x: 1280, y: 138, width: 7, height: 132 },
    { id: 'study-connector-dubas', category: 'advancedVocational', x: 1390, y: 138, width: 7, height: 132 },
  ],
  blocks: [
    {
      id: 'hochschule',
      category: 'none',
      x: 360,
      y: 24,
      width: 780,
      height: 34,
      noBox: true,
      lines: [{ text: 'HOCHSCHULE¹', kind: 'title' }],
      lineHeight: 18,
    },
    {
      id: 'footnotes-a',
      category: 'none',
      x: 1490,
      y: 10,
      width: 120,
      height: 116,
      noBox: true,
      anchor: 'start',
      lineHeight: 13,
      lines: [
        { text: '¹ Zugang nach schulischer', kind: 'tiny' },
        { text: 'oder beruflicher Studien-', kind: 'tiny' },
        { text: 'qualifizierung.', kind: 'tiny' },
        { text: '² Fachschulabschlüsse', kind: 'tiny' },
        { text: 'werden ergänzend im', kind: 'tiny' },
        { text: 'Rechtsportal erläutert.', kind: 'tiny' },
      ],
    },
    {
      id: 'footnotes-b',
      category: 'none',
      x: 1622,
      y: 14,
      width: 140,
      height: 98,
      noBox: true,
      anchor: 'start',
      lineHeight: 13,
      lines: [
        { text: '³ Fachhochschulreife', kind: 'tiny' },
        { text: 'nach erfolgreichem', kind: 'tiny' },
        { text: 'Abschluss des jeweiligen', kind: 'tiny' },
        { text: 'Bildungsgangs.', kind: 'tiny' },
      ],
    },
    {
      id: 'fachschule-a',
      category: 'advancedVocational',
      x: 358,
      y: 70,
      width: 110,
      height: 68,
      lines: [
        { text: 'FACHSCHULE²', kind: 'title' },
        { text: 'Fachschulab-', kind: 'emphasis' },
        { text: 'schluss³', kind: 'emphasis' },
      ],
      lineHeight: 20,
    },
    {
      id: 'fachschule-b',
      category: 'advancedVocational',
      x: 560,
      y: 70,
      width: 110,
      height: 68,
      lines: [{ text: 'FACHSCHULE²', kind: 'title' }],
    },
    {
      id: 'fachschule-c',
      category: 'advancedVocational',
      x: 756,
      y: 70,
      width: 110,
      height: 68,
      lines: [{ text: 'FACHSCHULE²', kind: 'title' }],
    },
    {
      id: 'fachschule-d',
      category: 'advancedVocational',
      x: 956,
      y: 70,
      width: 110,
      height: 68,
      lines: [{ text: 'FACHSCHULE²', kind: 'title' }],
    },
    {
      id: 'berufsvorbereitung-left',
      category: 'vocationalTraining',
      x: 54,
      y: 326,
      width: 108,
      height: 220,
      lines: [
        { text: 'Berufsvorbereitungsjahr', kind: 'tiny' },
        { text: 'Bildungsvorbereitende', kind: 'tiny' },
        { text: 'Maßnahmen der Bundes-', kind: 'tiny' },
        { text: 'agentur für Arbeit', kind: 'tiny' },
        { text: 'Weitere Bildungswege', kind: 'tiny' },
        { text: 'siehe Oberschule', kind: 'tiny' },
      ],
      anchor: 'start',
      textX: 64,
      textY: 458,
      lineHeight: 11,
    },
    {
      id: 'berufsvorbereitung-top',
      category: 'vocationalTraining',
      x: 162,
      y: 272,
      width: 108,
      height: 164,
      lines: [],
    },
    {
      id: 'realschulabschluss-left',
      category: 'secondaryII',
      x: 162,
      y: 436,
      width: 108,
      height: 110,
      lines: [{ text: 'Realschulab-', kind: 'small' }, { text: 'schluss', kind: 'small' }],
      lineHeight: 20,
    },
    {
      id: 'hauptschulabschluss-left',
      category: 'none',
      x: 58,
      y: 545,
      width: 110,
      height: 42,
      noBox: true,
      lines: [{ text: 'Hauptschulab-', kind: 'small' }, { text: 'schluss', kind: 'small' }],
      lineHeight: 19,
    },
    {
      id: 'foerderschule-secondary',
      category: 'none',
      x: 68,
      y: 590,
      width: 170,
      height: 78,
      noBox: true,
      lines: [
        { text: 'FÖRDERSCHULE', kind: 'title' },
        { text: 'Abschlüsse allgemein-', kind: 'emphasis' },
        { text: 'bildender Schularten', kind: 'emphasis' },
      ],
      lineHeight: 21,
    },
    {
      id: 'foerderschule-primary',
      category: 'none',
      x: 72,
      y: 850,
      width: 150,
      height: 34,
      noBox: true,
      lines: [{ text: 'FÖRDERSCHULE', kind: 'title' }],
    },
    {
      id: 'fachoberschule-left',
      category: 'studyQualification',
      x: 272,
      y: 326,
      width: 84,
      height: 110,
      lines: [
        { text: 'FACHOBER-', kind: 'title' },
        { text: 'SCHULE', kind: 'title' },
        { text: 'Fachhoch-', kind: 'emphasis' },
        { text: 'schulreife', kind: 'emphasis' },
      ],
      lineHeight: 20,
    },
    {
      id: 'berufsfachschule-left',
      category: 'vocationalTraining',
      x: 272,
      y: 436,
      width: 198,
      height: 110,
      lines: [
        { text: 'BERUFSFACHSCHULE', kind: 'title' },
        { text: 'Berufsabschluss/', kind: 'emphasis' },
        { text: 'Zuerkennung des mittleren', kind: 'emphasis' },
        { text: 'Schulabschlusses möglich', kind: 'emphasis' },
      ],
      lineHeight: 20,
    },
    {
      id: 'berufstaetigkeit-left',
      category: 'none',
      x: 394,
      y: 272,
      width: 70,
      height: 34,
      noBox: true,
      rotate: -90,
      lines: [{ text: 'Berufstätigkeit', kind: 'emphasis' }],
    },
    {
      id: 'fachoberschule-mid-low',
      category: 'studyQualification',
      x: 472,
      y: 272,
      width: 84,
      height: 54,
      lines: [{ text: 'FACHOBER-', kind: 'title' }, { text: 'SCHULE', kind: 'title' }],
      lineHeight: 18,
    },
    {
      id: 'berufsschule',
      category: 'vocationalTraining',
      x: 472,
      y: 326,
      width: 394,
      height: 220,
      lines: [
        { text: 'BERUFSSCHULE', kind: 'title' },
        { text: '(Berufsvorbereitungsjahr, Vorbereitungs-', kind: 'emphasis' },
        { text: 'klassen, Berufsgrundbildungsjahr, duale', kind: 'emphasis' },
        { text: 'Berufsausbildung)', kind: 'emphasis' },
        { text: 'Berufsabschluss/Zuerkennung', kind: 'emphasis' },
        { text: 'des mittleren Schulabschlusses möglich', kind: 'emphasis' },
      ],
      lineHeight: 22,
    },
    {
      id: 'berufstaetigkeit-mid-a',
      category: 'none',
      x: 596,
      y: 260,
      width: 78,
      height: 34,
      noBox: true,
      rotate: -90,
      lines: [{ text: 'Berufstätigkeit', kind: 'emphasis' }],
    },
    {
      id: 'fachoberschule-mid-high',
      category: 'studyQualification',
      x: 670,
      y: 216,
      width: 84,
      height: 54,
      lines: [{ text: 'FACHOBER-', kind: 'title' }, { text: 'SCHULE', kind: 'title' }],
      lineHeight: 18,
    },
    {
      id: 'berufstaetigkeit-mid-b',
      category: 'none',
      x: 788,
      y: 260,
      width: 80,
      height: 34,
      noBox: true,
      rotate: -90,
      lines: [{ text: 'Berufstätigkeit', kind: 'emphasis' }],
    },
    {
      id: 'fachoberschule-right-top',
      category: 'studyQualification',
      x: 868,
      y: 272,
      width: 94,
      height: 54,
      lines: [{ text: 'FACHOBER-', kind: 'title' }, { text: 'SCHULE', kind: 'title' }],
      lineHeight: 18,
    },
    {
      id: 'berufsfachschule-right',
      category: 'vocationalTraining',
      x: 868,
      y: 326,
      width: 194,
      height: 110,
      lines: [{ text: 'BERUFSFACHSCHULE', kind: 'title' }],
    },
    {
      id: 'berufstaetigkeit-right',
      category: 'none',
      x: 1000,
      y: 260,
      width: 80,
      height: 34,
      noBox: true,
      rotate: -90,
      lines: [{ text: 'Berufstätigkeit', kind: 'emphasis' }],
    },
    {
      id: 'fachoberschule-right',
      category: 'studyQualification',
      x: 1066,
      y: 326,
      width: 88,
      height: 110,
      lines: [{ text: 'FACH-', kind: 'title' }, { text: 'OBER-', kind: 'title' }, { text: 'SCHULE', kind: 'title' }],
      lineHeight: 20,
    },
    {
      id: 'fos-plus',
      category: 'advancedVocational',
      x: 1158,
      y: 216,
      width: 45,
      height: 220,
      lines: [{ text: 'FOS+', kind: 'title' }],
    },
    {
      id: 'berufliches-gymnasium',
      category: 'studyQualification',
      x: 1208,
      y: 272,
      width: 128,
      height: 164,
      lines: [
        { text: 'BERUFLICHES', kind: 'title' },
        { text: 'GYMNASIUM', kind: 'title' },
        { text: 'Allgemeine', kind: 'emphasis' },
        { text: 'Hochschulreife', kind: 'emphasis' },
      ],
      lineHeight: 22,
    },
    {
      id: 'dubas',
      category: 'advancedVocational',
      x: 1342,
      y: 216,
      width: 64,
      height: 220,
      lines: [{ text: 'DUBAS', kind: 'title' }],
    },
    {
      id: 'gymnasium-secondary-ii',
      category: 'none',
      x: 1410,
      y: 342,
      width: 145,
      height: 72,
      noBox: true,
      lines: [
        { text: 'GYMNASIUM', kind: 'title' },
        { text: 'Allgemeine', kind: 'emphasis' },
        { text: 'Hochschulreife', kind: 'emphasis' },
      ],
      lineHeight: 21,
    },
    {
      id: 'gemeinschaftsschule-secondary-ii',
      category: 'none',
      x: 1556,
      y: 350,
      width: 212,
      height: 54,
      noBox: true,
      textX: 1648,
      lines: [{ text: 'GEMEINSCHAFTSSCHULE', kind: 'title' }, { text: 'Allgemeine Hochschulreife', kind: 'emphasis' }],
      lineHeight: 21,
    },
    {
      id: 'oberschule',
      category: 'none',
      x: 610,
      y: 470,
      width: 470,
      height: 230,
      noBox: true,
      lineHeight: 37,
      textY: 505,
      lines: [
        { text: 'OBERSCHULE   Realschulabschluss', kind: 'small' },
        { text: 'OBERSCHULE   Hauptschulabschluss', kind: 'small' },
        { text: 'OBER   SCHULEN+', kind: 'small' },
        { text: 'OBERSCHULE Hauptschulabschluss   einschließlich OBERSCHULE+', kind: 'small' },
        { text: 'OBERSCHULE Realschulabschluss   einschließlich OBERSCHULE+', kind: 'small' },
      ],
    },
    {
      id: 'orientation-center',
      category: 'none',
      x: 700,
      y: 690,
      width: 430,
      height: 34,
      noBox: true,
      lines: [{ text: 'Klassenstufen mit   orientierender Funktion', kind: 'emphasis' }],
    },
    {
      id: 'gymnasium-secondary-i',
      category: 'none',
      x: 1408,
      y: 560,
      width: 146,
      height: 44,
      noBox: true,
      lines: [{ text: 'GYMNASIUM', kind: 'title' }],
    },
    {
      id: 'gemeinschaftsschule-realschulabschluss',
      category: 'none',
      x: 1558,
      y: 465,
      width: 202,
      height: 48,
      noBox: true,
      textX: 1648,
      lines: [{ text: 'GEMEINSCHAFTSSCHULE', kind: 'title' }, { text: 'Realschulabschluss', kind: 'emphasis' }],
      lineHeight: 20,
    },
    {
      id: 'gemeinschaftsschule-hauptschulabschluss',
      category: 'none',
      x: 1558,
      y: 555,
      width: 202,
      height: 48,
      noBox: true,
      textX: 1648,
      lines: [{ text: 'GEMEINSCHAFTSSCHULE', kind: 'title' }, { text: 'Hauptschulabschluss', kind: 'emphasis' }],
      lineHeight: 20,
    },
    {
      id: 'orientation-right',
      category: 'none',
      x: 1580,
      y: 690,
      width: 178,
      height: 54,
      noBox: true,
      lines: [{ text: 'Klassenstufen mit', kind: 'emphasis' }, { text: 'orientierender Funktion', kind: 'emphasis' }],
      lineHeight: 18,
    },
    {
      id: 'grundschule',
      category: 'none',
      x: 710,
      y: 810,
      width: 250,
      height: 40,
      noBox: true,
      lines: [{ text: 'GRUND   SCHULE', kind: 'title' }],
    },
    {
      id: 'grundschule-note',
      category: 'none',
      x: 720,
      y: 922,
      width: 300,
      height: 28,
      noBox: true,
      lines: [{ text: 'Klassenstufen 1 bis 4    der Oberschule+', kind: 'emphasis' }],
    },
    {
      id: 'gemeinschaftsschule-primary',
      category: 'none',
      x: 1558,
      y: 840,
      width: 200,
      height: 82,
      noBox: true,
      textX: 1648,
      lines: [
        { text: 'GEMEINSCHAFTSSCHULE', kind: 'title' },
        { text: 'Primarstufe ODER', kind: 'emphasis' },
        { text: 'GEMEINSCHAFTSSCHULE', kind: 'title' },
        { text: 'in Kooperation Grundschule', kind: 'emphasis' },
      ],
      lineHeight: 20,
    },
  ],
  guides: [
    { id: 'support-switch', orientation: 'vertical', x1: 270, x2: 270, y1: 436, y2: 986 },
    { id: 'primary-guidance-low', orientation: 'horizontal', x1: 270, x2: 1556, y1: 876, y2: 876 },
    { id: 'primary-secondary', orientation: 'horizontal', x1: 54, x2: 1768, y1: 766, y2: 766 },
    { id: 'orientation-grade-six', orientation: 'horizontal', x1: 270, x2: 1768, y1: 676, y2: 676 },
    { id: 'gym-path-a', orientation: 'vertical', x1: 1324, x2: 1324, y1: 436, y2: 766 },
    { id: 'gym-path-b', orientation: 'vertical', x1: 1390, x2: 1390, y1: 436, y2: 766 },
    { id: 'community-path', orientation: 'vertical', x1: 1544, x2: 1544, y1: 326, y2: 986 },
  ],
};

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
