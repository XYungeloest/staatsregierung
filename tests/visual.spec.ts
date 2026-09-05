import { expect, test, type Locator, type Page } from '@playwright/test';

import { normalizeSiteTargets } from '../scripts/lib/site-targets.mjs';

const lawUrl = (path: string) => new URL(path, 'http://127.0.0.1:4322').toString();
// SITE_TARGETS (portal, law) begrenzt die Suite auf die gebauten Websites; ohne Angabe laufen beide.
const selectedSiteTargets = normalizeSiteTargets(process.env.SITE_TARGETS);
const isSelected = (path: string): boolean => selectedSiteTargets.includes(path.startsWith('http://127.0.0.1:4322') ? 'law' : 'portal');

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
  { name: 'ostrecht-404', path: lawUrl('/gibt-es-nicht/') },
  { name: 'norm-kulturpass', path: lawUrl('/norm/ostdeutsches-kulturpassgesetz/') },
  { name: 'norm-gemeindeordnung-historisch', path: lawUrl('/norm/saechsische-gemeindeordnung/version/2023-11-01/') },
  { name: 'norm-sero-historie', path: lawUrl('/norm/sero-verordnung/history/') },
  { name: 'norm-gemeindeordnung-vergleich', path: lawUrl('/norm/saechsische-gemeindeordnung/vergleich/?von=2023-11-01&bis=2026-08-01') },
  { name: 'norm-staatsverfassung', path: lawUrl('/norm/staatsverfassung-des-freistaates-ostdeutschland/') },
  { name: 'norm-sero-verordnung', path: lawUrl('/norm/sero-verordnung/') },
  // Rechtsherkunft: übernommen und unverändert, übernommen und ostdeutsch geändert, ostdeutsch neu geschaffen.
  { name: 'norm-uebernommen-unveraendert', path: lawUrl('/norm/vwv-polizeibekleidungswirtschaft/') },
  { name: 'norm-uebernommen-geaendert', path: lawUrl('/norm/saechsische-gemeindeordnung/') },
  { name: 'norm-ostdeutsch-neu', path: lawUrl('/norm/zinnwald-vergesellschaftungsgesetz/') },
  { name: 'norm-bekanntmachung', path: lawUrl('/norm/bekanntmachung-bestellung-gruendungsvorstand-interflug/') },
  { name: 'ostrecht-suche-herkunft', path: lawUrl('/suche/?q=Gesetz') },
  { name: 'ostrecht-archiv-herkunft', path: lawUrl('/archiv/?buchstabe=G&herkunft=inherited-unchanged') },
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

interface OverflowEntry {
  index: number;
  leaf: boolean;
  tag: string;
  classes: string;
  left: number;
  right: number;
  width: number;
  scrollWidth: number;
  minContentWidth: number;
  depth: number;
  layout: string;
  minWidth: string;
  whiteSpace: string;
  overflowWrap: string;
  fontFamily: string;
  control: string;
  widestToken: string;
  widestTokenWidth: number;
  text: string;
  clippedBy: string;
}

interface OverflowReport {
  viewportWidth: number;
  documentWidth: number;
  bodyWidth: number;
  total: number;
  leaves: number;
  entries: OverflowEntry[];
  fontsStatus: string;
  fonts: string[];
}

const OVERFLOW_REPORT_LEAVES = 20;
const OVERFLOW_REPORT_ANCESTORS = 10;

/**
 * Kein horizontaler Überlauf: Dokument und body dürfen den Viewport um höchstens 1 px überschreiten.
 * Schlägt die Prüfung fehl, nennt die Meldung jedes Element, dessen rechte Kante über den Viewport
 * hinausragt – zuerst die ohne überlaufendes Kind (dort entsteht die Breite), dann die Vorfahren –
 * mit Kanten, Breite, scrollWidth, Umbruchregeln, berechneter Schriftfamilie, tatsächlich gesetzter
 * Plattformschrift, Formularattributen, dem längsten unbrechbaren Wort und dem Textanfang, sowie den
 * Ladezustand aller Schriftschnitte. Eine Überlaufmeldung ohne das überlaufende Element ist nutzlos.
 */
async function verifyViewport(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  const limit = dimensions.viewportWidth + 1;
  let report = '';
  if (dimensions.documentWidth > limit || dimensions.bodyWidth > limit) {
    report = await describeOverflow(page);
    await test.info().attach('ueberlauf.txt', { body: report, contentType: 'text/plain' });
    console.log(report);
  }
  expect(dimensions.documentWidth, report).toBeLessThanOrEqual(limit);
  expect(dimensions.bodyWidth, report).toBeLessThanOrEqual(limit);
}

/**
 * Überlaufende Elemente samt Schriftzustand beschreiben. Die gelisteten Elemente werden für die
 * Abfrage der tatsächlich gesetzten Plattformschrift (Chromium-DevTools-Protokoll) kurz markiert
 * und danach wieder freigegeben.
 */
async function describeOverflow(page: Page): Promise<string> {
  const data = await page.evaluate(([maxLeaves, maxAncestors]): OverflowReport => {
    const viewportWidth = window.innerWidth;
    const round = (value: number): number => Math.round(value * 10) / 10;
    const describe = (element: Element): string => {
      const classes = typeof element.className === 'string' ? element.className.trim() : '';
      return `${element.tagName.toLowerCase()}${classes ? `.${classes.split(/\s+/u).join('.')}` : ''}`;
    };
    const clippingAncestor = (element: Element): string => {
      for (let parent = element.parentElement; parent && parent !== document.documentElement; parent = parent.parentElement) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX !== 'visible') return `${describe(parent)} (overflow-x ${overflowX})`;
      }
      return '';
    };
    const controlInfo = (element: HTMLElement): string => {
      const tag = element.tagName.toLowerCase();
      if (element instanceof HTMLInputElement) {
        return `input[type=${element.type}]${element.hasAttribute('size') ? ` size=${element.getAttribute('size')}` : ''}${element.placeholder ? ` placeholder „${element.placeholder.slice(0, 40)}“` : ''}`;
      }
      if (element instanceof HTMLSelectElement) {
        const longest = Array.from(element.options).map((option) => option.text).sort((a, b) => b.length - a.length)[0] ?? '';
        return `select, längste Option „${longest.slice(0, 40)}“`;
      }
      if (element instanceof HTMLTextAreaElement) return `textarea cols=${element.cols}`;
      if (element instanceof HTMLImageElement) return `img natürlich ${element.naturalWidth}×${element.naturalHeight}, width-Attribut ${element.getAttribute('width') ?? '–'}`;
      if (['svg', 'canvas', 'video', 'iframe', 'table', 'pre'].includes(tag)) return `${tag}, width-Attribut ${element.getAttribute('width') ?? '–'}`;
      return '';
    };
    // Min-Content-Maß direkt messen: kurz width: min-content setzen, messen, zurücksetzen. Ein
    // Element, dessen Min-Content der Spaltenbreite entspricht, ist die Quelle der Breite; alles
    // andere ist nur auf die Spalte gestreckt.
    const minContentWidth = (element: HTMLElement): number => {
      const previous = element.style.getPropertyValue('width');
      const priority = element.style.getPropertyPriority('width');
      element.style.setProperty('width', 'min-content', 'important');
      const width = element.getBoundingClientRect().width;
      if (previous) element.style.setProperty('width', previous, priority);
      else element.style.removeProperty('width');
      return round(width);
    };
    const layoutOf = (style: CSSStyleDeclaration): string => {
      if (style.display.includes('grid')) return `${style.display} [${style.gridTemplateColumns}]`;
      if (style.display.includes('flex')) return `${style.display} ${style.flexWrap}`;
      return style.display;
    };
    const depthOf = (element: Element): number => {
      let depth = 0;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) depth += 1;
      return depth;
    };
    const widestToken = (element: HTMLElement): { token: string; width: number } => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const best = { token: '', width: 0 };
      let scanned = 0;
      for (let node = walker.nextNode(); node && scanned < 500; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        const pattern = /\S+/gu;
        for (let match = pattern.exec(text); match && scanned < 500; match = pattern.exec(text)) {
          scanned += 1;
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const width = range.getBoundingClientRect().width;
          if (width > best.width) {
            best.token = match[0].slice(0, 40);
            best.width = round(width);
          }
        }
      }
      return best;
    };

    const found: Array<{ element: HTMLElement; entry: OverflowEntry }> = [];
    for (const element of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.right <= viewportWidth + 1) continue;
      const style = getComputedStyle(element);
      found.push({
        element,
        entry: {
          index: 0,
          leaf: true,
          tag: element.tagName.toLowerCase(),
          classes: typeof element.className === 'string' ? element.className.trim() : '',
          left: round(rect.left),
          right: round(rect.right),
          width: round(rect.width),
          scrollWidth: element.scrollWidth,
          minContentWidth: 0,
          depth: depthOf(element),
          layout: layoutOf(style),
          minWidth: style.minWidth,
          whiteSpace: style.whiteSpace,
          overflowWrap: style.overflowWrap,
          fontFamily: style.fontFamily,
          control: controlInfo(element),
          widestToken: '',
          widestTokenWidth: 0,
          text: (element.innerText || element.textContent || '').replace(/\s+/gu, ' ').trim().slice(0, 40),
          clippedBy: clippingAncestor(element),
        },
      });
    }
    const overflowing = new Set(found.map((item) => item.element));
    for (const item of found) {
      item.entry.minContentWidth = minContentWidth(item.element);
      item.entry.leaf = !Array.from(item.element.querySelectorAll<HTMLElement>('*')).some((descendant) => overflowing.has(descendant));
      if (item.entry.leaf) {
        const token = widestToken(item.element);
        item.entry.widestToken = token.token;
        item.entry.widestTokenWidth = token.width;
      }
    }
    // Quelle zuerst: größtes Min-Content-Maß, bei Gleichstand das tiefere Element.
    const bySource = (a: { entry: OverflowEntry }, b: { entry: OverflowEntry }): number => b.entry.minContentWidth - a.entry.minContentWidth || b.entry.depth - a.entry.depth || b.entry.right - a.entry.right;
    const leaves = found.filter((item) => item.entry.leaf).sort(bySource);
    const ancestors = found.filter((item) => !item.entry.leaf).sort(bySource);
    const kept = [...leaves.slice(0, maxLeaves), ...ancestors.slice(0, maxAncestors)];
    kept.forEach(({ element, entry }, position) => {
      entry.index = position + 1;
      element.setAttribute('data-overflow-report', String(entry.index));
    });
    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      total: found.length,
      leaves: leaves.length,
      entries: kept.map(({ entry }) => entry),
      fontsStatus: document.fonts.status,
      fonts: Array.from(document.fonts).map((face) => `${face.family} ${face.weight} ${face.style}: ${face.status}`),
    };
  }, [OVERFLOW_REPORT_LEAVES, OVERFLOW_REPORT_ANCESTORS] as const);

  const platformFonts = new Map<number, string>();
  try {
    const client = await page.context().newCDPSession(page);
    await client.send('DOM.enable');
    await client.send('CSS.enable');
    const { root } = await client.send('DOM.getDocument', { depth: 0 });
    for (const entry of data.entries) {
      const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-overflow-report="${entry.index}"]` });
      if (!nodeId) continue;
      const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId });
      platformFonts.set(entry.index, fonts.map((font) => `${font.familyName} (${font.isCustomFont ? 'Webfont' : 'System'}, ${font.glyphCount} Glyphen)`).join(', ') || '–');
    }
    await client.detach();
  } catch {
    // Ohne DevTools-Protokoll (anderer Browser) bleibt nur die berechnete Schriftfamilie.
  }
  await page.evaluate(() => {
    document.querySelectorAll('[data-overflow-report]').forEach((element) => element.removeAttribute('data-overflow-report'));
  });

  const listedLeaves = data.entries.filter((entry) => entry.leaf).length;
  const header = `Horizontaler Überlauf bei ${data.viewportWidth} px Viewport: Dokument ${data.documentWidth} px, body ${data.bodyWidth} px; ${data.total} Element(e) ragen über den rechten Rand, davon ${data.leaves} ohne überlaufendes Kind; sortiert nach Min-Content-Maß (die Quelle der Breite zuerst), gelistet ${listedLeaves} Blatt/Blätter und ${data.entries.length - listedLeaves} Vorfahr(en):`;
  const lines = data.entries.map((entry) => [
    `  ${entry.index}. [${entry.leaf ? 'Blatt' : 'Vorfahr'} Tiefe ${entry.depth}] <${entry.tag}${entry.classes ? ` class="${entry.classes}"` : ''}>`,
    `Min-Content ${entry.minContentWidth} · links ${entry.left} · rechts ${entry.right} · Breite ${entry.width} · scrollWidth ${entry.scrollWidth} · ${entry.layout} · min-width ${entry.minWidth} · white-space ${entry.whiteSpace} · overflow-wrap ${entry.overflowWrap}`,
    `font-family ${entry.fontFamily}`,
    `gesetzt: ${platformFonts.get(entry.index) ?? 'unbekannt'}`,
    entry.control,
    entry.widestToken ? `längstes Wort „${entry.widestToken}“ ${entry.widestTokenWidth} px` : '',
    entry.clippedBy ? `abgeschnitten durch ${entry.clippedBy}` : '',
    entry.text ? `Text „${entry.text}“` : '',
  ].filter(Boolean).join(' · '));
  return [header, ...lines, `Schriften (document.fonts.status ${data.fontsStatus}): ${data.fonts.join('; ') || 'keine @font-face-Regeln'}`].join('\n');
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
    // Die Liste sortiert nach jüngstem Rechtsereignis; das Archivgesetz (übernommen, unverändert)
    // wird über den Freitextfilter auf die erste Seite geholt.
    path: lawUrl('/rechtsentwicklung/?q=Archivgesetz'),
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
    name: 'norm-herkunft-module',
    path: lawUrl('/norm/saechsische-gemeindeordnung/'),
    shots: [
      ['norm-rechtsstand-uebernommen-geaendert', '[data-visual-section="norm-legal-status"]'],
    ],
  },
  {
    name: 'norm-herkunft-unveraendert-module',
    path: lawUrl('/norm/vwv-polizeibekleidungswirtschaft/'),
    shots: [
      ['norm-rechtsstand-uebernommen-unveraendert', '[data-visual-section="norm-legal-status"]'],
    ],
  },
  {
    name: 'rechtssuche-herkunft-module',
    path: lawUrl('/suche/?q=Interflug'),
    shots: [
      ['rechtssuche-treffer-herkunft', '[data-search-results] .search-result-group:first-child > .search-hit'],
    ],
  },
  {
    name: 'archiv-herkunft-module',
    path: lawUrl('/archiv/'),
    shots: [
      ['archiv-rechtsherkunft', '[data-visual-section="law-origin-overview"]'],
      ['archiv-liste-herkunft', '[data-index-list] > li:first-child'],
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

/**
 * Seiten mit nachgeladenem Inhalt erst im Endzustand aufnehmen: Der Fassungsvergleich lädt das
 * in der Adresse gewählte Paar nach dem Seitenaufbau nach; die Aufnahme wartet, bis genau dieses
 * Paar angezeigt und die Statuszeile leer ist (sonst zeigt die Baseline einen Zwischenstand).
 */
async function awaitSettled(page: Page, path: string): Promise<void> {
  const url = new URL(path, 'http://127.0.0.1');
  if (path.includes('/vergleich/')) {
    const from = url.searchParams.get('von');
    const to = url.searchParams.get('bis');
    if (from && to) await expect(page.locator('[data-compare-output]')).toHaveAttribute('data-compare-pair', `${from}::${to}`);
    await expect(page.locator('[data-compare-feedback]')).toHaveText('');
  }
  // Die Rechtssuche lädt Kandidaten und Treffer nach dem Seitenaufbau; erst der fertige
  // Trefferstand („n Treffer“ oder „Keine Treffer“) ist die Baseline.
  if (path.startsWith('http://127.0.0.1:4322') && url.pathname === '/suche/') {
    const summary = page.locator('[data-search-summary]');
    await expect(summary).toBeVisible();
    await expect(summary).not.toContainText(/werden geladen/u);
    await expect(summary).toContainText(/Treffer/u);
  }
}

for (const entry of visualPages) {
  if (!isSelected(entry.path)) continue;
  test(`visuelle Basislinie: ${entry.name}`, async ({ page }) => {
    await preparePage(page);
    await page.goto(entry.path);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await awaitSettled(page, entry.path);
    await verifyViewport(page);
    await expect(page).toHaveScreenshot(`${entry.name}.png`);
  });
}

/** Portal-Seiten nur prüfen, wenn das Staatsportal ausgewählt ist (SITE_TARGETS); OstRecht-Läufe überspringen sie. */
const portalTest = isSelected('/') ? test : test.skip;
const lawTest = isSelected('http://127.0.0.1:4322/') ? test : test.skip;

lawTest('Komponenten-Basislinie: mobile OstRecht-Navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'Die geöffnete mobile Navigation wird einmal bei 390 Pixeln geprüft.');
  await preparePage(page);
  await page.goto(lawUrl('/'));
  await page.locator('.law-mobile-nav > summary').click();
  await expectSectionScreenshot(page.locator('.law-mobile-nav__panel'), 'recht-mobile-navigation.png');
  await verifyViewport(page);
});

for (const entry of componentVisualPages) {
  if (!isSelected(entry.path)) continue;
  test(`Komponenten-Basislinien: ${entry.name}`, async ({ page }) => {
    await preparePage(page);
    await page.goto(entry.path);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await awaitSettled(page, entry.path);

    if (entry.name === 'rechtssuche-module') {
      await page.locator('.law-search-filters-panel').evaluate((element) => {
        (element as HTMLDetailsElement).open = true;
      });
      // Die aufklappbaren Filtergruppen (Norm und Zuständigkeit, Zeitraum und Fundstelle)
      // werden für die Basislinie geöffnet, damit auch der Herkunftsfacet sichtbar ist.
      await page.locator('[data-search-filter-panel]').evaluateAll((elements) => {
        for (const element of elements) (element as HTMLDetailsElement).open = true;
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

portalTest('Komponenten-Basislinien: Kreisreform-Suche, Kartensperre und Tabellenzugang', async ({ page }) => {
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

portalTest('Kreisreform: Suche funktioniert ohne Kartenstart', async ({ page }) => {
  await preparePage(page);
  await page.goto('/kreisreform/');

  const input = page.locator('[data-kreisreform-search-input]');
  await expect(input).toBeVisible();
  await input.fill('Abtsbessingen');
  await expect(page.locator('[data-kreisreform-search-result]')).toHaveCount(1, { timeout: 15_000 });
  await page.locator('[data-kreisreform-search-result]').click();
  await expect(page.locator('[data-kreisreform-search-detail]')).toBeVisible();
});

portalTest('Portalsuche: Zustände schließen sich gegenseitig aus', async ({ page }) => {
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

portalTest('Haushalt: Jahrwechsel und Einzelplanfilter sind eindeutig bedienbar', async ({ page }) => {
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

portalTest('Haushalt: Kopfbereich hat einen verlässlichen Innenabstand', async ({ page }) => {
  await preparePage(page);
  await page.goto('/haushalt/');

  const header = page.locator('.section-hero--budget').first();
  const heading = header.getByRole('heading', { level: 1 });
  const [headerBox, headingBox] = await Promise.all([header.boundingBox(), heading.boundingBox()]);

  expect(headerBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect((headingBox?.x ?? 0) - (headerBox?.x ?? 0)).toBeGreaterThanOrEqual(24);
});

portalTest('Kreisreform: Kartenansicht ist kontrolliert und lesbar', async ({ page }) => {
  await preparePage(page);
  await page.goto('/kreisreform/');

  const gate = page.locator('[data-map-gate]');
  await expect(gate).toHaveCount(1);
  await page.locator('[data-map-load]').click();

  await expect(page.locator('[data-map-status]')).toContainText(/Karte bereit|Karte konnte nicht geladen werden/, { timeout: 20_000 });
  await verifyViewport(page);
  await expect(gate).toHaveScreenshot('kreisreform-karte.png');
});

portalTest('Consent-Hinweis ist lesbar und ablehnbar', async ({ page }) => {
  await preparePage(page, '');
  await page.goto('/');

  const banner = page.locator('#analytics-consent-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveScreenshot('consent.png');
  await banner.getByRole('button', { name: 'Nur notwendige Funktionen nutzen' }).click();
  await expect(banner).toBeHidden();
});
