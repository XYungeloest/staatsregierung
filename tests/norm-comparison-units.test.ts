import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProvisionVersionDiff } from '@ostrecht/shared/lib/norms/diff.ts';
import { renderNormDiffDocument } from '@ostrecht/shared/lib/norms/diff-render.ts';
import type { NormBodyBlock } from '@ostrecht/shared/lib/norms/schema.ts';

const text = (value: string): NormBodyBlock => ({ type: 'paragraphText', text: value });
const section = (children: NormBodyBlock[]): NormBodyBlock => ({ type: 'section', label: 'Präambel', children });
const diff = (before: NormBodyBlock[], after: NormBodyBlock[]) => buildProvisionVersionDiff({ body: before }, { body: after });
const render = (units: ReturnType<typeof diff>) => renderNormDiffDocument(units, '2024-01-01', '2026-01-01');

test('benannter Freitextcontainer bildet genau eine strukturierte Vergleichseinheit', () => {
  const before = ['Alte Verwaltungsvorstellungen.', 'Frühere örtliche Regeln.', 'Dieser Satz bleibt unverändert.', 'Bisherige Übergangslösung.'].map(text);
  const after = ['Gemeinsam gestalten wir die Zukunft.', 'Ein zusätzlicher neuer Grundsatz.', 'Dieser Satz bleibt unverändert.', 'Alle Menschen wirken gleichberechtigt mit.'].map(text);
  const units = diff([section(before)], [section(after)]);
  assert.equal(units.length, 1);
  assert.equal(units[0].kind, 'changed');
  assert.equal(units[0].after?.label, 'Präambel');
  const html = render(units);
  assert.equal((html.match(/class="norm-diff__provision /gu) ?? []).length, 1);
  assert.equal((html.match(/class="norm-text"/gu) ?? []).length, 8);
  for (const block of [...before, ...after].filter((b) => !b.text?.includes('unverändert'))) assert.ok(html.includes(block.text!));
  assert.equal((html.match(/Dieser Satz bleibt unverändert\./gu) ?? []).length, 2);
  assert.match(html, /<del>/u);
  assert.match(html, /<ins>/u);
});

test('Abschnitt mit Artikeln bleibt auch über Zwischenebenen artikelweise', () => {
  const article = (label: string, value: string): NormBodyBlock => ({ type: 'article', label, children: [text(value)] });
  const wrap = (value: string): NormBodyBlock[] => [{ type: 'section', title: 'Grundlagen', children: [{ type: 'subsection', title: 'Regeln', children: [article('Art. 1', 'Bestand.'), article('Art. 2', value), article('Art. 3', 'Bestand.')] }] }];
  const units = diff(wrap('Die alte Regel gilt.'), wrap('Die neue Regel gilt.'));
  assert.equal(units.length, 1);
  assert.equal(units[0].type, 'article');
  assert.equal(units[0].after?.label, 'Art. 2');
});

test('eine Präambel wird im Vergleichszähler nicht als Artikel gezählt', () => {
  const article: NormBodyBlock = { type: 'article', label: 'Art. 1', text: 'Alte Regel.' };
  const units = diff([section([text('Alte Grundlage.')]), article], [section([text('Neue Grundlage.')]), { ...article, text: 'Neue Regel.' }]);
  assert.match(renderNormDiffDocument(units, '2024-01-01', '2026-01-01', 'article'), /1 geänderter Artikel · 1 geänderte Textstelle/u);
});

for (const kind of ['removed', 'added'] as const) test(`ein vollständig ${kind === 'removed' ? 'gelöschter' : 'neuer'} Freitextcontainer bleibt ${kind}`, () => {
  const body = [section([text('Erster Satz.'), text('Zweiter Satz.')])];
  const units = kind === 'removed' ? diff(body, []) : diff([], body);
  assert.equal(units.length, 1);
  assert.equal(units[0].kind, kind);
  assert.equal(units[0].children.length, 2);
  const html = render(units);
  assert.equal((html.match(/class="norm-diff__side /gu) ?? []).length, 1);
});

test('ein eingeschobener Absatz verschiebt unveränderte Nachbarn nicht', () => {
  const a = text('Der erste stabile Absatz bleibt an seiner Stelle.');
  const b = text('Der zweite stabile Absatz bleibt ebenfalls bestehen.');
  const units = diff([a, b], [a, text('Eine zusätzliche vollständig neue Bestimmung.'), b]);
  assert.equal(units.length, 1);
  assert.equal(units[0].kind, 'added');
  assert.equal(units[0].after?.text, 'Eine zusätzliche vollständig neue Bestimmung.');
});

test('freie Ersatzläufe bewahren Strukturgrenzen und reine Löschungen', () => {
  const anchor: NormBodyBlock = { type: 'article', label: 'Art. 1', children: [text('Bestand.')] };
  const units = diff([text('Überholte Verwaltung.'), text('Frühere Regelung.'), anchor, text('Entbehrlich.')], [text('Gemeinsam in die Zukunft.'), anchor]);
  assert.equal(units.length, 2);
  assert.equal(units[0].kind, 'changed');
  assert.equal(units[0].children.filter((b) => b.before).length, 2);
  assert.equal(units[0].children.filter((b) => b.after).length, 1);
  assert.equal(units[1].kind, 'removed');
});

test('Freitextcontainer erhält verschachtelte Listen, Tabellen und eigenen Text', () => {
  const body = (value: string): NormBodyBlock[] => [{ type: 'section', title: 'Einleitung', text: 'Gemeinsamer Vorspruch.', children: [
    text('Regeln für das Verfahren.'),
    { type: 'item', label: '1.', text: 'Erste Stufe', children: [{ type: 'subitem', label: 'a)', text: value }] },
    { type: 'table', children: [{ type: 'tableRow', children: [{ type: 'tableHeaderCell', scope: 'col', text: 'Frist' }, { type: 'tableCell', text: value }] }] },
  ] }];
  const units = diff(body('Zwei Tage.'), body('Drei Tage.'));
  assert.equal(units.length, 1);
  const html = render(units);
  assert.equal((html.match(/<table /gu) ?? []).length, 2);
  assert.equal((html.match(/<ol class="norm-amendment-list/gu) ?? []).length, 4);
  assert.equal((html.match(/Gemeinsamer Vorspruch\./gu) ?? []).length, 2);
  assert.match(html, /scope="col"/u);
  assert.match(html, /<del>Zwei<\/del>/u);
  assert.match(html, /<ins>Drei<\/ins>/u);
});
