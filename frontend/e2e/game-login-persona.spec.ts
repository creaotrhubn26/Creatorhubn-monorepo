/**
 * Lansering (Fase 4d): landingskortet «Spillstudio — Story Graph» (beta) åpner
 * LoginDialog med persona Spillstudio forhåndsvalgt og to rollekort som begge
 * setter profession-mode game_studio.
 */
import { test, expect } from '@playwright/test';

test.describe('Spillstudio — landing + login-persona', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
    await page.route('**/api/auth/user', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"authenticated":false}' }));
    await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  });

  test('landingskort → login-dialog med Spillstudio-persona og rollekort', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto('/theroleroom.html', { waitUntil: 'domcontentloaded' });
    const card = page.locator('#vertical-game-studio');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText('BETA');
    await expect(card).toContainText('Solo gratis');
    await card.getByRole('button', { name: 'Utforsk' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Spillstudio/ }).first()).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByTestId('role-room-role-card-game_studio_owner')).toBeVisible();
    await expect(dialog.getByTestId('role-room-role-card-narrative_designer')).toBeVisible();
    // Ingen dansekort lekker inn i spillstudio-personaen
    await expect(dialog.getByTestId('role-room-role-card-dance_studio_owner')).toHaveCount(0);

    await dialog.getByTestId('role-room-role-card-narrative_designer').click();
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('role_room_profession_mode'))).toBe('game_studio');
  });

  test('?signup=game_studio dyplenke åpner dialogen direkte', async ({ page }) => {
    await page.goto('/theroleroom.html?signup=game_studio', { waitUntil: 'domcontentloaded' });
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByRole('button', { name: /Spillstudio/ }).first()).toHaveAttribute('aria-pressed', 'true');
  });
});
