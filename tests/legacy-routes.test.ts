import assert from 'node:assert/strict';
import test from 'node:test';

import { readFileSync } from 'node:fs';

import { LEGACY_EINZELPLAENE_2025_2026, legacyRoutes } from '../apps/portal/src/config/legacy-routes.mjs';

test('belegte Altadressen sind eindeutig und führen nur auf interne Portalpfade', () => {
  const sources = legacyRoutes.map((route) => route.source);
  assert.equal(new Set(sources).size, sources.length);
  for (const route of legacyRoutes) {
    assert.ok(route.source.startsWith('/'));
    assert.ok(route.target.startsWith('/'));
    assert.equal(/[\s?#]/u.test(route.source), false);
    assert.equal(/[\s?#]/u.test(route.target), false);
    assert.notEqual(route.source, route.target);
  }
});

test('dynamische Altadressen tragen ihre Parameter unverändert ins Ziel', () => {
  for (const route of legacyRoutes) {
    const parameter = (path: string) => [...path.matchAll(/\[([a-z]+)\]/gu)].map((match) => match[1]).sort();
    assert.deepEqual(parameter(route.target), parameter(route.source), route.source);
  }
});

test('frühere Haushaltsadressen ohne Periode führen in die Periode 2025/2026', () => {
  const targets = new Map(legacyRoutes.map((route) => [route.source, route.target]));
  const periode = /^\/haushalt\/(\d{4}-\d{4})\//u;
  for (const [source, target] of targets) {
    if (!/^\/haushalt\/(gesamtplan|einzelplaene)\//u.test(source)) continue;
    assert.equal(periode.exec(target)?.[1], '2025-2026', source);
    assert.equal(target.replace(periode, '/haushalt/'), source, source);
  }
  for (const source of ['/haushalt/gesamtplan/', '/haushalt/einzelplaene/', ...LEGACY_EINZELPLAENE_2025_2026.map((plan) => `/haushalt/einzelplaene/${plan}/`)]) {
    assert.ok(targets.has(source), source);
  }
  // Der periodenübergreifende Einstieg und seine Unterseiten werden nicht umgeleitet.
  for (const source of ['/haushalt/', '/haushalt/sondervermoegen/', '/haushalt/daten.csv']) {
    assert.equal(targets.has(source), false, source);
  }
});

test('Haushalts-Altadressen sind statisch und enden mit Schrägstrich (beide Formen greifen im Asset-Worker)', () => {
  // Der Cloudflare-Asset-Worker übersetzt „:plan“ in [^/]+ mit Anker; eine dynamische Regel greift
  // deshalb nicht für die bisher kanonische Form „/haushalt/einzelplaene/04/“. Statische Quellen
  // mit Schrägstrich erzeugt Astro in beiden Formen.
  for (const route of legacyRoutes.filter((entry) => entry.source.startsWith('/haushalt/'))) {
    assert.equal(route.source.includes('['), false, route.source);
    assert.ok(route.source.endsWith('/'), route.source);
    assert.ok(route.target.endsWith('/'), route.target);
  }
});

test('die Einzelplannummern 2025/2026 der Weiterleitungen entsprechen dem Altbestand', () => {
  const csv = readFileSync(new URL('../context/Staatshaushalt 2025_2026 - Zusammenfassung.csv', import.meta.url), 'utf8');
  const nummern = csv
    .split(/\r?\n/u)
    .map((zeile) => zeile.split(',')[0]?.replace(/"/gu, '').trim() ?? '')
    .filter((zelle) => /^\d{1,2}$/u.test(zelle))
    .map((zelle) => String(Number(zelle)).padStart(2, '0'));
  assert.deepEqual([...new Set(nummern)].sort(), [...LEGACY_EINZELPLAENE_2025_2026].sort());
});
