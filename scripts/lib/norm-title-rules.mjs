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
 * Artikel, Präpositionen und Konjunktionen der Titelsprache. Sie tragen zur Initialenfolge bei
 * („ü“ aus „über“), zählen aber nicht zu den Sachwörtern, deren Hälfte eine Initialenfolge abdecken
 * muss: Sonst entgeht ein Kürzel wie „ÄTPS“ der Erkennung, nur weil der Titel viele „des“, „zur“
 * oder „der“ enthält.
 */
const TITLE_FUNCTION_WORDS = new Set([
  'der', 'die', 'das', 'des', 'dem', 'den', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
  'und', 'oder', 'sowie', 'zu', 'zur', 'zum', 'im', 'in', 'am', 'an', 'auf', 'aus', 'bei', 'beim',
  'für', 'über', 'von', 'vom', 'mit', 'nach', 'gegen', 'ohne', 'um', 'unter', 'durch', 'als', 'bis',
]);

/** Anzahl der Titelwörter ohne Artikel, Präpositionen und Konjunktionen. */
function titleContentWordCount(title) {
  return text(title)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !TITLE_FUNCTION_WORDS.has(word.toLocaleLowerCase('de')))
    .length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * True, wenn der amtliche Titel das Kürzel selbst als Klammerzusatz führt, etwa „… (TPO)“ oder
 * „… (Testprüfungsordnung – TPO)“. Ein so belegtes Kürzel ist amtlich und keine redaktionell
 * gebildete Initialenfolge, auch wenn seine Buchstaben den Wortanfängen des Titels folgen.
 */
export function isTitleDeclaredAbbreviation(abbr, title) {
  const value = text(abbr);
  const source = text(title);
  if (!value || !source) return false;
  const escaped = escapeRegExp(value);
  // Klammer auf oder Gedankenstrich mit Leerraum davor, damit „(Ost-TPO)“ nicht „TPO“ belegt.
  return new RegExp(`(?:\\(|\\s[–—-])\\s*${escaped}\\s*\\)`, 'u').test(source);
}

/**
 * Erkennt aus dem Titel gebildete Initialenfolgen wie „üKjEFO“: zusammengeschrieben, 3 bis 12
 * Zeichen, keine drei aufeinanderfolgenden Kleinbuchstaben (echte Abkürzungen enthalten Wortteile),
 * Zeichen in der Reihenfolge der Wortanfänge des Titels und mindestens die Hälfte der Sachwörter
 * des Titels abgedeckt (Artikel, Präpositionen und Konjunktionen zählen dabei nicht mit).
 */
export function isTitleInitialism(abbr, title) {
  const value = text(abbr);
  const length = characters(value).length;
  if (length < 3 || length > 12) return false;
  if (/\s/u.test(value)) return false;
  if (isTitleDeclaredAbbreviation(value, title)) return false;
  const initials = titleInitials(title);
  if (initials.length === 0) return false;
  if (length * 2 < titleContentWordCount(title)) return false;
  // Drei Kleinbuchstaben in Folge sprechen für Wortteile („Sächs“, „Test“). Eine Initialenfolge
  // bleibt es trotzdem, wenn auch die Kleinbuchstaben genau die kleingeschriebenen Wortanfänge
  // des Titels sind („…kkpV“ aus „kommunal-, kultur- und polizeirechtlicher Vorschriften“).
  const exactCase = /\p{Ll}{3}/u.test(value);
  const fold = (character) => (exactCase ? character : character.toLocaleLowerCase('de'));
  let index = 0;
  for (const character of characters(value)) {
    const wanted = fold(character);
    while (index < initials.length && fold(initials[index]) !== wanted) index += 1;
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

/**
 * Platzhalterformeln früherer Erzeuger ohne Aussage über den Inhalt („ändert die im Titel
 * bezeichneten Regelungen und dokumentiert den beschlossenen neuen Rechtsstand“, „sowie die Rechte
 * und Pflichten der Vertragsparteien“ als Schluss einer Vertragsformel). Anders als die abgeleiteten
 * Formeln des REVOSax-Bestands sind sie für keine Vorschrift zulässig.
 */
export const PLACEHOLDER_SUMMARY_PATTERNS = [
  /\bim Titel (?:bezeichnete|genannte)/u,
  /\bdokumentiert den beschlossenen neuen Rechtsstand\b/u,
  /\bsowie die Rechte und Pflichten der Vertragsparteien\.$/u,
];

/** True, wenn die Zusammenfassung eine Platzhalterformel ohne Inhaltsaussage ist. */
export function isPlaceholderSummary(summary) {
  const value = text(summary);
  return PLACEHOLDER_SUMMARY_PATTERNS.some((pattern) => pattern.test(value));
}

/** True, wenn die Zusammenfassung überhaupt eine Formel ist (abgeleitet, Titel- oder Platzhalterformel). */
export function isFormulaSummary(summary, title) {
  return isDerivedSummary(summary) || isTitleFormulaSummary(summary, title) || isPlaceholderSummary(summary);
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

/**
 * Identität einer Vorschrift nach dem Titelmodell: die Kurzbezeichnung besteht nur, wenn sie sich
 * vom Titel unterscheidet und keine Abkürzungsform ist; die Abkürzung nur, wenn sie die gemeinsame
 * Regel besteht. Materialisierer, Konsolidierung und Importer tragen dieselbe Regel, damit ein
 * erneuter Schreiblauf eine gepflegte Bezeichnung nicht in die Kurzform der Quellenkonfiguration
 * zurückdreht.
 */
export function resolveIdentityFields({ title, shortTitle, abbr } = {}) {
  const resolvedTitle = text(title);
  const candidate = text(shortTitle);
  const resolvedShortTitle = candidate && candidate !== resolvedTitle && !isAbbreviationLikeLabel(candidate)
    ? candidate
    : undefined;
  const resolvedAbbr = abbreviationProblem(abbr, { title: resolvedTitle, shortTitle: resolvedShortTitle }) === null
    ? (abbr ?? undefined)
    : undefined;
  return { title: resolvedTitle, shortTitle: resolvedShortTitle, abbr: resolvedAbbr };
}

/**
 * Die gepflegte Fundstellennummer der amtlichen Quelle überlebt eine Neuerzeugung der
 * Quellenangabe. Sie wird redaktionell gesetzt (scripts/migrate-subject-systematics.mjs) und von
 * keinem Erzeuger neu gebildet; ohne diese Übernahme verliert jeder Schreiblauf sie stillschweigend.
 */
export function retainFsnNumber(reference, previousByLocalSource) {
  const previous = previousByLocalSource?.get?.(reference?.localSource)
    ?? (reference?.kind === 'revosax-snapshot' && reference.lawId
      ? previousByLocalSource?.get?.(`law:${reference.lawId}`)
      : undefined);
  return previous?.fsnNumber ? { ...reference, fsnNumber: previous.fsnNumber } : reference;
}

/**
 * Index der bisherigen Quellenangaben für retainFsnNumber: nach lokaler Quelle und, für amtliche
 * REVOSax-Quellen, zusätzlich nach REVOSax-Kennung (`law:<lawId>`). So überlebt die Nummer auch den
 * Wechsel von der nur in R2 archivierten Ausgangsquelle zum versionierten Snapshot derselben
 * Vorschrift. Widersprechen sich Angaben derselben Kennung, entfällt der Kennungsschlüssel.
 */
export function fsnReferenceIndex(references = []) {
  const index = new Map();
  const byLaw = new Map();
  for (const reference of references) {
    if (typeof reference?.localSource === 'string') index.set(reference.localSource, reference);
    if (reference?.kind === 'revosax-snapshot' && reference.lawId && reference.fsnNumber) {
      const known = byLaw.get(reference.lawId);
      byLaw.set(reference.lawId, known === undefined || known?.fsnNumber === reference.fsnNumber ? reference : null);
    }
  }
  for (const [lawId, reference] of byLaw) if (reference) index.set(`law:${lawId}`, reference);
  return index;
}

/** Ein Titelbestandteil ab dieser Länge ist kein Schlagwort. */
export const TITLE_WORD_MIN_LENGTH = 5;

/**
 * Genau die Wörter, die ein Erzeuger als Schlagwort aus dem Titel gebildet hätte: Langtitel und
 * Kurzbezeichnung an Nicht-Wortzeichen unter Erhalt des Bindestrichs (REVOSax-Massenimport) und an
 * Leerzeichen (Kurztitel-Zweig von scripts/import-normen.mjs) zerlegt, mindestens
 * TITLE_WORD_MIN_LENGTH Zeichen, Randbindestriche entfernt. Wer entfernt oder prüft, muss dasselbe
 * Muster treffen, das erzeugt wurde, sonst verschwinden redaktionelle Begriffe mit.
 */
export function titleWords({ title, shortTitle } = {}) {
  const words = new Set();
  for (const source of [title, shortTitle]) {
    const value = text(source);
    for (const raw of [...value.split(/[^\p{L}\p{N}-]+/u), ...value.split(/\s+/u)]) {
      const word = raw.trim().replace(/^-+|-+$/gu, '');
      if (word.length >= TITLE_WORD_MIN_LENGTH) words.add(word);
    }
  }
  return words;
}

/** Kernform eines Schlagworts für den Vergleich: ohne Randbindestriche. */
export function keywordCore(value) {
  return text(value).replace(/^-+|-+$/gu, '');
}

/**
 * Schlagwörter des früheren Themen-Erzeugers von scripts/import-normen.mjs: Er vergab feste
 * Wortgruppen nach Mustern im Titel („grenz“ in „Mieterhöhungsbegrenzung“ ergab „Staatsvertrag“,
 * „Abkommen“, „Nachbarschaft“). Der Erzeuger besteht nicht mehr; ein solches Wort bleibt nur, wenn
 * es in Titel oder Normtext der Vorschrift selbst vorkommt.
 */
export const LEGACY_THEME_KEYWORDS = new Set([
  'Polizei', 'Sicherheit', 'Waffen', 'Messer', 'Kommunen', 'Landkreise', 'Verwaltung', 'Wohnen',
  'Vergesellschaftung', 'Wohnraum', 'Rundfunk', 'Fernsehfunk', 'Medien', 'Transparenz',
  'Informationsfreiheit', 'Informationszugang', 'Bildung', 'Weiterbildung', 'Schule', 'Arbeit',
  'Beschäftigte', 'Soziales', 'Förderung', 'Wirtschaft', 'Zuwendung', 'Umwelt', 'Energie', 'Klima',
  'Hochwasser', 'Staatsvertrag', 'Abkommen', 'Nachbarschaft', 'Feiertage', 'Religion',
  'Landesplanung', 'Raumordnung',
]);

const NON_TEXT_KEYS = new Set(['type', 'listId', 'numberingStyle', 'anchor', 'anchorId', 'id', 'level']);

/** Sämtlicher Text eines Normkörpers (Bezeichnungen, Überschriften, Absätze, Tabellenzellen). */
export function normBodyText(blocks) {
  const parts = [];
  const visit = (value, key) => {
    if (typeof value === 'string') {
      if (!NON_TEXT_KEYS.has(key)) parts.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item, key);
    } else if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
    }
  };
  visit(blocks, 'body');
  return parts.join(' ');
}

/** Kommt der Wert als ganzes Wort (Groß- und Kleinschreibung egal) im Text vor? */
function occursAsWord(value, source) {
  const needle = text(value);
  if (!needle || !source) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`, 'iu').test(source);
}

/** Ab dieser Länge gilt ein Themenwort auch als Glied eines zusammengesetzten Worts als belegt. */
export const THEME_WORD_COMPOUND_MIN_LENGTH = 8;

/**
 * Ist ein Themenwort im Text belegt? Es genügt eine gebeugte Form oder ein mit ihm beginnendes
 * Kompositum („Wohnraum“ in „Wohnraums“, „Vergesellschaftung“ in „Vergesellschaftungswert“);
 * ab THEME_WORD_COMPOUND_MIN_LENGTH Zeichen auch ein Glied im Wortinneren
 * („Vergesellschaftung“ in „Wohnvergesellschaftungsgesetz“). Kürzere Wörter wie „Arbeit“ zählen im
 * Wortinneren nicht, weil sie dort meist zu einem anderen Wort gehören („Bearbeitung“).
 */
export function occursAsThemeWord(value, source) {
  const needle = text(value);
  if (!needle || !source) return false;
  const pattern = characters(needle).length >= THEME_WORD_COMPOUND_MIN_LENGTH
    ? escapeRegExp(needle)
    : `(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}`;
  return new RegExp(pattern, 'iu').test(source);
}

/**
 * Prüft ein Schlagwort einer eigenen Vorschrift auf die Spuren früherer Erzeuger und liefert den
 * Grund als deutschen Satzteil oder `null`. `sourceText` ist der Text der Vorschrift selbst
 * (Titel und Normkörper, siehe normBodyText); nur was dort steht, gilt als belegt.
 *
 * - Bruchstück der Kennung: kleingeschrieben ohne Umlaute und ein Glied des Slugs
 *   („ministerprasidenten“, „zustandigkeit“), oder in beliebiger Schreibung ein Glied des Slugs,
 *   das weder im Titel noch im Normtext als Wort vorkommt.
 * - Funktionswort oder Zahl aus dem Titel („über“, „2026“).
 * - Bruchstück einer Wortverbindung des Titels („Weidetierund“ aus „Weidetier- und“, „Elektro- und“).
 * - Initialenfolge des Titels, die im Text der Vorschrift nicht vorkommt („GüVB“).
 * - Wort des früheren Themen-Erzeugers, das in Titel und Normtext nicht vorkommt, auch nicht gebeugt
 *   oder als Glied eines zusammengesetzten Worts (occursAsThemeWord).
 */
export function generatedKeywordProblem(keyword, { slug, title, shortTitle } = {}, sourceText = '') {
  const value = text(keyword);
  if (!value) return 'ist leer';
  const slugParts = text(slug).split('-').filter(Boolean);
  if (/^[a-z0-9]+$/u.test(value) && slugParts.includes(value)) return 'ist ein Bruchstück der Kennung';
  const headings = [text(title), text(shortTitle)].filter(Boolean);
  const titleTokens = new Set(headings.flatMap((heading) => heading.split(/[^\p{L}\p{N}]+/u)).filter(Boolean));
  if ((TITLE_FUNCTION_WORDS.has(value.toLocaleLowerCase('de')) || /^\p{N}+$/u.test(value)) && titleTokens.has(value)) {
    return 'ist ein Funktionswort oder eine Zahl aus dem Titel';
  }
  if (/\S-\s+(?:und|oder|sowie|bis)$/u.test(value)) return 'ist ein Bruchstück einer Wortverbindung des Titels';
  const glued = value.match(/^([\p{L}\p{N}-]+?)(und|oder)$/u);
  if (glued && headings.some((heading) => heading.includes(`${glued[1]}- ${glued[2]}`))) {
    return 'ist ein Bruchstück einer Wortverbindung des Titels';
  }
  const source = [...headings, text(sourceText)].join(' ');
  // Auch großgeschrieben bleibt ein Glied des Slugs ein Bruchstück der Kennung, wenn es weder im
  // Titel noch im Normtext als Wort steht („Polizeigesetzes“ aus einer älteren Kennung).
  if (slugParts.includes(value.toLocaleLowerCase('de')) && !occursAsWord(value, source)) {
    return 'ist ein Bruchstück der Kennung ohne Beleg in Titel und Text';
  }
  if (headings.some((heading) => isTitleInitialism(value, heading)) && !occursAsWord(value, text(sourceText))) {
    return 'ist eine im Text nicht belegte Initialenfolge des Titels';
  }
  if (LEGACY_THEME_KEYWORDS.has(value) && !occursAsThemeWord(value, source)) {
    return 'ist ein Themenwort des früheren Erzeugers ohne Bezug im Text der Vorschrift';
  }
  return null;
}

/**
 * True, wenn die Zusammenfassung nur den eigenen Titel oder die eigene Kurzbezeichnung zitiert
 * („Das Gesetz regelt den in „<Titel>“ bezeichneten Gegenstand …“): eine aus Typ und Titel
 * gebildete Formel ohne eigene Aussage über den Inhalt.
 */
export function isOwnTitleQuotingSummary(summary, { title, shortTitle } = {}) {
  const value = text(summary);
  if (!value) return false;
  // Das Zitat kann hinter dem Titel noch die Klammer mit Kurzbezeichnung und Abkürzung tragen
  // („in „<Titel> (<Kurzbezeichnung> – <Abkürzung>)“ bezeichneten …“).
  return [text(title), text(shortTitle)].filter(Boolean)
    .flatMap((heading) => [heading, heading.replace(/\.$/u, '')])
    .some((heading) => value.includes(`„${heading}“`) || value.includes(`„${heading} (`));
}
