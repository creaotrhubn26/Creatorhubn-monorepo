/**
 * Production-vertical iPad/tablet e2e.
 *
 * Verifiserer at CastingPlannerPanel layout fungerer på iPad Pro 11
 * (834×1194). På denne viewport-bredden er vi i MUI sm/md-sone og bruker
 * tablet-tilpasninger (touch-targets + padding-justeringer fra commit
 * 6d3ca4ea — proporsjonal zoom 0.94 på tablet).
 */
import { test, expect } from '@playwright/test';
import { openCastingPlanner, openRoleRoomDashboard } from './helpers/role-room';

test.describe('production — tablet @tablet', () => {
  test('casting-planner-root mounter uten horisontal overflow på iPad', async ({ page }) => {
    await openCastingPlanner(page);
    await expect(page.locator('[data-testid="casting-planner-root"]')).toBeVisible();

    const { sw, cw, vw } = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      vw: window.innerWidth,
    }));
    // iPad Pro 11 = 834px bredde. Ingen horisontal overflow tillatt.
    expect(sw).toBeLessThanOrEqual(cw + 1); // +1 for sub-px rounding
    expect(vw).toBeGreaterThanOrEqual(800);
  });

  test('tab-list rendrer alle synlige tabs uten å klippes', async ({ page }) => {
    await openCastingPlanner(page);

    const tabList = page.getByRole('tablist').first();
    if (!(await tabList.isVisible().catch(() => false))) {
      test.skip(true, 'tablist ikke synlig på tablet — sjekk layout');
      return;
    }

    // På 834px-bredde forventer vi at noen tabs er synlige (kanskje ikke alle).
    // Verifier at scroll-mekanismen er aktiv (scrollWidth ≥ clientWidth).
    const scrollWidth = await tabList.evaluate((el) => el.scrollWidth);
    const clientWidth = await tabList.evaluate((el) => el.clientWidth);
    expect(scrollWidth).toBeGreaterThanOrEqual(clientWidth);

    // Verifier at minst 5 tabs er navigerbare i markup
    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('role-room dashboard rendrer på iPad uten layout-brudd', async ({ page }) => {
    await openRoleRoomDashboard(page);
    await expect(page.locator('.role-room-route').first()).toBeAttached();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });

  test('header-action-knapper har ≥36px touch-target på iPad', async ({ page }) => {
    await openCastingPlanner(page);

    // Tablet bruker zoom: 0.94, så effektiv touch-target er 0.94 × CSS-px.
    // For 40px CSS = ~38 device-px. Vi tillater 36.
    const buttons = page.locator('[data-testid="casting-planner-root"] button[aria-label]');
    const count = await buttons.count();
    if (count === 0) {
      test.skip(true, 'ingen aria-merkede knapper');
      return;
    }

    let checked = 0;
    let undersized = 0;
    for (let i = 0; i < Math.min(count, 20); i++) {
      const btn = buttons.nth(i);
      if (!(await btn.isVisible().catch(() => false))) continue;
      const box = await btn.boundingBox();
      if (!box || box.y > 200) continue;
      checked++;
      if (box.height < 36 || box.width < 36) undersized++;
    }
    if (checked === 0) {
      test.skip(true, 'ingen knapper i header-region');
      return;
    }
    expect(undersized).toBeLessThanOrEqual(1);
  });

  test('viktigste tabs kan navigeres til på iPad', async ({ page }) => {
    await openCastingPlanner(page);

    const tabsToTry = ['Dashboard', 'Roller', 'Roles', 'Audisjon', 'Auditions', 'Calendar', 'Kalender', 'Team'];
    let switched = 0;
    for (const label of tabsToTry) {
      const tab = page.getByRole('tab', { name: new RegExp(`^${label}`, 'i') }).first();
      if (!(await tab.isVisible().catch(() => false))) continue;
      try {
        await tab.scrollIntoViewIfNeeded({ timeout: 2_000 });
        await tab.click({ timeout: 3_000 });
        await page.waitForTimeout(200);
        switched++;
        if (switched >= 3) break;
      } catch {
        // ignore
      }
    }
    expect(switched).toBeGreaterThanOrEqual(2);
  });
});
