export type ActionPlanStatus = 'umgesetzt' | 'teilweise_umgesetzt' | 'angelegt';

export interface ActionPlanReference {
  label: string;
  normSlug: string;
}

export interface ActionPlanItem {
  id: string;
  title: string;
  description: string;
  status: ActionPlanStatus;
  ressort: string;
  href: string;
  references?: ActionPlanReference[];
}

export type TimelineEntryType = 'gesetz' | 'projekt' | 'kabinett' | 'presse' | 'haushalt';

export interface TimelineEntry {
  id: string;
  date: string;
  title: string;
  type: TimelineEntryType;
  summary: string;
  ressort?: string;
  href?: string;
}

export type LegislativeStage =
  | 'entwurf'
  | 'kabinett'
  | 'landtag'
  | 'verkuendung'
  | 'inkrafttreten';

export interface LegislativeTrackerItem {
  id: string;
  title: string;
  description: string;
  ressort: string;
  currentStage: LegislativeStage;
  topic?: string;
  href?: string;
}

export interface BudgetSummaryRow {
  year: '2025' | '2026';
  totalRevenue: number;
  totalExpense: number;
  taxRevenue: number;
  personnel: number;
  transfers: number;
  investments: number;
}

export interface BudgetExplorerEntry {
  year: '2025' | '2026';
  plan: string;
  label: string;
  category: 'Ressort' | 'Verfassungsorgan' | 'Zentrale Verwaltung';
  amount: number;
}

export interface BudgetSpecialFund {
  label: string;
  description: string;
  href?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
  href?: string;
  hrefLabel?: string;
}

export const legislativeStages: LegislativeStage[] = [
  'entwurf',
  'kabinett',
  'landtag',
  'verkuendung',
  'inkrafttreten',
];

export function formatActionPlanStatus(status: ActionPlanStatus): string {
  switch (status) {
    case 'umgesetzt':
      return 'Umgesetzt';
    case 'teilweise_umgesetzt':
      return 'Teilweise umgesetzt';
    case 'angelegt':
      return 'Angelegt';
  }
}

export function getActionPlanStatusIcon(status: ActionPlanStatus): string {
  switch (status) {
    case 'umgesetzt':
      return '✅';
    case 'teilweise_umgesetzt':
      return '🔄';
    case 'angelegt':
      return '📋';
  }
}

export function formatTimelineEntryType(type: TimelineEntryType): string {
  switch (type) {
    case 'gesetz':
      return 'Gesetz / Verordnung';
    case 'projekt':
      return 'Politisches Projekt';
    case 'kabinett':
      return 'Kabinettsbeschluss';
    case 'presse':
      return 'Presseereignis';
    case 'haushalt':
      return 'Haushaltsereignis';
  }
}

export function formatLegislativeStage(stage: LegislativeStage): string {
  switch (stage) {
    case 'entwurf':
      return 'Entwurf';
    case 'kabinett':
      return 'Kabinett';
    case 'landtag':
      return 'Landtag';
    case 'verkuendung':
      return 'Verkündung';
    case 'inkrafttreten':
      return 'Inkrafttreten';
  }
}

export function getLegislativeStageIndex(stage: LegislativeStage): number {
  return legislativeStages.indexOf(stage);
}

export function formatEuroAmount(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatEuroCompact(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount / 1_000_000_000)} Mrd. €`;
  }

  if (amount >= 1_000_000) {
    return `${new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount / 1_000_000)} Mio. €`;
  }

  return formatEuroAmount(amount);
}

