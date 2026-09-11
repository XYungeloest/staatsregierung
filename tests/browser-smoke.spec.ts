import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { legacyRoutes } from '../apps/portal/src/config/legacy-routes.mjs';
import { lawPaths } from '../packages/shared/src/config/site-routing.ts';
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
  await expect(page.getByRole('heading', { name: 'Bereiche des Staatsportals' })).toBeVisible();
  await expect(page.locator('#error-search')).toBeVisible();
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

  await page.goto('/suche/?q=Gesetz&bereich=law');
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
  await expect(page.locator('[data-kreisreform-table-status]')).toContainText('gefunden');

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

  await expect(status).toContainText('Geben Sie einen Begriff ein');
  await expect(noResults).toBeHidden();
  await expect(error).toBeHidden();

  await input.fill('Kreisreform');
  await expect(status).toContainText('Treffer für „Kreisreform“');
  await expect(page.locator('[data-portal-search-groups] .search-hit')).not.toHaveCount(0);
  await expect(noResults).toBeHidden();
  await expect(error).toBeHidden();

  await input.fill('zzzznichtvorhanden');
  await expect(status).toContainText('Keine Treffer für');
  await expect(page.locator('[data-portal-search-groups] .search-hit')).toHaveCount(0);
  await expect(noResults).toBeVisible();
  await expect(error).toBeHidden();
});

/**
 * Der Rechtsindex wird nachgeladen. Fällt er aus, muss die Seite bedienbar bleiben: genau eine
 * Anfrage, kein selbsttätiger Neuversuch, Portaltreffer unverändert sichtbar und eine Meldung in
 * der Gruppe „Recht“. Vorher stieß jedes Rendern eine neue Anfrage an, und der Reiter blieb in
 * einer Microtask-Schleife stehen.
 */
async function withLawIndex(page: Page, handler: (route: import('@playwright/test').Route) => unknown): Promise<() => number> {
  let calls = 0;
  await page.route('**/search-index-recht.json', (route) => {
    calls += 1;
    return handler(route);
  });
  return () => calls;
}

siteTest(['portal'])('Portalsuche: ein Ausfall des Rechtsindex hält die Seite bedienbar', async ({ page }) => {
  await prepareFunctionalPage(page);
  const calls = await withLawIndex(page, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  await page.goto('/suche/?q=Kreisreform');

  const lawGroup = page.locator('[data-portal-search-law-status="error"]');
  await expect(lawGroup).toBeVisible();
  await expect(lawGroup).toContainText('konnte nicht geladen werden');
  // Portaltreffer bleiben vollständig, der Fehlerkasten der Seite gilt nur dem Portalindex.
  await expect(page.locator('[data-portal-search-groups] .search-hit')).not.toHaveCount(0);
  await expect(page.locator('[data-portal-search-error]')).toBeHidden();
  await expect(page.locator('[data-portal-search-root]')).toHaveAttribute('data-law-status', 'error');
  expect(calls()).toBe(1);

  // Lebendigkeitsnachweis: eine neue Eingabe wird verarbeitet (gegen den alten Stand lief hier
  // die Zeitschranke ab) und löst keine zweite Anfrage aus.
  await page.locator('[data-portal-search-query]').fill('Haushalt');
  await expect(page.locator('[data-portal-search-status]')).toContainText('Haushalt', { timeout: 5_000 });
  expect(calls()).toBe(1);

  // Auch das Aus- und Einschalten des Bereichs wiederholt die Anfrage nicht.
  await page.locator('[data-portal-search-area]').selectOption('portal');
  await expect(page.locator('[data-portal-search-law-status]')).toHaveCount(0);
  await page.locator('[data-portal-search-area]').selectOption('');
  await expect(page.locator('[data-portal-search-law-status="error"]')).toBeVisible();
  expect(calls()).toBe(1);
});

siteTest(['portal'])('Portalsuche: ein Netzwerkfehler des Rechtsindex endet im selben Zustand', async ({ page }) => {
  await prepareFunctionalPage(page);
  const calls = await withLawIndex(page, (route) => route.abort('failed'));
  await page.goto('/suche/?q=Kreisreform');

  await expect(page.locator('[data-portal-search-law-status="error"]')).toBeVisible();
  await expect(page.locator('[data-portal-search-groups] .search-hit')).not.toHaveCount(0);
  expect(calls()).toBe(1);
});

siteTest(['portal'])('Portalsuche: ein leerer Rechtsbestand ist geladen, kein Fehler', async ({ page }) => {
  await prepareFunctionalPage(page);
  const calls = await withLawIndex(page, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ origin: 'https://recht.example', entries: [] }) }));
  await page.goto('/suche/?q=Kreisreform');

  await expect(page.locator('[data-portal-search-root]')).toHaveAttribute('data-law-status', 'loaded');
  await expect(page.locator('[data-portal-search-law-status]')).toHaveCount(0);
  await expect(page.locator('[data-portal-search-groups] .search-hit')).not.toHaveCount(0);
  await expect(page.locator('[data-portal-search-status]')).not.toContainText('werden geladen');
  expect(calls()).toBe(1);

  // Ohne Portaltreffer bleibt die allgemeine Leermeldung zuständig – nicht der Fehlerzustand.
  await page.locator('[data-portal-search-query]').fill('zzzznichtvorhanden');
  await expect(page.locator('[data-portal-search-empty]')).toBeVisible();
  await expect(page.locator('[data-portal-search-law-status="error"]')).toHaveCount(0);
  expect(calls()).toBe(1);
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

  // Die Suche ist ein Bereich mit sichtbarer H1; sie benennt ihn.
  await expect(page.getByLabel('Suche im Landesrecht').getByRole('button', { name: 'Suchen' })).toBeVisible();
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
  // Das Hauptsuchfeld bietet Vorschläge, sobald es mit mindestens zwei Zeichen den Fokus erhält;
  // Escape schließt die Liste, die Trefferliste bleibt.
  const mainQuery = page.locator('[data-search-query]');
  await mainQuery.focus();
  await expect(page.getByRole('listbox', { name: 'Vorschlagsliste für Normen' })).toBeVisible();
  await mainQuery.press('Escape');
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

  const filterWord = searchWordOf((await page.locator('[data-directory-entry] a').first().textContent()) ?? '');
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
    const entries = await page.locator('[data-directory-entry]').count();
    expect(entries, path).toBeGreaterThan(0);
    // Seitenweise Verzeichnisse zeigen höchstens eine Seite. Die Förderrichtlinien sind statt
    // dessen nach den amtlichen Förderbereichen gegliedert: sie führen alle Einträge, aber in
    // benannten Abschnitten mit Sprungzielen.
    if (path === '/foerderrichtlinien/') {
      expect(await page.locator('[data-funding-section]').count(), path).toBeGreaterThan(0);
      const outside = await page.locator('[data-directory-entry]:not([data-funding-section] [data-directory-entry])').count();
      expect(outside, `${path}: Einträge außerhalb eines Förderbereichs`).toBe(0);
    } else {
      expect(entries, path).toBeLessThanOrEqual(50);
    }
  }
});

/**
 * Die Vorschriftendaten sind unterhalb von 80 rem ein Aufklappbereich (NormFacts.astro klappt sie
 * beim Laden zu). Die Prüfungen öffnen ihn wie eine Leserin, statt eine Bildschirmbreite anzunehmen.
 */
async function openNormFacts(page: Page): Promise<Locator> {
  await page.locator('[data-norm-tab="facts"]').click();
  const facts = page.locator('[data-visual-section="norm-facts"]');
  await expect(facts).toHaveCount(1);
  await facts.scrollIntoViewIfNeeded();
  return facts;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

siteTest(['law'])('Fassungstitel, Gültigkeitsdaten und Rechtsereignisse folgen dem redaktionellen Stichtag', async ({ page, request }) => {
  const referenceDate = editorialReferenceDate();
  const norm = await multiVersionNorm(request);
  await page.goto(lawUrl(norm.historical.url));
  // Die Überschrift beginnt mit dem Kurztitel, wenn er vom Langtitel abweicht (getNormTitleBlock);
  // Langtitel und Abkürzung folgen in Klammern (Richtung E, Vorschriftskopf).
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(new RegExp(`^${escapeRegExp(norm.historical.shortTitle || norm.historical.title)}(?: \\(|$)`, 'u'));
  const facts = await openNormFacts(page);
  await expect(facts).toContainText(formatGermanDate(norm.historical.validFrom));
  if (norm.historical.validTo) await expect(facts).toContainText(formatGermanDate(norm.historical.validTo));

  await page.goto(lawUrl(norm.current.currentUrl));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(new RegExp(`^${escapeRegExp(norm.current.shortTitle || norm.current.title)}(?: \\(|$)`, 'u'));

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
  // Die Liste zeigt Rechtsereignisse, nicht geltende Fassungen: eine am Stichtag verkündete, erst
  // danach wirksame Vorschrift ist das jüngste Ereignis, ohne geltend zu sein (getNormLastChangeDate
  // zählt Historieneinträge bis zum Stichtag). Verglichen wird deshalb mit dem jüngsten Ereignis des
  // Bestands, nicht mit der jüngsten geltenden Fassung.
  const newestEvent = (await searchApi(request, '?versionScope=all')).hits
    .map((hit) => hit.lastChangeDate)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
  expect(currentDates[0]).toBe(newestEvent);
  const currentLinks = await currentEntries.locator('a[href^="/norm/"]:not([href*="history"])').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(new Set(currentLinks).size).toBe(currentLinks.length);
  const futureDates = await page
    .locator('[data-law-future-change-list] [data-law-change]:visible')
    .evaluateAll((entries) => entries
      .map((entry) => entry.getAttribute('data-effective-date'))
      .filter((date): date is string => Boolean(date)));
  expect(futureDates.every((date) => date > referenceDate)).toBeTruthy();
});

siteTest(['law'])('Einstiegssuchen und Hauptsuche bieten Normvorschläge', async ({ page, request }) => {
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
  await expect(page.getByRole('listbox', { name: 'Vorschlagsliste für Normen' })).toBeVisible();
  await mainQuery.press('Escape');
  await expect(page.locator('[data-search-results] .search-hit').first()).toContainText(suggestion!.title);
});

siteTest(['law'])('Normkopf unterscheidet allgemeinen und fassungsspezifischen Link und kennzeichnet Staatsportal-Bezüge', async ({ page, request }) => {
  const [relatedSlug] = fixtureSlugsWithRole('portal-relations');
  expect(relatedSlug, 'Fixture-Rolle portal-relations').toBeTruthy();
  const relatedResponse = await page.goto(lawUrl(`/norm/${relatedSlug}/`));
  // Die Rolle beschreibt eine Vorschrift des synthetischen Testbestands; gegen den Vollbestand
  // gibt es sie nicht.
  test.skip(relatedResponse?.status() === 404, `Der laufende Bestand führt ${relatedSlug} nicht.`);
  const facts = await openNormFacts(page);
  await expect(facts).toContainText('Vollzitat');
  await expect(facts).toContainText('Rechtsstand');
  await expect(facts.getByRole('button', { name: 'Vollzitat kopieren' })).toBeVisible();
  await expect(facts.getByRole('button', { name: 'Link zur Vorschrift kopieren' })).toBeVisible();
  // Jede Angabe steht genau einmal: die abgelösten Blöcke gibt es nicht mehr.
  await expect(page.locator('[data-visual-section="norm-legal-status"], [data-visual-section="norm-citation-status"], [data-visual-section="norm-metadata"]')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Werkzeuge zur Vorschrift' })).toHaveCount(1);

  await page.locator('[data-norm-tab="relations"]').click();
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
  // Der Fuß wiederholt die Recherchewege nicht; er schließt mit Hilfe, rechtlichen Hinweisen und
  // dem Staatsportal ab. Die Recherchewege stehen im Menü „Bereiche“ darüber.
  await expect(page.locator('.law-footer').getByRole('navigation', { name: 'Service' }).getByRole('link')).not.toHaveCount(0);
  // Normtypen bleiben sekundär von jeder Seite erreichbar: im Menü „Bereiche“ und im Fuß.
  await expect(mobileNavigation.getByRole('link', { name: 'Gesetze', exact: true })).toBeVisible();
  await expect(page.locator('.law-footer').getByRole('navigation', { name: 'Recherchieren' }).getByRole('link', { name: 'Förderrichtlinien' })).toHaveCount(1);
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
  const tableResponse = await page.goto(lawUrl(`/norm/${tableSlug}/`));
  test.skip(tableResponse?.status() === 404, `Der laufende Bestand führt ${tableSlug} nicht.`);

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
  // Die Startseite führt die neuesten Veröffentlichungen als Tabelle; die erste Zeile gehört zur jüngsten Ausgabe.
  await expect(page.locator('.r-home-publications__table tbody tr').first()).toContainText(latestPublicationLabel);

  await page.goto(lawUrl('/verkuendungen/'));
  await expect(page.locator('[data-directory-entry]').first()).toContainText(latestPublicationLabel);

  expect((await publicationIndex(request)).latestPublication).toEqual(latestPublication);
});

siteTest(['law'])('Normtext bietet stabile Anker, Fassungszeitleiste und zugängliche Textwerkzeuge', async ({ page, request }) => {
  const norm = await multiVersionNorm(request);
  await page.goto(lawUrl(norm.current.currentUrl));

  // Fassungen dieser Vorschrift stehen als Zeitleiste in der Seitenspalte; die angezeigte Fassung
  // ist markiert, jede andere Fassung verlinkt (Richtung E: Fassungswahl lokal an der Vorschrift).
  const versions = page.locator('[data-visual-section="norm-versions"]');
  await expect(versions).toBeVisible();
  await expect(versions.locator('.norm-timeline__entry--shown .norm-timeline__date')).toHaveAttribute('aria-current', 'page');
  await expect(versions.locator('.norm-timeline__entry--historical a').first()).toHaveAttribute('href', new RegExp(`/norm/${norm.slug}/version/`, 'u'));
  await expect(versions.getByRole('link', { name: 'Fassungen und Änderungen' })).toHaveAttribute('href', `/norm/${norm.slug}/history/`);

  const firstUnit = page.locator('.norm-unit[data-norm-unit]').first();
  await expect(firstUnit).toHaveAttribute('id', /^paragraph-|^artikel-/u);
  const semanticId = await firstUnit.getAttribute('id');
  expect(semanticId).toBeTruthy();
  await expect(firstUnit.locator('.legacy-anchor')).toHaveAttribute('id', /^block-/u);
  // Die Überschrift der Einheit ist eine echte Überschrift; der Text bleibt ein durchgehendes
  // Dokument ohne Ein- oder Ausklappfunktion.
  await expect(firstUnit.locator('.norm-unit__head [id]').first()).toHaveAttribute('id', `${semanticId}-heading`);
  await expect(page.locator('[data-unit-toggle], [data-norm-toggle-all]')).toHaveCount(0);
  await expect(page.locator(`#${semanticId}-inhalt`)).toBeVisible();

  await page.evaluate(() => {
    const testWindow = window as Window & { __printCalls?: number };
    testWindow.__printCalls = 0;
    window.print = () => {
      testWindow.__printCalls = (testWindow.__printCalls ?? 0) + 1;
    };
  });
  await page.getByRole('navigation', { name: 'Werkzeuge zur Vorschrift' }).getByRole('button', { name: 'Drucken', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls)).toBe(1);

  // Werkzeuge je Einheit: „Link“ kopiert die Adresse der Stelle, „Drucken“ druckt nur diese Einheit.
  const unitTools = firstUnit.locator('.norm-unit__tools');
  await expect(unitTools.getByRole('link', { name: 'Link' })).toHaveAttribute('href', `#${semanticId}`);
  await unitTools.getByRole('button', { name: 'Drucken' }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls)).toBe(2);
  await expect(page.locator('body')).not.toHaveClass(/print-single-norm-unit/u);
  await expect(page.locator('.norm-aside__source').getByRole('heading', { name: 'Amtliche Quelle' })).toBeVisible();
});

siteTest(['law'])('Fassungsvergleich zeigt jeden geänderten Paragraphen einmal mit markiertem Wortlaut und ohne Kontextblöcke', async ({ page, request }) => {
  const norm = await multiVersionNorm(request);
  await page.goto(lawUrl(`/norm/${norm.slug}/vergleich/?von=${norm.historical.versionId}&bis=${norm.current.versionId}`));
  await expect(page.locator('[data-compare-output]')).toHaveAttribute('data-compare-pair', `${norm.historical.versionId}::${norm.current.versionId}`);
  const changedProvisions = page.locator('.norm-diff__provision--changed');
  expect(await changedProvisions.count()).toBeGreaterThan(0);
  // Genau eine Darstellung: nebeneinander, ohne Umschalter und ohne Wortlaut im Text.
  await expect(page.locator('[data-compare-mode], [data-version-compare] .r-segmented')).toHaveCount(0);
  for (const provision of await changedProvisions.all()) {
    const marks = await provision.locator('.norm-diff__side del, .norm-diff__side ins').count();
    expect(marks, 'jede geänderte Vorschrift markiert Streichung oder Einfügung').toBeGreaterThan(0);
    // Jede geänderte Einheit steht genau einmal links und einmal rechts, nie zusätzlich als
    // geglätteter Wortlaut.
    await expect(provision.locator('.norm-diff__side--before')).toHaveCount(1);
    await expect(provision.locator('.norm-diff__side--after')).toHaveCount(1);
    await expect(provision.locator('.norm-diff__side')).toHaveCount(2);
    await expect(provision.locator('.norm-diff__side--before > h3')).toHaveText(/^Fassung vom /u);
    await expect(provision.locator('.norm-diff__side--after > h3')).toHaveText(/^Fassung vom /u);
    // Der gegliederte Text erscheint je Spalte einmal: keine zwei Vorkommen desselben Absatzlabels.
    const labels = await provision.locator('.norm-diff__side--after .norm-subparagraph__label, .norm-diff__side--after .norm-text__label').allTextContents();
    expect(new Set(labels).size, 'kein Absatz doppelt in einer Spalte').toBe(labels.length);
  }
  await expect(page.locator('.norm-diff__context')).toHaveCount(0);
  // Der Vergleich ohne Paar zeigt die Auswahl und keinen Zwischenstand.
  await page.goto(lawUrl(`/norm/${norm.slug}/vergleich/`));
  await expect(page.locator('[data-version-compare] .norm-compare__form')).toBeVisible();
});

siteTest(['law'])('Bereiche der Vorschrift bleiben auf Text, Fassungen und Einzelfassung identisch', async ({ page, request }) => {
  const norm = await multiVersionNorm(request);
  for (const path of [norm.current.currentUrl, `/norm/${norm.slug}/history/`, norm.historical.url]) {
    await page.goto(lawUrl(path));
    const navigation = page.getByRole('navigation', { name: 'Bereiche der Vorschrift' });
    await expect(navigation.locator('a'), path).toHaveText([
      'Text',
      'Vorschriftendaten',
      'Fassungen und Änderungen',
      'Rechtsbeziehungen',
    ]);
    // Jede Seite kennzeichnet ihren Bereich; der Vorschriftskopf steht auf allen Seiten gleich.
    await expect(navigation.locator('a[aria-current="page"]'), path).toHaveCount(1);
    await expect(page.locator('.norm-page-header h1'), path).toBeVisible();
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

  // Der Fassungsbereich gehört zur erweiterten Suche (P2b): der Aufklappbereich wird wie von einer
  // Leserin geöffnet, die Auswahl bleibt dasselbe Steuerelement mit demselben Parameter.
  await page.locator('[data-search-advanced] > summary').click();
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
  await expect(page.locator('[data-search-results] .search-hit .search-hit__ident').first()).toContainText('Gesetz');
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

  // Ein Filterwechsel ist ein neuer Suchzustand: genau eine weitere Anfrage. Das Öffnen der
  // erweiterten Suche ist kein Suchzustand.
  await page.locator('[data-search-advanced] > summary').click();
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
  // Herkunft im A–Z (Richtung E): kein Zählerblock mehr, die Herkunft ist ein Filter der
  // Buchstabengruppen. Die Gruppen unter dem Filter zählen zusammen die Grundmenge je
  // Herkunftsart – ohne die übernommenen Änderungsvorschriften –, die Suche dieselbe Menge,
  // solange sie nicht ausdrücklich um sie erweitert wird.
  await page.goto(lawUrl('/a-z/'));
  const letters = await page.locator('.letter-nav a[data-index-letter]:not([data-index-letter=""])').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-index-letter') ?? ''));
  expect(letters.length).toBeGreaterThan(0);
  for (const origin of ['inherited-unchanged', 'ostdeutsch-original']) {
    let listed = 0;
    for (const letter of letters) {
      await page.goto(lawUrl(`/a-z/?buchstabe=${encodeURIComponent(letter)}&herkunft=${origin}`));
      const text = (await page.locator('[data-index-count]').textContent()) ?? '';
      listed += Number(text.match(/(\d+)/u)?.[1] ?? 0);
    }
    expect(listed, origin).toBeGreaterThan(0);
    const found = await searchApi(request, `?origin=${origin}&versionScope=all`);
    expect(found.total, `/a-z/?herkunft=${origin} gegen ?origin=${origin}`).toBe(listed);
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
  // Zwischen 64 und 80 rem wird der Kopf zweizeilig: die Navigationsliste bleibt sichtbar und
  // steht als eigene Zeile. Erst darunter weicht sie in das Menü, zuletzt auch die Suche.
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

  // 960–1279 px: schmales Suchfeld, die fünf Bereiche bleiben als Textlinks im Amtsband.
  for (const width of [1280, 1180, 1100, 1040, 1000]) {
    const header = await readHeader(width);
    expect(header, `Textlink-Stufe bei ${width} px`).toMatchObject({ wordmark: true, search: true, menu: false, navigation: true });
    expect(await page.locator('.law-main-nav a').count(), `Navigationspunkte bei ${width} px`).toBe(5);
  }

  // Unter 60 rem weichen Suche und Bereiche in das Menü „Bereiche“.
  for (const width of [900, 700]) {
    const header = await readHeader(width);
    expect(header, `Menüstufe bei ${width} px`).toMatchObject({ wordmark: true, search: false, menu: true, navigation: false });
  }

  // Keine Stufe macht die Seite breiter als das Fenster.
  for (const width of [1440, 1280, 1100, 1040, 1000, 900, 700]) {
    await readHeader(width);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `kein waagerechter Überlauf bei ${width} px`).toBeLessThanOrEqual(1);
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
  expect(await page.locator('[data-index-list] tbody tr').count()).toBeGreaterThan(0);
  expect(await page.locator('[data-index-list] tbody tr').count()).toBeLessThanOrEqual(50);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/a-z\/\?buchstabe=A$/u);

  // Buchstabenwechsel über die URL (ohne JavaScript nutzbar): nur Vorschriften dieser Gruppe.
  // Verglichen wird die Buchstabengruppe des Eintrags, nicht sein Titelanfang – die Einordnung
  // folgt dem Ordnungswort.
  const letterLinks = page.locator('.letter-nav a[data-index-letter]:not([data-index-letter=""]):not([aria-current="page"])');
  const letter = (await letterLinks.first().getAttribute('data-index-letter')) ?? 'B';
  await letterLinks.first().click();
  await expect(page).toHaveURL(new RegExp(`buchstabe=${letter}`, 'u'));
  await expect(page.locator('.letter-nav a[aria-current="page"]')).toHaveText(letter);
  const groups = await page.locator('[data-index-list] tbody tr').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.indexLetter));
  expect(groups.length).toBeGreaterThan(0);
  expect(groups.every((group) => group === letter)).toBe(true);

  // Abkürzungen und Kurztitel: serverseitig gefiltert (GET) und lokal auf der geladenen Seite filterbar.
  let keyword = '';
  let keywordLetter = letter;
  for (const candidate of [letter, ...(await page.locator('.letter-nav a[data-index-letter]:not([data-index-letter=""])').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-index-letter') ?? '')))]) {
    await page.goto(lawUrl(`/a-z/abkuerzungen/?buchstabe=${candidate}`));
    const first = page.locator('[data-index-entry] > dt').first();
    if (await first.count() === 0) continue;
    keyword = ((await first.textContent()) ?? '').trim();
    keywordLetter = candidate;
    if (keyword.length > 2) break;
  }
  expect(keyword.length, 'Buchstabengruppe mit Abkürzungen und Kurztiteln').toBeGreaterThan(2);
  await page.goto(lawUrl(`/a-z/abkuerzungen/?buchstabe=${keywordLetter}&abkuerzung=${encodeURIComponent(keyword)}`));
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

  // Das Stichwortregister ist eine eigene Seite mit eigenem Zustand; es darf leer sein.
  await page.getByRole('navigation', { name: 'Zugänge' }).getByRole('link', { name: /^Stichwortregister/u }).click();
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
    // Die Metazeile nennt Geltung als Marke, die geltende Fassung und – außer bei übernommenem,
    // unverändertem Recht – die Rechtsherkunft als Textangabe.
    const metaLine = hits.first().locator('.search-hit__meta');
    await expect(metaLine.locator('.r-status'), query).toBeVisible();
    await expect(metaLine, query).toContainText(/geltende Fassung seit/u);
    if (entry.origin !== 'inherited-unchanged') await expect(metaLine, `${query} (${entry.origin})`).toContainText(/Ostdeutsch|Übernommen|Herkunft/u);
  }

  // Herkunftsfacet und Kandidaten-API arbeiten mit derselben Herkunftssemantik: der Leerzustand
  // wird für eine Anfrage geprüft, für die die API selbst keine übernommene Norm liefert.
  const originals = (await currentDocuments(request, '&origin=ostdeutsch-original')).filter((entry) => entry.abbr && abbrCounts.get(entry.abbr) === 1);
  expect(originals.length, 'geltende Norm ostdeutscher Herkunft mit eindeutiger Abkürzung').toBeGreaterThan(0);
  const original = originals[0];
  await page.goto(lawUrl(`/suche/?q=${encodeURIComponent(original.abbr)}&versionScope=all`));
  await searchSettled(page);
  await expect(page.locator('[data-search-results] .search-hit .search-hit__meta').first()).toContainText(/geltende Fassung/u);
  await page.goto(lawUrl(`/suche/?q=${encodeURIComponent(original.abbr)}&origin=ostdeutsch-original`));
  await searchSettled(page);
  await expect(page.locator('[data-search-results] .search-hit').first()).toBeVisible();
  // In der Trefferliste steht die Herkunft als Textangabe; die ausführliche Bedeutung trägt sie als Titel.
  await expect(page.locator('[data-search-results] .search-hit .search-hit__meta').first()).toContainText('Ostdeutsch neu geschaffen');
  await expect(page.locator('[data-search-results] .search-hit .search-hit__meta [title]').first()).toHaveAttribute('title', /Freistaat Ostdeutschland geschaffen/u);
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
  await expect(panel).toContainText(/Ostdeutsch neu geschaffen/u);
  await expect(panel).toContainText(`Geltende Fassung, gültig ab ${formatGermanDate(original.validFrom)}`);
  await expect(panel).toContainText(`Rechtsstand vom ${formatGermanDate(editorialReferenceDate())}`);
  await expect(panel).not.toContainText('Stichtag');
  await expect(page.locator('.norm-page-header__status')).toContainText('in Kraft seit');
  await expect(page.locator('.status-notice')).toHaveCount(0);

  const amended = await currentNormOfOrigin(request, 'inherited-amended');
  await page.goto(lawUrl(amended.currentUrl));
  const amendedPanel = await openNormFacts(page);
  await expect(amendedPanel).toContainText(/Übernommen und ostdeutsch geändert/u);
  // Änderungsvorschriften stehen mit Titel und Wirksamkeitstag, nicht als unbeschrifteter Verweis.
  await expect(amendedPanel).toContainText('Änderungsvorschriften');
  const amendmentLink = amendedPanel.locator('.norm-facts__amendment-table a').first();
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

siteTest(['law'])('A–Z bietet Herkunftsfilter und hält den Buchstabenwechsel im Filter', async ({ page }) => {
  await page.goto(lawUrl('/a-z/'));
  // Rechtsherkunft ist ein Filter der A–Z-Übersicht (Richtung E: kein Zählerblock mehr).
  const originFilter = page.locator('select[name="herkunft"]');
  await expect(originFilter).toBeVisible();
  expect(await originFilter.locator('option').count()).toBeGreaterThanOrEqual(4);
  await originFilter.selectOption('inherited-unchanged');
  await expect(page).toHaveURL(/herkunft=inherited-unchanged/u);
  await expect(page.locator('select[name="herkunft"]')).toHaveValue('inherited-unchanged');
  // Die Buchstabenleiste zählt den gesamten Bestand; unter dem Herkunftsfilter kann eine Gruppe
  // leer sein. Geprüft wird die erste Gruppe, die Vorschriften dieser Herkunft führt.
  const groups = await page.locator('.letter-nav a[data-index-letter]:not([data-index-letter=""])').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-index-letter') ?? ''));
  let filledLetter = '';
  for (const candidate of groups) {
    await page.goto(lawUrl(`/a-z/?buchstabe=${candidate}&herkunft=inherited-unchanged`));
    if (await page.locator('[data-index-list] tbody tr').count() > 0) { filledLetter = candidate; break; }
  }
  expect(filledLetter, 'Buchstabengruppe mit übernommenen, unveränderten Vorschriften').not.toBe('');
  const origins = await page.locator('[data-index-list] tbody tr').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.origin));
  expect(origins.length).toBeGreaterThan(0);
  expect(origins.every((origin) => origin === 'inherited-unchanged')).toBe(true);
  const letterLink = page.locator('.letter-nav a[data-index-letter]:not([data-index-letter=""]):not([aria-current="page"])').first();
  const letter = await letterLink.getAttribute('data-index-letter');
  await letterLink.click();
  await expect(page).toHaveURL(new RegExp(`buchstabe=${letter}`, 'u'));
  await expect(page).toHaveURL(/herkunft=inherited-unchanged/u);
});


siteTest(['law'])('Registerseiten bewahren den Buchstaben bei Wechsel und Reload, ohne fremde Filter', async ({ page, request }) => {
  for (const path of ['/a-z/', '/a-z/stichwortregister/', '/a-z/abkuerzungen/']) {
    const response = await request.get(lawUrl(path));
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('public, max-age=300, s-maxage=3600');
  }
  await page.goto(lawUrl('/a-z/?buchstabe=A&herkunft=inherited-unchanged&seite=2'));
  const tabs = page.getByRole('navigation', { name: 'Zugänge' });
  await tabs.getByRole('link', { name: /^Stichwortregister/u }).click();
  expect(new URL(page.url()).pathname).toBe('/a-z/stichwortregister/');
  expect(new URL(page.url()).search).toBe('?buchstabe=A');
  await page.locator('.letter-nav a[data-index-letter="S"]').click();
  await page.reload();
  await expect(page.locator('.letter-nav a[aria-current="page"]')).toHaveText('S');
  await expect(tabs.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(tabs.locator('[aria-current="page"]')).toContainText('Stichwortregister');
  await expect(page.locator('[data-register-count]')).toBeVisible();
  await page.locator('[data-register-filter]').fill('Test');
  await page.locator('[data-register-filter-form] button').click();
  await tabs.getByRole('link', { name: /^Abkürzungen/u }).click();
  expect(new URL(page.url()).pathname).toBe('/a-z/abkuerzungen/');
  expect(new URL(page.url()).search).toBe('?buchstabe=S');
  await page.reload();
  await expect(page.locator('.letter-nav a[aria-current="page"]')).toHaveText('S');
  await expect(tabs.locator('[aria-current="page"]')).toContainText('Abkürzungen und Kurztitel');
  expect(new URL(page.url()).hash).toBe('');
  await expect(page.locator('[data-directory-list], [data-register-count]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/a-z\/abkuerzungen\/\?buchstabe=S$/u);
  await expect(page).toHaveTitle(/Abkürzungen und Kurztitel/u);
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

siteTest(['law'])('Amtliche Veröffentlichungen führen Veröffentlichungen und Ausgaben in einer Recherche mit Ansichtswechsel', async ({ page }) => {
  await page.goto(lawUrl('/verkuendungen/'));
  const viewSwitch = page.getByRole('navigation', { name: 'Ansicht' });
  // Standardansicht sind die einzelnen Veröffentlichungen (P5); die Ausgaben bleiben eine zweite Ansicht.
  await expect(viewSwitch.locator('a[aria-current="page"]')).toHaveText('Veröffentlichungen');
  await expect(page.locator('[data-directory-count]')).toContainText(/Veröffentlichung/u);
  const entryDates = await page.locator('[data-directory-entry] time').evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute('datetime') ?? ''));
  expect(entryDates.length).toBeGreaterThan(0);
  expect(entryDates.length).toBeLessThanOrEqual(50);
  expect([...entryDates].sort().reverse(), 'Veröffentlichungen stehen mit der jüngsten Ausgabe zuerst').toEqual(entryDates);

  await viewSwitch.locator('a[data-view="ausgaben"]').click();
  await expect(page).toHaveURL(/ansicht=ausgaben/u);
  await expect(viewSwitch.locator('a[aria-current="page"]')).toHaveText('Ausgaben');
  await expect(page.locator('[data-directory-count]')).toContainText(/Ausgabe/u);
  const issueDates = await page.locator('[data-directory-entry] time').evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute('datetime') ?? ''));
  expect(issueDates.length).toBeGreaterThan(0);
  expect([...issueDates].sort().reverse(), 'Ausgaben stehen mit der jüngsten zuerst').toEqual(issueDates);

  // Der Filter bleibt in der Ansicht: die Auswahl führt nicht zurück auf die Veröffentlichungen.
  await page.locator('[data-directory-filter] select[name="publication"]').selectOption({ index: 1 });
  await expect(page).toHaveURL(/ansicht=ausgaben/u);
  await expect(viewSwitch.locator('a[aria-current="page"]')).toHaveText('Ausgaben');
  await expect(page.locator('[data-directory-reset]')).not.toHaveAttribute('aria-disabled', 'true');
  // Die alte Ansichtsadresse bleibt gültig.
  await page.goto(lawUrl('/verkuendungen/?ansicht=eintraege'));
  await expect(viewSwitch.locator('a[aria-current="page"]')).toHaveText('Veröffentlichungen');
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

/**
 * Öffentliche Texte sprechen die Sprache der Nutzenden: keine maschinenlesbaren Daten, keine
 * Systemwörter und keine Zähler in falscher Zahl. Geprüft wird die Sprache des Portals –
 * Überschriften, Beschriftungen, Filter, Statuszeilen und Zähler. Vorschriftentext,
 * Zusammenfassungen und Suchausschnitte sind Bestand und keine Systemsprache; ihre Wortwahl
 * prüfen die Bestandsaudits (`npm run content:check`), nicht dieser Test. Die Sperrliste bleibt
 * kurz: sie hält Systemwörter fern, ohne neue Formulierungen zu verbieten.
 */
// Bestandstext bleibt außen vor: Normtext samt Inhaltsübersicht (sie führt die Überschriften der
// Einheiten), Beschreibungen der Verzeichniseinträge, Suchausschnitte und die Änderungsliste.
const CORPUS_TEXT_SELECTORS = '.norm-document, .norm-outline, .norm-outline-mobile, .r-norm-table, .search-hit__context, .search-hit__places, .norm-timeline, .norm-protocol, .r-home-changes__list';

siteTest(['law'])('Öffentliche Texte ohne Systemsprache', async ({ page, request }) => {
  const norm = await multiVersionNorm(request);
  const [current] = await currentDocuments(request);
  const index = await publicationIndex(request);
  expect(index.latestPublication, 'Verkündung im Bestand').toBeTruthy();
  const pages = [
    '/',
    '/suche/',
    '/gesetze/',
    '/a-z/',
    current.currentUrl,
    `/norm/${norm.slug}/history/`,
    norm.historical.url,
    `/verkuendungen/${index.latestPublication!.slug}/`,
    '/hilfe/',
  ];

  const blocked: Array<{ what: string; pattern: RegExp; exceptHelp?: boolean }> = [
    { what: 'maschinenlesbares Datum', pattern: /\b\d{4}-\d{2}-\d{2}\b/u },
    { what: 'Systemwort', pattern: /\b(?:gespeichert\w*|Datenbestand\w*|Anker\w*|strukturtragend\w*)\b/iu },
    { what: 'Stichtag außerhalb der Hilfe', pattern: /Stichtag\b/u, exceptHelp: true },
    { what: 'Auswahl „Alle Status“', pattern: /Alle Status/u },
    { what: 'Zähler in falscher Zahl', pattern: /\b1 (?:Vorschriften|Ausgaben|Nachweise|Einträge|Fassungen|Jahrgänge)\b/u },
  ];

  for (const path of pages) {
    await page.goto(lawUrl(path));
    const text = await page.evaluate((selectors) => {
      const copy = document.body.cloneNode(true) as HTMLElement;
      for (const element of copy.querySelectorAll(`script, style, template, ${selectors}`)) element.remove();
      return `${document.title} ${copy.textContent ?? ''}`.replace(/\s+/gu, ' ').trim();
    }, CORPUS_TEXT_SELECTORS);
    for (const { what, pattern, exceptHelp } of blocked) {
      if (exceptHelp && path === '/hilfe/') continue;
      const found = text.match(pattern);
      const context = found ? text.slice(Math.max(0, found.index! - 70), found.index! + 70) : '';
      expect(found, `${path}: ${what} „${found?.[0] ?? ''}“ in „…${context}…“`).toBeNull();
    }
  }
});

/**
 * Portalinventar und Portalsuche: Serviceübersicht und `sitemap.xml` kommen aus derselben Quelle
 * (`apps/portal/src/lib/route-inventory.ts`), und die Suche weist Portalinhalte und Recht als
 * getrennte Bereiche aus. Die Erwartungen werden zur Laufzeit aus der Sitemap abgeleitet; kein
 * Test nennt eine feste Seitenzahl oder einen redaktionellen Titel.
 */
siteTest(['portal'])('Serviceübersicht und Sitemap stammen aus einem Inventar', async ({ page, request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  const sitemapPaths = new Set(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => new URL(match[1]).pathname),
  );
  expect(sitemapPaths.size).toBeGreaterThan(100);

  await page.goto('/service/uebersicht/');
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('#main-content .record-list__item a')]
      .map((link) => new URL((link as HTMLAnchorElement).href).pathname));
  expect(links.length).toBeGreaterThan(20);
  const unknown = links.filter((path) => !sitemapPaths.has(path));
  expect(unknown, 'Übersichtslinks ohne Eintrag in der Sitemap').toEqual([]);
  expect(new Set(links).size, 'jede Seite steht genau einmal in der Übersicht').toBe(links.length);

  // Werkzeugseiten gehören nicht in die Übersicht.
  for (const utility of ['/suche/', '/404/', '/500/']) {
    expect(links, `Werkzeugseite ${utility}`).not.toContain(utility);
  }
});

siteTest(['portal'])('Portalsuche gruppiert nach Bereichen und lädt den Rechtsbestand erst bei Bedarf', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/search-index')) requested.push(path);
  });

  await page.goto('/suche/');
  await expect(page.locator('[data-portal-search-status]')).toContainText('Geben Sie einen Begriff ein');
  expect(requested, 'ohne Suchbegriff wird der Rechtsbestand nicht geladen').not.toContain('/search-index-recht.json');

  // Ein Bereichsname des Staatsportals führt zuerst auf dessen Einstieg.
  const sectionLabel = await page.locator('.site-header__nav a').nth(1).innerText();
  await page.locator('[data-portal-search-query]').fill(sectionLabel);
  await expect(page.locator('#search-group-portal')).toBeVisible();
  await expect(page.locator('.search-group').first().locator('.search-hit').first()).toBeVisible();

  // Erfolgreiches Laden: der Rechtsindex wird genau einmal geholt und der Zustand ist `loaded`.
  await expect(page.locator('[data-portal-search-root]')).toHaveAttribute('data-law-status', 'loaded');
  await expect(page.locator('[data-portal-search-law-status]')).toHaveCount(0);
  expect(requested.filter((path) => path === '/search-index-recht.json'), 'genau eine Anfrage für den Rechtsindex').toHaveLength(1);

  // Der Bereichsfilter kann das Recht ausschließen.
  await page.locator('[data-portal-search-area]').selectOption('portal');
  await expect(page.locator('#search-group-law')).toHaveCount(0);
  await expect(page.locator('[data-portal-search-status]')).toContainText('0 im Recht');
});

siteTest(['law'])('Primäre Navigation öffnet eigenständige Ansichten und bewahrt konkrete Fassungen', async ({ page, request }) => {
  await page.goto(lawUrl('/'));
  const mainNav = page.getByRole('navigation', { name: 'Hauptnavigation', exact: true });
  await expect(mainNav.getByRole('link')).toHaveText(['Sachgebiete', 'A–Z und Register', 'Amtliche Veröffentlichungen', 'Verfassung', 'Hilfe']);
  await expect(page.locator('#aenderungsdienst')).toBeVisible();
  await expect(mainNav.locator('a[href*="#"]')).toHaveCount(0);

  const norm = await multiVersionNorm(request);
  const sitemap = await (await request.get(lawUrl('/sitemap.xml'))).text();
  for (const path of ['/a-z/stichwortregister/', '/a-z/abkuerzungen/', `/norm/${norm.slug}/daten/`, `/norm/${norm.slug}/beziehungen/`, `/norm/${norm.slug}/version/${norm.historical.versionId}/daten/`, `/norm/${norm.slug}/version/${norm.historical.versionId}/beziehungen/`]) {
    expect(sitemap).toContain(`${path}</loc>`);
  }
  for (const [section, segment, content] of [['facts', 'daten', '.norm-facts'], ['relations', 'beziehungen', '.norm-relations']] as const) {
    await page.goto(lawUrl(`/norm/${norm.slug}/history/`));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('.norm-tabs a[href*="#"]')).toHaveCount(0);
    await page.locator(`[data-norm-tab="${section}"]`).click();
    expect(new URL(page.url()).pathname).toBe(`/norm/${norm.slug}/${segment}/`);
    expect(new URL(page.url()).hash).toBe('');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator(content)).toBeVisible();
    await expect(page.locator('.norm-tabs [aria-current="page"]')).toHaveCount(1);
    await expect(page.locator(`[data-norm-tab="${section}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/norm/${norm.slug}/${segment}/$`, 'u'));
    await expect(page).toHaveTitle(section === 'facts' ? /Vorschriftendaten/u : /Rechtsbeziehungen/u);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/u);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);

    await page.goto(lawUrl(norm.historical.url));
    const head = await page.locator('.norm-page-header').textContent();
    await page.locator(`[data-norm-tab="${section}"]`).click();
    expect(new URL(page.url()).pathname).toBe(`/norm/${norm.slug}/version/${norm.historical.versionId}/${segment}/`);
    expect(await page.locator('.norm-page-header').textContent()).toBe(head);
    await expect(page.locator('.norm-band')).toContainText('HISTORISCHE FASSUNG');
    await expect(page.locator('[data-norm-tab="text"]')).toHaveAttribute('href', new RegExp(`/version/${norm.historical.versionId}/$`, 'u'));
    await expect(page.locator('[data-norm-tab="versions"]')).toHaveAttribute('href', new RegExp(`/norm/${norm.slug}/history/$`, 'u'));
    if (section === 'facts') await expect(page.locator('.norm-facts')).toContainText('Historische Fassung');
  }
  // Auch ein expliziter Link auf die derzeit geltende Fassung bleibt unveränderlich.
  await page.goto(lawUrl(`/norm/${norm.slug}/version/${norm.current.versionId}/`));
  await page.locator('[data-norm-tab="facts"]').click();
  expect(new URL(page.url()).pathname).toBe(`/norm/${norm.slug}/version/${norm.current.versionId}/daten/`);
  const constitution = await page.goto(lawUrl(lawPaths.constitution));
  expect(constitution?.status()).toBe(200);
  await expect(mainNav.getByRole('link', { name: 'Verfassung' })).toHaveAttribute('aria-current', 'page');
  const constitutionVersion = await page.locator('.norm-timeline a[href*="/version/"]').first().getAttribute('href');
  expect(constitutionVersion).toBeTruthy();
  await page.goto(lawUrl(constitutionVersion!));
  await page.locator('[data-norm-tab="relations"]').click();
  await expect(mainNav.getByRole('link', { name: 'Verfassung' })).toHaveAttribute('aria-current', 'page');
});

siteTest(['law'])('Bereichsseiten funktionieren ohne JavaScript und unbekannte Fassungen bleiben 404', async ({ browser, request }) => {
  const norm = await multiVersionNorm(request);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(lawUrl(norm.historical.url));
    await page.locator('[data-norm-tab="facts"]').click();
    await expect(page.locator('.norm-facts')).toContainText('Historische Fassung');
    await page.locator('[data-norm-tab="relations"]').click();
    await expect(page.locator('.norm-relations')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(`/norm/${norm.slug}/version/${norm.historical.versionId}/beziehungen/`);
    await page.goto(lawUrl('/a-z/stichwortregister/?buchstabe=S'));
    await expect(page.locator('.letter-nav a[aria-current="page"]')).toHaveText('S');
    await page.getByRole('navigation', { name: 'Zugänge' }).getByRole('link', { name: /^Abkürzungen/u }).click();
    expect(new URL(page.url()).pathname).toBe('/a-z/abkuerzungen/');
    expect(new URL(page.url()).search).toBe('?buchstabe=S');
    for (const section of ['daten', 'beziehungen']) {
      const response = await request.get(lawUrl(`/norm/${norm.slug}/version/nicht-vorhanden/${section}/`));
      expect(response.status()).toBe(404);
    }
  } finally {
    await context.close();
  }
});

siteTest(['law'])('Normbereiche, mobile Fassungsfolge und modale Inhaltsübersicht', async ({ page, request }) => {
  await prepareFunctionalPage(page);
  const norm = await multiVersionNorm(request);
  await page.goto(lawUrl(norm.current.currentUrl));
  await page.locator('[data-norm-tab="facts"]').click();
  await expect(page.locator('.norm-facts')).toBeVisible();
  await expect(page.locator('.norm-workspace')).toBeHidden();
  await expect(page.locator('[data-norm-tab="facts"]')).toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(page.locator('.norm-workspace')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  // Der Browser meldet den Media-Query-Wechsel asynchron nach der Größenänderung.
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('.norm-aside__versions')!.getBoundingClientRect().top
      < document.querySelector('.norm-document')!.getBoundingClientRect().top,
  )).toBe(true);
  await page.locator('.norm-page-header [data-outline-open]').click();
  await expect(page.getByRole('dialog', { name: 'Inhalt der Vorschrift' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

siteTest(['law'])('Zentrale Suche bietet Tastaturvorschläge und ein mobiles Filterblatt', async ({ page, request }) => {
  await prepareFunctionalPage(page);
  await page.goto(lawUrl('/suche/'));
  const field = page.locator('[data-search-query]');
  await field.fill(await currentSearchWord(request));
  await expect(field).toHaveAttribute('aria-expanded', 'true');
  await field.press('ArrowDown');
  await expect(field).toHaveAttribute('aria-activedescendant', /option/u);
  await field.press('Escape');
  await expect(field).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-search-advanced] > summary').click();
  const dialog = page.getByRole('dialog', { name: 'Erweiterte Suche' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Schließen', exact: true }).click();
  await expect(dialog).toBeHidden();
});

siteTest(['law'])('Kopierte Fassungs- und Vergleichslinks behalten ihr genaues Ziel', async ({ page, request }) => {
  await prepareFunctionalPage(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => { document.documentElement.dataset.copied = text; } } });
  });
  const norm = await multiVersionNorm(request);
  await page.goto(lawUrl(norm.historical.url));
  await page.locator('.norm-page-header__tools [data-copy-url]').click();
  await expect(page.locator('html')).toHaveAttribute('data-copied', new RegExp(`/version/${norm.historical.versionId}/$`, 'u'));
  await page.goto(lawUrl(`/norm/${norm.slug}/vergleich/?von=${norm.historical.versionId}&bis=${norm.current.versionId}`));
  await page.getByRole('button', { name: 'Link zum Vergleich kopieren' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-copied', new RegExp(`von=${norm.historical.versionId}&bis=${norm.current.versionId}$`, 'u'));
});

siteTest(['law'])('Smartes Amtsband und Seitenanfang reagieren ruhig auf Scrollen und Bedienung', async ({ page, request }) => {
  await prepareFunctionalPage(page);
  await page.goto(lawUrl((await multiVersionNorm(request)).current.currentUrl));
  // Verlässlicher Scrollraum unabhängig von der Länge des jeweils verwendeten Testkorpus.
  await page.locator('.norm-document').evaluate((element) => { (element as HTMLElement).style.minHeight = '6000px'; });
  const header = page.locator('.law-header');
  const top = page.getByRole('button', { name: 'Zum Seitenanfang', exact: true });
  const scroll = async (y: number) => { await page.evaluate((position) => window.scrollTo({ top: position, behavior: 'instant' }), y); };
  // „Zum Seitenanfang“ erscheint erst nach zwei Bildschirmhöhen (auf allen Breiten).
  const threshold = await page.evaluate(() => 2 * window.innerHeight);
  const far = threshold + 100;
  await expect(header).toHaveClass(/is-scroll-visible/u);
  await expect(top).toBeHidden();
  await scroll(threshold - 200);
  await expect(header).toHaveClass(/is-scroll-hidden/u);
  await expect(top).toBeHidden();
  await scroll(far);
  await expect(header).toHaveClass(/is-scroll-hidden/u);
  await expect(top).toBeVisible();
  await scroll(far - 4);
  await page.waitForTimeout(50);
  await expect(header).toHaveClass(/is-scroll-hidden/u);
  await scroll(far - 60);
  await expect(header).toHaveClass(/is-scroll-visible/u);
  await scroll(far + 200);
  await expect(header).toHaveClass(/is-scroll-hidden/u);
  await page.locator('#law-header-search').focus();
  await expect(header).toHaveClass(/is-scroll-visible/u);
  await scroll(far + 500);
  await expect(header).toHaveClass(/is-scroll-visible/u);
  await page.locator('#law-header-search').evaluate((element) => (element as HTMLElement).blur());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.law-mobile-nav summary').click();
  await scroll(far + 700);
  await expect(header).toHaveClass(/is-scroll-visible/u);
  await expect(top).toBeHidden();
  await page.locator('.law-mobile-nav summary').click();
  await page.locator('.law-mobile-nav summary').evaluate((element) => (element as HTMLElement).blur());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await scroll(far + 1000);
  await expect(header).toHaveClass(/is-scroll-hidden/u);
  expect(await header.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
  await expect(top).toBeVisible();
  await page.evaluate(() => history.replaceState(null, '', `#${document.querySelector('.norm-unit[id]')!.id}`));
  const url = page.url();
  await top.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(header).toHaveClass(/is-scroll-visible/u);
  await expect(top).toBeHidden();
  expect(page.url()).toBe(url);
  await expect(page.locator('.law-wordmark')).toBeFocused();
  // Am Footer werden dessen eigene Links nicht von einem schwebenden Werkzeug überdeckt.
  await page.locator('.law-wordmark').evaluate((element) => (element as HTMLElement).blur());
  await page.locator('.law-footer').scrollIntoViewIfNeeded();
  await expect(top).toBeHidden();
});

siteTest(['law'])('Restpunkte Richtung E: die Inhaltsübersicht folgt dem ausgeblendeten Amtsband', async ({ page, request }) => {
  await prepareFunctionalPage(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(lawUrl((await multiVersionNorm(request)).current.currentUrl));
  await page.locator('.norm-document').evaluate((element) => { (element as HTMLElement).style.minHeight = '5000px'; });
  const outline = page.locator('.norm-outline--desktop');
  const header = page.locator('.law-header');
  const headerHeight = await header.evaluate((element) => element.getBoundingClientRect().height);
  expect(headerHeight).toBeGreaterThan(0);
  await expect.poll(() => outline.evaluate((element) => getComputedStyle(element).top)).toBe(`${headerHeight}px`);
  // Abwärts: das Band blendet sich aus, Übersicht und Ankerpolster rücken an den oberen Rand.
  await page.evaluate(() => window.scrollTo({ top: 1400, behavior: 'instant' }));
  await expect(header).toHaveClass(/is-scroll-hidden/u);
  await expect.poll(() => outline.evaluate((element) => getComputedStyle(element).top)).toBe('0px');
  await expect.poll(() => outline.evaluate((element) => getComputedStyle(element).maxHeight)).toBe('900px');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingTop)).toBe('12px');
  // Aufwärts: das Band kehrt zurück, die Übersicht nimmt wieder die Kopfhöhe als Abstand.
  await page.evaluate(() => window.scrollTo({ top: 1300, behavior: 'instant' }));
  await expect(header).toHaveClass(/is-scroll-visible/u);
  await expect.poll(() => outline.evaluate((element) => getComputedStyle(element).top)).toBe(`${headerHeight}px`);
  await expect.poll(() => outline.evaluate((element) => getComputedStyle(element).maxHeight)).toBe(`${900 - headerHeight}px`);
  // Das Bereichsmenü rechnet weiter mit der gemessenen Kopfhöhe.
  expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--law-header-height')))).toBe(headerHeight);
});

/**
 * „Zum Seitenanfang“ kommt oben an (N10): Während der sanften Fahrt meldet der Beobachter jede
 * vorbeiziehende Einheit; die Übersicht darf dabei nur ihren eigenen Container rollen, nie das
 * Fenster. Der Fehler zeigte sich nur mit einer Übersicht, die länger ist als ihr Container –
 * dafür bekommen die Einträge hier Höhe.
 */
for (const motion of ['no-preference', 'reduce'] as const) {
  siteTest(['law'])(`Restpunkte Richtung E: „Zum Seitenanfang“ erreicht den Seitenanfang (${motion === 'reduce' ? 'reduzierte Bewegung' : 'sanfte Fahrt'})`, async ({ page, request }) => {
    await prepareFunctionalPage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto(lawUrl((await multiVersionNorm(request)).current.currentUrl));
    // Auch das kurze Fixture (eine Einheit) überläuft so seinen Container.
    await page.addStyleTag({ content: '.norm-outline__list a { min-height: 120vh; }' });
    await page.locator('.norm-document').evaluate((element) => { (element as HTMLElement).style.paddingBottom = '5000px'; });
    const outline = page.locator('.norm-outline--desktop');
    expect(await outline.evaluate((element) => element.scrollHeight > element.clientHeight), 'die Übersicht rollt in ihrem Container').toBe(true);
    // Ans Ende des Textes, den Fuß noch knapp außerhalb des Bildes (dort verbirgt sich der Knopf).
    await page.evaluate(() => window.scrollTo({ top: document.querySelector('.law-footer')!.getBoundingClientRect().top + window.scrollY - window.innerHeight - 40, behavior: 'instant' }));
    const top = page.getByRole('button', { name: 'Zum Seitenanfang', exact: true });
    await expect(top).toBeVisible();
    await top.click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 8000 }).toBe(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.hasAttribute('data-law-scroll-to-top'))).toBe(false);
    // Nach der Fahrt zeigt die Übersicht den ersten Eintrag; hervorgehoben ist höchstens er.
    await expect.poll(() => outline.evaluate((element) => element.scrollTop)).toBe(0);
    const first = await page.locator('.norm-outline--desktop a[data-outline-link]').first().getAttribute('data-outline-link');
    const current = await page.locator('.norm-outline--desktop a[data-outline-link][aria-current]').evaluateAll((elements) => elements.map((element) => (element as HTMLElement).dataset.outlineLink));
    expect(current.filter((entry) => entry !== first), 'hervorgehobene Einträge nach der Fahrt').toEqual([]);
  });
}

siteTest(['law'])('Mitlaufendes Zitat folgt der gelesenen Normeinheit', async ({ page, request }) => {
  await prepareFunctionalPage(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(lawUrl((await multiVersionNorm(request)).current.currentUrl));
  // Zusätzlicher Raum hinter dem Text erlaubt auch beim kurzen Fixture eine freie Leseposition.
  await page.locator('.norm-document').evaluate((element) => { (element as HTMLElement).style.paddingBottom = '1000px'; });
  const units = page.locator('[data-norm-unit][id]');
  expect(await units.count()).toBeGreaterThan(0);
  for (const unit of [units.first(), units.last()]) {
    const id = await unit.getAttribute('id');
    const label = await unit.getAttribute('data-unit-label');
    await unit.evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - window.innerHeight * 0.12 - 4, behavior: 'instant' }));
    await expect(page.locator('[data-cite-text]')).toContainText(label!);
    await expect(page.locator('[data-cite-link]')).toHaveAttribute('data-copy-url', id!);
    if (label) await expect(page.locator('[data-cite-link]')).toHaveText(`Link zu ${label} kopieren`);
  }
});

siteTest(['law'])('Tiefe Normanker bleiben unter dem gemessenen Amtsband erreichbar', async ({ page, request }) => {
  await prepareFunctionalPage(page);
  const norm = await multiVersionNorm(request);
  for (const width of [1440, 960, 698, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(lawUrl(norm.current.currentUrl));
    const id = await page.locator('.norm-unit[id]').last().getAttribute('id');
    expect(id).toBeTruthy();
    await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--law-header-height')))).toBeGreaterThan(0);
    await page.evaluate((target) => { location.hash = target!; }, id);
    await expect.poll(() => page.evaluate((target) => {
      const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--law-header-height'));
      return document.getElementById(target!)!.getBoundingClientRect().top >= headerHeight - 1;
    }, id)).toBe(true);
  }
});

siteTest(['law'])('Qualitätspass Richtung E: Fassungen als Aufklappbereich, 2×2-Reiter und Kopf ohne schmale Statusspalte', async ({ page, request }) => {
  const norm = await multiVersionNorm(request);
  // Smartphone: die Fassungsliste ist ein geschlossener Aufklappbereich ohne waagerechtes Rollen.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(lawUrl(norm.current.currentUrl));
  const details = page.locator('[data-versions-details]');
  await expect(details).not.toHaveAttribute('open', /.*/u);
  await expect(details.locator('summary')).toContainText(/\d+ Fassung/u);
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open', /.*/u);
  const scroll = await page.locator('.norm-timeline').evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(scroll, 'die Fassungsliste rollt nicht waagerecht').toBeLessThanOrEqual(1);
  expect(await page.locator('.norm-timeline__entry').count()).toBeGreaterThanOrEqual(2);
  // Die vier Bereiche stehen als 2×2-Raster mit gleichen Zellen und vollen Bezeichnungen.
  const tabs = page.locator('.norm-tabs');
  expect(await tabs.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2);
  const widths = await tabs.locator('a').evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().width)));
  expect(widths).toHaveLength(4);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  for (const link of await tabs.locator('a').all()) await expect(link).toBeInViewport();
  const tabsScroll = await tabs.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(tabsScroll).toBeLessThanOrEqual(1);
  // Absatzadressen zeigen nur das Absatzzeichen; das Gliederungszeichen bleibt vorlesbar.
  const firstAddress = page.locator('.norm-abs__addr').first();
  await expect(firstAddress.locator('.norm-abs__label')).toHaveText(/^\(\d+[a-z]?\)$|^\S+$/u);
  await expect(firstAddress.locator('.norm-abs__unit')).toHaveClass(/visually-hidden/u);

  // Zwischen 48 und 60 rem stehen die Werkzeuge unter der Statuszeile.
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto(lawUrl(norm.current.currentUrl));
  const line = await page.locator('.norm-page-header__line').evaluate((element) => element.getBoundingClientRect());
  const tools = await page.locator('.norm-page-header__tools').evaluate((element) => element.getBoundingClientRect());
  expect(tools.top, 'Werkzeuge unter der Statuszeile').toBeGreaterThanOrEqual(line.bottom - 1);
  expect(line.width, 'Statuszeile trägt die Breite').toBeGreaterThan(400);
});

siteTest(['law'])('Qualitätspass Richtung E: Suche mit sichtbarer H1, logischer Reihenfolge und bereinigten Facetten', async ({ page }) => {
  await page.goto(lawUrl('/suche/?q=gesetz'));
  await searchSettled(page);
  const heading = page.getByRole('heading', { level: 1, name: 'Suche im Landesrecht' });
  await expect(heading).toBeVisible();
  expect(await heading.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(30);
  // Genau eine öffentliche Option „außer Kraft“, obwohl das Datenmodell zwei Zustände kennt.
  await expect(page.locator('[data-search-facet="status"] + [data-search-facet-label]', { hasText: /^außer Kraft$/u })).toHaveCount(1);
  const merged = page.locator('[data-search-facet="status"][data-search-facet-values]');
  await expect(merged).toHaveCount(1);
  await expect(merged).toHaveAttribute('data-search-facet-values', /repealed|historical/u);
  // Keine leere Facettengruppe: jede gerenderte Gruppe hat mindestens eine Option.
  for (const group of await page.locator('[data-search-facet-group]').all()) {
    expect(await group.locator('input').count(), 'Facettengruppe ohne Option').toBeGreaterThan(0);
  }
  // Treffertitel sind erkennbare Links in Staatsblau, kein Langtitel wiederholt die Überschrift.
  const firstTitle = page.locator('.search-hit__title h3 a').first();
  expect(await firstTitle.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(5, 31, 126)');
  for (const hit of await page.locator('.search-hit').all()) {
    const long = hit.locator('.search-hit__long');
    if (await long.count() === 0) continue;
    const headingText = (await hit.locator('h3').textContent())?.trim() ?? '';
    expect((await long.textContent())?.trim().replace(/\s*\([^()]*\)\s*$/u, '')).not.toBe(headingText);
  }
  // Der Auszug steht in der Oberflächengröße unter dem Titel.
  const excerpt = page.locator('.search-hit__context').first();
  if (await excerpt.count() > 0) expect(await excerpt.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(15.5);

  // Smartphone: H1 → Suchfeld → Suchbereich → Trefferkopf → Eingrenzen → Liste, als Quelltextfolge.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(lawUrl('/suche/?q=gesetz'));
  await searchSettled(page);
  const order = await page.evaluate(() => {
    const nodes = ['h1', '[data-search-form] input[name="q"]', 'select[name="scope"]', '[data-search-summary]', '.r-search__filters > summary', '[data-search-results] .search-hit']
      .map((selector) => document.querySelector(selector));
    return nodes.every((node, index) => node && (index === 0 || Boolean(nodes[index - 1]!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)));
  });
  expect(order, 'Reihenfolge der Suchseite auf dem Smartphone').toBe(true);
  const firstHitTop = await page.locator('[data-search-results] .search-hit').first().evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  expect(firstHitTop, 'der erste Treffer steht früh').toBeLessThan(900);
});

siteTest(['law'])('Qualitätspass Richtung E: Vorschriftendaten ohne doppelte Fundstelle, Verzeichnisse mit blauen Titeln und ohne leere Verkündungsspalte', async ({ page, request }) => {
  const norm = await multiVersionNorm(request);
  await page.goto(lawUrl(`/norm/${norm.slug}/daten/`));
  const citationCell = page.locator('.norm-facts dt', { hasText: /^Fundstelle$/u }).locator('+ dd');
  const text = ((await citationCell.textContent()) ?? '').replace(/\s+/gu, ' ').trim();
  const primary = text.split('Stammfundstelle:')[0].trim();
  if (text.includes('Stammfundstelle:')) expect(text.split('Stammfundstelle:')[1].trim().toLowerCase()).not.toBe(primary.toLowerCase());
  // Keine hängenden Mittelpunkte in umbrechenden Metadatenzeilen.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(lawUrl(norm.current.currentUrl));
  const hanging = await page.evaluate(() => {
    const blocks = Array.from(document.querySelectorAll<HTMLElement>('.r-kicker, .norm-page-header__line, .search-hit__meta, .r-inline-list'));
    return blocks.filter((block) => /^\s*·|·\s*$/u.test(block.innerText ?? '')).map((block) => block.className);
  });
  expect(hanging).toEqual([]);

  await page.goto(lawUrl('/gesetze/'));
  const title = page.locator('.r-norm-table__title').first();
  expect(await title.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(5, 31, 126)');
  // Typseiten wiederholen den Normtyp nicht; unter 60 rem entfällt die Herkunftsspalte.
  await expect(page.locator('.r-norm-table__type')).toHaveCount(0);
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto(lawUrl('/a-z/'));
  await expect(page.locator('.r-norm-table__origin').first()).toBeHidden();
  const overflow = await page.locator('.r-norm-table').first().evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow, 'A–Z rollt bei 800 px nicht waagerecht').toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(lawUrl(`/norm/${norm.slug}/history/`));
  await expect(page.locator('.norm-axis')).toHaveCount(0);
  const headers = await page.locator('.norm-protocol thead th').allTextContents();
  const hasPublishedColumn = headers.includes('Verkündet');
  const cells = await page.locator('.norm-protocol tbody tr').evaluateAll((rows, column) => rows.map((row) => row.children[column]?.textContent?.trim() ?? ''), hasPublishedColumn ? 1 : -1);
  if (hasPublishedColumn) expect(cells.some((cell) => cell !== '—' && cell !== ''), 'Spalte „Verkündet“ nur mit belegten Daten').toBe(true);
});

siteTest(['law'])('Qualitätspass Richtung E: die Inhaltsübersicht gliedert lange Vorschriften in Aufklappgruppen', async ({ page, request }) => {
  // Das Testfixture kennt keine Teile und Abschnitte; gegen den Vollbestand wird die erste
  // Vorschrift mit Gliederungsgruppen geprüft.
  const documents = await currentDocuments(request, '&type=gesetz');
  let url = '';
  for (const document of documents.slice(0, 12)) {
    const response = await request.get(lawUrl(document.currentUrl));
    if ((await response.text()).includes('data-outline-group')) { url = document.currentUrl; break; }
  }
  test.skip(!url, 'Keine Vorschrift mit Gliederungsgruppen im Bestand (Testfixture).');
  await page.goto(lawUrl(url));
  const groups = page.locator('.norm-outline--desktop [data-outline-group]');
  expect(await groups.count()).toBeGreaterThan(0);
  // Die erste Gruppe steht offen, die Summary nennt Bezeichnung und Normspanne.
  await expect(groups.first()).toHaveAttribute('open', /.*/u);
  await expect(groups.first().locator('summary')).toContainText(/§§?|Art\./u);
  const closed = page.locator('.norm-outline--desktop [data-outline-group]:not([open])');
  if (await closed.count() > 0) {
    // Eine geschlossene Gruppe öffnet sich, sobald ihr Eintrag gelesen wird.
    const target = await closed.first().locator('a[data-outline-link]').last().getAttribute('data-outline-link');
    // An die Oberkante des Lesefensters (12 % der Höhe) scrollen: die vorige Einheit liegt dann
    // oberhalb, die Zieleinheit ist die oberste sichtbare.
    await page.evaluate((id) => {
      const top = document.getElementById(id!)?.getBoundingClientRect().top ?? 0;
      window.scrollTo(0, window.scrollY + top - window.innerHeight * 0.12 - 4);
    }, target);
    await expect(page.locator(`.norm-outline--desktop [data-outline-link="${target}"]`)).toHaveAttribute('aria-current', 'location');
    await expect(page.locator(`.norm-outline--desktop [data-outline-link="${target}"]`).locator('xpath=ancestor::details[1]')).toHaveAttribute('open', /.*/u);
  }
  // Der Filter öffnet Gruppen mit Treffern und blendet Gruppen ohne Treffer aus.
  const lastLink = page.locator('.norm-outline--desktop a[data-outline-link]').last();
  const word = ((await lastLink.textContent()) ?? '').trim().split(/\s+/u).at(-1) ?? '';
  await page.locator('.norm-outline--desktop [data-outline-search]').fill(word);
  await expect(lastLink).toBeVisible();
  await expect(lastLink.locator('xpath=ancestor::details[1]')).toHaveAttribute('open', /.*/u);
});

siteTest(['law'])('Restpunkte Richtung E: die verkündete Änderung im Normkopf nennt die Fundstelle der Änderungsvorschrift', async ({ page, request }) => {
  // Kandidat: eine geltende Vorschrift, deren Änderung verkündet, aber noch nicht wirksam ist –
  // die Startseite führt sie unter „Verkündet, noch nicht in Kraft“ als „wird geändert“.
  await page.goto(lawUrl('/'));
  const entries = page.locator('[data-law-future-change-list] li[data-change-type="amendment"]');
  test.skip(await entries.count() === 0, 'Der Bestand verkündet keine künftige Änderung einer geltenden Vorschrift (Testfixture).');
  const href = await entries.first().locator('.r-home-changes__norm').getAttribute('href');
  await page.goto(lawUrl(href!));
  const slug = new URL(page.url()).pathname.split('/')[2];
  const future = page.locator('.norm-page-header__line .r-future-text a');
  await expect(future).toHaveCount(1);
  const text = ((await future.textContent()) ?? '').replace(/\s+/gu, ' ').trim();
  const cited = text.match(/verkündet \(([^()]*)\)$/u)?.[1];
  expect(cited, text).toBeTruthy();
  // Nicht die Stammfundstelle der Kopfzeile …
  const stem = ((await page.locator('.r-kicker span', { hasText: /^Stammfundstelle/u }).textContent()) ?? '').replace(/^Stammfundstelle\s*/u, '').trim();
  expect(cited).not.toBe(stem);
  // … sondern die letzte Klammer des Vollzitats der künftigen Fassung (Such-API).
  const hit = (await searchApi(request, '?versionScope=future&includeAmendments=1')).hits.find((entry) => entry.slug === slug);
  expect(hit, `künftige Fassung von ${slug} in der Such-API`).toBeTruthy();
  const lastParenthesis = [...hit!.citation.matchAll(/\(([^()]*)\)/gu)].at(-1)?.[1]?.trim();
  expect(cited).toBe(lastParenthesis);
});

siteTest(['law'])('Restpunkte Richtung E: der Normkopf nennt den Änderungsakteur auf allen vier Ansichten gleich', async ({ page, request }) => {
  const norm = await multiVersionNorm(request);
  const lines: string[] = [];
  for (const path of [norm.current.currentUrl, `${norm.current.currentUrl}daten/`, `/norm/${norm.slug}/history/`, `/norm/${norm.slug}/vergleich/`]) {
    await page.goto(lawUrl(path));
    lines.push(((await page.locator('.norm-page-header__line').textContent()) ?? '').replace(/\s+/gu, ' ').trim());
  }
  expect(lines[0]).toMatch(/zuletzt geändert durch \S/u);
  expect(new Set(lines).size, lines.join('\n')).toBe(1);
});

siteTest(['law'])('Restpunkte Richtung E: Verzeichnisköpfe führen als Brotkrume zur Startseite, der Fuß hält die Normtypen beieinander', async ({ page }) => {
  for (const path of ['/gesetze/', '/verordnungen/', '/verwaltungsvorschriften/', '/foerderrichtlinien/']) {
    await page.goto(lawUrl(path));
    const kicker = page.locator('.r-page-head .r-kicker').first();
    await expect(kicker.locator('a').first(), path).toHaveAttribute('href', '/');
    await expect(kicker.locator('a').first(), path).toHaveText('OstRecht');
    expect((await kicker.textContent()) ?? '', path).not.toMatch(/Normtyp/u);
  }
  // Tablet-Stufe: Gesetze, Verordnungen, Verwaltungsvorschriften, Förderrichtlinien untereinander in einer Spalte.
  await page.setViewportSize({ width: 698, height: 900 });
  await page.goto(lawUrl('/'));
  const boxes = await page.locator('.law-footer__types a').evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { text: element.textContent?.trim() ?? '', left: Math.round(box.left), top: Math.round(box.top) };
  }));
  expect(boxes.map((box) => box.text)).toEqual(['Gesetze', 'Verordnungen', 'Verwaltungsvorschriften', 'Förderrichtlinien']);
  expect(new Set(boxes.map((box) => box.left)).size, 'eine Spalte').toBe(1);
  for (let index = 1; index < boxes.length; index += 1) expect(boxes[index].top).toBeGreaterThan(boxes[index - 1].top);
  await expect(page.locator('.law-footer').getByRole('navigation', { name: 'Recherchieren' }).getByRole('heading', { name: 'Nach Normtyp' })).toBeVisible();
});

siteTest(['law'])('Restpunkte Richtung E: Änderungen stehen am Ort der Änderung – im Text, in der Kopfzeile der Einheit und in der Übersicht', async ({ page, request }) => {
  await prepareFunctionalPage(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  // Eine geltende Vorschrift mit gespeicherter Vorfassung (übernommen und ostdeutsch geändert).
  const norm = await currentNormOfOrigin(request, 'inherited-amended');
  await page.goto(lawUrl(norm.currentUrl));
  const marks = page.locator('.norm-unit__change');
  expect(await marks.count(), 'geänderte oder neue Einheiten').toBeGreaterThan(0);
  const first = marks.first();
  await expect(first).toHaveText(/^(geändert|neu) mit Wirkung vom \d{2}\.\d{2}\.\d{4}$/u);
  const href = (await first.getAttribute('href')) ?? '';
  expect(href).toMatch(/\/vergleich\/\?von=[^&]+&bis=[^#]+#vergleich-/u);
  // Der geänderte Absatz trägt Randlinie und Fläche und sagt Vorlesern „geändert“.
  const changedAbs = page.locator('.norm-abs--changed');
  if (await changedAbs.count() > 0) {
    await expect(changedAbs.first().locator('.norm-abs__addr')).toContainText('geändert');
    expect(await changedAbs.first().evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
  }
  // Die Übersicht trägt die Kurzmarke mit vollständigem Text für Vorleser.
  const unitId = await first.locator('xpath=ancestor::section[@data-norm-unit][1]').getAttribute('id');
  const outlineMark = page.locator(`.norm-outline--desktop [data-outline-link="${unitId}"] .norm-outline__mark`);
  await expect(outlineMark).toHaveCount(1);
  await expect(outlineMark).toHaveAttribute('title', /mit Wirkung vom/u);
  await expect(outlineMark.locator('[aria-hidden="true"]')).toHaveText(/^(geänd\.|neu)$/u);
  // Der Link führt auf den Vergleich zur Vorfassung, dort trägt die Einheit denselben Anker.
  await page.goto(lawUrl(href));
  await expect(page.locator(`#${new URL(href, 'http://x').hash.slice(1)}`)).toBeVisible();
  // Die Ausgangsfassung selbst hat keine Vorfassung und deshalb keine Marken.
  const historical = (await searchApi(request, '?versionScope=historical&includeAmendments=1')).hits.find((hit) => hit.slug === norm.slug);
  if (historical) {
    await page.goto(lawUrl(historical.url));
    await expect(page.locator('.norm-unit__change')).toHaveCount(0);
  }
});

siteTest(['law'])('Restpunkte Richtung E: der verdichtete Normkopf begleitet das Lesen auf dem Smartphone', async ({ page, request }) => {
  await prepareFunctionalPage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(lawUrl((await multiVersionNorm(request)).current.currentUrl));
  const miniHead = page.locator('[data-norm-mini-head]');
  await expect(miniHead).toBeHidden();
  // Zusätzlicher Raum hinter dem Text erlaubt auch beim kurzen Fixture eine freie Leseposition.
  await page.locator('.norm-document').evaluate((element) => { (element as HTMLElement).style.paddingBottom = '2000px'; });
  const unit = page.locator('[data-norm-unit][id]').last();
  const label = await unit.getAttribute('data-unit-label');
  await unit.evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - window.innerHeight * 0.12 - 4, behavior: 'instant' }));
  await expect(miniHead).toBeVisible();
  await expect(miniHead.locator('[data-mini-unit]')).toHaveText(label!);
  const box = await miniHead.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  // „Inhalt“ öffnet das vorhandene Seitenblatt.
  await miniHead.getByRole('link', { name: 'Inhalt' }).click();
  await expect(page.locator('dialog.r-sheet--outline[open]')).toBeVisible();
  await expect(miniHead).toBeHidden();
  await page.locator('dialog.r-sheet--outline [data-sheet-close]').click();
  // Zurück am Seitenanfang verschwindet die Zeile; ab 48 rem gibt es sie nicht.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(miniHead).toBeHidden();
  await page.setViewportSize({ width: 1024, height: 900 });
  await unit.evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 100, behavior: 'instant' }));
  await expect(miniHead).toBeHidden();
});

siteTest(['law'])('Restpunkte Richtung E: der Änderungsdienst hat einen RSS-Feed', async ({ page, request }) => {
  await page.goto(lawUrl('/'));
  const link = page.locator('.r-home-changes .r-section-head a[data-change-feed]');
  await expect(link).toHaveText('RSS');
  const href = (await link.getAttribute('href'))!;
  expect(href).toBe('/aenderungsdienst/rss.xml');
  await expect(page.locator('head link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute('href', href);
  const response = await request.get(lawUrl(href));
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/application\/rss\+xml/u);
  const xml = await response.text();
  expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<rss version="2\.0"/u);
  expect((xml.match(/<item>/gu) ?? []).length).toBeLessThanOrEqual(15);
  expect((xml.match(/<item>/gu) ?? []).length).toBeGreaterThan(0);
  for (const [, date] of xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/gu)) expect(date).toMatch(/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/u);
  // Jeder Eintrag führt auf den Änderungsverlauf einer Vorschrift.
  for (const [, itemLink] of xml.matchAll(/<link>([^<]+)<\/link>/gu)) if (itemLink.includes('/norm/')) expect(itemLink).toMatch(/\/norm\/[^/]+\/history\/$/u);
  // Kein Eintrag in der Sitemap.
  const sitemap = await (await request.get(lawUrl('/sitemap.xml'))).text();
  expect(sitemap).not.toContain('rss.xml');
});
