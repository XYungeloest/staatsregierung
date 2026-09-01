import {
  formatHoldingCurrentStatus,
  formatHoldingCutoffStatus,
  formatHoldingLevel,
  formatHoldingPercent,
  formatHoldingRelation,
} from '@ostrecht/shared/lib/portal/holdings.ts';
import { loadBeteiligungsInventar } from '@ostrecht/shared/lib/portal/content.ts';

export const prerender = true;

function escapeCsv(value: string): string {
  return /[";\n\r]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function percentForCsv(value: number | null): string {
  return value === null ? '' : formatHoldingPercent(value);
}

export async function GET(): Promise<Response> {
  const inventory = await loadBeteiligungsInventar();
  const header = [
    'Name',
    'Herkunft',
    'Ebene',
    'Mutter',
    'Beziehung',
    'Anteil_2023',
    'Effektiver_oeffentlicher_Anteil',
    'Heutiger_Anteil',
    'Heutige_konsolidierte_Position',
    'Rechtsform',
    'Status_2023',
    'Status_heute',
    'Veraenderung',
  ];
  const rows = inventory.positions.map((position) => [
    position.name,
    position.origin,
    formatHoldingLevel(position.level),
    position.parent ?? '',
    formatHoldingRelation(position.relation),
    percentForCsv(position.stakePercent),
    percentForCsv(position.effectivePublicPercent),
    percentForCsv(position.currentStakePercent),
    percentForCsv(position.currentConsolidatedPercent),
    position.legalForm,
    formatHoldingCutoffStatus(position.cutoffStatus),
    formatHoldingCurrentStatus(position.currentStatus),
    position.change2023To2026 ?? '',
  ]);
  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\r\n');

  return new Response(`\ufeff${csv}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="beteiligungsinventar-2026-08-25.csv"',
    },
  });
}
