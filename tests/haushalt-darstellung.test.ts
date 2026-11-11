import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import postcss, { type AtRule, type Rule } from 'postcss';

/**
 * Darstellungsregeln des Haushaltsbereichs, die sich ohne Browser prüfen lassen: Wortumbruch in
 * Haushaltstabellen und die einmalige Ausgabe des Betragshinweises auf Projektseiten.
 */

const PORTAL = new URL('../apps/portal/src/', import.meta.url);
const lies = (pfad: string) => readFileSync(fileURLToPath(new URL(pfad, PORTAL)), 'utf8');

interface Deklaration {
  selector: string;
  media: string;
  prop: string;
  value: string;
}

function deklarationen(css: string): Deklaration[] {
  const out: Deklaration[] = [];
  postcss.parse(css).walkRules((rule: Rule) => {
    const media = rule.parent?.type === 'atrule' ? (rule.parent as AtRule).params : '';
    for (const selector of rule.selectors) {
      rule.walkDecls((decl) => {
        out.push({ selector: selector.replace(/\s+/gu, ' '), media, prop: decl.prop, value: decl.value });
      });
    }
  });
  return out;
}

const base = deklarationen(lies('styles/haushalt/base.css'));

function wert(selector: string, prop: string, media = ''): string | undefined {
  return base.filter((d) => d.selector === selector && d.prop === prop && d.media === media).at(-1)?.value;
}

test('Verweise und Zusatzzeilen in Haushaltstabellen brechen nur zwischen Wörtern oder nach Silben', () => {
  const ziele = [
    '.data-table.hh-datentabelle :is(th, td) :is(.inline-link, .hh-browser-link)',
    '.hh-tabelle .data-table :is(th, td) :is(.inline-link, .hh-browser-link)',
    '.data-table.hh-datentabelle td > span',
    '.hh-tabelle .data-table td > span',
  ];
  for (const selector of ziele) {
    // foundation.css und browser.css setzen für diese Elemente `overflow-wrap: anywhere`; das
    // drückt die Spalte auf wenige Zeichen und zerteilt Wörter ohne Trennstrich.
    assert.equal(wert(selector, 'overflow-wrap'), 'break-word', `${selector}: overflow-wrap`);
    assert.equal(wert(selector, 'hyphens', '(max-width: 63.99rem)'), 'auto', `${selector}: Silbentrennung auf Tablets`);
  }
});

test('Verweise in Tabellen des Doppelhaushalts 2025/2026 bleiben ganze Wörter oder trennen nach Silben', () => {
  const selector =
    ':is(.budget-plan-data-table, .budget-total-table, .budget-chapter-table, .budget-portal-table, .budget-task-area-table) :is(th, td) a';
  assert.equal(wert(selector, 'overflow-wrap'), 'break-word');
  assert.equal(wert(selector, 'hyphens'), 'auto');
});

test('Projektseite gibt den Betragshinweis genau einmal aus', () => {
  const seite = lies('pages/haushalt/[periode]/projekte/[slug].astro');
  const betraege = lies('components/haushalt/projekte/ProjektBetraege.astro');
  // Die Seite überlässt den Hinweis der Betragsangabe; eine zweite Ausgabe über der Titeltabelle
  // wiederholte denselben Text.
  assert.equal(seite.match(/projekt\.betragshinweis/gu)?.length ?? 0, 0, 'die Seite selbst gibt keinen Betragshinweis aus');
  assert.equal(seite.match(/<ProjektBetraege\b[^>]*hinweis="voll"/gu)?.length ?? 0, 1, 'ProjektBetraege mit vollem Hinweis genau einmal');
  assert.match(betraege, /hinweis === 'voll' && projekt\.betragshinweis/u);
});
