import { defineConfig, devices } from '@playwright/test';

const requestedPlaywrightPort = process.env.PLAYWRIGHT_PORT || '5001';
const parsedPlaywrightPort = Number(requestedPlaywrightPort);
if (
  !/^\d{1,5}$/.test(requestedPlaywrightPort)
  || !Number.isInteger(parsedPlaywrightPort)
  || parsedPlaywrightPort < 1
  || parsedPlaywrightPort > 65_535
) {
  throw new Error(`PLAYWRIGHT_PORT must be an integer from 1 to 65535; received "${requestedPlaywrightPort}".`);
}
const playwrightPort = String(parsedPlaywrightPort);
const playwrightBaseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${playwrightPort}`;
const isStoryboardHarnessRun = process.env.STORYBOARD_E2E === '1'
  || process.env.npm_lifecycle_event === 'test:e2e:storyboard-drawing-editor';
// A few legacy specs read the environment directly instead of Playwright's
// configured baseURL. Keep them on the same isolated origin as the runner.
process.env.PLAYWRIGHT_BASE_URL = playwrightBaseURL;
if (isStoryboardHarnessRun) {
  // `npx` replaces npm_lifecycle_event for its child process, so normalize the
  // dedicated harness flag before Vite is spawned.
  process.env.STORYBOARD_E2E = '1';
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 120_000,
  use: {
    baseURL: playwrightBaseURL,
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
  // Port og standard-baseURL deler samme kilde, slik at parallelle worktrees
  // ikke kan starte én Vite-instans og ved et uhell teste en annen. Gjenbruk
  // av en allerede kjørende server må velges eksplisitt.
  webServer: {
    command: `npx vite --port ${playwrightPort} --host --strictPort`,
    port: Number(playwrightPort),
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '1',
    timeout: 30_000,
  },
});
