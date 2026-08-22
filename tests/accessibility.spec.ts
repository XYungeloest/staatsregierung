import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const lawUrl = (path: string) => new URL(path, 'http://127.0.0.1:4322').toString();

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
  '/themen/volksbefragung-2026/',
  '/themen/bildung-und-schule/schulsystem/',
  '/themen/kommunen-regionen-und-berlin/',
  '/themen/demokratie-und-sicherheit/',
  '/themen/',
  '/kreisreform/',
  '/freistaat/bezirke/',
  '/freistaat/berlin/',
  '/suche/',
  lawUrl('/norm/ostdeutsches-kulturpassgesetz/'),
  lawUrl('/norm/erstes-gesetz-zur-grossen-staatsreform/'),
  lawUrl('/norm/staatsverfassung-des-freistaates-ostdeutschland/'),
  lawUrl('/norm/saechsische-gemeindeordnung/'),
  lawUrl('/norm/saechsische-gemeindeordnung/vergleich/?von=2023-11-01&bis=2026-08-01'),
  lawUrl('/norm/ostdeutsche-bezirksordnung/'),
  lawUrl('/norm/sero-verordnung/'),
  lawUrl('/norm/sero-verordnung/history/'),
  lawUrl('/suche/'),
  lawUrl('/gesetze/'),
  lawUrl('/verordnungen/'),
  lawUrl('/verwaltungsvorschriften/'),
  lawUrl('/archiv/'),
  lawUrl('/verkuendungen/'),
  lawUrl('/fundstellen/'),
  lawUrl('/rechtsentwicklung/'),
  lawUrl('/'),
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
