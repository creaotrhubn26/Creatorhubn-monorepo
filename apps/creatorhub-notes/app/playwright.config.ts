import { defineConfig, devices } from "@playwright/test";

/** Grensesnittet i en ekte rendering.
 *
 *  `tilgjengelighet.test.ts` leser stilarket, og et stilark sier ikke hva som
 *  vises: den valgte raden holdt 4,51:1 i variabelen og 3,72:1 på skjermen,
 *  «Tidligere om dette» så riktig ut i CSS-en og var 140px bred i vinduet.
 *  Det som bare kan måles i en nettleser, måles her.
 *
 *  Webview-koden kjøres mot Vite, uten Tauri-runtime: `e2e/qa.html` laster
 *  `e2e/fixtures/tauri-mock.ts` før `main.tsx` og stubber alle kommandoene.
 *  Samme mønster som `apps/resolve-script-manager`.
 *
 *  Kjør:  npx playwright test        (Vite startes av seg selv)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:1426",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 } },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1426",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
