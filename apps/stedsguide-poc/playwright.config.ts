import { defineConfig, devices } from '@playwright/test';

// Valgfri overstyring av Chromium-binær (f.eks. forhåndsinstallert i CI/sandbox):
//   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:1431',
    trace: 'retain-on-failure',
    ...devices['iPhone 13'],
    // POC: fast posisjon i Oslo sentrum slik at "nærmeste severdighet" er deterministisk.
    geolocation: { latitude: 59.9075, longitude: 10.7528 },
    permissions: ['geolocation'],
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:1431',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
