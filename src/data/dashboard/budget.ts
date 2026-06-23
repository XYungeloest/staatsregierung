import { getNormUrl } from '../../lib/norms/routes.ts';
import type {
  BudgetCategory,
  BudgetExplorerEntry,
  BudgetSpecialFund,
  BudgetSummaryRow,
  BudgetYear,
} from '../../lib/portal/modules.ts';

interface BudgetPlanSource {
  plan: string;
  label: string;
  category: BudgetCategory;
  amounts: Record<BudgetYear, { expense: number; investments: number }>;
}

/**
 * Normalisierte Zusammenfassung der Haushaltsdaten aus
 * context/Staatshaushalt 2025_2026 - Zusammenfassung.csv.
 *
 * Die Website lädt nur diese kompakten, buildzeitbasierten Werte. Der Rohdatenauszug bleibt
 * außerhalb des ausgelieferten Portals und kann mit einem späteren Importer aktualisiert werden.
 */
export const budgetDataSource = {
  label: 'Haushaltsdaten des Ostdeutschen Freistaates',
  sourceFile: 'Staatshaushalt 2025_2026 - Zusammenfassung.csv',
  status: 'Haushaltsgesetz' as const,
};

export const budgetSummaryRows: BudgetSummaryRow[] = [
  {
    year: '2025',
    state: 'Haushaltsgesetz',
    totalRevenue: 104_726_510_200,
    totalExpense: 104_726_510_200,
    taxRevenue: 85_589_873_000,
    personnel: 27_906_003_900,
    transfers: 52_580_168_000,
    investments: 12_628_645_600,
    revenueBreakdown: [
      { label: 'Steuern und steuerähnliche Abgaben', amount: 85_589_873_000 },
      { label: 'Verwaltungseinnahmen und Schuldendienst', amount: 3_434_036_600 },
      { label: 'Zuweisungen und Zuschüsse', amount: 18_266_710_200 },
      { label: 'Weitere Finanzierungseinnahmen', amount: -2_564_109_600 },
    ],
    expenseBreakdown: [
      { label: 'Personalausgaben', amount: 27_906_003_900 },
      { label: 'Sächliche Verwaltung und Schuldendienst', amount: 8_665_981_300 },
      { label: 'Zuweisungen und Zuschüsse', amount: 52_580_168_000 },
      { label: 'Baumaßnahmen', amount: 1_183_370_700 },
      { label: 'Investitionen und Investitionsförderung', amount: 12_628_645_600 },
      { label: 'Besondere Finanzierungsausgaben', amount: 1_762_340_700 },
    ],
  },
  {
    year: '2026',
    state: 'Haushaltsgesetz',
    totalRevenue: 177_808_943_700,
    totalExpense: 177_808_943_700,
    taxRevenue: 88_875_926_900,
    personnel: 29_037_907_300,
    transfers: 80_865_709_800,
    investments: 60_708_348_800,
    revenueBreakdown: [
      { label: 'Steuern und steuerähnliche Abgaben', amount: 88_875_926_900 },
      { label: 'Verwaltungseinnahmen und Schuldendienst', amount: 5_395_035_000 },
      { label: 'Zuweisungen und Zuschüsse', amount: 18_972_583_200 },
      { label: 'Weitere Finanzierungseinnahmen', amount: 64_565_398_600 },
    ],
    expenseBreakdown: [
      { label: 'Personalausgaben', amount: 29_037_907_300 },
      { label: 'Sächliche Verwaltung und Schuldendienst', amount: 12_698_504_500 },
      { label: 'Zuweisungen und Zuschüsse', amount: 80_865_709_800 },
      { label: 'Baumaßnahmen', amount: 1_386_824_900 },
      { label: 'Investitionen und Investitionsförderung', amount: 60_708_348_800 },
      { label: 'Besondere Finanzierungsausgaben', amount: -6_888_351_600 },
    ],
  },
];

const budgetPlans: BudgetPlanSource[] = [
  { plan: '01', label: 'Landtag', category: 'Verfassungsorgan', amounts: { '2025': { expense: 85_607_700, investments: 3_811_300 }, '2026': { expense: 94_404_100, investments: 12_081_000 } } },
  { plan: '02', label: 'Staatskanzlei', category: 'Ressort', amounts: { '2025': { expense: 263_354_900, investments: 1_015_000 }, '2026': { expense: 48_446_700, investments: 551_500 } } },
  { plan: '03', label: 'Inneres, Bau und kommunale Angelegenheiten', category: 'Ressort', amounts: { '2025': { expense: 6_091_590_800, investments: 1_784_735_900 }, '2026': { expense: 13_884_781_600, investments: 9_368_798_200 } } },
  { plan: '04', label: 'Bildung und sportliche Ertüchtigung', category: 'Ressort', amounts: { '2025': { expense: 20_543_792_600, investments: 515_363_600 }, '2026': { expense: 25_969_728_200, investments: 443_926_700 } } },
  { plan: '05', label: 'Rechtsstaatlichkeit und Angelegenheiten des Staates', category: 'Ressort', amounts: { '2025': { expense: 4_399_378_000, investments: 180_379_200 }, '2026': { expense: 4_508_440_700, investments: 106_233_300 } } },
  { plan: '06', label: 'Kapitalakkumulation des Fiskus', category: 'Ressort', amounts: { '2025': { expense: 2_083_397_500, investments: 43_845_800 }, '2026': { expense: 42_165_264_500, investments: 37_604_685_300 } } },
  { plan: '07', label: 'Wirtschaft, Arbeitsmarkt und Beschäftigung', category: 'Ressort', amounts: { '2025': { expense: 4_638_217_600, investments: 1_981_838_300 }, '2026': { expense: 5_436_107_800, investments: 1_857_235_400 } } },
  { plan: '08', label: 'Soziale und gesundheitliche Fürsorge', category: 'Ressort', amounts: { '2025': { expense: 9_787_543_300, investments: 1_076_494_100 }, '2026': { expense: 11_601_458_800, investments: 1_471_210_900 } } },
  { plan: '09', label: 'Umwelt, Energie und Klimaschutz', category: 'Ressort', amounts: { '2025': { expense: 1_721_765_700, investments: 417_085_000 }, '2026': { expense: 3_074_929_200, investments: 1_844_543_600 } } },
  { plan: '10', label: 'Mobilität, Infrastruktur und Landesentwicklung', category: 'Ressort', amounts: { '2025': { expense: 8_428_812_700, investments: 1_608_223_200 }, '2026': { expense: 10_396_529_600, investments: 1_670_831_400 } } },
  { plan: '11', label: 'Kultur, Wissenschaft und Tourismus', category: 'Ressort', amounts: { '2025': { expense: 10_354_479_500, investments: 1_503_656_800 }, '2026': { expense: 10_824_559_300, investments: 1_714_909_300 } } },
  { plan: '12', label: 'Völkerfreundschaft und Nachbarschaftspolitik', category: 'Ressort', amounts: { '2025': { expense: 31_998_800, investments: 134_000 }, '2026': { expense: 104_022_100, investments: 223_500 } } },
  { plan: '13', label: 'Grenzschutz, Faschismusbekämpfung und bewaffnete Organe', category: 'Ressort', amounts: { '2025': { expense: 6_092_923_300, investments: 236_789_700 }, '2026': { expense: 6_345_869_500, investments: 349_957_300 } } },
  { plan: '14', label: 'Küste, Fischerei, Forst und Landwirtschaft', category: 'Ressort', amounts: { '2025': { expense: 1_791_615_800, investments: 520_230_200 }, '2026': { expense: 1_538_448_500, investments: 448_102_600 } } },
  { plan: '15', label: 'Rechnungshof', category: 'Verfassungsorgan', amounts: { '2025': { expense: 72_084_200, investments: 290_900 }, '2026': { expense: 106_563_300, investments: 730_400 } } },
  { plan: '16', label: 'Verfassungsgericht', category: 'Verfassungsorgan', amounts: { '2025': { expense: 1_366_300, investments: 60_000 }, '2026': { expense: 2_198_900, investments: 60_000 } } },
  { plan: '17', label: 'Informations- und Kommunikationstechnik', category: 'Zentrale Verwaltung', amounts: { '2025': { expense: 1_105_599_300, investments: 163_367_400 }, '2026': { expense: 1_297_580_400, investments: 145_071_200 } } },
  { plan: '18', label: 'Datenschutz- und Transparenzbeauftragte', category: 'Unabhängige Stelle', amounts: { '2025': { expense: 31_807_300, investments: 608_500 }, '2026': { expense: 43_988_600, investments: 10_119_200 } } },
  { plan: '19', label: 'Hochbau- und Liegenschaftsverwaltung', category: 'Zentrale Verwaltung', amounts: { '2025': { expense: 1_038_508_700, investments: 46_452_300 }, '2026': { expense: 1_019_215_200, investments: 48_011_100 } } },
  { plan: '20', label: 'Allgemeine Finanzverwaltung', category: 'Zentrale Verwaltung', amounts: { '2025': { expense: 26_162_666_200, investments: 2_544_264_400 }, '2026': { expense: 39_346_406_700, investments: 3_611_066_900 } } },
];

export const budgetExplorerEntries: BudgetExplorerEntry[] = budgetPlans.flatMap((plan) =>
  (['2025', '2026'] as const).map((year) => ({
    year,
    state: 'Haushaltsgesetz',
    plan: plan.plan,
    label: plan.label,
    category: plan.category,
    amount: plan.amounts[year].expense,
    investments: plan.amounts[year].investments,
  })),
);

export const budgetSpecialFunds: BudgetSpecialFund[] = [
  {
    label: 'Krankenhaussicherungs- und Rekommunalisierungsfonds',
    purpose: 'Sicherung regionaler Gesundheitsversorgung und öffentliche Steuerung kritischer Krankenhausstandorte.',
    description: 'Der Fonds ergänzt den Kernhaushalt als zweckgebundenes Instrument für die Gesundheitsversorgung.',
    href: getNormUrl('ostdeutsches-krankenhaussicherungsund-rekommunalisierungsfondsgesetz'),
  },
  {
    label: 'Landesbank an der Elbe',
    purpose: 'Finanzpolitische Handlungsfähigkeit und Strukturentwicklung.',
    description: 'Die Landesbank ist ein finanzpolitisches Instrument mit Bezug zu Investitionen und Strukturpolitik.',
    href: getNormUrl('ostdeutsches-landesbankgesetz'),
  },
  {
    label: 'Tariftreue- und Vergaberahmen',
    purpose: 'Soziale Standards bei öffentlicher Beschaffung und Investitionen.',
    description: 'Der Rahmen ergänzt die Haushaltssteuerung durch Vorgaben für Vergabe und Beschaffung.',
    href: getNormUrl('ostdeutsches-tariftreueund-vergabegesetz'),
  },
];
