/**
 * Story Graph Fase 8c — Integrasjoner: CI-bevis-hooks (opprett → hemmelighet vist én gang,
 * tilbakekall, leveringslogg) og «Satt av CI»-merking + bevis-nedlasting på gate-fanen.
 */
import { expect, test } from '@playwright/test';
import { installNarrativeMocks } from './helpers/narrativeMocks';

test.describe('Story Graph — integrasjoner (Fase 8c)', () => {
  test('oppretter hook, viser hemmelighet én gang, tilbakekaller, og viser leveringslogg', async ({ page }) => {
    await installNarrativeMocks(page, { seed: 'what-follows-us' });
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=integrations');
    await expect(page.getByTestId('narrative-integrations-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('narrative-tab-integrations')).toHaveAttribute('aria-selected', 'true');

    // Seedet leveringslogg: én anvendt, én avvist.
    await expect(page.getByTestId('narrative-ci-deliveries')).toContainText('Anvendt');
    await expect(page.getByTestId('narrative-ci-deliveries')).toContainText('Avvist');
    await expect(page.getByTestId('narrative-ci-deliveries')).toContainText('«Bestått» uten bevis');

    await page.getByTestId('narrative-ci-hook-label').fill('Xcode Cloud – prolog');
    await page.getByTestId('narrative-ci-hook-create').click();
    await expect(page.getByTestId('narrative-ci-hook-secret-dialog')).toBeVisible();
    await expect(page.getByTestId('narrative-ci-hook-secret')).toHaveValue(/^sgh_/);
    await expect(page.getByTestId('narrative-ci-hook-url')).toHaveValue(/\/api\/role-room\/narrative\/hooks\/ci\/nch_/);
    await expect(page.getByTestId('narrative-ci-hook-example')).toContainText('post-gate-evidence.sh');
    await page.getByTestId('narrative-ci-hook-secret-close').click();

    // Hooken står i lista; tilbakekall fjerner den fra aktive.
    const row = page.locator('[data-testid^="narrative-ci-hook-nch_"]').first();
    await expect(row).toContainText('Xcode Cloud – prolog');
    await row.locator('[data-testid^="narrative-ci-hook-revoke-"]').click();
    await expect(page.locator('[data-testid^="narrative-ci-hook-nch_"]').filter({ hasText: 'Xcode Cloud – prolog' })).toHaveCount(0);
  });

  test('gate satt av CI merkes og har nedlastbart bevis', async ({ page }) => {
    await installNarrativeMocks(page, { seed: 'what-follows-us' });
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=scenes&scene=nsc_p01&sceneTab=gates');
    await expect(page.getByTestId('narrative-scene-gates')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('narrative-gate-ci-greybox')).toBeVisible();
    // Popupen deler kontekstens ruter: stubb lagrings-URL-en så den ikke gir chrome-error.
    await page.context().route('https://storage.e2e.invalid/**', (r) => r.fulfill({ status: 200, contentType: 'text/plain', body: 'bevis' }));
    const popup = page.waitForEvent('popup');
    await page.getByTestId('narrative-gate-asset-greybox').click();
    const opened = await popup;
    expect(opened.url()).toMatch(/storage\.e2e\.invalid\/nas_/);
  });
});
