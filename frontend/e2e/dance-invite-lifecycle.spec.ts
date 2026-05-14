/**
 * A3 — Invite-lifecycle: resend + revoke.
 *
 * Komponent: TeamAdminPanel.tsx (invite-rad har "..." meny)
 * Endpoint:  DELETE /api/dance/teams/:teamId/invites/:token (revoke)
 *            POST   /api/dance/teams/:teamId/invites (resend = ny invite)
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';
import { getCallCount } from './helpers/danceMocks';

test.describe('dance — invite lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "team");
  });

  test('owner revoker pending invite', async ({ page }) => {
    // window.confirm aksepteres
    page.on('dialog', (d) => void d.accept());
    await page.getByTestId('team-invite-revoke-invite-token-pending-abc').click();

    await expect.poll(() =>
      getCallCount(page, 'DELETE /api/dance/teams/team-oslo-elite/invites/invite-token-pending-abc'),
    ).toBe(1);
  });

  test('copy invite-link kopierer til clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByTestId('team-invite-copy-invite-token-pending-abc').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('/dance/invite/invite-token-pending-abc');
  });

  test('revoked invite forsvinner etter refresh', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await page.getByTestId('team-invite-revoke-invite-token-pending-abc').click();

    // Etter revoke skal listen oppdatere — override så GET returnerer tom liste
    await page.route('**/api/dance/teams/team-oslo-elite/invites', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
    await page.reload();
    await expect(page.getByTestId('team-invite-row-invite-token-pending-abc')).not.toBeVisible({ timeout: 10_000 });
  });
});
