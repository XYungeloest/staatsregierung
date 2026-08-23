import { expect, test } from '@playwright/test';

const lawUrl = (path: string) => new URL(path, 'http://127.0.0.1:4322').toString();

test('belegte Altadressen werden gezielt weitergeleitet und unbekannte Pfade bleiben 404', async ({ page, request }) => {
  const aliases = [
    ['/uebersicht/', '/service/uebersicht/'],
    ['/karriere/stellen/', '/service/karriere/'],
    [
      '/karriere/stellen/referentin-vergesellschaftungsrecht',
      '/service/karriere/referentin-vergesellschaftungsrecht/index.html',
    ],
    ['/ministerien/', '/staatsregierung/kabinett/'],
    [
      '/ministerien/wirtschaft-arbeitsmarkt-und-beschaeftigung',
      '/staatsregierung/kabinett/wirtschaft-arbeitsmarkt-und-beschaeftigung/index.html',
    ],
  ];

  for (const [source, target] of aliases) {
    const response = await request.get(source, { maxRedirects: 0 });
    expect(response.status(), source).toBeGreaterThanOrEqual(300);
    expect(response.status(), source).toBeLessThan(400);
    expect(response.headers().location, source).toBe(target);
  }

  const missing = await page.goto('/diese-adresse-ist-nicht-belegt/');
  expect(missing?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seite nicht gefunden');
  await expect(page.getByRole('heading', { name: 'Häufig gesuchte Bereiche' })).toBeVisible();
});

test('alte Rechtspfade führen ohne Kette permanent zur funktional gleichen OstRecht-Adresse', async ({ request }) => {
  const redirects = [
    ['/recht/suche/', '/suche/'],
    ['/recht/archiv/', '/archiv/'],
    ['/recht/verfassung/', '/norm/staatsverfassung-des-freistaates-ostdeutschland/'],
    ['/recht/norm/sero-verordnung/', '/norm/sero-verordnung/'],
    ['/recht/norm/sero-verordnung/history/', '/norm/sero-verordnung/history/'],
    ['/recht/norm/sero-verordnung/version/2026-07-21/', '/norm/sero-verordnung/version/2026-07-21/'],
    ['/recht/norm/saechsische-gemeindeordnung/vergleich/', '/norm/saechsische-gemeindeordnung/vergleich/'],
    ['/recht/verkuendungen/ogvbl-2026-58/', '/verkuendungen/ogvbl-2026-58/'],
    ['/recht/sachgebiete/bildung-und-schule/', '/sachgebiete/bildung-und-schule/'],
  ];

  for (const [source, target] of redirects) {
    const response = await request.get(source, { maxRedirects: 0 });
    expect(response.status(), source).toBe(301);
    expect(response.headers().location, source).toBe(`https://recht.freistaat-ostdeutschland.de${target}`);
  }
});

test('Rechtsbrücke trennt OstRecht-Recherche von Gesetzgebung im Staatsportal', async ({ page }) => {
  await page.goto('/recht/');
  const main = page.locator('#main-content');
  await expect(main.getByRole('heading', { name: 'Rechtsrecherche' })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Gesetzgebung und geltendes Recht' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Geltendes Recht', exact: true })).toHaveAttribute(
    'href',
    'https://recht.freistaat-ostdeutschland.de/suche/',
  );
  await expect(main.getByRole('link', { name: 'Verfassung', exact: true })).toHaveAttribute(
    'href',
    'https://recht.freistaat-ostdeutschland.de/norm/staatsverfassung-des-freistaates-ostdeutschland/',
  );
  await expect(main.getByRole('link', { name: 'Verkündungen', exact: true })).toHaveAttribute(
    'href',
    'https://recht.freistaat-ostdeutschland.de/verkuendungen/',
  );
  await expect(main.locator('form[role="search"]')).toHaveAttribute(
    'action',
    'https://recht.freistaat-ostdeutschland.de/suche/',
  );
});

test('Startseite bietet Suche, Ministerien, mobile Navigation und 115-Orientierung', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('ostrecht-portal-analytics-consent', 'rejected');
  });
  await page.goto('/');

  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.home-ministry-list a')).not.toHaveCount(0);
  await expect(page.locator('.home-resource-card', { hasText: 'Recht schnell finden' })).toBeVisible();
  await expect(page.locator('[data-visual-section="home-current-topics"]')).toBeVisible();
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
  const [searchIndexResponse, publicationIndexResponse] = await Promise.all([
    request.get(lawUrl('/search-index.json')),
    request.get(lawUrl('/verkuendungen/index.json')),
  ]);
  expect(searchIndexResponse).toBeOK();
  expect(publicationIndexResponse).toBeOK();
  const searchIndex = await searchIndexResponse.json() as { documents?: Array<{ currentUrl?: string }> };
  const publicationIndex = await publicationIndexResponse.json() as {
    latestPublication?: { slug?: string };
  };
  const normPath = searchIndex.documents?.find((document) => document.currentUrl?.startsWith('/norm/'))?.currentUrl;
  const publicationSlug = publicationIndex.latestPublication?.slug;
  expect(normPath).toBeTruthy();
  expect(publicationSlug).toBeTruthy();

  const routes = [
    '/',
    '/recht/',
    lawUrl('/'),
    lawUrl('/verfassung/'),
    lawUrl(normPath!),
    lawUrl(`/verkuendungen/${publicationSlug}/`),
    lawUrl('/search-index.json'),
    lawUrl('/verkuendungen/index.json'),
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

  await page.goto(lawUrl('/verfassung/'));
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
  await expect(page.locator('.section-hero')).toBeVisible();
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
  await expect(directory.locator('.ministry-directory__item')).not.toHaveCount(0);
  await expect(directory.locator('a[href^="/staatsregierung/kabinett/"]').first()).toBeVisible();
});

test('Regierungsprofil verbindet Porträt, Amt, Status und Kontakt im sichtbaren Kopf', async ({ page }) => {
  await page.goto('/staatsregierung/mitglieder/max-peterson/');

  const hero = page.locator('.section-hero--profile');
  await expect(hero).toBeVisible();
  await expect(hero.getByRole('heading', { level: 1 })).not.toHaveText('');
  await expect(hero.locator('.section-hero__image')).toBeVisible();
  await expect(hero.locator('figure')).toHaveCount(1);
  await expect(hero.locator('figcaption')).toHaveText('Bildnachweis: Staatsregierung');
  await expect(hero.locator('img')).toHaveAttribute('alt', /^Porträt von /u);
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
  await page.goto(lawUrl('/suche/?q=Kulturpass'));
  await expect(page.locator('[data-search-summary]')).toContainText('Treffer');
  await expect(page.locator('[data-search-results] .search-hit')).not.toHaveCount(0);

  await page.goto('/suche/?q=Kreisreform');
  await expect(page.locator('[data-portal-search-status]')).toContainText('Treffer');
});

test('OstRecht-Suche hält URL, Filterchips und Browserverlauf synchron', async ({ page }) => {
  await page.goto(lawUrl('/suche/?q=Kulturpass&type=gesetz'));

  await expect(page.locator('[data-search-query]')).toHaveValue('Kulturpass');
  await expect(page.getByLabel('Suchanfrage und Filter').getByRole('button', { name: 'Suchen' })).toBeVisible();
  await expect(page.getByLabel('Suchbereich')).toBeVisible();
  await expect(page.locator('[data-search-summary]')).toContainText('Treffer');
  const lawType = page.locator('input[name="type"][value="gesetz"]');
  await expect(lawType).toBeChecked();
  await expect(page.getByRole('button', { name: /Filter entfernen: Normtyp: Gesetz/u })).toBeVisible();

  const inForce = page.locator('input[name="status"][value="in-force"]');
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
  await expect(page).toHaveURL(`${lawUrl('/suche/')}?q=Kulturpass`);
  await expect(page.locator('[data-search-summary]')).toContainText('Treffer');
});

test('exakter ÖPNV-Änderungsvorschlag aktiviert den nötigen Suchfilter', async ({ page }) => {
  await page.goto(lawUrl('/suche/'));
  const query = page.locator('[data-search-query]');
  await query.fill('Erstes Gesetz zur Änderung des Gesetzes über den öffentlichen Personennahverkehr');
  await page.getByLabel('Suchanfrage und Filter').getByRole('button', { name: 'Suchen' }).click();
  await expect(page.locator('[data-search-filter="includeAmendments"]')).toBeChecked();
  await expect(page).toHaveURL(/includeAmendments=1/u);
  await expect(page.locator('[data-search-results]')).toContainText('Erstes Gesetz zur Änderung des Gesetzes über den öffentlichen Personennahverkehr');
});

test('Normverzeichnis stellt Filter, leere Buchstaben und Browserverlauf gemeinsam wieder her', async ({ page }) => {
  await page.goto(lawUrl('/gesetze/'));
  const query = page.locator('[data-law-filter-form] input[name="q"]');
  await query.fill('Kulturpass');
  await page.locator('[data-law-filter-form]').getByRole('button', { name: 'Filtern' }).click();
  await expect(page).toHaveURL(/q=kulturpass/u);
  await expect(page.locator('[data-law-filter-summary]')).toContainText(/Eintr(?:ag|äge)/u);
  await expect(page.locator('[data-law-filter-entry]:visible').first()).toContainText('Kulturpass');
  const state = await page.evaluate(() => ({
    groups: [...document.querySelectorAll<HTMLElement>('[data-law-filter-group]')].filter((entry) => !entry.hidden).map((entry) => entry.dataset.lawFilterGroup),
    letters: [...document.querySelectorAll<HTMLElement>('[data-law-filter-letter]')].filter((entry) => !entry.hidden).map((entry) => entry.dataset.lawFilterLetter),
  }));
  expect(state.letters).toEqual(state.groups);

  await query.fill('Verfassung');
  await page.locator('[data-law-filter-form]').getByRole('button', { name: 'Filtern' }).click();
  await page.goBack();
  await expect(query).toHaveValue('kulturpass');
  await expect(page.locator('[data-law-filter-entry]:visible').first()).toContainText('Kulturpass');
});

test('Fassungstitel, Gültigkeitsdaten und künftige Änderungen folgen dem redaktionellen Stichtag', async ({ page }) => {
  await page.goto(lawUrl('/norm/saechsische-gemeindeordnung/version/2023-11-01/'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sächsische Gemeindeordnung');
  const metadata = page.locator('[data-visual-section="norm-metadata"]');
  await expect(metadata).toContainText('1. November 2023');
  await expect(metadata).toContainText('30. Dezember 2023');

  await page.goto(lawUrl('/norm/saechsische-gemeindeordnung/'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gemeindeordnung für den Ostdeutschen Freistaat');

  await page.goto(lawUrl('/'));
  await expect(page.getByRole('heading', { name: 'Künftige Änderungen' })).toBeVisible();
  await expect(page.locator('.law-dashboard-card__future')).toContainText('tritt künftig in Kraft');
});

test('Rechtssuche ist auf jeder OstRecht-Seite im Desktop-Kopf direkt nutzbar', async ({ page }) => {
  await page.goto(lawUrl('/norm/ostdeutsches-kulturpassgesetz/'));
  const search = page.locator('.law-header-search--compact');
  await expect(search).toBeVisible();
  await search.locator('input[name="q"]').fill('Verfassung');
  await Promise.all([
    page.waitForURL(/\/suche\/\?q=Verfassung/u),
    search.getByRole('button', { name: 'Suchen' }).click(),
  ]);
  await expect(page.locator('[data-search-results]')).toContainText('Verfassung');
});

test('Normkopf unterscheidet allgemeinen und fassungsspezifischen Link und kennzeichnet Staatsportal-Bezüge', async ({ page }) => {
  await page.goto(lawUrl('/norm/erstes-gesetz-zur-grossen-staatsreform/'));
  const citationBlock = page.locator('[data-visual-section="norm-citation-status"]');
  await expect(citationBlock).toBeVisible();
  await expect(citationBlock).toContainText('Vollzitat');
  await expect(citationBlock).toContainText('Fassungsstatus');
  await expect(citationBlock.getByRole('button', { name: 'Link zur Vorschrift kopieren' })).toBeVisible();

  const portalRelations = page.locator('[data-visual-section="norm-portal-relations"]');
  await expect(portalRelations.getByRole('heading', { name: 'Im Staatsportal' })).toBeVisible();
  const crossSiteLinks = portalRelations.locator('a[href^="https://freistaat-ostdeutschland.de/"]');
  await expect(crossSiteLinks.first()).toBeVisible();

  await page.goto(lawUrl('/norm/ostdeutsches-kulturpassgesetz/version/2026-03-23/'));
  await expect(page.getByRole('button', { name: 'Link zu dieser Fassung kopieren' })).toBeVisible();

  await page.goto(lawUrl('/norm/saechsische-gemeindeordnung/version/2023-11-01/'));
  await expect(page.getByRole('button', { name: 'Link zu dieser Fassung kopieren' })).toBeVisible();
  await expect(page.getByText('Dieser Link bleibt der gespeicherten Fassung zugeordnet.')).toBeVisible();
});

test('OstRecht-Navigation und farbiges Footerwappen bleiben mobil nutzbar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(lawUrl('/'));
  const mobileNavigation = page.locator('.law-mobile-nav');
  await mobileNavigation.locator('summary').click();
  await expect(mobileNavigation.locator('.law-mobile-nav__panel')).toBeVisible();
  await expect(mobileNavigation.getByRole('link', { name: 'Rechtssuche', exact: true })).toBeVisible();

  const footer = page.locator('.law-footer');
  const coatOfArms = footer.locator('.law-footer__brand img');
  await expect(coatOfArms).toHaveAttribute('src', /favicon\.svg$/u);
  const coatOfArmsStyle = await coatOfArms.evaluate((image) => {
    const style = getComputedStyle(image);
    return { filter: style.filter, backgroundColor: style.backgroundColor, padding: style.padding };
  });
  expect(coatOfArmsStyle).toEqual({ filter: 'none', backgroundColor: 'rgba(0, 0, 0, 0)', padding: '0px' });
  await expect(footer.getByRole('navigation', { name: 'Recherchewege im Footer' }).getByRole('link')).not.toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Normgliederung besitzt eindeutige IDs und deckungsgleiche Inhaltsanker', async ({ page }) => {
  for (const path of [
    lawUrl('/norm/saechsische-gemeindeordnung/'),
    lawUrl('/norm/ostdeutsche-bezirksordnung/'),
    lawUrl('/norm/erstes-gesetz-zur-grossen-staatsreform/'),
  ]) {
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

test('Vorschriftendaten und weiterführende Bezüge überlappen nicht', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(lawUrl('/norm/erstes-gesetz-zur-grossen-staatsreform/'));

  const metadata = page.locator('[data-visual-section="norm-metadata"]');
  const relations = page.locator('[data-visual-section="norm-portal-relations"]');
  await expect(metadata).toBeVisible();
  await expect(relations).toBeVisible();
  await expect(metadata.locator('.norm-meta-panel__group > h3')).toHaveText([
    'Einordnung',
    'Rechtsstand',
    'Zitierweise und Verkündung',
    'Sachgebiete',
  ]);
  await expect(metadata).not.toContainText('Stammausgabe');
  await expect(metadata).not.toContainText('Keine historischen Fassungen gespeichert');
  await expect(relations.getByRole('heading', { name: 'Verwandte Vorschriften' })).toBeVisible();
  await expect(relations.getByRole('heading', { name: 'Themen' })).toBeVisible();

  expect(await metadata.evaluate((element) => getComputedStyle(element).position)).toBe('static');
  await relations.scrollIntoViewIfNeeded();
  const overlap = await page.evaluate(() => {
    const metadataBox = document.querySelector('[data-visual-section="norm-metadata"]')?.getBoundingClientRect();
    const relationsBox = document.querySelector('[data-visual-section="norm-portal-relations"]')?.getBoundingClientRect();
    if (!metadataBox || !relationsBox) return Number.POSITIVE_INFINITY;
    return Math.max(0, metadataBox.bottom - relationsBox.top);
  });
  expect(overlap).toBe(0);

  await page.setViewportSize({ width: 1024, height: 900 });
  expect(await page.locator('.norm-workspace').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);

  await page.setViewportSize({ width: 390, height: 844 });
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});

test('Normtabellen geben nur belastbare Kopfzellen-Scope-Werte aus', async ({ page }) => {
  await page.goto(lawUrl('/norm/gesetz-zur-anderung-des-justizgesetzes-zur-anpassung-an-die-6uxqzh/'));

  const headerCells = page.locator('.norm-table th');
  const headerCount = await headerCells.count();
  expect(headerCount).toBeGreaterThan(0);
  await expect(page.locator('.norm-table th[scope="col"]')).toHaveCount(headerCount);
  await expect(page.locator('.norm-table th[scope="row"], .norm-table th[scope="colgroup"], .norm-table th[scope="rowgroup"]')).toHaveCount(0);
});

test('Rechtsportal verwendet auf Übersichten und Suchindex dieselbe jüngste Verkündung', async ({ page, request }) => {
  const publicationIndexResponse = await request.get(lawUrl('/verkuendungen/index.json'));
  expect(publicationIndexResponse).toBeOK();
  const publicationIndex = await publicationIndexResponse.json();
  const latestPublication = publicationIndex.latestPublication;
  expect(latestPublication).toBeTruthy();
  const latestPublicationLabel = `${latestPublication.publication} ${latestPublication.year} Nr. ${latestPublication.issue}`;

  await page.goto(lawUrl('/'));
  const latestHomePublication = page.getByRole('heading', { name: 'Neu verkündet' })
    .locator('xpath=following::ol[1]')
    .locator('li')
    .first();
  await expect(latestHomePublication).toContainText(latestPublicationLabel);

  await page.goto(lawUrl('/verkuendungen/'));
  await expect(page.locator('[data-law-filter-entry]').first()).toContainText(latestPublicationLabel);

  const searchIndexResponse = await request.get(lawUrl('/search-index.json'));
  expect(searchIndexResponse).toBeOK();
  const searchIndex = await searchIndexResponse.json();
  expect(searchIndex.latestPublication).toEqual(latestPublication);
});

test('Normtext bietet stabile Anker, Fassungsnavigation und zugängliche Textwerkzeuge', async ({ page }) => {
  await page.goto(lawUrl('/norm/sero-verordnung/'));

  const versionNavigation = page.getByRole('navigation', { name: 'Fassungen und Historie' });
  await expect(versionNavigation).toBeVisible();
  await expect(versionNavigation.locator('.norm-version-picker summary')).toContainText('Geltend am');
  await versionNavigation.locator('.norm-version-picker summary').click();
  await expect(versionNavigation.getByRole('link', { name: /Geltend am/u })).toBeVisible();

  const firstUnit = page.locator('details.norm-unit').first();
  await expect(firstUnit).toHaveAttribute('id', /^paragraph-|^artikel-/u);
  const semanticId = await firstUnit.getAttribute('id');
  expect(semanticId).toBeTruthy();
  await expect(firstUnit.locator('.legacy-anchor')).toHaveAttribute('id', /^block-/u);

  await page.getByRole('button', { name: 'Alle Paragraphen schließen' }).click();
  await expect(page.locator('details.norm-unit[open]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Alle Paragraphen öffnen' }).click();
  await expect(page.locator('details.norm-unit[open]').first()).toBeVisible();

  await page.evaluate(() => {
    const testWindow = window as Window & { __printCalls?: number };
    testWindow.__printCalls = 0;
    window.print = () => {
      testWindow.__printCalls = (testWindow.__printCalls ?? 0) + 1;
    };
  });
  await page.getByRole('button', { name: 'Drucken', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls)).toBe(1);

  const unitTools = firstUnit.getByRole('navigation', { name: /Werkzeuge für/u });
  const singlePrint = unitTools.getByRole('button', { name: 'Einzeldruck' });
  await expect(singlePrint).toBeVisible();
  await singlePrint.click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls)).toBe(2);
  await expect(page.locator('body')).not.toHaveClass(/print-single-norm-unit/u);
  await expect(unitTools.getByRole('link', { name: 'Link zu dieser Stelle' })).toHaveAttribute('href', `#${semanticId}`);
  await expect(page.getByRole('heading', { name: 'Drucken und Quellen' })).toBeVisible();
});

test('Fassungsvergleich zeigt jeden geänderten Paragraphen einmal mit markiertem Volltext', async ({ page }) => {
  await page.goto('http://127.0.0.1:4322/norm/saechsische-gemeindeordnung/vergleich/?von=2023-11-01&bis=2026-08-01');
  const changedProvision = page.locator('.norm-diff__provision--changed').first();
  await expect(changedProvision).toContainText('§ 3');
  await expect(changedProvision.locator('.norm-diff__side--before del')).toBeVisible();
  await expect(changedProvision.locator('.norm-diff__side--after ins')).toBeVisible();
  await expect(page.locator('.norm-diff__context')).toHaveCount(0);
});

test('Fassungsvergleich markiert beim Archivgesetz nur den ergänzten Wortlaut', async ({ page }) => {
  await page.goto(lawUrl('/norm/archivgesetz/vergleich/'));
  const changedProvision = page.locator('.norm-diff__provision--changed');
  await expect(changedProvision).toHaveCount(1);
  await expect(changedProvision).toContainText('§ 10 Schutzfristen');
  await expect(changedProvision.locator('.norm-diff__side--before del')).toHaveCount(0);
  const insertion = changedProvision.locator('.norm-diff__side--after ins');
  await expect(insertion).toHaveCount(1);
  await expect(insertion).toContainText('oder im Transparenzportal nach dem Ostdeutschen Transparenz- und Informationsfreiheitsgesetz');
});

test('Fassungsleiste bleibt auf aktueller Fassung, Historie und Einzelfassung identisch', async ({ page }) => {
  for (const path of [
    '/norm/archivgesetz/',
    '/norm/archivgesetz/history/',
    '/norm/archivgesetz/version/2023-11-01/',
  ]) {
    await page.goto(lawUrl(path));
    const navigation = page.getByRole('navigation', { name: 'Fassungen und Historie' });
    await expect(navigation.locator('.norm-version-navigation__primary a')).toHaveText([
      'Aktuelle Fassung',
      'Historische Fassungen',
      'Änderungsverlauf',
      'Fassungsvergleich',
    ]);
    await expect(page.getByRole('navigation', { name: 'Werkzeuge zur Vorschrift' }).getByText(/vergleich/iu)).toHaveCount(0);
  }
});

test('Rechtssuche unterstützt Fassungsarten, mehrere Normtypen, Platzhalter und URL-Zustand', async ({ page }) => {
  await page.goto(lawUrl('/suche/?q=Kranken*&type=gesetz&type=verordnung'));
  await expect(page.locator('[data-search-summary]')).toContainText('Treffer');
  await expect(page.locator('input[name="type"]:checked')).toHaveCount(2);

  await page.locator('select[name="versionScope"]').selectOption('historical');
  await expect(page).toHaveURL(/versionScope=historical/u);
  await expect(page.locator('[data-search-summary]')).toContainText(/Treffer|Keine Treffer/u);

  await page.locator('select[name="versionScope"]').selectOption('current');
  await page.locator('[data-search-query]').fill('Kulturpass');
  await expect.poll(() => page.locator('[data-search-results] .search-result-group').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-search-results]')).toContainText('Kulturpass');
});

test('Rechtssuche verwendet ohne URL-Vorgabe die neueste Verkündung als Standardsortierung', async ({ page }) => {
  await page.goto(lawUrl('/suche/'));
  await expect(page.locator('select[name="sort"]')).toHaveValue('publication');
  await expect(page).not.toHaveURL(/sort=/u);
  const publicationDates = await page.locator('[data-search-results] .search-hit__facts').evaluateAll((lists) =>
    lists.map((list) => {
      const values = [...list.querySelectorAll('div')];
      return values.find((value) => value.querySelector('dt')?.textContent?.trim() === 'Verkündung')
        ?.querySelector('dd')?.textContent?.trim() ?? '';
    }),
  );
  expect(publicationDates.length).toBeGreaterThan(1);
});

test('A–Z-Stichwortindex ist nicht leer und lässt sich lokal filtern', async ({ page }) => {
  await page.goto(lawUrl('/archiv/'));
  const entries = page.locator('[data-index-entry]');
  expect(await entries.count()).toBeGreaterThan(0);
  await page.locator('[data-index-filter]').fill('Kultur');
  await expect(page.locator('[data-index-filter-status]')).toContainText('Stichwörter');
  expect(await entries.evaluateAll((nodes) => nodes.filter((node) => !(node as HTMLElement).hidden).length)).toBeGreaterThan(0);
});

test('Wappen kennzeichnet die Wortmarke in Kopf und Fuß', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', '/favicon.svg');
  await expect(page.locator('.site-wordmark img')).toHaveAttribute('src', '/favicon.svg');
  await expect(page.locator('.site-footer__wordmark img')).toHaveAttribute('src', '/favicon.svg');
});

test('Kalender, Sitemaps und strukturierte Termindaten sind erreichbar', async ({ page, request }) => {
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

  const lawSitemap = await request.get(lawUrl('/sitemap.xml'));
  expect(lawSitemap.ok()).toBe(true);
  expect(await lawSitemap.text()).toContain('<urlset');

  await page.goto('/presse/termine/');
  const firstEventLink = page.locator('a[href^="/presse/termine/"]:not([href$="kalender.ics"])').first();
  await expect(firstEventLink).toBeVisible();
  await firstEventLink.click();
  const structuredData = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
    scripts.map((script) => script.textContent ?? '').join('\n'),
  );
  expect(structuredData).toMatch(/@type/iu);
});
