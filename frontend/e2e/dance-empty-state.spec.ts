/**
 * D4 — Empty-state for freelancer uten team.
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';

test.describe('dance — empty state', () => {
  test('freelancer uten team ser CTA-empty-state', async ({ page }) => {
    await installDanceMocks(page);
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
    await page.goto('/e2e-test.html?harness=dance_freelance&harness-project=proj-spring-2026');

    await expect(
      page.getByText(/Lag ditt første team|Fortsett som freelancer|ingen team/i),
    ).toBeVisible({ timeout: 15_000 });
  });
});
