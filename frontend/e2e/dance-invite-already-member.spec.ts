/**
 * A2 — Allerede-medlem case under invite-accept (409).
 *
 * Service:  danceTeamService.acceptInviteWithPin()
 * Endpoint: POST /api/dance/invites/:token/accept-with-pin → 409 conflict
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';

test.describe('dance invite — already-member case', () => {
  test('409 viser "du er allerede medlem"-melding', async ({ page }) => {
    await installDanceMocks(page, {
      overrides: {
        forceStatus: {
          'POST /api/dance/invites/.+/accept-with-pin': 409,
        },
      },
    });
    await page.goto('/dance/invite/invite-token-pending-abc');
    await page.getByRole('button', { name: /Send PIN/i }).click();
    await page.getByLabel(/6-sifret PIN/i).fill('123456');
    await page.getByLabel(/Fullt navn/i).fill('Eksisterende Bruker');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Bekreft|Aksepter/i }).click();

    await expect(
      page.getByText(/allerede medlem|allerede i teamet/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
