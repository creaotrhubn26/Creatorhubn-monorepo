/**
 * D3 — dance_studio vs dance_freelance: ulike tabs.
 *
 * Studio har: Klasser, Lærere, Rom, Team-admin.
 * Freelance har: Reel, Faktura, Addons. (Subset.)
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest } from './helpers/danceSetup';

test.describe('dance — profession mode routing', () => {
  test('dance_studio viser Klasser-tab', async ({ page }) => {
    await setupDanceTest(page, { mode: 'dance_studio' });
    await expect(page.getByRole('tab', { name: /Klasser|Classes/i })).toBeVisible();
  });

  test('dance_freelance skjuler Klasser-tab', async ({ page }) => {
    await setupDanceTest(page, { mode: 'dance_freelance' });
    await expect(page.getByRole('tab', { name: /Klasser|Classes/i })).toHaveCount(0);
  });

  test('dance_freelance viser Reel-tab', async ({ page }) => {
    await setupDanceTest(page, { mode: 'dance_freelance' });
    await expect(page.getByRole('tab', { name: /Reel/i })).toBeVisible();
  });
});
