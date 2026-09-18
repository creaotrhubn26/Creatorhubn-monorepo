/**
 * Story Graph Fase 8d — KI-manusvakt: kjør regler → funn vises → godta → åpent spørsmål
 * (AI-<id>) i Historie-fanen; hjem-KPI «Manusvakt» teller ventende/høye funn.
 */
import { expect, test } from '@playwright/test';
import { installNarrativeMocks } from './helpers/narrativeMocks';

test.describe('Story Graph — manusvakt (Fase 8d)', () => {
  test('kjør regler → funn → godta → åpent spørsmål; hjem-KPI oppdateres', async ({ page }) => {
    await installNarrativeMocks(page, { seed: 'what-follows-us' });
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=story&story=guardian');
    await expect(page.getByTestId('narrative-story-guardian')).toBeVisible({ timeout: 15_000 });

    // Ingen funn før kjøring.
    await expect(page.getByTestId('narrative-guardian-suggestion')).toHaveCount(0);

    await page.getByTestId('narrative-guardian-run-full').click();
    const cards = page.getByTestId('narrative-guardian-suggestion');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('Epoke-brudd');
    await expect(cards.first()).toContainText('Høy');
    await expect(cards.first()).toContainText('Godta → åpent spørsmål');

    // Godta det første funnet → kortet forsvinner, åpent spørsmål AI-… finnes.
    const firstCard = cards.first().locator('xpath=ancestor::*[.//button[normalize-space()="Godta"]][1]');
    await firstCard.getByRole('button', { name: 'Godta' }).click();
    await expect(page.getByTestId('narrative-guardian-suggestion')).toHaveCount(1);
    await page.getByTestId('narrative-story-tab-questions').click();
    const aiQuestion = page.locator('[data-testid^="narrative-question-AI-"]');
    await expect(aiQuestion).toHaveCount(1);
    await expect(aiQuestion).toContainText('Hvilken epoke gjelder');

    // Hjem-KPI: ett ventende funn igjen (middels), null høye.
    await page.getByTestId('narrative-tab-home').click();
    const kpi = page.getByTestId('narrative-home-kpi-guardian');
    await expect(kpi).toBeVisible();
    await expect(kpi).toContainText('1');
    await expect(kpi).toContainText('0 høye');
  });
});
