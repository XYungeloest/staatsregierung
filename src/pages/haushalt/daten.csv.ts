import { budgetExplorerEntries, budgetSummaryRows } from '../../data/dashboard/budget.ts';
import { formatPercent } from '../../lib/portal/modules.ts';

export const prerender = true;

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",;\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function GET(): Response {
  const summaryByYear = new Map(budgetSummaryRows.map((row) => [row.year, row]));
  const header = [
    'Jahr',
    'Haushaltsstand',
    'Einzelplan',
    'Bereich',
    'Kategorie',
    'Ausgaben in Euro',
    'Anteil an Gesamtausgaben',
    'Investitionen in Euro',
  ];
  const rows = budgetExplorerEntries.map((entry) => {
    const summary = summaryByYear.get(entry.year);
    return [
      entry.year,
      entry.state,
      entry.plan,
      entry.label,
      entry.category,
      entry.amount,
      summary ? formatPercent(entry.amount / summary.totalExpense) : '',
      entry.investments,
    ];
  });
  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsv).join(';'))
    .join('\r\n');

  return new Response(`\ufeff${csv}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="haushalt-2025-2026.csv"',
    },
  });
}
