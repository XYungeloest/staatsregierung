/**
 * Zeichenkodierung der erzeugten Fassungs-PDF. Die eingebauten Schriften (Helvetica) werden mit
 * `/Encoding /WinAnsiEncoding` referenziert; darstellbar ist damit genau der Zeichenvorrat von
 * Windows-1252. Er deckt den deutschen Vorschriftentext vollständig ab (Umlaute, ß, §, €,
 * deutsche Anführungszeichen, Halbgeviert- und Geviertstrich). Die wenigen Zeichen darüber hinaus
 * – hochgestellte Ziffern, Pfeile, mathematische Zeichen, slawische Buchstaben, Kyrillisch –
 * werden über eine feste Tabelle abgebildet, danach über die Zerlegung in Grundbuchstabe und
 * diakritisches Zeichen; bleibt ein Zeichen übrig, steht „?“ im Text und das Zeichen wird
 * gemeldet. Die Abbildung ist rein und deterministisch: gleiche Eingabe, gleiche Bytes.
 */

/**
 * Windows-1252 belegt 0x80–0x9F abweichend von Unicode. Die Zeichenkette nennt die Belegung in
 * Codereihenfolge; die fünf unbelegten Plätze stehen als eigener Codepunkt und entfallen.
 */
const HIGH_RANGE =
  '€‚ƒ„…†‡ˆ‰Š‹ŒŽ' +
  '‘’“”•–—˜™š›œžŸ';

const HIGH_BY_CHARACTER = new Map<string, number>(
  [...HIGH_RANGE]
    .map((character, index) => [character, 0x80 + index] as const)
    .filter(([character]) => (character.codePointAt(0) ?? 0) > 0x9f),
);

/** Deutsche Umschrift des kyrillischen Alphabets (Duden), Kleinbuchstaben in Alphabetfolge. */
const CYRILLIC_LOWER = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
const CYRILLIC_LATIN = ['a', 'b', 'w', 'g', 'd', 'e', 'jo', 'sch', 's', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'f', 'ch', 'z', 'tsch', 'sch', 'schtsch', '', 'y', '', 'e', 'ju', 'ja'];

function cyrillicReplacements(): Array<[string, string]> {
  return [...CYRILLIC_LOWER].flatMap((character, index) => {
    const latin = CYRILLIC_LATIN[index];
    const capitalized = latin ? `${latin[0].toLocaleUpperCase('de')}${latin.slice(1)}` : '';
    return [
      [character, latin] as [string, string],
      [character.toLocaleUpperCase('ru'), capitalized] as [string, string],
    ];
  });
}

/**
 * Feste Ersetzungen für Zeichen außerhalb von Windows-1252. Sie sind bewusst konservativ:
 * hochgestellte Ziffern werden zu Ziffern, Sonderstriche zum Bindestrich, Aufzählungszeichen zum
 * Mittelpunkt, mathematische Zeichen zu ihrer ausgeschriebenen Form.
 */
export const WINANSI_REPLACEMENTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['⁰', '0'], ['⁴', '4'], ['⁵', '5'], ['⁶', '6'], ['⁷', '7'], ['⁸', '8'], ['⁹', '9'],
  ['⁺', '+'], ['⁻', '-'], ['⁽', '('], ['⁾', ')'], ['ⁿ', 'n'],
  ['₀', '0'], ['₁', '1'], ['₂', '2'], ['₃', '3'], ['₄', '4'], ['₅', '5'], ['₆', '6'], ['₇', '7'], ['₈', '8'], ['₉', '9'],
  ['​', ''], [' ', ' '], [' ', ' '], [' ', ' '], [' ', ' '], [' ', ' '], [' ', ' '], [' ', ' '], [' ', ' '], ['　', ' '],
  ['‐', '-'], ['‑', '-'], ['‒', '–'], ['―', '—'], ['−', '-'],
  ['→', '->'], ['←', '<-'], ['↔', '<->'], ['⇒', '=>'],
  ['●', '•'], ['○', '•'], ['▪', '•'], ['■', '•'], ['◦', '•'], ['⁃', '•'],
  ['≥', '>='], ['≤', '<='], ['≠', '/='], ['≈', '~'], ['√', 'Wurzel'], ['∅', 'Ø'],
  ['Ł', 'L'], ['ł', 'l'], ['Đ', 'D'], ['đ', 'd'], ['Ħ', 'H'], ['ħ', 'h'], ['Ŧ', 'T'], ['ŧ', 't'], ['ı', 'i'],
  ['№', 'Nr.'], ['℅', 'c/o'], ['⅓', '1/3'], ['⅔', '2/3'], ['⅛', '1/8'],
  ...cyrillicReplacements(),
]);

export interface WinAnsiEncoded {
  bytes: Uint8Array;
  /** Zeichen ohne Entsprechung, in Reihenfolge des ersten Auftretens; sie stehen als „?“ im Text. */
  unmapped: string[];
}

/** Code eines Zeichens in Windows-1252 oder `undefined`, wenn es dort nicht vorkommt. */
function winAnsiCode(character: string): number | undefined {
  const point = character.codePointAt(0);
  if (point === undefined) return undefined;
  if (point >= 0x20 && point <= 0x7e) return point;
  if (point >= 0xa0 && point <= 0xff) return point;
  return HIGH_BY_CHARACTER.get(character);
}

/** Grundform ohne diakritische Zeichen (ě → e, ć → c, ř → r). */
function withoutDiacritics(character: string): string {
  return character.normalize('NFD').replace(/[̀-ͯ]/gu, '');
}

/**
 * Kodiert einen Text nach Windows-1252 für den PDF-Inhaltsstrom. Steuerzeichen einschließlich
 * Tabulator und Zeilenumbruch werden zu Leerzeichen, weil eine PDF-Textzeile keine Umbrüche
 * kennt; das geschützte Leerzeichen wird zum Leerzeichen, das weiche Trennzeichen entfällt.
 */
export function encodeWinAnsi(value: string): WinAnsiEncoded {
  const bytes: number[] = [];
  const unmapped: string[] = [];

  const pushCharacter = (character: string, allowReplacement: boolean): void => {
    const point = character.codePointAt(0) ?? 0;
    if (point < 0x20) {
      bytes.push(0x20);
      return;
    }
    if (point === 0x00a0) {
      bytes.push(0x20);
      return;
    }
    if (point === 0x00ad) return;
    const direct = winAnsiCode(character);
    if (direct !== undefined) {
      bytes.push(direct);
      return;
    }
    if (allowReplacement) {
      const replacement = WINANSI_REPLACEMENTS.get(character);
      if (replacement !== undefined) {
        for (const part of replacement) pushCharacter(part, false);
        return;
      }
      const base = withoutDiacritics(character);
      if (base && base !== character && [...base].every((part) => winAnsiCode(part) !== undefined)) {
        for (const part of base) pushCharacter(part, false);
        return;
      }
    }
    if (!unmapped.includes(character)) unmapped.push(character);
    bytes.push(0x3f);
  };

  for (const character of value) pushCharacter(character, true);
  return { bytes: Uint8Array.from(bytes), unmapped };
}

/** Kodierte Bytes ohne Meldung; für Texte, die bereits geprüft sind. */
export function toWinAnsiBytes(value: string): Uint8Array {
  return encodeWinAnsi(value).bytes;
}

/** Hexdarstellung eines PDF-Strings (`<4142>`); spart das Maskieren von Klammern und Backslashes. */
export function toPdfHexString(value: string): string {
  let hex = '';
  for (const byte of toWinAnsiBytes(value)) hex += byte.toString(16).padStart(2, '0');
  return `<${hex}>`;
}
