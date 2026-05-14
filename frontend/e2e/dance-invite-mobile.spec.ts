/**
 * F2 — InviteLandingPage på mobil (Pixel 5).
 *
 * Bare tagger med @mobile — playwright.config.ts grep-er denne tagen for
 * mobile-chrome og mobile-safari projects.
 *
 * Komponent: frontend/client/src/components/role-room/dance/InviteLandingPage.tsx
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';

test.describe('dance invite — mobile @mobile', () => {
  test('PIN-form synlig over keyboard på Pixel 5', async ({ page }) => {
    await installDanceMocks(page);
    // Direkte til invite-landing — ikke harness, fordi InviteLandingPage er
    // en standalone-side som mountes utenom DanceWorkspace.
    await page.goto('/dance/invite/invite-token-pending-abc');

    // Header skal være synlig
    await expect(page.getByText(/Du er invitert/i)).toBeVisible({ timeout: 15_000 });

    // Send-PIN-knappen skal være tappable (min 44x44 px) og innenfor viewport
    const sendBtn = page.getByRole('button', { name: /Send PIN/i });
    const box = await sendBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.y + box!.height).toBeLessThan(700); // Pixel 5 = 851 høyde

    // Ingen horisontal scroll
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test('PIN-input + consent-checkbox tappable @mobile', async ({ page }) => {
    await installDanceMocks(page);
    await page.goto('/dance/invite/invite-token-pending-abc');
    await page.getByRole('button', { name: /Send PIN/i }).click();

    const pinInput = page.getByLabel(/6-sifret PIN/i);
    await expect(pinInput).toBeVisible();
    await pinInput.fill('123456');

    const consent = page.getByRole('checkbox');
    const consentBox = await consent.boundingBox();
    expect(consentBox).not.toBeNull();
    expect(consentBox!.width).toBeGreaterThanOrEqual(20);
  });
});
