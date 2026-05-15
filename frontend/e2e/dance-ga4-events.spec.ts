/**
 * H4 — GA4 dataLayer events for dance.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

test.describe('dance — GA4 events', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.dataLayer = [];
    });
    await setupDanceTest(page);
  });

  test('tab-switch fyrer dance_tab_view-event', async ({ page }) => {
    await switchDanceTab(page, "video");

    const events = await page.evaluate(() => window.dataLayer ?? []);
    const hit = events.find((e) => e.event === 'dance_tab_view' || e.event === 'tab_view');
    expect(hit, 'GA4 dance_tab_view should fire on tab switch').toBeTruthy();
  });

  test('invite-generate fyrer dance_invite_created', async ({ page }) => {
    await switchDanceTab(page, "team");
    const inviteBtn = page.getByRole('button', { name: /Inviter medlem|Invitere/i }).first();
    if (!(await inviteBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Invite-knapp ikke synlig');
      return;
    }
    await inviteBtn.click();
    await page.getByLabel(/E-?post/i).fill('ga4@example.com');
    await page.getByRole('button', { name: /Send/i }).click();

    await page.waitForTimeout(500);
    const events = await page.evaluate(() => window.dataLayer ?? []);
    const hit = events.find((e) => e.event === 'dance_invite_created' || e.event === 'invite_created');
    expect(hit, 'GA4 dance_invite_created should fire on invite').toBeTruthy();
  });

  test('choreography-save fyrer dance_piece_saved', async ({ page }) => {
    await switchDanceTab(page, "pieces");
    await expect(page.getByTestId('choreography-builder')).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape'); // lukk evt åpne menus
    const save = page.getByTestId('choreo-save');
    if (!(await save.isVisible().catch(() => false))) {
      test.skip(true, 'choreo-save knapp ikke synlig — kan være gated');
      return;
    }
    await save.click();
    await page.waitForTimeout(500);
    const events = await page.evaluate(() => window.dataLayer ?? []);
    const hit = events.find((e) => e.event === 'dance_piece_saved' || e.event === 'piece_saved');
    expect(hit, 'GA4 event dance_piece_saved should fire on save').toBeTruthy();
  });
});
