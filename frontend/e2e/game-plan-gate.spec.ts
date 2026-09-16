/**
 * Story Graph — plan-gating (Fase 4d): Pris-fane med plan-kort fra fixture,
 * Solo låser delingslenker/HTML/KI-oversettelse med banner, Studio åpner alt,
 * Admin · Planer kun for admin-rolle.
 */
import { test, expect } from '@playwright/test';
import { installNarrativeMocks } from './helpers/narrativeMocks';

const HARNESS = '/e2e-test.html?harness=game_studio&harness-project=proj-game-2026';

function withSession(page: import('@playwright/test').Page, role: 'user' | 'admin') {
  return page.addInitScript((r) => {
    window.localStorage.setItem('role_room_auth_token', 'e2e-token');
    window.localStorage.setItem('role_room_auth_session', JSON.stringify({ currentUserId: 'u-e2e', adminUser: { id: 'u-e2e', name: 'Meg Selv', email: 'meg@example.com', role: r } }));
  }, role);
}

test.describe('Story Graph — plan-gating', () => {
  test('Pris-fanen viser Solo/Pro/Studio fra fixture og markerer gjeldende plan', async ({ page }) => {
    await withSession(page, 'user');
    await installNarrativeMocks(page, { gamePlan: 'solo' });
    await page.goto(`${HARNESS}&tab=pricing`);
    await expect(page.getByTestId('game-plan-card-solo')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('game-plan-card-pro')).toBeVisible();
    await expect(page.getByTestId('game-plan-card-studio')).toBeVisible();
    await expect(page.getByTestId('game-pricing-current')).toContainText('Solo');
    await expect(page.getByTestId('game-plan-select-solo')).toBeDisabled();
    await expect(page.getByTestId('game-plan-select-pro')).toBeEnabled();
    // Ikke-admin ser ikke Admin · Planer
    await expect(page.getByTestId('narrative-tab-admin_plans')).toHaveCount(0);
  });

  test('Solo: delingslenke og HTML låst med banner; «Se planer» åpner Pris-fanen', async ({ page }) => {
    await withSession(page, 'user');
    await installNarrativeMocks(page, { gamePlan: 'solo' });
    await page.goto(`${HARNESS}&tab=exports`);
    await expect(page.getByTestId('narrative-plan-gate-share_links')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('narrative-share-create')).toHaveAttribute('data-locked', 'plan');
    await expect(page.getByTestId('narrative-share-create')).toBeDisabled();
    await expect(page.getByTestId('narrative-export-html')).toHaveAttribute('data-locked', 'plan');
    await expect(page.getByTestId('narrative-export-pdf')).toHaveAttribute('data-locked', 'plan');
    await expect(page.getByTestId('narrative-plan-gate-export_pdf')).toBeVisible();
    await expect(page.getByTestId('narrative-export-json')).toBeEnabled();
    await expect(page.getByTestId('narrative-export-csv')).toBeEnabled();
    await page.getByTestId('narrative-plan-gate-upgrade').first().click();
    await expect(page.getByTestId('game-pricing-page')).toBeVisible();
  });

  test('Solo: KI-oversettelse låst; Studio: alt åpent uten bannere', async ({ page }) => {
    await withSession(page, 'user');
    await installNarrativeMocks(page, { gamePlan: 'solo' });
    await page.goto(`${HARNESS}&tab=translations`);
    await expect(page.getByTestId('narrative-plan-gate-translations')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('narrative-translations-ai-all')).toHaveAttribute('data-locked', 'plan');

    await installNarrativeMocks(page, { gamePlan: 'studio' });
    await page.goto(`${HARNESS}&tab=exports`);
    await expect(page.getByTestId('narrative-share-create')).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByTestId('narrative-plan-gate-share_links')).toHaveCount(0);
    await expect(page.getByTestId('narrative-export-html')).not.toHaveAttribute('data-locked', 'plan');
    await expect(page.getByTestId('narrative-export-pdf')).toBeEnabled();
    await expect(page.getByTestId('narrative-plan-gate-export_pdf')).toHaveCount(0);
  });

  test('Abonnement-fanen og Admin · Planer for admin', async ({ page }) => {
    await withSession(page, 'admin');
    await installNarrativeMocks(page, { gamePlan: 'pro' });
    await page.goto(`${HARNESS}&tab=billing`);
    await expect(page.getByTestId('game-subscription-plan')).toHaveText('Pro', { timeout: 15_000 });
    await page.getByTestId('narrative-tab-admin_plans').click();
    await expect(page.getByTestId('game-plan-admin-row-solo')).toBeVisible();
    await page.getByTestId('game-plan-admin-create').click();
    await page.getByTestId('game-plan-form-slug').fill('team');
    await page.getByTestId('game-plan-form-name').fill('Team');
    await page.getByTestId('game-plan-form-save').click();
    await expect(page.getByTestId('game-plan-admin-row-team')).toBeVisible();
    await page.getByTestId('game-admin-section-testers').click();
    await page.getByTestId('game-tester-invite-create').click();
    await page.getByTestId('game-tester-invite-submit').click();
    await expect(page.getByTestId('game-tester-invite-row-tok_1')).toBeVisible();
  });
});
