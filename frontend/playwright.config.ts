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
    // 127.0.0.1, ikke localhost: useAuth.ts autoseeder en local-admin-sesjon
    // når hostname er nøyaktig «localhost», også i produksjonsbundelen.
    // Backend avviser tokenet i produksjon, så det er ikke et hull — men en
    // gate som skal måle hva en ANONYM besøkende ser, må ikke selv bli logget
    // inn. Målt 2026-09-24: på localhost viste /leadgrid/import den innloggede
    // flaten uten at noen hadde logget inn.
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || '5001'}`,
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
  // PLAYWRIGHT_PREVIEW=1 serverer den BYGDE bundelen i stedet for dev-serveren.
  // Dev-serveren uten backend gir 500 på hvert /api-kall, og flere ruter
  // rendrer da tomt — målt 2026-09-24. En gate som skal si noe om hva
  // publikum ser, må måle det publikum får.
  webServer: {
    command: process.env.PLAYWRIGHT_PREVIEW
      ? `npx vite preview --port ${process.env.PLAYWRIGHT_PORT || '5001'} --host 127.0.0.1`
      : `npx vite --port ${process.env.PLAYWRIGHT_PORT || '5001'} --host`,
    port: Number(process.env.PLAYWRIGHT_PORT || '5001'),
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
