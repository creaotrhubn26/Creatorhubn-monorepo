import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 120_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
    launchOptions: {
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--js-flags=--max-old-space-size=2048',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // @mobile-/@tablet-merkede tester krever respektive viewports +
      // touch-support, så de skal ikke kjøre under desktop-chromium.
      grepInvert: /@mobile|@tablet/,
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      grep: /@mobile/,
      // Mobile-viewports gjør Fabric.js / Three.js / wavesurfer-init merkbart
      // tyngre på shared vite-server. Bumper per-test-timeout for å unngå
      // flakies under serial-suite-kjøring.
      timeout: 60_000,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      grep: /@mobile/,
      timeout: 60_000,
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'] },
      grep: /@tablet/,
    },
  ],
  // webServer-port leses fra PLAYWRIGHT_PORT (default 5001) — gjør at
  // parallelle worktrees kan kjøre Playwright mot egne dev-servere uten
  // å kollidere. baseURL leses tilsvarende fra PLAYWRIGHT_BASE_URL.
  webServer: {
    command: `npx vite --port ${process.env.PLAYWRIGHT_PORT || '5001'} --host`,
    port: Number(process.env.PLAYWRIGHT_PORT || '5001'),
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
