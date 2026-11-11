/**
 * Darstellungshelfer der Haushaltskomponenten. Sie formatieren nur; Beträge werden nie neu
 * berechnet. Geld kommt als ganze Euro (Integer), Anteile als Bruchteile (0,25 = 25 %).
 */
import { formatEuroAmount, formatEuroCompact, formatPercent } from '@ostrecht/shared/lib/portal/modules.ts';

export type ValueFormat = 'euro-compact' | 'euro' | 'percent' | 'number';

export type OriginCode = 'O' | 'D' | 'S' | 'P';

export type StatusTone = 'geltend' | 'entwurf' | 'beratung' | 'beschlossen' | 'historisch' | 'vorschau';

/** Herkunftskennzeichen der Haushaltsdaten in öffentlicher Sprache. */
export const ORIGIN_LABELS: Record<OriginCode, string> = {
  O: 'amtliche Quelle',
  D: 'rechnerisch abgeleitet',
  S: 'Planungsannahme',
  P: 'politische Festlegung',
};

const integerFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

/** Ersetzt das ASCII-Minus am Anfang durch das typografische Minuszeichen. */
function typographicMinus(value: string): string {
  return value.replace(/^-/u, '−');
}

/**
 * Bindet Angaben, die beim Zeilenumbruch nicht zerfallen dürfen, durch geschützte Leerzeichen:
 * Paragraf, Artikel, Absatz oder Nummer mit Zahl („§ 8“), Zahl mit Gesetzeskürzel („8 LHO“),
 * Zahl mit Einheit („550 Mio. EUR“) sowie Kapitel- und Titelnummern („07 10“, „831 75“). Nur für
 * die Anzeige; Export- und Suchtexte bleiben unverändert.
 */
export function bindeKennungen(text: string): string {
  return text
    .replace(/(§§?|Art\.|Artikel|Abs\.|Nr\.) (?=\d)/gu, '$1 ')
    .replace(/(\d[a-z]?) (?=[A-ZÄÖÜ]{2,}[A-Za-zÄÖÜäöüß-]*\b)/gu, '$1 ')
    .replace(/(\d) (?=(?:Mio\.|Mrd\.|EUR|€|%|Prozent)(?![\p{L}\p{N}]))/gu, '$1 ')
    .replace(/(Mio\.|Mrd\.) (?=EUR|€)/gu, '$1 ')
    .replace(/(?<![\d.,])(\d{2,3}) (?=\d{2}(?![\d.,]))/gu, '$1 ');
}

/** Exakter Eurobetrag mit Tausenderpunkten, z. B. „140.900.866.242 €“. */
export function formatEuroExact(amount: number): string {
  return typographicMinus(formatEuroAmount(amount));
}

/** Gerundeter Eurobetrag („140,9 Mrd. €“); unter einer Million exakt. Zahl, Größenwort und
 * Einheit bleiben durch geschützte Leerzeichen zusammen. */
export function formatEuroRounded(amount: number): string {
  return typographicMinus(formatEuroCompact(amount)).replace(/ /gu, '\u00a0');
}

export function formatNumber(value: number): string {
  return typographicMinus(Number.isInteger(value) ? integerFormat.format(value) : decimalFormat.format(value));
}

export function formatShare(value: number, fractionDigits = 1): string {
  return typographicMinus(formatPercent(value, fractionDigits));
}

/** Formatiert einen Wert in einem der vier Kennzahlformate. */
export function formatValue(value: number, format: ValueFormat = 'euro-compact'): string {
  switch (format) {
    case 'euro':
      return formatEuroExact(value);
    case 'percent':
      return formatShare(value);
    case 'number':
      return formatNumber(value);
    case 'euro-compact':
    default:
      return formatEuroRounded(value);
  }
}

/** Wert mit Vorzeichen („+1,2 Mrd. €“, „−3,4 %“, „±0 €“). */
export function formatSigned(value: number, format: ValueFormat = 'euro-compact'): string {
  if (value === 0) return `±${formatValue(0, format)}`;
  const formatted = formatValue(Math.abs(value), format);
  return value > 0 ? `+${formatted}` : `−${formatted}`;
}

/** Exakter Wert für `title` und Tabellen: Euroformate exakt, sonst wie angezeigt. */
export function formatExact(value: number, format: ValueFormat = 'euro-compact'): string {
  return format === 'euro-compact' || format === 'euro' ? formatEuroExact(value) : formatValue(value, format);
}

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** ISO-Datum (JJJJ-MM-TT, optional mit Zeit) als „30. Oktober 2026“; Unlesbares bleibt unverändert. */
export function formatGermanDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(iso.trim());
  if (!match) return iso;
  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) return iso;
  return `${Number(day)}. ${MONTHS[monthIndex]} ${year}`;
}

/** Nur das Datum aus einem ISO-Wert, für `<time datetime>`. */
export function isoDateOnly(iso: string): string {
  return /^(\d{4}-\d{2}-\d{2})/u.exec(iso.trim())?.[1] ?? iso;
}

/** Anteil `value / total`, oder `null`, wenn er nicht sinnvoll ist. */
export function shareOf(value: number, total: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) return null;
  return value / total;
}

/** Stabiler, HTML-tauglicher Bezeichner aus Freitext. */
export function slugifyId(value: string): string {
  return (
    value
      .toLocaleLowerCase('de-DE')
      .replace(/ä/gu, 'ae')
      .replace(/ö/gu, 'oe')
      .replace(/ü/gu, 'ue')
      .replace(/ß/gu, 'ss')
      .normalize('NFD')
      .replace(/[̀-ͯ]/gu, '')
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-+|-+$/gu, '') || 'x'
  );
}

/** Suchtext wie im Tabellen-Enhancer normalisiert (Kleinbuchstaben, Umlaute ausgeschrieben). */
export function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase('de-DE')
    .replace(/ä/gu, 'ae')
    .replace(/ö/gu, 'oe')
    .replace(/ü/gu, 'ue')
    .replace(/ß/gu, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Skala für Balken mit möglichen negativen Werten: Lage der Nulllinie und Breite je Wert in
 * Prozent der Spur. Ohne negative Werte liegt die Null links.
 */
export function linearScale(values: number[]): { zero: number; position: (value: number) => { start: number; size: number } } {
  const finite = values.filter((value) => Number.isFinite(value));
  const max = Math.max(0, ...finite);
  const min = Math.min(0, ...finite);
  const range = max - min || 1;
  const zero = ((0 - min) / range) * 100;
  return {
    zero,
    position(value: number) {
      const size = (Math.abs(value) / range) * 100;
      return { start: value >= 0 ? zero : zero - size, size };
    },
  };
}

/** Prozentwert für Inline-Stile, auf vier Nachkommastellen begrenzt. */
export function cssPercent(value: number): string {
  return `${Math.round(value * 10000) / 10000}%`;
}

/** Anzahl der Farbstufen der Diagrammpalette (`--hh-farbe-1` … in base.css). */
export const PALETTE_SIZE = 8;

/** „Schöne“ Achsenschritte zwischen `min` und `max` (beide eingeschlossen, Null immer dabei). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const low = Math.min(0, min);
  const high = Math.max(0, max);
  const span = high - low || 1;
  const rough = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const step = (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;
  const start = Math.floor(low / step) * step;
  const end = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Math.round(value / step) * step);
  }
  return ticks;
}

/** Einheit einer Achse: Teiler und Beschriftung („Mrd. €“, „Mio. €“, „€“, „%“). */
export function axisUnit(maxAbs: number, format: ValueFormat): { divisor: number; label: string } {
  if (format === 'percent') return { divisor: 0.01, label: '%' };
  if (format === 'number') {
    if (maxAbs >= 1_000_000) return { divisor: 1_000_000, label: 'Mio.' };
    if (maxAbs >= 10_000) return { divisor: 1_000, label: 'Tsd.' };
    return { divisor: 1, label: '' };
  }
  if (maxAbs >= 1_000_000_000) return { divisor: 1_000_000_000, label: 'Mrd. €' };
  if (maxAbs >= 1_000_000) return { divisor: 1_000_000, label: 'Mio. €' };
  if (maxAbs >= 10_000) return { divisor: 1_000, label: 'Tsd. €' };
  return { divisor: 1, label: '€' };
}

/** Achsenbeschriftung in der gewählten Einheit („12,5“, „−4“). */
export function formatAxisValue(value: number, divisor: number): string {
  const scaled = value / divisor;
  return typographicMinus(new Intl.NumberFormat('de-DE', { maximumFractionDigits: Math.abs(scaled) < 10 && !Number.isInteger(scaled) ? 1 : 0 }).format(scaled));
}

export type YearKind = 'ist' | 'haushaltsjahr' | 'projektion';

export const YEAR_KIND_LABELS: Record<YearKind, string> = {
  ist: 'Ist-Ergebnis',
  haushaltsjahr: 'Haushaltsjahr',
  projektion: 'Finanzplanung (Projektion, nicht bewilligt)',
};

export const YEAR_KIND_SHORT: Record<YearKind, string> = {
  ist: 'Ist',
  haushaltsjahr: 'Haushaltsjahr',
  projektion: 'Projektion',
};

/**
 * Kürzt einen Text für eine Seitenbeschreibung (meta description): am letzten Satzende innerhalb
 * von `max` Zeichen, sofern es nicht vor `min` liegt; sonst am letzten Wortende mit „…“.
 */
export function kuerzeBeschreibung(text: string, max = 300, min = 120): string {
  const bereinigt = text.replace(/\s+/gu, ' ').trim();
  if (bereinigt.length <= max) return bereinigt;
  const ausschnitt = bereinigt.slice(0, max);
  const satzende = Math.max(...['. ', '! ', '? '].map((zeichen) => ausschnitt.lastIndexOf(zeichen)));
  if (satzende >= min) return ausschnitt.slice(0, satzende + 1);
  const wortende = ausschnitt.slice(0, max - 1).lastIndexOf(' ');
  return `${ausschnitt.slice(0, wortende > 0 ? wortende : max - 1).replace(/[\s,;:–-]+$/u, '')}…`;
}
