/**
 * Haushaltsdaten des Doppelhaushalts 2025/2026 unter der Adresse der Periode. Inhalt und Format
 * sind identisch mit /haushalt/daten.csv, die als bisherige Adresse bestehen bleibt.
 */
import { getLegacyPeriode } from './_periode.ts';
import { GET as getLegacyCsv } from '../daten.csv.ts';

export const prerender = true;

export function GET(): Response {
  // Bricht ab, wenn die Periode 2025/2026 nicht freigegeben ist.
  getLegacyPeriode();
  return getLegacyCsv();
}
