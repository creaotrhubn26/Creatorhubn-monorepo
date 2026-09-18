/**
 * Story Graph — Play Mode: skript, valg, forgrening, debugger, restart.
 * TTS er aldri på i e2e (auto-les er av som standard).
 */
import { test, expect, type Page } from '@playwright/test';
import { installNarrativeMocks, getMockGraph, seedPlayScenario } from './helpers/narrativeMocks';

async function openPlay(page: Page) {
  await installNarrativeMocks(page);
  seedPlayScenario(getMockGraph(page)!);
  await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=play');
  await expect(page.getByTestId('narrative-play-panel')).toBeVisible({ timeout: 15_000 });
}

test.describe('Story Graph — Play Mode', () => {
  test('starter på startelementet, kjører skript, ruter gjennom forgrening og viser show()', async ({ page }) => {
    await openPlay(page);
    await expect(page.getByTestId('narrative-play-title')).toHaveText('Landsbyen');
    await expect(page.getByTestId('narrative-play-content')).toContainText('Du finner en pung');
    // gold += 10 kjørte ved ankomst
    await expect(page.getByTestId('narrative-debugger-value-gold')).toHaveValue('10');
    await expect(page.getByTestId('narrative-play-option-ncn_1')).toHaveText('Gå til markedet');

    await page.getByTestId('narrative-play-option-ncn_1').click();
    // Forgreningen (gold >= 10) rutet automatisk til «Rik»
    await expect(page.getByTestId('narrative-play-title')).toHaveText('Rik');
    await expect(page.getByTestId('narrative-play-speaker')).toHaveText('Kjøpmannen');
    await expect(page.getByTestId('narrative-play-content')).toContainText('Du har 10 gull.');
    await expect(page.getByTestId('narrative-play-deadend')).toBeVisible();
  });

  test('debugger-endring styrer forgreningen; restart nullstiller', async ({ page }) => {
    await openPlay(page);
    const gold = page.getByTestId('narrative-debugger-value-gold');
    await gold.fill('3');
    await gold.press('Enter');
    await expect(gold).toHaveValue('3');
    await page.getByTestId('narrative-play-option-ncn_1').click();
    await expect(page.getByTestId('narrative-play-title')).toHaveText('Fattig');

    await page.getByTestId('narrative-play-back').click();
    await expect(page.getByTestId('narrative-play-title')).toHaveText('Landsbyen');
    await expect(gold).toHaveValue('3');

    await page.getByTestId('narrative-play-restart').click();
    await expect(page.getByTestId('narrative-play-title')).toHaveText('Landsbyen');
    await expect(gold).toHaveValue('10');
  });

  test('«Rediger element» hopper til brettet og åpner skuffen', async ({ page }) => {
    await openPlay(page);
    await page.getByTestId('narrative-play-edit').click();
    await expect(page.getByTestId('narrative-tab-boards')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('narrative-element-drawer')).toBeVisible();
    await expect(page.getByTestId('narrative-element-title')).toHaveValue('Landsbyen');
    // Skript-chip på noden + kodeblokk-knapp i editoren
    await expect(page.getByTestId('narrative-node-nel_start').getByTestId('narrative-node-script-chip')).toBeVisible();
    await expect(page.getByTestId('rich-text-code-block')).toBeVisible();
  });

  test('betingelsesfelt viser syntaksfeil live', async ({ page }) => {
    await openPlay(page);
    await page.getByTestId('narrative-tab-boards').click();
    await page.getByTestId('narrative-node-nel_choice').dblclick();
    await expect(page.getByTestId('narrative-element-drawer')).toBeVisible();
    const cond = page.getByTestId('narrative-condition-0');
    await expect(cond).toHaveValue('gold >= 10');
    await cond.fill('gold >=');
    await expect(page.getByText(/Uventet slutt/)).toBeVisible();
    await cond.fill('gold >= 5');
    await expect(page.getByText(/Uventet slutt/)).toHaveCount(0);
  });
});
