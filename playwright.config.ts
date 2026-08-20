import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4321';
const lawURL = 'http://127.0.0.1:4322';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
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
  webServer: [
    {
      command: 'node scripts/serve-site.mjs dist/portal/client 4321',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'node scripts/serve-site.mjs dist/law/client 4322',
      url: lawURL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
