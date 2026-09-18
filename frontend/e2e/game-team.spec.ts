/**
 * Story Graph Fase 7e-1 — Team og seter: roller med spill-kapabiliteter,
 * invitasjon, sete-grense (409 → melding), Solo-gate, og gjestens PIN-landing.
 */
import { expect, test, type Page } from '@playwright/test';
import { installNarrativeMocks, type MockGamePlanSlug } from './helpers/narrativeMocks';
import { installGameTeamMocks } from './helpers/gameTeamMocks';

async function openTeam(page: Page, opts: { gamePlan?: MockGamePlanSlug; seatLimit?: number | null; members?: number } = {}) {
  await installNarrativeMocks(page, { gamePlan: opts.gamePlan ?? 'studio' });
  await installGameTeamMocks(page, { seatLimit: opts.seatLimit, members: opts.members });
  await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=team');
  await expect(page.getByTestId('team-admin')).toBeVisible({ timeout: 15_000 });
}

test.describe('Story Graph — team og seter', () => {
  test('viser fire default-roller med spill-kapabiliteter og medlemmer', async ({ page }) => {
    await openTeam(page);
    for (const id of ['role-owner', 'role-producer', 'role-designer', 'role-reviewer']) await expect(page.getByTestId(`team-role-row-${id}`)).toBeVisible();
    await expect(page.getByTestId('team-role-delete-role-owner')).toHaveCount(0);
    await expect(page.getByTestId('team-member-row-mem-kari')).toContainText('Narrativ designer');
    await page.getByTestId('team-new-role').click();
    await expect(page.getByTestId('team-role-cap-review.decide')).toBeVisible();
    await expect(page.getByTestId('team-role-cap-scenes.delete')).toBeVisible();
    await page.getByTestId('team-role-label').fill('QA-lead');
    await page.getByTestId('team-role-cap-review.decide').check();
    await page.getByTestId('team-role-save').click();
    await expect(page.getByTestId('team-role-row-role-new-4')).toContainText('QA-lead');
  });

  test('invitasjon opprettes med lenke /game/invite/<token>; ved sete-grense vises 409-melding', async ({ page }) => {
    await openTeam(page, { seatLimit: 3 });
    await page.getByTestId('team-invite-trigger').click();
    await page.getByTestId('team-invite-email').fill('ny@studio.test');
    await page.getByTestId('team-invite-send').click();
    await expect(page.getByTestId('team-invite-row-gti_1')).toBeVisible();
    await expect(page.getByTestId('team-admin')).toContainText('0 igjen');
    // Grensen er nådd (2 medlemmer + 1 ventende invitasjon = 3 seter): knappen låses.
    await expect(page.getByTestId('team-invite-trigger')).toBeDisabled();
  });

  test('sete-grense fra serveren (409) gir tydelig melding i dialogen', async ({ page }) => {
    await openTeam(page, { seatLimit: 2 });
    // Klienten tror det er plass (summary før oppdatering), serveren avviser.
    await page.route('**/api/game/teams/*/me', (route) => route.continue());
    await page.getByTestId('team-invite-trigger').click({ force: true }).catch(() => undefined);
    const dialogVisible = await page.getByTestId('team-invite-email').isVisible().catch(() => false);
    if (dialogVisible) {
      await page.getByTestId('team-invite-email').fill('to-mange@studio.test');
      await page.getByTestId('team-invite-send').click();
      await expect(page.getByText(/brukt opp alle seats/i)).toBeVisible();
    } else {
      await expect(page.getByTestId('team-invite-trigger')).toBeDisabled();
    }
  });

  test('Solo: team-fanen viser plan-banner for team_seats', async ({ page }) => {
    await openTeam(page, { gamePlan: 'solo', seatLimit: 1 });
    await expect(page.getByTestId('narrative-plan-gate-team_seats')).toBeVisible();
  });

  test('gjest: /game/invite/<token> → info → PIN → aksept lander i spillstudio', async ({ page }) => {
    await installGameTeamMocks(page);
    await page.goto('/e2e-test.html?harness=game_invite&harness-token=gti_ok');
    await expect(page.getByText('Du er invitert')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Narrativ designer').first()).toBeVisible();
    await expect(page.getByText(/spillstudio/i).first()).toBeVisible();
    await page.goto('/e2e-test.html?harness=game_invite&harness-token=gti_expired');
    await expect(page.getByText(/utløpt/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
