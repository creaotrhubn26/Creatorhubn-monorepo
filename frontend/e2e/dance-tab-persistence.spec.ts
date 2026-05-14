/**
 * D2 — ?tab=formations overlever refresh.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest } from './helpers/danceSetup';

test.describe('dance — tab persistence', () => {
  test('refresh på ?tab=formations beholder formation-view', async ({ page }) => {
    await setupDanceTest(page, { initialTab: 'formations' });
    await expect(page.getByTestId('formation-view')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByTestId('formation-view')).toBeVisible({ timeout: 15_000 });
  });

  test('ulovlig ?tab=-verdi faller tilbake til default uten å crashe', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(e.message));
    await setupDanceTest(page, { initialTab: 'nonsense-tab-name-xyz' });
    // Workspace mountes — IKKE crash
    await expect(page.getByTestId('e2e-harness-root')).toBeVisible();
    // Default-tab er aktiv (dashboard)
    const activeTab = page.locator('[role="tab"][aria-selected="true"]').first();
    await expect(activeTab).toBeVisible();
    const blocking = consoleErrors.filter((e) => !e.match(/DevTools|HMR/));
    expect(blocking).toEqual([]);
  });
});
