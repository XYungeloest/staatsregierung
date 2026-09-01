import sourceCsv from '../../../../context/Staatshaushalt 2025_2026 - Zusammenfassung.csv?raw';

export const budgetYears = ['2025', '2026'] as const;
export type BudgetYear = (typeof budgetYears)[number];

export type BudgetPlanCategory =
  | 'Ressort'
  | 'Verfassungsorgan'
  | 'Unabhängige Stelle'
  | 'Zentrale Verwaltung'
  | 'Sonderbereich';

export interface BudgetAmounts {
  tax: number;
  administration: number;
  allocations: number;
  financingRevenue: number;
  revenue: number;
  personnel: number;
  operations: number;
  transfers: number;
  construction: number;
  investments: number;
  financingExpenses: number;
  expenses: number;
  balance: number;
  commitments: number;
}

export interface BudgetChapter {
  code: string;
  label: string;
  expenses: number;
  investments: number;
}

export interface BudgetPlan {
  number: string;
  title: string;
  sourceLabel: string;
  category: BudgetPlanCategory;
  responsibility: string;
  politicalFocus: string;
  ministrySlug?: string;
  ministryLabel?: string;
  topicSlug?: string;
  chapters: Record<BudgetYear, BudgetChapter[]>;
  amounts: Record<BudgetYear, BudgetAmounts>;
}

export interface BudgetSpecialInstrument {
  kind: 'Sondervermögen' | 'Kooperationsfonds';
  title: string;
  purpose: string;
  legalBasisSlug: string;
  legalBasisLabel: string;
  volume?: number;
  volumeLabel: string;
  duration: string;
  responsibility: string;
  coreBudgetConnection: string;
  note: string;
  topicSlug?: string;
}

export interface BudgetTaskArea {
  label: string;
  description: string;
  planNumbers: readonly string[];
  amounts: Record<BudgetYear, number>;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += character;
    }
  }

  values.push(current);
  return values;
}

function parseEuro(value: string | undefined): number {
  const normalized = (value ?? '')
    .replace(/[^0-9,-]/gu, '')
    .replace(/\./gu, '')
    .replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function parseAmounts(row: string[], offset: number): BudgetAmounts {
  return {
    tax: parseEuro(row[offset + 2]),
    administration: parseEuro(row[offset + 3]),
    allocations: parseEuro(row[offset + 4]),
    financingRevenue: parseEuro(row[offset + 5]),
    revenue: parseEuro(row[offset + 6]),
    personnel: parseEuro(row[offset + 7]),
    operations: parseEuro(row[offset + 8]),
    transfers: parseEuro(row[offset + 9]),
    construction: parseEuro(row[offset + 10]),
    investments: parseEuro(row[offset + 11]),
    financingExpenses: parseEuro(row[offset + 12]),
    expenses: parseEuro(row[offset + 13]),
    balance: parseEuro(row[offset + 14]),
    commitments: parseEuro(row[offset + 15]),
  };
}

const csvRows = sourceCsv.trim().split(/\r?\n/u).slice(1).map(parseCsvLine);

const planPresentation: Record<
  string,
  Omit<BudgetPlan, 'number' | 'sourceLabel' | 'amounts' | 'chapters'>
> = {
  '01': { title: 'Landtag', category: 'Verfassungsorgan', responsibility: 'Landtag des Freistaates', politicalFocus: 'Parlament, unabhängige Beauftragte und parlamentarische Infrastruktur.' },
  '02': { title: 'Staatskanzlei', category: 'Ressort', responsibility: 'Staatskanzlei des Ostdeutschen Freistaates', politicalFocus: 'Regierungskoordination, strategische Planung und Ehrenamt.', ministrySlug: 'staatskanzlei', ministryLabel: 'Staatskanzlei des Ostdeutschen Freistaates' },
  '03': { title: 'Inneres, Wohnen und Kommunen', category: 'Ressort', responsibility: 'Staatsministerium des Innern und für Wohnungswirtschaft', politicalFocus: 'Kommunen, Wohnungswirtschaft, innere Verwaltung und Katastrophenschutz.', ministrySlug: 'inneres-bau-und-kommunale-angelegenheiten', ministryLabel: 'Staatsministerium des Innern und für Wohnungswirtschaft', topicSlug: 'wohnen-und-vergesellschaftung' },
  '04': { title: 'Bildung und sportliche Ertüchtigung', category: 'Ressort', responsibility: 'Staatsministerium für Volksbildung und Wissenschaft', politicalFocus: 'Schulen, frühkindliche Bildung, berufliche Bildung und Wissenschaft.', ministrySlug: 'bildung-und-sportliche-ertuechtigung', ministryLabel: 'Staatsministerium für Volksbildung und Wissenschaft', topicSlug: 'bildungsreform' },
  '05': { title: 'Rechtsstaatlichkeit und Angelegenheiten des Staates', category: 'Ressort', responsibility: 'Staatsministerium für Rechtsstaatlichkeit und kulturelle Emanzipation', politicalFocus: 'Justiz, Rechtsstaatlichkeit und Verbraucherschutz.', ministrySlug: 'rechtsstaatlichkeit-und-angelegenheiten-des-staates', ministryLabel: 'Staatsministerium für Rechtsstaatlichkeit und kulturelle Emanzipation', topicSlug: 'demokratie-und-sicherheit' },
  '06': { title: 'Finanzen', category: 'Ressort', responsibility: 'Staatsministerium der Finanzen', politicalFocus: 'Steuerverwaltung, Finanzsteuerung und Beteiligungen.', ministrySlug: 'kapitalakkumulation-des-fiskus', ministryLabel: 'Staatsministerium der Finanzen', topicSlug: 'haushalt-und-finanzen' },
  '07': { title: 'Wirtschaft, Arbeitsmarkt und Beschäftigung', category: 'Ressort', responsibility: 'Staatsministerium für Wirtschaft und Arbeit', politicalFocus: 'Strukturpolitik, gute Arbeit und öffentliche Wirtschaft.', ministrySlug: 'wirtschaft-arbeitsmarkt-und-beschaeftigung', ministryLabel: 'Staatsministerium für Wirtschaft und Arbeit', topicSlug: 'oeffentliche-wirtschaft-und-strukturwandel' },
  '08': { title: 'Soziale und gesundheitliche Fürsorge', category: 'Ressort', responsibility: 'Staatsministerium für Gesundheits- und Sozialwesen', politicalFocus: 'Soziale Sicherheit, Familien, Pflege und Gesundheitsversorgung.', ministrySlug: 'soziale-und-gesundheitliche-fuersorge', ministryLabel: 'Staatsministerium für Gesundheits- und Sozialwesen', topicSlug: 'familie-und-soziales' },
  '09': { title: 'Umwelt, Energie und Klimaschutz', category: 'Ressort', responsibility: 'Staatsministerium für Nachhaltigkeit und Energie', politicalFocus: 'Energie, Klima, Umweltvorsorge und öffentliche Infrastruktur.', ministrySlug: 'umwelt-energie-und-klimaschutz', ministryLabel: 'Staatsministerium für Nachhaltigkeit und Energie', topicSlug: 'energie-und-klima' },
  '10': { title: 'Mobilität, Infrastruktur und Landesentwicklung', category: 'Ressort', responsibility: 'Staatsministerium für Mobilität und regionale Entwicklung', politicalFocus: 'ÖPNV, Verkehrswege, digitale Infrastruktur und Regionen.', ministrySlug: 'mobilitaet-infrastruktur-und-landesentwicklung', ministryLabel: 'Staatsministerium für Mobilität und regionale Entwicklung', topicSlug: 'oepnv-und-mobilitaet' },
  '11': { title: 'Kultur, Wissenschaft und Tourismus', category: 'Sonderbereich', responsibility: 'Verwaltungsbereich des Doppelhaushalts; Zuständigkeiten wurden im Kabinett Honecker II neu geordnet', politicalFocus: 'Kultur, Hochschulen, Forschung, Tourismus und studentische Angelegenheiten.', topicSlug: 'kultur-erinnerung-und-medien' },
  '12': { title: 'Völkerfreundschaft und Nachbarschaftspolitik', category: 'Ressort', responsibility: 'Staatsministerium für Völkerfreundschaft und Nachbarschaftspolitik', politicalFocus: 'Europa, Nachbarschaft und internationale Zusammenarbeit.', ministrySlug: 'voelkerfreundschaft-und-nachbarschaftspolitik', ministryLabel: 'Staatsministerium für Völkerfreundschaft und Nachbarschaftspolitik', topicSlug: 'nachbarschaft-und-europa' },
  '13': { title: 'Staats- und Grenzsicherheit', category: 'Ressort', responsibility: 'Staatsministerium für Staats- und Grenzsicherheit', politicalFocus: 'Polizei, Sicherheit und demokratisch kontrollierte Sicherheitsstrukturen.', ministrySlug: 'grenzschutz-faschismusbekaempfung-und-bewaffnete-organe', ministryLabel: 'Staatsministerium für Staats- und Grenzsicherheit', topicSlug: 'demokratie-und-sicherheit' },
  '14': { title: 'Land-, Forst- und Küstenwirtschaft', category: 'Ressort', responsibility: 'Staatsministerium für Land-, Forst- und Küstenwirtschaft', politicalFocus: 'Landwirtschaft, Forsten, Fischerei, Küstenschutz und ländliche Räume.', ministrySlug: 'kueste-fischerei-forst-und-landwirtschaft', ministryLabel: 'Staatsministerium für Land-, Forst- und Küstenwirtschaft' },
  '15': { title: 'Rechnungshof', category: 'Verfassungsorgan', responsibility: 'Rechnungshof des Freistaates Ostdeutschland', politicalFocus: 'Unabhängige Finanzkontrolle.' },
  '16': { title: 'Verfassungsgericht', category: 'Verfassungsorgan', responsibility: 'Verfassungsgerichtshof des Freistaates Ostdeutschland', politicalFocus: 'Verfassungsrechtliche Kontrolle.' },
  '17': { title: 'Informations- und Kommunikationstechnik', category: 'Zentrale Verwaltung', responsibility: 'Zentrale Informations- und Kommunikationstechnik', politicalFocus: 'Digitale Verwaltungsleistungen, IT-Betrieb und Landesrechenzentrum.' },
  '18': { title: 'Datenschutz und Transparenz', category: 'Unabhängige Stelle', responsibility: 'Ostdeutsche Datenschutz- und Transparenzbeauftragte', politicalFocus: 'Unabhängige Aufsicht, Datenschutz und Informationsfreiheit.', topicSlug: 'transparenz-und-lobbyregister' },
  '19': { title: 'Hochbau und Liegenschaften', category: 'Zentrale Verwaltung', responsibility: 'Staatliche Hochbau- und Liegenschaftsverwaltung', politicalFocus: 'Staatliche Bauten, Liegenschaften und Hochschulbau.' },
  '20': { title: 'Allgemeine Finanzverwaltung', category: 'Zentrale Verwaltung', responsibility: 'Staatsministerium der Finanzen', politicalFocus: 'Steuern, kommunaler Finanzausgleich, Versorgung, Beteiligungen und Staatsvermögen.', ministrySlug: 'kapitalakkumulation-des-fiskus', ministryLabel: 'Staatsministerium der Finanzen', topicSlug: 'haushalt-und-finanzen' },
};

/**
 * Ausgewählte Kapitel aus den 20 HTML-Blättern des Archivexports. Die Werte werden bewusst
 * nicht zu einer eigenen Summe verdichtet: Einzelne Titel können Unterpositionen eines Kapitels sein.
 */
type ArchiveChapterTuple = [string, string, number, number];

const archiveChapters: Record<string, Record<BudgetYear, ArchiveChapterTuple[]>> = {
  '01': { '2025': [['01 01', 'Ostdeutscher Landtag', 74_950_800, 1_724_300], ['01 03', 'Landesbeauftragte zur Aufarbeitung der SED-Diktatur', 11_652_500, 20_000], ['01 05', 'Landesbeauftragter für Menschen mit Behinderungen', 3_281_900, 2_025_000]], '2026': [['01 01', 'Ostdeutscher Landtag', 76_515_900, 1_881_000], ['01 02', 'Allgemeine Bewilligungen', 323_500, 0]] },
  '02': { '2025': [['02 01', 'Staatskanzlei', 263_066_700, 1_015_000], ['02 03', 'Ehrenamtsstiftung und Ehrenamt', 2_033_800, 0]], '2026': [['02 01', 'Staatskanzlei', 42_557_600, 306_500], ['02 03', 'Ehrenamtsstiftung und Ehrenamt', 1_998_800, 0]] },
  '03': { '2025': [['03 40', 'Wohnungswesen, Wohnraumförderung und Wohngeld', 2_035_540_800, 1_084_070_700], ['03 30', 'Ausländer-, Asyl-, Aussiedler- und Flüchtlingsangelegenheiten', 1_466_223_100, 38_505_000], ['03 04', 'Landesdirektion', 1_004_969_400, 20_161_600]], '2026': [['03 40', 'Wohnungswesen, Wohnraumförderung und Wohngeld', 3_053_667_900, 2_119_705_300], ['03 40 12', 'Zusätzlicher Sozialer Wohnungsbau', 6_500_000_000, 6_500_000_000], ['03 30', 'Ausländer-, Asyl-, Aussiedler- und Flüchtlingsangelegenheiten', 1_402_011_900, 42_772_000]] },
  '04': { '2025': [['04 08', 'Grundschulen', 4_213_093_600, 0], ['04 05', 'Förderung der Kindertageseinrichtungen und Kindertagespflege', 2_652_517_700, 14_797_000], ['04 11', 'Gymnasien', 2_446_411_100, 0]], '2026': [['04 10', 'Polytechnische Oberschule', 8_146_378_500, 0], ['04 20', 'Förderung der Bildungsinfrastruktur, Schulbau', 5_828_132_000, 143_157_400], ['04 05', 'Förderung der Kindertageseinrichtungen und Kindertagespflege', 2_488_222_900, 14_797_000]] },
  '05': { '2025': [['05 04', 'Ordentliche Gerichte und Staatsanwaltschaften', 2_778_423_200, 123_045_400], ['05 05', 'Justizvollzugseinrichtungen und Sicherungsverwahrung', 874_183_900, 18_339_100], ['05 14', 'Verbraucherschutz', 229_599_600, 10_267_600]], '2026': [['05 04', 'Ordentliche Gerichte und Staatsanwaltschaften', 2_698_615_300, 30_165_400], ['05 05', 'Justizvollzugseinrichtungen und Sicherungsverwahrung', 1_032_362_000, 18_395_800], ['05 14', 'Verbraucherschutz', 222_231_500, 10_365_300]] },
  '06': { '2025': [['06 04', 'Finanzämter', 1_800_561_100, 31_707_000], ['06 03', 'Landesamt für Steuern und Finanzen', 171_158_100, 2_896_300], ['06 02', 'Allgemeine Bewilligungen', 46_331_400, 7_001_000]], '2026': [['06 08 01', 'Landesbank ElbeLB', 40_000_000_000, 37_550_000_000], ['06 04', 'Finanzämter', 1_876_584_400, 47_960_300], ['06 03', 'Landesamt für Steuern und Finanzen', 187_762_400, 979_000]] },
  '07': { '2025': [['07 03', 'Allgemeine Wirtschafts- und Strukturförderung', 2_076_224_200, 1_341_376_600], ['07 04', 'Förderung der beruflichen Bildung und Bekämpfung der Arbeitslosigkeit', 881_475_400, 6_839_400], ['07 10', 'Europäische Struktur- und Investitionsfonds', 865_027_600, 318_783_400]], '2026': [['07 03', 'Allgemeine Wirtschafts- und Strukturförderung', 1_895_112_700, 1_170_533_800], ['07 03 12', 'Förderung „DDR5-Fabrik“ der Nvidia Corporation', 900_000_000, 0], ['07 10', 'Europäische Struktur- und Investitionsfonds', 988_304_300, 401_072_300]] },
  '08': { '2025': [['08 03', 'Soziale Mindestsicherung und Sozialhilfe', 4_091_670_700, 4_318_800], ['08 06', 'Kinder und Jugendliche, Familien', 1_548_979_600, 55_809_700], ['08 04', 'Soziales', 1_317_654_100, 23_119_900]], '2026': [['08 03', 'Soziale Mindestsicherung und Sozialhilfe', 4_506_641_900, 340_933_200], ['08 06', 'Kinder und Jugendliche, Familien', 1_689_002_100, 29_730_600], ['08 06 26', 'Fördertopf Familienstartdarlehen', 512_000_000, 0]] },
  '09': { '2025': [['09 04', 'Klima-, Umwelt- und Naturschutz', 505_845_700, 138_898_700], ['09 10', 'Landesamt für Umwelt und Naturschutz', 412_820_200, 10_578_900], ['09 02', 'Allgemeine Bewilligungen', 296_005_300, 129_605_000]], '2026': [['09 03 12', 'Übernahme „50Hertz Transmission GmbH“', 1_500_000_000, 1_500_000_000], ['09 10', 'Landesamt für Umwelt und Naturschutz', 430_473_100, 11_448_100], ['09 04', 'Klima-, Umwelt- und Naturschutz', 332_507_600, 56_899_100]] },
  '10': { '2025': [['10 11', 'Finanzierung des öffentlichen Personennahverkehrs', 5_796_994_800, 722_584_000], ['10 10', 'Straßen- und Brückenbau', 1_597_538_800, 220_214_800], ['10 20', 'Regional- und Strukturentwicklung, Landesplanung', 317_553_100, 274_659_800]], '2026': [['10 11', 'Finanzierung des öffentlichen Personennahverkehrs', 5_439_572_800, 623_648_400], ['10 11 02', 'Ausgleich Unterdeckung OVV', 2_348_399_000, 0], ['10 10', 'Straßen- und Brückenbau', 1_468_460_600, 282_437_800]] },
  '11': { '2025': [['11 06', 'Sammelansatz für die Hochschulen', 4_413_707_400, 531_126_900], ['11 05', 'Förderung der Kunst und Kultur', 1_573_673_900, 173_657_100], ['11 02', 'Allgemeine Bewilligungen', 802_394_700, 154_525_900]], '2026': [['11 06', 'Sammelansatz für die Hochschulen', 3_948_477_500, 326_244_400], ['11 05', 'Förderung der Kunst und Kultur', 1_544_749_000, 148_925_900], ['11 07', 'Außeruniversitäre Forschungsförderung gemäß GWK-Abkommen', 1_042_079_700, 310_233_900]] },
  '12': { '2025': [['12 01', 'Ministerium', 15_069_200, 50_000], ['12 04', 'Europapolitik, EU-Angelegenheiten, Internationale Beziehungen und Entwicklungszusammenarbeit', 12_826_600, 36_500], ['12 02', 'Landesvertretung beim Bund', 3_394_900, 47_500]], '2026': [['12 01', 'Ministerium', 15_844_000, 80_000], ['12 04', 'Europapolitik, EU-Angelegenheiten, Internationale Beziehungen und Entwicklungszusammenarbeit', 13_722_000, 96_000], ['12 02', 'Landesvertretung beim Bund', 3_562_800, 47_500]] },
  '13': { '2025': [['13 02', 'Landespolizei', 4_498_904_300, 107_277_000], ['13 05', 'Bereitschaftspolizei', 465_764_400, 44_324_500], ['13 03', 'Landeskriminalamt', 461_765_800, 10_989_400]], '2026': [['13 02', 'Landespolizei', 4_616_693_800, 126_781_300], ['13 05', 'Bereitschaftspolizei', 492_018_600, 47_815_100], ['13 03', 'Landeskriminalamt', 467_237_200, 11_421_000]] },
  '14': { '2025': [['14 11', 'Förderung durch die EU – ELER 2023–2027', 549_283_200, 187_024_000], ['14 10', 'Förderung durch die EU – ELER 2014–2022', 354_599_800, 86_791_400], ['14 03', 'Gemeinschaftsaufgabe Agrarstruktur und Küstenschutz', 316_638_400, 189_507_600]], '2026': [['14 11', 'Förderung durch die EU – ELER 2023–2027', 659_193_200, 208_388_800], ['14 03', 'Gemeinschaftsaufgabe Agrarstruktur und Küstenschutz', 298_561_700, 177_652_500], ['14 04', 'Maßnahmen für Forsten', 163_889_700, 15_856_900]] },
  '15': { '2025': [['15 01', 'Rechnungshof des Freistaates Ostdeutschland', 63_348_500, 164_500], ['15 05', 'Staatliche Rechnungsprüfungsämter – Kommunen', 6_765_800, 0], ['15 02', 'Sammelansätze für den Gesamtbereich des Einzelplans 15', 1_969_900, 126_400]], '2026': [['15 01', 'Rechnungshof des Freistaates Ostdeutschland', 97_575_800, 712_400], ['15 05', 'Staatliche Rechnungsprüfungsämter – Kommunen', 7_061_100, 0], ['15 02', 'Sammelansätze für den Gesamtbereich des Einzelplans 15', 1_926_400, 18_000]] },
  '16': { '2025': [['16 01', 'Verfassungsgerichtshof des Freistaates Ostdeutschland', 1_366_300, 60_000]], '2026': [['16 01', 'Verfassungsgerichtshof des Freistaates Ostdeutschland', 2_198_900, 60_000]] },
  '17': { '2025': [['17 21', 'E-Government', 586_991_900, 60_366_900], ['17 03', 'Informations- und Kommunikationstechnik des Innenressorts', 79_225_100, 16_193_900], ['17 06', 'Informations- und Kommunikationstechnik des Finanzressorts', 76_693_600, 9_549_500]], '2026': [['17 21', 'E-Government', 582_995_700, 52_811_700], ['17 06', 'Informations- und Kommunikationstechnik des Finanzressorts', 85_772_000, 2_791_200], ['17 03', 'Informations- und Kommunikationstechnik des Innenressorts', 83_252_800, 22_289_300]] },
  '18': { '2025': [['18 01', 'Ostdeutsche Datenschutz- und Transparenzbeauftragte', 31_807_300, 608_500]], '2026': [['18 01', 'Ostdeutsche Transparenz- und Informationsfreiheitsbeauftragte', 40_752_400, 8_916_600], ['18 01 01', 'Einführung OstTranspIFG', 3_236_200, 1_202_600]] },
  '19': { '2025': [['19 40', 'Staatliche Hochbaumaßnahmen: Ausbau und Neubau von Hochschulen', 446_172_500, 24_908_900], ['19 21', 'Hochbau- und Liegenschaftsverwaltung', 279_434_300, 2_564_300], ['19 05', 'Staatliche Hochbaumaßnahmen im Bereich Rechtsstaatlichkeit', 129_836_000, 16_194_600]], '2026': [['19 40', 'Staatliche Hochbaumaßnahmen: Ausbau und Neubau von Hochschulen', 428_608_900, 26_301_300], ['19 21', 'Hochbau- und Liegenschaftsverwaltung', 285_844_200, 2_009_500], ['19 03', 'Staatliche Hochbaumaßnahmen im Bereich Inneres und Wohnen', 125_454_600, 0]] },
  '20': { '2025': [['20 30', 'Kommunaler Finanzausgleich', 14_661_836_000, 1_061_412_100], ['20 40', 'Versorgung und Beihilfen', 6_279_955_400, 0], ['20 10', 'Kapital und Schulden', 1_958_893_900, 38_001_000]], '2026': [['20 03 122', 'Zuschuss an die Landesbank ElbeLB', 20_000_000_000, 0], ['20 30', 'Kommunaler Finanzausgleich', 14_346_685_100, 976_870_600], ['20 40', 'Versorgung und Beihilfen', 6_814_058_400, 0]] },
};

function toChapter([code, label, expenses, investments]: [string, string, number, number]): BudgetChapter {
  return { code, label, expenses, investments };
}

export const budgetPlans: BudgetPlan[] = csvRows
  .filter((row) => /^\d{1,2}$/u.test(row[0] ?? ''))
  .map((row) => {
    const number = String(Number(row[0])).padStart(2, '0');
    const presentation = planPresentation[number];

    if (!presentation) {
      throw new Error(`Haushaltsdaten ohne Präsentationskontext für Einzelplan ${number}.`);
    }

    return {
      number,
      sourceLabel: row[1],
      ...presentation,
      amounts: { '2025': parseAmounts(row, 0), '2026': parseAmounts(row, 17) },
      chapters: {
        '2025': archiveChapters[number]['2025'].map(toChapter),
        '2026': archiveChapters[number]['2026'].map(toChapter),
      },
    };
  });

const totalsRow = csvRows.find((row) => row[0] === 'Summe 2025');

if (!totalsRow) {
  throw new Error('Die Summenzeile des Doppelhaushalts konnte nicht gelesen werden.');
}

export const budgetTotals: Record<BudgetYear, BudgetAmounts> = {
  '2025': parseAmounts(totalsRow, 0),
  '2026': parseAmounts(totalsRow, 17),
};

export const budgetSpecialInstruments: BudgetSpecialInstrument[] = [
  {
    kind: 'Sondervermögen',
    title: 'Krankenhaussicherungs- und Rekommunalisierungsfonds',
    purpose: 'Sicherung versorgungsnotwendiger Krankenhäuser und Unterstützung von Rekommunalisierungen.',
    legalBasisSlug: 'ostdeutsches-krankenhaussicherungsund-rekommunalisierungsfondsgesetz',
    legalBasisLabel: 'Ostdeutsches Krankenhaussicherungs- und Rekommunalisierungsfondsgesetz',
    volumeLabel: 'Im Rechtsbestand nicht beziffert',
    duration: 'Das Sondervermögen ist gesetzlich eingerichtet; einzelne Landesbeteiligungen sind grundsätzlich auf bis zu fünf Jahre befristet und können einmalig verlängert werden.',
    responsibility: 'Das für Gesundheit zuständige Staatsministerium bewirtschaftet den Fonds; das Finanzressort verwaltet ihn und führt die Vermögens- und Finanzrechnung.',
    coreBudgetConnection: 'Zuführungen aus dem Landeshaushalt sowie Mittel aus Rücklagen oder Kreditmarktmitteln können durch Haushaltsgesetz zugewiesen werden. Das Sondervermögen wird getrennt vom übrigen Landesvermögen geführt.',
    note: 'Zweckgebundenes Sondervermögen; keine Position eines Einzelplans.',
    topicSlug: 'krankenhausfonds',
  },
  {
    kind: 'Kooperationsfonds',
    title: 'Nachbarschaftsfonds mit der Republik Polen',
    purpose: 'Kofinanzierung von Pilot- und Kleinprojekten sowie Machbarkeitsstudien im grenzüberschreitenden Raum.',
    legalBasisSlug: 'zwischen-dem-freistaat-ostdeutschland-und-der-republik-polen-1p4h4x1',
    legalBasisLabel: 'Nachbarschaftsabkommen mit der Republik Polen',
    volume: 25_000_000,
    volumeLabel: 'Mindestens 25 Mio. € jährlich aus dem Freistaat, vorbehaltlich des jeweiligen Haushaltsverfahrens',
    duration: 'Zehn Jahre; die Vereinbarung enthält Regelungen zur Verlängerung und Kündigung.',
    responsibility: 'Zuständige Stellen der Vertragsparteien und die Nachbarschaftskommission.',
    coreBudgetConnection: 'Die jährliche Ausstattung steht unter Haushaltsvorbehalt. Der Fonds ist kein Einzelplan und kein im Gesamtplan separat ausgewiesenes Sondervermögen.',
    note: 'Zweckgebundener Kooperationsfonds, kein Sondervermögen des Landes.',
    topicSlug: 'nachbarschaft-und-europa',
  },
  {
    kind: 'Kooperationsfonds',
    title: 'Nachbarschaftsfonds mit der Tschechischen Republik',
    purpose: 'Finanzierung lokaler Vorhaben über ein Kleinprojektefenster der grenzüberschreitenden Zusammenarbeit.',
    legalBasisSlug: 'zwischen-dem-freistaat-ostdeutschland-und-der-tschechischen-nmd9np',
    legalBasisLabel: 'Nachbarschaftsabkommen mit der Tschechischen Republik',
    volume: 20_000_000,
    volumeLabel: 'Mindestens 20 Mio. € jährlich aus dem Freistaat, vorbehaltlich des jeweiligen Haushaltsverfahrens',
    duration: 'Zehn Jahre; Verlängerung um jeweils fünf Jahre möglich.',
    responsibility: 'Zuständige Stellen der Vertragsparteien und die gemeinsame Kommission.',
    coreBudgetConnection: 'Die Mindestausstattung steht unter Haushaltsvorbehalt. Sie ist nicht als eigener Einzelplan im Gesamthaushalt ausgewiesen.',
    note: 'Zweckgebundener Kooperationsfonds, kein Sondervermögen des Landes.',
    topicSlug: 'nachbarschaft-und-europa',
  },
];

export function getBudgetChange(plan: BudgetPlan, field: keyof BudgetAmounts = 'expenses') {
  const previous = plan.amounts['2025'][field];
  const current = plan.amounts['2026'][field];
  const absolute = current - previous;
  return { previous, current, absolute, percent: previous === 0 ? null : absolute / previous };
}

export function getBudgetShare(amount: number, total: number): number | null {
  return total === 0 ? null : amount / total;
}

export function getRevenueBreakdown(year: BudgetYear) {
  const amounts = budgetTotals[year];
  return [
    { label: 'Steuern und steuerähnliche Abgaben', amount: amounts.tax },
    { label: 'Verwaltungseinnahmen und Schuldendienst', amount: amounts.administration },
    { label: 'Zuweisungen und Zuschüsse', amount: amounts.allocations },
    { label: 'Weitere Finanzierungseinnahmen', amount: amounts.financingRevenue },
  ];
}

export function getExpenseBreakdown(year: BudgetYear) {
  const amounts = budgetTotals[year];
  return [
    { label: 'Personalausgaben', amount: amounts.personnel },
    { label: 'Sächliche Verwaltung und Schuldendienst', amount: amounts.operations },
    { label: 'Zuweisungen und Zuschüsse', amount: amounts.transfers },
    { label: 'Baumaßnahmen', amount: amounts.construction },
    { label: 'Investitionen und Investitionsförderung', amount: amounts.investments },
    { label: 'Besondere Finanzierungsausgaben', amount: amounts.financingExpenses },
  ];
}

const budgetTaskAreaDefinitions = [
  {
    label: 'Bildung, Jugend und Kultur',
    description: 'Schulen, Hochschulen, frühkindliche Bildung, Kultur und Wissenschaft.',
    planNumbers: ['04', '11'],
  },
  {
    label: 'Soziales und Gesundheit',
    description: 'Soziale Sicherung, Familien, Pflege und Gesundheitsversorgung.',
    planNumbers: ['08'],
  },
  {
    label: 'Inneres, Recht und Sicherheit',
    description: 'Kommunen, Wohnen, Justiz, Polizei und Sicherheitsstrukturen.',
    planNumbers: ['03', '05', '13'],
  },
  {
    label: 'Wirtschaft, Umwelt und Landwirtschaft',
    description: 'Arbeit, Strukturpolitik, Energie, Klima, Land- und Forstwirtschaft.',
    planNumbers: ['07', '09', '14'],
  },
  {
    label: 'Infrastruktur, Verkehr und Bauen',
    description: 'Mobilität, regionale Entwicklung, staatlicher Hochbau und Liegenschaften.',
    planNumbers: ['10', '19'],
  },
  {
    label: 'Innovation und Digitalisierung',
    description: 'Informations- und Kommunikationstechnik sowie Transparenzaufsicht.',
    planNumbers: ['17', '18'],
  },
  {
    label: 'Allgemeine Finanzverwaltung',
    description: 'Steuern, kommunaler Finanzausgleich, Versorgung, Beteiligungen und Staatsvermögen.',
    planNumbers: ['20'],
  },
  {
    label: 'Zentrale Leistungen und Verfassungsorgane',
    description: 'Landtag, Staatskanzlei, Finanzsteuerung, internationale Zusammenarbeit und unabhängige Verfassungsorgane.',
    planNumbers: ['01', '02', '06', '12', '15', '16'],
  },
] as const;

export function getBudgetTaskAreas(): BudgetTaskArea[] {
  return budgetTaskAreaDefinitions.map((definition) => ({
    ...definition,
    amounts: {
      '2025': budgetPlans
        .filter((plan) => (definition.planNumbers as readonly string[]).includes(plan.number))
        .reduce((sum, plan) => sum + plan.amounts['2025'].expenses, 0),
      '2026': budgetPlans
        .filter((plan) => (definition.planNumbers as readonly string[]).includes(plan.number))
        .reduce((sum, plan) => sum + plan.amounts['2026'].expenses, 0),
    },
  }));
}
