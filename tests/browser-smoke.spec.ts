import { expect, test } from '@playwright/test';

test('Kernnavigation, Suche und Kontaktwegweiser funktionieren', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await page.locator('.skip-link').focus();
  await expect(page.locator('.skip-link')).toBeFocused();

  await page.goto('/suche/?q=Gesetz&type=law');
  await expect(page.locator('[data-portal-search-status]')).toContainText('Treffer');
  await expect(page.locator('.search-hit mark').first()).toBeVisible();

  await page.goto('/service/kontakt/');
  const contactSelect = page.locator('#contact-router-topic');
  await contactSelect.focus();
  await contactSelect.selectOption('presse');
  await expect(page.locator('[data-contact-router-status]')).toContainText('Presseanfragen');
  await expect(page.locator('[data-route-key="presse"]')).toBeVisible();
  await expect(contactSelect).toBeFocused();
});

test('Kreisreform bleibt ohne Karte nutzbar', async ({ page }) => {
  await page.goto('/kreisreform/');
  await expect(page.locator('[data-map-load]')).toBeVisible();
  await expect(page.locator('[data-kreisreform-map]')).toBeHidden();
  await page.locator('#kreisreform-table-query').fill('Berlin');
  await expect(page.locator('[data-kreisreform-table-status]')).toContainText('sichtbar');
});
