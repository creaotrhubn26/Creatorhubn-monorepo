/**
 * C3 — Medlem uten team.manage_roles ser ingen "Ny rolle"-knapp.
 *
 * TeamAdminPanel sjekker membership.role.isOwnerRole — non-owner får
 * skjult knappen istedenfor disabled.
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';
import { fx } from './fixtures/dance/index';

test.describe('dance — capability gate UI', () => {
  test('danser ser ingen "Ny rolle"-knapp', async ({ page }) => {
    const nonOwnerMembership = {
      team: fx.teams[0],
      member: { ...fx.members[3] }, // mem-4: danser
      role: fx.roles[3],            // role-dancer
      upgradeOfferSeenAt: null,
    };
    await installDanceMocks(page);
    await page.route('**/api/dance/teams/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: nonOwnerMembership }) }),
    );
    await page.route('**/api/dance/teams/me/all', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [nonOwnerMembership] }) }),
    );
    await page.route('**/api/dance/teams/me/capabilities', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { capabilities: ['video_review.view'] } }) }),
    );
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026&tab=team');

    await expect(page.getByTestId('team-admin')).toBeVisible({ timeout: 10_000 });
    // Owner-only "Ny rolle"-knapp skal ikke være rendret for non-owner
    await expect(page.getByTestId('team-new-role')).toHaveCount(0);
    // Owner-only "Inviter medlem"-knapp likedan
    await expect(page.getByTestId('team-invite-trigger')).toHaveCount(0);
  });
});
