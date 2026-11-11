import assert from 'node:assert/strict';
import test from 'node:test';

import { technischeAnfrage } from '../apps/portal/src/scripts/haushalt-suche.ts';

// Erkennung technischer Anfragen der Haushaltssuche; ohne Bestand und ohne DOM.

test('Haushaltssuche: Einzelplan-, Kapitel- und Titelnummern in amtlicher und kurzer Schreibweise', () => {
  assert.deepEqual(technischeAnfrage('Einzelplan 4'), { art: 'einzelplan', wert: '04' });
  assert.deepEqual(technischeAnfrage('04'), { art: 'einzelplan', wert: '04' });
  assert.deepEqual(technischeAnfrage('0407'), { art: 'kapitel', wert: '0407' });
  assert.deepEqual(technischeAnfrage('04 07'), { art: 'kapitel', wert: '0407' });
  assert.deepEqual(technischeAnfrage('633 61'), { art: 'titel', wert: '63361' });
  assert.deepEqual(technischeAnfrage('0407/63361'), { art: 'kapiteltitel', wert: '63361', kapitel: '0407' });
  assert.equal(technischeAnfrage('4'), null);
  assert.equal(technischeAnfrage('Schulessen'), null);
});
