import assert from 'node:assert/strict';
import test from 'node:test';

import { getNormHistoryUrl } from '@ostrecht/shared/lib/norms/routes.ts';

import { buildChangeFeed, CHANGE_FEED_PATH, type ChangeServiceColumn } from '../apps/recht/src/lib/change-service.ts';
import type { NormChange } from '../apps/recht/src/lib/runtime/store.ts';

/** Verlaufslinks folgen den Routen des Rechtsportals (relativ im Rechtsportal, sonst absolut) und werden gegen die Feed-Adresse aufgelöst. */
const BASE = new URL('https://recht.example.test/');
const historyLink = (slug: string): string => new URL(getNormHistoryUrl(slug), BASE).toString().replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&');

/**
 * RSS des Änderungsdiensts (E38): wohlgeformt, höchstens fünf Einträge je Spalte (15 gesamt),
 * Datum der Rechtswirkung nach RFC 822, stabile Kennung, Titel wie auf der Startseite.
 */
function change(overrides: Partial<NormChange> & Pick<NormChange, 'slug' | 'date' | 'changeType'>): NormChange {
  return {
    normTitle: `Gesetz über ${overrides.slug}`,
    normShortTitle: `Kurz ${overrides.slug}`,
    type: 'gesetz',
    title: 'Änderung durch das Testgesetz',
    citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 2)',
    ...overrides,
  };
}

function columns(count: number): ChangeServiceColumn[] {
  const many = (prefix: string, changeType: NormChange['changeType']) => Array.from({ length: count }, (_, index) => change({ slug: `${prefix}-${index}`, date: `2026-0${(index % 8) + 1}-1${index % 9}`, changeType }));
  return [
    { key: 'current', heading: 'Neu in Kraft getreten', tone: 'in-force', entries: many('neu', 'amendment'), empty: '' },
    { key: 'future', heading: 'Verkündet, noch nicht in Kraft', tone: 'future', entries: many('bald', 'initial'), empty: '' },
    { key: 'repealed', heading: 'Außer Kraft getreten', tone: 'repealed', entries: many('weg', 'repeal'), empty: '' },
  ];
}

/** Minimaler Wohlgeformtheitstest: Deklaration, ausgeglichene Elemente, keine nackten „&“ oder „<“. */
function assertWellFormed(xml: string): void {
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  const body = xml.slice(xml.indexOf('?>') + 2);
  assert.doesNotMatch(body, /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/u, 'unmaskiertes &');
  const stack: string[] = [];
  for (const match of body.matchAll(/<(\/?)([\w:]+)[^<>]*?(\/?)>/gu)) {
    const [, closing, name, selfClosing] = match;
    if (selfClosing) continue;
    if (closing) assert.equal(stack.pop(), name, `schließendes </${name}>`);
    else stack.push(name);
  }
  assert.deepEqual(stack, [], 'alle Elemente geschlossen');
  const text = body.replace(/<[^<>]*>/gu, '');
  assert.doesNotMatch(text, /[<>]/u, 'nackte spitze Klammern im Text');
}

test('der Feed ist wohlgeformt, nennt höchstens 15 Einträge und datiert nach RFC 822', () => {
  const xml = buildChangeFeed(columns(9), { baseUrl: BASE, referenceDate: '2026-09-08' });
  assertWellFormed(xml);
  const items = xml.match(/<item>/gu) ?? [];
  assert.equal(items.length, 15);
  for (const [, date] of xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/gu)) assert.match(date, /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/u);
  assert.match(xml, /<lastBuildDate>Tue, 08 Sep 2026 12:00:00 GMT<\/lastBuildDate>/u);
  assert.match(xml, new RegExp(`<atom:link href="https://recht\\.example\\.test${CHANGE_FEED_PATH}" rel="self"`, 'u'));
  assert.match(xml, /<title>OstRecht – Änderungsdienst<\/title>/u);
});

test('Einträge tragen Titel wie die Startseite, Kategorie, Verlaufslink und stabile Kennung', () => {
  const xml = buildChangeFeed([
    { key: 'current', heading: 'Neu in Kraft getreten', tone: 'in-force', entries: [change({ slug: 'testgesetz', date: '2026-03-25', changeType: 'amendment', normShortTitle: 'Ostdeutsches Testgesetz' })], empty: '' },
    { key: 'future', heading: 'Verkündet, noch nicht in Kraft', tone: 'future', entries: [change({ slug: 'kuenftiges-gesetz', date: '2099-01-01', changeType: 'initial', normShortTitle: 'Zukunftsgesetz', title: 'Verkündung.' })], empty: '' },
    { key: 'repealed', heading: 'Außer Kraft getreten', tone: 'repealed', entries: [change({ slug: 'alt-vo', date: '2026-03-25', changeType: 'repeal', normShortTitle: 'Alt & Neu', title: 'Aufhebung durch Artikel 2' })], empty: '' },
  ], { baseUrl: BASE, referenceDate: '2026-09-08' });
  assertWellFormed(xml);
  assert.match(xml, new RegExp(`<title>Ostdeutsches Testgesetz geändert</title><link>${historyLink('testgesetz')}</link><guid isPermaLink="false">testgesetz:2026-03-25:amendment</guid><category>Neu in Kraft getreten</category>`, 'u'));
  assert.match(xml, /<description>durch das Testgesetz · OGVBl\. 2026 Nr\. 70 S\. 2<\/description>/u);
  assert.match(xml, /<title>Zukunftsgesetz tritt in Kraft<\/title>/u);
  // Platzhaltertitel liefern keine Ursache: die Fundstelle steht allein.
  assert.match(xml, /<guid isPermaLink="false">kuenftiges-gesetz:2099-01-01:initial<\/guid><category>Verkündet, noch nicht in Kraft<\/category><pubDate>[^<]+<\/pubDate><description>OGVBl\. 2026 Nr\. 70 S\. 2<\/description>/u);
  assert.match(xml, /<title>Alt &amp; Neu aufgehoben<\/title>/u);
});
