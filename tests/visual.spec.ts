import { expect, test, type Locator, type Page } from '@playwright/test';

const lawUrl = (path: string) => new URL(path, 'http://127.0.0.1:4322').toString();

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
  { name: 'thema-volksbefragung', path: '/themen/volksbefragung-2026/' },
  { name: 'thema-kulturpass', path: '/themen/kulturpass/' },
  { name: 'kreisreform', path: '/kreisreform/' },
  { name: 'portalsuche', path: '/suche/' },
  { name: 'recht-bruecke', path: '/recht/' },
  { name: 'ostrecht', path: lawUrl('/') },
  { name: 'ostrecht-suche', path: lawUrl('/suche/?q=Kulturpass') },
  { name: 'ostrecht-gesetze', path: lawUrl('/gesetze/') },
  { name: 'ostrecht-verordnungen', path: lawUrl('/verordnungen/') },
  { name: 'ostrecht-verwaltungsvorschriften', path: lawUrl('/verwaltungsvorschriften/') },
  { name: 'ostrecht-archiv', path: lawUrl('/archiv/') },
  { name: 'ostrecht-sachgebiete', path: lawUrl('/sachgebiete/') },
  { name: 'ostrecht-verkuendungen', path: lawUrl('/verkuendungen/') },
  { name: 'ostrecht-fundstellen', path: lawUrl('/fundstellen/') },
  { name: 'ostrecht-rechtsentwicklung', path: lawUrl('/rechtsentwicklung/') },
  { name: 'ostrecht-verkuendung-detail', path: lawUrl('/verkuendungen/stanzo-2026-33/') },
  { name: 'ostrecht-sachgebiet-detail', path: lawUrl('/sachgebiete/kommunal-und-verwaltungsrecht/') },
  { name: 'ostrecht-hilfe', path: lawUrl('/hilfe/') },
  { name: 'norm-kulturpass', path: lawUrl('/norm/ostdeutsches-kulturpassgesetz/') },
  { name: 'norm-gemeindeordnung-historisch', path: lawUrl('/norm/saechsische-gemeindeordnung/version/2023-11-01/') },
  { name: 'norm-sero-historie', path: lawUrl('/norm/sero-verordnung/history/') },
  { name: 'norm-gemeindeordnung-vergleich', path: lawUrl('/norm/saechsische-gemeindeordnung/vergleich/?von=2023-11-01&bis=2026-08-01') },
  { name: 'norm-staatsverfassung', path: lawUrl('/norm/staatsverfassung-des-freistaates-ostdeutschland/') },
  { name: 'norm-sero-verordnung', path: lawUrl('/norm/sero-verordnung/') },
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
      if (image.getClientRects().length === 0) {
        return;
      }
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
  if (name === 'recht-footer.png') {
    await locator.evaluate((element) => {
      const footer = element as HTMLElement;
      footer.style.position = 'absolute';
      footer.style.inset = '0 0 auto';
      footer.style.width = '100%';
      footer.style.zIndex = '2147483647';
    });
  }
  await prepareLocator(locator);
  await expect(locator).toHaveScreenshot(name);
}

const componentVisualPages = [
  {
    name: 'startseite-aktuell-module',
    path: '/',
    shots: [['startseite-aktuelles-vorhaben', '[data-visual-section="home-current-topics"]']],
  },
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
    shots: [['themen-aktuell', '[data-visual-section="topics-current"] .topic-card:first-child']],
  },
  {
    name: 'themendetail-module',
    path: '/themen/volksbefragung-2026/',
    shots: [
      ['thema-briefing', '[data-visual-section="topic-briefing"]'],
      ['thema-fragen', '[data-topic-module="questions"]'],
      ['thema-ablauf', '[data-topic-module="timeline"]'],
      ['thema-rechtsgrundlagen', '[data-visual-section="topic-legal-bases"]'],
    ],
  },
  {
    name: 'recht-module',
    path: lawUrl('/'),
    shots: [
      ['recht-recherchewege', '[data-visual-section="law-research-paths"]'],
      ['recht-rechtsstaende', '[data-visual-section="law-latest-status"] > .law-dashboard-list > li:first-child'],
      ['recht-footer', '.law-footer'],
    ],
  },
  {
    name: 'rechtssuche-module',
    path: lawUrl('/suche/?q=Kulturpass'),
    shots: [
      ['rechtssuche-kopf', '.law-search-form > .search-form__primary'],
      ['rechtssuche-filter', '[data-search-filter-panel="more"]'],
    ],
  },
  {
    name: 'rechtsentwicklung-module',
    path: lawUrl('/rechtsentwicklung/'),
    shots: [
      ['rechtsentwicklung-kennzahlen', '.section-hero__facts'],
      ['rechtsentwicklung-filter', '[data-development-filter-form]'],
      ['rechtsentwicklung-uebernommen', '[data-development-item]:has(a[href="/norm/archivgesetz/"])'],
    ],
  },
  {
    name: 'fassungsvergleich-module',
    path: lawUrl('/norm/saechsische-gemeindeordnung/vergleich/?von=2023-11-01&bis=2026-08-01'),
    shots: [
      ['fassungsvergleich-auswahl', '[data-version-compare] .norm-compare__form'],
      ['fassungsvergleich-zusammenfassung', '.norm-diff__header'],
      ['fassungsvergleich-aenderung', '.norm-diff__provision--changed:first-of-type'],
    ],
  },
  {
    name: 'normhistorie-module',
    path: lawUrl('/norm/saechsische-gemeindeordnung/history/'),
    shots: [
      ['normhistorie-einstieg', '.norm-history-panel--versions'],
      ['normhistorie-fassung', '.norm-history__version-list > .norm-history__version:last-child'],
      ['normhistorie-aenderung', '.norm-history__event--amendment:first-child'],
      ['normhistorie-stammdaten', '.norm-history-panel--data'],
    ],
  },
  {
    name: 'norm-module',
    path: lawUrl('/norm/ostdeutsches-kulturpassgesetz/'),
    shots: [
      ['norm-rechtsstand', '[data-visual-section="norm-legal-status"]'],
      ['norm-zitieren-rechtsstand', '[data-visual-section="norm-citation-status"]'],
      ['norm-navigation', '.norm-version-navigation'],
      ['normtext-beginn', '[data-visual-section="norm-text"] .norm-unit:first-of-type'],
    ],
  },
  {
    name: 'norm-sidebar-module',
    path: lawUrl('/norm/erstes-gesetz-zur-grossen-staatsreform/'),
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
      ['haushalt-aufgabenbereiche', '[data-visual-section="budget-task-areas"]'],
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

test('Komponenten-Basislinie: mobile OstRecht-Navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'Die geöffnete mobile Navigation wird einmal bei 390 Pixeln geprüft.');
  await preparePage(page);
  await page.goto(lawUrl('/'));
  await page.locator('.law-mobile-nav > summary').click();
  await expectSectionScreenshot(page.locator('.law-mobile-nav__panel'), 'recht-mobile-navigation.png');
  await verifyViewport(page);
});

for (const entry of componentVisualPages) {
  test(`Komponenten-Basislinien: ${entry.name}`, async ({ page }) => {
    await preparePage(page);
    await page.goto(entry.path);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    if (entry.name === 'rechtssuche-module') {
      await page.locator('.law-search-filters-panel').evaluate((element) => {
        (element as HTMLDetailsElement).open = true;
      });
    }

    if (entry.name === 'norm-module' || entry.name === 'norm-sidebar-module') {
      await page.locator('.norm-info-panel').evaluate((element) => {
        (element as HTMLDetailsElement).open = true;
      });
    }

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
