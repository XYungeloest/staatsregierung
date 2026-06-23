import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const auditPages = [
  '/',
  '/haushalt/',
  '/haushalt/einzelplaene/',
  '/haushalt/einzelplaene/03/',
  '/haushalt/sondervermoegen/',
  '/themen/kulturpass/',
  '/kreisreform/',
  '/suche/',
  '/recht/norm/ostdeutsches-kulturpassgesetz/',
  '/service/kontakt/',
  '/service/barrierefreiheit/',
];

for (const path of auditPages) {
  test(`Accessibility-Smoke-Test: ${path}`, async ({ page }) => {
    await page.route('**://*.tile.openstreetmap.org/**', (route) => route.abort());
    await page.route('**://www.googletagmanager.com/**', (route) => route.abort());
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}
