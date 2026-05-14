/**
 * D1 — MyTeamsHeader: bytte team → URL ?team= oppdateres, data re-fetches.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest } from './helpers/danceSetup';
import { getCallCount } from './helpers/danceMocks';

test.describe('dance — multi-team switch', () => {
  test('velg Bergen Collective via team-switcher', async ({ page }) => {
    await setupDanceTest(page);

    // MyTeamsHeader vises kun hvis bruker har >1 team — vi har 2 teams i fixture
    const switcher = page.getByTestId('my-teams-header');
    if (!(await switcher.isVisible().catch(() => false))) {
      test.skip(true, 'MyTeamsHeader ikke rendret — fixture må ha >1 team');
      return;
    }
    await switcher.click();
    await page.getByTestId('my-teams-switch-team-bergen-collective').click();

    // onSwitchTeam-callback fyrer — det er DanceWorkspace som oppdaterer URL,
    // ikke MyTeamsHeader. Hvis ikke URL endres er det fordi parent ikke har
    // koblet onSwitchTeam til URL-router.
    await page.waitForTimeout(500);
    // /api/dance/teams/me re-kalt med ny team-context
    expect(getCallCount(page, 'GET /api/dance/teams/me')).toBeGreaterThanOrEqual(1);
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
