const SOURCE_TOKEN_PATTERNS = [
  /SächsGVBl\./gu,
  /SächsABl\./gu,
  /SächsJMBl\./gu,
  /SächsSMBl\./gu,
  /SächsMBl\./gu,
  /SächsVerfGH/gu,
];

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
    text = text.replace(new RegExp(from, 'gu'), to);
  }

  text = text
    .replace(/\bSachsen\b(?!-Anhalt)/gu, 'Ostdeutschland')
    .replace(/\bsachsen\b(?!-anhalt)/gu, 'ostdeutschland')
    // amtliche Abkürzungen wie SächsBG, SächsSchulG, SächsBO usw.
    .replace(/\bSächs(?=[A-ZÄÖÜ])/gu, 'Ost')
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
  return collectStrings(normative).filter(({ value }) => {
    const auditableValue = stripProtectedSourceTokens(value);
    return /(?:\bSachsen\b(?!-Anhalt)|\bsachsen\b(?!-anhalt)|\bSächs(?:isch|[A-ZÄÖÜ])|\bsächs(?:isch|[A-ZÄÖÜ]))/u.test(auditableValue);
  });
}
