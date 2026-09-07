import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSnippet, findTermRanges, normalizeSearchValue, normalizeWithIndex, toSearchTerms } from '../apps/portal/src/lib/search-ranking.ts';

/**
 * Markierungen der Portalsuche entstehen im normalisierten Text (Kleinschreibung, NFD, Diakritika
 * entfernt, `ß` → `ss`) und gelten im Originaltext. Weil `ß` → `ss` die Länge erhöht und eine
 * zerlegte Schreibweise sie senkt, sind das zwei verschiedene Koordinatensysteme: ohne
 * Rückabbildung wandert jede Markierung hinter einem `ß` um eine Stelle nach rechts.
 *
 * Die tragende Zusicherung steht in `markiert()`: der mit den zurückgegebenen Indizes geschnittene
 * Text ist immer genau der erwartete Originaltreffer – nicht ein um eine Stelle verschobener.
 */

/** Schneidet jede Markierung aus dem zurückgegebenen Ausschnitt. */
function markiert(text: string, query: string, limit?: number): string[] {
  const snippet = buildSnippet(text, toSearchTerms(query), limit);
  assert.ok(snippet, `kein Ausschnitt für „${query}“ in „${text}“`);
  for (const mark of snippet.marks) {
    assert.ok(mark.start >= 0 && mark.end <= snippet.text.length, `Bereich ${mark.start}–${mark.end} liegt außerhalb des Ausschnitts (Länge ${snippet.text.length})`);
    assert.ok(mark.end > mark.start, `leerer Bereich ${mark.start}–${mark.end}`);
  }
  return snippet.marks.map((mark) => snippet.text.slice(mark.start, mark.end));
}

test('die Rückabbildung liefert dieselbe Normalisierung wie die Normalisierung des ganzen Textes', () => {
  const proben = [
    'Die Straße wurde saniert.',
    'Große Staatsreform',
    'Ärger über alle',
    'Ärger über alle'.normalize('NFD'),
    'GROSSE STRAẞE saniert.',
    'Weiße Flotte, größere Schiffe – 𝔊roßes Vorhaben',
    '',
    'ß',
    'ẞ',
    'äb',
  ];
  for (const probe of proben) {
    const index = normalizeWithIndex(probe);
    assert.equal(index.value, normalizeSearchValue(probe), `Normalisierung von „${probe}“`);
    assert.equal(index.starts.length, index.value.length + 1, `starts-Länge für „${probe}“`);
    assert.equal(index.ends.length, index.value.length + 1, `ends-Länge für „${probe}“`);
    for (let i = 0; i < index.value.length; i += 1) {
      assert.ok(index.starts[i] <= index.ends[i], `Bereich ${i} in „${probe}“`);
      assert.ok(index.ends[i] <= probe.length, `Ende ${i} in „${probe}“`);
    }
  }
});

test('ein scharfes s vor der Fundstelle verschiebt die Markierung nicht', () => {
  assert.deepEqual(markiert('Die Straße wurde saniert.', 'saniert'), ['saniert']);
  assert.deepEqual(markiert('Die Straße und die Gasse maßen zusammen: saniert.', 'saniert'), ['saniert']);
});

test('ein scharfes s in der Fundstelle wird ganz markiert', () => {
  assert.deepEqual(markiert('Das Grundstück ist größer als gedacht', 'größer'), ['größer']);
  // Die Normalisierung schreibt „ß“ zu „ss“, aber „ö“ zu „o“; die Schreibweise „grosser“ trifft
  // deshalb, „groesser“ nicht (die Suche transliteriert Umlaute nicht).
  assert.deepEqual(markiert('Das Grundstück ist größer als gedacht', 'grosser'), ['größer']);
  // Eine Teilfundstelle im normalisierten Text deckt das ganze Originalzeichen ab: ein „ß“ lässt
  // sich nicht halb markieren.
  assert.deepEqual(markiert('Die Straße ist lang.', 'sse'), ['ße']);
});

test('Umlaute verschieben die Markierung weder zusammengesetzt noch zerlegt', () => {
  assert.deepEqual(markiert('Die Angabe der Behörde saniert.', 'Behörde'), ['Behörde']);
  assert.deepEqual(markiert('Die Größe der Behörde saniert.', 'Behörde'), ['Behörde']);
  const zerlegt = 'Ärger über alle'.normalize('NFD');
  assert.deepEqual(markiert(zerlegt, 'alle'), ['alle']);
  assert.deepEqual(markiert('Ärger über alle', 'alle'), ['alle']);
  // Der zerlegte Umlaut selbst bleibt vollständig: Basis und kombinierendes Zeichen zusammen.
  assert.deepEqual(markiert(zerlegt, 'arger'), ['Ärger'.normalize('NFD')]);
});

test('Groß- und Kleinschreibung ändert die Grenzen nicht', () => {
  assert.deepEqual(markiert('Die STRASSE wurde saniert.', 'Straße'), ['STRASSE']);
  assert.deepEqual(markiert('GROSSE STRAẞE saniert.', 'straße'), ['STRAẞE']);
  assert.deepEqual(markiert('Große Staatsreform', 'Große Staatsreform'), ['Große', 'Staatsreform']);
});

test('Zeichen außerhalb der Grundebene zerschneiden keine Markierung', () => {
  const text = 'Ein 𝔊esetz über die Straße: saniert.';
  assert.deepEqual(markiert(text, 'saniert'), ['saniert']);
  const ranges = findTermRanges(text, toSearchTerms('saniert'));
  assert.equal(ranges.length, 1);
  assert.equal(text.slice(ranges[0].start, ranges[0].end), 'saniert');
});

test('Markierungen bleiben innerhalb des Ausschnitts und der Ausschnitt innerhalb der Grenze', () => {
  const lang = `${'Vorspann mit Straße und Maßen. '.repeat(20)}Der gesuchte Wegmarkenbegriff steht hier.${' Nachspann.'.repeat(20)}`;
  const snippet = buildSnippet(lang, toSearchTerms('Wegmarkenbegriff'));
  assert.ok(snippet);
  assert.ok(snippet.text.length <= 240, `Ausschnittlänge ${snippet.text.length}`);
  assert.equal(snippet.marks.length, 1);
  assert.equal(snippet.text.slice(snippet.marks[0].start, snippet.marks[0].end), 'Wegmarkenbegriff');
});

test('vollständige Auszeichnung schneidet keine Überschrift an', () => {
  // `findTermRanges` bildet kein Fenster: Überschriften und Kurzbeschreibungen stehen ganz da.
  for (const [text, query] of [['Bundesbaugesetz', 'baugesetz'], ['Hinweise zur Nutzung des Staatsportals', 'Staatsportals']] as const) {
    const ranges = findTermRanges(text, toSearchTerms(query));
    assert.equal(ranges.length, 1, text);
    assert.equal(normalizeSearchValue(text.slice(ranges[0].start, ranges[0].end)), normalizeSearchValue(query), text);
  }
});

test('jede gelieferte Fundstelle enthält den gesuchten Begriff', () => {
  const proben: Array<[string, string]> = [
    ['Die Straße wurde saniert.', 'saniert'],
    ['Große Staatsreform der Bezirke', 'staatsreform'],
    ['Weiße Flotte und größere Schiffe', 'schiffe'],
    ['Ärger über alle'.normalize('NFD'), 'uber'],
    ['STRASSENVERKEHRSORDNUNG', 'straßenverkehrsordnung'],
  ];
  for (const [text, query] of proben) {
    for (const term of toSearchTerms(query)) {
      for (const range of findTermRanges(text, [term])) {
        assert.ok(normalizeSearchValue(text.slice(range.start, range.end)).includes(term), `„${text.slice(range.start, range.end)}“ enthält „${term}“ nicht`);
      }
    }
  }
});
