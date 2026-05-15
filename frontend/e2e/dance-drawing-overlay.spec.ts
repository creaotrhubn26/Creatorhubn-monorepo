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
    // Sticky tab-bar kan dekke topp av canvas — scroll inn først.
    await canvas.scrollIntoViewIfNeeded();

    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas not measurable');
    // Sentrer drag-rekken i canvas så vi unngår sticky headere i randsonene.
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 80, cy - 40);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 40, { steps: 10 });
    await page.mouse.up();

    // Skriv en kommentar slik at composeren ikke avvises på tom body, fang
    // payloaden i neste POST /annotations og verifiser at drawing er med.
    await page.getByTestId('review-composer-input').fill('Se markeringen');
    const postRequest = page.waitForRequest(
      (req) => req.method() === 'POST' && /\/annotations$/.test(req.url()),
      { timeout: 5_000 },
    );
    await page.getByTestId('review-send').click();
    const req = await postRequest;
    const payload = req.postDataJSON?.() as { drawing?: unknown } | undefined;
    expect(payload?.drawing, 'drawing-payload skal være med i POST').toBeTruthy();
  });

  test('Free-plan: drawing-toggle disabled — referanse til C4', async ({ page }) => {
    await installDanceMocks(page, { overrides: { subscription: { planId: 'plan-free' } } });
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026&tab=video');
    await page.getByTestId('video-library-item-clip-1').click();
    const toggle = page.getByTestId('review-drawing-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('data-locked', 'plan');
  });
});
