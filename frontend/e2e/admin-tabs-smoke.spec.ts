/**
 * E2E: AdminDashboard smoke-test — alle faner i `adminTabs[]`
 *
 * Hensikt: for hver fane i sidebaren, verifiser at den
 *   1. Kan klikkes på i sidebar
 *   2. Rendrer content uten 5xx-feil
 *   3. Ikke produserer mer enn 3 kritiske console-errors (samme filter
 *      som admin-dashboard-functional.spec.ts)
 *   4. Tar full screenshot
 *
 * KILDE for TABS-listen:
 *   `client/src/components/admin/AdminDashboard.tsx`, `adminTabs[]`
 *   linje 889-940 (lest 2026-06-06).
 *
 * MERK: Oppgaven nevner «46 faner», men `adminTabs[]` inneholder
 *       faktisk 45 distinkte id-er. Vi følger koden, ikke ordretallet.
 *       Resultatmatrisen rapporterer `TABS.length` så du ser det selv.
 *
 * Mønster:
 *   - `test.describe.serial(...)` så vi ikke kolliderer i samme browser
 *   - Én delt `Page` via `beforeAll` — auth seeded én gang
 *   - `expect.soft(...)` så ALLE faner kjøres selv om en feiler
 *   - Per-fane JSON-rapport i `test-results/admin-tabs-smoke/results.json`
 *
 * AUTH_USER + token er kopiert ordrett fra `admin-chat.spec.ts` /
 * `admin-dashboard-functional.spec.ts`.
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';

// ── Konfig ─────────────────────────────────────────────────

const ADMIN_URL = 'http://localhost:5001/admin';
const LOAD_TIMEOUT = 60_000;
const SCREENSHOT_DIR = 'test-results/admin-tabs-smoke';
const AUTH_TOKEN = 'dev-admin-local-session';
const AUTH_USER = {
  id: 'local-admin',
  email: 'admin@local.dev',
  firstName: 'Local',
  lastName: 'Admin',
  name: 'Local Admin',
  displayName: 'Local Admin',
  role: 'admin',
  roleLabel: 'Admin',
  profession: 'photographer',
  userType: 'photographer',
  permissions: ['users:read', 'users:write', 'roles:write', 'academy:admin', 'billing:admin', 'impersonate'],
  isAdmin: true,
  verified_email: true,
};

// ── Fane-liste — kopiert fra AdminDashboard.tsx linje 889-940 ──

type TabSpec = { id: string; label: string; group: 'Oversikt' | 'Forretning' | 'Plattform' | 'Lab' };

const TABS: TabSpec[] = [
  // Oversikt
  { id: 'overblikk', label: 'Overblikk', group: 'Oversikt' },
  { id: 'brukere-roller', label: 'Brukere & Roller', group: 'Oversikt' },
  { id: 'invite-requests', label: 'Tilgangsforespørsler', group: 'Oversikt' },
  { id: 'send-notifications', label: 'Send varslinger', group: 'Oversikt' },
  { id: 'community', label: 'Community', group: 'Oversikt' },
  { id: 'innhold-assets', label: 'Innhold & Assets', group: 'Oversikt' },
  { id: 'kunder-prosjekter', label: 'Kunder/Prosjekter', group: 'Oversikt' },
  { id: 'kommunikasjon', label: 'Kommunikasjon', group: 'Oversikt' },

  // Forretning
  { id: 'okonomi', label: 'Økonomi', group: 'Forretning' },
  { id: 'price-management', label: 'Prisstyring', group: 'Forretning' },
  { id: 'user-costs', label: 'Bruker-kostnader', group: 'Forretning' },
  { id: 'reports', label: 'Rapporter', group: 'Forretning' },
  { id: 'academy', label: 'Academy', group: 'Forretning' },
  { id: 'tidum-tilganger', label: 'Tidum', group: 'Forretning' },
  { id: 'vendor-types', label: 'Leverandørtyper', group: 'Forretning' },
  { id: 'profession-types', label: 'Profesjonstyper', group: 'Forretning' },

  // Plattform
  { id: 'integrasjoner', label: 'Integrasjoner', group: 'Plattform' },
  { id: 'feature-management', label: 'Funksjonsflagg', group: 'Plattform' },
  { id: 'centralized-monitoring', label: 'Sentralisert Overvåkning', group: 'Plattform' },
  { id: 'protokollstyring', label: 'Protokollstyring', group: 'Plattform' },
  { id: 'secrets-rotation', label: 'Nøkkel-rotering', group: 'Plattform' },
  { id: 'drift-helse', label: 'Drift', group: 'Plattform' },
  { id: 'system-backup', label: 'Backup', group: 'Plattform' },
  { id: 'gdpr-compliance', label: 'GDPR', group: 'Plattform' },

  // Lab (alle id-er som ikke ligger i de tre over, fra adminTabs[])
  { id: 'prototype-feedback', label: 'Prototype Feedback', group: 'Lab' },
  { id: 'marketplace-apps', label: 'Marketplace-apper', group: 'Lab' },
  { id: 'analytics-hub', label: 'Analytics Hub', group: 'Lab' },
  { id: 'ai-cost', label: 'AI-kostnader', group: 'Lab' },
  { id: 'design-tokens', label: 'Design-tokens', group: 'Lab' },
  { id: 'b2-archive', label: 'B2-arkiv', group: 'Lab' },
  { id: 'development-tools', label: 'Utvikling', group: 'Lab' },
  { id: 'automations', label: 'Automatisering', group: 'Lab' },
  { id: 'creatorhub-notes', label: 'MagicCreator', group: 'Lab' },
  { id: 'advanced-notes', label: 'Stor Notatsløsning', group: 'Lab' },
  { id: 'integration-test', label: 'Integrasjonstest', group: 'Lab' },
  { id: 'payment-integration-test', label: 'Betalingstest', group: 'Lab' },
  { id: 'google-wallet-membership', label: 'Google Wallet', group: 'Lab' },
  { id: 'google-wallet-integration-test', label: 'Wallet-test', group: 'Lab' },
  { id: 'google-payments-config', label: 'Google Payments', group: 'Lab' },
  { id: 'email-analytics', label: 'E-postanalyse', group: 'Lab' },
  { id: 'tester-skills', label: 'Testerferdigheter', group: 'Lab' },
  { id: 'testing-leaderboard', label: 'Test-ledertavle', group: 'Lab' },
  { id: 'test-case-generator', label: 'Testgenerator', group: 'Lab' },
  { id: 'marketing', label: 'Marketing', group: 'Lab' },
  { id: 'feature-customization', label: 'Tilpasning', group: 'Lab' },
  { id: 'fine-tuning-monitor', label: 'Fine-tuning', group: 'Lab' },
];

// ── Typer ──────────────────────────────────────────────────

type SmokeResult = {
  tab: string;
  label: string;
  group: string;
  rendered: boolean;
  consoleErrors: number;
  consoleErrorSamples: string[];
  serverFailures: number;
  serverFailureSamples: Array<{ url: string; status: number }>;
  contentBytes: number;
  clicked: boolean;
  notes: string;
};

// ── Test-suite ─────────────────────────────────────────────

test.describe.serial(`AdminDashboard smoke (${TABS.length} faner)`, () => {
  let context: BrowserContext;
  let page: Page;
  const results: SmokeResult[] = [];

  test.beforeAll(async ({ browser }) => {
    try {
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
    } catch {
      // mappen finnes allerede
    }

    context = await browser.newContext();

    // Auth-bypass — samme pattern som admin-chat.spec.ts
    await context.addInitScript(
      ({ token, user }) => {
        window.localStorage.setItem('creatorhub_auth_token', token);
        window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
        window.localStorage.setItem('userId', user.id);
        window.localStorage.setItem('userEmail', user.email);
      },
      { token: AUTH_TOKEN, user: AUTH_USER },
    );

    await context.route('**/api/auth/user', async (route) => {
      const authorization = route.request().headers().authorization;
      if (authorization === `Bearer ${AUTH_TOKEN}` || !authorization) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ authenticated: true, user: AUTH_USER }),
        });
        return;
      }
      await route.fallback();
    });

    page = await context.newPage();
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
    // Admin er tung — gi den 8 sek på å rendere fullt
    await page.waitForTimeout(8000);

    const alive = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root !== null && root.innerHTML.length > 100;
    });
    expect(alive, '#root må være rendret før vi begynner').toBe(true);
  });

  test.afterAll(async () => {
    // Rapport-utskrift
    console.log('\n\n=== ADMIN-TABS SMOKE-MATRISE ===\n');
    const header = `${'Fane'.padEnd(32)} ${'Render'.padEnd(7)} ${'Errors'.padEnd(7)} ${'5xx'.padEnd(5)} Notes`;
    console.log(header);
    console.log('-'.repeat(header.length + 30));
    for (const r of results) {
      const renderMark = r.rendered ? 'OK' : 'FAIL';
      const errMark = r.consoleErrors < 4 ? String(r.consoleErrors) : `!${r.consoleErrors}`;
      const failMark = r.serverFailures === 0 ? '0' : `!${r.serverFailures}`;
      console.log(
        `${r.tab.padEnd(32)} ${renderMark.padEnd(7)} ${errMark.padEnd(7)} ${failMark.padEnd(5)} ${r.notes}`,
      );
    }
    console.log('-'.repeat(header.length + 30));
    const passed = results.filter(
      (r) => r.rendered && r.clicked && r.consoleErrors < 4 && r.serverFailures === 0,
    ).length;
    console.log(`\nResultat: ${passed} / ${results.length} faner grønne\n`);

    // JSON-rapport for senere parsing
    try {
      writeFileSync(`${SCREENSHOT_DIR}/results.json`, JSON.stringify(results, null, 2));
    } catch (err) {
      console.warn('Klarte ikke å skrive results.json:', err);
    }

    await context?.close();
  });

  for (const tab of TABS) {
    test(`smoke: ${tab.id} (${tab.label})`, async () => {
      const consoleErrors: string[] = [];
      const serverFailures: Array<{ url: string; status: number }> = [];

      const handleConsole = (msg: import('@playwright/test').ConsoleMessage) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        const lower = text.toLowerCase();
        // Filter — speiler admin-dashboard-functional.spec.ts test 3
        if (lower.includes('favicon')) return;
        if (lower.includes('sourcemap')) return;
        if (lower.includes('failed to load resource')) return;
        if (lower.includes('grid') && lower.includes('item prop')) return;
        if (lower.includes('validatedomnesting')) return;
        if (lower.includes('failed to fetch dynamically imported module')) return;
        consoleErrors.push(text);
      };
      const handleResponse = (resp: import('@playwright/test').Response) => {
        const status = resp.status();
        if (status >= 500) {
          serverFailures.push({ url: resp.url(), status });
        }
      };

      page.on('console', handleConsole);
      page.on('response', handleResponse);

      // Klikk fane: let etter <button> med tekst som matcher label.
      // Vi bruker normalisert tekst-sammenligning (trim + collapse whitespace)
      // for å matche labels med "&" og linjeskift.
      const clicked = await page.evaluate((label) => {
        const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
        const target = normalize(label);
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
        for (const btn of buttons) {
          const text = normalize(btn.textContent || '');
          if (!text) continue;
          if (text === target || text.includes(target)) {
            btn.click();
            return true;
          }
        }
        return false;
      }, tab.label);

      // Gi panelet 1.5 sek på å rendere etter klikk
      await page.waitForTimeout(1500);

      const contentBytes = await page.evaluate(() => document.body.innerHTML.length);
      const rendered = contentBytes > 1000;

      // Full-page screenshot per fane
      await page
        .screenshot({
          path: `${SCREENSHOT_DIR}/${tab.id}.png`,
          fullPage: true,
        })
        .catch(() => {
          // Screenshot-feil skal ikke kollapse testen
        });

      page.off('console', handleConsole);
      page.off('response', handleResponse);

      const notes = clicked ? '' : 'IKKE_FUNNET — fane-knapp ikke klikket';

      results.push({
        tab: tab.id,
        label: tab.label,
        group: tab.group,
        rendered,
        consoleErrors: consoleErrors.length,
        consoleErrorSamples: consoleErrors.slice(0, 3).map((e) => e.slice(0, 200)),
        serverFailures: serverFailures.length,
        serverFailureSamples: serverFailures.slice(0, 3),
        contentBytes,
        clicked,
        notes,
      });

      // Soft assertions — kjør alle faner til ende før suite-failure
      expect
        .soft(clicked, `Fane ${tab.id}: kunne ikke klikke på sidebar-knapp "${tab.label}"`)
        .toBe(true);
      expect
        .soft(rendered, `Fane ${tab.id}: content < 1000 bytes (faktisk ${contentBytes})`)
        .toBe(true);
      expect
        .soft(
          consoleErrors.length,
          `Fane ${tab.id}: console-errors >= 4 (${consoleErrors.length} reelle):\n${consoleErrors
            .slice(0, 3)
            .map((e) => `  - ${e.slice(0, 160)}`)
            .join('\n')}`,
        )
        .toBeLessThan(4);
      expect
        .soft(
          serverFailures.length,
          `Fane ${tab.id}: ${serverFailures.length} 5xx-respons:\n${serverFailures
            .slice(0, 3)
            .map((f) => `  - ${f.status} ${f.url}`)
            .join('\n')}`,
        )
        .toBe(0);
    });
  }
});
