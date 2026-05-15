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
    // Vent på at FormationView er ferdig lastet (canvas synlig)
    await expect(page.getByTestId('formation-canvas')).toBeVisible({ timeout: 15_000 });

    const liveRegions = await page.locator('[aria-live="polite"], [aria-live="assertive"]').count();
    expect(liveRegions).toBeGreaterThan(0);
  });

  test('drag dancer → live-region innholdet oppdaterer', async ({ page }) => {
    await setupDanceTest(page, { initialTab: 'formations' });
    await expect(page.getByTestId('formation-canvas')).toBeVisible({ timeout: 15_000 });

    // Plasser en danser på scenen først — tom starter-formasjon har ingen
    // pucker å dra, så aria-live oppdaterer aldri.
    await page.getByTestId('roster-item-dnc-1').click();

    const liveRegion = page.getByTestId('formation-aria-live');
    const before = (await liveRegion.textContent().catch(() => '')) ?? '';

    const canvas = page.getByTestId('formation-canvas');
    const box = await canvas.boundingBox();
    if (!box) {
      test.skip(true, 'canvas ikke målbar');
      return;
    }
    // addDancerToFormation plasserer puck ca. midt på scenen (0.5, 0.5).
    const startX = box.x + box.width * 0.5;
    const startY = box.y + box.height * 0.5;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.3, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(500);
    const after = (await liveRegion.textContent().catch(() => '')) ?? '';
    expect(after).not.toBe(before);
    expect(after).toMatch(/flyttet/i);
  });
});
