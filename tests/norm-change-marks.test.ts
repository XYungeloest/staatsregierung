import assert from 'node:assert/strict';
import test from 'node:test';

import { buildNormChangeMarks } from '@ostrecht/shared/lib/norms/change-marks.ts';
import { renderNormDiffDocument } from '@ostrecht/shared/lib/norms/diff-render.ts';
import { buildProvisionVersionDiff } from '@ostrecht/shared/lib/norms/diff.ts';
import type { NormBodyBlock } from '@ostrecht/shared/lib/norms/schema.ts';

import { buildFixtureNorms } from './helpers/fixture-corpus.ts';

/**
 * Änderungen am Ort der Änderung (E36): Marken je Einheit und Absatz gegen die unmittelbare
 * Vorfassung, belegt durch den strukturellen Textvergleich. Das Testgesetz des Fixtures ändert in
 * der Fassung vom 25.03.2026 den § 2 (ein Absatz) und fügt § 2a ein; § 1 und § 3 bleiben.
 */
const text = (value: string): NormBodyBlock => ({ type: 'paragraphText', text: value });
const paragraph = (label: string, title: string, ...children: NormBodyBlock[]): NormBodyBlock => ({ type: 'paragraph', label, title, children });
const absatz = (label: string, value: string): NormBodyBlock => ({ type: 'subparagraph', label, text: value, children: [] });

test('das Testgesetz markiert § 2 als geändert und § 2a als neu, sonst nichts', () => {
  const norm = buildFixtureNorms().find((entry) => entry.meta.slug === 'testgesetz')!;
  const [previous, shown] = [...norm.versions].sort((left, right) => left.validFrom.localeCompare(right.validFrom));
  assert.equal(shown.validFrom, '2026-03-25');
  const marks = buildNormChangeMarks(previous, shown);
  assert.deepEqual([...marks.entries()], [
    ['paragraph-2', { kind: 'changed', subparagraphs: ['(1)'] }],
    ['paragraph-2a', { kind: 'added', subparagraphs: [] }],
  ]);
});

test('eine Ausgangsfassung ohne Vorfassung und eine unveränderte Fassung tragen keine Marken', () => {
  const body = [paragraph('§ 1', 'Geltung', absatz('(1)', 'Dieses Gesetz gilt.'), absatz('(2)', 'Für alle.'))];
  assert.equal(buildNormChangeMarks({ body }, { body }).size, 0);
});

test('Marken folgen den Ankern der angezeigten Fassung auch in Gliederungsabschnitten und nennen nur geänderte Absätze', () => {
  const before: NormBodyBlock[] = [{
    type: 'section', label: '1. Abschnitt', title: 'Allgemeines', children: [
      paragraph('§ 1', 'Zweck', absatz('(1)', 'Alter Zweck.'), absatz('(2)', 'Bleibt.')),
      paragraph('§ 2', 'Entfällt', absatz('(1)', 'Wird gestrichen.')),
      { type: 'article', label: 'Artikel 3', title: 'Bleibt', children: [text('Unverändert.')] },
    ],
  }];
  const after: NormBodyBlock[] = [{
    type: 'section', label: '1. Abschnitt', title: 'Allgemeines', children: [
      paragraph('§ 1', 'Zweck', absatz('(1)', 'Neuer Zweck.'), absatz('(2)', 'Bleibt.'), absatz('(3)', 'Kommt hinzu.')),
      { type: 'article', label: 'Artikel 3', title: 'Bleibt', children: [text('Unverändert.')] },
      paragraph('§ 4', 'Neu', absatz('(1)', 'Eingefügt.')),
    ],
  }];
  const marks = buildNormChangeMarks({ body: before }, { body: after });
  assert.deepEqual([...marks.entries()], [
    ['paragraph-1', { kind: 'changed', subparagraphs: ['(1)', '(3)'] }],
    ['paragraph-4', { kind: 'added', subparagraphs: [] }],
  ]);
  // Der Abschnitt selbst trägt keine Marke; entfallene Einheiten haben keinen Ort.
  assert.equal(marks.has('abschnitt-1-abschnitt'), false);
  assert.equal(marks.has('paragraph-2'), false);
});

test('der Fassungsvergleich gibt jeder Einheit einen Anker, auf den die Marke verweist', () => {
  const before = [paragraph('§ 2', 'Feiertage', absatz('(1)', 'Die Gemeinden begehen die gesetzlichen Feiertage.'))];
  const after = [paragraph('§ 2', 'Feiertage', absatz('(1)', 'Die Gemeinden begehen die gesetzlichen Feiertage und den Tag der Verfassung.')), paragraph('§ 2a', 'Gedenktage', absatz('(1)', 'Gedenktage werden bestimmt.'))];
  const html = renderNormDiffDocument(buildProvisionVersionDiff({ body: before }, { body: after }), '2023-11-01', '2026-03-25', 'paragraph');
  assert.match(html, /<li class="norm-diff__provision norm-diff__provision--changed" id="vergleich-paragraph-2">/u);
  assert.match(html, /<li class="norm-diff__provision norm-diff__provision--added" id="vergleich-paragraph-2a">/u);
  const ids = [...html.matchAll(/ id="([^"]+)"/gu)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Anker sind eindeutig');
});
