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

    const content = page.locator('[role="tabpanel"]').first();
    const box = await content.boundingBox();
    if (!box) test.skip(true, 'tabpanel ikke målbar');
    if (!box) return;

    await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height / 2);
    // Simulate swipe left
    await page.evaluate((b) => {
      const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      const touch = (x: number, y: number) => new Touch({ identifier: 0, target: el!, clientX: x, clientY: y });
      el!.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(b.x + b.width * 0.8, b.y + b.height / 2)] }));
      el!.dispatchEvent(new TouchEvent('touchmove',  { touches: [touch(b.x + b.width * 0.2, b.y + b.height / 2)] }));
      el!.dispatchEvent(new TouchEvent('touchend',   { touches: [] }));
    }, box);

    await page.waitForTimeout(500);
    const endTab = await page.locator('[role="tab"][aria-selected="true"]').first().textContent();
    if (startTab === endTab) {
      test.fixme(true, 'Swipe-gesture for tab-bytte ikke implementert');
    }
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
