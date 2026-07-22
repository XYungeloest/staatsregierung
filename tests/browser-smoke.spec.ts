import { expect, test } from '@playwright/test';

test('Startseite bietet Suche, Ministerien, mobile Navigation und 115-Orientierung', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('ostrecht-portal-analytics-consent', 'rejected');
  });
  await page.goto('/');

  await expect(page.locator('h1')).toHaveText('Schnell zur richtigen Information');
  await expect(page.locator('.home-ministry-list a')).toHaveCount(6);
  await expect(page.locator('.home-resource-card', { hasText: 'Recht schnell finden' })).toContainText('1 Eintrag');
  await expect(page.getByText(/Vorhaben des ersten Staatsrates/u)).toBeVisible();
  await expect(page.getByText('Staatssekretariate und Zuständigkeiten', { exact: true })).toBeVisible();
  await expect(page.locator('.service-band__item', { hasText: 'Behördennummer 115' })).toHaveAttribute(
    'href',
    '/service/kontakt/',
  );

  await page.locator('#home-portal-search').fill('Kreisreform');
  await Promise.all([
    page.waitForURL('**/suche/?q=Kreisreform'),
    page.locator('.home-hero-search button').click(),
  ]);
  await expect(page.locator('[data-portal-search-status]')).toContainText('Treffer');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const mobileMenu = page.locator('.mobile-nav');
  await mobileMenu.locator('summary').click();
  await expect(mobileMenu.locator('.mobile-nav__panel')).toBeVisible();
  await expect(mobileMenu.locator('#mobile-portal-search')).toBeVisible();
  await expect(mobileMenu.getByRole('link', { name: 'Leichte Sprache', exact: true })).toBeVisible();
  await expect(mobileMenu.getByRole('link', { name: 'Gebärdensprache', exact: true })).toBeVisible();
});

test('alle ausgelieferten Routentypen tragen dieselbe vollständige Buildkennung', async ({ page, request }) => {
  const routes = [
    '/',
    '/recht/',
    '/recht/verfassung/',
    '/recht/norm/erstes-gesetz-zur-grossen-staatsreform/',
    '/recht/norm/sero-verordnung/',
    '/recht/verkuendungen/ogvbl-2026-53/',
    '/recht/verkuendungen/ogvbl-2026-58/',
    '/sitemap.xml',
    '/search-index.json',
  ];
  let buildCommit = '';
  for (const route of routes) {
    const response = await request.get(route);
    expect(response.ok(), route).toBe(true);
    const routeCommit = response.headers()['x-portal-commit'];
    expect(routeCommit, route).toMatch(/^[0-9a-f]{40}$/u);
    buildCommit ||= routeCommit;
    expect(routeCommit, route).toBe(buildCommit);
  }

  await page.goto('/recht/verfassung/');
  await expect(page.locator('meta[name="build-commit"]')).toHaveAttribute('content', buildCommit);
});

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

test('Lokale Bereichsnavigation und Ministeriumsverzeichnis sind vollständig zugänglich', async ({ page }) => {
  await page.goto('/staatsregierung/kabinett/');

  const navigation = page.getByRole('navigation', { name: 'Staatsrat' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Staatsrat & Geschäftsbereiche' })).toHaveAttribute('aria-current', 'page');

  const directory = page.locator('[data-ministry-directory]');
  await expect(directory).toBeVisible();
  await expect(directory.locator('.ministry-directory__item')).toHaveCount(12);
  await expect(directory).toContainText('Max Peterson');
  await expect(directory.getByRole('link', { name: /Staatssekretariat für Wirtschaft/ }).first()).toBeVisible();
});

test('Regierungsprofil verbindet Porträt, Amt, Status und Kontakt im sichtbaren Kopf', async ({ page }) => {
  await page.goto('/staatsregierung/mitglieder/max-peterson/');

  const hero = page.locator('.section-hero--profile');
  await expect(hero).toBeVisible();
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Max Peterson');
  await expect(hero.locator('.section-hero__image')).toBeVisible();
  await expect(hero.locator('figure')).toHaveCount(1);
  await expect(hero.locator('figcaption')).toHaveText('Bildnachweis: Staatsregierung');
  await expect(hero.locator('img')).toHaveAttribute('alt', 'Porträt von Max Peterson');
  await expect(hero).toContainText('Aktuelles Mitglied des ersten Staatsrates');
  await expect(hero.getByRole('link', { name: /@/ })).toBeVisible();
});

test('Service gruppiert Kontakt, Orientierung, barrierearme Zugänge und Rechtliches', async ({ page }) => {
  await page.goto('/service/');

  await expect(page.getByRole('heading', { name: 'Kontakt und Behördennummer 115' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Orientierung und Angebote' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Barrierearme Zugänge' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rechtliche Hinweise' })).toBeVisible();
  await expect(page.locator('a[href^="tel:115"]')).toHaveCount(0);
  await expect(page.getByText(/115 ist montags bis freitags von 8 bis 18 Uhr/iu)).toHaveCount(0);
  await expect(page.getByText(/Informationen zur Behördennummer 115 und die Kontaktwege/iu)).toBeVisible();
});

test('Bildnachweise bleiben beim Hero-Bild und nicht hinter der Bereichsnavigation', async ({ page }) => {
  for (const path of [
    '/staatsregierung/mitglieder/max-peterson/',
    '/staatsregierung/kabinett/wirtschaft-arbeitsmarkt-und-beschaeftigung/',
  ]) {
    await page.goto(path);
    const hero = page.locator('.section-hero');
    await expect(hero.locator('figure .section-hero__credit')).toHaveText(/^Bildnachweis: (?:Staatsregierung|Staatsrat)$/u);
    await expect(page.locator('.section-navigation + p.media-credit')).toHaveCount(0);
    await expect(page.locator('main > p.media-credit')).toHaveCount(0);
  }
});

test('115 bleibt ein Informationsweg ohne behauptete Erreichbarkeit oder Direktwahl', async ({ page }) => {
  for (const path of ['/', '/service/']) {
    await page.goto(path);
    await expect(page.locator('a[href^="tel:115"]')).toHaveCount(0);
    await expect(page.getByText(/115 ist montags bis freitags von 8 bis 18 Uhr/iu)).toHaveCount(0);
  }

  const serviceEntry = page.locator('[data-visual-section="global-service-band"] .service-band__item', {
    hasText: 'Behördennummer 115',
  });
  await expect(serviceEntry).toHaveAttribute('href', '/service/kontakt/');
  await expect(serviceEntry).toContainText('Informationen und Kontaktwege');
});

test('Rechts- und Portalsuche liefern weiterhin Treffer', async ({ page }) => {
  await page.goto('/recht/suche/?q=Kulturpass');
  await expect(page.locator('[data-search-summary]')).toContainText('Treffer');
  await expect(page.locator('[data-search-results] .search-hit')).not.toHaveCount(0);

  await page.goto('/suche/?q=Kreisreform');
  await expect(page.locator('[data-portal-search-status]')).toContainText('Treffer');
});

test('Erster Staatsrat und historische Amtszeiten bleiben nachvollziehbar', async ({ page }) => {
  await page.goto('/staatsregierung/kabinett/');
  const members = page.locator('[data-visual-section="cabinet-members"]');
  await expect(members).toContainText('Volker Bagdadi');
  await expect(members).toContainText('Yannik Schmäle');
  await expect(members).not.toContainText('Thomas Henry Barlow');
  await expect(members).not.toContainText('Mia Wollrath');
  await expect(page.getByText('10', { exact: true }).first()).toBeVisible();

  await page.goto('/staatsregierung/mitglieder/yannik-schmaele/');
  const schmaeleHero = page.locator('.section-hero');
  await expect(schmaeleHero).toContainText('Staatsrat für Nachhaltigkeit und Energie');
  await expect(schmaeleHero).toContainText('Staatsrat für Staats- und Grenzsicherheit');

  await page.goto('/staatsregierung/mitglieder/thomas-henry-barlow/');
  await expect(page.locator('.section-hero')).toContainText('Historisches Regierungsprofil');
  await expect(page.locator('.section-hero')).toContainText('20. Juli 2026');

  await page.goto('/staatsregierung/mitglieder/mia-wollrath/');
  await expect(page.locator('.section-hero')).toContainText('Historisches Regierungsprofil');
  await expect(page.getByText(/bis zum 19\. Mai 2026/iu).first()).toBeVisible();
});

test('Rechtsstatus und Gesetzgebungssuche bilden den Stand 21. Juli 2026 ab', async ({ page }) => {
  await page.goto('/recht/norm/verordnung-der-staatsregierung-zur-bewaltigung-der-folgen-des-erdbebens-im-raum-rosenheim-und-zum-schutz-vor-n/');
  await expect(page.getByText(/außer Kraft seit/iu).first()).toBeVisible();

  await page.goto('/recht/norm/verwaltungsvorschrift-des-staatsministeriums-fur-volksbildung-und-wissenschaft-uber-lehrplane-und-stundentafel/');
  await expect(page.getByText(/ist verkündet und tritt am/iu).first()).toBeVisible();

  await page.goto('/suche/?q=07%2F17&type=legislation');
  await expect(page.locator('[data-portal-search-status]')).toContainText('Treffer');
  await expect(page.locator('.search-hit').first()).toContainText('Beschlossen und am 20. Juli 2026 verkündet');

  await page.goto('/recht/norm/staatsverfassung-des-freistaates-ostdeutschland/');
  await expect(page.getByText(/Siebte Volkskammer ist der siebte Landtag/u)).toBeVisible();
  await expect(page.getByText(/Artikel 75a/u).first()).toBeVisible();

  await page.goto('/recht/norm/erstes-gesetz-zur-grossen-staatsreform/');
  await expect(page.getByText(/Siebte Volkskammer ist der siebte Landtag/u)).toBeVisible();
  await expect(page.getByText(/Wahl zur achten Volkskammer/u)).toBeVisible();

  await page.goto('/recht/verfassung/');
  await expect(page.getByRole('heading', { name: 'Quellenstand zu Artikel 121a' })).toBeVisible();
  await expect(page.getByText(/Das am 20\. Juli 2026 verkündete Erste Gesetz/u)).toContainText('achten Volkskammer');
  await expect(page.getByText(/Das am 20\. Juli 2026 verkündete Erste Gesetz/u)).toContainText('siebte Volkskammer');
  await expect(page.locator('.record-list')).toContainText('Erstes Gesetz zur Großen Staatsreform');
  await expect(page.locator('.record-list')).toContainText('Viertes Gesetz zur Großen Staatsreform');

  await page.goto('/recht/norm/sero-verordnung/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sekundärrohstoff-Erfassung');
  await expect(page.getByText('SERO-Verordnung', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/in Kraft/u).first()).toBeVisible();
});

test('OGVBl. 2026 Nr. 53 trennt äußere Artikel und zitierte Neufassungen', async ({ page }) => {
  await page.goto('/recht/norm/erstes-gesetz-zur-grossen-staatsreform/');

  const outline = page.getByRole('navigation', { name: 'Inhaltsübersicht' });
  await expect(outline.getByRole('link', { name: /Artikel 1 Änderung der Staatsverfassung/u })).toBeVisible();
  await expect(outline.getByRole('link', { name: /Artikel 2 Inkrafttreten/u })).toBeVisible();
  await expect(outline.getByRole('link', { name: /Artikel 5/u })).toHaveCount(0);

  const firstItem = page.locator('.norm-amendment-list > .norm-amendment-item').first();
  await expect(firstItem.locator(':scope > .norm-amendment-item__label')).toHaveText('1.');
  const letterItems = firstItem.locator(':scope > .norm-amendment-item__content > .norm-amendment-item__children > ol > li');
  await expect(letterItems.locator(':scope > .norm-amendment-item__label')).toHaveText(['a.', 'b.', 'c.', 'd.', 'e.']);
  await expect(letterItems.filter({ has: page.getByText(/^Artikel 6 wird wie folgt geändert:/u) })).toHaveCount(1);
  await expect(letterItems.locator(':scope > .norm-amendment-item__label').filter({ hasText: /^a\.$/u })).toHaveCount(1);
  await expect(firstItem.locator('ol ol > li').first()).toContainText('i.');

  const quotedArticle = page.locator('blockquote.norm-quoted-provision').filter({
    has: page.getByText('Staatsvolk, Minderheiten', { exact: true }),
  });
  await expect(quotedArticle).toContainText('Staatsvolk, Minderheiten');
  await expect(quotedArticle.locator('.norm-subparagraph__label')).toHaveText(['(1)', '(2)', '(3)']);
  await expect(page.locator('details.norm-unit').filter({ hasText: /^Artikel 5/u })).toHaveCount(0);

  await page.setViewportSize({ width: 360, height: 800 });
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test('Normtabellen geben nur belastbare Kopfzellen-Scope-Werte aus', async ({ page }) => {
  await page.goto('/recht/norm/gesetz-zur-anderung-des-justizgesetzes-zur-anpassung-an-die-6uxqzh/');

  const headerCells = page.locator('.norm-table th');
  await expect(headerCells).toHaveCount(3);
  await expect(page.locator('.norm-table th[scope="col"]')).toHaveCount(3);
  await expect(page.locator('.norm-table th[scope="row"], .norm-table th[scope="colgroup"], .norm-table th[scope="rowgroup"]')).toHaveCount(0);
});

test('Wappen kennzeichnet die Wortmarke in Kopf und Fuß', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', '/favicon.svg');
  await expect(page.locator('.site-wordmark img')).toHaveAttribute('src', '/favicon.svg');
  await expect(page.locator('.site-footer__wordmark img')).toHaveAttribute('src', '/favicon.svg');
});

test('Kalender, Sitemap und strukturierte Termindaten enthalten den neuen Stand', async ({ page, request }) => {
  const calendar = await request.get('/presse/termine/kalender.ics');
  expect(calendar.ok()).toBe(true);
  const calendarText = await calendar.text();
  expect(calendarText).not.toContain('Dritte Plenarsitzung der 7. Wahlperiode');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain('/presse/termine/dritte-plenarsitzung-7-landtag/');
  expect(sitemapText).toContain('/themen/staatsreform-und-verfassung/');
  expect(sitemapText).toContain('/recht/norm/verwaltungsvorschrift-des-staatsministeriums-fur-volksbildung-und-wissenschaft-uber-lehrplane-und-stundentafel/');

  await page.goto('/presse/termine/dritte-plenarsitzung-7-landtag/');
  const structuredData = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
    scripts.map((script) => script.textContent ?? '').join('\n'),
  );
  expect(structuredData).toContain('EventCompleted');
  await expect(page.getByRole('heading', { name: 'Behandelte Gesetzesvorhaben' })).toBeVisible();
});
