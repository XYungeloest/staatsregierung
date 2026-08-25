import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openNavigator(page: Page, path = '/staatsregierung/beteiligungen/') {
  await page.goto(path);
  await expect(page.locator('[data-holdings-root]')).toHaveAttribute('data-holdings-ready', 'true');
}

test('Beteiligungsnavigator sucht, filtert, kombiniert und setzt zurück', async ({ page }) => {
  await openNavigator(page);
  const count = page.locator('[data-holdings-result-count]');
  await expect(count).toHaveText('666 von 666 Positionen');
  await expect(page.locator('[data-holdings-table-body] tr')).toHaveCount(25);

  await page.locator('[data-holdings-search]').fill('Vivantes');
  await expect(count).toHaveText(/^[1-9]\d* von 666 Positionen$/u);
  await expect(page).toHaveURL(/q=Vivantes/u);

  await page.locator('[data-holdings-search]').fill('Flughafen');
  await expect(count).toHaveText(/^[1-9]\d* von 666 Positionen$/u);

  await page.locator('[data-holdings-reset]').click();
  await page.locator('[data-holdings-filter="origin"]').selectOption('Berlin');
  await expect(count).toHaveText('312 von 666 Positionen');
  await page.locator('[data-holdings-filter="level"]').selectOption('direct');
  await expect(count).toHaveText('63 von 666 Positionen');
  await expect(page).toHaveURL(/origin=Berlin/u);
  await expect(page).toHaveURL(/level=direct/u);

  await page.locator('[data-holdings-reset]').click();
  await page.locator('[data-holdings-filter="origin"]').selectOption('Sachsen');
  await expect(count).toHaveText('88 von 666 Positionen');
  await page.locator('[data-holdings-reset]').click();
  await page.locator('[data-holdings-filter="form"]').selectOption('AöR');
  await expect(count).toHaveText('46 von 666 Positionen');
  await page.locator('[data-holdings-reset]').click();
  await expect(count).toHaveText('666 von 666 Positionen');
});

test('Sortierung, Paginierung, URL-Wiederherstellung und Konzernstruktur funktionieren', async ({ page }) => {
  await openNavigator(page);
  const firstName = page.locator('[data-holdings-table-body] tr').first().locator('td').first();
  const ascendingName = (await firstName.locator('strong').textContent()) ?? '';
  await page.locator('[data-holdings-sort-direction]').click();
  await expect(firstName.locator('strong')).not.toHaveText(ascendingName);

  await page.locator('[data-page-action="next"]').click();
  await expect(page.locator('[data-holdings-range]')).toHaveText('26–50');
  await expect(page).toHaveURL(/page=2/u);
  await page.reload();
  await expect(page.locator('[data-holdings-root]')).toHaveAttribute('data-holdings-ready', 'true');
  await expect(page.locator('[data-holdings-range]')).toHaveText('26–50');

  await page.locator('[data-holdings-view="tree"]').click();
  await expect(page.locator('[data-holdings-panel="tree"]')).toBeVisible();
  await expect(page.locator('.holdings-tree-origin')).toHaveCount(7);
  await expect(page).toHaveURL(/view=tree/u);
});

test('Direkteinstieg, mobile Karten und öffentliche Downloads sind nutzbar', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openNavigator(page);
  await expect(page.locator('.holdings-table-wrap')).toBeHidden();
  await expect(page.locator('[data-holdings-mobile-results] .holdings-result-card')).toHaveCount(25);
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(page.locator('[data-holdings-filter-panel]')).not.toHaveAttribute('open', '');
  await page.locator('[data-holdings-filter-panel] > summary').click();
  await expect(page.locator('[data-holdings-filter="origin"]')).toBeVisible();

  const jsonResponse = await request.get('/staatsregierung/beteiligungen/daten.json');
  expect(jsonResponse.ok()).toBe(true);
  const json = await jsonResponse.json();
  expect(json.positions).toHaveLength(666);
  expect(JSON.stringify(json)).not.toContain('sourceLocator');
  expect(JSON.stringify(json)).not.toContain('knowledge/');

  const csvResponse = await request.get('/staatsregierung/beteiligungen/daten.csv');
  expect(csvResponse.ok()).toBe(true);
  const csv = await csvResponse.text();
  expect(csv).toContain('Name;Herkunft;Ebene;Mutter;Beziehung');
  expect(csv.trim().split(/\r?\n/u)).toHaveLength(667);
  expect(csv).not.toContain('sourceLocator');
});
