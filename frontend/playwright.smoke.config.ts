/**
 * playwright.smoke.config.ts
 *
 * Separat Playwright-config for produksjons-smoke-tester som genererer
 * Clarity-sessioner. Forskjell fra standard playwright.config.ts:
 *   - Ingen webServer (vi treffer ekte production-URL)
 *   - baseURL = https://theroleroom.com (override med E2E_BASE_URL)
 *   - Kjøre serielt for å unngå rate-limiting
 *   - Hver test får ny browser-context = ny Clarity-visitor
 *
 * Kjør:
 *   npx playwright test --config=frontend/playwright.smoke.config.ts \
 *     frontend/e2e/role-room-clarity-smoke.spec.ts
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    '**/role-room-clarity-smoke.spec.ts',
    '**/role-room-cms-r2-upload.spec.ts',
    '**/role-room-troll-demo-seed.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://theroleroom.com',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    headless: true,
    launchOptions: {
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
