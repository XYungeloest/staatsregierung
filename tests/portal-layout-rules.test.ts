import assert from 'node:assert/strict';
import test from 'node:test';

import { PORTAL_SECTIONS, siteConfig } from '../packages/shared/src/config/site.ts';
import { portalPaths } from '../packages/shared/src/config/site-routing.ts';
import { DEFAULT_PORTAL_PAGE_SIZE, getPageState } from '../packages/shared/src/lib/portal/pagination.ts';
import { getBalancedColumnCount, isMetricValue } from '../packages/shared/src/lib/portal/presentation.ts';

/**
 * Dauerhafte Layout- und Benennungsregeln des Staatsportals als Logik geprüft: Spaltenzahl eines
 * Kartenrasters, Seitenrechnung der langen Datenansichten, Kennzahlenbegriff und die eine Quelle
 * für Bereichsname und Adresse. Die gerenderten Seiten prüft `tests/visual.spec.ts`.
 */

test('Kartenraster: keine Karte steht allein in der letzten Reihe', () => {
  for (let count = 1; count <= 24; count += 1) {
    const columns = getBalancedColumnCount(count);
    assert.ok(columns >= 1 && columns <= 4, `${count} Karten ergeben ${columns} Spalten`);
    // Für manche Mengen (13, 17, 21) ist eine volle letzte Reihe bei zwei bis vier Spalten nicht
    // erreichbar; dort darf auch die gewählte Spaltenzahl eine Karte übrig lassen.
    const achievable = [4, 3, 2].some((option) => count > option && count % option !== 1);
    if (!achievable) continue;
    assert.notEqual(count % columns, 1, `${count} Karten in ${columns} Spalten lassen eine einzelne Karte übrig`);
  }
});

test('Kartenraster: die bekannten Fälle der Startseite', () => {
  assert.equal(getBalancedColumnCount(7), 4, 'sieben Zugangskarten stehen als 4 + 3');
  assert.equal(getBalancedColumnCount(8), 4);
  assert.equal(getBalancedColumnCount(6), 3);
  assert.equal(getBalancedColumnCount(5), 3);
  assert.equal(getBalancedColumnCount(3), 3);
  assert.equal(getBalancedColumnCount(1), 1);
});

test('Blätterung: Seitenrechnung, Randbereiche und Wortlaut', () => {
  const first = getPageState(101, 1);
  assert.equal(first.pageCount, 5);
  assert.equal(first.rangeLabel, '1–25');
  assert.equal(first.pageLabel, 'Seite 1 von 5');
  assert.equal(first.hasPrevious, false);
  assert.equal(first.hasNext, true);

  const last = getPageState(101, 5);
  assert.deepEqual([last.start, last.end], [100, 101]);
  assert.equal(last.hasNext, false);

  assert.equal(getPageState(101, 99).page, 5, 'eine zu hohe Seite fällt auf die letzte zurück');
  assert.equal(getPageState(0, 1).rangeLabel, '0');
  assert.equal(getPageState(0, 1).pageCount, 1);
  assert.equal(DEFAULT_PORTAL_PAGE_SIZE, 25);
});

test('Kennzahlen: nur quantitative Werte gelten als Kennzahl', () => {
  for (const value of ['14', '101 Kreise', '25 Mrd. €', 'rund 3,2 Prozent', '−4 Punkte']) {
    assert.ok(isMetricValue(value), `„${value}“ ist eine Kennzahl`);
  }
  for (const value of [
    'Dresden',
    'Erster Staatsrat',
    '7. Volkskammer',
    '9 Träger + 2 Sondervermögen',
    'Abkommen in Kraft. Seit 14. Mai 2026 gilt es.',
    '',
  ]) {
    assert.equal(isMetricValue(value), false, `„${value}“ ist keine Kennzahl`);
  }
});

test('Bereiche: Name, Adresse und Navigation stammen aus einer Quelle', () => {
  const paths = new Set<string>();
  for (const section of PORTAL_SECTIONS) {
    assert.equal(section.path, portalPaths[section.pathKey], `Adresse von „${section.label}“`);
    assert.ok(section.label.trim().length > 0, 'Bereichsname');
    assert.ok(section.description.trim().length > 0, `Beschreibung von „${section.label}“`);
    assert.ok(!paths.has(section.path), `Adresse ${section.path} kommt doppelt vor`);
    paths.add(section.path);
  }

  const navigation = siteConfig.mainNavigation.map((entry) => entry.pathKey);
  const expected = PORTAL_SECTIONS.filter((section) => section.navigation).map((section) => section.pathKey);
  assert.deepEqual(navigation, expected, 'Hauptnavigation ist die Liste der Bereiche mit navigation: true');
});

test('Hauptnavigation führt nur Bereichseinstiege', () => {
  for (const entry of siteConfig.mainNavigation) {
    const path = portalPaths[entry.pathKey];
    const depth = path.split('/').filter(Boolean).length;
    assert.ok(depth <= 1, `„${entry.label}“ zeigt auf ${path} und ist damit keine Bereichsebene`);
  }
});
