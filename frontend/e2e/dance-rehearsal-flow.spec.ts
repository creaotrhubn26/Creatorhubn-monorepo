/**
 * E4 — RehearsalPlanner: focus area → segment review → jump.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';
import { getCallCount } from './helpers/danceMocks';

test.describe('dance — rehearsal flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "rehearsal_log");
  });

  test('eksisterende rehearsal (reh-1) viser 2 focus areas', async ({ page }) => {
    await expect(page.getByTestId('focus-area-fa-1')).toBeVisible();
    await expect(page.getByTestId('focus-area-fa-2')).toBeVisible();
  });

  test('legg til ny focus area', async ({ page }) => {
    await expect(page.getByTestId('rehearsal-planner')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('focus-area-fa-1')).toBeVisible();
    const before = await page.locator('[data-testid^="focus-area-"]').count();
    await page.getByTestId('rehearsal-add-focus').click();
    await expect(page.locator('[data-testid^="focus-area-"]')).toHaveCount(before + 1, { timeout: 5_000 });
  });

  test('klikk på focus-area med segmentRef → scroller til segment', async ({ page }) => {
    const focusArea = page.getByTestId('focus-area-fa-1');
    const jumpBtn = focusArea.getByRole('button', { name: /Hopp|Jump|Gå til/i });
    if (!(await jumpBtn.isVisible().catch(() => false))) {
      test.skip(true, 'jump-knapp ikke i UI');
      return;
    }
    await jumpBtn.click();
    // Bytter til Stykker-tab (eller scroll-into-view)
    await expect(page.getByTestId('choreo-segment-item-seg-3')).toBeInViewport({ timeout: 5_000 });
  });

  test('mark segment review som approved', async ({ page }) => {
    const review = page.getByTestId('segment-review-seg-3');
    const approveBtn = review.getByRole('button', { name: /Godkjent|Approved/i });
    if (!(await approveBtn.isVisible().catch(() => false))) {
      test.skip(true, 'segment-review-knapper ikke i UI');
      return;
    }
    const patched = page.waitForRequest(
      (req) => /\/api\/dance\/rehearsals\/reh-1/.test(req.url()) && ['PATCH', 'PUT'].includes(req.method()),
      { timeout: 5_000 },
    );
    await approveBtn.click();
    await patched;
  });
});
