import assert from 'node:assert/strict';
import test from 'node:test';

import { ContentValidationError } from '@ostrecht/shared/lib/norms/schema.ts';
import { parseKeywordRegister, registerKeywordKey, registerKeywordsBySlug } from '@ostrecht/shared/lib/norms/register.ts';

import { formatCount, formatInventoryCount, formatPublicationCount } from '../apps/recht/src/lib/counts.ts';

/**
 * Stichwortregister (content/stichwortregister.json) und die gemeinsame Bestandszahl. Geprüft
 * wird die Form an erfundenen Einträgen; dass die Slugs des tatsächlichen Registers vorhanden
 * sind, prüft das Content-Audit über den ganzen Bestand.
 */

const register = (eintraege: unknown[]): unknown => ({ $schema: 'stichwortregister/1', eintraege });

test('ein gültiges Register wird alphabetisch geliefert', () => {
  const parsed = parseKeywordRegister(register([
    { stichwort: 'Musterwesen', normen: ['muster-b', 'muster-a'] },
    { stichwort: 'Musterabgabe', normen: ['muster-a'], siehe: ['Musterwesen'] },
  ]));
  assert.deepEqual(parsed.entries.map((entry) => entry.stichwort), ['Musterabgabe', 'Musterwesen']);
  assert.deepEqual(parsed.entries[0].siehe, ['Musterwesen']);
  assert.deepEqual(parsed.entries[1].normen, ['muster-b', 'muster-a']);
});

test('Stichwörter je Vorschrift behalten die Reihenfolge des Registers', () => {
  const bySlug = registerKeywordsBySlug(parseKeywordRegister(register([
    { stichwort: 'Musterwesen', normen: ['muster-a', 'muster-b'] },
    { stichwort: 'Musterabgabe', normen: ['muster-a'] },
  ])));
  assert.deepEqual(bySlug.get('muster-a'), ['Musterabgabe', 'Musterwesen']);
  assert.deepEqual(bySlug.get('muster-b'), ['Musterwesen']);
  assert.equal(bySlug.get('muster-c'), undefined);
});

test('fehlerhafte Register werden abgelehnt', () => {
  const rejected: Array<[unknown, RegExp]> = [
    [{ eintraege: [] }, /\$schema/u],
    [register([{ stichwort: '', normen: ['muster-a'] }]), /stichwort/u],
    [register([{ stichwort: 'Muster', normen: [] }]), /mindestens eine Vorschrift/u],
    [register([{ stichwort: 'Muster', normen: ['Muster A'] }]), /kein Slug/u],
    [register([{ stichwort: 'Muster', normen: ['muster-a', 'muster-a'] }]), /doppelt/u],
    [register([{ stichwort: 'Muster', normen: ['muster-a'] }, { stichwort: 'muster', normen: ['muster-b'] }]), /doppelt vergeben/u],
    [register([{ stichwort: 'Muster', normen: ['muster-a'], siehe: ['Unbekannt'] }]), /unbekanntes Stichwort/u],
  ];
  for (const [value, pattern] of rejected) {
    assert.throws(() => parseKeywordRegister(value), (error: unknown) => error instanceof ContentValidationError && pattern.test((error as Error).message), String(pattern));
  }
});

test('Stichwörter werden groß- und kleinschreibungsunabhängig verglichen', () => {
  assert.equal(registerKeywordKey('  Muster   Wesen '), 'muster wesen');
  assert.equal(registerKeywordKey('MUSTER'), registerKeywordKey('muster'));
});

test('die Bestandszahl lautet überall gleich', () => {
  assert.equal(formatInventoryCount({ normCount: 1933, inForceCount: 1867 }), '1933 Vorschriften, davon 1867 geltend');
  assert.equal(formatInventoryCount({ normCount: 1, inForceCount: 1 }), '1 Vorschrift, davon 1 geltend');
  assert.equal(formatInventoryCount({ normCount: 0, inForceCount: 0 }), '0 Vorschriften, davon 0 geltend');
  assert.equal(formatCount(1, 'Ausgabe', 'Ausgaben'), '1 Ausgabe');
  assert.equal(formatCount(2, 'Ausgabe', 'Ausgaben'), '2 Ausgaben');
  assert.equal(formatPublicationCount(139), '139 Ausgaben');
});
