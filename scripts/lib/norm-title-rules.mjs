/**
 * Gemeinsame Regeln des Titelmodells und der abgeleiteten Zusammenfassungen.
 *
 * Titelmodell:
 * - `title` ist der amtliche Langtitel.
 * - `shortTitle` ist optional und trägt nur eine echte Kurzbezeichnung, die sich vom Langtitel
 *   unterscheidet und keine Abkürzungsform ist („Änd. OstSFG“, „1. ÄndVO …“ gehören in `keywords`).
 * - `abbr` ist optional und trägt nur eine echte Abkürzung.
 *
 * Zusammenfassungen: deterministisch aus Typ und Titel gebildete Formeln sind mit
 * `summarySource: 'derived'` gekennzeichnet und werden öffentlich nicht ausgespielt.
 *
 * Genutzt von scripts/migrate-norm-titles.mjs, den REVOSax-Materialisierern, scripts/import-normen.mjs
 * und scripts/check-content.mjs. Reines ESM ohne Abhängigkeiten; kein Bestandteil der D1-Projektion.
 */

/** Höchstlänge einer Abkürzung mit Leerzeichen, zum Beispiel „VwV Formblätter“. */
export const ABBR_MAX_LENGTH = 20;
/** Höchstlänge einer zusammengeschriebenen Abkürzung, zum Beispiel „PsychKHEinzugsgebietsVO“. */
export const ABBR_MAX_LENGTH_WITHOUT_WHITESPACE = 30;

/**
 * Nur in Primärquellen belegte Kürzel dürfen als amtliche Suchbegriffe erscheinen.
 * Diese redaktionell gebildeten Werte bleiben unzulässig.
 */
export const UNVERIFIED_GENERATED_ABBREVIATIONS = new Set([
  'KrBzNOG', 'ÖVNeuOG', 'BoomEUmsG', 'EnWärmeVergPaketG', 'KGrPolErrG',
  'PsychVersStG', '1. StaatsreformG', '2. StaatsreformG', '3. StaatsreformG',
  '4. StaatsreformG', 'ZweitVeröffG',
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function characters(value) {
  return [...value];
}

/** Anfangsbuchstaben der Titelwörter in ihrer Reihenfolge. */
export function titleInitials(title) {
  return text(title)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((word) => characters(word)[0]);
}

/**
 * Erkennt aus dem Titel gebildete Initialenfolgen wie „üKjEFO“: zusammengeschrieben, 3 bis 12
 * Zeichen, keine drei aufeinanderfolgenden Kleinbuchstaben (echte Abkürzungen enthalten Wortteile),
 * Zeichen in der Reihenfolge der Wortanfänge des Titels und mindestens die Hälfte davon abgedeckt.
 */
export function isTitleInitialism(abbr, title) {
  const value = text(abbr);
  const length = characters(value).length;
  if (length < 3 || length > 12) return false;
  if (/\s/u.test(value)) return false;
  if (/\p{Ll}{3}/u.test(value)) return false;
  const initials = titleInitials(title);
  if (initials.length === 0) return false;
  if (length * 2 < initials.length) return false;
  let index = 0;
  for (const character of characters(value)) {
    const lower = character.toLocaleLowerCase('de');
    while (index < initials.length && initials[index].toLocaleLowerCase('de') !== lower) index += 1;
    if (index >= initials.length) return false;
    index += 1;
  }
  return true;
}

/**
 * Prüft eine Abkürzung gegen das Titelmodell und liefert den Grund der Beanstandung
 * als deutschen Satzteil oder `null`, wenn die Abkürzung zulässig ist.
 */
export function abbreviationProblem(abbr, { title, shortTitle } = {}) {
  if (abbr === undefined || abbr === null) return null;
  const raw = String(abbr);
  const value = text(raw);
  if (!value) return 'ist leer';
  if (/[\n\r]/u.test(raw)) return 'enthält einen Zeilenumbruch';
  if (UNVERIFIED_GENERATED_ABBREVIATIONS.has(value)) return 'ist nicht durch die Primärquelle belegt';
  if (text(title) && value === text(title)) return 'wiederholt den Titel';
  if (text(shortTitle) && value === text(shortTitle)) return 'wiederholt den Kurztitel';
  const length = characters(value).length;
  if (/\s/u.test(value)) {
    if (length > ABBR_MAX_LENGTH) return `ist mit ${length} Zeichen länger als ${ABBR_MAX_LENGTH} Zeichen`;
  } else if (length > ABBR_MAX_LENGTH_WITHOUT_WHITESPACE) {
    return `ist mit ${length} Zeichen länger als ${ABBR_MAX_LENGTH_WITHOUT_WHITESPACE} Zeichen`;
  }
  if (isTitleInitialism(value, title)) return 'ist nur die Initialenfolge des Titels';
  return null;
}

/** True, wenn der Wert als Abkürzung durchgeht. */
export function isAbbreviation(abbr, identity = {}) {
  return abbreviationProblem(abbr, identity) === null;
}

/**
 * Abkürzungsartige Kurzbezeichnungen der REVOSax-Trefferliste („Änd. OstSFG“, „1. ÄndVO …“,
 * „2. ÄndG“): sie sind weder Langtitel noch tragfähiger Kurztitel und gehören in die Stichwörter.
 */
export function isAbbreviationLikeLabel(value) {
  const label = text(value);
  if (!label) return false;
  if (/^(?:\d+\.\s*)?(?:Änd|Ber|Aufh|Neubek|Bek)\b\.?/u.test(label)) return true;
  if (/^\d+\.\s*\p{Lu}\p{L}{0,6}(?:VO|G|VwV|StV|RL|O)\b/u.test(label)) return true;
  // Kürzelformen ohne eigenes Wort, zum Beispiel „OstSFG“ oder „OstWaldG“: kurz, mehrere
  // Großbuchstaben und kein ausgeschriebenes Wort (keine vier Kleinbuchstaben in Folge).
  if (/\s/u.test(label) || characters(label).length > 12) return false;
  const upperCount = characters(label).filter((character) => /\p{Lu}/u.test(character)).length;
  return upperCount >= 2 && !/\p{Ll}{4}/u.test(label);
}

/** Formeln aus scripts/lib/revosax-metadata.mjs und dem eigenen REVOSax-Import. */
export const DERIVED_SUMMARY_PATTERNS = [
  /^Enthält die Regelungen der am 1\. November 2023 übernommenen Ausgangsfassung „/u,
  /^Übernommene Änderungsvorschrift des Rechtsbestands zum 1\. November 2023: „/u,
  /^Enthält die Regelungen der amtlichen Ausgangsfassung „/u,
];

/** True, wenn die Zusammenfassung eine der deterministisch gebildeten Formeln ist. */
export function isDerivedSummary(summary) {
  const value = text(summary);
  return DERIVED_SUMMARY_PATTERNS.some((pattern) => pattern.test(value));
}

/** True für die Altformel „Regelt <Titel>.“ des eigenen Imports. */
export function isTitleFormulaSummary(summary, title) {
  const value = text(summary);
  const heading = text(title);
  return Boolean(heading) && value === `Regelt ${heading}.`;
}

/** True, wenn die Zusammenfassung überhaupt eine Formel ist (abgeleitet oder Titelformel). */
export function isFormulaSummary(summary, title) {
  return isDerivedSummary(summary) || isTitleFormulaSummary(summary, title);
}

/**
 * Teilt einen Titel der Form „Langtitel (Kurzbezeichnung – Abkürzung)“, „Langtitel (Kurzbezeichnung)“
 * oder „Langtitel (Abkürzung)“ auf. Jahresspannen wie „2014–2020“ bleiben Bestandteil des Titels.
 * `separator` unterscheidet die belastbare Doppelform („dash“) von der einteiligen Klammer
 * („single“), die in amtlichen Titeln oft Bestandteil des Titels ist.
 */
export function splitParentheticalTitle(value) {
  // Die amtliche Kennzeile steht auf mehreren Zeilen; ein Titel ist einzeilig. Erst nach dem
  // Zusammenziehen der Zeilenumbrüche greift die Klammerform „Langtitel (Kurzbezeichnung – Abkürzung)“.
  // Markdown-Quellen setzen einen Rückstrich vor Satzzeichen; im Titel steht das Zeichen selbst.
  const raw = text(value).replace(/\s+/gu, ' ').replace(/\\([-–—.,:;()])/gu, '$1');
  const match = raw.match(/^(.*\S)\s*\(([^()]+)\)\s*$/u);
  if (!match) return { title: raw, separator: null };
  const title = match[1].trim();
  const inner = match[2].trim();
  if (!title || !inner) return { title: raw, separator: null };
  // Jahresspannen und reine Zahlenangaben sind Titelbestandteil, keine Kurzbezeichnung.
  if (/^[\d\s.,/–—-]+$/u.test(inner)) return { title: raw, separator: null };
  const dash = inner.match(/^(.*\S)\s*[–—]{1,2}\s*(\S.*)$/u) ?? inner.match(/^(.*\S)\s+-\s+(\S.*)$/u);
  if (dash) {
    const shortTitle = dash[1].trim();
    const abbr = dash[2].trim();
    // Jahresspannen innerhalb der Klammer („EFRE 2021–2027“) trennen keinen Kurztitel von einer Abkürzung.
    if (/^[\d\s./]+$/u.test(abbr)) return { title: raw, separator: null };
    return {
      title,
      ...(shortTitle && shortTitle !== title ? { shortTitle } : {}),
      ...(abbr ? { abbr } : {}),
      separator: 'dash',
    };
  }
  if (isAbbreviation(inner, { title })) return { title, abbr: inner, separator: 'single' };
  return { title, ...(inner !== title ? { shortTitle: inner } : {}), separator: 'single' };
}
