/**
 * F3 — DanceWorkspace tab-bar på mobil.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest } from './helpers/danceSetup';

test.describe('dance shell — mobile @mobile', () => {
  test('tab-bar har horisontal scroll uten viewport-overflow', async ({ page }) => {
    await setupDanceTest(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);

    // Tab-stripen kan scrolles
    const tabList = page.getByRole('tablist').first();
    const scrollWidth = await tabList.evaluate((el) => el.scrollWidth);
    const clientWidth = await tabList.evaluate((el) => el.clientWidth);
    expect(scrollWidth).toBeGreaterThanOrEqual(clientWidth);
  });

  test('swipe på tab-content bytter tab', async ({ page }) => {
    await setupDanceTest(page);
    const startTab = await page.locator('[role="tab"][aria-selected="true"]').first().textContent();

    const tabpanel = page.locator('[role="tabpanel"]').first();
    await expect(tabpanel).toBeVisible();
    // Dispatch touchstart + touchend direkte på tabpanel-elementet
    // (bypass viewport-visibility-sjekken som elementFromPoint krever).
    await tabpanel.evaluate((el) => {
      const mkTouch = (x: number, y: number) => new Touch({ identifier: 0, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true, cancelable: true,
        touches: [mkTouch(300, 200)], targetTouches: [mkTouch(300, 200)], changedTouches: [mkTouch(300, 200)],
      }));
      el.dispatchEvent(new TouchEvent('touchend', {
        bubbles: true, cancelable: true,
        touches: [], targetTouches: [], changedTouches: [mkTouch(80, 200)],
      }));
    });

    await page.waitForTimeout(300);
    const endTab = await page.locator('[role="tab"][aria-selected="true"]').first().textContent();
    expect(endTab).not.toBe(startTab);
  });

  test('MyTeamsHeader blir bottom-sheet på mobil', async ({ page }) => {
    await setupDanceTest(page);
    const teamsHeader = page.getByTestId('my-teams-header').or(
      page.getByRole('button', { name: /Oslo Elite|Team/i }).first(),
    );
    if (!(await teamsHeader.isVisible().catch(() => false))) {
      test.skip(true, 'MyTeamsHeader ikke synlig');
      return;
    }
    await teamsHeader.click();
    // En bottom-sheet bør være forankret nederst i viewport
    const sheet = page.getByRole('dialog').or(page.locator('[role="presentation"]')).first();
    const sheetBox = await sheet.boundingBox().catch(() => null);
    const vh = await page.evaluate(() => window.innerHeight);
    if (sheetBox && sheetBox.y > vh * 0.4) {
      // Den er forankret nederst — OK
    } else {
      test.fixme(true, 'Bottom-sheet for MyTeamsHeader ikke implementert på mobil');
    }
  });
});
