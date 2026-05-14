/**
 * G3 — Focus-trap i dialogs (UpgradeToFreelanceDialog, DancerProfileEditor).
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';

test.describe('dance — focus trap', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
  });

  test('DancerProfileEditor: Tab loops innenfor dialog', async ({ page }) => {
    await switchDanceTab(page, "students");
    // Vent på at danser-cards er rendret før vi prøver å klikke edit-knappen
    await expect(page.getByTestId('dancer-profile-grid')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('dancer-profile-edit-dnc-1')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('dancer-profile-edit-dnc-1').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Hent alle tabbable elementer i dialogen
    const focusables = await dialog.locator(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ).count();
    expect(focusables).toBeGreaterThan(0);

    // Tab N+1 ganger — focus skal være tilbake til første element (eller forblir inne i dialogen)
    for (let i = 0; i < focusables + 1; i++) {
      await page.keyboard.press('Tab');
    }
    const focusInsideDialog = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      return !!dlg && dlg.contains(document.activeElement);
    });
    expect(focusInsideDialog).toBe(true);
  });

  test('Esc lukker DancerProfileEditor', async ({ page }) => {
    await switchDanceTab(page, "students");
    await expect(page.getByTestId('dancer-profile-edit-dnc-1')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('dancer-profile-edit-dnc-1').click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });
});
