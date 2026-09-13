import assert from 'node:assert/strict';
import test from 'node:test';

import { buildNormChangeMarks } from '@ostrecht/shared/lib/norms/change-marks.ts';
import { formatComparisonCount, renderNormDiffDocument } from '@ostrecht/shared/lib/norms/diff-render.ts';
import { buildVersionComparison, buildVersionDiffTree, type NormDiffBlock } from '@ostrecht/shared/lib/norms/diff.ts';
import type { NormBodyBlock } from '@ostrecht/shared/lib/norms/schema.ts';

/**
 * Dokumentweite Paarung (N11): Einheiten werden über ihr Gliederungszeichen in der ganzen
 * Vorschrift gepaart, Gliederungseinheiten nach Inhalt. Nachgebildet ist die Umgliederung der
 * Verfassungsnovelle: Fassung A mit I (Art. 1–4) und II (Art. 5–8), Fassung B mit I (Art. 1–2),
 * II (Art. 3–4, neu 4a) und III (Art. 5–8, Art. 6 geändert).
 */
const article = (label: string, text: string): NormBodyBlock => ({ type: 'article', label, title: `Titel ${label}`, children: [{ type: 'subparagraph', label: '(1)', text, children: [] }] });
const section = (label: string, title: string, children: NormBodyBlock[]): NormBodyBlock => ({ type: 'section', label, title, children });
const text = (label: string) => `Wortlaut zu ${label}.`;

function versionA(): NormBodyBlock[] {
  return [
    section('I. Abschnitt', 'Grundlagen', ['Artikel 1', 'Artikel 2', 'Artikel 3', 'Artikel 4'].map((label) => article(label, text(label)))),
    section('II. Abschnitt', 'Die Grundrechte', ['Artikel 5', 'Artikel 6', 'Artikel 7', 'Artikel 8'].map((label) => article(label, text(label)))),
  ];
}

function versionB(): NormBodyBlock[] {
  return [
    section('I. Abschnitt', 'Politische Grundlagen', ['Artikel 1', 'Artikel 2'].map((label) => article(label, text(label)))),
    section('II. Abschnitt', 'Soziale Grundlagen', [article('Artikel 3', text('Artikel 3')), article('Artikel 4', text('Artikel 4')), article('Artikel 4a', 'Neuer Wortlaut.')]),
    section('III. Abschnitt', 'Die Grundrechte', [article('Artikel 5', text('Artikel 5')), article('Artikel 6', 'Geänderter Wortlaut zu Artikel 6.'), article('Artikel 7', text('Artikel 7')), article('Artikel 8', text('Artikel 8'))]),
  ];
}

function unitsByKind(tree: NormDiffBlock[]): Record<string, string[]> {
  const result: Record<string, string[]> = { added: [], changed: [], removed: [], unchanged: [] };
  const visit = (blocks: NormDiffBlock[]) => {
    for (const block of blocks) {
      if (block.type === 'article') result[block.kind].push(block.label ?? '');
      else visit(block.children);
    }
  };
  visit(tree);
  return result;
}

test('die Umgliederung paart Artikel dokumentweit und Abschnitte nach Inhalt', () => {
  const tree = buildVersionDiffTree({ body: versionA() }, { body: versionB() });
  const units = unitsByKind(tree);
  assert.deepEqual(units.added, ['Artikel 4a']);
  assert.deepEqual(units.changed, ['Artikel 6']);
  assert.deepEqual(units.removed, []);
  assert.deepEqual(units.unchanged.sort(), ['Artikel 1', 'Artikel 2', 'Artikel 3', 'Artikel 4', 'Artikel 5', 'Artikel 7', 'Artikel 8']);
  // Alt II „Die Grundrechte“ ist neu III (Ordnungszahl geändert), alt I ist neu I (Titel geändert), neu II ist hinzugekommen.
  const sections = tree.filter((block) => block.type === 'section').map((block) => `${block.kind}:${block.before?.label ?? '–'}→${block.after?.label ?? '–'}`);
  assert.deepEqual(sections, ['changed:I. Abschnitt→I. Abschnitt', 'added:–→II. Abschnitt', 'changed:II. Abschnitt→III. Abschnitt']);
  // Gewanderte Einheiten wissen, woher sie kommen.
  const movedIn = tree[1].children.filter((block) => block.movedFrom).map((block) => `${block.label}:${block.movedFrom}`);
  assert.deepEqual(movedIn, ['Artikel 3:I. Abschnitt Grundlagen', 'Artikel 4:I. Abschnitt Grundlagen']);
});

test('Marken folgen der reparierten Paarung: nur 4a neu und 6 geändert', () => {
  const marks = buildNormChangeMarks({ body: versionA() }, { body: versionB() });
  assert.deepEqual([...marks.entries()], [
    ['artikel-4a', { kind: 'added', subparagraphs: [] }],
    ['artikel-6', { kind: 'changed', subparagraphs: ['(1)'] }],
  ]);
});

test('der Vergleich zeigt nur neue und geänderte Einheiten, Kastenköpfe für umbenannte Abschnitte und zählt die Umgliederung', () => {
  const comparison = buildVersionComparison({ body: versionA() }, { body: versionB() });
  const cards = comparison.provisions.map((entry) => `${entry.kind}:${entry.after?.label ?? entry.before?.label}${entry.headingOnly ? ':heading' : ''}${entry.movedFrom ? `:zuvor ${entry.movedFrom}` : ''}`);
  assert.deepEqual(cards, [
    'changed:I. Abschnitt:heading',
    'added:II. Abschnitt:heading',
    'added:Artikel 4a',
    'changed:III. Abschnitt:heading',
    'changed:Artikel 6',
  ]);
  // Neu gegliedert sind nur Einheiten, die in einen anderen (nicht gepaarten) Abschnitt gewandert
  // sind: Artikel 3 und 4; Artikel 5–8 blieben in ihrem – nur neu nummerierten – Abschnitt.
  assert.equal(comparison.movedUnits, 2);
  assert.equal(comparison.renamedDivisions, 3);
  const label = formatComparisonCount(comparison.provisions, 'article', { movedUnits: comparison.movedUnits });
  assert.equal(label, '1 geänderter Artikel · 1 neuer Artikel · 3 Gliederungseinheiten umbenannt · 2 Artikel neu gegliedert');
  const html = renderNormDiffDocument(comparison.provisions, '2026-07-21', '2026-09-12', 'article', { movedUnits: comparison.movedUnits });
  // Artikel 6 blieb in seinem – nur neu nummerierten – Abschnitt: kein Zusatz „zuvor …“.
  assert.match(html, /id="vergleich-artikel-6"[^>]*><span class="norm-diff__status"><span class="norm-diff__status-label">Artikel 6 Titel Artikel 6<\/span><span class="r-status/u);
  assert.equal((html.match(/norm-diff__provision--heading/gu) ?? []).length, 3);
  assert.doesNotMatch(html, /Wortlaut zu Artikel 1\.|Wortlaut zu Artikel 3\./u, 'unveränderte gewanderte Einheiten erscheinen nicht');
});

test('eine gewanderte Einheit mit anderem Wortlaut steht unter ihrem neuen Abschnitt mit dem Zusatz „zuvor …“', () => {
  const after = versionB();
  const article4 = after[1].children![1];
  article4.children![0].text = 'Geänderter Wortlaut zu Artikel 4.';
  const comparison = buildVersionComparison({ body: versionA() }, { body: after });
  const moved = comparison.provisions.find((entry) => entry.after?.label === 'Artikel 4');
  assert.equal(moved?.kind, 'changed');
  assert.equal(moved?.movedFrom, 'I. Abschnitt Grundlagen');
  const html = renderNormDiffDocument(comparison.provisions, '2026-07-21', '2026-09-12', 'article', { movedUnits: comparison.movedUnits });
  assert.match(html, /id="vergleich-artikel-4"[^>]*><span class="norm-diff__status"><span class="norm-diff__status-label">Artikel 4 Titel Artikel 4<\/span><span class="norm-diff__moved">zuvor I\. Abschnitt Grundlagen<\/span>/u);
  // Der Kasten steht in der Reihenfolge der neuen Fassung: im II. Abschnitt vor Artikel 4a.
  assert.ok(html.indexOf('id="vergleich-artikel-4"') < html.indexOf('id="vergleich-artikel-4a"'));
});

test('ohne Umgliederung bleibt die Geschwisterregel: doppelte Gliederungszeichen und Reihenfolge', () => {
  const before: NormBodyBlock[] = [section('I. Abschnitt', 'A', [article('§ 1', 'Eins.'), article('§ 1', 'Eins zweimal.')]), section('II. Abschnitt', 'B', [article('§ 2', 'Zwei.')])];
  const after: NormBodyBlock[] = [section('I. Abschnitt', 'A', [article('§ 1', 'Eins.'), article('§ 1', 'Eins zweimal, geändert.')]), section('II. Abschnitt', 'B', [article('§ 2', 'Zwei.')])];
  const comparison = buildVersionComparison({ body: before }, { body: after });
  assert.deepEqual(comparison.provisions.map((entry) => `${entry.kind}:${entry.after?.label}`), ['changed:§ 1']);
  assert.equal(comparison.movedUnits, 0);
  assert.equal(formatComparisonCount(comparison.provisions, 'paragraph'), '1 geänderter Paragraph');
  assert.equal(formatComparisonCount([], 'article'), '0 geänderte Artikel');
});
