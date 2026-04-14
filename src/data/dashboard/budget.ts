import { getNormUrl } from '../../lib/norms/routes.ts';
import type {
  BudgetExplorerEntry,
  BudgetSpecialFund,
  BudgetSummaryRow,
} from '../../lib/portal/modules.ts';

export const budgetSummaryRows: BudgetSummaryRow[] = [
  {
    year: '2025',
    totalRevenue: 104_726_510_200,
    totalExpense: 104_726_510_200,
    taxRevenue: 85_589_873_000,
    personnel: 27_906_003_900,
    transfers: 52_580_168_000,
    investments: 12_628_645_600,
  },
  {
    year: '2026',
    totalRevenue: 177_808_943_700,
    totalExpense: 177_808_943_700,
    taxRevenue: 88_875_926_900,
    personnel: 29_037_907_300,
    transfers: 80_865_709_800,
    investments: 60_708_348_800,
  },
];

export const budgetExplorerEntries: BudgetExplorerEntry[] = [
  { year: '2025', plan: '20', label: 'Allgemeine Finanzverwaltung', category: 'Zentrale Verwaltung', amount: 26_162_666_200 },
  { year: '2025', plan: '4', label: 'Bildung und sportliche Ertüchtigung', category: 'Ressort', amount: 20_543_792_600 },
  { year: '2025', plan: '11', label: 'Kultur, Wissenschaft und Tourismus', category: 'Ressort', amount: 10_354_479_500 },
  { year: '2025', plan: '8', label: 'Soziale und gesundheitliche Fürsorge', category: 'Ressort', amount: 9_787_543_300 },
  { year: '2025', plan: '10', label: 'Mobilität, Infrastruktur und Landesentwicklung', category: 'Ressort', amount: 8_428_812_700 },
  { year: '2025', plan: '13', label: 'Grenzschutz, Faschismusbekämpfung und bewaffnete Organe', category: 'Ressort', amount: 6_092_923_300 },
  { year: '2025', plan: '3', label: 'Inneres, Bau und kommunale Angelegenheiten', category: 'Ressort', amount: 6_091_590_800 },
  { year: '2025', plan: '7', label: 'Wirtschaft, Arbeitsmarkt und Beschäftigung', category: 'Ressort', amount: 4_638_217_600 },
  { year: '2025', plan: '5', label: 'Rechtsstaatlichkeit und Angelegenheiten des Staates', category: 'Ressort', amount: 4_399_378_000 },
  { year: '2025', plan: '6', label: 'Kapitalakkumulation des Fiskus', category: 'Ressort', amount: 2_083_397_500 },
  { year: '2025', plan: '14', label: 'Küste, Fischerei, Forst und Landwirtschaft', category: 'Ressort', amount: 1_791_615_800 },
  { year: '2025', plan: '9', label: 'Umwelt, Energie und Klimaschutz', category: 'Ressort', amount: 1_721_765_700 },
  { year: '2025', plan: '17', label: 'Informations- und Kommunikationstechnik', category: 'Zentrale Verwaltung', amount: 1_105_599_300 },
  { year: '2025', plan: '19', label: 'Hochbau- und Liegenschaftsverwaltung', category: 'Zentrale Verwaltung', amount: 1_038_508_700 },
  { year: '2025', plan: '2', label: 'Staatskanzlei', category: 'Ressort', amount: 263_354_900 },
  { year: '2026', plan: '6', label: 'Kapitalakkumulation des Fiskus', category: 'Ressort', amount: 42_165_264_500 },
  { year: '2026', plan: '20', label: 'Allgemeine Finanzverwaltung', category: 'Zentrale Verwaltung', amount: 39_346_406_700 },
  { year: '2026', plan: '4', label: 'Bildung und sportliche Ertüchtigung', category: 'Ressort', amount: 25_969_728_200 },
  { year: '2026', plan: '3', label: 'Inneres, Bau und kommunale Angelegenheiten', category: 'Ressort', amount: 13_884_781_600 },
  { year: '2026', plan: '8', label: 'Soziale und gesundheitliche Fürsorge', category: 'Ressort', amount: 11_601_458_800 },
  { year: '2026', plan: '11', label: 'Kultur, Wissenschaft und Tourismus', category: 'Ressort', amount: 10_824_559_300 },
  { year: '2026', plan: '10', label: 'Mobilität, Infrastruktur und Landesentwicklung', category: 'Ressort', amount: 10_396_529_600 },
  { year: '2026', plan: '13', label: 'Grenzschutz, Faschismusbekämpfung und bewaffnete Organe', category: 'Ressort', amount: 6_345_869_500 },
  { year: '2026', plan: '7', label: 'Wirtschaft, Arbeitsmarkt und Beschäftigung', category: 'Ressort', amount: 5_436_107_800 },
  { year: '2026', plan: '5', label: 'Rechtsstaatlichkeit und Angelegenheiten des Staates', category: 'Ressort', amount: 4_508_440_700 },
  { year: '2026', plan: '9', label: 'Umwelt, Energie und Klimaschutz', category: 'Ressort', amount: 3_074_929_200 },
  { year: '2026', plan: '14', label: 'Küste, Fischerei, Forst und Landwirtschaft', category: 'Ressort', amount: 1_538_448_500 },
  { year: '2026', plan: '17', label: 'Informations- und Kommunikationstechnik', category: 'Zentrale Verwaltung', amount: 1_297_580_400 },
  { year: '2026', plan: '19', label: 'Hochbau- und Liegenschaftsverwaltung', category: 'Zentrale Verwaltung', amount: 1_019_215_200 },
  { year: '2026', plan: '12', label: 'Völkerfreundschaft und Nachbarschaftspolitik', category: 'Ressort', amount: 104_022_100 },
  { year: '2026', plan: '2', label: 'Staatskanzlei', category: 'Ressort', amount: 48_446_700 },
];

export const budgetSpecialFunds: BudgetSpecialFund[] = [
  {
    label: 'Krankenhaussicherungs- und Rekommunalisierungsfonds',
    description:
      'Der Fonds dient der Sicherung regionaler Gesundheitsversorgung und der öffentlichen Steuerung kritischer Krankenhausstandorte.',
    href: getNormUrl('ostdeutsches-krankenhaussicherungsund-rekommunalisierungsfondsgesetz'),
  },
  {
    label: 'Landesbank an der Elbe',
    description:
      'Die Landesbank bildet ein zentrales Instrument der finanzpolitischen Handlungsfähigkeit und Strukturentwicklung.',
    href: getNormUrl('ostdeutsches-landesbankgesetz'),
  },
  {
    label: 'Tariftreue- und Vergaberahmen',
    description:
      'Vergaberecht und soziale Standards wirken im Haushalt als Querschnittsinstrument für öffentliche Beschaffung und Investitionen.',
    href: getNormUrl('ostdeutsches-tariftreueund-vergabegesetz'),
  },
];

