/**
 * A5 — Deeplink /dance/invite/:token?team=abc bevarer ?team= gjennom PIN-flow.
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';

test.describe('dance invite — deeplink', () => {
  test('?team=-param overlever PIN-flowet', async ({ page }) => {
    await installDanceMocks(page);
    await page.goto('/dance/invite/invite-token-pending-abc?team=team-bergen-collective');

    await page.getByRole('button', { name: /Send PIN/i }).click();
    await expect(page).toHaveURL(/team=team-bergen-collective/);

    await page.getByLabel(/6-sifret PIN/i).fill('123456');
    await page.getByLabel(/Fullt navn/i).fill('Deeplink Bruker');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Bekreft/i }).click();

    await expect(page).toHaveURL(/team=team-bergen-collective/, { timeout: 10_000 });
  });

  test('redirect etter accept lander på team-spesifikk dashboard', async ({ page }) => {
    await installDanceMocks(page);
    await page.goto('/dance/invite/invite-token-pending-abc?team=team-bergen-collective');
    await page.getByRole('button', { name: /Send PIN/i }).click();
    await page.getByLabel(/6-sifret PIN/i).fill('123456');
    await page.getByLabel(/Fullt navn/i).fill('Deeplink Bruker');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Bekreft/i }).click();

    // Etter accept skal vi til en URL som inneholder den nye team-orgId
    // ELLER til en URL som inneholder ?team= med oppdatert verdi.
    await expect(page).toHaveURL(/team-(bergen-collective|oslo-elite)/, { timeout: 15_000 });
  });
});
