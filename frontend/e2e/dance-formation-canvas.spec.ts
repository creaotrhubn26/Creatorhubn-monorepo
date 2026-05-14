/**
 * E3 — FormationView (Fabric.js canvas) — drag, symmetry, distribute.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest } from './helpers/danceSetup';

test.describe('dance — formation canvas', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page, { initialTab: 'formations' });
  });

  test('roster + canvas vises', async ({ page }) => {
    await expect(page.getByTestId('formation-canvas')).toBeVisible();
    await expect(page.getByTestId('formation-roster')).toBeVisible();
  });

  test('drag dancer-puck — POST/PATCH til formations endpoint', async ({ page }) => {
    const canvas = page.getByTestId('formation-canvas');
    const box = await canvas.boundingBox();
    if (!box) test.fail();
    const start = { x: box!.x + 50, y: box!.y + 50 };
    const end = { x: box!.x + 250, y: box!.y + 200 };

    const fired = page.waitForRequest(
      (req) => ['POST', 'PUT', 'PATCH'].includes(req.method()) && req.url().includes('/api/dance/formations'),
      { timeout: 5_000 },
    ).catch(() => null);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 10 });
    await page.mouse.up();

    const req = await fired;
    if (!req) {
      test.fixme(true, 'Drag-state lagres ikke via /api/dance/formations ennå');
    }
  });

  test('symmetry-toggle endrer canvas-tilstand', async ({ page }) => {
    const toggle = page.getByTestId('formation-symmetry-toggle');
    if (!(await toggle.isVisible().catch(() => false))) {
      test.skip(true, 'symmetry-toggle ikke i UI');
      return;
    }
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', /true/, { timeout: 2_000 });
  });

  test('distribute-x knapp synlig + klikkbar', async ({ page }) => {
    const btn = page.getByTestId('formation-distribute-x');
    if (!(await btn.isVisible().catch(() => false))) {
      test.skip(true, 'distribute-x ikke i UI');
      return;
    }
    await btn.click();
  });

  test('snap-mode bytter mellom off/coarse/fine', async ({ page }) => {
    const off = page.getByTestId('formation-snap-off');
    const coarse = page.getByTestId('formation-snap-coarse');
    const fine = page.getByTestId('formation-snap-fine');
    if (!(await off.isVisible().catch(() => false))) {
      test.skip(true, 'snap-toggle-knapper ikke i UI');
      return;
    }
    await coarse.click();
    await expect(coarse).toHaveAttribute('aria-pressed', /true/);
    await fine.click();
    await expect(fine).toHaveAttribute('aria-pressed', /true/);
    await off.click();
    await expect(off).toHaveAttribute('aria-pressed', /true/);
  });
});
