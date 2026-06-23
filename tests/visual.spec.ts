import { expect, test, type Page } from '@playwright/test';

const visualPages = [
  { name: 'startseite', path: '/' },
  { name: 'haushalt', path: '/haushalt/' },
  { name: 'haushalt-gesamtplan', path: '/haushalt/gesamtplan/' },
  { name: 'haushalt-einzelplaene', path: '/haushalt/einzelplaene/' },
  { name: 'haushalt-einzelplan-03', path: '/haushalt/einzelplaene/03/' },
  { name: 'haushalt-sondervermoegen', path: '/haushalt/sondervermoegen/' },
  { name: 'themen', path: '/themen/' },
  { name: 'thema-kulturpass', path: '/themen/kulturpass/' },
  { name: 'kreisreform', path: '/kreisreform/' },
  { name: 'portalsuche', path: '/suche/' },
  { name: 'recht', path: '/recht/' },
  { name: 'norm-kulturpass', path: '/recht/norm/ostdeutsches-kulturpassgesetz/' },
  { name: 'presse', path: '/presse/' },
  { name: 'kontakt', path: '/service/kontakt/' },
  { name: 'barrierefreiheit', path: '/service/barrierefreiheit/' },
  { name: 'hinweis-gebaerdensprache', path: '/service/gebaerdensprache/' },
];

async function preparePage(page: Page, consent = 'rejected'): Promise<void> {
  if (consent) {
    await page.addInitScript((state) => {
      window.localStorage.setItem('ostrecht-portal-analytics-consent', state);
    }, consent);
  }
  await page.route('**://*.tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**://www.googletagmanager.com/**', (route) => route.abort());
}

async function verifyViewport(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

for (const entry of visualPages) {
  test(`visuelle Basislinie: ${entry.name}`, async ({ page }) => {
    await preparePage(page);
    await page.goto(entry.path);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await verifyViewport(page);
    await expect(page).toHaveScreenshot(`${entry.name}.png`);
  });
}

test('Kreisreform: Suche funktioniert ohne Kartenstart', async ({ page }) => {
  await preparePage(page);
  await page.goto('/kreisreform/');

  const input = page.locator('[data-kreisreform-search-input]');
  await expect(input).toBeVisible();
  await input.fill('Abtsbessingen');
  await expect(page.locator('[data-kreisreform-search-result]')).toHaveCount(1, { timeout: 15_000 });
  await page.locator('[data-kreisreform-search-result]').click();
  await expect(page.locator('[data-kreisreform-search-detail]')).toBeVisible();
});

test('Haushalt: Jahrwechsel und Einzelplanfilter sind eindeutig bedienbar', async ({ page }) => {
  await preparePage(page);
  await page.goto('/haushalt/');

  const dashboard = page.locator('[data-budget-year-switcher]');
  await expect(dashboard).toBeVisible();
  await dashboard.getByRole('button', { name: 'Vergleich', exact: true }).click();
  await expect(dashboard.locator('[data-budget-year-content="vergleich"]')).toBeVisible();
  await expect(dashboard.locator('[data-budget-year-status]')).toContainText('Vergleich');

  await page.goto('/haushalt/einzelplaene/');
  const plans = page.locator('[data-budget-year-switcher]');
  await plans.getByRole('button', { name: 'Vergleich', exact: true }).click();
  const table = plans.locator('[data-budget-year-content="vergleich"] [data-budget-plan-table]');
  await expect(table).toBeVisible();
  await table.locator('[data-budget-plan-filter="query"]').fill('Bildung');
  await expect(table.locator('[data-budget-plan-row]:visible')).toHaveCount(1);
  await expect(table.locator('[data-budget-plan-status]')).toContainText('1 von 20 Einzelplänen');

  await verifyViewport(page);
});

test('Kreisreform: Kartenansicht ist kontrolliert und lesbar', async ({ page }) => {
  await preparePage(page);
  await page.goto('/kreisreform/');

  const disclosure = page.locator('[data-map-disclosure]');
  await expect(disclosure).toHaveCount(1);
  const isOpen = await disclosure.evaluate((element) => (element as HTMLDetailsElement).open);
  if (!isOpen) {
    await page.locator('[data-map-disclosure] > summary').click();
  }

  await expect(page.locator('[data-map-status]')).toContainText(/Karte bereit|Karte konnte nicht geladen werden/, { timeout: 20_000 });
  await verifyViewport(page);
  await expect(disclosure).toHaveScreenshot('kreisreform-karte.png');
});

test('Consent-Hinweis ist lesbar und ablehnbar', async ({ page }) => {
  await preparePage(page, '');
  await page.goto('/');

  const banner = page.locator('#analytics-consent-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveScreenshot('consent.png');
  await banner.getByRole('button', { name: 'Nur notwendige Funktionen nutzen' }).click();
  await expect(banner).toBeHidden();
});
