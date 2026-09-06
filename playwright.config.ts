import { defineConfig } from '@playwright/test';

import { normalizeSiteTargets } from './scripts/lib/site-targets.mjs';

// Ports sind über die Umgebung wählbar, damit mehrere Arbeitsbäume gleichzeitig prüfen können;
// die Vorgaben 4321/4322 bleiben die dokumentierten Adressen (tests/helpers/law-runtime.ts liest
// OSTRECHT_LAW_PORT genauso).
const portalPort = process.env.OSTRECHT_PORTAL_PORT ?? '4321';
const lawPort = process.env.OSTRECHT_LAW_PORT ?? '4322';
const baseURL = `http://127.0.0.1:${portalPort}`;
const lawURL = `http://127.0.0.1:${lawPort}`;
const selectedSiteTargets = normalizeSiteTargets(process.env.SITE_TARGETS);
const webServer = [];

if (selectedSiteTargets.includes('portal')) {
  webServer.push({
    command: `node scripts/serve-site.mjs apps/portal/dist/client ${portalPort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  });
}
if (selectedSiteTargets.includes('law')) {
  // OstRecht liest Normen zur Laufzeit aus D1: der gebaute Worker läuft lokal mit
  // einer aus content/ projizierten Miniflare-D1 (scripts/serve-law-worker.mjs).
  webServer.push({
    command: `node scripts/serve-law-worker.mjs --port ${lawPort}`,
    url: `${lawURL}/hilfe/`,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
  });
}

// Kanonische Screenshot-Plattform ist Linux (Playwright-Container in CI, Docker lokal):
// nur -linux-Baselines sind versioniert. Auf anderen Plattformen laufen die Screenshot-Tests
// funktional (Seitenaufbau, Überlauf, Interaktion), ohne Pixelvergleich – OSTRECHT_VISUAL_STRICT=1
// erzwingt den Vergleich (z. B. im Container).
const strictSnapshots = process.platform === 'linux' || process.env.OSTRECHT_VISUAL_STRICT === '1';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  ignoreSnapshots: !strictSnapshots,
  snapshotPathTemplate: '{testDir}/{testFileName}-snapshots/{arg}-{projectName}-linux{ext}',
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    },
  },
  use: {
    baseURL,
    browserName: 'chromium',
    colorScheme: 'light',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-wide', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'desktop-compact', use: { viewport: { width: 1024, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 } } },
    { name: 'mobile-360', use: { viewport: { width: 360, height: 800 } } },
  ],
  webServer,
});
