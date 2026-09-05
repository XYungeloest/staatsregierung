import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { normalizeSiteTargets } from '../scripts/lib/site-targets.mjs';

const lawUrl = (path: string) => new URL(path, 'http://127.0.0.1:4322').toString();
const selectedSiteTargets = normalizeSiteTargets(process.env.SITE_TARGETS);

const auditPages = [
  ...(selectedSiteTargets.includes('portal') ? [
    '/',
    '/staatsregierung/beteiligungen/',
    '/staatsregierung/kabinett/',
    '/staatsregierung/kabinett/wirtschaft-arbeitsmarkt-und-beschaeftigung/',
    '/staatsregierung/mitglieder/max-peterson/',
    '/haushalt/',
    '/themen/volksbefragung-2026/',
    '/kreisreform/',
    '/suche/',
    '/service/barrierefreiheit/',
    '/recht/',
  ] : []),
  ...(selectedSiteTargets.includes('law') ? [
    lawUrl('/'),
    lawUrl('/norm/saechsische-gemeindeordnung/'),
    lawUrl('/norm/saechsische-gemeindeordnung/vergleich/?von=2023-11-01&bis=2026-08-01'),
    lawUrl('/norm/sero-verordnung/history/'),
    lawUrl('/norm/saechsische-gemeindeordnung/version/2023-11-01/'),
    lawUrl('/suche/'),
    lawUrl('/suche/?q=Interflug'),
    lawUrl('/archiv/?buchstabe=G&herkunft=inherited-unchanged'),
    lawUrl('/rechtsentwicklung/'),
    lawUrl('/norm/zinnwald-vergesellschaftungsgesetz/'),
    lawUrl('/norm/bekanntmachung-bestellung-gruendungsvorstand-interflug/'),
    lawUrl('/sachgebiete/kommunal-und-verwaltungsrecht/'),
    lawUrl('/verkuendungen/stanzo-2026-33/'),
    lawUrl('/hilfe/'),
    lawUrl('/gibt-es-nicht/'),
  ] : []),
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

// Fokusindikator (Befund A3): Auf sechs repräsentativen Seiten beider Portale wird jedes
// fokussierbare Element angefahren und sein Indikator – Umriss (outline-color/-width/-offset) und
// Schein (box-shadow) – gegen die Fläche gerechnet, auf der er tatsächlich liegt: der Umriss läuft
// außerhalb der Box, also auf dem nächsten gemalten Vorfahren bzw. Nachbarn im Band zwischen Rahmen
// und Umriss (oder auf dem Schein, wenn dieser das Band abdeckt). Läuft er über mehrere Flächen,
// gilt die schlechteste. Unter 3 : 1 schlägt der Test mit Selektor und Messwert fehl.
interface FocusFinding {
  element: string;
  contrast: number;
  surface: string;
  indicator: string;
}
interface FocusReport {
  checked: number;
  withoutFocusVisible: number;
  violations: FocusFinding[];
}

const focusPages = [
  ...(selectedSiteTargets.includes('portal') ? ['/', '/staatsregierung/kabinett/', '/suche/?q=Gesetz'] : []),
  ...(selectedSiteTargets.includes('law') ? [lawUrl('/'), lawUrl('/norm/staatsverfassung-des-freistaates-ostdeutschland/'), lawUrl('/suche/?q=Kulturpass')] : []),
];

function measureFocusIndicators(): FocusReport {
  type Rgba = { r: number; g: number; b: number; a: number };
  const parseColor = (value: string | null): Rgba | null => {
    const match = value?.match(/rgba?\(([^)]+)\)/u);
    if (!match) return null;
    const parts = match[1].split(',').map((part) => Number.parseFloat(part));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined || Number.isNaN(parts[3]) ? 1 : parts[3] };
  };
  const luminance = ({ r, g, b }: Rgba): number => {
    const channel = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const contrast = (a: Rgba, b: Rgba): number => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
  };
  const blend = (fg: Rgba, bg: Rgba): Rgba => fg.a >= 1 ? fg : { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 };
  const white: Rgba = { r: 255, g: 255, b: 255, a: 1 };
  const describe = (el: Element): string => {
    const classes = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/u).slice(0, 2).join('.')}` : '';
    const label = (el.getAttribute('aria-label') || el.textContent || (el as HTMLInputElement).value || '').trim().replace(/\s+/gu, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${classes}${label ? ` „${label}“` : ''}`;
  };
  // Gemalte Fläche an einem Punkt: oberstes Element mit deckender Farbe oder Verlauf, das nicht
  // zum fokussierten Element gehört; halbtransparente Flächen werden auf die nächste gemischt.
  const surfacesAt = (x: number, y: number, self: Element): { colors: Rgba[]; source: Element } | null => {
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
    let layered: Rgba | null = null;
    for (const el of document.elementsFromPoint(x, y)) {
      if (el === self || self.contains(el)) continue;
      const style = getComputedStyle(el);
      if (style.backgroundImage.includes('gradient')) {
        const stops = (style.backgroundImage.match(/rgba?\([^)]+\)/gu) ?? []).map(parseColor).filter((c): c is Rgba => Boolean(c));
        if (stops.length) return { colors: stops.map((stop) => (layered ? blend(layered, stop) : blend(stop, white))), source: el };
      }
      const color = parseColor(style.backgroundColor);
      if (color && color.a > 0) {
        if (color.a >= 0.99) return { colors: [layered ? blend(layered, color) : color], source: el };
        layered = layered ? { ...blend(layered, color), a: 1 } : color;
      }
    }
    return { colors: [layered ? blend(layered, white) : white], source: document.documentElement };
  };
  const parseHalo = (value: string): { color: Rgba; spread: number } | null => {
    const pattern = /(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?(\s+inset)?/gu;
    for (const match of value.matchAll(pattern)) {
      const color = parseColor(match[1]);
      const blur = Number.parseFloat(match[4]);
      const spread = Number.parseFloat(match[5] ?? '0');
      if (color && color.a > 0 && spread > 0 && blur === 0 && !match[6]) return { color, spread };
    }
    return null;
  };
  const report: FocusReport = { checked: 0, withoutFocusVisible: 0, violations: [] };
  const focusables = Array.from(document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, summary, [tabindex]'))
    .filter((el) => !el.matches('[disabled], [tabindex="-1"], input[type="hidden"]') && el.getClientRects().length > 0);
  for (const el of focusables) {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    el.focus({ preventScroll: true });
    if (document.activeElement !== el) continue;
    if (!el.matches(':focus-visible')) { report.withoutFocusVisible += 1; continue; }
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const width = Number.parseFloat(style.outlineWidth) || 0;
    const offset = Number.parseFloat(style.outlineOffset) || 0;
    const outline = style.outlineStyle !== 'none' && width > 0 ? parseColor(style.outlineColor) : null;
    const halo = parseHalo(style.boxShadow);
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    // Bei innen liegendem Umriss (negativer Versatz) ist die eigene Fläche die Bezugsfläche.
    const distance = offset + width / 2;
    const ring = (d: number): Array<[number, number]> => (d < 0
      ? [[rect.left - d, centerY], [rect.right + d, centerY], [centerX, rect.top - d], [centerX, rect.bottom + d]]
      : [[rect.left - d, centerY], [rect.right + d, centerY], [centerX, rect.top - d], [centerX, rect.bottom + d]]);
    const samples: Array<{ value: number; surface: string }> = [];
    if (outline) {
      for (const [x, y] of ring(distance)) {
        const stack = distance < 0 ? document.elementsFromPoint(x, y) : null;
        const found = distance < 0
          ? (() => { const own = parseColor(style.backgroundColor); return own && own.a >= 0.99 ? { colors: [own], source: el } : surfacesAt(x, y, el); })()
          : surfacesAt(x, y, el);
        void stack;
        if (!found) continue;
        for (const background of found.colors) {
          const base = halo && halo.spread >= offset + width ? blend(halo.color, background) : background;
          samples.push({ value: contrast(blend(outline, base), base), surface: describe(found.source) });
        }
      }
    }
    let haloContrast = 0;
    if (halo) {
      const values: number[] = [];
      for (const [x, y] of ring(halo.spread + 1)) {
        const found = surfacesAt(x, y, el);
        if (found) for (const background of found.colors) values.push(contrast(blend(halo.color, background), background));
      }
      if (values.length) haloContrast = Math.min(...values);
    }
    if (samples.length === 0 && !halo) continue; // kein Messpunkt im Sichtbereich
    report.checked += 1;
    const worst = samples.sort((a, b) => a.value - b.value)[0];
    const best = Math.max(worst?.value ?? 0, haloContrast);
    if (best < 3) {
      report.violations.push({
        element: describe(el),
        contrast: best,
        surface: worst?.surface ?? 'unbekannt',
        indicator: outline ? `Umriss ${style.outlineWidth} ${style.outlineColor} Versatz ${style.outlineOffset}${halo ? ` · Schein ${haloContrast}:1` : ''}` : 'kein Umriss',
      });
    }
  }
  return report;
}

for (const path of focusPages) {
  test(`Fokusindikator hebt sich von seiner Bezugsfläche ab: ${path}`, async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('ostrecht-portal-analytics-consent', 'rejected');
    });
    await page.goto(path);
    if (path.includes('/suche/')) await expect(page.locator('[data-search-summary], [data-portal-search-status]').first()).toContainText(/Treffer/u);
    // Übergänge aus: gemessen wird der Endzustand des Indikators, nicht ein Zwischenbild der Animation.
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
    await page.keyboard.press('Tab'); // Tastaturmodus: :focus-visible gilt dann auch für Skriptfokus
    const report = await page.evaluate(measureFocusIndicators);
    expect(report.checked, `${path}: zu wenige fokussierbare Elemente gemessen`).toBeGreaterThan(10);
    expect(report.withoutFocusVisible, `${path}: Elemente ohne :focus-visible`).toBe(0);
    const message = report.violations.map((v) => `${v.element}: ${v.contrast}:1 gegen ${v.surface} (${v.indicator})`).join('\n');
    expect(report.violations, `${path}: Fokusindikator unter 3:1\n${message}`).toEqual([]);
  });
}
