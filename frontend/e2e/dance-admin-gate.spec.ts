/**
 * B5 — Admin-tabs gated av owner-rolle.
 *
 * Ikke-owner skal IKKE se admin-tabs (eller se dem disabled med tooltip).
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';
import { fx } from './fixtures/dance/index';

test.describe('dance — admin owner-only gate', () => {
  test('vanlig danser ser ikke admin-tabs', async ({ page }) => {
    await installDanceMocks(page);
    // Override capabilities til kun "danser"-rolle
    await page.route('**/api/dance/teams/me/capabilities', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            capabilities: Object.keys(fx.roles[3].capabilities).filter(
              (k) => (fx.roles[3].capabilities as Record<string, boolean>)[k],
            ),
          },
        }),
      }),
    );
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026');
    await expect(page.getByTestId('e2e-harness-root')).toBeVisible();

    // Team-admin-tab skal IKKE finnes
    await expect(page.getByRole('tab', { name: /Team-admin|Administrasjon/i })).toHaveCount(0);
  });

  test('Pricing-admin tab gated på billing.manage', async ({ page }) => {
    await installDanceMocks(page);
    await page.route('**/api/dance/teams/me/capabilities', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { capabilities: ['choreography.view', 'video_review.view'] },
        }),
      }),
    );
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026');
    await expect(page.getByTestId('e2e-harness-root')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Plan-admin|Pricing-admin|Plan/i })).toHaveCount(0);
  });

  test('Tester-invite tab gated på owner-role', async ({ page }) => {
    await installDanceMocks(page);
    // Returnér member uten isOwnerRole
    await page.route('**/api/dance/teams/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            team: fx.teams[0],
            member: { ...fx.members[3] },
            role: fx.roles[3], // role-dancer
          },
        }),
      }),
    );
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026');
    await expect(page.getByTestId('e2e-harness-root')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Tester|Test-invitasjon/i })).toHaveCount(0);
  });
});
