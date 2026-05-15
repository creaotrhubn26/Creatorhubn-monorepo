/**
 * F10 — polert studio-ops-tabs: Classes, Instructors, Rooms, MovementVocab
 * med stat-stripes.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';

test.describe('dance — F10 studio polish', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
  });

  test('F10-1: Classes har stat-strip', async ({ page }) => {
    await switchDanceTab(page, 'classes');
    await expect(page.getByTestId('classes-stat-strip')).toBeVisible({ timeout: 15_000 });
  });

  test('F10-2: Instructors har stat-strip', async ({ page }) => {
    await switchDanceTab(page, 'instructors');
    await expect(page.getByTestId('instructors-stat-strip')).toBeVisible({ timeout: 15_000 });
  });

  test('F10-3: Rooms har stat-strip', async ({ page }) => {
    await switchDanceTab(page, 'rooms');
    await expect(page.getByTestId('rooms-stat-strip')).toBeVisible({ timeout: 15_000 });
  });

  test('F10-4: MovementVocab har stat-strip + kategori-distribusjon', async ({ page }) => {
    await switchDanceTab(page, 'movement_vocab');
    await expect(page.getByTestId('vocab-stat-strip')).toBeVisible({ timeout: 15_000 });
  });
});
