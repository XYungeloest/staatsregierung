import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'fresswuerfel.spec.ts',
  timeout: 90000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4340', browserName: 'chromium', locale: 'de-DE', timezoneId: 'Europe/Berlin', trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/fresswuerfel.mjs preview --port 4340 --local-config .cache/fresswuerfel/wrangler-test.json --persist-to .cache/fresswuerfel/test-state', url: 'http://127.0.0.1:4340/themen/fresswuerfel-maskottchen/', timeout: 60000, reuseExistingServer: false },
});
