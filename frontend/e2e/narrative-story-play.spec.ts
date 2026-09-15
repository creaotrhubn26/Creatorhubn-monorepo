/**
 * Story Graph — offentlig spill-side (/story/:token) via harness:
 * play_only skjuler debugger, view_play viser den, ugyldig token gir melding.
 */
import { test, expect, type Page } from '@playwright/test';
import { installNarrativeMocks, getMockGraph, seedPlayScenario } from './helpers/narrativeMocks';

async function openStory(page: Page, token: string) {
  await installNarrativeMocks(page);
  seedPlayScenario(getMockGraph(page)!);
  await page.goto(`/e2e-test.html?harness=story_play&harness-token=${token}`);
  await expect(page.getByTestId('story-play-page')).toBeVisible({ timeout: 15_000 });
}

test.describe('Story Graph — offentlig spill-lenke', () => {
  test('play_only: spiller historien uten innlogging, uten debugger og uten redigering', async ({ page }) => {
    await openStory(page, 'sgs_e2e_public');
    await expect(page.getByTestId('story-play-title')).toHaveText('Demo-spill');
    await expect(page.getByTestId('narrative-play-title')).toHaveText('Landsbyen');
    await expect(page.getByTestId('narrative-play-content')).toContainText('Du finner en pung');
    await expect(page.getByTestId('narrative-play-debugger')).toHaveCount(0);
    await expect(page.getByTestId('narrative-play-edit')).toHaveCount(0);

    await page.getByTestId('narrative-play-option-ncn_1').click();
    await expect(page.getByTestId('narrative-play-title')).toHaveText('Rik');
    await expect(page.getByTestId('narrative-play-speaker')).toHaveText('Kjøpmannen');

    await page.getByTestId('narrative-play-restart').click();
    await expect(page.getByTestId('narrative-play-title')).toHaveText('Landsbyen');
  });

  test('view_play: debugger er synlig og styrer forgreningen', async ({ page }) => {
    await openStory(page, 'sgs_e2e_debug');
    await expect(page.getByTestId('narrative-play-debugger')).toBeVisible();
    const gold = page.getByTestId('narrative-debugger-value-gold');
    await expect(gold).toHaveValue('10');
    await gold.fill('3');
    await gold.press('Enter');
    await page.getByTestId('narrative-play-option-ncn_1').click();
    await expect(page.getByTestId('narrative-play-title')).toHaveText('Fattig');
  });

  test('ugyldig/tilbakekalt token gir tydelig melding', async ({ page }) => {
    await openStory(page, 'sgs_finnes_ikke');
    await expect(page.getByTestId('story-play-missing')).toContainText('Lenken er ugyldig, utløpt eller tilbakekalt.');
  });
});
