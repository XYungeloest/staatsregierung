/**
 * RFC-4180-CSV-Parser für die Datentabellen des Haushaltsrepos.
 *
 * Unterstützt Felder in doppelten Anführungszeichen mit eingebetteten Kommas, Zeilenumbrüchen
 * und verdoppelten Anführungszeichen, CRLF- und LF-Zeilenenden sowie eine optionale UTF-8-BOM.
 * Fehlerhafte Quotierung führt zum Abbruch statt zu einer stillen Reparatur.
 */

export class CsvError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CsvError';
  }
}

/**
 * Zerlegt CSV-Text in Zeilen aus Zeichenketten.
 * @param {string} text
 * @param {string} [label] Bezeichnung der Quelle für Fehlermeldungen
 * @returns {string[][]}
 */
export function parseCsvRows(text, label = 'CSV') {
  let input = text;
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);

  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let fieldStarted = false;
  let afterClosingQuote = false;
  let line = 1;
  let index = 0;
  const length = input.length;

  const endField = () => {
    row.push(field);
    field = '';
    fieldStarted = false;
    afterClosingQuote = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < length) {
    const char = input[index];

    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        afterClosingQuote = true;
        index += 1;
        continue;
      }
      if (char === '\n') line += 1;
      field += char;
      index += 1;
      continue;
    }

    if (char === ',') {
      endField();
      index += 1;
      continue;
    }
    if (char === '\r' && input[index + 1] === '\n') {
      endRow();
      line += 1;
      index += 2;
      continue;
    }
    if (char === '\n') {
      endRow();
      line += 1;
      index += 1;
      continue;
    }
    if (char === '\r') {
      throw new CsvError(`${label}: einzelnes Wagenrücklaufzeichen in Zeile ${line}`);
    }
    if (afterClosingQuote) {
      throw new CsvError(`${label}: unerwartetes Zeichen nach schließendem Anführungszeichen in Zeile ${line}`);
    }
    if (char === '"') {
      if (fieldStarted) {
        throw new CsvError(`${label}: Anführungszeichen mitten in einem nicht quotierten Feld in Zeile ${line}`);
      }
      quoted = true;
      fieldStarted = true;
      index += 1;
      continue;
    }
    field += char;
    fieldStarted = true;
    index += 1;
  }

  if (quoted) {
    throw new CsvError(`${label}: nicht geschlossenes Anführungszeichen (beginnend vor Zeile ${line})`);
  }
  // Abschließender Zeilenumbruch erzeugt keine leere Zusatzzeile.
  if (fieldStarted || afterClosingQuote || row.length > 0 || field !== '') {
    endRow();
  }

  return rows;
}

/**
 * Liest CSV mit Kopfzeile als Liste von Objekten. Jede Datenzeile muss genau so viele Felder
 * wie die Kopfzeile haben; doppelte oder leere Spaltennamen sind unzulässig.
 * @param {string} text
 * @param {string} [label]
 * @returns {{ header: string[], records: Record<string, string>[] }}
 */
export function parseCsv(text, label = 'CSV') {
  const rows = parseCsvRows(text, label);
  if (rows.length === 0) {
    throw new CsvError(`${label}: Datei ist leer (Kopfzeile fehlt)`);
  }
  const [header, ...data] = rows;
  const seen = new Set();
  for (const name of header) {
    if (name === '') throw new CsvError(`${label}: leerer Spaltenname in der Kopfzeile`);
    if (seen.has(name)) throw new CsvError(`${label}: doppelter Spaltenname „${name}“`);
    seen.add(name);
  }
  const records = data.map((cells, position) => {
    if (cells.length !== header.length) {
      throw new CsvError(
        `${label}: Datenzeile ${position + 1} hat ${cells.length} statt ${header.length} Felder`,
      );
    }
    const record = {};
    header.forEach((name, column) => {
      record[name] = cells[column];
    });
    return record;
  });
  return { header, records };
}
