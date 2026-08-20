import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4321';
const lawURL = 'http://127.0.0.1:4322';

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
