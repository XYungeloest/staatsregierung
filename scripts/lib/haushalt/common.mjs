import { createHash } from 'node:crypto';

/** Schema-Kennung jeder Snapshot-JSON-Datei. */
export const SNAPSHOT_SCHEMA = 'haushalt-snapshot/1';

/** Felder, deren Zahlenwerte Anteile sind und deshalb keine ganzen Euro sein müssen. */
export const SHARE_KEYS = new Set(['quote', 'funktionsvorbehalt_anteil']);

/** Fehler, deren Meldung unverändert und ohne Stacktrace ausgegeben wird. */
export class HaushaltError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'HaushaltError';
    this.details = details;
  }
}

/** Sammelt Prüfbefunde und bricht gesammelt ab. */
export class ProblemCollector {
  constructor() {
    this.problems = [];
  }

  add(message) {
    this.problems.push(message);
  }

  check(condition, message) {
    if (!condition) this.add(typeof message === 'function' ? message() : message);
    return Boolean(condition);
  }

  /** Vergleicht zwei Werte und benennt beide Herkünfte, wenn sie abweichen. */
  equal(left, leftLabel, right, rightLabel, subject) {
    if (left === right) return true;
    this.add(`${subject}: ${leftLabel} = ${formatValue(left)}, aber ${rightLabel} = ${formatValue(right)}`);
    return false;
  }

  get ok() {
    return this.problems.length === 0;
  }

  throwIfAny(heading) {
    if (this.problems.length > 0) {
      throw new HaushaltError(heading, this.problems);
    }
  }
}

export function formatValue(value) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value.toLocaleString('de-DE');
  }
  if (value === undefined) return '(fehlt)';
  return JSON.stringify(value);
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Deterministische JSON-Ausgabe: zwei Leerzeichen Einrückung, Schlüsselreihenfolge wie beim
 * Aufbau der Objekte, abschließender Zeilenumbruch. Bricht bei nicht endlichen Zahlen und
 * undefinierten Werten ab, damit keine still verlorenen Felder entstehen.
 */
export function serializeJson(value, label = 'JSON') {
  assertSerializable(value, label);
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assertSerializable(value, path) {
  if (value === undefined) throw new HaushaltError(`${path}: undefinierter Wert im Ausgabeobjekt`);
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new HaushaltError(`${path}: nicht endliche Zahl im Ausgabeobjekt`);
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSerializable(entry, `${path}[${index}]`));
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) assertSerializable(entry, `${path}.${key}`);
  }
}

/** Ganzzahliger Eurobetrag aus einem CSV-Feld. */
export function parseIntegerField(raw, label) {
  if (typeof raw !== 'string' || !/^-?\d+$/u.test(raw)) {
    throw new HaushaltError(`${label}: „${raw}“ ist keine ganze Zahl`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new HaushaltError(`${label}: ${raw} liegt außerhalb des sicheren Ganzzahlbereichs`);
  }
  return value;
}

/** Prüft einen JSON-Zahlenwert auf sichere Ganzzahligkeit. */
export function requireInteger(value, label) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new HaushaltError(`${label}: ${formatValue(value)} ist kein ganzzahliger Betrag`);
  }
  return value;
}

/** Dezimalzahl (Anteil) aus einem CSV-Feld. */
export function parseDecimalField(raw, label) {
  if (typeof raw !== 'string' || !/^-?\d+(?:\.\d+)?$/u.test(raw)) {
    throw new HaushaltError(`${label}: „${raw}“ ist keine Dezimalzahl`);
  }
  return Number(raw);
}

/** Python-Wahrheitswert aus einem CSV-Feld. */
export function parseBooleanField(raw, label) {
  if (raw === 'True') return true;
  if (raw === 'False') return false;
  throw new HaushaltError(`${label}: „${raw}“ ist kein Wahrheitswert (True/False)`);
}

/** Exakter Dezimaltext für Mengen- und Satzangaben (keine Gleitkommadarstellung). */
export function decimalText(value, label) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/u.test(value)) return value;
  throw new HaushaltError(`${label}: ${formatValue(value)} ist keine exakte Dezimalangabe`);
}

export function sumBy(items, selector) {
  let total = 0;
  for (const item of items) total += selector(item);
  return total;
}

export function compareCodes(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Tiefe Gleichheit für JSON-Werte (Schlüsselreihenfolge unerheblich). */
export function deepEqual(left, right) {
  if (left === right) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) return false;
    return left.every((entry, index) => deepEqual(entry, right[index]));
  }
  if (typeof left === 'object') {
    if (Array.isArray(right)) return false;
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]));
  }
  return false;
}

/** Hauptgruppenschlüssel 0–9 als Zeichenketten. */
export const HAUPTGRUPPEN = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const EINNAHME_HAUPTGRUPPEN = ['0', '1', '2', '3'];
export const AUSGABE_HAUPTGRUPPEN = ['4', '5', '6', '7', '8', '9'];

/**
 * Muster lokaler Pfade und Arbeitsumgebungen, die in keiner Ausgabe vorkommen dürfen. Die
 * Bezeichnungen enthalten selbst keine Pfadfragmente, damit Befundtexte prüfbar bleiben.
 * Das Windows-Muster erkennt auch die in JSON maskierte Form (`C:\\Users`).
 */
export const LOCAL_PATH_PATTERNS = [
  { label: 'macOS-Benutzerpfad', pattern: /\/Users\//u },
  { label: 'Linux-Benutzerpfad', pattern: /\/home\//u },
  { label: 'Windows-Laufwerkspfad', pattern: /\b[A-Za-z]:\\+[A-Za-z]/u, binaer: /\b[A-Za-z]:\\+(?:Users|Benutzer|Dokumente|Documents|Windows|Program|Temp|tmp)\b/iu },
  { label: 'Python-Arbeitsumgebung', pattern: /\.venv\b/u },
  { label: 'Datei-URL', pattern: /file:\/\//iu },
  { label: 'temporärer Systempfad', pattern: /\/private\/(?:var|tmp)\/|\/var\/folders\//u },
  { label: 'temporärer Pfad', pattern: /(?:^|[\s"'(=])\/tmp\//u },
];

/**
 * Liefert die Bezeichnungen aller gefundenen Pfadmuster in einem Text. Mit `binaer: true`
 * (unkodierte Bildbytes) gilt für kurze, zufällig entstehende Muster eine strengere Form.
 */
export function findLocalPathPatterns(text, options = {}) {
  const hits = [];
  for (const { label, pattern, binaer } of LOCAL_PATH_PATTERNS) {
    const effective = options.binaer && binaer ? binaer : pattern;
    if (effective.test(text)) hits.push(label);
  }
  return hits;
}

/** Alle Schlüssel und Zeichenkettenwerte eines JSON-Werts (rekursiv). */
export function collectStrings(value, result = []) {
  if (typeof value === 'string') result.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectStrings(entry, result));
  else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      result.push(key);
      collectStrings(entry, result);
    }
  }
  return result;
}
