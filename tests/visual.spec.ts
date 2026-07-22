import { expect, test, type Locator, type Page } from '@playwright/test';

const visualPages = [
  { name: 'startseite', path: '/' },
  { name: 'staatsregierung', path: '/staatsregierung/' },
  { name: 'kabinett', path: '/staatsregierung/kabinett/' },
  { name: 'ressort-wirtschaft-arbeit', path: '/staatsregierung/kabinett/wirtschaft-arbeitsmarkt-und-beschaeftigung/' },
  { name: 'regierungsmitglied-max-peterson', path: '/staatsregierung/mitglieder/max-peterson/' },
  { name: 'staatsrat-yannik-schmaele', path: '/staatsregierung/mitglieder/yannik-schmaele/' },
  { name: 'regierungsarchiv-thomas-barlow', path: '/staatsregierung/mitglieder/thomas-henry-barlow/' },
  { name: 'staatssekretariat-grenzsicherheit', path: '/staatsregierung/kabinett/grenzschutz-faschismusbekaempfung-und-bewaffnete-organe/' },
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
  { name: 'norm-staatsverfassung', path: '/recht/norm/staatsverfassung-des-freistaates-ostdeutschland/' },
  { name: 'norm-sero-verordnung', path: '/recht/norm/sero-verordnung/' },
  { name: 'presse', path: '/presse/' },
  { name: 'kontakt', path: '/service/kontakt/' },
  { name: 'service', path: '/service/' },
  { name: 'impressum', path: '/service/impressum/' },
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

async function prepareLocator(locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  await locator.locator('img').evaluateAll(async (images) => {
    await Promise.all((images as HTMLImageElement[]).map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        });
      }
      await image.decode?.().catch(() => undefined);
    }));
  });
}

async function expectSectionScreenshot(locator: Locator, name: string): Promise<void> {
  await prepareLocator(locator);
  await expect(locator).toHaveScreenshot(name);
}

const componentVisualPages = [
  {
    name: 'staatsregierung-module',
    path: '/staatsregierung/',
    shots: [
      ['leitung-direkteinstiege', '[data-visual-section="government-leadership-entrypoints"]'],
      ['regierung-direkte-wege', '[data-visual-section="government-direct-entrypoints"]'],
      ['regierung-ministerium', '[data-visual-section="government-ministry-directory"] .ministry-directory__item:first-child'],
    ],
  },
  {
    name: 'kabinett-module',
    path: '/staatsregierung/kabinett/',
    shots: [
      ['kabinett-ressortverzeichnis', '[data-visual-section="cabinet-ministry-directory"] .ministry-directory__item:first-child'],
      ['kabinett-mitglied', '[data-visual-section="cabinet-members"] .member-card:first-child'],
    ],
  },
  {
    name: 'regierungsmitglied-module',
    path: '/staatsregierung/mitglieder/max-peterson/',
    shots: [
      ['mitglied-hero-bildnachweis', '.section-hero__media'],
      ['mitglied-biografie', '[data-visual-section="member-biography-profile"] > .section:first-child .body-copy'],
      ['mitglied-profil-kontakt', '[data-visual-section="member-biography-profile"] > .meta-panel'],
    ],
  },
  {
    name: 'ministerium-module',
    path: '/staatsregierung/kabinett/wirtschaft-arbeitsmarkt-und-beschaeftigung/',
    shots: [
      ['ministerium-hero-bildnachweis', '.section-hero__media'],
      ['ministerium-aufgaben', '[data-visual-section="ministry-profile-contact"] > .section:first-child'],
      ['ministerium-kontakt', '[data-visual-section="ministry-profile-contact"] > .meta-panel'],
      ['ministerium-thema', '[data-visual-section="ministry-topics"] .topic-card:first-child'],
    ],
  },
  {
    name: 'themen-module',
    path: '/themen/',
    shots: [['themen-weitere', '[data-visual-section="topics-additional"] .topic-card:first-child']],
  },
  {
    name: 'themendetail-module',
    path: '/themen/kulturpass/',
    shots: [
      ['thema-naechste-schritte', '[data-visual-section="topic-next-steps"]'],
      ['thema-rechtsgrundlagen', '[data-visual-section="topic-legal-bases"]'],
    ],
  },
  {
    name: 'recht-module',
    path: '/recht/',
    shots: [
      ['recht-recherchewege', '[data-visual-section="law-research-paths"]'],
      ['recht-rechtsstaende', '[data-visual-section="law-latest-status"] .record-list__item:first-child'],
    ],
  },
  {
    name: 'norm-module',
    path: '/recht/norm/ostdeutsches-kulturpassgesetz/',
    shots: [
      ['norm-rechtsstand', '[data-visual-section="norm-legal-status"]'],
      ['norm-navigation', '.section-navigation'],
      ['normtext-beginn', '[data-visual-section="norm-text"] .norm-unit:first-of-type'],
    ],
  },
  {
    name: 'norm-sidebar-module',
    path: '/recht/norm/erstes-gesetz-zur-grossen-staatsreform/',
    shots: [
      ['norm-vorschriftendaten', '[data-visual-section="norm-metadata"]'],
      ['norm-weiterfuehrende-bezuege', '[data-visual-section="norm-portal-relations"]'],
    ],
  },
  {
    name: 'haushalt-module',
    path: '/haushalt/',
    shots: [
      ['haushalt-jahreswahl-kennzahlen', '[data-visual-section="budget-year-kpis"]'],
      ['haushalt-tabelle', '[data-visual-section="budget-table"] .table-wrap'],
    ],
  },
  {
    name: 'presse-module',
    path: '/presse/',
    shots: [
      ['presse-weitere-meldungen', '[data-visual-section="press-additional-releases"]'],
      ['presse-kontakt', '[data-visual-section="press-contact"]'],
      ['presse-termine', '[data-visual-section="press-dates"] .meta-panel'],
    ],
  },
  {
    name: 'service-module',
    path: '/service/',
    shots: [
      ['service-barrierearme-zugaenge', '[data-visual-section="service-accessibility"]'],
      ['service-rechtliche-hinweise', '[data-visual-section="service-legal"]'],
      ['globales-serviceband', '[data-visual-section="global-service-band"]'],
      ['globaler-footer', '[data-visual-section="global-footer"]'],
    ],
  },
  {
    name: 'schulsystem-module',
    path: '/themen/bildung-und-schule/schulsystem/',
    shots: [['schulsystem-grafik', '[data-visual-section="school-system-chart"]']],
  },
] as const;

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

for (const entry of componentVisualPages) {
  test(`Komponenten-Basislinien: ${entry.name}`, async ({ page }) => {
    await preparePage(page);
    await page.goto(entry.path);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    for (const [name, selector] of entry.shots) {
      await expectSectionScreenshot(page.locator(selector), `${name}.png`);
    }
    await verifyViewport(page);
  });
}

test('Komponenten-Basislinien: Kreisreform-Suche, Kartensperre und Tabellenzugang', async ({ page }) => {
  await preparePage(page);
  await page.goto('/kreisreform/');
  await page.locator('[data-kreisreform-search-input]').fill('Abtsbessingen');
  const result = page.locator('[data-kreisreform-search-result]').first();
  await expect(result).toBeVisible();
  await result.click();

  await expectSectionScreenshot(page.locator('[data-kreisreform-search-detail]'), 'kreisreform-suchergebnis.png');
  await expectSectionScreenshot(page.locator('[data-map-load-surface]'), 'kreisreform-kartensperre.png');
  await expectSectionScreenshot(page.locator('[data-kreisreform-table-filter]'), 'kreisreform-tabellenzugang.png');
  await verifyViewport(page);
});

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

test('Portalsuche: Zustände schließen sich gegenseitig aus', async ({ page }) => {
  await preparePage(page);
  await page.goto('/suche/');

  const status = page.locator('[data-portal-search-status]');
  const input = page.locator('[data-portal-search-query]');
  const noResults = page.locator('[data-portal-search-empty]');
  const error = page.locator('[data-portal-search-error]');

  await expect(status).toContainText('Wonach suchen Sie?');
  await expect(noResults).toBeHidden();
  await expect(error).toBeHidden();

  await input.fill('Kreisreform');
  await expect(status).toContainText('Treffer für „Kreisreform“');
  await expect(page.locator('[data-portal-search-results] .search-hit')).not.toHaveCount(0);
  await expect(noResults).toBeHidden();
  await expect(error).toBeHidden();

  await input.fill('zzzznichtvorhanden');
  await expect(status).toContainText('Keine Treffer für');
  await expect(page.locator('[data-portal-search-results] .search-hit')).toHaveCount(0);
  await expect(noResults).toBeVisible();
  await expect(error).toBeHidden();
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

test('Haushalt: Kopfbereich hat einen verlässlichen Innenabstand', async ({ page }) => {
  await preparePage(page);
  await page.goto('/haushalt/');

  const header = page.locator('.section-hero--budget').first();
  const heading = header.getByRole('heading', { level: 1 });
  const [headerBox, headingBox] = await Promise.all([header.boundingBox(), heading.boundingBox()]);

  expect(headerBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect((headingBox?.x ?? 0) - (headerBox?.x ?? 0)).toBeGreaterThanOrEqual(24);
});

test('Kreisreform: Kartenansicht ist kontrolliert und lesbar', async ({ page }) => {
  await preparePage(page);
  await page.goto('/kreisreform/');

  const gate = page.locator('[data-map-gate]');
  await expect(gate).toHaveCount(1);
  await page.locator('[data-map-load]').click();

  await expect(page.locator('[data-map-status]')).toContainText(/Karte bereit|Karte konnte nicht geladen werden/, { timeout: 20_000 });
  await verifyViewport(page);
  await expect(gate).toHaveScreenshot('kreisreform-karte.png');
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
