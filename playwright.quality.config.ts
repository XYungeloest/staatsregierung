import { defineConfig } from '@playwright/test';

import { normalizeSiteTargets } from './scripts/lib/site-targets.mjs';

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

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL,
    colorScheme: 'light',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer,
});
