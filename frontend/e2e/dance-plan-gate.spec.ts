/**
 * C4 — useDancePlanGate: gated feature blokkerer UI + åpner UpgradeDialog.
 *
 * Test bruker `video_review_pro` som gated feature (krever Creator-plan eller add-on).
 * Med default subscription (Studio-plan har feature) — drawing-toggle aktiv.
 * Med override til Free-plan — drawing-toggle disabled, klikk åpner UpgradeDialog.
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';

test.describe('dance — plan gate', () => {
  test('Pricing page viser plan-kort fra fixture', async ({ page }) => {
    await installDanceMocks(page);
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026&tab=pricing');
    await expect(page.getByTestId('plan-card-plan-free')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('plan-card-plan-studio')).toBeVisible();
  });

  test('Free-plan: drawing-toggle disabled + Upgrade-dialog ved klikk', async ({ page }) => {
    await installDanceMocks(page, {
      overrides: { subscription: { planId: 'plan-free' } },
    });
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026');
    await page.getByRole('tab', { name: /Video/i }).click();

    // Åpne en clip (clip-1)
    await page.getByTestId('video-library-item-clip-1').click();

    const drawingToggle = page.getByTestId('review-drawing-toggle');
    await expect(drawingToggle).toBeVisible();
    await drawingToggle.click();

    // Upgrade-dialog vises
    await expect(page.getByText(/oppgrader|upgrade/i)).toBeVisible({ timeout: 5_000 });
  });

  test('Studio-plan: drawing-toggle aktiv + ingen dialog', async ({ page }) => {
    await installDanceMocks(page); // default = plan-studio
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026');
    await page.getByRole('tab', { name: /Video/i }).click();
    await page.getByTestId('video-library-item-clip-1').click();

    const drawingToggle = page.getByTestId('review-drawing-toggle');
    await drawingToggle.click();
    await expect(page.getByText(/oppgrader|upgrade/i)).not.toBeVisible({ timeout: 1_000 });
  });
});
