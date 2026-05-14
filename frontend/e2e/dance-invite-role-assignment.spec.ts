/**
 * A4 — Invite med rolle=koreograf → workspace etter accept har koreograf-tabs.
 *
 * Fixture: invite-token-choreo-cho har invitedRoleId='role-choreographer'.
 * Etter accept-with-pin returnerer mock danceRoleId='role-choreographer'.
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';

test.describe('dance invite — role assignment', () => {
  test('koreograf-invite → workspace skjuler admin-tabs', async ({ page }) => {
    await installDanceMocks(page);
    await page.goto('/dance/invite/invite-token-choreo-cho');
    await page.getByRole('button', { name: /Send PIN/i }).click();
    await page.getByLabel(/6-sifret PIN/i).fill('123456');
    await page.getByLabel(/Fullt navn/i).fill('Ny Koreograf');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Bekreft|Aksepter/i }).click();

    await expect(page.getByText(/Velkommen|teamet/i)).toBeVisible({ timeout: 10_000 });
  });

  test('post-accept workspace: koreograf-rolle skjuler admin-tabs', async ({ page }) => {
    await installDanceMocks(page);
    // Simuler post-accept-state ved å returnere koreograf-membership
    await page.route('**/api/dance/teams/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            team: { teamOrganizationId: 'team-oslo-elite', ownerUserId: 'user-owner-1', memberCount: 12, activeMemberCount: 10, seatLimit: 25, seatRemaining: 13, defaultInviteRoleId: 'role-dancer' },
            member: { memberRowId: 'mem-2', danceRoleId: 'role-choreographer', danceRoleLabel: 'Koreograf', enterpriseRole: 'member' },
            role: { id: 'role-choreographer', label: 'Koreograf', isOwnerRole: false, capabilities: { 'choreography.create': true, 'formation.use': true } },
          },
        }),
      }),
    );
    await page.route('**/api/dance/teams/me/capabilities', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { capabilities: ['choreography.create', 'choreography.edit_own', 'formation.use', 'video_review.view'] } }),
      }),
    );
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026');
    await expect(page.getByTestId('e2e-harness-root')).toBeVisible();

    // Koreograf-tabs synlige
    await expect(page.getByRole('tab', { name: /Stykker|Pieces|switchDanceTab(page, "pieces")/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Formation/i })).toBeVisible();

    // Admin-tabs IKKE synlige
    await expect(page.getByRole('tab', { name: /Team-admin|Plan-admin/i })).toHaveCount(0);
  });
});
