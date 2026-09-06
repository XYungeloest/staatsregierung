// apps/recht/src/lib/norm-summary.ts – Beschreibungstext der Verzeichniseinträge
// (Darstellung, außerhalb des D1-Abschlusses).
import { toDisplayText } from '@ostrecht/shared/lib/norms/index.ts';
import type { NormSummary } from './runtime/store.ts';

/**
 * Übersichtsdaten der Verzeichniseinträge. Förderbereich und Vollzitat der Ausgangsfassung
 * stehen seit Migration 0008 in der Projektion und damit unmittelbar in `NormSummary`.
 */
export type DirectoryNormSummary = NormSummary;

/**
 * Kurzform eines Vollzitats: Der Titel steht bereits in der Überschrift, deshalb bleibt nur
 * die Ausfertigungsformel mit ihrer Fundstelle stehen („Vom 4. Dezember 1997 (OGVBl. S. 684)“).
 * Spätere Änderungszusätze („zuletzt geändert durch …“) entfallen.
 */
export function citationShortForm(citation: string | null | undefined): string {
  const text = toDisplayText(citation ?? '').trim();
  if (!text) return '';
  // Bis zum Ende der ersten Fundstellenklammer; ohne Klammer bleibt der ganze Satzanfang.
  const head = text.match(/^[^()]*\([^()]*\)/u)?.[0] ?? text.split(/[,;]\s/u)[0] ?? text;
  const from = head.search(/\svom\s\d/u);
  const short = from === -1 ? head : head.slice(from + 1);
  return short.startsWith('vom ') ? `V${short.slice(1)}` : short;
}

/**
 * Beschreibung eines Verzeichniseintrags: die redaktionelle Zusammenfassung, sonst die
 * Kurzform des Vollzitats. Abgeleitete Formeln liefert die Projektion nicht aus
 * (`getPublicNormSummary`), deshalb bleibt hier nichts zu erkennen.
 */
export function directoryDescription(norm: DirectoryNormSummary): string {
  const summary = toDisplayText(norm.summary ?? '').trim();
  return summary || citationShortForm(norm.initialCitation);
}
