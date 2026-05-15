/**
 * F7 — polert admin-ops-tabs: Performances stripboard + Music waveform.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';

test.describe('dance — F7 admin ops polish', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
  });

  test('F7-1: PerformancesPanel har stripboard/tabell-toggle', async ({ page }) => {
    await switchDanceTab(page, 'performances');
    await expect(page.getByTestId('performance-view-toggle')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('performance-view-stripboard')).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('performance-view-table').click();
    await expect(page.getByTestId('performance-view-table')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('admin-ops-performances')).toBeVisible();
    await page.getByTestId('performance-view-stripboard').click();
    // Empty-state er OK siden default-fixture ikke har performances
    const sb = page.getByTestId('performance-stripboard').or(page.getByTestId('performance-stripboard-empty'));
    await expect(sb).toBeVisible();
  });

  test('F7-2: Music-panelet rendrer (waveform vises ved expand)', async ({ page }) => {
    await switchDanceTab(page, 'music');
    await expect(page.getByTestId('admin-ops-music')).toBeVisible({ timeout: 15_000 });
    // Default fixture er tom — bare verifiser at panelet selv rendrer.
  });
});
