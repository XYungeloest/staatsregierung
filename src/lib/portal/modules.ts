import type {
  ActionPlanStatus,
  TimelineEntryType,
} from './dashboard-content.ts';

export type {
  ActionPlanItem,
  ActionPlanReference,
  ActionPlanStatus,
  TimelineEntry,
  TimelineEntryType,
} from './dashboard-content.ts';

import {
  formatLegislativeProcedureStage,
  LEGISLATIVE_STAGES,
  type LegislativeProcedureStage,
} from './legislation.ts';

export type LegislativeStage = LegislativeProcedureStage;

export interface LegislativeTrackerItem {
  id: string;
  title: string;
  description: string;
  ressort: string;
  currentStage: LegislativeStage;
  topic?: string;
  href?: string;
  documentNumber: string;
  nextScheduledReading?: {
    date: string;
    reading: 'erste-lesung' | 'zweite-lesung';
  };
  recommendation?: {
    documentNumber: string;
    result: 'annahme' | 'ablehnung';
  };
  proposedCommittee?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
  href?: string;
  hrefLabel?: string;
}

export const legislativeStages: LegislativeStage[] = [...LEGISLATIVE_STAGES];

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
      return 'Staatsorganisation';
    case 'presse':
      return 'Presseereignis';
    case 'haushalt':
      return 'Haushaltsereignis';
  }
}

export function formatLegislativeStage(stage: LegislativeStage): string {
  return formatLegislativeProcedureStage(stage);
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
  const absoluteAmount = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';

  if (absoluteAmount >= 1_000_000_000) {
    return `${sign}${new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(absoluteAmount / 1_000_000_000)} Mrd. €`;
  }

  if (absoluteAmount >= 1_000_000) {
    return `${sign}${new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(absoluteAmount / 1_000_000)} Mio. €`;
  }

  return formatEuroAmount(amount);
}

export function formatPercent(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}
