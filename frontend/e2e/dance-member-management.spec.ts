/**
 * C2 — Patch member-role + remove member.
 *
 * Komponent: TeamAdminPanel.tsx → members-section.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';
import { getCallCount } from './helpers/danceMocks';

test.describe('dance — member management', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "team");
  });

  test('endre rolle på medlem', async ({ page }) => {
    // MUI Select rendres som combobox — klikk på combobox-elementet inne
    // i TextField-wrapperen for å åpne dropdown.
    const wrapper = page.getByTestId('team-member-role-select-mem-4');
    await wrapper.locator('[role="combobox"]').click();
    await page.getByRole('option', { name: /Koreograf/i }).first().click();

    await expect.poll(() =>
      getCallCount(page, 'PATCH /api/dance/teams/team-oslo-elite/members/mem-4'),
    ).toBe(1);
  });

  test('fjern medlem via context-menu med confirm', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await page.getByTestId('team-member-menu-mem-5').click();
    await page.getByTestId('team-member-remove-mem-5').click();

    await expect.poll(() =>
      getCallCount(page, 'DELETE /api/dance/teams/team-oslo-elite/members/mem-5'),
    ).toBe(1);
  });

  test('owner-medlem har ingen rolle-edit (locked)', async ({ page }) => {
    // mem-1 er owner — role-select rendres ikke for owner-rad
    await expect(page.getByTestId('team-member-role-select-mem-1')).toHaveCount(0);
  });
});
