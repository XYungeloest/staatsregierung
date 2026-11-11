import assert from 'node:assert/strict';
import test from 'node:test';

import { kuerzeBeschreibung } from '../apps/portal/src/components/haushalt/format.ts';

test('Seitenbeschreibung: kurz unverändert, sonst am Satzende oder am Wortende mit Auslassung', () => {
  assert.equal(kuerzeBeschreibung('Kurzer Text.'), 'Kurzer Text.');
  const satz = `${'Erster Satz mit Inhalt. '.repeat(8)}Ein langer letzter Satz ohne Ende ${'wort '.repeat(40)}`;
  const amSatzende = kuerzeBeschreibung(satz);
  assert.ok(amSatzende.length <= 300);
  assert.ok(amSatzende.endsWith('Inhalt.'), amSatzende);
  const ohneSatzende = kuerzeBeschreibung(`Anfang ${'Bezeichnung '.repeat(40)}`);
  assert.ok(ohneSatzende.length <= 300);
  assert.ok(ohneSatzende.endsWith('Bezeichnung…'), ohneSatzende);
});
