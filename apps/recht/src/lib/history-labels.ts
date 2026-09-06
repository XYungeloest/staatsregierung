// apps/recht/src/lib/history-labels.ts – Bezeichnungen der Änderungseinträge in Nutzersprache
// (reine Darstellung, außerhalb der D1-Projektion).
import { formatDate } from '@ostrecht/shared/lib/norms/display.ts';
import { LEGAL_BASELINE_DATE } from '@ostrecht/shared/lib/norms/origin.ts';
import { toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';

/**
 * Die Änderungseinträge des übernommenen Rechts tragen aus dem Import zwei Wortlaute, die keine
 * Auskunft geben: einen Platzhalter („Verkündung.“) und die Herkunftsformel mit dem
 * maschinennahen Wort „Rechtsüberleitungsstichtag“ und einem ISO-Datum. Beides wird hier zur
 * Anzeige abgebildet; der Bestand bleibt unangetastet, bis die Metadaten redaktionell
 * nachgeschärft sind. Neue Wortlaute des Imports müssen die Muster treffen oder von vornherein
 * Nutzersprache liefern.
 */

/** Titel, die nur die Art des Eintrags wiederholen und deshalb nichts erklären. */
const PLACEHOLDER_TITLE = /^(?:Verkündung|Stammfassung(?: verkündet)?|Erlass|Ausgangsfassung|Verkündete Fassung|Eingeführte Stammfassung)\.?$/u;

/** „Vollständige Ausgangsfassung zum Rechtsüberleitungsstichtag (Artikel 2 der Mantelvorschrift).“ */
const BASELINE_TITLE = /^Vollständige Ausgangsfassung zum (?:Rechtsüberleitungsstichtag|verbindlichen Stichtag)(?:\s\((.+?)\))?\.?$/u;

/** „Ausgangsfassung zum Rechtsüberleitungsstichtag 2023-11-01: übernommener Rechtsstand dieses Tages.“ */
const BASELINE_NOTE = /^Ausgangsfassung zum Rechtsüberleitungsstichtag (\d{4}-\d{2}-\d{2}):\s*(.*)$/u;

/** Übernommene Ausgangsfassung: ein Satz mit ausgeschriebenem Datum, ohne Systemwort. */
function baselineWording(date: string, addition?: string): string {
  const scope = addition ? ` (${addition})` : '';
  return `Übernommene Ausgangsfassung mit Rechtsstand vom ${formatDate(date)}${scope}`;
}

/** Ein Platzhaltertitel trägt keine Aussage und wird durch das Vollzitat ersetzt. */
export function isPlaceholderHistoryTitle(title: string | null | undefined): boolean {
  return PLACEHOLDER_TITLE.test(toDisplayText(title ?? '').trim());
}

/**
 * Titel eines Änderungseintrags für die Anzeige: Platzhalter liefern `undefined` (die Aufrufer
 * setzen dann das Vollzitat), die Herkunftsformel wird ausgeschrieben, alles andere bleibt.
 */
export function displayHistoryTitle(title: string | null | undefined): string | undefined {
  const text = toDisplayText(title ?? '').trim();
  if (!text) return undefined;
  if (PLACEHOLDER_TITLE.test(text)) return undefined;
  const baseline = text.match(BASELINE_TITLE);
  if (baseline) return baselineWording(LEGAL_BASELINE_DATE, baseline[1]);
  return text;
}

/**
 * Änderungsstand einer Fassung für die Anzeige: die Herkunftsformel wird ausgeschrieben,
 * das nachgestellte „übernommener Rechtsstand dieses Tages“ entfällt als Wiederholung.
 */
export function displayChangeNote(note: string | null | undefined): string {
  const text = toDisplayText(note ?? '').trim();
  const baseline = text.match(BASELINE_NOTE);
  if (!baseline) return text;
  const rest = baseline[2].replace(/^übernommener Rechtsstand dieses Tages\.?$/u, '').trim();
  return rest ? `${baselineWording(baseline[1])}: ${rest}` : `${baselineWording(baseline[1])}.`;
}

/** Anfang eines Vollzitats ohne Fundstellenklammer: „Gesetz vom 2. September 2026“. */
function citationOpening(citation: string | null | undefined): string {
  const text = toDisplayText(citation ?? '').trim();
  if (!text) return '';
  return text.split('(')[0].replace(/[,;]\s*$/u, '').trim();
}

/**
 * Ein Änderungseintrag in einem Satz (Startseite, Kurzverläufe): der Titel, wenn er etwas sagt,
 * sonst der Anfang des Vollzitats.
 */
export function describeChange(change: { title?: string | null; citation?: string | null }): string {
  const title = displayHistoryTitle(change.title);
  if (title) return title;
  return citationOpening(change.citation) || toDisplayText(change.citation ?? '').trim();
}
