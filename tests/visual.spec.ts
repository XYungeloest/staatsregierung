import { expect, test, type Locator, type Page } from '@playwright/test';

import { normalizeSiteTargets } from '../scripts/lib/site-targets.mjs';
import { siteConfig } from '@ostrecht/shared/config/site.ts';
import { getSubjectSlug } from '@ostrecht/shared/lib/norms/routes.ts';
import { DEFAULT_PORTAL_PAGE_SIZE } from '@ostrecht/shared/lib/portal/pagination.ts';
import { fixturePublication, fixtureRole, fixtureSearchWord, fixtureVersion, LAW_ORIGIN, multiVersionNorm } from './helpers/law-runtime.ts';

const lawUrl = (path: string) => new URL(path, LAW_ORIGIN).toString();
// SITE_TARGETS (portal, law) begrenzt die Suite auf die gebauten Websites; ohne Angabe laufen beide.
const selectedSiteTargets = normalizeSiteTargets(process.env.SITE_TARGETS);
const isSelected = (path: string): boolean => selectedSiteTargets.includes(path.startsWith(LAW_ORIGIN) ? 'law' : 'portal');

// OstRecht-Motive beschreiben Seitenrollen; welche Vorschrift sie zeigen, bestimmt das synthetische
// Testfixture (data/recht/runtime-fixture.json, tests/helpers/fixture-corpus.ts) – keine realen Normen.
const fixture = {
  original: fixtureRole('ostdeutsch-original'),
  amended: fixtureRole('inherited-amended'),
  unchanged: fixtureRole('inherited-unchanged'),
  constitution: fixtureRole('constitution'),
  noticeOnly: fixtureRole('notice-only'),
  bekanntmachung: fixtureRole('bekanntmachung'),
  portalRelations: fixtureRole('portal-relations'),
  amendedHistorical: fixtureVersion('inherited-amended', 'historical'),
  amendedCurrent: fixtureVersion('inherited-amended', 'current'),
  publication: fixturePublication('detail'),
  multiHit: fixtureSearchWord('multi-hit'),
  originalWord: fixtureSearchWord('ostdeutsch-original'),
  unchangedWord: fixtureSearchWord('inherited-unchanged'),
};
const searchUrl = (word: string) => lawUrl(`/suche/?q=${encodeURIComponent(word)}`);
const compareUrl = lawUrl(`/norm/${fixture.amended}/vergleich/?von=${fixture.amendedHistorical}&bis=${fixture.amendedCurrent}`);

/**
 * Screenshot-Suite (docs/DEPLOYMENT_RUNBOOK.md, Abschnitt Screenshot-Suite).
 *
 * Ein Bild prüft eine **visuelle Rolle**, nicht einen bestimmten Inhalt. Drei Regierungsmitglieder,
 * fünf Haushaltsseiten oder sieben Normseiten zeigen dieselbe Rolle mit anderen Daten; sie
 * erzeugen keine zusätzliche Regressionsdeckung, nur zusätzliche Bilder, die bei jeder Inhalts-
 * pflege veralten. Was der Aufbau leistet – Überlauf, Schrifttokens, Rasterspalten, sichtbare
 * Navigation, Fokus, Anker, Blätterung –, prüfen die Messungen am Ende dieser Datei und die
 * DOM-Tests; das gehört nicht zusätzlich in ein Pixelbild.
 *
 * Viewports: `desktop-wide` und `mobile-390` als Standard. `desktop-schmal` (1152 px = 72 rem)
 * läuft nur für die Motive mit `schmal: true` – dort, wo das Band 64–80 rem eigene Regeln hat
 * (zweizeiliger Kopf beider Websites, zweispaltiger Normarbeitsbereich). Ein Tablet-Viewport
 * existiert nicht mehr: bei 768 px sind beide Köpfe bereits im Menüzustand, das Bild wiederholte
 * `mobile-390`.
 *
 *   - visual-critical (`@critical`, npm run test:visual:critical): Auswahl für Pull Requests.
 *   - visual-extended (npm run test:visual:extended): alle Motive – geplant (wöchentlich) und
 *     manuell, nicht im normalen main-Deploy.
 *
 * Kanonische Plattform ist Linux; die Baselines entstehen mit `npm run test:visual:update:linux`
 * (Docker) oder dem Workflow „Screenshot-Baselines erneuern“.
 */
interface VisualPage {
  name: string;
  path: string;
  /** Teil der kritischen Suite (Pull Requests). */
  critical?: boolean;
  /** Zusätzlich auf dem schmalen Desktop-Viewport (eigenes Verhalten zwischen 64 und 80 rem). */
  schmal?: boolean;
}

/**
 * Ganzseitige Motive: je Website Rahmen, ein Listentemplate, ein Detailtemplate, die Suche und die
 * Fehlerseite. Jede weitere Seite desselben Templates ist bewusst nicht enthalten.
 */
const visualPages: VisualPage[] = [
  // Rahmen des Staatsportals: Kopf, Wortmarke, Kopfwerkzeuge, Hauptnavigation, Zugangsraster.
  { name: 'startseite', path: '/', critical: true, schmal: true },
  // Kartenraster mit Bereichsnavigation; vertritt Kabinett, Staatsregierung, Presse und Service.
  { name: 'themen', path: '/themen/', critical: true },
  // Detailtemplate mit Hero, Briefing und Modulen; vertritt alle Themenseiten.
  { name: 'thema-volksbefragung', path: '/themen/volksbefragung-2026/' },
  // Personenprofil; vertritt Staatsrat, Regierungsarchiv und die Ressortprofile.
  { name: 'regierungsmitglied-max-peterson', path: '/staatsregierung/mitglieder/max-peterson/' },
  // Portalsuche: Formular und Bereichsgruppierung, anderes Muster als die Rechtssuche.
  { name: 'portalsuche', path: '/suche/', critical: true },
  // Rahmen des Rechtsportals: eigener Kopf, eigene Farbwelt, Recherchewege.
  { name: 'ostrecht', path: lawUrl('/'), critical: true, schmal: true },
  // Rechtssuche im Endzustand; vertritt Suchkopf, Zusammenfassung und Trefferliste.
  { name: 'ostrecht-suche', path: searchUrl(fixture.multiHit), critical: true },
  // Verzeichnistemplate mit Filterleiste; vertritt A–Z, Sachgebiete, Verkündungen und Förderrichtlinien.
  { name: 'ostrecht-gesetze', path: lawUrl('/gesetze/') },
  // Normseite in drei Stufen; vertritt alle Normrollen des Fixtures.
  { name: 'norm-uebernommen-geaendert', path: lawUrl(`/norm/${fixture.amended}/`), critical: true, schmal: true },
  // Eigene Fehlergestalt mit eigenem Rahmen.
  { name: 'ostrecht-404', path: lawUrl('/gibt-es-nicht/') },
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
  chains: string[];
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
      const previousWidth = element.style.getPropertyValue('width');
      const widthPriority = element.style.getPropertyPriority('width');
      const previousDisplay = element.style.getPropertyValue('display');
      const inline = getComputedStyle(element).display === 'inline';
      // Inline-Elemente ignorieren width; als inline-block gemessen liefern sie ihr Min-Content
      // (bei white-space: nowrap die ganze Zeile).
      if (inline) element.style.setProperty('display', 'inline-block', 'important');
      element.style.setProperty('width', 'min-content', 'important');
      const width = element.getBoundingClientRect().width;
      if (previousWidth) element.style.setProperty('width', previousWidth, widthPriority);
      else element.style.removeProperty('width');
      if (inline) {
        if (previousDisplay) element.style.setProperty('display', previousDisplay);
        else element.style.removeProperty('display');
      }
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

    // Absteigekette: von einer Quelle abwärts jeweils das Kind mit dem größten Min-Content, bis kein
    // Kind mehr die Breite trägt – so erscheint das ursächliche Element auch dann, wenn es selbst
    // innerhalb des Viewports bleibt (z. B. eine nowrap-Zeile hinter dem Innenabstand des Vorfahren).
    const chainFrom = (start: HTMLElement): string => {
      const steps: string[] = [];
      let current: HTMLElement = start;
      for (let level = 0; level < 12; level += 1) {
        const children = Array.from(current.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
        if (children.length === 0) break;
        const measured = children.map((child) => ({ child, width: minContentWidth(child) })).sort((a, b) => b.width - a.width);
        const next = measured[0];
        if (!next || next.width < minContentWidth(current) * 0.5) break;
        const style = getComputedStyle(next.child);
        const token = widestToken(next.child);
        steps.push(`${describe(next.child)} [${next.width}${style.whiteSpace !== 'normal' ? `, white-space ${style.whiteSpace}` : ''}${style.overflowWrap !== 'normal' ? `, overflow-wrap ${style.overflowWrap}` : ''}${token.token ? `, längstes Wort „${token.token}“ ${token.width} px` : ''}]`);
        current = next.child;
      }
      return steps.length > 0 ? `${describe(start)} [${minContentWidth(start)}] → ${steps.join(' → ')}` : '';
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
    const chains = [leaves[0], ancestors[0]].filter((item): item is { element: HTMLElement; entry: OverflowEntry } => Boolean(item)).map(({ element }) => chainFrom(element)).filter(Boolean);
    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      total: found.length,
      leaves: leaves.length,
      chains,
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
  const chains = data.chains.map((chain) => `Kette (Min-Content je Ebene): ${chain}`);
  return [header, ...lines, ...chains, `Schriften (document.fonts.status ${data.fontsStatus}): ${data.fonts.join('; ') || 'keine @font-face-Regeln'}`].join('\n');
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

interface ComponentVisualPage {
  name: string;
  path: string;
  shots: ReadonlyArray<readonly [string, string]>;
  critical?: boolean;
  schmal?: boolean;
}

const componentVisualPages: ComponentVisualPage[] = [
  {
    // Referenzliste ohne Karte: eigenes Listenmuster der Startseite.
    name: 'startseite-module',
    path: '/',
    shots: [['startseite-aktuelles-vorhaben', '[data-visual-section="home-current-topics"]']],
    critical: true,
  },
  {
    // Serviceband und Footer stehen auf keiner Seitenaufnahme, weil die nur den Viewport zeigt.
    name: 'service-module',
    path: '/service/',
    shots: [
      ['globales-serviceband', '[data-visual-section="global-service-band"]'],
      ['globaler-footer', '[data-visual-section="global-footer"]'],
    ],
  },
  {
    // Eintragskomponente der Ministeriumsverzeichnisse; ein Ort statt zwei gleichen.
    name: 'staatsregierung-module',
    path: '/staatsregierung/',
    shots: [['regierung-ministerium', '[data-visual-section="government-ministry-directory"] .ministry-directory__item:first-child']],
  },
  {
    // Bildfläche mit Nachweiszeile und die Meta-Tafel; letztere vertritt alle `.meta-panel`.
    name: 'regierungsmitglied-module',
    path: '/staatsregierung/mitglieder/max-peterson/',
    shots: [
      ['mitglied-hero-bildnachweis', '.section-hero__media'],
      ['mitglied-profil-kontakt', '[data-visual-section="member-biography-profile"] > .meta-panel'],
    ],
  },
  {
    // Einzige Themenmodulform mit eigener Geometrie (Achse und Marken).
    name: 'themendetail-module',
    path: '/themen/volksbefragung-2026/',
    shots: [['thema-ablauf', '[data-topic-module="timeline"]']],
  },
  {
    // Kennzahlenkarten mit Jahreswahl (vertritt alle Haushaltsseiten) und die einzige breite
    // Datentabelle mit eigenem Rollrahmen.
    name: 'haushalt-module',
    path: '/haushalt/',
    shots: [
      ['haushalt-jahreswahl-kennzahlen', '[data-visual-section="budget-year-kpis"]'],
      ['haushalt-tabelle', '[data-visual-section="budget-table"] .table-wrap'],
    ],
    critical: true,
  },
  {
    // Einziges SVG-Schaubild mit eigener Geometrie.
    name: 'schulsystem-module',
    path: '/themen/bildung-und-schule/schulsystem/',
    shots: [['schulsystem-grafik', '[data-visual-section="school-system-chart"]']],
  },
  {
    // Eigener Footer des Rechtsportals mit Recherchewegen.
    name: 'recht-module',
    path: lawUrl('/'),
    shots: [['recht-footer', '.law-footer']],
  },
  {
    // Aufgeklappte Facettengruppen und die Trefferkarte mit Herkunftskennzeichnung.
    name: 'rechtssuche-module',
    path: searchUrl(fixture.multiHit),
    shots: [
      ['rechtssuche-filter', '[data-search-filter-panel="more"]'],
      ['rechtssuche-treffer-herkunft', '[data-search-results] .search-result-group:first-child > .search-hit'],
    ],
  },
  {
    // Arbeitsbereich der Normseite: Vorschriftendaten, Fassungswahl, Beginn des Vorschriftentextes.
    name: 'norm-module',
    path: lawUrl(`/norm/${fixture.amended}/`),
    shots: [
      ['norm-vorschriftendaten', '[data-visual-section="norm-facts"]'],
      ['norm-navigation', '.norm-version-navigation'],
      ['normtext-beginn', '[data-visual-section="norm-text"] .norm-unit:first-of-type'],
    ],
  },
  {
    // Einzige Stelle mit ins/del-Auszeichnung.
    name: 'fassungsvergleich-module',
    path: compareUrl,
    shots: [['fassungsvergleich-aenderung', '.norm-diff__provision--changed:first-of-type']],
  },
  {
    // Historienpanel mit Ereignisliste; vertritt alle Historiedarstellungen.
    name: 'normhistorie-module',
    path: lawUrl(`/norm/${fixture.amended}/history/`),
    shots: [['normhistorie-einstieg', '.norm-history-panel--versions']],
  },
];

const CRITICAL_TAG = '@critical';
/**
 * Der schmale Desktop-Viewport (1152 px) läuft nur für Motive, in denen das Band 64–80 rem eigene
 * Regeln hat. Er gilt in beiden Suiten gleich: eine Rolle ohne eigenes Verhalten in diesem Band
 * bekäme dort nur ein drittes Bild derselben Gestalt.
 */
function skipSchmalUnless(entry: { schmal?: boolean }, projectName: string, testInfo: { project: { name: string } }): void {
  test.skip(projectName === 'desktop-schmal' && !entry.schmal, 'Der schmale Desktop-Viewport prüft nur Motive mit eigenem Verhalten zwischen 64 und 80 rem');
  void testInfo;
}

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
  if (path.startsWith(LAW_ORIGIN) && url.pathname === '/suche/') {
    const summary = page.locator('[data-search-summary]');
    await expect(summary).toBeVisible();
    await expect(summary).not.toContainText(/werden geladen/u);
    await expect(summary).toContainText(/Treffer/u);
  }
}

for (const entry of visualPages) {
  if (!isSelected(entry.path)) continue;
  test(`visuelle Basislinie: ${entry.name}`, { tag: entry.critical ? [CRITICAL_TAG] : [] }, async ({ page }, testInfo) => {
    skipSchmalUnless(entry, testInfo.project.name, testInfo);
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
const lawTest = isSelected(`${LAW_ORIGIN}/`) ? test : test.skip;

/**
 * Messungen statt Bilder (Befunde E1, E3): Sie prüfen die Stufen des Normarbeitsbereichs und die
 * Höhe des mobilen Kopfs in Zahlen, laufen also auch dort, wo kein Pixelvergleich stattfindet.
 * Die Vorschrift wird zur Laufzeit aus der Kandidaten-API abgeleitet, nicht fest verdrahtet.
 */
lawTest('Messung: Normarbeitsbereich ist zwischen 64 und 80 rem zweispaltig', { tag: [CRITICAL_TAG] }, async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-wide', 'Die 64–80-rem-Stufe wird einmal bei 1280 Pixeln gemessen.');
  await preparePage(page);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(lawUrl((await multiVersionNorm(request)).current.currentUrl));
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const columns = await page.locator('.norm-workspace').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(columns, 'Inhaltsübersicht und Text stehen nebeneinander').toBe(2);
  await expect(page.locator('.norm-outline--desktop')).toBeVisible();
  await expect(page.locator('.norm-outline-mobile')).toBeHidden();
  // Die Vorschriftendaten stehen darunter über beide Spalten.
  const spans = await page.locator('.norm-info-column').evaluate((element) => {
    const workspace = element.closest('.norm-workspace')!;
    return element.getBoundingClientRect().width / workspace.getBoundingClientRect().width;
  });
  expect(spans, 'Vorschriftendaten spannen über beide Spalten').toBeGreaterThan(0.9);
  await verifyViewport(page);
});

lawTest('Messung: mobil beginnt der Vorschriftentext oberhalb von 700 Pixeln', { tag: [CRITICAL_TAG] }, async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'Die Höhe des mobilen Kopfs wird auf den Mobilbreiten gemessen.');
  await preparePage(page);
  await page.goto(lawUrl((await multiVersionNorm(request)).current.currentUrl));
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const headerHeight = await page.locator('.norm-page-header').evaluate((element) => element.getBoundingClientRect().height);
  expect(headerHeight, 'Normkopf').toBeLessThanOrEqual(320);
  const textTop = await page.locator('#normtext').evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  expect(textTop, 'Beginn des Vorschriftentextes').toBeLessThanOrEqual(700);
  // Die Angaben zur Vorschrift stehen als geschlossene Zeile vor Inhaltsübersicht und Text.
  const facts = page.locator('.norm-facts');
  await expect(facts).not.toHaveAttribute('open', /.*/u);
  const factsTop = await facts.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  expect(factsTop, 'Angaben zur Vorschrift stehen über dem Text').toBeLessThan(textTop);
  await verifyViewport(page);
});

lawTest('Komponenten-Basislinie: mobile OstRecht-Navigation', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'Die geöffnete mobile Navigation wird einmal bei 390 Pixeln geprüft.');
  await preparePage(page);
  await page.goto(lawUrl('/'));
  await page.locator('.law-mobile-nav > summary').click();
  await expectSectionScreenshot(page.locator('.law-mobile-nav__panel'), 'recht-mobile-navigation.png');
  await verifyViewport(page);
});

/**
 * Trefferdichte der Rechtssuche: eine ungeöffnete Trefferkarte bleibt auf einem 375 Pixel breiten
 * Bildschirm höchstens 220 Pixel hoch, damit auf einer Bildschirmhöhe mehr als ein Treffer steht.
 * Das Suchwort stammt aus dem Manifest des synthetischen Fixtures; ergibt es nur einen Treffer,
 * wird das nächste genommen (die Messung braucht mehrere Karten, keine bestimmte Anzahl).
 */
lawTest('Trefferdichte bei 375 px', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'Die Trefferdichte wird einmal bei 375 Pixeln gemessen.');
  await preparePage(page);
  await page.setViewportSize({ width: 375, height: 812 });
  const words = [fixture.multiHit, fixture.originalWord, fixture.unchangedWord];
  let hits: Array<{ height: number; open: boolean; text: string }> = [];
  let used = '';
  for (const word of words) {
    await page.goto(searchUrl(word));
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await awaitSettled(page, searchUrl(word));
    hits = await page.locator('[data-search-results] .search-result-group > .search-hit').evaluateAll((elements) => elements.map((element) => ({
      height: Math.round(element.getBoundingClientRect().height),
      open: Boolean(element.querySelector('details[open]')),
      text: (element.querySelector('h3')?.textContent ?? '').trim().slice(0, 60),
    })));
    used = word;
    if (hits.length > 1) break;
  }
  test.skip(hits.length < 2, `Das Fixture liefert zu „${used}“ nur ${hits.length} Treffer; die Dichte braucht mehrere Karten.`);
  const tooTall = hits.filter((hit) => hit.height > 220);
  if (tooTall.length > 0) {
    const report = [`Suchwort: ${used}`, `Treffer: ${hits.length}`, ...hits.map((hit) => `${String(hit.height).padStart(4)} px  ${hit.open ? 'offen ' : 'zu    '}${hit.text}`)].join('\n');
    await test.info().attach('trefferdichte.txt', { body: report, contentType: 'text/plain' });
    console.log(report);
  }
  expect(tooTall.map((hit) => `${hit.height} px: ${hit.text}`), 'jede ungeöffnete Trefferkarte bleibt bei 375 px unter 220 px').toEqual([]);
  await verifyViewport(page);
});

for (const entry of componentVisualPages) {
  if (!isSelected(entry.path)) continue;
  test(`Komponenten-Basislinien: ${entry.name}`, { tag: entry.critical ? [CRITICAL_TAG] : [] }, async ({ page }, testInfo) => {
    skipSchmalUnless(entry, testInfo.project.name, testInfo);
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

    // Die Vorschriftendaten sind unterhalb von 80 rem ein Aufklappbereich; die Baseline zeigt sie offen.
    if (entry.shots.some(([, selector]) => selector.includes('norm-facts'))) {
      await page.locator('.norm-facts').evaluate((element) => {
        (element as HTMLDetailsElement).open = true;
      });
    }

    for (const [name, selector] of entry.shots) {
      await expectSectionScreenshot(page.locator(selector), `${name}.png`);
    }
    await verifyViewport(page);
  });
}

/**
 * Die Freigabefläche vor dem Nachladen externer Kacheln ist eine eigene visuelle Rolle: sie hält
 * die Karte zurück, bis der Nutzer zustimmt. Suchtreffer und Tabellenfilter der Kreisreformseite
 * sind dagegen Listen- und Formularmuster, die andere Bilder und die Messungen unten abdecken;
 * dass Suche und Blätterung *funktionieren*, prüft tests/browser-smoke.spec.ts.
 */
portalTest('Komponenten-Basislinie: Kreisreform-Kartensperre', async ({ page }) => {
  await preparePage(page);
  await page.goto('/kreisreform/');
  await page.locator('[data-kreisreform-search-input]').fill('Abtsbessingen');
  const result = page.locator('[data-kreisreform-search-result]').first();
  await expect(result).toBeVisible();
  await result.click();

  await expectSectionScreenshot(page.locator('[data-map-load-surface]'), 'kreisreform-kartensperre.png');
  await verifyViewport(page);
});

portalTest('Kreisreform: Kartenansicht ist kontrolliert und lesbar', async ({ page }) => {
  await preparePage(page);
  await page.goto('/kreisreform/');

  const gate = page.locator('[data-map-gate]');
  await expect(gate).toHaveCount(1);
  await page.locator('[data-map-load]').click();

  await expect(page.locator('[data-map-status]')).toContainText(/Karte bereit|Karte konnte nicht geladen werden/, { timeout: 20_000 });
  // Ohne Pixelbild: die geladene Karte zeigt fremde Kacheln, ihr Aussehen ist nicht unsere
  // Regression. Geprüft wird, dass die Sperre greift, der Ladeweg endet und nichts überläuft.
  await verifyViewport(page);
});

portalTest('Consent-Hinweis ist lesbar und ablehnbar', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  skipSchmalUnless({}, testInfo.project.name, testInfo);
  await preparePage(page, '');
  await page.goto('/');

  const banner = page.locator('#analytics-consent-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveScreenshot('consent.png');
  await banner.getByRole('button', { name: 'Nur notwendige Funktionen nutzen' }).click();
  await expect(banner).toBeHidden();
});

/**
 * Messungen der Designprüfung des Staatsportals (6. September 2026). Sie halten die Regeln fest,
 * die kein Bild belegt: sichtbare Hauptnavigation zwischen 64 und 80 rem, Spaltenzahl der
 * Kartenraster, Lesegrößen, Lesemaß, Sprungziele der Bereichsnavigation und Kennzahlenkarten.
 * Alle Erwartungen werden zur Laufzeit aus der Seite abgeleitet, keine nennt einen Inhalt.
 */
const PORTAL_MEASURED_PAGES = ['/', '/themen/', '/haushalt/', '/staatsregierung/', '/service/uebersicht/', '/404.html'];

portalTest('Messung: die Hauptnavigation bleibt bis 64 rem sichtbar', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-wide', 'Die Kopfstufen werden einmal in einem Lauf geprüft.');
  await preparePage(page);
  for (const width of [1024, 1100, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const links = await page.locator('.site-header__nav a').evaluateAll((nodes) =>
      nodes.filter((node) => node.getBoundingClientRect().width > 0).length);
    expect(links, `sichtbare Navigationspunkte bei ${width} px`).toBeGreaterThanOrEqual(5);
    await expect(page.locator('.site-header__tools'), `Kopfwerkzeuge bei ${width} px`).toBeVisible();
    await verifyViewport(page);
  }
});

portalTest('Messung: Rasterklassen halten ihre Spaltenzahl', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-wide', 'Die Spaltenzahl wird einmal bei 1280 Pixeln gemessen.');
  await preparePage(page);
  await page.setViewportSize({ width: 1280, height: 1000 });
  for (const path of ['/themen/', '/service/uebersicht/', '/']) {
    await page.goto(path);
    const grids = await page.evaluate(() =>
      [...document.querySelectorAll('.card-grid')]
        .filter((element) => element.getBoundingClientRect().height > 0)
        .map((element) => ({
          modifier: [...element.classList].find((name) => name.startsWith('card-grid--')) ?? 'card-grid',
          columns: getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
          widths: [...new Set([...element.children].map((child) => Math.round(child.getBoundingClientRect().width)))],
        })));
    for (const grid of grids) {
      const expected = { 'card-grid--two': 2, 'card-grid--three': 3, 'card-grid--four': 4, 'card-grid': 3 }[grid.modifier];
      expect(grid.columns, `${path} · ${grid.modifier}`).toBe(expected);
      expect(grid.widths.length, `${path} · ${grid.modifier}: Kartenbreiten ${grid.widths.join(', ')}`).toBeLessThanOrEqual(2);
    }
  }
});

portalTest('Messung: die Zugangskarten der Startseite lassen keine Karte allein', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-wide', 'Das Raster wird einmal bei 1280 Pixeln gemessen.');
  await preparePage(page);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/');
  const grid = await page.locator('.portal-access-grid').evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
    cards: element.children.length,
    gap: parseFloat(getComputedStyle(element).columnGap),
    padding: parseFloat(getComputedStyle(element.firstElementChild as HTMLElement).paddingLeft),
  }));
  const rest = grid.cards % grid.columns;
  expect(rest, `${grid.cards} Karten in ${grid.columns} Spalten`).not.toBe(1);
  expect(grid.gap, 'Rasterlücke größer als das seitliche Innenpolster').toBeGreaterThan(grid.padding);
});

portalTest('Messung: Fließtext steht nicht in der kleinsten Stufe', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'), 'Die Lesegrößen werden auf einer Desktopbreite gemessen.');
  await preparePage(page);
  for (const path of PORTAL_MEASURED_PAGES) {
    await page.goto(path);
    const findings = await page.evaluate(() =>
      [...document.querySelectorAll('main p, main li, main dd')]
        .filter((element) => {
          const style = getComputedStyle(element);
          if (style.display === 'none' || element.getBoundingClientRect().height === 0) return false;
          if (element.closest('.eyebrow, .meta-label, time, .tag, .status-badge, .search-hit__meta')) return false;
          // Kurze Etiketten dürfen klein sein; ein Absatz Fließtext nicht.
          return (element.textContent ?? '').trim().length >= 120;
        })
        .map((element) => ({ size: parseFloat(getComputedStyle(element).fontSize), text: (element.textContent ?? '').trim().slice(0, 40) }))
        .filter((entry) => entry.size < 14.5));
    expect(findings, `${path}: Fließtext unter 14,5 px`).toEqual([]);
  }
});

portalTest('Messung: das Lesemaß der Textspalten bleibt unter 78 Zeichen', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-wide', 'Das Lesemaß wird einmal bei 1440 Pixeln gemessen.');
  await preparePage(page);
  for (const path of PORTAL_MEASURED_PAGES) {
    await page.goto(path);
    await page.evaluate(async () => { await document.fonts.ready; });
    const widest = await page.evaluate(() => {
      // Ein „ch“ ist die Vorschubbreite der Ziffer 0; die Messung nimmt sie aus der Seite selbst.
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;width:1ch';
      document.body.append(probe);
      const ch = probe.getBoundingClientRect().width;
      probe.remove();
      let max = { chars: 0, text: '' };
      for (const element of document.querySelectorAll('main p, main li > span, main dd')) {
        const style = getComputedStyle(element);
        if (style.display === 'none') continue;
        const text = (element.textContent ?? '').trim();
        if (text.length < 90) continue;
        const chars = element.getBoundingClientRect().width / (ch * (parseFloat(style.fontSize) / 16));
        if (chars > max.chars) max = { chars: Math.round(chars), text: text.slice(0, 50) };
      }
      return max;
    });
    expect(widest.chars, `${path}: „${widest.text}“`).toBeLessThanOrEqual(78);
  }
});

portalTest('Messung: Sprungziele der Bereichsnavigation existieren', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-wide', 'Die Sprungziele werden einmal geprüft.');
  await preparePage(page);
  for (const path of ['/themen/', '/kreisreform/', '/staatsregierung/beteiligungen/', '/service/uebersicht/']) {
    await page.goto(path);
    const broken = await page.evaluate(() =>
      [...document.querySelectorAll('.section-navigation a[href^="#"]')]
        .map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? '')
        .filter((href) => href.length > 1 && !document.getElementById(href.slice(1))));
    expect(broken, `${path}: Sprungziele ohne Ziel`).toEqual([]);
    const position = await page.locator('.section-navigation').evaluate((element) => getComputedStyle(element).position);
    expect(position, `${path}: Bereichsnavigation ab 64 rem`).toBe('sticky');
  }
});

portalTest('Messung: Kennzahlenkarten tragen nur Zahlen', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-wide', 'Die Kennzahlen werden einmal geprüft.');
  await preparePage(page);
  const metricSelector = '.meta-card strong, .fact-card strong, .budget-kpi-card strong, .budget-plan-kpis strong, .topic-data-grid__metric';
  for (const path of ['/', '/haushalt/', '/freistaat/', '/staatsregierung/15-punkte-plan/', '/staatsregierung/fruehere-kabinette/honecker-i/']) {
    await page.goto(path);
    const values = await page.evaluate(
      (selector) => [...document.querySelectorAll(selector)].map((element) => (element.textContent ?? '').trim()),
      metricSelector,
    );
    const textValues = values.filter((value) => !/^[−+-]?[\d.,]/u.test(value));
    expect(textValues, `${path}: Kennzahlenkarten ohne Zahlenwert`).toEqual([]);
  }
});

/**
 * Aufbau der Kreisreformseite statt einer Seitenhöhe.
 *
 * Die frühere Vorgabe lautete „unter 8.000 px bei 375 px“. Sie misst kein Gestaltungsmerkmal,
 * sondern ein Produkt aus Bestandsgröße (101 Kreise), Zeichenlänge der längsten Zelle,
 * Fensterbreite und der vom Nutzer eingestellten Schriftgröße – bei 200 % Textvergrößerung
 * (WCAG 1.4.4) wäre sie zwangsläufig verletzt. Erreichbar wäre sie nur, indem die Seitengröße
 * unter die des Beteiligungsnavigators fiele oder ganze Tabellen hinter einem Aufklapper
 * verschwänden; beides nimmt einer Datenansicht ihren Zweck. Der berechtigte Kern der Vorgabe war
 * ein anderer: die Seitenlänge darf nicht mit dem Bestand wachsen, und der Nutzer muss die
 * Tabellen erreichen, ohne dorthin zu scrollen. Genau das halten diese Messungen fest.
 */
portalTest('Messung: die Datenansichten der Kreisreformseite wachsen nicht mit dem Bestand', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'Die Zeilenzahl wird auf einer Mobilbreite gemessen.');
  await preparePage(page);
  await page.goto('/kreisreform/');

  // Die Seitengröße kommt aus der gemeinsamen Konstante, nicht als Zahl im Test: Kreistabelle und
  // Beteiligungsnavigator blättern dieselbe Art Daten gleich.
  const rows = page.locator('[data-kreisreform-table-body] tr');
  await expect(rows).toHaveCount(DEFAULT_PORTAL_PAGE_SIZE);
  const pagination = page.locator('[data-pagination="kreise"]');
  await expect(pagination).toBeVisible();
  const total = Number((await pagination.locator('[data-pagination-total]').innerText()).replace(/\D/gu, ''));
  expect(total, 'die Blätterung nennt den Gesamtbestand').toBeGreaterThan(DEFAULT_PORTAL_PAGE_SIZE);
  await pagination.locator('[data-page-action="next"]').click();
  await expect(pagination.locator('[data-pagination-page]')).toHaveText(/Seite 2 von \d+/u);
  await expect(rows).toHaveCount(DEFAULT_PORTAL_PAGE_SIZE);

  // Jede weitere sichtbare Datenansicht der Seite bleibt ebenfalls gedeckelt.
  const bodies = await page.locator('#tabellen tbody').evaluateAll((elements) =>
    elements.map((element) => ({ id: element.closest('section')?.id ?? '', rows: element.querySelectorAll('tr').length })));
  for (const body of bodies) {
    expect(body.rows, `Tabelle in ${body.id} zeigt ${body.rows} Zeilen`).toBeLessThanOrEqual(DEFAULT_PORTAL_PAGE_SIZE);
  }
  await verifyViewport(page);
});

portalTest('Messung: die Kreisreformseite bleibt progressiv und ohne Scrollfalle', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'Der Aufbau wird auf einer Mobilbreite gemessen.');
  await preparePage(page);
  await page.goto('/kreisreform/');

  // Kein Aufklappbereich steht beim Aufruf offen: FAQ und die Kreislisten der Bezirke sind
  // progressiv, nicht dauerhaft ausgeklappt.
  await expect(page.locator('#kreisreform-faq details[open]')).toHaveCount(0);
  await expect(page.locator('#bezirke details[open]')).toHaveCount(0);
  await page.locator('#kreisreform-faq details > summary').first().click();
  await expect(page.locator('#kreisreform-faq details[open]')).toHaveCount(1);

  // Kein Sammelblock gibt mehr Einträge auf einmal aus als eine Datenseite. Gemessen wird die
  // Kinderzahl, nicht die Höhe: eine Höhe in Pixeln wäre wieder das Maß, das hier gerade ersetzt
  // wird – sie hängt an Zeichenlänge und Nutzerschriftgröße, nicht am Aufbau.
  const zuGross = await page.evaluate((grenze) => {
    return [...document.querySelectorAll('#main-content .card-grid, #main-content .record-list, #main-content .compare-grid')]
      .filter((element) => element.checkVisibility?.() !== false)
      .map((element) => ({ klasse: element.className, kinder: element.childElementCount }))
      .filter((entry) => entry.kinder > grenze);
  }, DEFAULT_PORTAL_PAGE_SIZE);
  expect(zuGross, `Sammelblöcke geben höchstens ${DEFAULT_PORTAL_PAGE_SIZE} Einträge auf einmal aus`).toEqual([]);

  // Der Nutzer erreicht die Tabellen über die Abschnittsnavigation, nicht durch Scrollen: der
  // Sprunglink steht im ersten Bildschirm.
  const link = page.locator('.section-navigation a[href="#tabellen"]');
  await expect(link).toHaveCount(1);
  const oben = await link.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  expect(oben, 'der Sprunglink zu den Tabellen steht im ersten Bildschirm').toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight * 2));
  await verifyViewport(page);
});

portalTest('Messung: die Themenübersicht führt jedes Thema genau einmal als Karte', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-wide', 'Die Übersicht wird einmal geprüft.');
  await preparePage(page);
  await page.goto('/themen/');
  const { cards, references } = await page.evaluate(() => ({
    cards: [...document.querySelectorAll('#alle-themen .topic-card')].map((element) => element.id),
    references: [...document.querySelectorAll('.topic-reference > a')].map((element) => (element as HTMLAnchorElement).getAttribute('href') ?? ''),
  }));
  expect(new Set(cards).size, 'jede Karte steht genau einmal').toBe(cards.length);
  expect(cards.every((id) => id.startsWith('thema-')), 'jede Karte trägt ein Sprungziel').toBe(true);
  for (const href of references) {
    expect(cards, `Verweis ${href} zeigt auf eine Karte`).toContain(href.slice(1));
  }
});

portalTest('Messung: jede Schriftgröße und Schriftfamilie stammt aus der Skala', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-wide', 'Die Schriftinventur wird einmal bei 1440 Pixeln gemessen.');
  await preparePage(page);
  for (const path of PORTAL_MEASURED_PAGES) {
    await page.goto(path);
    await page.evaluate(async () => { await document.fonts.ready; });
    const inventory = await page.evaluate(() => {
      const sizes = new Map<number, string>();
      const families = new Map<string, string>();
      for (const element of document.querySelectorAll('body *')) {
        // Beschriftungen in Diagrammen tragen ihre eigene Geometrie, keine Textrolle.
        if (element.closest('svg')) continue;
        let hasText = false;
        for (const node of element.childNodes) if (node.nodeType === 3 && (node.textContent ?? '').trim()) hasText = true;
        if (!hasText) continue;
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (element.getBoundingClientRect().height === 0) continue;
        const sample = (element.textContent ?? '').trim().slice(0, 30);
        sizes.set(Math.round(parseFloat(style.fontSize) * 100) / 100, sample);
        families.set(style.fontFamily.split(',')[0].replace(/["']/gu, ''), sample);
      }
      return {
        sizes: [...sizes.entries()].map(([size, sample]) => ({ size, sample })).sort((left, right) => left.size - right.size),
        families: [...families.entries()].map(([family, sample]) => ({ family, sample })),
      };
    });

    // Nur die drei Hausschriften; eine Systemschrift bedeutet ein Bedienelement ohne `font: inherit`.
    const foreign = inventory.families.filter((entry) => !['Jost', 'Ost Grotesk', 'Source Serif 4'].includes(entry.family));
    expect(foreign, `${path}: fremde Schriftfamilie`).toEqual([]);

    /*
     * Die Skala aus foundation.css bei 1440 px: neun feste Stufen, dazu die skalierenden Rollen
     * (Titel, Langtitel, Band, Kartentitel, Kennzahl). Die Prüfung ist eine Zugehörigkeitsprüfung,
     * keine Zählung: die Zahl der Stufen einer Seite folgt aus ihrem Inhalt, ihre Herkunft nicht.
     */
    const scale = new Set([11.52, 13.12, 14.72, 16, 17, 18.4, 20.8, 24, 28, 22.4, 32, 42.4, 52]);
    const offScale = inventory.sizes.filter((entry) => !scale.has(entry.size));
    expect(offScale, `${path}: Schriftgröße außerhalb der Skala`).toEqual([]);
    expect(inventory.sizes.length, `${path}: verschiedene Schriftgrößen`).toBeLessThanOrEqual(11);
  }
});

portalTest('Messung: Stände tragen die Wörter der Wortliste', { tag: [CRITICAL_TAG] }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-wide', 'Die Wortliste wird einmal geprüft.');
  await preparePage(page);
  const vocabulary = Object.values(siteConfig.vocabulary);
  // Begriffe, die dieselbe Sache mit einem anderen Wort benennen. `Stichtag` steht in der
  // Wortliste (Bezugstag einer Erhebung) und ist deshalb keine Dublette.
  const forbidden = /\b(Fachstand|Redaktionsstand|Sachstand|Bearbeitungsstand|Aktualisierungsstand)\b/u;
  for (const path of ['/', '/themen/', '/themen/bildungsreform/', '/staatsregierung/beteiligungen/', '/kreisreform/']) {
    await page.goto(path);
    const text = await page.locator('#main-content').innerText();
    const hit = text.match(forbidden);
    expect(hit?.[0], `${path}: Begriff außerhalb der Wortliste (${vocabulary.join(', ')})`).toBeUndefined();
  }
});
