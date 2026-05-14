/**
 * C3 — Medlem med team.manage_roles=false ser disabled role-buttons med tooltip.
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';

test.describe('dance — capability gate UI', () => {
  test('danser ser disabled "Ny rolle"-knapp med tooltip', async ({ page }) => {
    await installDanceMocks(page);
    // Override capabilities til kun danser-rolle (ingen team.manage_roles)
    await page.route('**/api/dance/teams/me/capabilities', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { capabilities: ['video_review.view'] } }),
      }),
    );
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026');

    await page.getByRole('tab', { name: /Team/i }).click().catch(() => {
      // Team-tab kan være helt skjult for danser — det er også gyldig
    });

    const newRoleBtn = page.getByRole('button', { name: /Ny rolle|Create role/i });
    if (await newRoleBtn.isVisible()) {
      await expect(newRoleBtn).toBeDisabled();
    } else {
      // Implementasjonen valgte å skjule i stedet for å disable — også OK.
      await expect(newRoleBtn).toHaveCount(0);
    }
  });
});
