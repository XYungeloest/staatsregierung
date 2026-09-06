import { formatDate } from '@ostrecht/shared/lib/norms/display.ts';
import { toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';

const ISO_DATE = /\d{4}-\d{2}-\d{2}/gu;
/**
 * „strukturtragend“ beschreibt die Transkription, nicht die Quelle: gemeint ist eine Fassung, die
 * die Gliederung der amtlichen Ausgabe mitführt. Für Leserinnen und Leser sagt das Wort nichts;
 * die Bezeichnung bleibt ohne es vollständig („Vollständige HTML-Fassung der amtlichen Ausgabe“).
 */
const STRUCTURE_ADJECTIVE = /strukturtragende[nrs]?\s+/giu;

/**
 * Quellenbezeichnungen stammen aus den Quelldaten und tragen dort teils ein maschinenlesbares
 * Datum („Ausgangsfassung zum Rechtsüberleitungsstichtag 2023-11-01“) sowie Fachwörter der
 * Transkription. Für die Oberfläche wird das Datum ausgeschrieben und das Fachwort entfernt;
 * alles andere bleibt unverändert.
 */
export function formatSourceLabel(value: string | null | undefined): string {
  return toDisplayText(value)
    .replace(ISO_DATE, (match) => formatDate(match))
    .replace(STRUCTURE_ADJECTIVE, '')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}
