import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const auditPages = [
  '/',
  '/staatsregierung/',
  '/staatsregierung/kabinett/',
  '/staatsregierung/kabinett/wirtschaft-arbeitsmarkt-und-beschaeftigung/',
  '/staatsregierung/kabinett/grenzschutz-faschismusbekaempfung-und-bewaffnete-organe/',
  '/staatsregierung/mitglieder/max-peterson/',
  '/staatsregierung/mitglieder/yannik-schmaele/',
  '/staatsregierung/mitglieder/thomas-henry-barlow/',
  '/haushalt/',
  '/haushalt/einzelplaene/',
  '/haushalt/einzelplaene/03/',
  '/haushalt/sondervermoegen/',
  '/themen/kulturpass/',
  '/themen/',
  '/kreisreform/',
  '/suche/',
  '/recht/norm/ostdeutsches-kulturpassgesetz/',
  '/recht/norm/erstes-gesetz-zur-grossen-staatsreform/',
  '/recht/norm/staatsverfassung-des-freistaates-ostdeutschland/',
  '/recht/norm/sero-verordnung/',
  '/recht/',
  '/service/',
  '/service/kontakt/',
  '/service/impressum/',
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
