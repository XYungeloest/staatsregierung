import assert from 'node:assert/strict';
import test from 'node:test';

import { formatAffectedUnits, formatUnitList, summarizeAffectedUnits } from '@ostrecht/shared/lib/norms/affected-units.ts';
import type { NormBodyBlock } from '@ostrecht/shared/lib/norms/schema.ts';

import { buildFixtureNorms } from './helpers/fixture-corpus.ts';

/**
 * Spalte „Betroffen“ (REVOSax): geänderte, neue und entfallene Einheiten je Fassung aus dem
 * dokumentweiten Vergleich, als Aufzählung mit Bereichen – mit dem Fixture-Testgesetz und
 * synthetischen Fällen.
 */
const article = (label: string, text: string): NormBodyBlock => ({ type: 'article', label, title: `Titel ${label}`, children: [{ type: 'subparagraph', label: '(1)', text, children: [] }] });

test('das Testgesetz des Fixtures: Protokollzeile 25.03.2026 → „§ 2 geändert · § 2a neu“', () => {
  const norm = buildFixtureNorms().find((entry) => entry.meta.slug === 'testgesetz')!;
  const [previous, shown] = [...norm.versions].sort((left, right) => left.validFrom.localeCompare(right.validFrom));
  const affected = summarizeAffectedUnits(previous, shown);
  assert.deepEqual(affected.changed.map((entry) => `${entry.anchor}|${entry.label}|${entry.subparagraphs.join(',')}`), ['paragraph-2|§ 2|(1)']);
  assert.deepEqual(affected.added.map((entry) => entry.label), ['§ 2a']);
  assert.deepEqual(affected.removed, []);
  assert.equal(formatAffectedUnits(affected), '§ 2 geändert · § 2a neu');
});

test('Gliederungszeichen werden je Präfix aufgezählt und zusammenhängende Folgen zu Bereichen', () => {
  const order = ['Artikel 1', 'Artikel 2', 'Artikel 3', 'Artikel 3a', 'Artikel 4', 'Artikel 6', 'Artikel 7', 'Artikel 7c', 'Artikel 7d', 'Artikel 7e', 'Artikel 8', 'Artikel 13a', 'Artikel 13b', 'Artikel 13c', 'Artikel 13d', 'Artikel 13e', 'Artikel 13f', 'Artikel 14', 'Artikel 76', 'Artikel 76a', 'Artikel 77', 'Artikel 77a'];
  assert.equal(formatUnitList(['Artikel 1', 'Artikel 3', 'Artikel 4', 'Artikel 6'], order), 'Art. 1, 3, 4, 6');
  assert.equal(formatUnitList(['Artikel 3a', 'Artikel 7c', 'Artikel 7d', 'Artikel 7e', 'Artikel 13a', 'Artikel 13b', 'Artikel 13c', 'Artikel 13d', 'Artikel 13e', 'Artikel 13f', 'Artikel 76a', 'Artikel 77a'], order), 'Art. 3a, 7c–7e, 13a–13f, 76a, 77a');
  // Zwei aufeinanderfolgende bleiben eine Aufzählung; erst drei bilden einen Bereich.
  assert.equal(formatUnitList(['Artikel 1', 'Artikel 2'], order), 'Art. 1, 2');
  assert.equal(formatUnitList(['§ 2'], ['§ 1', '§ 2']), '§ 2');
  assert.equal(formatUnitList(['§ 2', '§ 3', '§ 4', '§ 9'], ['§ 1', '§ 2', '§ 3', '§ 4', '§ 5', '§ 9']), '§§ 2–4, 9');
  assert.equal(formatUnitList(['Anlage 1', '§ 5'], ['§ 5', 'Anlage 1']), 'Anlage 1; § 5');
});

test('entfallene Einheiten stammen aus der Vorfassung, auch aus einer entfallenen Gliederungseinheit', () => {
  const before: NormBodyBlock[] = [{ type: 'section', label: 'I. Abschnitt', title: 'A', children: [article('Artikel 1', 'Eins.'), article('Artikel 2', 'Zwei.')] }, { type: 'section', label: 'II. Abschnitt', title: 'B', children: [article('Artikel 7', 'Sieben.'), article('Artikel 8', 'Acht.')] }];
  const after: NormBodyBlock[] = [{ type: 'section', label: 'I. Abschnitt', title: 'A', children: [article('Artikel 1', 'Eins neu.'), article('Artikel 2', 'Zwei.')] }];
  const affected = summarizeAffectedUnits({ body: before }, { body: after });
  assert.deepEqual(affected.changed.map((entry) => entry.label), ['Artikel 1']);
  assert.deepEqual(affected.removed.map((entry) => entry.label), ['Artikel 7', 'Artikel 8']);
  assert.equal(formatAffectedUnits(affected), 'Art. 1 geändert · Art. 7, 8 entfallen');
  assert.equal(formatAffectedUnits(summarizeAffectedUnits({ body: after }, { body: after })), '');
});

