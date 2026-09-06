const MONTHS = new Map([
  ['januar', 1], ['februar', 2], ['märz', 3], ['maerz', 3], ['april', 4],
  ['mai', 5], ['juni', 6], ['juli', 7], ['august', 8], ['september', 9],
  ['oktober', 10], ['november', 11], ['dezember', 12],
]);

const WRITTEN_DATE_SOURCE = String.raw`\d{1,2}\.\s*(?:Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}`;
const DOTTED_DATE_SOURCE = String.raw`\d{1,2}\.\d{1,2}\.\d{4}`;
const DATE_SOURCE = `(?:${WRITTEN_DATE_SOURCE}|${DOTTED_DATE_SOURCE})`;

function parseCitationDate(value) {
  const dotted = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/u);
  if (dotted) return `${dotted[3]}-${dotted[2].padStart(2, '0')}-${dotted[1].padStart(2, '0')}`;
  const written = value.match(/^(\d{1,2})\.\s*([\p{L}]+)\s+(\d{4})$/u);
  if (!written) return null;
  const month = MONTHS.get(written[2].toLocaleLowerCase('de'));
  return month ? `${written[3]}-${String(month).padStart(2, '0')}-${written[1].padStart(2, '0')}` : null;
}

export function amendmentDatesFromCitation(citation) {
  const normalized = String(citation ?? '').replace(/\s+/gu, ' ').trim();
  const values = [];
  const patterns = [
    new RegExp(`(?:zuletzt\\s+)?geändert\\s+durch.{0,420}?\\bvom\\s+(${DATE_SOURCE})`, 'giu'),
    new RegExp(`\\b(?:zuletzt\\s+)?durch.{0,420}?\\bvom\\s+(${DATE_SOURCE}).{0,300}?\\bgeändert(?:en|e|er|es)?\\b`, 'giu'),
    // Innerhalb eines Satzglieds: „…, die zuletzt durch die Verordnung vom 16. Juli 2024
    // (SächsGVBl. S. 748) geändert worden ist“. Der weit gefasste Ausdruck darüber beginnt
    // sonst am Titelwort „Durchführungs…“ und verbraucht das Erlassdatum der Stammfassung.
    new RegExp(`\\b(?:zuletzt\\s+)?durch\\s+[^,;]{0,200}?\\bvom\\s+(${DATE_SOURCE})[^,;]{0,200}?\\bgeändert(?:en|e|er|es)?\\b`, 'giu'),
  ];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const date = parseCitationDate(match[1]);
      if (date) values.push(date);
    }
  }
  return [...new Set(values)].sort();
}

export function futureAmendmentDates(citation, sourceValidTo) {
  if (!sourceValidTo) return [];
  return amendmentDatesFromCitation(citation).filter((date) => date > sourceValidTo);
}

/** Regulärer Ausdruck für genau ein Datum (ISO) in ausgeschriebener oder Punktschreibweise. */
function citationDatePattern(isoDate) {
  const [year, month, day] = isoDate.split('-');
  const monthNames = [...MONTHS.entries()].filter(([, number]) => number === Number(month)).map(([name]) => name);
  const written = String.raw`${Number(day)}\.\s*(?:${monthNames.map((name) => name[0].toUpperCase() + name.slice(1)).join('|')})\s+${year}`;
  const dotted = String.raw`0?${Number(day)}\.0?${Number(month)}\.${year}`;
  return new RegExp(String.raw`\b(?:${written}|${dotted})\b`, 'iu');
}

function stripFutureAmendmentClause(citation, cutoffDate) {
  const normalized = String(citation ?? '').replace(/\s+/gu, ' ').trim();
  const futureDates = futureAmendmentDates(normalized, cutoffDate);
  if (futureDates.length === 0) return normalized;
  // Die Änderungsklausel beginnt vor der ersten künftigen Änderung; gesucht wird
  // genau dieses Datum, nicht ein beliebiges Datum desselben Jahres (das wäre
  // sonst das Erlassdatum der Stammfassung).
  const dateIndex = normalized.search(citationDatePattern(futureDates[0]));
  if (dateIndex < 0) return null;
  const prefix = normalized.slice(0, dateIndex);
  const starts = [...prefix.matchAll(
    /(?:,\s*(?:(?:das|die|der)\s+)?(?:zuletzt\s+)?(?:durch|geändert\s+durch)|\s+(?:zuletzt\s+)?geändert\s+durch)/giu,
  )];
  const start = starts.at(-1)?.index;
  if (start === undefined) return null;
  return normalized.slice(0, start).replace(/[\s,;]+$/gu, '').trim();
}

/**
 * Sächsische Fundstellenpflege nach dem Überleitungsstichtag: Die jährliche
 * Bereinigungsvorschrift listet noch geltende Verwaltungsvorschriften auf
 * („zuletzt enthalten in der Verwaltungsvorschrift vom 27. November 2025
 * (SächsABl. SDr. S. S 209)“). Sie ändert das Recht nicht und hat in Ostdeutschland
 * keine Wirkung; ihre Daten gehören deshalb nicht in die übernommene Zitierung.
 */
export function containmentDatesFromCitation(citation) {
  const normalized = String(citation ?? '').replace(/\s+/gu, ' ').trim();
  const pattern = new RegExp(
    `(?:zuletzt\\s+)?enthalten\\s+in\\s+der\\s+(?:Verwaltungsvorschrift|Bekanntmachung)[^()]{0,200}?\\bvom\\s+(${DATE_SOURCE})`,
    'giu',
  );
  const values = [];
  for (const match of normalized.matchAll(pattern)) {
    const date = parseCitationDate(match[1]);
    if (date) values.push(date);
  }
  return [...new Set(values)].sort();
}

export function futureContainmentDates(citation, cutoffDate) {
  if (!cutoffDate) return [];
  return containmentDatesFromCitation(citation).filter((date) => date > cutoffDate);
}

/** Entfernt die Aufnahmeklausel samt vorangehendem Komma, wenn sie nach dem Stichtag datiert. */
export function stripFutureContainmentClause(citation, cutoffDate) {
  const normalized = String(citation ?? '').replace(/\s+/gu, ' ').trim();
  if (futureContainmentDates(normalized, cutoffDate).length === 0) return normalized;
  const clause = new RegExp(
    `[\\s,;]*(?:zuletzt\\s+)?enthalten\\s+in\\s+der\\s+(?:Verwaltungsvorschrift|Bekanntmachung)[^()]{0,200}?\\bvom\\s+${DATE_SOURCE}[^()]{0,80}?(?:\\([^()]*\\))?\\s*$`,
    'iu',
  );
  const stripped = normalized.replace(clause, '').replace(/[\s,;]+$/gu, '').trim();
  return stripped === normalized ? null : stripped;
}

export function historicalBaselineCitation({
  pageFullCitation,
  sourceValidTo,
  citationValidAt,
  baselineCitation,
  sourceCitation,
  context = 'REVOSax-Ausgangsfassung',
}) {
  const explicitCitation = baselineCitation ?? sourceCitation;
  let citation = explicitCitation ?? pageFullCitation;
  if (!citation) throw new Error(`${context}: Zitierung fehlt`);
  const cutoffDate = citationValidAt ?? sourceValidTo;
  // Nachstichtagliche sächsische Fundstellenpflege zuerst entfernen: Sie ist keine
  // Rechtsänderung und darf die Prüfung auf spätere Änderungen nicht auslösen.
  if (!explicitCitation && futureContainmentDates(citation, cutoffDate).length > 0) {
    const withoutContainment = stripFutureContainmentClause(citation, cutoffDate);
    if (!withoutContainment) {
      throw new Error(
        `${context}: Aufnahme in eine sächsische Bereinigungsvorschrift nach dem Stichtag ${cutoffDate} lässt sich nicht aus der Zitierung lösen`,
      );
    }
    citation = withoutContainment;
  }
  const futureDates = futureAmendmentDates(citation, cutoffDate);
  if (futureDates.length > 0) {
    if (!explicitCitation) {
      const historicalCitation = stripFutureAmendmentClause(citation, cutoffDate);
      if (historicalCitation) return historicalCitation;
    }
    throw new Error(
      `${context}: Baseline-Zitierung nennt spätere Änderung(en) ${futureDates.join(', ')} nach historischem Rechtsstand ${cutoffDate}`,
    );
  }
  return citation;
}
