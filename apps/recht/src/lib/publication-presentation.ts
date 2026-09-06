// apps/recht/src/lib/publication-presentation.ts – Darstellung der Verkündungen
// (außerhalb des D1-Abschlusses; das Modell steht in lib/norms/publications.ts).
import { formatDate, getPublicationLabel, hasNumberedIssue, type Verkuendung } from '@ostrecht/shared/lib/norms/index.ts';

/**
 * Herausgeberzeile in richtigem Fall. Das Kopfnomen entscheidet über den Artikel; unbekannte
 * Herausgeber erhalten die neutrale Form „Herausgeber: …“ statt eines falschen Falls.
 */
const MASCULINE_OR_NEUTER = new Set([
  'Freistaat', 'Ministerium', 'Bundesministerium', 'Staatsministerium', 'Staatssekretariat',
  'Landesamt', 'Amt', 'Land', 'Landtag', 'Staatsrat', 'Präsidium', 'Regierungspräsidium',
  'Oberbergamt', 'Rechnungshof', 'Bundesamt',
]);
const FEMININE = new Set([
  'Staatskanzlei', 'Landesdirektion', 'Staatsregierung', 'Landesregierung', 'Behörde',
  'Stadt', 'Volkskammer', 'Kammer', 'Anstalt', 'Verwaltung',
]);

export function formatPublisherLine(publisher: string | null | undefined): string | undefined {
  const name = (publisher ?? '').trim();
  if (!name) return undefined;
  const head = name.split(/\s+/u)[0]?.replace(/[.,;:]$/u, '') ?? '';
  if (MASCULINE_OR_NEUTER.has(head)) return `Herausgegeben vom ${name}.`;
  if (FEMININE.has(head)) return `Herausgegeben von der ${name}.`;
  return `Herausgeber: ${name}.`;
}

/**
 * Zusatz zu einem Eintragstitel: „Fassung vom 3. September 2026“. Ohne belegtes Datum
 * entfällt der Zusatz – eine Fassungskennung ist kein öffentlicher Text.
 */
export function formatVersionDateLabel(
  versionId: string | null | undefined,
  validFrom?: string | null,
): string | undefined {
  const date = validFrom ?? (/^\d{4}-\d{2}-\d{2}$/u.test(versionId ?? '') ? versionId : undefined);
  return date ? `Fassung vom ${formatDate(date)}` : undefined;
}

/**
 * Kopfzeile einer Ausgabe: nummerierte Ausgaben nennen Kurzzitat und Datum, Einzelverkündungen
 * tragen das Datum schon im Kurzzitat und wiederholen es nicht.
 */
export function formatIssueHeadline(publication: Verkuendung): string {
  const label = getPublicationLabel(publication);
  return hasNumberedIssue(publication) ? `${label} vom ${formatDate(publication.date)}` : label;
}

/** Quellen einer Ausgabe, die tatsächlich zu einem öffentlichen Ziel führen. */
export function publicationSourceLinks(publication: Verkuendung): Array<{ label: string; url: string; pageRange?: string }> {
  return (publication.sourceReferences ?? [])
    .filter((source): source is typeof source & { url: string } => Boolean(source.url))
    .map((source) => ({
      label: source.label,
      url: source.url,
      ...(source.pageRange ? { pageRange: source.pageRange } : {}),
    }));
}
