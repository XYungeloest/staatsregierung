import type {
  BeteiligungsEbene,
  BeteiligungsGegenwartsstatus,
  BeteiligungsInventarPosition,
  BeteiligungsStichtagsstatus,
} from '@ostrecht/shared/lib/portal/schema.ts';

const percentFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const levelLabels: Record<BeteiligungsEbene, string> = {
  direct: 'unmittelbar',
  indirect: 'mittelbar',
  'second-degree': 'zweite/tiefere Ebene',
};

const relationLabels: Record<string, string> = {
  capital: 'Kapitalbeteiligung',
  carrier: 'Trägerstellung',
  'administrative-carrier': 'Verwaltungsträgerschaft',
  member: 'Mitgliedschaft',
  'limited-partner': 'Kommanditbeteiligung',
  'general-partner': 'Komplementärstellung',
  'cooperative-share': 'Genossenschaftsanteil',
  'single-share': 'Einzelaktie',
  'connected-company': 'Verbundenes Unternehmen',
  'foundation-share': 'Stiftungsbeteiligung',
};

const cutoffStatusLabels: Record<BeteiligungsStichtagsstatus, string> = {
  active: 'aktiv',
  liquidation: 'Liquidation',
  'scheduled-liquidation': 'zur Auflösung bestimmt',
  insolvency: 'Insolvenz',
};

const currentStatusLabels: Record<BeteiligungsGegenwartsstatus, string> = {
  active: 'aktiv',
  liquidation: 'Liquidation',
  insolvency: 'Insolvenz',
  'succeeded-to-off': 'auf OFF übergegangen',
};

export function formatHoldingPercent(value: number | null): string {
  return value === null ? '—' : `${percentFormatter.format(value)} %`;
}

export function formatHoldingLevel(value: BeteiligungsEbene): string {
  return levelLabels[value];
}

export function formatHoldingRelation(value: string): string {
  return relationLabels[value] ?? 'sonstige Beziehung';
}

export function formatHoldingCutoffStatus(value: BeteiligungsStichtagsstatus): string {
  return cutoffStatusLabels[value];
}

export function formatHoldingCurrentStatus(value: BeteiligungsGegenwartsstatus): string {
  return currentStatusLabels[value];
}

export function formatHoldingCurrentPercent(position: BeteiligungsInventarPosition): string {
  if (position.consolidatedPosition && position.currentConsolidatedPercent !== null) {
    return `${formatHoldingPercent(position.currentConsolidatedPercent)} konsolidiert`;
  }
  return formatHoldingPercent(position.currentStakePercent);
}

export function getHoldingStakeBand(value: number | null): string {
  if (value === null) return 'not-applicable';
  if (value === 100) return 'full';
  if (value > 50) return 'majority';
  if (value >= 25) return 'blocking';
  return 'minority';
}

export const holdingRelationOptions = Object.entries(relationLabels)
  .map(([value, label]) => ({ value, label }))
  .sort((left, right) => left.label.localeCompare(right.label, 'de'));

export const holdingCutoffStatusOptions = Object.entries(cutoffStatusLabels)
  .map(([value, label]) => ({ value, label }))
  .sort((left, right) => left.label.localeCompare(right.label, 'de'));

export const holdingCurrentStatusOptions = Object.entries(currentStatusLabels)
  .map(([value, label]) => ({ value, label }))
  .sort((left, right) => left.label.localeCompare(right.label, 'de'));
