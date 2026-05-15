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
    // Vent på at review-stegets primær-CTA er rendret (async fetch av invite-info)
    const sendPinBtn = page.getByRole('button', { name: /Send PIN/i });
    await expect(sendPinBtn).toBeVisible({ timeout: 20_000 });
    await sendPinBtn.click();
    await page.getByLabel(/6-sifret PIN/i).fill('123456');
    await page.getByLabel(/Fullt navn/i).fill('Ny Koreograf');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Bekreft|Aksepter/i }).click();

    await expect(page.getByText(/Velkommen|teamet/i)).toBeVisible({ timeout: 15_000 });
  });

  test('post-accept workspace: koreograf-rolle skjuler admin-tabs', async ({ page }) => {
    const choreoMembership = {
      team: { teamOrganizationId: 'team-oslo-elite', ownerUserId: 'user-owner-1', memberCount: 12, activeMemberCount: 10, seatLimit: 25, seatRemaining: 13, defaultInviteRoleId: 'role-dancer' },
      member: { memberRowId: 'mem-2', danceRoleId: 'role-choreographer', danceRoleLabel: 'Koreograf', enterpriseRole: 'member' },
      role: { id: 'role-choreographer', label: 'Koreograf', isOwnerRole: false, capabilities: { 'choreography.create': true, 'formation.use': true } },
      upgradeOfferSeenAt: null,
    };
    await installDanceMocks(page);
    await page.route('**/api/dance/teams/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: choreoMembership }) }),
    );
    await page.route('**/api/dance/teams/me/all', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [choreoMembership] }) }),
    );
    await page.route('**/api/dance/teams/me/capabilities', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { capabilities: ['choreography.create', 'choreography.edit_own', 'formation.use', 'video_review.view'] } }) }),
    );
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026');
    await expect(page.getByTestId('e2e-harness-root')).toBeVisible();

    // Koreograf-tabs synlige (bruker stable testid)
    await expect(page.getByTestId('dance-tab-pieces')).toBeVisible();
    await expect(page.getByTestId('dance-tab-formations')).toBeVisible();

    // Admin-tabs IKKE synlige (gated på owner-role)
    await expect(page.getByTestId('dance-tab-admin_plans')).toHaveCount(0);
    await expect(page.getByTestId('dance-tab-admin_testers')).toHaveCount(0);
    await expect(page.getByTestId('dance-tab-admin_settings')).toHaveCount(0);
  });
});
