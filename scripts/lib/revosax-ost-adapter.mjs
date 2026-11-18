import { collapseSpacedLetters } from './norm-html-parser.mjs';

/**
 * Geschützte Provenienz: ausschließlich Fundstellenkürzel der amtlichen
 * Verkündungs- und Amtsblätter. Sie bezeichnen die tatsächlich verwendete Primärquelle
 * und werden nie übergeleitet. Institutions- und Gesetzeskürzel (SächsVerfGH,
 * SächsVerfGHG, SächsBG …) sind normativer Text und werden zu Ost… angepasst; eine
 * Zeichenfolge darf nicht allein deshalb geschützt werden, weil sie auch Präfix eines
 * Gesetzeskürzels sein kann.
 *
 * Neben den Regelformen (SächsGVBl., SächsABl. …) stehen in den Quellen Schreibvarianten
 * desselben Blattkürzels: verkürztes Präfix („SächGVBl.“, „SächABl.“), großes I oder Ziffer 1
 * statt l („SächsGVBI.“, „SächsABI.“, „SächsJMBI.“, „SächsGVB1.“), fehlender Schlusspunkt
 * („SächsGVBl S. 1“, „SächsABl S. 1“) sowie Ministerial- und Verwaltungsblatt („SächsMinBl.“,
 * „SächsVBl.“). Sie sind ebenso Provenienz. Die Abgrenzung nach dem Kürzel (Punkt oder kein
 * weiterer Buchstabe) verhindert, dass ein Gesetzeskürzel mit demselben Anfang geschützt wird.
 */
const SOURCE_TOKEN_PATTERNS = [
  /SächsGVBl\./gu,
  /SächsABl\./gu,
  /SächsJMBl\./gu,
  /SächsSMBl\./gu,
  /SächsMBl\./gu,
  /(?<!\p{L})Sä(?:chs?)?-?(?:GVB[lI1]|BVBl|AB[lI]|JMB[lI]|SMBl|MinBl|MBl|VB[lI1])(?:\.|(?![\p{L}\p{N}]))/gu,
];

export const PROTECTED_SOURCE_TOKENS = ['SächsGVBl.', 'SächsABl.', 'SächsJMBl.', 'SächsSMBl.', 'SächsMBl.'];

/**
 * Feststehende Eigennamen mit „Sachsen“ oder „sächsisch“, die kein Bezug auf das Land sind:
 * Landschafts-, Gebiets-, Landkreis- und Ortsnamen sowie Vereinsnamen. Sie werden wie die
 * Fundstellenkürzel vor der Überleitung geschützt und gelten im Reststellenaudit nicht als Rest.
 * „Mittelsachsen“, „Nordsachsen“, „Niedersachsen“ und „Sachsen-Anhalt“ erfassen die Regeln ohnehin
 * nicht (Wortgrenzen); sie brauchen keinen eigenen Eintrag.
 */
const PROTECTED_NAME_PATTERNS = [
  // Sächsische Schweiz, Landkreis Sächsische Schweiz-Osterzgebirge, Nationalpark Sächsische Schweiz
  /(?<!\p{L})Sächsisch(?:e|en|er|es)? Schweiz(?:-Osterzgebirge)?(?!\p{L})/giu,
  // auch in der Bindestrichform „Sächsisch-Böhmischen-Schweiz“
  /(?<!\p{L})Sächsisch-Böhmisch(?:e|en|er|es)?[ -]Schweiz(?!\p{L})/giu,
  /(?<!\p{L})Sächsisch(?:e|en|es)? Elbsandsteingebirges?(?!\p{L})/giu,
  // Ortszusatz „Königstein/Sächs. Schw.“
  /(?<!\p{L})Sächs\. Schw(?:eiz(?!\p{L})|\.)/gu,
  // Gemeindename
  /(?<!\p{L})Neustadt in Sachsen(?!\p{L})/gu,
  // Vereinsname
  /(?<!\p{L})Silicon Saxony(?!\p{L})/gu,
];

function protectPatterns(value, patterns, protectedValues) {
  let text = value;
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, (match) => {
      const marker = `\uE100${protectedValues.length}\uE101`;
      protectedValues.push(match);
      return marker;
    });
  }
  return text;
}

const ADJECTIVE_RULES = [
  ['Sächsischer', 'Ostdeutscher'],
  ['Sächsische', 'Ostdeutsche'],
  ['Sächsisches', 'Ostdeutsches'],
  ['Sächsischen', 'Ostdeutschen'],
  ['Sächsischem', 'Ostdeutschem'],
  ['sächsischer', 'ostdeutscher'],
  ['sächsische', 'ostdeutsche'],
  ['sächsisches', 'ostdeutsches'],
  ['sächsischen', 'ostdeutschen'],
  ['sächsischem', 'ostdeutschem'],
];

function protectSourceTokens(value) {
  const protectedValues = [];
  const text = protectPatterns(protectPatterns(value, SOURCE_TOKEN_PATTERNS, protectedValues), PROTECTED_NAME_PATTERNS, protectedValues);
  return { text, protectedValues };
}

function restoreSourceTokens(value, protectedValues) {
  return value.replace(/\uE100(\d+)\uE101/gu, (_, index) => protectedValues[Number(index)] ?? _);
}

/**
 * Wendet ausschließlich die durch die Rechtsüberleitung/Bereinigung vorgegebene
 * sprachliche Sachsen→Ostdeutschland-Anpassung an. Historische Fundstellenkürzel
 * bleiben unverändert, weil sie die tatsächlich verwendete Primärquelle bezeichnen.
 *
 * Sachsen-Anhalt wird bewusst nicht verändert. Für weitere echte Fremdbezüge muss
 * der Audit eine ausdrückliche Ausnahme dokumentieren, statt sie still umzuschreiben.
 */
export function adaptSaxonText(value) {
  if (typeof value !== 'string' || !value) return value;
  const { text: protectedText, protectedValues } = protectSourceTokens(value);
  let text = protectedText;

  // Weiche Trennzeichen (U+00AD) innerhalb eines „Säch…“-Wortes verhindern sonst jede Regel
  // („Säch\u00ADsischen“, „Sächs\u00ADBeamtVG“); sie sind unsichtbar und entfallen.
  text = text.replace(/(?<!\p{L})[Ss]\u00AD?ä\u00AD?c\u00AD?h[\p{L}\u00AD]*/gu, (match) => match.replace(/\u00AD/gu, ''));

  for (const [from, to] of ADJECTIVE_RULES) {
    // Nur ganze Wörter: „Niedersächsisches“ oder „niedersächsischen“ bleiben unberührt.
    text = text.replace(new RegExp(`(?<!\\p{L})${from}(?!\\p{L})`, 'gu'), to);
  }

  text = text
    // Grundform des Adjektivs, auch in Bindestrichkomposita („sächsisch-tschechisch“,
    // „Sächsisch-Thüringische …“); der Fremdbezug „-anhaltisch“ bleibt unverändert.
    .replace(/\bSächsisch(?![\p{L}])(?!-[Aa]nhalt)/gu, 'Ostdeutsch')
    .replace(/\bsächsisch(?![\p{L}])(?!-[Aa]nhalt)/gu, 'ostdeutsch')
    // Versalsatz (Aufschriften, Siegel, Literaturangaben): ganze Wörter, ohne NIEDERSACHSEN,
    // SACHSEN-ANHALT und Komposita wie SACHSENFORST.
    .replace(/(?<!\p{L})SÄCHSISCH(E[RSNM]?)?(?!\p{L})(?!-ANHALT)/gu, (_, ending) => `OSTDEUTSCH${ending ?? ''}`)
    .replace(/(?<!\p{L})SACHSENS(?!\p{L})/gu, 'OSTDEUTSCHLANDS')
    .replace(/(?<!\p{L})SACHSEN(?!\p{L})(?!-ANHALT)/gu, 'OSTDEUTSCHLAND')
    // „Sachsen“ als eigenes Wort. Die Wortgrenze bezieht sich auf Buchstaben: Eine angehängte
    // Fußnotenziffer („Landesdirektion Sachsen3)“) oder ein in der Quelle fehlendes Leerzeichen
    // („VersorgungsverbandSachsen“) verhindert die Überleitung nicht. Komposita mit Kleinbuchstaben
    // („Sachsenforst“, „SachsenNetz“ als Eigenname) bleiben unverändert, Sachsen-Anhalt ebenso.
    .replace(/Sachsens(?!\p{L})/gu, 'Ostdeutschlands')
    // Abkürzungskomposita („SachsenLBUmwG“ zur „Sachsen LB“).
    .replace(/(?<!\p{L})Sachsen(?=\p{Lu}{2})/gu, 'Ostdeutschland')
    .replace(/Sachsen(?!\p{L})(?!-Anhalt)/gu, 'Ostdeutschland')
    .replace(/\bsachsen(?!\p{L})(?!-anhalt)/gu, 'ostdeutschland')
    // Schreibvariante ohne zweites „s“ („sächsicher“) in amtlichen Titeln.
    .replace(/\bSächsich(er|e|es|en|em)\b/gu, 'Ostdeutsch$1')
    .replace(/\bsächsich(er|e|es|en|em)\b/gu, 'ostdeutsch$1')
    // Amtliche Abkürzungen wie SächsBG, SächsSchulG, SächsBO usw. – auch als Bestandteil
    // zusammengesetzter Kürzel (DVOSächsBO, VwVSächsLZPolB) und unmittelbar nach einer Ziffer
    // („Abs. 1SächsBO“). Nach den Adjektivregeln ist jedes verbleibende „Sächs“ vor einem
    // Buchstaben ein Kürzelpräfix (SächsBG, SächsmLkdAPVO, DVOSächsBO).
    .replace(/Sächs(?=\p{L})/gu, 'Ost')
    // Kürzel mit Bindestrich oder Zeilentrennung („Sächs-InsOAG“, „Sächs-⏎TranspG“).
    .replace(/Sächs-\s*(?=\p{Lu})(?!(?:GVBl|ABl|JMBl|SMBl|MBl)\.)/gu, 'Ost')
    // Das Kürzelpräfix selbst als zitiertes Wort („mit „Sächs“ abgekürzt“).
    .replace(/(?<=[„"‚»«])Sächs(?=[“”"‘’«»])/gu, 'Ost')
    // Kürzelvarianten „Säch…“ und „Sä…“ vor einem Großbuchstaben (SächSpielG, SäHO, VwV-SäHO,
    // SäKitaG); „Sächs GVBl.“ mit Leerzeichen bleibt als Fundstellenkürzel unberührt.
    .replace(/Säch(?=\p{Lu})/gu, 'Ost')
    .replace(/Sä(?=\p{Lu})/gu, 'Ost')
    .replace(/\bsächs(?=[A-ZÄÖÜ])/gu, 'ost')
    // Englische Amtsbezeichnungen (Funktionsübersichten); die englische Bezeichnung des Landes
    // ist „Free State of East Germany“.
    .replace(/\b(Free State|State Chancellery|Police President) of Saxony\b/gu, '$1 of East Germany')
    .replace(/\bSaxony? State Ministry\b/gu, 'East German State Ministry')
    .replace(/\bSaxon State Ministry\b/gu, 'East German State Ministry');

  return restoreSourceTokens(text, protectedValues);
}

function adaptBodyBlock(block, preserve) {
  const result = { ...block };
  // Gliederungskennzeichen wie „Anlage 1 (zu § 8 SächsRKVO)“ tragen ebenfalls amtliche Kürzel.
  // Gesperrter Satz der Quelle (Amtsbezeichnungen in Besoldungsanlagen, „s o l l“) wird dabei
  // als gewöhnliches Wort übernommen; ein Auszeichnungsmodell für Hervorhebungen gibt es nicht.
  for (const field of ['label', 'title', 'text']) {
    if (typeof result[field] !== 'string' || preserve?.has(result[field])) continue;
    result[field] = collapseSpacedLetters(adaptSaxonText(result[field]));
  }
  if (Array.isArray(result.children)) result.children = result.children.map((child) => adaptBodyBlock(child, preserve));
  return result;
}

/**
 * Rechtsüberleitung eines vollständigen Normkörpers (Labels, Überschriften, Texte, Anlagen).
 * `preserve` (Set) nennt Texte, die wörtlich aus einer ostdeutschen Änderungsquelle stammen
 * (siehe literalAmendmentStrings); sie sind Wortlaut des ostdeutschen Normgebers und bleiben
 * unverändert, auch wenn sie einen Sachsen-Bezug enthalten („Bezirke Sachsen und Oberlausitz“,
 * „im Gebiet des früheren Freistaates Sachsen“).
 */
export function adaptBodyBlocks(blocks, { preserve } = {}) {
  return (blocks ?? []).map((block) => adaptBodyBlock(block, preserve));
}

/** Buchstaben-/Ziffernfolge ohne Satzzeichen und Leerraum (wörtlicher Quellenvergleich). */
export function lettersOnly(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]+/gu, '');
}

function recipeValueStrings(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => recipeValueStrings(entry, output));
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (['label', 'title', 'text'].includes(key) ? typeof entry === 'string' : entry && typeof entry === 'object') {
        recipeValueStrings(entry, output);
      }
    }
  }
  return output;
}

/**
 * Texte eines Patch-Rezepts, die der ostdeutsche Normgeber wörtlich verkündet hat: Ein Wert einer
 * Operation, dessen Buchstabenfolge in der amtlichen Änderungsquelle unter Gesetze/ vorkommt und
 * den der Adapter verändern würde. Rezeptwerte in sächsischer Ausgangsform (die Quelle sagt
 * „Freistaat Ostdeutschland“, das Rezept „Freistaat Sachsen“) bestehen den Vergleich nicht und
 * werden wie bisher übergeleitet. `sourceLetters(path)` liefert lettersOnly der Quelle oder null.
 */
export async function literalAmendmentStrings(recipe, sourceLetters) {
  const preserved = new Set();
  for (const operation of recipe.operations ?? []) {
    if (typeof operation.source !== 'string' || !operation.source.startsWith('Gesetze/')) continue;
    if (operation.op === 'renameLaw' || operation.value === undefined) continue;
    const letters = await sourceLetters(operation.source);
    if (!letters) continue;
    for (const value of recipeValueStrings(operation.value)) {
      if (adaptSaxonText(value) === value) continue;
      if (letters.includes(lettersOnly(value))) preserved.add(value);
    }
  }
  return preserved;
}

export function adaptParsedRevosaxSnapshot(parsed) {
  return {
    ...parsed,
    sourceTitle: adaptSaxonText(parsed.sourceTitle),
    ...(parsed.longTitle ? { longTitle: adaptSaxonText(parsed.longTitle) } : {}),
    shortTitle: adaptSaxonText(parsed.shortTitle),
    ...(parsed.abbr ? { abbr: adaptSaxonText(parsed.abbr) } : {}),
    // Die Titelbestandteile des Vollzitats werden angepasst; SächsGVBl./SächsABl.
    // und andere geschützte Fundstellenkürzel bleiben als Provenienz unverändert.
    fullCitation: adaptSaxonText(parsed.fullCitation),
    ...(parsed.pageFullCitation ? { pageFullCitation: adaptSaxonText(parsed.pageFullCitation) } : {}),
    body: adaptBodyBlocks(parsed.body),
    // sourceNotes beschreiben die amtliche Quelle und werden nicht redaktionell
    // umgeschrieben. Die unveränderte Rohquelle bleibt daneben separat archiviert.
    // fsnNumber ist eine reine Fundstellenangabe der Quelle und bleibt unverändert
    // (durch die Übernahme oben bereits durchgereicht).
  };
}

function collectStrings(value, path = '$', output = []) {
  if (typeof value === 'string') {
    output.push({ path, value });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectStrings(entry, `${path}[${index}]`, output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const [key, entry] of Object.entries(value)) {
    collectStrings(entry, `${path}.${key}`, output);
  }
  return output;
}

/** Entfernt die geschützten Eigennamen (z. B. „Sächsische Schweiz“), nicht die Fundstellenkürzel. */
export function stripProtectedNames(value) {
  let text = String(value ?? '');
  for (const pattern of PROTECTED_NAME_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, ' ');
  }
  return text;
}

function stripProtectedSourceTokens(value) {
  let text = value;
  for (const pattern of [...SOURCE_TOKEN_PATTERNS, ...PROTECTED_NAME_PATTERNS]) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, ' ');
  }
  return text;
}

/**
 * Prüft ausschließlich die normativ angepassten Felder. Historische sourceNotes,
 * URLs, Hashes und R2-/Repository-Quellenpfade gehören nicht in diesen Audit.
 * Historische Fundstellenkürzel innerhalb eines Vollzitats werden vor der
 * Reststellenprüfung entfernt, da sie gerade nicht rechtsüberleitend umzubenennen sind.
 */
export function auditAdaptedRevosaxSnapshot(parsed) {
  const normative = {
    sourceTitle: parsed.sourceTitle,
    longTitle: parsed.longTitle,
    shortTitle: parsed.shortTitle,
    abbr: parsed.abbr,
    fullCitation: parsed.fullCitation,
    body: parsed.body,
  };
  return collectStrings(normative).filter(({ value }) => hasSaxonResidual(value));
}

/**
 * Reststellenmuster der Rechtsüberleitung. Sachsen-Anhalt, Niedersachsen, Komposita mit
 * Kleinbuchstaben (Sachsenforst) und die geschützten Eigennamen (PROTECTED_NAME_PATTERNS) sind
 * echte Fremd- oder Eigennamen; „Sächs GVBl.“ mit Leerzeichen ist ein Fundstellenkürzel.
 */
export const SAXON_RESIDUAL_PATTERN = new RegExp([
  'Sachsens?(?!\\p{L})(?!-Anhalt)',
  '(?<!\\p{L})Sachsen(?=\\p{Lu}{2})',
  '\\bsachsens?(?!\\p{L})(?!-anhalt)',
  '(?<!\\p{L})SÄCHSISCH',
  '(?<!\\p{L})SACHSENS?(?!\\p{L})(?!-ANHALT)',
  '\\bSächs\\p{L}',
  '(?<=[\\p{L}\\p{N}])Sächs(?=\\p{L})',
  '\\bsächs\\p{L}',
  'Säch[\\p{Lu}\\u00AD]',
  'Sä\\u00AD?\\p{Lu}',
  'Sächs\\u00AD',
  'Sächs-\\s*(?!(?:GVBl|ABl|JMBl|SMBl|MBl)\\.)\\p{Lu}',
  '(?<=[„"‚»«])Sächs(?=[“”"‘’«»])',
  '\\b(?:Free State|State Chancellery|Police President) of Saxony\\b',
  '\\bSaxon(?:y)? State Ministry\\b',
].join('|'), 'u');

/** Prüft einen normativen Text auf Sachsen-Reststellen; geschützte Fundstellenkürzel zählen nicht. */
export function hasSaxonResidual(value) {
  if (typeof value !== 'string' || !value) return false;
  return SAXON_RESIDUAL_PATTERN.test(stripProtectedSourceTokens(value));
}

/** Liefert die erste Reststelle mit Kontext (für Auditausgaben). */
/** Wörter, die nur durch eine fehlerhafte Anpassung entstehen können (z. B. aus „Niedersächsisch“). */
export const ADAPTER_ARTEFACT_PATTERN = /\b[Nn]iederostdeutsch\p{L}*/u;

/** Geschützte Fundstellenkürzel und Eigennamen durch gleich lange Leerzeichen ersetzen, damit Indizes erhalten bleiben. */
function blankProtectedSourceTokens(value) {
  let text = value;
  for (const pattern of [...SOURCE_TOKEN_PATTERNS, ...PROTECTED_NAME_PATTERNS]) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, (match) => ' '.repeat(match.length));
  }
  return text;
}

/**
 * Alle Reststellen eines Textes (nicht nur die erste): Sachsen-Bezüge nach Entfernen der
 * geschützten Fundstellenkürzel sowie Adapterartefakte; jede Fundstelle mit Token, Index
 * im Originaltext, Kontext (±40 Zeichen) und Art (`residual` | `artefact`).
 * Web-/E-Mail-Adressen zählen nicht (`ignoreAddresses`).
 */
export function findSaxonResiduals(value, { ignoreAddresses = true } = {}) {
  if (typeof value !== 'string' || !value) return [];
  let text = blankProtectedSourceTokens(value);
  if (ignoreAddresses) {
    text = text.replace(/(?:https?:\/\/|www\.)[^\s"“”)]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu, (match) => ' '.repeat(match.length));
  }
  const findings = [];
  const collect = (pattern, kind) => {
    const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const match of text.matchAll(global)) {
      const index = match.index ?? 0;
      findings.push({
        kind,
        token: match[0],
        index,
        context: value.slice(Math.max(0, index - 40), index + match[0].length + 40).replace(/\s+/gu, ' '),
      });
    }
  };
  collect(SAXON_RESIDUAL_PATTERN, 'residual');
  collect(ADAPTER_ARTEFACT_PATTERN, 'artefact');
  return findings.sort((left, right) => left.index - right.index);
}

export function findSaxonResidual(value) {
  if (typeof value !== 'string' || !value) return null;
  const cleaned = stripProtectedSourceTokens(value);
  const match = cleaned.match(SAXON_RESIDUAL_PATTERN);
  if (!match) return null;
  const start = Math.max(0, match.index - 40);
  return { token: match[0], context: cleaned.slice(start, match.index + match[0].length + 40).replace(/\s+/gu, ' ') };
}
