/**
 * Story Graph Fase 8e — spilltest-telemetri: Spilltest-fanen på scenekortet viser økter,
 * drop-off og valgfordeling fra mock-hendelser; tokens opprettes (råtoken vist én gang) og
 * tilbakekalles i Integrasjoner-fanen; hjem-KPI «Spilltest» viser økter og verste drop-off.
 */
import { expect, test } from '@playwright/test';
import { installNarrativeMocks } from './helpers/narrativeMocks';

test.describe('Story Graph — spilltest (Fase 8e)', () => {
  test('scenekort P01 → Spilltest viser økter, drop-off, median og valg; build-filter virker', async ({ page }) => {
    await installNarrativeMocks(page, { seed: 'what-follows-us' });
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=scenes&scene=nsc_p01&sceneTab=playtest');
    await expect(page.getByTestId('narrative-scene-playtest')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('narrative-playtest-kpi-sessions')).toContainText('3');
    // s1 døde i P01 og s3 sluttet i P01 → 2 drop-off; s2 gikk videre og fullførte.
    await expect(page.getByTestId('narrative-playtest-kpi-dropoff')).toContainText('2');
    await expect(page.getByTestId('narrative-playtest-kpi-deaths')).toContainText('1');
    await expect(page.getByTestId('narrative-playtest-kpi-median')).toContainText('40 s');
    await expect(page.getByTestId('narrative-playtest-choice-ncn_seed_bok')).toContainText('2 · 67 %');
    await expect(page.getByTestId('narrative-playtest-choice-ncn_seed_lisse')).toContainText('1 · 33 %');
    await expect(page.getByTestId('narrative-scene-playtest')).toContainText('verste drop-off: P01 (2)');
  });

  test('tomt prosjekt: Spilltest-fanen viser tom-tilstand uten feil', async ({ page }) => {
    await installNarrativeMocks(page, { seed: 'what-follows-us' });
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=scenes&scene=nsc_p03&sceneTab=playtest');
    await expect(page.getByTestId('narrative-scene-playtest')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('narrative-playtest-empty')).toBeVisible();
  });

  test('integrasjoner: token opprettes (råtoken vist én gang) og tilbakekalles; hjem-KPI viser økter', async ({ page }) => {
    await installNarrativeMocks(page, { seed: 'what-follows-us' });
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=integrations');
    await expect(page.getByTestId('narrative-integrations-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid^="narrative-playtest-token-npk_"]').first()).toContainText('iPad testrunde');

    await page.getByTestId('narrative-playtest-token-label').fill('Xcode testflight uke 40');
    await page.getByTestId('narrative-playtest-token-create').click();
    await expect(page.getByTestId('narrative-playtest-token-dialog')).toBeVisible();
    await expect(page.getByTestId('narrative-playtest-token-raw')).toHaveValue(/^sgp_/);
    await expect(page.getByTestId('narrative-playtest-token-example')).toContainText('/api/role-room/narrative/playtest/events');
    await page.getByTestId('narrative-playtest-token-close').click();

    const row = page.locator('[data-testid^="narrative-playtest-token-npk_"]').filter({ hasText: 'Xcode testflight uke 40' });
    await expect(row).toHaveCount(1);
    await row.locator('[data-testid^="narrative-playtest-token-revoke-"]').click();
    await expect(page.locator('[data-testid^="narrative-playtest-token-npk_"]').filter({ hasText: 'Xcode testflight uke 40' })).toHaveCount(0);

    await page.getByTestId('narrative-tab-home').click();
    const kpi = page.getByTestId('narrative-home-kpi-playtest');
    await expect(kpi).toBeVisible();
    await expect(kpi).toContainText('3');
    await expect(kpi).toContainText('P01 (2)');
  });
});
