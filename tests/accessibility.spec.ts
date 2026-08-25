import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const lawUrl = (path: string) => new URL(path, 'http://127.0.0.1:4322').toString();

const auditPages = [
  '/',
  '/staatsregierung/beteiligungen/',
  '/staatsregierung/kabinett/',
  '/staatsregierung/kabinett/wirtschaft-arbeitsmarkt-und-beschaeftigung/',
  '/staatsregierung/mitglieder/max-peterson/',
  '/haushalt/',
  '/themen/volksbefragung-2026/',
  '/kreisreform/',
  '/suche/',
  '/service/barrierefreiheit/',
  '/recht/',
  lawUrl('/'),
  lawUrl('/norm/saechsische-gemeindeordnung/'),
  lawUrl('/norm/saechsische-gemeindeordnung/vergleich/?von=2023-11-01&bis=2026-08-01'),
  lawUrl('/norm/sero-verordnung/history/'),
  lawUrl('/norm/saechsische-gemeindeordnung/version/2023-11-01/'),
  lawUrl('/suche/'),
  lawUrl('/sachgebiete/kommunal-und-verwaltungsrecht/'),
  lawUrl('/verkuendungen/stanzo-2026-33/'),
  lawUrl('/hilfe/'),
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
