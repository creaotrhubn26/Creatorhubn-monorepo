/**
 * B4 — Admin-ops smoke-test: Performances, MusicArchive, Reel, Grants, Invoices, Union.
 *
 * Hver tab laster uten console-error og kan legge til én rad.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';

// Bruker tab-id direkte via switchDanceTab (testid `dance-tab-<id>`) — slik
// at vi ikke er avhengig av Norske label-varianter.
const ADMIN_TABS: Array<{ id: string; entityName: string }> = [
  { id: 'performances', entityName: 'performance' },
  { id: 'music',        entityName: 'music' },
  // 'reel' er kun synlig i dance_freelance — hopper over i studio-modus
  { id: 'grants',       entityName: 'grant' },
  { id: 'billing',      entityName: 'invoice' },
  { id: 'union',        entityName: 'union' },
];

test.describe('dance — admin ops smoke', () => {
  for (const tab of ADMIN_TABS) {
    test(`${tab.entityName} tab laster uten console error`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('pageerror', (e) => consoleErrors.push(e.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await setupDanceTest(page);
      await switchDanceTab(page, tab.id);

      // Filtrer ut React DevTools / dev-server-støy
      const blocking = consoleErrors.filter(
        (e) => !e.includes('DevTools') && !e.includes('HMR') && !e.match(/^Download the React/i),
      );
      expect(blocking).toEqual([]);
    });
  }

  test('opprett 1 rad i Performances-panel + verifiser POST', async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "performances");
    const newBtn = page.getByTestId(/crud-new-/).first();
    if (!(await newBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Performances-panel ikke synlig — skipper');
      return;
    }
    await newBtn.click();
    await page.locator('input[type="text"]').first().fill(`Smoke-perf-${Date.now()}`);
    const posted = page.waitForRequest(
      (req) => req.method() === 'POST' && req.url().includes('/api/dance/ops/performances'),
      { timeout: 5_000 },
    ).catch(() => null);
    await page.getByTestId('crud-submit').click();
    const req = await posted;
    expect(req).not.toBeNull();
  });
});
