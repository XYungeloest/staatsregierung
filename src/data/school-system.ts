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

export const schoolSystemTableRows: SchoolSystemTableRow[] = [
  {
    id: 'pos-row',
    label: 'Polytechnische Oberschule (POS)',
    period: 'Klassenstufen 1 bis 10: Primarstufe 1 bis 4 und Sekundarstufe I 5 bis 10 innerhalb derselben Schulart',
    completion: 'Abschluss der Polytechnischen Oberschule nach Klassenstufe 9 oder nach Klassenstufe 10',
    connections: 'Berufliche Bildung; nach Klassenstufe 10 bei entsprechender Eignung Erweiterte Oberschule',
  },
  {
    id: 'eos-row',
    label: 'Erweiterte Oberschule (EOS)',
    period: 'Jahrgangsstufen 11 und 12; vier Kurshalbjahre von 11/I bis 12/II',
    completion: 'Allgemeine Hochschulreife',
    connections: 'Hochschule, Berufsausbildung oder weitere Qualifizierung',
  },
  {
    id: 'foerderschule-row',
    label: 'Förderschule',
    period: 'nach Bildungsgang und individuellem Förderbedarf',
    completion: 'Lernzielgleiche Abschlüsse und weitere Abschlüsse nach Maßgabe des jeweiligen Bildungsgangs',
    connections: 'Übergänge zur POS, zur EOS und in berufliche Bildung sind möglich',
  },
  {
    id: 'berufsschule-row',
    label: 'Berufsschule',
    period: 'während einer dualen Ausbildung oder in berufsvorbereitenden Bildungsgängen',
    completion: 'Beruflicher Abschluss nach Maßgabe des Bildungsgangs',
    connections: 'Erwerbstätigkeit, Fachschule oder weitere berufliche Qualifizierung',
  },
  {
    id: 'berufsfachschule-row',
    label: 'Berufsfachschule',
    period: 'vollzeitschulische berufliche Bildungsgänge',
    completion: 'Beruflicher oder schulischer Abschluss nach Maßgabe des Bildungsgangs',
    connections: 'Erwerbstätigkeit, weitere berufliche Bildung oder Studienqualifizierung',
  },
  {
    id: 'fachoberschule-row',
    label: 'Fachoberschule',
    period: 'nach Maßgabe des jeweiligen Bildungsgangs',
    completion: 'Fachhochschulreife',
    connections: 'Hochschule, Fachschule oder weitere berufliche Qualifizierung',
  },
  {
    id: 'berufliches-gymnasium-row',
    label: 'Berufliches Gymnasium',
    period: 'Sekundarstufe II mit beruflicher Ausrichtung',
    completion: 'Allgemeine Hochschulreife',
    connections: 'Hochschule, Berufsausbildung oder weitere Qualifizierung',
  },
  {
    id: 'fachschule-row',
    label: 'Fachschule',
    period: 'berufliche Weiterbildung nach Maßgabe des Bildungsgangs',
    completion: 'Fachschulabschluss',
    connections: 'Gehobene berufliche Tätigkeit oder weitere Qualifizierung',
  },
  {
    id: 'zweiter-bildungsweg-row',
    label: 'Zweiter Bildungsweg',
    period: 'Abendoberschule, Abendgymnasium oder Kolleg',
    completion: 'POS-Abschluss nach Klassenstufe 9 oder 10 beziehungsweise allgemeine Hochschulreife',
    connections: 'Berufliche Bildung, Hochschule oder weitere Qualifizierung',
  },
];

export const schoolTypes: SchoolTypeInfo[] = [
  {
    id: 'pos-card',
    group: 'Allgemeinbildende Schulen',
    title: 'Polytechnische Oberschule (POS)',
    text: [
      'Die POS ist eine einheitliche allgemeinbildende Schulart von Klassenstufe 1 bis 10. Die Klassenstufen 1 bis 4 bilden ihre Primarstufe, die Klassenstufen 5 bis 10 ihre Sekundarstufe I. Der Übergang von Klasse 4 nach 5 ist deshalb kein Schulartwechsel.',
      'Längeres gemeinsames Lernen und individuelle Förderung verbinden sich mit technischer, wirtschaftlicher und berufspraktischer Bildung. Produktives Lernen kann als besonderer Bildungsweg angeboten werden.',
    ],
  },
  {
    id: 'eos-card',
    group: 'Allgemeinbildende Schulen',
    title: 'Erweiterte Oberschule (EOS)',
    text: [
      'Die EOS umfasst ausschließlich die Jahrgangsstufen 11 und 12. Ihre vier Kurshalbjahre 11/I bis 12/II bilden die Qualifikationsphase und führen zur allgemeinen Hochschulreife.',
      'Für Schüler:innen mit angestrebtem EOS-Übergang übernimmt Klasse 10 der POS die Funktion der Einführungsphase. Sie bleibt rechtlich und organisatorisch Teil der POS.',
      'Zur Qualifikationsphase gehört die wissenschaftlich-praktische Arbeit, die wissenschaftliches Arbeiten mit einem praktischen Anteil verbindet.',
    ],
  },
  {
    id: 'foerderschule-card',
    group: 'Allgemeinbildende Schulen',
    title: 'Förderschule',
    text: [
      'Förderschulen bleiben eine eigenständige Schulart. Sie unterstützen Schüler:innen entsprechend ihrem sonderpädagogischen Förderbedarf.',
      'Lernzielgleiche Bildungsgänge und Übergänge zur POS oder EOS sind nach individueller Entwicklung möglich.',
    ],
  },
  {
    id: 'berufsschule-card',
    group: 'Berufsbildende Schulen',
    title: 'Berufsschule',
    text: [
      'Die Berufsschule begleitet die duale Ausbildung und berufsvorbereitende Bildungsgänge.',
      'Sie verbindet betriebliche Praxis mit schulischer Fachbildung.',
    ],
  },
  {
    id: 'berufsfachschule-card',
    group: 'Berufsbildende Schulen',
    title: 'Berufsfachschule',
    text: [
      'Berufsfachschulen vermitteln berufliche Grundbildung oder führen in vollzeitschulischen Bildungsgängen zu beruflichen oder schulischen Abschlüssen.',
      'Die Einzelheiten richten sich nach dem jeweiligen Bildungsgang.',
    ],
  },
  {
    id: 'fachoberschule-card',
    group: 'Berufsbildende Schulen',
    title: 'Fachoberschule',
    text: [
      'Die Fachoberschule führt zur Fachhochschulreife und eröffnet einen Weg zum Hochschulzugang.',
      'Zugang und Dauer richten sich nach dem jeweiligen Bildungsgang.',
    ],
  },
  {
    id: 'berufliches-gymnasium-card',
    group: 'Berufsbildende Schulen',
    title: 'Berufliches Gymnasium',
    text: [
      'Das Berufliche Gymnasium verbindet die Sekundarstufe II mit einer beruflichen Ausrichtung.',
      'Der Bildungsgang führt zur allgemeinen Hochschulreife.',
    ],
  },
  {
    id: 'fachschule-card',
    group: 'Berufsbildende Schulen',
    title: 'Fachschule',
    text: [
      'Fachschulen dienen der beruflichen Weiterbildung und führen zu Fachschulabschlüssen.',
      'Aufnahme und Abschluss richten sich nach dem jeweiligen Bildungsgang.',
    ],
  },
  {
    id: 'zweiter-bildungsweg-card',
    group: 'Weitere Bildungswege',
    title: 'Abendoberschule, Abendgymnasium und Kolleg',
    text: [
      'An der Abendoberschule können Erwachsene den Abschluss der Polytechnischen Oberschule nach Klassenstufe 9 oder nach Klassenstufe 10 erwerben.',
      'Abendgymnasium und Kolleg führen zur allgemeinen Hochschulreife. Das Abendgymnasium ist berufsbegleitend angelegt, das Kolleg wird in Vollzeit besucht.',
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
      'Förderung und Unterstützung berücksichtigen Lernstand, Entwicklung sowie besondere Lern-, Sprach-, Sozial- oder Förderbedarfe.',
      'Ziel ist ein passender Bildungsweg mit verlässlichen Übergängen.',
    ],
  },
  {
    id: 'studienqualifizierung-card',
    group: 'Weitere Bildungswege',
    title: 'Studienqualifizierung und Hochschulzugang',
    text: [
      'Allgemeine Hochschulreife, Fachhochschulreife und bestimmte berufliche Qualifikationen eröffnen Wege zu Hochschulen.',
      'Welche Berechtigung gilt, richtet sich nach dem erworbenen Abschluss und den einschlägigen Bestimmungen.',
    ],
  },
];

export const educationPathNavItems = [
  { label: 'Überblick', href: '#ueberblick' },
  { label: 'Bildungswege', href: '#grafik' },
  { label: 'Allgemeinbildende Schulen', href: '#allgemeinbildende-schulen' },
  { label: 'Berufsbildende Schulen', href: '#berufsbildende-schulen' },
  { label: 'Abschlüsse und Übergänge', href: '#abschluesse-und-uebergaenge' },
  { label: 'Schulprofil und Bewertung', href: '#schulprofil-und-bewertung' },
  { label: 'Zweiter Bildungsweg', href: '#zweiter-bildungsweg' },
  { label: 'Rechtsgrundlagen', href: '#rechtsgrundlagen' },
  { label: 'Zuständige Stelle', href: '#zustaendige-stellen' },
] as const;
