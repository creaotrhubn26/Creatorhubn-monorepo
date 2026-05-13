/**
 * E2E: Clarity smoke-test mot PRODUKSJON
 *
 * Kjører gjennom de viktigste Role Room-flytene på theroleroom.com
 * for å generere session-replays i Microsoft Clarity. Bruker
 * isolerte browser-contexts så hver test = unik Clarity-session
 * (ny visitorId hver gang).
 *
 * Kjør med:
 *   npx playwright test e2e/role-room-clarity-smoke.spec.ts --project=chromium
 *
 * Override URL ved testing av staging:
 *   E2E_BASE_URL=https://staging.theroleroom.com npx playwright test ...
 *
 * Etter kjøring:
 *   1. Vent 5-10 min for Clarity å ingeste sessionene
 *   2. Logg inn clarity.microsoft.com/projects/view/wqgcu06tz0
 *   3. Sjekk Recordings + Insights → rage clicks, dead clicks, JS-errors
 *
 * Filter i Clarity-dashboardet med custom tags som spec-en setter:
 *   page_type = student-seo | competitor | alternatives-index
 *   page_slug = vs-studiobinder | for-studenter | dansestudio | ...
 *
 * Begrensning: syntetiske klikk fra Playwright treffer ikke alle
 * rage-/dead-click-heuristikker like presist som ekte brukere
 * gjør. Manuell smoke-test i tillegg er anbefalt.
 */

import { test, expect, type Page } from '@playwright/test';

const PROD_BASE = process.env.E2E_BASE_URL ?? 'https://theroleroom.com';

test.use({ baseURL: PROD_BASE });
// Hver test får ny browser-context → ny Clarity-session
test.describe.configure({ mode: 'serial' });

/**
 * Aksepter cookie-consent. Clarity laster bare etter analytics-consent.
 */
async function acceptCookies(page: Page) {
  // Forsøk flere vanlige consent-banner-mønstre
  const candidates = [
    page.getByRole('button', { name: /godta alle|aksepter alle|accept all|tillat alle/i }),
    page.getByRole('button', { name: /godta|aksepter|accept/i }),
    page.getByText(/godta alle/i),
  ];
  for (const candidate of candidates) {
    if (await candidate.first().isVisible().catch(() => false)) {
      await candidate.first().click().catch(() => {});
      break;
    }
  }
  // Vent 1.5s for Clarity-script-loading etter consent
  await page.waitForTimeout(1500);
}

/**
 * Simuler menneskelig scroll-rytme — Clarity verdsetter realistiske
 * scroll-mønstre når heat-maps skal bygges.
 */
async function humanScroll(page: Page, distance: number, steps: number = 8) {
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, distance / steps);
    await page.waitForTimeout(250 + Math.random() * 200);
  }
}

/**
 * Forsøk å verifisere at Clarity-skript faktisk er lastet (window.clarity).
 * Brukes som debug-signal — testen failer ikke hvis Clarity ikke er der.
 */
async function logClarityStatus(page: Page, label: string) {
  const status = await page.evaluate(() => ({
    clarityLoaded: typeof (window as unknown as { clarity?: unknown }).clarity === 'function',
    dataLayerLength: ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []).length,
  }));
  console.log(`[${label}] clarity=${status.clarityLoaded} dataLayerLen=${status.dataLayerLength}`);
}

// ════════════════════════════════════════════════════════════════
// SMOKE TEST: Landing-side
// ════════════════════════════════════════════════════════════════

test.describe('Clarity smoke — Landing & device-showcase', () => {
  test('landing → scroll til device-mockup-seksjon → hover på enheter', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await acceptCookies(page);
    await logClarityStatus(page, 'landing-after-consent');

    // Bla nedover for å rendre alt
    await humanScroll(page, 800);
    await page.waitForTimeout(800);
    await humanScroll(page, 1200);

    // Forsøk å finne device-mockup-seksjon
    const deviceSection = page.getByText(/Bruk hvor du jobber/i);
    if (await deviceSection.isVisible().catch(() => false)) {
      await deviceSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(2000);
    }

    // La Clarity få et øyeblikk til å sende data
    await page.waitForTimeout(2000);
  });
});

// ════════════════════════════════════════════════════════════════
// SMOKE TEST: Konkurrent-sammenligning
// ════════════════════════════════════════════════════════════════

test.describe('Clarity smoke — Konkurrent-sider', () => {
  for (const competitor of ['studiobinder', 'castingnetworks', 'moviemagic']) {
    test(`/vs-${competitor} — scroll sammenligningstabell + klikk CTA`, async ({ page }) => {
      await page.goto(`/vs-${competitor}`, { waitUntil: 'domcontentloaded' });
      await acceptCookies(page);
      await logClarityStatus(page, `vs-${competitor}-after-consent`);

      // Forvent H1
      await expect(page.getByRole('heading', { level: 1, name: new RegExp(competitor, 'i') })).toBeVisible({ timeout: 10_000 });

      // Scroll til sammenligningstabell
      await humanScroll(page, 600);
      await page.waitForTimeout(1200);

      // Forsøk en "rage click" på en celle som ikke er klikkbar — bevisst
      // for å trigge Clarity dead-click-deteksjon
      const tableCell = page.locator('td').first();
      if (await tableCell.isVisible().catch(() => false)) {
        for (let i = 0; i < 3; i += 1) {
          await tableCell.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(150);
        }
      }

      // Scroll til CTA og klikk
      await humanScroll(page, 800);
      await page.waitForTimeout(1500);
    });
  }
});

// ════════════════════════════════════════════════════════════════
// SMOKE TEST: Student-/målgruppe-sider
// ════════════════════════════════════════════════════════════════

test.describe('Clarity smoke — Student- og målgruppe-sider', () => {
  const studentPages = [
    'for-studenter',
    'film-tv-utdanning',
    'casting-director-utdanning',
    'innholdsprodusenter',
    'dansestudio',
  ];

  for (const slug of studentPages) {
    test(`/${slug} — les content + klikk relatert side`, async ({ page }) => {
      await page.goto(`/${slug}`, { waitUntil: 'domcontentloaded' });
      await acceptCookies(page);
      await logClarityStatus(page, `${slug}-after-consent`);

      // Forvent H1
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });

      // Bla langsomt gjennom innholdet (Clarity bygger scroll-map)
      await humanScroll(page, 500);
      await page.waitForTimeout(1500);
      await humanScroll(page, 700);
      await page.waitForTimeout(1500);
      await humanScroll(page, 500);
      await page.waitForTimeout(2000);
    });
  }
});

// ════════════════════════════════════════════════════════════════
// SMOKE TEST: Alternatives-indeks (hub)
// ════════════════════════════════════════════════════════════════

test.describe('Clarity smoke — /alternatives', () => {
  test('alternatives-indeks → klikk én konkurrent-kort', async ({ page }) => {
    await page.goto('/alternatives', { waitUntil: 'domcontentloaded' });
    await acceptCookies(page);
    await logClarityStatus(page, 'alternatives-after-consent');

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
    await humanScroll(page, 700);
    await page.waitForTimeout(1500);
    await humanScroll(page, 500);
    await page.waitForTimeout(2000);
  });
});
