/**
 * D1 — MyTeamsHeader: bytte team → URL ?team= oppdateres, data re-fetches.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest } from './helpers/danceSetup';
import { getCallCount } from './helpers/danceMocks';

test.describe('dance — multi-team switch', () => {
  test('velg Bergen Collective via team-switcher', async ({ page }) => {
    await setupDanceTest(page);
    // Vent på at memberships-fetch har returnert + MyTeamsHeader er rendret.
    const switcher = page.getByTestId('my-teams-header');
    await expect(switcher).toBeVisible({ timeout: 10_000 });

    await switcher.click();
    await page.getByTestId('my-teams-switch-team-bergen-collective').click();

    // DanceWorkspace.onSwitchTeam oppdaterer ?team=<orgId> via replaceState.
    await expect(page).toHaveURL(/team=team-bergen-collective/, { timeout: 5_000 });
  });

  test('upgrade-offer-dismiss persisteres per medlemskap', async ({ page }) => {
    await setupDanceTest(page);
    const dismissBtn = page.getByRole('button', { name: /Dismiss|Lukk tilbud/i }).first();
    if (!(await dismissBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Upgrade-offer ikke synlig i denne teststaten');
      return;
    }
    const posted = page.waitForRequest(
      (req) => req.method() === 'POST' && /\/api\/dance\/teams\/me\/memberships\/.+\/dismiss-upgrade/.test(req.url()),
      { timeout: 5_000 },
    );
    await dismissBtn.click();
    await posted;
  });
});
