import { formatDate } from '@ostrecht/shared/lib/norms/display.ts';
import { toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';

const ISO_DATE = /\d{4}-\d{2}-\d{2}/gu;
/**
 * „strukturtragend“ beschreibt die Transkription, nicht die Quelle: gemeint ist eine Fassung, die
 * die Gliederung der amtlichen Ausgabe mitführt. Für Leserinnen und Leser sagt das Wort nichts;
 * die Bezeichnung bleibt ohne es vollständig („Vollständige Textfassung der amtlichen Ausgabe“).
 */
const STRUCTURE_ADJECTIVE = /strukturtragende[nrs]?\s+/giu;

/**
 * Dateiformate und Transkriptionsarten der Quelldaten („HTML-Fassung“, „Markdown-Transkription“,
 * „DOCX-Quelle“) sind Arbeitsbegriffe der Redaktion. Öffentlich heißt die Textquelle schlicht
 * Textfassung, Abschrift oder Textvorlage; „PDF“ bleibt als bekanntes Dokumentformat stehen.
 */
const FORMAT_TERMS: ReadonlyArray<[RegExp, string]> = [
  [/\bHTML-Fassung\b/gu, 'Textfassung'],
  [/\bMarkdown-Transkription\b/gu, 'Abschrift'],
  [/\bstrukturierte\s+Transkription\b/gu, 'Abschrift'],
  [/\bDOCX-Quelle\b/gu, 'Textvorlage'],
  // Zusammengesetzte Bezeichnungen wiederholen die Art der Quelle („– Berichtigung Berichtigung vom …“).
  [/\b(Berichtigung)\s+\1\b/gu, '$1'],
];

/**
 * Quellenbezeichnungen stammen aus den Quelldaten und tragen dort teils ein maschinenlesbares
 * Datum („Ausgangsfassung zum Rechtsüberleitungsstichtag 2023-11-01“) sowie Fachwörter der
 * Transkription. Für die Oberfläche wird das Datum ausgeschrieben, das Fachwort entfernt und
 * die Formatbezeichnung allgemein benannt; alles andere bleibt unverändert.
 */
export function formatSourceLabel(value: string | null | undefined): string {
  const text = toDisplayText(value)
    .replace(ISO_DATE, (match) => formatDate(match))
    .replace(STRUCTURE_ADJECTIVE, '');
  return FORMAT_TERMS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text)
    .replace(/\s{2,}/gu, ' ')
    .trim();
}
