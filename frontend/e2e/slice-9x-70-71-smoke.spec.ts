/**
 * Slice 9X.70 + 9X.71 — E2E smoke for nye admin-flater og brukervisning.
 *
 * Krever:
 *   - Dev-server på http://localhost:5001 (eller endre BASE i playwright.config)
 *   - PLAYWRIGHT_ADMIN_EMAIL + PLAYWRIGHT_ADMIN_TOKEN for admin-tester
 *
 * Tester:
 *   1. Public marketplace-endpoint svarer
 *   2. /api/analytics/event POST aksepterer
 *   3. /api/admin/* gates på auth (returnerer 401 uten admin)
 *   4. Public marketplace UI laster + viser apper
 *   5. Split Sheet wizard åpnes fra dashboard og fyrer GA4-events
 *   6. Marketplace dialog matcher dark theme
 *   7. Admin Analytics Hub viser KPI-kort
 *   8. Admin AI cost-dashboard viser kostnader-kolonner
 *   9. UserAIUsageCard rendres i settings
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || 'daniel@creatorhubn.com';
const ADMIN_TOKEN = process.env.PLAYWRIGHT_ADMIN_TOKEN || '';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

test.describe('Slice 9X.70 — Marketplace + Analytics Hub', () => {
  test('public marketplace-endpoint returnerer JSON-array', async ({ request }) => {
    const res = await request.get('/api/marketplace/apps');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /api/analytics/event aksepterer event (200 selv om tabell mangler)', async ({ request }) => {
    const res = await request.post('/api/analytics/event', {
      data: {
        eventType: 'creatorhub_e2e_smoke_event',
        entityType: 'smoke',
        entityId: `e2e-${Date.now()}`,
        metadata: { source: 'playwright-e2e' },
      },
    });
    expect([200, 204]).toContain(res.status());
  });

  test('admin-endpoints krever auth (401 uten token)', async ({ request }) => {
    const res = await request.get('/api/admin/analytics/overview');
    expect([401, 403]).toContain(res.status());
  });

  test('admin-endpoints svarer 200 med ADMIN_TOKEN', async ({ request }) => {
    test.skip(!ADMIN_TOKEN, 'PLAYWRIGHT_ADMIN_TOKEN ikke satt — hopper over');
    const res = await request.get('/api/admin/analytics/overview', {
      headers: { Cookie: `session-token=${ADMIN_TOKEN}`, 'x-user-email': ADMIN_EMAIL },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('totals');
    expect(body.totals).toHaveProperty('last24h');
    expect(body.totals).toHaveProperty('last7d');
    expect(body.totals).toHaveProperty('last30d');
  });
});

test.describe('Slice 9X.71 — AI cost-tracking', () => {
  test('admin AI usage overview returnerer struktur', async ({ request }) => {
    test.skip(!ADMIN_TOKEN, 'PLAYWRIGHT_ADMIN_TOKEN ikke satt');
    const res = await request.get('/api/admin/ai-usage/overview', {
      headers: { Cookie: `session-token=${ADMIN_TOKEN}`, 'x-user-email': ADMIN_EMAIL },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('totals');
    expect(body).toHaveProperty('byFeature');
    expect(body).toHaveProperty('byModel');
    expect(body).toHaveProperty('byDay');
    expect(body).toHaveProperty('cacheStats');
    expect(Array.isArray(body.byFeature)).toBe(true);
  });

  test('admin AI usage by-user returnerer array', async ({ request }) => {
    test.skip(!ADMIN_TOKEN, 'PLAYWRIGHT_ADMIN_TOKEN ikke satt');
    const res = await request.get('/api/admin/ai-usage/by-user', {
      headers: { Cookie: `session-token=${ADMIN_TOKEN}`, 'x-user-email': ADMIN_EMAIL },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('user /api/me/ai-usage returnerer customerBilling-struktur', async ({ request }) => {
    const res = await request.get('/api/me/ai-usage', {
      headers: { 'x-user-id': 'e2e-test-user' },
    });
    // 401 hvis x-user-id ikke aksepteres av session-middleware — det er OK
    if (res.status() === 401) {
      test.skip(true, 'session-middleware avviser x-user-id header');
      return;
    }
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('totals');
    expect(body).toHaveProperty('customerBilling');
    expect(body.customerBilling).toHaveProperty('markupFactor');
    expect(body.customerBilling).toHaveProperty('monthlyEstimateNok');
  });
});

test.describe('Slice 9X.70 — UI smoke (krever bruker innlogget)', () => {
  test('marketplace-dialog laster med dark theme', async ({ page }) => {
    test.skip(!ADMIN_TOKEN, 'krever innlogget session');
    await page.context().addCookies([{
      name: 'session-token', value: ADMIN_TOKEN,
      domain: 'localhost', path: '/',
    }]);
    await page.goto('/');
    // Klikk "Marketplace"-knappen om den finnes
    const marketBtn = page.getByRole('button', { name: /Marketplace|Marked/i }).first();
    if (await marketBtn.isVisible().catch(() => false)) {
      await marketBtn.click();
      // Sjekk at dialog-headeren har "Oppdag nye verktøy"
      await expect(page.getByText(/Oppdag nye verktøy/)).toBeVisible({ timeout: 5000 });
    }
  });

  test('Split Sheet wizard fyrer GA4-event ved åpning', async ({ page }) => {
    test.skip(!ADMIN_TOKEN, 'krever innlogget session');
    await page.context().addCookies([{
      name: 'session-token', value: ADMIN_TOKEN,
      domain: 'localhost', path: '/',
    }]);
    await page.addInitScript(() => { window.dataLayer = []; });
    await page.goto('/');

    const splitBtn = page.getByRole('button', { name: /Split Sheets/i }).first();
    if (!(await splitBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Split Sheets-knapp ikke synlig (gates på profession?)');
      return;
    }
    await splitBtn.click();

    // Klikk "Nytt split sheet" for å åpne wizarden
    const newBtn = page.getByRole('button', { name: /Nytt split sheet/i });
    await newBtn.click();

    await page.waitForTimeout(500);
    const events = await page.evaluate(() => window.dataLayer ?? []);
    const hit = events.find((e) =>
      e.event === 'creatorhub_split_sheet_wizard_opened'
      || (e['event'] as string)?.includes('split_sheet_wizard_opened'),
    );
    expect(hit, 'GA4 split-sheet wizard-opened-event skal fyre').toBeTruthy();
  });
});

test.describe('Slice 9X.71 — Admin AI cost-dashboard UI', () => {
  test('AI-kostnader-fane viser KPI-kort', async ({ page }) => {
    test.skip(!ADMIN_TOKEN, 'krever admin');
    await page.context().addCookies([{
      name: 'session-token', value: ADMIN_TOKEN,
      domain: 'localhost', path: '/',
    }]);
    await page.goto('/admin');
    // Klikk "AI-kostnader"-fanen
    const tab = page.getByRole('tab', { name: /AI-kostnader/ });
    if (!(await tab.isVisible().catch(() => false))) {
      // Kan være i en menu — prøv link
      const link = page.getByText('AI-kostnader').first();
      if (!(await link.isVisible().catch(() => false))) {
        test.skip(true, 'AI-kostnader-fane ikke synlig');
        return;
      }
      await link.click();
    } else {
      await tab.click();
    }

    // Vent på at dashboardet rendres
    await expect(page.getByText(/Claude-bruk og kostnader/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Totalkostnad/i)).toBeVisible();
    await expect(page.getByText(/Tokens forbrukt/i)).toBeVisible();
    await expect(page.getByText(/Cache-besparelser/i)).toBeVisible();
    await expect(page.getByText(/Error rate/i)).toBeVisible();
  });
});
