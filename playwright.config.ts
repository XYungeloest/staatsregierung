import { defineConfig } from '@playwright/test';

import { normalizeSiteTargets } from './scripts/lib/site-targets.mjs';

const baseURL = 'http://127.0.0.1:4321';
const lawURL = 'http://127.0.0.1:4322';
const selectedSiteTargets = normalizeSiteTargets(process.env.SITE_TARGETS);
const webServer = [];

if (selectedSiteTargets.includes('portal')) {
  webServer.push({
    command: 'node scripts/serve-site.mjs apps/portal/dist/client 4321',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  });
}
if (selectedSiteTargets.includes('law')) {
  webServer.push({
    command: 'node scripts/serve-site.mjs apps/recht/dist/client 4322',
    url: lawURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  });
}

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
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
