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
    label: 'Polytechnische Oberschule',
    subtitle: 'Primarstufe, Klassenstufen 1 bis 4',
    category: 'primary',
    startGrade: 1,
    endGrade: 4,
    columnStart: 4,
    columnSpan: 18,
    linksTo: ['oberschule', 'gymnasium-secondary-i', 'gemeinschaftsschule-secondary-i'],
  },
  {
    id: 'gemeinschaftsschule-primary',
    label: 'Polytechnische Oberschule',
    subtitle: 'Primarstufe',
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
    completion: 'Abschlüsse allgemeinbildender Schularten möglich',
    linksTo: ['berufsvorbereitung', 'berufsschule'],
  },
  {
    id: 'oberschule',
    label: 'Polytechnische Oberschule',
    subtitle: 'Sekundarstufe I',
    category: 'secondaryI',
    startGrade: 5,
    endGrade: 10,
    columnStart: 4,
    columnSpan: 15,
    completion: 'Abschluss nach Klassenstufe 9 oder 10',
    linksTo: ['berufsschule', 'berufsfachschule', 'fachoberschule', 'berufliches-gymnasium'],
  },
  {
    id: 'gymnasium-secondary-i',
    label: 'Polytechnische Oberschule',
    subtitle: 'Sekundarstufe I',
    category: 'secondaryI',
    startGrade: 5,
    endGrade: 10,
    columnStart: 22,
    columnSpan: 2,
    completion: 'Übergang in EOS bei entsprechender Eignung',
    linksTo: ['gymnasium-secondary-ii'],
    compact: true,
  },
  {
    id: 'gemeinschaftsschule-secondary-i',
    label: 'Polytechnische Oberschule',
    subtitle: 'Sekundarstufe I',
    category: 'secondaryI',
    startGrade: 5,
    endGrade: 10,
    columnStart: 24,
    columnSpan: 4,
    completion: 'Abschluss nach Klassenstufe 9 oder 10',
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
    label: 'Erweiterte Oberschule',
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
    label: 'Erweiterte Oberschule',
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
    label: 'Übergang zwischen Polytechnischer und Erweiterter Oberschule',
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
    { id: 'chart-eos', category: 'secondaryII', x: 1410, y: 326, width: 358, height: 110 },
  ],
  connectors: [
    { id: 'work-connector-left', category: 'advancedVocational', x: 406, y: 138, width: 7, height: 298 },
    { id: 'work-connector-mid-a', category: 'advancedVocational', x: 530, y: 138, width: 7, height: 188 },
    { id: 'work-connector-mid-b', category: 'advancedVocational', x: 612, y: 138, width: 7, height: 188 },
    { id: 'work-connector-mid-c', category: 'advancedVocational', x: 713, y: 138, width: 7, height: 132 },
    { id: 'work-connector-mid-d', category: 'advancedVocational', x: 807, y: 138, width: 7, height: 188 },
    { id: 'work-connector-right-a', category: 'advancedVocational', x: 1022, y: 138, width: 7, height: 188 },
    { id: 'work-connector-right-b', category: 'advancedVocational', x: 1110, y: 138, width: 7, height: 188 },
    { id: 'study-connector-fos-plus', category: 'advancedVocational', x: 1181, y: 138, width: 7, height: 78 },
    { id: 'study-connector-bg', category: 'advancedVocational', x: 1275, y: 138, width: 7, height: 132 },
    { id: 'study-connector-dubas', category: 'advancedVocational', x: 1373, y: 138, width: 7, height: 132 },
  ],
  blocks: [
    {
      id: 'hochschule',
      category: 'none',
      x: 460,
      y: 24,
      width: 780,
      height: 54,
      noBox: true,
      lines: [
        { text: 'HOCHSCHULE', kind: 'title' },
        { text: 'Zugang nach schulischer oder beruflicher Studienqualifizierung.', kind: 'small' },
      ],
      lineHeight: 24,
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
      lines: [],
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
      lines: [],
    },
    {
      id: 'fachschule-a',
      category: 'advancedVocational',
      x: 358,
      y: 70,
      width: 110,
      height: 68,
      lines: [
        { text: 'FACHSCHULE', kind: 'title' },
        { text: 'Fachschul-', kind: 'emphasis' },
        { text: 'abschluss', kind: 'emphasis' },
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
      lines: [{ text: 'FACHSCHULE', kind: 'title' }],
    },
    {
      id: 'fachschule-c',
      category: 'advancedVocational',
      x: 756,
      y: 70,
      width: 110,
      height: 68,
      lines: [{ text: 'FACHSCHULE', kind: 'title' }],
    },
    {
      id: 'fachschule-d',
      category: 'advancedVocational',
      x: 956,
      y: 70,
      width: 110,
      height: 68,
      lines: [{ text: 'FACHSCHULE', kind: 'title' }],
    },
    {
      id: 'berufsvorbereitung-left',
      category: 'vocationalTraining',
      x: 54,
      y: 326,
      width: 108,
      height: 220,
      lines: [
        { text: 'BERUFSVOR-', kind: 'title' },
        { text: 'BEREITUNGS-', kind: 'title' },
        { text: 'JAHR', kind: 'title' },
        { text: 'Bildungsvorbereitende', kind: 'tiny' },
        { text: 'Maßnahmen', kind: 'tiny' },
        { text: 'nach POS', kind: 'tiny' },
      ],
      lineHeight: 15,
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
      lines: [{ text: 'Abschluss', kind: 'small' }, { text: 'Klasse 10', kind: 'small' }],
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
      lines: [{ text: 'Abschluss', kind: 'small' }, { text: 'Klasse 9', kind: 'small' }],
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
      x: 276,
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
      x: 276,
      y: 436,
      width: 190,
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
      width: 390,
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
      x: 1068,
      y: 326,
      width: 86,
      height: 110,
      lines: [{ text: 'FACH-', kind: 'title' }, { text: 'OBER-', kind: 'title' }, { text: 'SCHULE', kind: 'title' }],
      lineHeight: 20,
    },
    {
      id: 'fos-plus',
      category: 'advancedVocational',
      x: 1160,
      y: 216,
      width: 48,
      height: 220,
      lines: [{ text: 'FOS+', kind: 'title' }],
    },
    {
      id: 'berufliches-gymnasium',
      category: 'studyQualification',
      x: 1214,
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
      x: 1348,
      y: 216,
      width: 56,
      height: 220,
      lines: [{ text: 'DUBAS', kind: 'title' }],
    },
    {
      id: 'eos-secondary-ii',
      category: 'none',
      x: 1410,
      y: 342,
      width: 358,
      height: 72,
      noBox: true,
      lineHeight: 20,
      lines: [
        { text: 'ERWEITERTE OBERSCHULE', kind: 'title' },
        { text: 'Allgemeine Hochschulreife', kind: 'emphasis' },
        { text: 'Jahrgangsstufen 11 und 12', kind: 'emphasis' },
      ],
    },
    {
      id: 'pos-secondary-i',
      category: 'none',
      x: 560,
      y: 586,
      width: 650,
      height: 112,
      noBox: true,
      lineHeight: 22,
      textY: 590,
      lines: [
        { text: 'POLYTECHNISCHE OBERSCHULE', kind: 'title' },
        { text: 'Sekundarstufe I, Klassenstufen 5 bis 10', kind: 'small' },
        { text: 'Abschlüsse nach Klassenstufe 9 und 10', kind: 'small' },
        { text: 'polytechnische Bildung und Berufsorientierung', kind: 'emphasis' },
      ],
    },
    {
      id: 'orientation-center',
      category: 'none',
      x: 700,
      y: 712,
      width: 430,
      height: 34,
      noBox: true,
      lines: [{ text: 'Übergang nach Klasse 10: EOS oder berufliche Bildung', kind: 'emphasis' }],
    },
    {
      id: 'pos-secondary-i-right',
      category: 'none',
      x: 1408,
      y: 560,
      width: 330,
      height: 44,
      noBox: true,
      lines: [{ text: 'POLYTECHNISCHE OBERSCHULE', kind: 'title' }, { text: 'Sekundarstufe I', kind: 'emphasis' }],
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
      id: 'pos-primary',
      category: 'none',
      x: 710,
      y: 810,
      width: 420,
      height: 40,
      noBox: true,
      lines: [{ text: 'POLYTECHNISCHE OBERSCHULE', kind: 'title' }],
    },
    {
      id: 'pos-primary-note',
      category: 'none',
      x: 720,
      y: 922,
      width: 300,
      height: 28,
      noBox: true,
      lines: [{ text: 'Primarstufe, Klassenstufen 1 bis 4', kind: 'emphasis' }],
    },
    {
      id: 'pos-primary-right',
      category: 'none',
      x: 1558,
      y: 840,
      width: 200,
      height: 82,
      noBox: true,
      textX: 1648,
      lines: [
        { text: 'POS', kind: 'title' },
        { text: 'Primarstufe', kind: 'emphasis' },
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
  ],
};

export const schoolSystemTableRows: SchoolSystemTableRow[] = [
  {
    id: 'grundschule-row',
    label: 'Polytechnische Oberschule (Primarstufe)',
    period: 'Klassenstufen 1 bis 4',
    completion: 'Übergang in die Sekundarstufe I derselben Schulart',
    connections: 'Polytechnische Oberschule in der Sekundarstufe I oder Förderschule nach individuellem Bedarf',
  },
  {
    id: 'foerderschule-row',
    label: 'Förderschule',
    period: 'je nach Förderschwerpunkt in Primarstufe und Sekundarstufe I',
    completion: 'Abschlüsse allgemeinbildender Schularten nach individuellem Bildungsgang möglich',
    connections: 'Polytechnische Oberschule, berufsvorbereitende Angebote oder berufliche Ausbildung',
  },
  {
    id: 'oberschule-row',
    label: 'Polytechnische Oberschule (Sekundarstufe I)',
    period: 'Klassenstufen 5 bis 10',
    completion: 'Abschluss am Ende der Klassenstufe 9 und Abschluss am Ende der Klassenstufe 10',
    connections: 'Erweiterte Oberschule, Berufsschule, Berufsfachschule, Fachoberschule, Berufliches Gymnasium oder Ausbildung',
  },
  {
    id: 'gymnasium-row',
    label: 'Erweiterte Oberschule',
    period: 'Jahrgangsstufen 11 und 12',
    completion: 'Allgemeine Hochschulreife',
    connections: 'Hochschule, Berufsausbildung, DUBAS oder weitere Qualifizierungswege',
  },
  {
    id: 'gemeinschaftsschule-row',
    label: 'Übergang in die Erweiterte Oberschule',
    period: 'nach Abschluss der Polytechnischen Oberschule',
    completion: 'Aufnahme bei Eignung nach Leistung und Begabung',
    connections: 'Erweiterte Oberschule oder berufs- und studienqualifizierende Bildungsgänge',
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
    title: 'Polytechnische Oberschule: Primarstufe',
    text: [
      'Die Polytechnische Oberschule ist die Regelschule der allgemeinbildenden Vollzeitschulpflicht. In der Primarstufe umfasst sie die Klassenstufen 1 bis 4 und vermittelt eine gemeinsame Grundbildung.',
      'Sie schafft die Grundlagen für die weitere Bildung in der Sekundarstufe I derselben Schulart.',
    ],
  },
  {
    id: 'oberschule-card',
    group: 'Allgemeinbildende Schulen',
    title: 'Polytechnische Oberschule: Sekundarstufe I',
    text: [
      'Die Sekundarstufe I der Polytechnischen Oberschule umfasst die Klassenstufen 5 bis 10.',
      'Sie verbindet vertiefte allgemeine Bildung mit polytechnischer Bildung, informationstechnischer Grundbildung sowie Berufs- und Studienorientierung.',
      'Abschlüsse werden am Ende der Klassenstufe 9 und am Ende der Klassenstufe 10 erworben.',
    ],
  },
  {
    id: 'gymnasium-card',
    group: 'Allgemeinbildende Schulen',
    title: 'Erweiterte Oberschule',
    text: [
      'Die Erweiterte Oberschule ist die Schulart der Sekundarstufe II und umfasst die Jahrgangsstufen 11 und 12.',
      'Sie führt zur allgemeinen Hochschulreife. Die Aufnahme setzt nach Abschluss der Polytechnischen Oberschule die erforderliche Eignung nach Leistung und Begabung voraus.',
    ],
  },
  {
    id: 'gemeinschaftsschule-card',
    group: 'Allgemeinbildende Schulen',
    title: 'Übergänge aus bisherigen Schularten',
    text: [
      'Bisherige Grundschulen, Oberschulen, Gymnasien und Gemeinschaftsschulen werden nach den Übergangsregelungen in die neue Struktur überführt.',
      'Maßgeblich sind künftig die Polytechnische Oberschule in Primarstufe und Sekundarstufe I sowie die Erweiterte Oberschule in der Sekundarstufe II.',
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
      'Das Berufliche Gymnasium verbindet die Sekundarstufe II mit beruflich geprägten Schwerpunkten.',
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
      'Die tabellarische Übersicht zeigt die wichtigsten schulischen und beruflichen Wege in vereinfachter Form.',
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
