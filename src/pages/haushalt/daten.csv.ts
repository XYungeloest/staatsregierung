import { budgetPlans, budgetTotals, getBudgetShare } from '../../data/haushalt.ts';
import { formatPercent } from '../../lib/portal/modules.ts';

export const prerender = true;

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",;\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function GET(): Response {
  const header = [
    'Jahr',
    'Haushaltsstand',
    'Einzelplan',
    'Bezeichnung',
    'Kategorie',
    'Zuständiger Bereich',
    'Einnahmen in Euro',
    'Ausgaben in Euro',
    'Anteil an Gesamtausgaben',
    'Personalausgaben in Euro',
    'Zuweisungen und Zuschüsse in Euro',
    'Baumaßnahmen in Euro',
    'Investitionen und Investitionsförderung in Euro',
    'Verpflichtungsermächtigungen in Euro',
  ];
  const rows = budgetPlans.flatMap((plan) =>
    (['2025', '2026'] as const).map((year) => {
      const amounts = plan.amounts[year];
      return [
        year,
        'Haushaltsgesetz',
        plan.number,
        plan.title,
        plan.category,
        plan.responsibility,
        amounts.revenue,
        amounts.expenses,
        formatPercent(getBudgetShare(amounts.expenses, budgetTotals[year].expenses) ?? 0),
        amounts.personnel,
        amounts.transfers,
        amounts.construction,
        amounts.investments,
        amounts.commitments,
      ];
    }),
  );
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
