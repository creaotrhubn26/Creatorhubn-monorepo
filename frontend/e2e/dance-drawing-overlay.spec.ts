/**
 * E7 — Drawing-overlay (V2 / video_review_pro-gated).
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';

test.describe('dance — drawing overlay', () => {
  test('Studio-plan: drawing-overlay aktiveres + tegninger persisteres', async ({ page }) => {
    await installDanceMocks(page); // default = plan-studio
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026&tab=video');
    await page.getByTestId('video-library-item-clip-1').click();
    await page.getByTestId('review-drawing-toggle').click();

    const canvas = page.getByTestId('drawing-overlay-canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas not measurable');
    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 200);
    await page.mouse.up();

    test.fixme(true, 'TODO: verifiser at neste POST /annotations inkluderer drawing-payload');
  });

  test('Free-plan: drawing-toggle disabled — referanse til C4', async ({ page }) => {
    await installDanceMocks(page, { overrides: { subscription: { planId: 'plan-free' } } });
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026&tab=video');
    await page.getByTestId('video-library-item-clip-1').click();
    const toggle = page.getByTestId('review-drawing-toggle');
    // Toggle skal være disabled ELLER skjult ELLER åpne Upgrade-dialog ved klikk
    if (await toggle.isVisible().catch(() => false)) {
      const disabled = await toggle.isDisabled().catch(() => false);
      if (!disabled) {
        await toggle.click();
        await expect(page.getByText(/oppgrader|upgrade/i)).toBeVisible({ timeout: 5_000 });
      } else {
        expect(disabled).toBe(true);
      }
    } else {
      // skjult er også OK
      await expect(toggle).toHaveCount(0);
    }
  });
});
