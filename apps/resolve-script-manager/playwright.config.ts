import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Post Agent Tauri-appens webview-lag.
 *
 * Vi tester webview-koden direkte mot Vite dev-server (port 1420)
 * uten å starte selve Tauri-runtime. Tauri-kommando-kall mocker vi
 * ved å sette `window.__TAURI_INTERNALS__` i hver test (se `e2e/
 * fixtures/tauri-mock.ts`).
 *
 * Kjør:
 *   cd apps/resolve-script-manager
 *   npm run dev   # i én terminal — starter Vite på :1420
 *   npx playwright test   # i en annen terminal
 *
 * Eller én-shot:
 *   npx playwright test --ui  # interaktiv mode med vite auto-started
 */

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1536, height: 1024 } },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
