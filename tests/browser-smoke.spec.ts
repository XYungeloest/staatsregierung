import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { legacyRoutes } from '../apps/portal/src/config/legacy-routes.mjs';
import { normalizeSiteTargets } from '../scripts/lib/site-targets.mjs';
import {
  currentDocuments,
  currentNormOfOrigin,
  editorialReferenceDate,
  fixtureSlugsWithRole,
  formatGermanDate,
  lawUrl,
  multiVersionNorm,
  publicationIndex,
  searchApi,
  searchWordOf,
  suggestions,
  withWorkerRecovery,
  type ApiDocument,
  type Suggestion,
} from './helpers/law-runtime.ts';

/**
 * Nutzerwege beider Websites gegen den gebauten Worker. Die Tests prüfen Verhalten (Suche,
 * Filter, Navigation, Fassungen, Fehlerseiten), nicht Inhalte: OstRecht-Erwartungen werden aus
 * Kandidaten-API, Vorschlägen und Verkündungsindex abgeleitet (tests/helpers/law-runtime.ts) und
 * gelten unverändert für Testfixture und Vollbestand. Erscheinungsbild prüft tests/visual.spec.ts,
 * Barrierefreiheit tests/accessibility.spec.ts.
 */
/**
 * Suchwort und Vorschlag einer Vorschrift mit geltender Fassung. Die Standardsuche zeigt nur
 * geltende Fassungen; die Autovervollständigung führt darüber hinaus künftig geltende
 * Vorschriften, deren Titelwörter dort keinen Treffer ergeben.
 */
async function currentSearchWord(request: APIRequestContext): Promise<string> {
  for (const entry of await currentDocuments(request)) {
    for (const candidate of [entry.shortTitle, entry.title]) {
      if (!candidate) continue;
      try { return searchWordOf(candidate); } catch { /* nächster Titel */ }
    }
  }
  throw new Error('Keine geltende Vorschrift mit brauchbarem Suchwort');
}

async function currentSuggestion(request: APIRequestContext, options: { query?: string; match?: (entry: Suggestion) => boolean } = {}): Promise<Suggestion> {
  const { query = '', match = () => true } = options;
  const current = new Set((await currentDocuments(request, query)).map((entry) => entry.slug));
  const entry = (await suggestions(request)).find((candidate) => current.has(candidate.slug) && match(candidate));
  if (!entry) throw new Error(`Kein Vorschlag mit geltender Fassung (${query || 'ohne Filter'})`);
  return entry;
}

type SiteTarget = 'portal' | 'law';
const selectedSiteTargets = normalizeSiteTargets(process.env.SITE_TARGETS);
const siteTest = (targets: SiteTarget[]) => targets.some((target) => selectedSiteTargets.includes(target)) ? test : test.skip;
const LEGAL_BASELINE_DATE = '2023-11-01';

/** Portal ohne Einwilligungsbanner und ohne externe Karten- oder Statistikrequests. */
async function prepareFunctionalPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('ostrecht-portal-analytics-consent', 'rejected');
  });
  await page.route('**://*.tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**://www.googletagmanager.com/**', (route) => route.abort());
}

/** Rechtssuche im Endzustand: die Trefferseite ist geladen („n Treffer“ oder „Keine Treffer“). */
async function searchSettled(page: Page): Promise<void> {
  const summary = page.locator('[data-search-summary]');
  await expect(summary).toBeVisible();
  await expect(summary).not.toContainText(/werden geladen/u, { timeout: 30_000 });
  await expect(summary).toContainText(/Treffer/u, { timeout: 30_000 });
}

/** Erster interner Link eines Musters auf einer Seite (z. B. erstes Regierungsmitglied). */
async function firstLink(page: Page, path: string, pattern: RegExp): Promise<string> {
  return withWorkerRecovery(page.request, async () => {
    const response = await page.request.get(path);
    expect(response.ok(), path).toBe(true);
    const match = (await response.text()).match(pattern);
    expect(match, `${path}: kein Link nach ${pattern}`).toBeTruthy();
    return match![0].replace(/^href="/u, '').replace(/"$/u, '');
  });
}

// ---------------------------------------------------------------------------------------------
// Staatsportal
// ---------------------------------------------------------------------------------------------

siteTest(['portal'])('belegte Altadressen werden gezielt weitergeleitet und unbekannte Pfade bleiben 404', async ({ page, request }) => {
  expect(legacyRoutes.length).toBeGreaterThan(0);
  for (const { source, target } of legacyRoutes) {
    // Musterrouten ([slug]) werden mit einem Beispielsegment aufgerufen; der Server darf die
    // Zieladresse als Verzeichnis oder index.html ausliefern.
    const placeholder = source.match(/\[[^\]]+\]/u)?.[0];
    const requested = placeholder ? source.replace(placeholder, 'beispiel') : source;
    const expected = placeholder ? target.replace(placeholder, 'beispiel') : target;
    const response = await request.get(requested, { maxRedirects: 0 });
    expect(response.status(), requested).toBeGreaterThanOrEqual(300);
    expect(response.status(), requested).toBeLessThan(400);
    expect(response.headers().location?.replace(/\/index\.html$/u, ''), requested).toBe(expected.replace(/\/index\.html$/u, ''));
  }

  const missing = await page.goto('/diese-adresse-ist-nicht-belegt/');
  expect(missing?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seite nicht gefunden');
  await expect(page.getByRole('heading', { name: 'Häufig gesuchte Bereiche' })).toBeVisible();
});

siteTest(['portal'])('alte Rechtspfade führen ohne Kette permanent zur funktional gleichen OstRecht-Adresse', async ({ request }) => {
  // Musterpfade: die Weiterleitung ist generisch (/recht/<Weg>/* → OstRecht), unabhängig davon, ob die Norm existiert.
  const redirects = [
    ['/recht/suche/', '/suche/'],
    ['/recht/archiv/', '/a-z/'],
    ['/recht/verfassung/', '/norm/staatsverfassung-des-freistaates-ostdeutschland/'],
    ['/recht/norm/beispielnorm/', '/norm/beispielnorm/'],
    ['/recht/norm/beispielnorm/history/', '/norm/beispielnorm/history/'],
    ['/recht/norm/beispielnorm/version/2026-01-01/', '/norm/beispielnorm/version/2026-01-01/'],
    ['/recht/norm/beispielnorm/vergleich/', '/norm/beispielnorm/vergleich/'],
    ['/recht/verkuendungen/beispielblatt-2026-1/', '/verkuendungen/beispielblatt-2026-1/'],
    ['/recht/sachgebiete/beispielgebiet/', '/sachgebiete/beispielgebiet/'],
  ];

  for (const [source, target] of redirects) {
    const response = await request.get(source, { maxRedirects: 0 });
    expect(response.status(), source).toBe(301);
    expect(response.headers().location, source).toBe(`https://recht.freistaat-ostdeutschland.de${target}`);
  }
});

siteTest(['portal'])('Rechtsbrücke trennt OstRecht-Recherche von Gesetzgebung im Staatsportal', async ({ page }) => {
  await page.goto('/recht/');
  const main = page.locator('#main-content');
  await expect(main.getByRole('heading', { name: 'Rechtsrecherche' })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Gesetzgebung und geltendes Recht' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Geltendes Recht', exact: true })).toHaveAttribute('href', 'https://recht.freistaat-ostdeutschland.de/suche/');
  await expect(main.getByRole('link', { name: 'Verfassung', exact: true })).toHaveAttribute('href', 'https://recht.freistaat-ostdeutschland.de/norm/staatsverfassung-des-freistaates-ostdeutschland/');
  await expect(main.getByRole('link', { name: 'Verkündungen', exact: true })).toHaveAttribute('href', 'https://recht.freistaat-ostdeutschland.de/verkuendungen/');
  await expect(main.locator('form[role="search"]')).toHaveAttribute('action', 'https://recht.freistaat-ostdeutschland.de/suche/');
});

siteTest(['portal'])('Startseite bietet Suche, Ministerien, mobile Navigation und 115-Orientierung', async ({ page }) => {
  await prepareFunctionalPage(page);
  await page.goto('/');

  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.home-ministry-list a')).not.toHaveCount(0);
  await expect(page.locator('.home-resource-card', { hasText: 'Recht schnell finden' })).toBeVisible();
  await expect(page.locator('[data-visual-section="home-current-topics"]')).toBeVisible();
  await expect(page.locator('.service-band__item', { hasText: 'Behördennummer 115' })).toHaveAttribute('href', '/service/kontakt/');

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

siteTest(['portal', 'law'])('alle ausgelieferten Routentypen tragen dieselbe vollständige Buildkennung', async ({ page, request }) => {
  let normPath: string | undefined;
  let publicationSlug: string | undefined;
  if (selectedSiteTargets.includes('law')) {
    normPath = (await currentDocuments(request))[0]?.currentUrl;
    publicationSlug = (await publicationIndex(request)).latestPublication?.slug;
    expect(normPath).toBeTruthy();
    expect(publicationSlug).toBeTruthy();
  }

  const routes = [
    ...(selectedSiteTargets.includes('portal') ? ['/', '/recht/', '/sitemap.xml', '/search-index.json'] : []),
    ...(selectedSiteTargets.includes('law') ? [
      lawUrl('/'),
      lawUrl('/verfassung/'),
      lawUrl(normPath!),
      lawUrl(`/verkuendungen/${publicationSlug}/`),
      lawUrl('/api/suche.json'),
      lawUrl('/verkuendungen/index.json'),
    ] : []),
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

  await page.goto(selectedSiteTargets.includes('law') ? lawUrl('/verfassung/') : '/');
  await expect(page.locator('meta[name="build-commit"]')).toHaveAttribute('content', buildCommit);
});

siteTest(['portal'])('Kernnavigation, Suche und Kontaktwegweiser funktionieren', async ({ page }) => {
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

siteTest(['portal'])('Kreisreform bleibt ohne Karte nutzbar: Tabellenfilter und Gemeindesuche ohne Kartenstart', async ({ page }) => {
  await prepareFunctionalPage(page);
  await page.goto('/kreisreform/');
  await expect(page.locator('.section-hero')).toBeVisible();
  await expect(page.locator('[data-map-load]')).toBeVisible();
  await expect(page.locator('[data-kreisreform-map]')).toBeHidden();
  await page.locator('#kreisreform-table-query').fill('Berlin');
  await expect(page.locator('[data-kreisreform-table-status]')).toContainText('sichtbar');

  const input = page.locator('[data-kreisreform-search-input]');
  await expect(input).toBeVisible();
  await input.fill('Abtsbessingen');
  await expect(page.locator('[data-kreisreform-search-result]')).toHaveCount(1, { timeout: 15_000 });
  await page.locator('[data-kreisreform-search-result]').click();
  await expect(page.locator('[data-kreisreform-search-detail]')).toBeVisible();
  await expect(page.locator('[data-kreisreform-map]')).toBeHidden();
});

siteTest(['portal'])('externe Statistik und Kartenkacheln starten erst nach Freigabe', async ({ page }) => {
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

siteTest(['portal'])('Statistikeinwilligung ist gleichwertig, widerrufbar und tastaturbedienbar', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit setzt den Tastaturfokus auf Schaltflächen nicht wie Chromium und Firefox; der Nutzerweg wird dort geprüft.');
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

siteTest(['portal'])('200-Prozent-Zoom und reduzierte Bewegung bewahren die Kernfunktionen', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit misst den Dokumentumbruch unter CSS-zoom anders; der Reflow wird in Chromium und Firefox geprüft.');
  await prepareFunctionalPage(page);
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
  expect(dimensions.scrollWidth, 'Reflow bei 200 % Zoom ohne horizontales Scrollen').toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(page.locator('[data-map-load]')).toBeVisible();
  await expect(page.locator('#kreisreform-table-query')).toBeVisible();
});

siteTest(['portal'])('Portalsuche: Zustände schließen sich gegenseitig aus', async ({ page }) => {
  await prepareFunctionalPage(page);
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

siteTest(['portal'])('Haushalt: Jahrwechsel und Einzelplanfilter sind eindeutig bedienbar', async ({ page }) => {
  await prepareFunctionalPage(page);
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
  const totalRows = await table.locator('[data-budget-plan-row]').count();
  expect(totalRows).toBeGreaterThan(1);
  const filterWord = searchWordOf((await table.locator('[data-budget-plan-row] th a').first().textContent()) ?? '');
  await table.locator('[data-budget-plan-filter="query"]').fill(filterWord);
  const visibleRows = await table.locator('[data-budget-plan-row]:visible').count();
  expect(visibleRows).toBeGreaterThanOrEqual(1);
  expect(visibleRows).toBeLessThan(totalRows);
  await expect(table.locator('[data-budget-plan-status]')).toContainText(`${visibleRows} von ${totalRows} Einzelplänen`);
});

siteTest(['portal'])('Lokale Bereichsnavigation und Ministeriumsverzeichnis sind vollständig zugänglich', async ({ page }) => {
  await page.goto('/staatsregierung/kabinett/');

  const navigation = page.getByRole('navigation', { name: 'Staatsrat' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Staatsrat & Geschäftsbereiche' })).toHaveAttribute('aria-current', 'page');

  const directory = page.locator('[data-ministry-directory]');
  await expect(directory).toBeVisible();
  await expect(directory.locator('.ministry-directory__item')).not.toHaveCount(0);
  await expect(directory.locator('a[href^="/staatsregierung/kabinett/"]').first()).toBeVisible();
});

siteTest(['portal'])('Regierungsprofil verbindet Porträt, Amt, Status und Kontakt im sichtbaren Kopf; Bildnachweise bleiben beim Hero-Bild', async ({ page }) => {
  const memberPath = await firstLink(page, '/staatsregierung/kabinett/', /href="\/staatsregierung\/mitglieder\/[a-z0-9-]+\/"/u);
  const ministryPath = await firstLink(page, '/staatsregierung/kabinett/', /href="\/staatsregierung\/kabinett\/[a-z0-9-]+\/"/u);
  await page.goto(memberPath);

  const hero = page.locator('.section-hero--profile');
  await expect(hero).toBeVisible();
  await expect(hero.getByRole('heading', { level: 1 })).not.toHaveText('');
  await expect(hero.locator('.section-hero__image')).toBeVisible();
  await expect(hero.locator('figure')).toHaveCount(1);
  await expect(hero.locator('figcaption')).toHaveText(/^Bildnachweis: /u);
  await expect(hero.locator('img')).toHaveAttribute('alt', /^Porträt von /u);
  await expect(hero.getByRole('link', { name: /@/ })).toBeVisible();

  for (const path of [memberPath, ministryPath]) {
    await page.goto(path);
    await expect(page.locator('.section-hero figure .section-hero__credit')).toHaveText(/^Bildnachweis: /u);
    await expect(page.locator('.section-navigation + p.media-credit')).toHaveCount(0);
    await expect(page.locator('main > p.media-credit')).toHaveCount(0);
  }
});

siteTest(['portal'])('115 bleibt ein Informationsweg ohne behauptete Erreichbarkeit oder Direktwahl', async ({ page }) => {
  for (const path of ['/', '/service/']) {
    await page.goto(path);
    await expect(page.locator('a[href^="tel:115"]')).toHaveCount(0);
    await expect(page.getByText(/115 ist montags bis freitags von 8 bis 18 Uhr/iu)).toHaveCount(0);
  }
  await expect(page.getByText(/Informationen zur Behördennummer 115 und die Kontaktwege/iu)).toBeVisible();

  const serviceEntry = page.locator('[data-visual-section="global-service-band"] .service-band__item', {
    hasText: 'Behördennummer 115',
  });
  await expect(serviceEntry).toHaveAttribute('href', '/service/kontakt/');
  await expect(serviceEntry).toContainText('Informationen und Kontaktwege');
});

siteTest(['portal', 'law'])('Kalender, Sitemaps und strukturierte Termindaten sind erreichbar', async ({ page, request }) => {
  if (selectedSiteTargets.includes('portal')) {
    const calendar = await request.get('/presse/termine/kalender.ics');
    expect(calendar.ok()).toBe(true);
    const calendarText = await calendar.text();
    expect(calendarText).toMatch(/^BEGIN:VCALENDAR/mu);
    expect(calendarText).toMatch(/^END:VCALENDAR/mu);

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain('<urlset');
    expect(sitemapText).toContain('<loc>');

    await page.goto('/presse/termine/');
    const firstEventLink = page.locator('a[href^="/presse/termine/"]:not([href$="kalender.ics"])').first();
    await expect(firstEventLink).toBeVisible();
    // Erst nach abgeschlossener Navigation lesen (Firefox liefert sonst die Skripte der alten Seite).
    await Promise.all([page.waitForURL(/\/presse\/termine\/[^/]+\/?$/u), firstEventLink.click()]);
    const structuredData = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
      scripts.map((script) => script.textContent ?? '').join('\n'),
    );
    expect(structuredData).toMatch(/@type/iu);
  }

  if (selectedSiteTargets.includes('law')) {
    const lawSitemap = await request.get(lawUrl('/sitemap.xml'));
    expect(lawSitemap.ok()).toBe(true);
    expect(await lawSitemap.text()).toContain('<urlset');
  }
});

// ---------------------------------------------------------------------------------------------
// OstRecht
// ---------------------------------------------------------------------------------------------

siteTest(['law'])('OstRecht-Suche hält URL, Filterchips und Browserverlauf synchron', async ({ page, request }) => {
  // Stöbern mit Normtypfilter: alle Typen mit Treffern sind wählbar; die URL trägt den Zustand.
  const [law] = await currentDocuments(request, '&type=gesetz');
  const [regulation] = await currentDocuments(request, '&type=verordnung');
  expect(law && regulation, 'geltendes Gesetz und geltende Verordnung im Bestand').toBeTruthy();
  await page.goto(lawUrl('/suche/?type=gesetz'));
  await searchSettled(page);

  await expect(page.getByLabel('Suchanfrage und Filter').getByRole('button', { name: 'Suchen' })).toBeVisible();
  await expect(page.getByLabel('Suchbereich')).toBeVisible();
  const lawType = page.locator('input[name="type"][value="gesetz"]');
  await expect(lawType).toBeChecked();
  await expect(page.locator('select[name="type"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Filter entfernen: Normtyp: Gesetz/u })).toBeVisible();

  const regulationType = page.locator('input[name="type"][value="verordnung"]');
  await lawType.uncheck();
  await regulationType.check();
  await expect(page).toHaveURL(/type=verordnung/u);
  await expect(page).not.toHaveURL(/type=gesetz/u);
  await expect(lawType).not.toBeChecked();
  await expect(regulationType).toBeChecked();

  await lawType.check();
  await expect(page.locator('input[name="type"]:checked')).toHaveCount(2);
  await expect(page).toHaveURL(/type=verordnung.*type=gesetz|type=gesetz.*type=verordnung/u);

  const inForce = page.locator('input[name="status"][value="in-force"]');
  await page.locator('[data-search-filter-panel="more"] > summary').click();
  await expect(inForce).toBeVisible();
  await inForce.check();
  await expect(page).toHaveURL(/type=gesetz.*status=in-force|status=in-force.*type=gesetz/u);
  await page.reload();
  await expect(lawType).toBeChecked();
  await expect(inForce).toBeChecked();

  await page.getByRole('button', { name: /Filter entfernen: Normtyp: Gesetz/u }).click();
  await expect(page).not.toHaveURL(/type=gesetz/u);
  await page.goBack();
  await expect(lawType).toBeChecked();
  await expect(inForce).toBeChecked();

  await page.getByRole('button', { name: 'Alle Filter löschen' }).click();
  await expect(page).toHaveURL(/\/suche\/(?:\?q=)?$/u);
  await searchSettled(page);
});

siteTest(['law'])('starke Änderungsvorschriften-Titel bleiben ohne Volltextfilter auffindbar', async ({ page, request }) => {
  const payload = await searchApi(request, '?versionScope=current&includeAmendments=1');
  const amendment = payload.hits.find((hit) => hit.isAmendment && hit.versionKind === 'current');
  expect(amendment, 'geltende Änderungsvorschrift im Bestand').toBeTruthy();
  await page.goto(lawUrl(`/suche/?q=${encodeURIComponent(amendment!.title)}`));
  await searchSettled(page);
  await expect(page.locator('[data-search-filter="includeAmendments"]')).not.toBeChecked();
  await expect(page).not.toHaveURL(/includeAmendments=1/u);
  await expect(page.getByRole('listbox', { name: 'Vorschlagsliste für Normen' })).toHaveCount(0);
  await expect(page.locator('[data-search-results] .search-hit__title', { hasText: amendment!.title }).first()).toBeVisible();
});

siteTest(['law'])('Normverzeichnis filtert und paginiert serverseitig; die Buchstabenleiste zeigt alle Buchstaben', async ({ page }) => {
  await page.goto(lawUrl('/gesetze/'));
  // Ohne Filter: Ergebniszahl unter der Leiste, „Zurücksetzen“ vorhanden, aber inaktiv.
  await expect(page.locator('[data-directory-count]')).toContainText(/Vorschrift/u);
  await expect(page.locator('[data-directory-reset]')).toHaveAttribute('aria-disabled', 'true');
  expect(await page.locator('[data-directory-entry]').count()).toBeLessThanOrEqual(50);
  // Alle 27 Buchstabengruppen sind sichtbar; unbelegte sind inaktiv statt entfernt.
  const letters = page.locator('.letter-nav [data-index-letter]:not([data-index-letter=""])');
  await expect(letters).toHaveCount(27);
  expect(await page.locator('.letter-nav span[aria-disabled="true"]').count()).toBeGreaterThan(0);

  const filterWord = searchWordOf((await page.locator('[data-directory-entry] .directory-entry__title a').first().textContent()) ?? '');
  const query = page.locator('[data-directory-filter] input[name="q"]');
  await query.fill(filterWord);
  await page.locator('[data-directory-filter]').getByRole('button', { name: 'Filtern' }).click();
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(filterWord)}`, 'u'));
  await expect(page.locator('[data-directory-count]')).toContainText(/passen zur Auswahl/u);
  await expect(page.locator('[data-directory-entry]').first()).toContainText(new RegExp(filterWord, 'iu'));
  await expect(page.locator('a[data-directory-reset]')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/u);

  // Sprung in eine Buchstabengruppe behält den Filter; Zurück stellt den vorherigen Zustand wieder her.
  const letter = page.locator('.letter-nav a[data-index-letter]:not([data-index-letter=""])').first();
  const letterValue = await letter.getAttribute('data-index-letter');
  await letter.click();
  await expect(page).toHaveURL(new RegExp(`buchstabe=${letterValue}`, 'u'));
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(filterWord)}`, 'u'));
  await expect(page.locator('.letter-nav a[aria-current="page"]')).toHaveText(letterValue ?? '');
  await page.goBack();
  await expect(query).toHaveValue(filterWord);
  await expect(page.locator('[data-directory-entry]').first()).toContainText(new RegExp(filterWord, 'iu'));

  // Zurücksetzen führt auf das ungefilterte Verzeichnis.
  await page.locator('a[data-directory-reset]').click();
  await expect(page).toHaveURL(lawUrl('/gesetze/'));
  await expect(page.locator('[data-directory-reset]')).toHaveAttribute('aria-disabled', 'true');
});

siteTest(['law'])('Alle Verzeichnisse verwenden dieselbe Eintragskomponente und dieselbe Filterleiste', async ({ page }) => {
  const subjectPath = await firstLink(page, lawUrl('/sachgebiete/'), /href="\/sachgebiete\/[a-z0-9-]+\/"/u);
  for (const path of ['/gesetze/', '/verordnungen/', '/verwaltungsvorschriften/', '/foerderrichtlinien/', '/verkuendungen/', '/verkuendungen/?ansicht=eintraege', '/a-z/', subjectPath]) {
    await page.goto(lawUrl(path));
    await expect(page.locator('[data-directory-filter]').first(), path).toBeVisible();
    await expect(page.locator('[data-directory-count]').first(), path).toBeVisible();
    await expect(page.locator('[data-directory-reset]').first(), path).toBeVisible();
    const entries = await page.locator('.directory-entry').count();
    expect(entries, path).toBeGreaterThan(0);
    expect(entries, path).toBeLessThanOrEqual(50);
  }
});

/**
 * Die Vorschriftendaten sind unterhalb von 80 rem ein Aufklappbereich (NormFacts.astro klappt sie
 * beim Laden zu). Die Prüfungen öffnen ihn wie eine Leserin, statt eine Bildschirmbreite anzunehmen.
 */
async function openNormFacts(page: Page): Promise<Locator> {
  const facts = page.locator('[data-visual-section="norm-facts"]');
  await expect(facts).toHaveCount(1);
  if (!(await facts.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await facts.locator('summary').click();
  }
  return facts;
}

siteTest(['law'])('Fassungstitel, Gültigkeitsdaten und Rechtsereignisse folgen dem redaktionellen Stichtag', async ({ page, request }) => {
  const referenceDate = editorialReferenceDate();
  const norm = await multiVersionNorm(request);
  await page.goto(lawUrl(norm.historical.url));
  // Die Überschrift trägt den Kurztitel, wenn er vom Langtitel abweicht (getNormTitleBlock).
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(norm.historical.shortTitle || norm.historical.title);
  const facts = await openNormFacts(page);
  await expect(facts).toContainText(formatGermanDate(norm.historical.validFrom));
  if (norm.historical.validTo) await expect(facts).toContainText(formatGermanDate(norm.historical.validTo));

  await page.goto(lawUrl(norm.current.currentUrl));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(norm.current.shortTitle || norm.current.title);

  // Startseite zum redaktionellen Stichtag: letzte Rechtsereignisse absteigend, je Norm einmal,
  // nichts Künftiges; künftige Änderungen liegen nach dem Stichtag.
  await page.addInitScript((fixedDate) => {
    const NativeDate = Date;
    const fixedTime = new NativeDate(`${fixedDate}T10:00:00+02:00`).valueOf();
    class FixedDate extends NativeDate {
      constructor(...args: unknown[]) {
        super(args.length === 0 ? fixedTime : (Reflect.construct(NativeDate, args) as Date).valueOf());
      }

      static now() {
        return fixedTime;
      }
    }
    Object.defineProperty(window, 'Date', { configurable: true, value: FixedDate });
  }, referenceDate);
  await page.goto(lawUrl('/'));
  const currentEntries = page.locator('[data-law-current-change-list] [data-law-change]:visible');
  const currentDates = await currentEntries.evaluateAll((entries) => entries.map((entry) => entry.getAttribute('data-effective-date') ?? ''));
  expect(currentDates.length).toBeGreaterThanOrEqual(3);
  expect(currentDates.every((date) => date <= referenceDate)).toBeTruthy();
  expect(currentDates.every((date, index) => index === 0 || currentDates[index - 1] >= date)).toBeTruthy();
  const newest = (await currentDocuments(request))[0];
  expect(currentDates[0]).toBe(newest.lastChangeDate);
  const currentLinks = await currentEntries.locator('h3 a').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(new Set(currentLinks).size).toBe(currentLinks.length);
  const futureDates = await page
    .locator('[data-law-future-change-list] [data-law-change]:visible')
    .evaluateAll((entries) => entries
      .map((entry) => entry.getAttribute('data-effective-date'))
      .filter((date): date is string => Boolean(date)));
  expect(futureDates.every((date) => date > referenceDate)).toBeTruthy();
});

siteTest(['law'])('Einstiegssuchen bieten Normvorschläge, die Hauptsuche bleibt bei einer Trefferliste', async ({ page, request }) => {
  const suggestion = await currentSuggestion(request, { match: (entry) => Boolean(entry.abbr) && /^[A-Za-zÄÖÜäöü]{4,}$/u.test(entry.abbr) });
  expect(suggestion, 'Vorschlag mit Abkürzung').toBeTruthy();
  const [startNorm] = await currentDocuments(request, '&type=gesetz');
  await page.goto(lawUrl(startNorm.currentUrl));
  const search = page.locator('.law-header-search--compact');
  await expect(search).toBeVisible();
  const input = search.locator('input[name="q"]');
  await input.fill(suggestion!.abbr);
  const listbox = page.getByRole('listbox', { name: 'Vorschlagsliste für Normen' });
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole('option').filter({ hasText: suggestion!.abbr }).first()).toBeVisible();
  await input.press('Escape');
  const word = searchWordOf(suggestion!.title);
  await input.fill(word);
  await Promise.all([
    page.waitForURL(new RegExp(`/suche/\\?q=${encodeURIComponent(word)}`, 'u')),
    search.getByRole('button', { name: 'Suchen' }).click(),
  ]);
  await searchSettled(page);
  await expect(page.locator('[data-search-results]')).toContainText(new RegExp(word, 'iu'));

  await page.goto(lawUrl('/suche/'));
  await searchSettled(page);
  const mainQuery = page.locator('[data-search-query]');
  await mainQuery.fill(suggestion!.abbr);
  await expect(page.getByRole('listbox', { name: 'Vorschlagsliste für Normen' })).toHaveCount(0);
  await expect(page.locator('[data-search-results] .search-hit').first()).toContainText(suggestion!.title);
});

siteTest(['law'])('Normkopf unterscheidet allgemeinen und fassungsspezifischen Link und kennzeichnet Staatsportal-Bezüge', async ({ page, request }) => {
  const [relatedSlug] = fixtureSlugsWithRole('portal-relations');
  expect(relatedSlug, 'Fixture-Rolle portal-relations').toBeTruthy();
  await page.goto(lawUrl(`/norm/${relatedSlug}/`));
  const facts = await openNormFacts(page);
  await expect(facts).toContainText('Vollzitat');
  await expect(facts).toContainText('Rechtsstand');
  await expect(facts.getByRole('button', { name: 'Vollzitat kopieren' })).toBeVisible();
  await expect(facts.getByRole('button', { name: 'Link zur Vorschrift kopieren' })).toBeVisible();
  // Jede Angabe steht genau einmal: die abgelösten Blöcke gibt es nicht mehr.
  await expect(page.locator('[data-visual-section="norm-legal-status"], [data-visual-section="norm-citation-status"], [data-visual-section="norm-metadata"]')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Werkzeuge zur Vorschrift' })).toHaveCount(1);

  const portalRelations = page.locator('[data-visual-section="norm-portal-relations"]');
  await expect(portalRelations.getByRole('heading', { name: 'Im Staatsportal' })).toBeVisible();
  await expect(portalRelations.locator('a[href^="https://freistaat-ostdeutschland.de/"]').first()).toBeVisible();

  const norm = await multiVersionNorm(request);
  await page.goto(lawUrl(norm.historical.url));
  const versionFacts = await openNormFacts(page);
  await expect(versionFacts.getByRole('button', { name: 'Link zu dieser Fassung kopieren' })).toBeVisible();
  await expect(versionFacts.getByText('Dieser Link führt dauerhaft zu dieser Fassung.')).toBeVisible();
});

siteTest(['law'])('OstRecht-Navigation bleibt mobil nutzbar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(lawUrl('/'));
  const mobileNavigation = page.locator('.law-mobile-nav');
  await mobileNavigation.locator('summary').click();
  await expect(mobileNavigation.locator('.law-mobile-nav__panel')).toBeVisible();
  await expect(mobileNavigation.getByRole('link', { name: 'Rechtssuche', exact: true })).toBeVisible();
  await expect(page.locator('.law-footer').getByRole('navigation', { name: 'Recherchewege im Footer' }).getByRole('link')).not.toHaveCount(0);
});

siteTest(['law'])('Normgliederung besitzt eindeutige IDs und deckungsgleiche Inhaltsanker', async ({ page, request }) => {
  const documents = await currentDocuments(request);
  for (const document of documents.slice(0, 3)) {
    const path = lawUrl(document.currentUrl);
    await page.goto(path);
    const result = await page.evaluate(() => {
      const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id);
      const outlineAnchors = [...document.querySelectorAll<HTMLAnchorElement>('.norm-outline a')]
        .map((link) => decodeURIComponent(link.hash.slice(1)));
      const missingLabels = [...document.querySelectorAll<HTMLElement>('[aria-labelledby]')]
        .map((element) => element.getAttribute('aria-labelledby') ?? '')
        .filter((id) => id && !document.getElementById(id));
      return {
        duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
        unresolvedOutlineAnchors: outlineAnchors.filter((id) => !document.getElementById(id)),
        missingLabels,
      };
    });
    expect(result.duplicateIds, path).toEqual([]);
    expect(result.unresolvedOutlineAnchors, path).toEqual([]);
    expect(result.missingLabels, path).toEqual([]);
  }
});

siteTest(['law'])('Normtabellen geben nur belastbare Kopfzellen-Scope-Werte aus', async ({ page }) => {
  const [tableSlug] = fixtureSlugsWithRole('norm-table');
  expect(tableSlug, 'Fixture-Rolle norm-table').toBeTruthy();
  await page.goto(lawUrl(`/norm/${tableSlug}/`));

  const headerCells = page.locator('.norm-table th');
  const headerCount = await headerCells.count();
  expect(headerCount).toBeGreaterThan(0);
  await expect(page.locator('.norm-table th[scope="col"]')).toHaveCount(headerCount);
  await expect(page.locator('.norm-table th[scope="row"], .norm-table th[scope="colgroup"], .norm-table th[scope="rowgroup"]')).toHaveCount(0);
});

siteTest(['law'])('Rechtsportal verwendet auf Übersichten und Suchindex dieselbe jüngste Verkündung', async ({ page, request }) => {
  const index = await publicationIndex(request);
  const latestPublication = index.latestPublication;
  expect(latestPublication).toBeTruthy();
  const latestPublicationLabel = latestPublication!.label;

  await page.goto(lawUrl('/'));
  const latestHomePublication = page.getByRole('heading', { name: 'Neu verkündet' })
    .locator('xpath=following::ol[1]')
    .locator('li')
    .first();
  await expect(latestHomePublication).toContainText(latestPublicationLabel);

  await page.goto(lawUrl('/verkuendungen/'));
  await expect(page.locator('[data-directory-entry]').first()).toContainText(latestPublicationLabel);

  expect((await publicationIndex(request)).latestPublication).toEqual(latestPublication);
});

siteTest(['law'])('Normtext bietet stabile Anker, Fassungsnavigation und zugängliche Textwerkzeuge', async ({ page, request }) => {
  const norm = await multiVersionNorm(request);
  await page.goto(lawUrl(norm.current.currentUrl));

  const versionNavigation = page.getByRole('navigation', { name: 'Fassungen dieser Vorschrift' });
  await expect(versionNavigation).toBeVisible();
  const referenceLabel = `Rechtsstand vom ${formatGermanDate(editorialReferenceDate())}`;
  await expect(versionNavigation.locator('.norm-version-picker summary')).toContainText(referenceLabel);
  await versionNavigation.locator('.norm-version-picker summary').click();
  await expect(versionNavigation.getByRole('link', { name: referenceLabel })).toBeVisible();

  const firstUnit = page.locator('.norm-unit[data-norm-unit]').first();
  await expect(firstUnit).toHaveAttribute('id', /^paragraph-|^artikel-/u);
  const semanticId = await firstUnit.getAttribute('id');
  expect(semanticId).toBeTruthy();
  await expect(firstUnit.locator('.legacy-anchor')).toHaveAttribute('id', /^block-/u);
  // Die Überschrift der Einheit ist eine echte Überschrift; der Schalter daneben trägt den Zustand.
  await expect(firstUnit.locator('.norm-unit__head [id]').first()).toHaveAttribute('id', `${semanticId}-heading`);
  const unitToggle = firstUnit.locator('[data-unit-toggle]');
  await expect(unitToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(unitToggle).toHaveAttribute('aria-controls', `${semanticId}-inhalt`);
  await unitToggle.click();
  await expect(unitToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator(`#${semanticId}-inhalt`)).toBeHidden();
  await unitToggle.click();
  await expect(page.locator(`#${semanticId}-inhalt`)).toBeVisible();

  // Der Gesamtschalter nennt die Einheitenart der Vorschrift („Alle Artikel …“, „Alle Paragraphen …“).
  const toggleAll = page.locator('[data-norm-toggle-all]');
  const closeLabel = await toggleAll.getAttribute('data-close-label');
  const openLabel = await toggleAll.getAttribute('data-open-label');
  expect(closeLabel).toMatch(/^Alle \S/u);
  await page.getByRole('button', { name: closeLabel! }).click();
  await expect(page.locator('.norm-unit[data-norm-unit]:not([data-collapsed])')).toHaveCount(0);
  await page.getByRole('button', { name: openLabel! }).click();
  await expect(page.locator('.norm-unit[data-norm-unit]:not([data-collapsed])').first()).toBeVisible();

  await page.evaluate(() => {
    const testWindow = window as Window & { __printCalls?: number };
    testWindow.__printCalls = 0;
    window.print = () => {
      testWindow.__printCalls = (testWindow.__printCalls ?? 0) + 1;
    };
  });
  await page.getByRole('button', { name: 'Drucken', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls)).toBe(1);

  // Werkzeuge je Einheit: ein Symbolknopf öffnet das Menü mit Anker und Einzeldruck.
  const unitTools = firstUnit.getByRole('navigation', { name: /Werkzeuge für/u });
  await unitTools.locator('summary').click();
  const singlePrint = unitTools.getByRole('button', { name: 'Einzeldruck' });
  await expect(singlePrint).toBeVisible();
  await singlePrint.click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls)).toBe(2);
  await expect(page.locator('body')).not.toHaveClass(/print-single-norm-unit/u);
  await expect(unitTools.getByRole('link', { name: 'Link zu dieser Stelle kopieren' })).toHaveAttribute('href', `#${semanticId}`);
  await expect(page.getByRole('heading', { name: 'Drucken und Quellen' })).toBeVisible();
});

siteTest(['law'])('Fassungsvergleich zeigt jeden geänderten Paragraphen einmal mit markiertem Wortlaut und ohne Kontextblöcke', async ({ page, request }) => {
  const norm = await multiVersionNorm(request);
  await page.goto(lawUrl(`/norm/${norm.slug}/vergleich/?von=${norm.historical.versionId}&bis=${norm.current.versionId}`));
  await expect(page.locator('[data-compare-output]')).toHaveAttribute('data-compare-pair', `${norm.historical.versionId}::${norm.current.versionId}`);
  const changedProvisions = page.locator('.norm-diff__provision--changed');
  expect(await changedProvisions.count()).toBeGreaterThan(0);
  for (const provision of await changedProvisions.all()) {
    const marks = await provision.locator('.norm-diff__side--before del, .norm-diff__side--after ins').count();
    expect(marks, 'jede geänderte Vorschrift markiert Streichung oder Einfügung').toBeGreaterThan(0);
  }
  await expect(page.locator('.norm-diff__context')).toHaveCount(0);
  // Der Vergleich ohne Paar zeigt die Auswahl und keinen Zwischenstand.
  await page.goto(lawUrl(`/norm/${norm.slug}/vergleich/`));
  await expect(page.locator('[data-version-compare] .norm-compare__form')).toBeVisible();
});

siteTest(['law'])('Fassungsleiste bleibt auf aktueller Fassung, Historie und Einzelfassung identisch', async ({ page, request }) => {
  const norm = await multiVersionNorm(request);
  for (const path of [norm.current.currentUrl, `/norm/${norm.slug}/history/`, norm.historical.url]) {
    await page.goto(lawUrl(path));
    const navigation = page.getByRole('navigation', { name: 'Fassungen dieser Vorschrift' });
    await expect(navigation.locator('.norm-version-navigation__primary a'), path).toHaveText([
      'Aktuelle Fassung',
      'Fassungen und Änderungen',
      'Fassungsvergleich',
    ]);
    // Jede Unterseite kennzeichnet sich selbst; ein Sprungziel steht nicht in der Reihe.
    await expect(navigation.locator('.norm-version-navigation__primary a[aria-current="page"]'), path).toHaveCount(1);
    await expect(navigation.locator('.norm-version-navigation__primary a[href*="#"]'), path).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Werkzeuge zur Vorschrift' }).getByText(/vergleich/iu)).toHaveCount(0);
  }
});

siteTest(['law'])('Rechtssuche unterstützt Fassungsarten, mehrere Normtypen, Platzhalter und URL-Zustand', async ({ page, request }) => {
  const suggestion = await currentSuggestion(request, { query: '&type=gesetz' });
  expect(suggestion).toBeTruthy();
  const word = searchWordOf(suggestion!.title);
  await page.goto(lawUrl(`/suche/?q=${encodeURIComponent(`${word.slice(0, Math.max(5, word.length - 2))}*`)}&type=gesetz&type=verordnung`));
  await searchSettled(page);
  await expect(page.locator('input[name="type"]:checked')).toHaveCount(2);

  await page.locator('select[name="versionScope"]').selectOption('historical');
  await expect(page).toHaveURL(/versionScope=historical/u);
  await expect(page.locator('[data-search-summary]')).toContainText(/Treffer|Keine Treffer/u);

  await page.locator('select[name="versionScope"]').selectOption('current');
  await page.locator('[data-search-query]').fill(word);
  await expect.poll(() => page.locator('[data-search-results] .search-result-group').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-search-results]')).toContainText(new RegExp(word, 'iu'));
});

siteTest(['law'])('Rechtssuche wählt die Sortierung kontextabhängig und bewahrt eine ausdrückliche Auswahl', async ({ page, request }) => {
  await page.goto(lawUrl('/suche/'));
  await searchSettled(page);
  await expect(page.locator('select[name="sort"]')).toHaveValue('activity');
  await expect(page).not.toHaveURL(/sort=/u);
  // Ohne Suchbegriff: jüngstes Rechtsereignis zuerst – die Kandidaten kommen bereits in dieser
  // Reihenfolge aus D1; der erste Treffer ist die Norm mit dem jüngsten Rechtsereignis.
  await expect(page.locator('[data-search-summary]')).toContainText('jüngster Rechtsänderung');
  const browse = await currentDocuments(request);
  const browseDates = browse.map((entry) => entry.lastChangeDate ?? '');
  expect(browseDates.length).toBeGreaterThan(5);
  expect(browseDates.every((date, index) => index === 0 || browseDates[index - 1] >= date)).toBeTruthy();
  await expect(page.locator('[data-search-results] .search-hit .search-hit__title').first()).toContainText(browse[0].title);

  // Filter ohne Suchbegriff: innerhalb des Filters ebenfalls jüngstes Rechtsereignis zuerst.
  await page.goto(lawUrl('/suche/?type=gesetz'));
  await searchSettled(page);
  await expect(page.locator('select[name="sort"]')).toHaveValue('activity');
  await expect(page.locator('[data-search-summary]')).toContainText('jüngster Rechtsänderung');
  await expect(page.locator('[data-search-results] .search-hit .law-type-label').first()).toHaveText('Gesetz');
  const filtered = await currentDocuments(request, '&type=gesetz');
  const filteredDates = filtered.map((entry) => entry.lastChangeDate ?? '');
  expect(filtered.every((entry) => entry.type === 'gesetz')).toBeTruthy();
  expect(filteredDates.every((date, index) => index === 0 || filteredDates[index - 1] >= date)).toBeTruthy();

  const word = await currentSearchWord(request);
  await page.goto(lawUrl(`/suche/?q=${encodeURIComponent(word)}`));
  await searchSettled(page);
  await expect(page.locator('select[name="sort"]')).toHaveValue('relevance');
  await expect(page).not.toHaveURL(/sort=/u);
  await expect(page.locator('[data-search-results] .search-hit').first()).toContainText(new RegExp(word, 'iu'));

  await page.locator('select[name="sort"]').selectOption('publication');
  await expect(page).toHaveURL(/sort=publication/u);
  await expect(page.locator('select[name="sort"]')).toHaveValue('publication');
});

interface CandidatePayload {
  total: number;
  offset: number;
  limit: number;
  hits: ApiDocument[];
}

/** Suchseite laden und die Antwort mitlesen, die die Seite selbst angefordert hat. */
async function loadSearchPage(page: Page, query: string): Promise<CandidatePayload> {
  const [response] = await Promise.all([
    page.waitForResponse((entry) => entry.url().includes('/api/suche.json') && entry.status() === 200),
    page.goto(lawUrl(`/suche/${query}`)),
  ]);
  await expect(page.locator('[data-search-summary]')).toContainText(/Treffer/u);
  return await response.json() as CandidatePayload;
}

interface SearchCounts {
  /** Gesamtzahl aus der Überschrift; die Suche zählt vollständig, eine Untergrenze gibt es nicht. */
  headline: number | null;
  shown: number;
  remaining: number | null;
  moreVisible: boolean;
  summary: string;
}

/** Zahlen der Oberfläche: Überschrift, angezeigte Treffer und Nachladezähler. */
async function readSearchCounts(page: Page): Promise<SearchCounts> {
  const summary = (await page.locator('[data-search-summary]').textContent()) ?? '';
  const shown = await page.locator('[data-search-results] .search-result-group').count();
  const more = page.locator('[data-search-more]');
  const moreVisible = await more.isVisible();
  const moreText = moreVisible ? (await more.textContent()) ?? '' : '';
  const headline = summary.match(/^(\d+) Treffer/u)?.[1];
  const remaining = moreText.match(/\((\d+) verbleibend\)/u)?.[1];
  return {
    headline: headline === undefined ? (/^Keine Treffer/u.test(summary) ? 0 : null) : Number(headline),
    shown,
    remaining: remaining === undefined ? null : Number(remaining),
    moreVisible,
    summary,
  };
}

/** Widerspruchsfreiheit von Überschrift, Nachladezähler und serverseitigem `total`. */
function expectConsistentCounts(counts: SearchCounts, payload: CandidatePayload, label: string): void {
  const where = `${label}: ${counts.summary}`;
  expect(counts.headline, where).toBe(payload.total);
  // Angezeigte und verbleibende Treffer ergeben zusammen die genannte Gesamtzahl.
  expect(counts.shown + (counts.remaining ?? 0), where).toBe(counts.headline);
  // Der Nachladeknopf erscheint genau dann, wenn noch Treffer fehlen.
  expect(counts.moreVisible, where).toBe(counts.shown < (counts.headline ?? 0));
  if (counts.moreVisible) expect(counts.remaining, where).not.toBeNull();
}

siteTest(['law'])('Trefferzahl, serverseitiges total und Nachladezähler beschreiben dieselbe Ergebnismenge', async ({ page, request }) => {
  const referenceDate = editorialReferenceDate();
  // Jede Filterkombination wird vollständig serverseitig ausgedrückt: die Überschrift nennt
  // genau die Zahl, die die Such-API als total liefert – mit und ohne Suchbegriff.
  const issue = (await searchApi(request, '?versionScope=all&includeAmendments=1')).hits.find((entry) => entry.publicationIssue)?.publicationIssue;
  expect(issue, 'Vorschrift mit Ausgabennummer').toBeTruthy();
  const word = await currentSearchWord(request);
  const cases = [
    { label: 'ohne Suchbegriff', query: '' },
    { label: 'Änderungsvorschriften einbezogen', query: '?includeAmendments=1' },
    { label: 'nur geltende Fassungen', query: '?versionScope=current' },
    { label: 'alle Fassungen', query: '?versionScope=all' },
    { label: 'Normtyp Gesetz', query: '?type=gesetz' },
    { label: 'Status und Normtyp', query: '?type=gesetz&status=in-force' },
    { label: 'Geltungstag', query: `?geltungstag=${referenceDate}` },
    { label: 'Gültigkeitszeitraum', query: `?validFrom=${referenceDate.slice(0, 4)}-01-01&validTo=${referenceDate.slice(0, 4)}-12-31&versionScope=all` },
    { label: 'Ausgabennummer', query: `?publicationIssue=${issue}&versionScope=all&includeAmendments=1` },
    { label: 'Suchbegriff', query: `?q=${encodeURIComponent(word)}` },
    { label: 'Suchbegriff und Sortierung', query: `?q=${encodeURIComponent(word)}&sort=title` },
  ];

  for (const { label, query } of cases) {
    const payload = await loadSearchPage(page, query);
    const counts = await readSearchCounts(page);
    expectConsistentCounts(counts, payload, label);
  }

  // Nachladen: mehr angezeigt, dieselbe Gesamtzahl, kleinerer Restwert – und die zweite Anfrage
  // holt die nächste Seite über `offset`, statt dieselbe Menge erneut zu laden.
  const paged = await loadSearchPage(page, '?includeAmendments=1&versionScope=all');
  const before = await readSearchCounts(page);
  if (before.moreVisible) {
    const [next] = await Promise.all([
      page.waitForResponse((entry) => entry.url().includes('/api/suche.json') && entry.status() === 200),
      page.locator('[data-search-more]').click(),
    ]);
    expect(new URL(next.url()).searchParams.get('offset'), 'die zweite Anfrage blättert weiter').toBe(String(before.shown));
    await expect.poll(async () => (await readSearchCounts(page)).shown).toBeGreaterThan(before.shown);
    const after = await readSearchCounts(page);
    expect(after.headline).toBe(paged.total);
    expect(after.shown + (after.remaining ?? 0)).toBe(after.headline);
    expect(after.remaining ?? 0).toBeLessThan(before.remaining ?? 0);
  }
});

siteTest(['law'])('Die Rechtssuche stellt je Suchzustand genau eine Anfrage', async ({ page, request }) => {
  const word = await currentSearchWord(request);
  let requests = 0;
  page.on('request', (entry) => {
    if (entry.url().includes('/api/suche.json')) requests += 1;
  });
  await page.goto(lawUrl(`/suche/?q=${encodeURIComponent(word)}`));
  await searchSettled(page);
  expect(requests, 'ein Seitenaufruf mit Suchbegriff fragt genau einmal').toBe(1);

  // Ein Filterwechsel ist ein neuer Suchzustand: genau eine weitere Anfrage.
  await page.locator('select[name="versionScope"]').selectOption('all');
  await searchSettled(page);
  await expect(page).toHaveURL(/versionScope=all/u);
  await expect.poll(() => requests).toBe(2);
  expect(requests).toBe(2);
});

siteTest(['law'])('Verzeichniszahlen und Suchtreffer zählen denselben Bestand', async ({ page, request }) => {
  const directoryCount = async (path: string): Promise<number> => {
    await page.goto(lawUrl(path));
    const text = (await page.locator('[data-directory-count], [data-index-count]').first().textContent()) ?? '';
    const match = text.match(/(\d+)/u);
    expect(match, `${path}: ${text}`).toBeTruthy();
    return Number(match![1]);
  };
  for (const [path, type] of [
    ['/gesetze/', 'gesetz'],
    ['/verordnungen/', 'verordnung'],
    ['/verwaltungsvorschriften/', 'verwaltungsvorschrift'],
    ['/foerderrichtlinien/', 'foerderrichtlinie'],
  ] as Array<[string, string]>) {
    const listed = await directoryCount(path);
    const found = await searchApi(request, `?type=${type}&versionScope=all&includeAmendments=1`);
    expect(found.total, `${path} gegen ?type=${type}`).toBe(listed);
  }
  // Herkunftsübersicht des A–Z (eine eigene A–Z-Gesamtseite gibt es nicht; die Übersicht zählt
  // den ganzen Bestand je Herkunftsart).
  await page.goto(lawUrl('/archiv/'));
  for (const origin of ['inherited-unchanged', 'ostdeutsch-original']) {
    const listed = Number((await page.locator(`[data-origin-overview] a[data-origin-kind="${origin}"] strong`).textContent()) ?? '');
    expect(listed, origin).toBeGreaterThan(0);
    const found = await searchApi(request, `?origin=${origin}&versionScope=all&includeAmendments=1`);
    expect(found.total, `/archiv/ gegen ?origin=${origin}`).toBe(listed);
  }
});

siteTest(['law'])('Rechtsänderung und Aktivität bleiben getrennt: ein Hinweis hebt lastmod, nicht die Sortierung', async ({ page, request }) => {
  const payload = await searchApi(request, '?includeAmendments=1&versionScope=current');
  const changeBySlug = new Map(payload.hits.filter((entry) => entry.isCurrent).map((entry) => [entry.slug, entry.lastChangeDate ?? '']));
  expect(changeBySlug.size).toBeGreaterThan(5);

  const sitemap = await (await request.get(lawUrl('/sitemap.xml'))).text();
  const lastmodBySlug = new Map<string, string>();
  for (const [, slug, lastmod] of sitemap.matchAll(/<loc>[^<]*\/norm\/([^/<]+)\/<\/loc><lastmod>([^<]+)<\/lastmod>/gu)) {
    lastmodBySlug.set(slug, lastmod);
  }
  expect(lastmodBySlug.size).toBeGreaterThan(5);

  // lastmod meint die zuletzt geänderte Darstellung und liegt nie vor der Rechtsänderung.
  const compared = [...changeBySlug].filter(([slug, change]) => change && lastmodBySlug.has(slug));
  expect(compared.length).toBeGreaterThan(5);
  for (const [slug, change] of compared) {
    expect((lastmodBySlug.get(slug) ?? '') >= change, `${slug}: lastmod ${lastmodBySlug.get(slug)} < Rechtsänderung ${change}`).toBeTruthy();
  }
  // Mindestens eine Vorschrift trägt einen reinen Hinweis: dort ist lastmod jünger als die
  // Rechtsänderung. Fielen beide Begriffe wieder zusammen, gäbe es diesen Fall nicht mehr.
  expect(compared.some(([slug, change]) => (lastmodBySlug.get(slug) ?? '') > change)).toBeTruthy();

  // Die Sortierung folgt der Rechtsänderung, nicht dem Hinweis.
  await page.goto(lawUrl('/suche/'));
  await searchSettled(page);
  await expect(page.locator('[data-search-summary]')).toContainText('jüngster Rechtsänderung');
  const dates = (await currentDocuments(request)).map((entry) => entry.lastChangeDate ?? '');
  expect(dates.every((date, index) => index === 0 || dates[index - 1] >= date)).toBeTruthy();
});

siteTest(['law'])('Der Kopf gibt stufenweise nach: zuerst die Navigationsliste, zuletzt die Suche', async ({ page }) => {
  // Zwischen kleinem und großem Desktop klappt nur die Navigationsliste zusammen; Wortmarke,
  // Suchfeld und Menüknopf bleiben sichtbar.
  const readHeader = async (width: number) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(lawUrl('/gesetze/'));
    return {
      wordmark: await page.locator('.law-wordmark').isVisible(),
      search: await page.locator('.law-header-search input').isVisible(),
      menu: await page.locator('.law-mobile-nav summary').isVisible(),
      navigation: await page.locator('.law-main-nav').isVisible(),
    };
  };

  const wide = await readHeader(1440);
  expect(wide, 'großer Desktop: volle Navigation ohne Menüknopf').toMatchObject({ wordmark: true, search: true, navigation: true, menu: false });

  for (const width of [1280, 1180, 1100, 1024]) {
    const header = await readHeader(width);
    expect(header, `Zwischenstufe bei ${width} px`).toMatchObject({ wordmark: true, search: true, menu: true, navigation: false });
  }

  // Erst auf dem kleinsten Bildschirm weicht auch die Suche in das Menü; erreichbar bleibt sie dort.
  const small = await readHeader(375);
  expect(small).toMatchObject({ wordmark: true, menu: true, search: false });
  await page.locator('.law-mobile-nav summary').click();
  await expect(page.locator('.law-mobile-nav__panel input')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
});

siteTest(['law'])('Fundstellen der Verkündungsblätter werden in der Rechtssuche erkannt', async ({ page, request }) => {
  const payload = await searchApi(request, '?versionScope=all&includeAmendments=1');
  const document = payload.hits.find((entry) => entry.publicationSource && entry.publicationIssue && entry.publication);
  expect(document, 'Vorschrift mit Fundstelle').toBeTruthy();
  const designation = document!.publication;
  const cited = await searchApi(request, `?q=${encodeURIComponent(designation)}`);
  // Die zitierte Ausgabe führt ihre Vorschriften an; die Ausgabe selbst steht als Direkttreffer darüber.
  expect(cited.total, designation).toBeGreaterThan(0);
  expect(cited.hits.some((hit) => hit.slug === document!.slug), designation).toBe(true);
  await page.goto(lawUrl(`/suche/?q=${encodeURIComponent(designation)}`));
  await searchSettled(page);
  await expect(page.locator('[data-search-results] .search-hit').first()).toBeVisible();
  await expect(page.locator('[data-search-results]')).toContainText(new RegExp(designation.replaceAll('.', '\\.'), 'u'));
});

siteTest(['law'])('A–Z filtert serverseitig je Buchstabe, paginiert und führt Abkürzungen und Kurztitel getrennt', async ({ page, request }) => {
  // Die alte Adresse bleibt erreichbar und führt mit ihrem Zustand auf den neuen Weg.
  const moved = await request.get(lawUrl('/archiv/?buchstabe=G&herkunft=inherited-unchanged'), { maxRedirects: 0 });
  expect(moved.status()).toBe(301);
  expect(moved.headers().location).toContain('/a-z/?buchstabe=G&herkunft=inherited-unchanged');

  await page.goto(lawUrl('/a-z/'));
  await expect(page.locator('.letter-nav a[aria-current="page"]')).toHaveText('A');
  expect(await page.locator('[data-index-list] li').count()).toBeGreaterThan(0);
  expect(await page.locator('[data-index-list] li').count()).toBeLessThanOrEqual(50);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/a-z\/\?buchstabe=A$/u);

  // Buchstabenwechsel über die URL (ohne JavaScript nutzbar): nur Vorschriften dieser Gruppe.
  // Verglichen wird die Buchstabengruppe des Eintrags, nicht sein Titelanfang – die Einordnung
  // folgt dem Ordnungswort.
  const letterLinks = page.locator('.letter-nav a[data-index-letter]:not([data-index-letter=""]):not([aria-current="page"])');
  const letter = (await letterLinks.first().getAttribute('data-index-letter')) ?? 'B';
  await letterLinks.first().click();
  await expect(page).toHaveURL(new RegExp(`buchstabe=${letter}`, 'u'));
  await expect(page.locator('.letter-nav a[aria-current="page"]')).toHaveText(letter);
  const groups = await page.locator('[data-index-list] li').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.indexLetter));
  expect(groups.length).toBeGreaterThan(0);
  expect(groups.every((group) => group === letter)).toBe(true);

  // Abkürzungen und Kurztitel: serverseitig gefiltert (GET) und lokal auf der geladenen Seite filterbar.
  let keyword = '';
  let keywordLetter = letter;
  for (const candidate of [letter, ...(await page.locator('.letter-nav a[data-index-letter]:not([data-index-letter=""])').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-index-letter') ?? '')))]) {
    await page.goto(lawUrl(`/a-z/?buchstabe=${candidate}`));
    const first = page.locator('[data-index-entry] > strong').first();
    if (await first.count() === 0) continue;
    keyword = ((await first.textContent()) ?? '').trim();
    keywordLetter = candidate;
    if (keyword.length > 2) break;
  }
  expect(keyword.length, 'Buchstabengruppe mit Abkürzungen und Kurztiteln').toBeGreaterThan(2);
  await page.goto(lawUrl(`/a-z/?buchstabe=${keywordLetter}&abkuerzung=${encodeURIComponent(keyword)}`));
  // Verglichen wird der gelesene Parameter, nicht die Schreibweise der Adresse: das Formular
  // schreibt Leerzeichen als `+`, eine gebaute Adresse als `%20`.
  await expect.poll(() => new URL(page.url()).searchParams.get('abkuerzung')).toBe(keyword);
  const entries = page.locator('[data-index-entry]');
  expect(await entries.count()).toBeGreaterThan(0);
  expect(await entries.count()).toBeLessThanOrEqual(100);
  await expect(page.locator('[data-index-filter-status]')).toContainText(`passen zu „${keyword}“`);
  await page.locator('[data-index-filter]').fill(keyword);
  await expect(page.locator('[data-index-filter-status]')).toContainText('dieser Seite');
  expect(await entries.evaluateAll((nodes) => nodes.filter((node) => !(node as HTMLElement).hidden).length)).toBeGreaterThan(0);
  await page.locator('[data-keyword-filter-form] button[type="submit"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('abkuerzung')).toBe(keyword);
  await expect(page.locator('[data-index-filter-status]')).toContainText(`passen zu „${keyword}“`);

  // Das Stichwortregister ist ein eigener Abschnitt mit eigenem Zustand; es darf leer sein.
  await expect(page.locator('[data-register-count]')).toBeVisible();

  // Ungültige Seiten fallen auf die letzte vorhandene Seite zurück, ohne Fehler.
  const response = await page.goto(lawUrl('/a-z/?buchstabe=A&seite=999'));
  expect(response?.status()).toBe(200);
  await expect(page.locator('[data-index-count]')).toContainText(/\d+ Vorschrift/u);
});

siteTest(['law'])('Standardsuche findet geltende Vorschriften über Titel und Abkürzung und kennzeichnet ihre Herkunft', async ({ page, request }) => {
  // Bezeichnungen sind im Bestand nicht eindeutig (gleichnamige Änderungsvorschriften, geteilte
  // Kurztitel); geprüft wird die Priorität einer eindeutigen Abkürzung bzw. eines eindeutigen Kurztitels.
  const all = await suggestions(request);
  const count = (values: string[]) => values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>());
  const abbrCounts = count(all.map((entry) => entry.abbr));
  const shortTitleCounts = count(all.map((entry) => entry.shortTitle));
  // Gesucht wird nur nach Vorschriften mit geltender Fassung: die Autovervollständigung führt
  // auch künftig geltende Vorschriften, die die Standardsuche (Fassungsfilter „geltend“) nicht
  // zeigt. Die Eindeutigkeit wird weiter über den gesamten Bestand gezählt.
  const current = await currentDocuments(request);
  const unique = current.filter((entry) => entry.abbr && /^[A-Za-zÄÖÜäöü][\wÄÖÜäöüß-]{3,}$/u.test(entry.abbr) && abbrCounts.get(entry.abbr) === 1 && shortTitleCounts.get(entry.shortTitle) === 1);
  const known = [...unique.filter((entry) => entry.typeLabel === 'Gesetz'), ...unique.filter((entry) => entry.typeLabel !== 'Gesetz')].slice(0, 4);
  expect(known.length).toBeGreaterThan(0);
  const queries = known.flatMap((entry) => [[entry.abbr, entry], [entry.shortTitle, entry]] as const);
  for (const [query, entry] of queries) {
    await page.goto(lawUrl(`/suche/?q=${encodeURIComponent(query)}`));
    await searchSettled(page);
    await expect(page.locator('select[name="versionScope"]'), query).toHaveValue('current');
    const hits = page.locator('[data-search-results] .search-hit');
    await expect(hits.first(), query).toBeVisible();
    await expect(page.locator('[data-search-results] .search-hit .search-hit__title').first(), query).toContainText(entry.title);
    // Die Fassungspille erscheint nur, wenn sie vom aktiven Fassungsfilter abweicht.
    await expect(hits.first().locator('.status-badge'), query).toHaveCount(0);
    // Die Metazeile bleibt einzeilig: Normtyp und – je nach Herkunft – Herkunftszeichen oder Fundstelle.
    const metaLine = hits.first().locator('.search-hit__meta-line');
    await expect(metaLine.locator('.law-type-label'), query).toBeVisible();
    const marker = entry.origin === 'inherited-unchanged' ? '.search-hit__publication' : '.origin-badge';
    await expect(metaLine.locator(marker), `${query} (${entry.origin})`).toBeVisible();
  }

  // Herkunftsfacet und Kandidaten-API arbeiten mit derselben Herkunftssemantik: der Leerzustand
  // wird für eine Anfrage geprüft, für die die API selbst keine übernommene Norm liefert.
  const originals = (await currentDocuments(request, '&origin=ostdeutsch-original')).filter((entry) => entry.abbr && abbrCounts.get(entry.abbr) === 1);
  expect(originals.length, 'geltende Norm ostdeutscher Herkunft mit eindeutiger Abkürzung').toBeGreaterThan(0);
  const original = originals[0];
  await page.goto(lawUrl(`/suche/?q=${encodeURIComponent(original.abbr)}&versionScope=all`));
  await searchSettled(page);
  await expect(page.locator('[data-search-results] .search-hit .status-badge').first()).toContainText(/Geltende Fassung/u);
  await page.goto(lawUrl(`/suche/?q=${encodeURIComponent(original.abbr)}&origin=ostdeutsch-original`));
  await searchSettled(page);
  await expect(page.locator('[data-search-results] .search-hit').first()).toBeVisible();
  // In der Trefferliste steht das Herkunftszeichen in der kompakten Listenform; die ausführliche
  // Bedeutung trägt es als Titel.
  await expect(page.locator('[data-search-results] .search-hit .origin-badge').first()).toContainText('Ostdeutsch neu');
  await expect(page.locator('[data-search-results] .search-hit .origin-badge').first()).toHaveAttribute('title', /Freistaat Ostdeutschland geschaffen/u);
  let emptyQuery: string | undefined;
  for (const candidate of originals.slice(0, 5)) {
    if ((await searchApi(request, `?q=${encodeURIComponent(candidate.abbr)}&origin=inherited-unchanged`)).total === 0) {
      emptyQuery = candidate.abbr;
      break;
    }
  }
  if (emptyQuery) {
    await page.goto(lawUrl(`/suche/?q=${encodeURIComponent(emptyQuery)}&origin=inherited-unchanged`));
    await searchSettled(page);
    await expect(page.locator('[data-search-summary]')).toContainText('Keine Treffer');
    // Echter Leerzustand: Überschrift, zitierte Anfrage und Auswege mit Filterzahl.
    await expect(page.locator('[data-search-empty] h3')).toHaveText('Keine Vorschrift gefunden');
    await expect(page.locator('[data-search-empty]')).toContainText(`„${emptyQuery}“`);
    await expect(page.locator('[data-search-empty-clear]')).toContainText('(1)');
    await page.locator('[data-search-empty-clear]').click();
    await expect(page).not.toHaveURL(/origin=/u);
    await expect(page.locator('[data-search-results] .search-hit').first()).toBeVisible();
  }

  const filtered = await searchApi(request, '?q=Gesetz&origin=inherited-amended');
  expect(filtered.query.origins).toEqual(['inherited-amended']);
  expect(filtered.total).toBeGreaterThan(0);
  expect(filtered.hits.length).toBeGreaterThan(0);
  expect(filtered.hits.length).toBeLessThanOrEqual(filtered.total);
  expect(filtered.hits.every((entry) => entry.origin === 'inherited-amended')).toBe(true);
  const unfiltered = await searchApi(request, '?q=Gesetz');
  expect(unfiltered.total).toBeGreaterThan(filtered.total);
  const ignored = await searchApi(request, '?q=Gesetz&origin=bogus');
  expect(ignored.query.origins).toEqual([]);
  expect(ignored.total).toBe(unfiltered.total);
  // Autovervollständigung kennt jedes geltende Gesetz.
  const suggested = new Set((await suggestions(request)).map((entry) => entry.slug));
  for (const law of await currentDocuments(request, '&type=gesetz')) expect(suggested.has(law.slug), law.slug).toBe(true);
});

siteTest(['law'])('Normseiten zeigen Rechtsstand und Herkunft in einem gemeinsamen Hinweis', async ({ page, request }) => {
  const [original] = await currentDocuments(request, '&origin=ostdeutsch-original&type=gesetz&status=in-force');
  expect(original, 'geltendes Gesetz ostdeutscher Herkunft').toBeTruthy();
  await page.goto(lawUrl(original.currentUrl));
  const panel = await openNormFacts(page);
  await expect(panel.getByRole('heading', { name: 'Vorschriftendaten' })).toBeVisible();
  await expect(panel.locator('.origin-badge')).toHaveText(/Ostdeutsch neu geschaffen/u);
  await expect(panel).toContainText(`Geltende Fassung, gültig ab ${formatGermanDate(original.validFrom)}`);
  await expect(panel).toContainText(`Rechtsstand vom ${formatGermanDate(editorialReferenceDate())}`);
  await expect(panel).not.toContainText('Stichtag');
  await expect(page.locator('.norm-page-header__status')).toContainText('in Kraft seit');
  await expect(page.locator('.status-notice')).toHaveCount(0);

  const amended = await currentNormOfOrigin(request, 'inherited-amended');
  await page.goto(lawUrl(amended.currentUrl));
  const amendedPanel = await openNormFacts(page);
  await expect(amendedPanel.locator('.origin-badge')).toHaveText(/Übernommen und ostdeutsch geändert/u);
  // Änderungsvorschriften stehen mit Titel und Datum, nicht als unbeschrifteter Verweis.
  await expect(amendedPanel).toContainText('Änderungsvorschriften');
  const amendmentLink = amendedPanel.locator('.norm-facts__changes a').first();
  await expect(amendmentLink).toBeVisible();
  await expect(amendmentLink).toHaveAttribute('href', /^\/norm\//u);
  await expect(amendedPanel.getByRole('link', { name: new RegExp(`Ausgangsfassung vom ${formatGermanDate(LEGAL_BASELINE_DATE)}`, 'u') })).toBeVisible();
  await expect(amendedPanel.getByRole('link', { name: 'Mit Ausgangsrecht vergleichen' })).toBeVisible();

  await page.goto(lawUrl(`/norm/${amended.slug}/version/${LEGAL_BASELINE_DATE}/`));
  const baseline = await openNormFacts(page);
  await expect(baseline).toContainText('Historische Fassung');
  await expect(baseline).toContainText('übernommene sächsische Ausgangsrechtsstand');
  await expect(baseline.getByRole('link', { name: 'Amtliche sächsische Quelle' })).toBeVisible();
});

siteTest(['law'])('A–Z bietet Herkunftsfilter und -übersicht und hält den Buchstabenwechsel im Filter', async ({ page }) => {
  await page.goto(lawUrl('/a-z/'));
  const overview = page.locator('[data-origin-overview] a');
  expect(await overview.count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator('[data-index-list] .origin-badge').first()).toBeVisible();
  await overview.filter({ hasText: 'Übernommen · unverändert' }).click();
  await expect(page).toHaveURL(/herkunft=inherited-unchanged/u);
  await expect(page.locator('select[name="herkunft"]')).toHaveValue('inherited-unchanged');
  // Die Buchstabenleiste zählt den gesamten Bestand; unter dem Herkunftsfilter kann eine Gruppe
  // leer sein. Geprüft wird die erste Gruppe, die Vorschriften dieser Herkunft führt.
  const groups = await page.locator('.letter-nav a[data-index-letter]:not([data-index-letter=""])').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-index-letter') ?? ''));
  let filledLetter = '';
  for (const candidate of groups) {
    await page.goto(lawUrl(`/a-z/?buchstabe=${candidate}&herkunft=inherited-unchanged`));
    if (await page.locator('[data-index-list] li').count() > 0) { filledLetter = candidate; break; }
  }
  expect(filledLetter, 'Buchstabengruppe mit übernommenen, unveränderten Vorschriften').not.toBe('');
  const origins = await page.locator('[data-index-list] li').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.origin));
  expect(origins.length).toBeGreaterThan(0);
  expect(origins.every((origin) => origin === 'inherited-unchanged')).toBe(true);
  const letterLink = page.locator('.letter-nav a[data-index-letter]:not([data-index-letter=""]):not([aria-current="page"])').first();
  const letter = await letterLink.getAttribute('data-index-letter');
  await letterLink.click();
  await expect(page).toHaveURL(new RegExp(`buchstabe=${letter}`, 'u'));
  await expect(page).toHaveURL(/herkunft=inherited-unchanged/u);
});

siteTest(['law'])('A–Z hält Vorschriften- und Abkürzungsseite unabhängig (mehrseitige Buchstabengruppe)', async ({ page }) => {
  // Zwei gleichzeitig paginierte Dimensionen gibt es erst ab 50 Vorschriften und 50 Einträgen je
  // Buchstabe – also nur mit dem Vollbestand. Ohne zweite Seite wird übersprungen statt geraten.
  await page.goto(lawUrl('/a-z/?buchstabe=G'));
  const indexPages = await page.locator('[data-index-pagination] a[aria-label^="Seite "]').count();
  const keywordPages = await page.locator('[data-keyword-pagination] a[aria-label^="Seite "]').count();
  test.skip(indexPages < 2 || keywordPages < 2, `Buchstabe G hat ${indexPages} Vorschriften- und ${keywordPages} Abkürzungsseiten; die Unabhängigkeit beider Paginierungen wird mit dem Vollbestand geprüft.`);

  // Beide Paginierungen derselben Seite behalten den jeweils anderen Zustand.
  await page.goto(lawUrl('/a-z/?buchstabe=G&seite=2&abkuerzungsseite=2'));
  await expect(page.locator('[data-index-pagination] a[aria-current="page"]')).toHaveText('2');
  await expect(page.locator('[data-keyword-pagination] a[aria-current="page"]')).toHaveText('2');
  const normLinks = await page.locator('[data-index-pagination] a[href]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).getAttribute('href') ?? ''));
  expect(normLinks.length).toBeGreaterThan(0);
  expect(normLinks.every((href) => href.includes('abkuerzungsseite=2'))).toBe(true);
  const keywordLinks = await page.locator('[data-keyword-pagination] a[href]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).getAttribute('href') ?? ''));
  expect(keywordLinks.length).toBeGreaterThan(0);
  expect(keywordLinks.every((href) => /[?&]seite=2/u.test(href))).toBe(true);
  await page.locator('[data-keyword-pagination] a[rel], [data-keyword-pagination] a').filter({ hasText: 'Nächste Einträge' }).click();
  await expect(page).toHaveURL(/seite=2/u);
  await expect(page).toHaveURL(/abkuerzungsseite=3/u);
  await expect(page.locator('[data-index-pagination] a[aria-current="page"]')).toHaveText('2');
  await page.goBack();
  await expect(page).toHaveURL(/abkuerzungsseite=2/u);
  await expect(page.locator('[data-keyword-pagination] a[aria-current="page"]')).toHaveText('2');
});

siteTest(['law'])('Rechtsentwicklung und Fundstellen bleiben als Adressen gültig und führen an ihren neuen Ort', async ({ request }) => {
  const redirects = [
    ['/rechtsentwicklung/', '/suche/'],
    ['/rechtsentwicklung/?origin=inherited-amended', '/suche/?origin=inherited-amended'],
    ['/fundstellen/', '/verkuendungen/?ansicht=eintraege'],
    ['/fundstellen/?year=2026', '/verkuendungen/?ansicht=eintraege&year=2026'],
  ];
  for (const [source, target] of redirects) {
    const response = await request.get(lawUrl(source), { maxRedirects: 0 });
    expect(response.status(), source).toBe(301);
    expect(response.headers().location, source).toBe(target);
  }
});

siteTest(['law'])('Verkündungen führen Ausgaben und Einträge in einer Seite mit Ansichtswechsel', async ({ page }) => {
  await page.goto(lawUrl('/verkuendungen/'));
  const viewSwitch = page.getByRole('navigation', { name: 'Ansicht' });
  await expect(viewSwitch.locator('a[aria-current="page"]')).toHaveText('Ausgaben');
  await expect(page.locator('[data-directory-count]')).toContainText(/Ausgabe/u);
  const issueDates = await page.locator('[data-directory-entry] .directory-entry__lead time').evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute('datetime') ?? ''));
  expect(issueDates.length).toBeGreaterThan(0);
  expect([...issueDates].sort().reverse(), 'Ausgaben stehen mit der jüngsten zuerst').toEqual(issueDates);

  await viewSwitch.locator('a[data-view="eintraege"]').click();
  await expect(page).toHaveURL(/ansicht=eintraege/u);
  await expect(viewSwitch.locator('a[aria-current="page"]')).toHaveText('Einträge');
  await expect(page.locator('[data-directory-count]')).toContainText(/Eintrag|Einträge/u);
  const entryDates = await page.locator('[data-directory-entry] .directory-entry__lead time').evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute('datetime') ?? ''));
  expect(entryDates.length).toBeGreaterThan(0);
  expect(entryDates.length).toBeLessThanOrEqual(50);
  expect([...entryDates].sort().reverse(), 'Einträge stehen mit der jüngsten Ausgabe zuerst').toEqual(entryDates);

  // Der Filter bleibt in der Ansicht: die Auswahl führt nicht zurück auf die Ausgabenliste.
  await page.locator('[data-directory-filter] select[name="publication"]').selectOption({ index: 1 });
  await expect(page).toHaveURL(/ansicht=eintraege/u);
  await expect(viewSwitch.locator('a[aria-current="page"]')).toHaveText('Einträge');
  await expect(page.locator('[data-directory-reset]')).not.toHaveAttribute('aria-disabled', 'true');
});

siteTest(['law'])('Förderrichtlinien sind nach Förderbereichen gegliedert und über Sprungziele erreichbar', async ({ page }) => {
  await page.goto(lawUrl('/foerderrichtlinien/'));
  const sections = page.locator('[data-funding-section]');
  const sectionCount = await sections.count();
  expect(sectionCount).toBeGreaterThan(0);
  await expect(page.locator('.letter-nav')).toHaveCount(0);

  const areas = await page.locator('[data-funding-link]').evaluateAll(
    (nodes) => nodes.map((node) => (node as HTMLElement).dataset.fundingLink ?? ''));
  expect(areas.length).toBe(sectionCount);
  for (const area of areas) {
    await expect(page.locator(`[data-funding-section="${area}"]`), area).toHaveCount(1);
  }

  // Ein Förderbereich lässt sich als Auswahl eingrenzen; die Adresse trägt sie.
  await page.locator('[data-directory-filter] select[name="bereich"]').selectOption(areas[0]);
  await expect(page).toHaveURL(new RegExp(`bereich=${areas[0]}`, 'u'));
  await expect(page.locator('[data-funding-section]')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/u);
});

siteTest(['law'])('unbekannte OstRecht-Pfade liefern die eigene deutsche Fehlerseite mit Status 404', async ({ page, request }) => {
  for (const path of ['/gibt-es-nicht/', '/norm/gibt-es-nicht/', '/verkuendungen/gibt-es-nicht/', '/sachgebiete/gibt-es-nicht/']) {
    const response = await request.get(lawUrl(path));
    expect(response.status(), path).toBe(404);
    const html = await response.text();
    expect(html, path).toContain('<html lang="de"');
    expect(html, path).toContain('Seite nicht gefunden');
    expect(html, path).not.toContain('404: Not Found');
  }
  const response = await page.goto(lawUrl('/norm/gibt-es-nicht/'));
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seite nicht gefunden');
  await expect(page.getByRole('link', { name: 'Zur Rechtssuche' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/u);
});

siteTest(['law'])('Fassung als PDF wird im Worker erzeugt und für unbekannte Fassungen mit 404 beantwortet', async ({ request }) => {
  const norm = await multiVersionNorm(request);
  // Der dritte Durchgang wiederholt die geltende Fassung und wird aus dem Randzwischenspeicher beantwortet.
  for (const version of [norm.current, norm.historical, norm.current]) {
    const path = `/norm/${norm.slug}/version/${version.versionId}/fassung.pdf`;
    const response = await withWorkerRecovery(request, () => request.get(lawUrl(path)));
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toMatch(/^application\/pdf/u);
    expect(response.headers()['content-disposition'], path).toContain(`${norm.slug}-${version.versionId}.pdf`);
    expect(response.headers()['x-robots-tag'], path).toContain('noindex');
    const body = await response.body();
    expect(body.subarray(0, 5).toString('latin1'), path).toBe('%PDF-');
    expect(body.subarray(-5).toString('latin1'), path).toBe('%%EOF');
  }

  const missing = await request.get(lawUrl(`/norm/${norm.slug}/version/gibt-es-nicht/fassung.pdf`));
  expect(missing.status()).toBe(404);
});
