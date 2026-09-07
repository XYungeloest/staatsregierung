import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

import { normalizeSiteTargets } from '../scripts/lib/site-targets.mjs';

// Beteiligungsnavigator des Staatsportals: nur mit gebautem Portal (SITE_TARGETS), sonst übersprungen.
test.skip(!normalizeSiteTargets(process.env.SITE_TARGETS).includes('portal'), 'Beteiligungsnavigator gehört zum Staatsportal');

interface Position { key: string; name: string; origin: string; level: string; legalFormGroup: string }
interface Inventory { positions: Position[]; totals: { positionRows: number } }

const PAGE_SIZE = 25;

/** Erwartungswerte aus den ausgelieferten Daten, nicht aus festen Zahlen: der Navigator muss zu seinem Datensatz passen. */
async function loadInventory(request: APIRequestContext): Promise<Inventory> {
  const response = await request.get('/staatsregierung/beteiligungen/daten.json');
  expect(response.ok()).toBe(true);
  return await response.json() as Inventory;
}

function mostFrequent<T extends string>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'de'))[0][0];
}

async function openNavigator(page: Page, path = '/staatsregierung/beteiligungen/') {
  await page.goto(path);
  await expect(page.locator('[data-holdings-root]')).toHaveAttribute('data-holdings-ready', 'true');
}

test('Beteiligungsnavigator sucht, filtert, kombiniert und setzt zurück', async ({ page, request }) => {
  const { positions } = await loadInventory(request);
  const total = positions.length;
  const origin = mostFrequent(positions.map((position) => position.origin));
  const form = mostFrequent(positions.map((position) => position.legalFormGroup));
  const countText = (count: number) => `${count} von ${total} Positionen`;

  await openNavigator(page);
  const count = page.locator('[data-holdings-result-count]');
  await expect(count).toHaveText(countText(total));
  await expect(page.locator('[data-holdings-table-body] tr')).toHaveCount(Math.min(PAGE_SIZE, total));

  await page.locator('[data-holdings-search]').fill(positions[0].name);
  await expect(count).toHaveText(new RegExp(`^[1-9]\\d* von ${total} Positionen$`, 'u'));
  await expect(page).toHaveURL(/[?&]q=/u);

  await page.locator('[data-holdings-reset]').click();
  await page.locator('[data-holdings-filter="origin"]').selectOption(origin);
  await expect(count).toHaveText(countText(positions.filter((position) => position.origin === origin).length));
  await page.locator('[data-holdings-filter="level"]').selectOption('direct');
  await expect(count).toHaveText(countText(positions.filter((position) => position.origin === origin && position.level === 'direct').length));
  await expect(page).toHaveURL(new RegExp(`origin=${encodeURIComponent(origin)}`, 'u'));
  await expect(page).toHaveURL(/level=direct/u);

  await page.locator('[data-holdings-reset]').click();
  await page.locator('[data-holdings-filter="form"]').selectOption(form);
  await expect(count).toHaveText(countText(positions.filter((position) => position.legalFormGroup === form).length));
  await page.locator('[data-holdings-reset]').click();
  await expect(count).toHaveText(countText(total));
});

test('Sortierung, Paginierung, URL-Wiederherstellung und Konzernstruktur funktionieren', async ({ page, request }) => {
  const { positions } = await loadInventory(request);
  test.skip(positions.length <= PAGE_SIZE, 'Paginierung braucht mehr als eine Seite');
  await openNavigator(page);
  const firstName = page.locator('[data-holdings-table-body] tr').first().locator('td').first();
  const ascendingName = (await firstName.locator('strong').textContent()) ?? '';
  await page.locator('[data-holdings-sort-direction]').click();
  await expect(firstName.locator('strong')).not.toHaveText(ascendingName);

  await page.locator('[data-page-action="next"]').click();
  await expect(page.locator('[data-pagination-range]')).toHaveText(`${PAGE_SIZE + 1}–${Math.min(2 * PAGE_SIZE, positions.length)}`);
  await expect(page).toHaveURL(/page=2/u);
  await page.reload();
  await expect(page.locator('[data-holdings-root]')).toHaveAttribute('data-holdings-ready', 'true');
  await expect(page.locator('[data-pagination-range]')).toHaveText(`${PAGE_SIZE + 1}–${Math.min(2 * PAGE_SIZE, positions.length)}`);

  await page.locator('[data-holdings-view="tree"]').click();
  await expect(page.locator('[data-holdings-panel="tree"]')).toBeVisible();
  await expect(page.locator('.holdings-tree-origin')).toHaveCount(new Set(positions.map((position) => position.origin)).size);
  await expect(page).toHaveURL(/view=tree/u);
});

test('Direkteinstieg, mobile Karten und öffentliche Downloads sind nutzbar', async ({ page, request }) => {
  const { positions } = await loadInventory(request);
  await page.setViewportSize({ width: 390, height: 844 });
  await openNavigator(page);
  await expect(page.locator('.holdings-table-wrap')).toBeHidden();
  await expect(page.locator('[data-holdings-mobile-results] .holdings-result-card')).toHaveCount(Math.min(PAGE_SIZE, positions.length));
  await expect(page.locator('[data-holdings-filter-panel]')).not.toHaveAttribute('open', '');
  await page.locator('[data-holdings-filter-panel] > summary').click();
  await expect(page.locator('[data-holdings-filter="origin"]')).toBeVisible();

  const serialized = JSON.stringify(await loadInventory(request));
  expect(serialized).not.toContain('sourceLocator');
  expect(serialized).not.toContain('knowledge/');

  const csvResponse = await request.get('/staatsregierung/beteiligungen/daten.csv');
  expect(csvResponse.ok()).toBe(true);
  const csv = await csvResponse.text();
  expect(csv).toContain('Name;Herkunft;Ebene;Mutter;Beziehung');
  expect(csv.trim().split(/\r?\n/u)).toHaveLength(positions.length + 1);
  expect(csv).not.toContain('sourceLocator');
});
