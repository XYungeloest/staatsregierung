/** Kurzes deutsches Datum „15.08.2026“ für dichte Listen und Tabellen (Langform: formatDate). */
export function formatShortDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}
