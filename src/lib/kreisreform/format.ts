const integerFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

const areaFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const longDateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Berlin',
});

export function formatInteger(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Keine Angabe';
  return integerFormatter.format(value);
}

export function formatArea(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Keine Angabe';
  return `${areaFormatter.format(value)} km²`;
}

export function formatLongDate(value: string): string {
  return longDateFormatter.format(new Date(`${value}T00:00:00+01:00`));
}

export function formatCount(
  value: number | undefined,
  singular: string,
  plural: string,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Keine Angabe';
  return `${integerFormatter.format(value)} ${value === 1 ? singular : plural}`;
}
