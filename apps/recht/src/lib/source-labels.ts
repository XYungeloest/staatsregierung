import { formatDate } from '@ostrecht/shared/lib/norms/display.ts';
import { toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';

const ISO_DATE = /\d{4}-\d{2}-\d{2}/gu;

/**
 * Quellenbezeichnungen stammen aus den Quelldaten und tragen dort teils ein maschinenlesbares
 * Datum („Ausgangsfassung zum Rechtsüberleitungsstichtag 2023-11-01“). Für die Oberfläche wird es
 * ausgeschrieben; alles andere bleibt unverändert.
 */
export function formatSourceLabel(value: string | null | undefined): string {
  return toDisplayText(value).replace(ISO_DATE, (match) => formatDate(match));
}
