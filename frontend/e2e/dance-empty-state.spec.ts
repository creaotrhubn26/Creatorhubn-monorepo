/**
 * D4 — Empty-state for freelancer uten team.
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';

test.describe('dance — empty state', () => {
  test('Team-admin uten team viser empty-state-melding', async ({ page }) => {
    await installDanceMocks(page);
    // Override slik at bruker ikke har team-medlemskap
    await page.route('**/api/dance/teams/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null }),
      }),
    );
    await page.route('**/api/dance/teams/me/all', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      }),
    );
    // Stub ensureMyTeam så TeamAdminPanel sin "create-on-empty"-flow ikke
    // overskriver vårt empty-state-mock.
    await page.route('**/api/dance/teams/', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'frilanser' }) });
      }
      return route.continue();
    });
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026&tab=team');
    await expect(page.getByTestId('e2e-harness-root')).toBeVisible();

    // TeamAdminPanel viser tekst om at frilans-danser ikke har team-tilgang
    await expect(
      page.getByText(/ikke tilgang til et team|frilans-danser/i),
    ).toBeVisible({ timeout: 15_000 });
  });
});
