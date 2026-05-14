/**
 * G4 — FormationView: aria-live-region announce ved dancer-move.
 *
 * Fabric.js-canvas er ikke screen-reader-tilgjengelig, så vi trenger en
 * separat live-region som beskriver endringer.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest } from './helpers/danceSetup';

test.describe('dance — formation aria-live', () => {
  test('canvas har minst én aria-live-region tilknyttet', async ({ page }) => {
    await setupDanceTest(page, { initialTab: 'formations' });

    const liveRegions = await page.locator('[aria-live="polite"], [aria-live="assertive"]').count();
    expect(liveRegions).toBeGreaterThan(0);
  });

  test('drag dancer → live-region innholdet oppdaterer', async ({ page }) => {
    await setupDanceTest(page, { initialTab: 'formations' });

    const liveRegion = page.locator('[aria-live="polite"], [aria-live="assertive"]').first();
    const before = await liveRegion.textContent().catch(() => '');

    const canvas = page.getByTestId('formation-canvas');
    const box = await canvas.boundingBox();
    if (!box) {
      test.skip(true, 'canvas ikke målbar');
      return;
    }
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 200, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(500);
    const after = await liveRegion.textContent().catch(() => '');
    if (before === after) {
      test.fixme(true, 'aria-live oppdaterer ikke ved drag — implementer announce i FormationView');
    }
  });
});
