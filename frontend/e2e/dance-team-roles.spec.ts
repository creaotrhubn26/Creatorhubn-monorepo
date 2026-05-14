/**
 * C1 — Owner oppretter custom rolle med capability-toggles.
 *
 * Komponent: TeamAdminPanel.tsx → role-editor-dialog.
 * Endpoint:  POST /api/dance/teams/:teamId/roles
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';
import { getCallCount } from './helpers/danceMocks';

test.describe('dance — team roles', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "team");
  });

  test('owner oppretter ny rolle med capability-toggles', async ({ page }) => {
    await page.getByTestId('team-new-role').click();
    await expect(page.getByTestId('team-role-dialog')).toBeVisible();

    await page.getByTestId('team-role-label').fill('Gjeste-koreograf');
    await page.getByTestId('team-role-cap-choreography.create').check();
    await page.getByTestId('team-role-cap-choreography.edit_own').check();
    await page.getByTestId('team-role-cap-formation.use').check();

    await page.getByTestId('team-role-save').click();

    await expect.poll(() =>
      getCallCount(page, 'POST /api/dance/teams/team-oslo-elite/roles'),
    ).toBe(1);
  });

  test('rediger eksisterende rolle → PATCH med diff', async ({ page }) => {
    await page.getByTestId('team-role-edit-role-choreographer').click();
    await page.getByTestId('team-role-label').fill('Senior Koreograf');
    const patched = page.waitForRequest(
      (req) => req.method() === 'PATCH' && req.url().includes('/api/dance/teams/team-oslo-elite/roles/role-choreographer'),
      { timeout: 5_000 },
    );
    await page.getByTestId('team-role-save').click();
    const req = await patched;
    expect(req.postDataJSON()).toMatchObject({ label: 'Senior Koreograf' });
  });

  test('slett rolle med confirm', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    const deleted = page.waitForRequest(
      (req) => req.method() === 'DELETE' && req.url().includes('/api/dance/teams/team-oslo-elite/roles/role-instructor'),
      { timeout: 5_000 },
    );
    await page.getByTestId('team-role-delete-role-instructor').click();
    await deleted;
  });

  test('owner-rollen har ingen delete-knapp', async ({ page }) => {
    // role-owner er isOwnerRole=true → delete-IconButton rendres ikke
    await expect(page.getByTestId('team-role-delete-role-owner')).toHaveCount(0);
    // Edit-knappen finnes derimot
    await expect(page.getByTestId('team-role-edit-role-owner')).toBeVisible();
  });
});
