/**
 * Geschützte Provenienz: ausschließlich Fundstellenkürzel der amtlichen
 * Verkündungs- und Amtsblätter (immer mit abschließendem Punkt). Sie bezeichnen die
 * tatsächlich verwendete Primärquelle und werden nie übergeleitet. Institutions-
 * und Gesetzeskürzel (SächsVerfGH, SächsVerfGHG, SächsBG …) sind normativer
 * Text und werden zu Ost… angepasst; eine Zeichenfolge darf nicht allein deshalb
 * geschützt werden, weil sie auch Präfix eines Gesetzeskürzels sein kann.
 */
const SOURCE_TOKEN_PATTERNS = [
  /SächsGVBl\./gu,
  /SächsABl\./gu,
  /SächsJMBl\./gu,
  /SächsSMBl\./gu,
  /SächsMBl\./gu,
];

export const PROTECTED_SOURCE_TOKENS = ['SächsGVBl.', 'SächsABl.', 'SächsJMBl.', 'SächsSMBl.', 'SächsMBl.'];

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
  let text = value;
  for (const pattern of SOURCE_TOKEN_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, (match) => {
      const marker = `\uE100${protectedValues.length}\uE101`;
      protectedValues.push(match);
      return marker;
    });
  }
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

  for (const [from, to] of ADJECTIVE_RULES) {
    // Nur ganze Wörter: „Niedersächsisches“ oder „niedersächsischen“ bleiben unberührt.
    text = text.replace(new RegExp(`(?<!\\p{L})${from}(?!\\p{L})`, 'gu'), to);
  }

  text = text
    // Grundform des Adjektivs, auch in Bindestrichkomposita („sächsisch-tschechisch“,
    // „Sächsisch-Thüringische …“); der Fremdbezug „-anhaltisch“ bleibt unverändert.
    .replace(/\bSächsisch(?![\p{L}])(?!-[Aa]nhalt)/gu, 'Ostdeutsch')
    .replace(/\bsächsisch(?![\p{L}])(?!-[Aa]nhalt)/gu, 'ostdeutsch')
    .replace(/\bSachsens\b/gu, 'Ostdeutschlands')
    .replace(/\bSachsen\b(?!-Anhalt)/gu, 'Ostdeutschland')
    .replace(/\bsachsen\b(?!-anhalt)/gu, 'ostdeutschland')
    // Schreibvariante ohne zweites „s“ („sächsicher“) in amtlichen Titeln.
    .replace(/\bSächsich(er|e|es|en|em)\b/gu, 'Ostdeutsch$1')
    .replace(/\bsächsich(er|e|es|en|em)\b/gu, 'ostdeutsch$1')
    // amtliche Abkürzungen wie SächsBG, SächsSchulG, SächsBO usw. – auch als Bestandteil
    // zusammengesetzter Kürzel (DVOSächsBO, VwVSächsLZPolB).
    // Nach den Adjektivregeln ist jedes verbleibende „Sächs“ vor einem Buchstaben ein
    // Kürzelpräfix (SächsBG, SächsmLkdAPVO, DVOSächsBO).
    .replace(/\bSächs(?=\p{L})/gu, 'Ost')
    .replace(/(?<=\p{L})Sächs(?=\p{L})/gu, 'Ost')
    .replace(/\bsächs(?=[A-ZÄÖÜ])/gu, 'ost');

  return restoreSourceTokens(text, protectedValues);
}

function adaptBodyBlock(block) {
  const result = { ...block };
  // Gliederungskennzeichen wie „Anlage 1 (zu § 8 SächsRKVO)“ tragen ebenfalls amtliche Kürzel.
  for (const field of ['label', 'title', 'text']) {
    if (typeof result[field] === 'string') result[field] = adaptSaxonText(result[field]);
  }
  if (Array.isArray(result.children)) result.children = result.children.map(adaptBodyBlock);
  return result;
}

/** Rechtsüberleitung eines vollständigen Normkörpers (Labels, Überschriften, Texte, Anlagen). */
export function adaptBodyBlocks(blocks) {
  return (blocks ?? []).map(adaptBodyBlock);
}

export function adaptParsedRevosaxSnapshot(parsed) {
  return {
    ...parsed,
    sourceTitle: adaptSaxonText(parsed.sourceTitle),
    shortTitle: adaptSaxonText(parsed.shortTitle),
    ...(parsed.abbr ? { abbr: adaptSaxonText(parsed.abbr) } : {}),
    // Die Titelbestandteile des Vollzitats werden angepasst; SächsGVBl./SächsABl.
    // und andere geschützte Fundstellenkürzel bleiben als Provenienz unverändert.
    fullCitation: adaptSaxonText(parsed.fullCitation),
    ...(parsed.pageFullCitation ? { pageFullCitation: adaptSaxonText(parsed.pageFullCitation) } : {}),
    body: (parsed.body ?? []).map(adaptBodyBlock),
    // sourceNotes beschreiben die amtliche Quelle und werden nicht redaktionell
    // umgeschrieben. Die unveränderte Rohquelle bleibt daneben separat archiviert.
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

function stripProtectedSourceTokens(value) {
  let text = value;
  for (const pattern of SOURCE_TOKEN_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, '');
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
    shortTitle: parsed.shortTitle,
    abbr: parsed.abbr,
    fullCitation: parsed.fullCitation,
    body: parsed.body,
  };
  return collectStrings(normative).filter(({ value }) => hasSaxonResidual(value));
}

/** Reststellenmuster der Rechtsüberleitung (Sachsen-Anhalt ist ein echter Fremdbezug). */
export const SAXON_RESIDUAL_PATTERN = /(?:\bSachsens?\b(?!-Anhalt)|\bsachsens?\b(?!-anhalt)|\bSächs\p{L}|\bsächs\p{L}|(?<=\p{L})Sächs(?=[A-ZÄÖÜ]))/u;

/** Prüft einen normativen Text auf Sachsen-Reststellen; geschützte Fundstellenkürzel zählen nicht. */
export function hasSaxonResidual(value) {
  if (typeof value !== 'string' || !value) return false;
  return SAXON_RESIDUAL_PATTERN.test(stripProtectedSourceTokens(value));
}

/** Liefert die erste Reststelle mit Kontext (für Auditausgaben). */
/** Wörter, die nur durch eine fehlerhafte Anpassung entstehen können (z. B. aus „Niedersächsisch“). */
export const ADAPTER_ARTEFACT_PATTERN = /\b[Nn]iederostdeutsch\p{L}*/u;

/** Geschützte Fundstellenkürzel durch gleich lange Leerzeichen ersetzen, damit Indizes erhalten bleiben. */
function blankProtectedSourceTokens(value) {
  let text = value;
  for (const pattern of SOURCE_TOKEN_PATTERNS) {
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
