/**
 * F9 — polert finans-tabs: Grants templates, Invoices stats, Union workdays.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';

test.describe('dance — F9 finance polish', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
  });

  test('F9-1: Grants har stat-strip + templates', async ({ page }) => {
    await switchDanceTab(page, 'grants');
    await expect(page.getByTestId('grants-stat-strip')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('grants-templates')).toBeVisible();
    await expect(page.getByTestId('grants-template-kulturradet_fri_scenekunst')).toBeVisible();
    await expect(page.getByTestId('grants-template-fond_lyd_bilde')).toBeVisible();
  });

  test('F9-2: Invoices har stat-strip', async ({ page }) => {
    await switchDanceTab(page, 'billing');
    await expect(page.getByTestId('invoices-stat-strip')).toBeVisible({ timeout: 15_000 });
  });

  test('F9-3: Union har arbeidsdager-summary med kvartal-fordeling', async ({ page }) => {
    await switchDanceTab(page, 'union');
    await expect(page.getByTestId('union-workdays-strip')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('union-quarter-Q1')).toBeVisible();
    await expect(page.getByTestId('union-quarter-Q4')).toBeVisible();
  });
});
