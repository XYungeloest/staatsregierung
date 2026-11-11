import assert from 'node:assert/strict';
import test from 'node:test';

import { bindeKennungen, kuerzeBeschreibung } from '../apps/portal/src/components/haushalt/format.ts';

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

test('Anzeige bindet Paragrafen, Einheiten sowie Kapitel- und Titelnummern gegen Zeilenumbruch', () => {
  const nbsp = ' ';
  assert.equal(bindeKennungen('Gesamtdeckung (§ 8 LHO)'), `Gesamtdeckung (§${nbsp}8${nbsp}LHO)`);
  assert.equal(
    bindeKennungen('Entwurf des Haushaltsbegleitgesetzes 2027/2028, Artikel 4 § 1 (Finanzierung)'),
    `Entwurf des Haushaltsbegleitgesetzes 2027/2028, Artikel${nbsp}4 §${nbsp}1 (Finanzierung)`,
  );
  assert.equal(bindeKennungen('zusammen 550 Mio. EUR im Jahr 2027'), `zusammen 550${nbsp}Mio.${nbsp}EUR im Jahr 2027`);
  assert.equal(bindeKennungen('Titel 831 75 im Kapitel 07 10'), `Titel 831${nbsp}75 im Kapitel 07${nbsp}10`);
  assert.equal(bindeKennungen('75 % der Kosten'), `75${nbsp}% der Kosten`);
  // Beträge, Jahreszahlen und gewöhnliche Wörter bleiben unverändert.
  for (const text of ['1.707,66 Mio', '2027 und 2028', 'Hauptgruppe 4 und Gruppe 411', '2,15 Mio Nutzende']) {
    assert.equal(bindeKennungen(text), text);
  }
});
