import { expect, test } from '@playwright/test';

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1366, height: 768 },
  { width: 1440, height: 1000 },
  { width: 1920, height: 1080 },
];

const overflowPages = [
  '/',
  '/kreisreform/',
  '/themen/kommunen-regionen-und-berlin/',
  '/themen/demokratie-und-sicherheit/',
  '/freistaat/bezirke/',
  '/freistaat/berlin/',
  '/suche/?q=Gesetz',
  '/recht/norm/gesetz-uber-den-anspruch-auf-bildungsfreistellung-im-freistaat-ostdeutschland/',
  '/recht/norm/verordnung-der-staatsregierung-des-freistaates-ostdeutschland-uber-den-larmschutz-bei-offentlichen-fernsehdarb/',
  '/staatsregierung/kabinett/wirtschaft-arbeitsmarkt-und-beschaeftigung/',
  '/staatsregierung/kabinett/grenzschutz-faschismusbekaempfung-und-bewaffnete-organe/',
  '/staatsregierung/mitglieder/max-peterson/',
  '/staatsregierung/mitglieder/yannik-schmaele/',
  '/staatsregierung/mitglieder/thomas-henry-barlow/',
  '/recht/norm/staatsverfassung-des-freistaates-ostdeutschland/',
  '/recht/norm/erstes-gesetz-zur-grossen-staatsreform/',
  '/recht/norm/saechsische-gemeindeordnung/',
  '/recht/norm/ostdeutsche-bezirksordnung/',
  '/recht/norm/sero-verordnung/',
  '/themen/energie-und-klima/',
  '/service/',
];

test('lange Norm- und Ressorttitel bleiben innerhalb ihres Bereichskopfes', async ({ page }) => {
  for (const path of [
    '/recht/norm/gesetz-uber-den-anspruch-auf-bildungsfreistellung-im-freistaat-ostdeutschland/',
    '/recht/norm/verordnung-der-staatsregierung-des-freistaates-ostdeutschland-uber-den-larmschutz-bei-offentlichen-fernsehdarb/',
    '/staatsregierung/kabinett/wirtschaft-arbeitsmarkt-und-beschaeftigung/',
    '/staatsregierung/kabinett/grenzschutz-faschismusbekaempfung-und-bewaffnete-organe/',
    '/recht/norm/staatsverfassung-des-freistaates-ostdeutschland/',
    '/recht/norm/sero-verordnung/',
  ]) {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(path);
    const hero = page.locator('.section-hero');
    const heading = hero.getByRole('heading', { level: 1 });
    const [heroBox, headingBox] = await Promise.all([hero.boundingBox(), heading.boundingBox()]);
    expect(heroBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect((headingBox?.x ?? 0) + (headingBox?.width ?? 0)).toBeLessThanOrEqual((heroBox?.x ?? 0) + (heroBox?.width ?? 0) + 1);
  }
});

test('kein Dokumentüberlauf in den geforderten Ansichten', async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const path of overflowPages) {
      await page.goto(path);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth, `${path} bei ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(dimensions.clientWidth);
    }
  }
});

test('externe Statistik und Kartenkacheln starten erst nach Freigabe', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('https://www.googletagmanager.com/**', (route) => route.abort());
  await page.route('https://*.google-analytics.com/**', (route) => route.abort());

  await page.goto('/kreisreform/');
  await page.waitForTimeout(300);
  expect(requests.some((url) => url.includes('tile.openstreetmap.org'))).toBe(false);
  expect(requests.some((url) => /googletagmanager|google-analytics/u.test(url))).toBe(false);

  await page.locator('[data-analytics-consent-reject]').click();
  await page.reload();
  expect(requests.some((url) => /googletagmanager|google-analytics/u.test(url))).toBe(false);
  await expect(page.locator('[data-map-load]')).toBeVisible();

  await page.locator('[data-map-load]').click();
  await expect(page.locator('[data-kreisreform-map]')).toBeVisible();
  await expect.poll(() => requests.some((url) => url.includes('tile.openstreetmap.org'))).toBe(true);
  await expect(page.locator('[data-layer-toggle="neueKreise"]')).toBeEnabled();
});

test('Statistikeinwilligung ist gleichwertig, widerrufbar und tastaturbedienbar', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.route('https://www.googletagmanager.com/**', (route) => route.abort());
  await page.goto('/');

  const reject = page.locator('[data-analytics-consent-reject]');
  const accept = page.locator('[data-analytics-consent-accept]');
  await expect(reject).toBeVisible();
  await expect(accept).toBeVisible();
  const [rejectBox, acceptBox] = await Promise.all([reject.boundingBox(), accept.boundingBox()]);
  expect(Math.abs((rejectBox?.height ?? 0) - (acceptBox?.height ?? 0))).toBeLessThan(1);
  expect(Math.abs((rejectBox?.width ?? 0) - (acceptBox?.width ?? 0))).toBeLessThan(1);

  await reject.focus();
  await page.keyboard.press('Tab');
  await expect(accept).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => requests.some((url) => url.includes('googletagmanager.com/gtag/js'))).toBe(true);

  await page.goto('/service/datenschutz/');
  await page.locator('main [data-analytics-consent-reset]').click();
  await expect(reject).toBeFocused();
  await page.keyboard.press('Enter');
  await page.reload();
  const stored = await page.evaluate(() => localStorage.getItem('ostrecht-portal-analytics-consent'));
  expect(stored).toBe('rejected');
});

test('SEO-Metadaten und strukturierte Simulationskennzeichnung sind konsistent', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://freistaat-ostdeutschland.de/images/social/portal-preview.png');
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');

  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const structuredData = blocks.map((block) => JSON.parse(block) as Record<string, unknown>);
  expect(structuredData.some((entry) => entry['@type'] === 'GovernmentOrganization')).toBe(false);
  expect(structuredData.some((entry) => entry['@type'] === 'Organization' && String(entry.description).toLocaleLowerCase('de').includes('fiktiv'))).toBe(true);

  await page.goto('/suche/?q=Gesetz');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain('<lastmod>');
  expect(sitemapText).not.toContain('/suche/');
});

test('200-Prozent-Zoom und reduzierte Bewegung bewahren die Kernfunktionen', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 640, height: 720 });
  await page.goto('/kreisreform/');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(page.locator('[data-map-load]')).toBeVisible();
  await expect(page.locator('#kreisreform-table-query')).toBeVisible();
});
