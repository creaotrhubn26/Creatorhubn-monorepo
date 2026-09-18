/**
 * Story Graph — Oversettelser-fanen (Translation Mode): språkliste, KI-forslag
 * rett i feltet, lagring (jsonb-merge i mock), spilling på valgt språk med
 * skript fra kilden, og offentlig lenke med ?locale=.
 */
import { test, expect, type Page } from '@playwright/test';
import { installNarrativeMocks, getMockGraph, seedPlayScenario } from './helpers/narrativeMocks';

async function openTranslations(page: Page) {
  await installNarrativeMocks(page);
  seedPlayScenario(getMockGraph(page)!);
  await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=translations');
  await expect(page.getByTestId('narrative-translations-panel')).toBeVisible({ timeout: 15_000 });
}

test.describe('Story Graph — oversettelser', () => {
  test('KI-forslag fyller feltet, lagring merger i18n, og Play spiller på engelsk med skript intakt', async ({ page }) => {
    await openTranslations(page);
    await expect(page.getByTestId('narrative-translations-progress')).toContainText('av');

    const key = 'element:nel_start:contentHtml:0';
    await page.getByTestId(`narrative-translation-ai-${key}`).click();
    const input = page.getByTestId(`narrative-translation-input-${key}`);
    await expect(input).toHaveValue(/^\[en\] /);
    await input.fill('You wake up in a quiet village.');
    await page.getByTestId('narrative-translation-input-connection:ncn_1:labelHtml:0').fill('Go to the market');
    await page.getByTestId('narrative-translations-save').click();
    await expect(page.getByText(/2 felt lagret/)).toBeVisible();

    const g = getMockGraph(page)!;
    const start = g.elements.find((e) => e.id === 'nel_start')!;
    const en = (start.i18n as Record<string, { contentHtml?: string }>).en;
    // Kildens kodeblokk (gold += 10) er med i strukturen; prosaen er oversatt.
    expect(en.contentHtml).toContain('<p>You wake up in a quiet village.</p>');
    expect(en.contentHtml).toContain('<pre><code>gold += 10</code></pre>');

    await page.getByTestId('narrative-tab-play').click();
    await expect(page.getByTestId('narrative-play-content')).toContainText('Du finner en pung');
    await page.getByTestId('narrative-play-locale').click();
    await page.getByRole('option', { name: 'English' }).click();
    await expect(page.getByTestId('narrative-play-content')).toContainText('You wake up in a quiet village.');
    await expect(page.getByTestId('narrative-debugger-value-gold')).toHaveValue('10');
    await expect(page.getByTestId('narrative-play-option-ncn_1')).toHaveText('Go to the market');
  });

  test('legg til språk oppdaterer innstillinger; offentlig side respekterer ?locale=', async ({ page }) => {
    await openTranslations(page);
    await page.getByTestId('narrative-translations-new-locale').fill('sv');
    await page.getByTestId('narrative-translations-add-locale').click();
    await expect(page.getByTestId('narrative-translations-chip-sv')).toBeVisible();
    expect(getMockGraph(page)!.settings.locales).toEqual(['nb', 'en', 'sv']);

    // Lagre en engelsk tittel-oversettelse og åpne offentlig side på engelsk.
    await page.getByTestId('narrative-translations-locale').click();
    await page.getByRole('option', { name: 'English' }).click();
    await page.getByTestId('narrative-translation-input-element:nel_start:titleHtml:0').fill('The Village');
    await page.getByTestId('narrative-translations-save').click();
    await expect(page.getByText(/1 felt lagret/)).toBeVisible();

    await page.goto('/e2e-test.html?harness=story_play&harness-token=sgs_e2e_public&harness-locale=en');
    await expect(page.getByTestId('narrative-play-title')).toHaveText('The Village');
  });
});
