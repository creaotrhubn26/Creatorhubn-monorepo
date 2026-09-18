/**
 * Story Graph Fase 8f — lesning (TTS) og KI-referansebilde på scenekortet.
 * TTS: nettleserens speechSynthesis stubbes (onend umiddelbart) så løkka går gjennom replikkene.
 * Bilde: storyboard-KI mockes (1×1 PNG), from-base64 lager asset i «objektlager» + ramme «KI-referanse».
 */
import { expect, test } from '@playwright/test';
import { installNarrativeMocks } from './helpers/narrativeMocks';

test.describe('Story Graph — lesning og referansebilde (Fase 8f)', () => {
  test('Replikker → Les opp scenen: går gjennom W01-replikkene med én taler om gangen (nettleser-TTS)', async ({ page }) => {
    await page.addInitScript(() => {
      const spoken: string[] = [];
      (window as unknown as { __spoken: string[] }).__spoken = spoken;
      const synth = {
        speaking: false, pending: false, paused: false,
        getVoices: () => [], cancel: () => undefined, pause: () => undefined, resume: () => undefined,
        addEventListener: () => undefined, removeEventListener: () => undefined,
        speak: (u: { text: string; onend?: (e: unknown) => void }) => { spoken.push(u.text); setTimeout(() => u.onend?.({}), 5); },
      };
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
      (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = function (this: { text: string }, text: string) { this.text = text; } as unknown;
    });
    await installNarrativeMocks(page, { seed: 'what-follows-us' });
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=scenes&scene=nsc_p01&sceneTab=lines');
    await expect(page.getByTestId('narrative-table-read')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('narrative-table-read-play')).toContainText('Spill av (');
    await page.getByTestId('narrative-table-read-play').click();
    await expect(page.getByTestId('narrative-table-read-current')).toBeVisible();
    await expect(page.getByTestId('narrative-table-read-current')).toContainText('W01.01');
    await expect(page.getByTestId('narrative-table-read-current')).toContainText('stemmecast: Luna');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.length), { timeout: 15_000 }).toBeGreaterThan(2);
    await page.getByTestId('narrative-table-read-stop').click();
    await expect(page.getByTestId('narrative-table-read-play')).toBeVisible();
  });

  test('Storyboard → Generer referansebilde: ramme «KI-referanse» legges til med dagsteller', async ({ page }) => {
    await installNarrativeMocks(page, { seed: 'what-follows-us' });
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=scenes&scene=nsc_p01&sceneTab=storyboard');
    const generate = page.getByTestId('narrative-scene-frame-generate');
    await expect(generate).toBeVisible({ timeout: 15_000 });
    await expect(generate).not.toHaveAttribute('data-locked', 'plan');
    await generate.click();
    await expect(page.getByTestId('narrative-scene-frame-ai-usage')).toContainText('1/10 i dag');
    // Bildeteksten er et autosave-felt (input) — sjekk verdien på siste ramme.
    await expect(page.locator('input[data-testid^="narrative-scene-frame-caption-"]').last()).toHaveValue(/KI-referanse \(dall-e-3\)/);
  });

  test('Solo-plan: referansebilde-knappen er låst', async ({ page }) => {
    await installNarrativeMocks(page, { seed: 'what-follows-us', gamePlan: 'solo' });
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=scenes&scene=nsc_p01&sceneTab=storyboard');
    const generate = page.getByTestId('narrative-scene-frame-generate');
    await expect(generate).toBeVisible({ timeout: 15_000 });
    await expect(generate).toHaveAttribute('data-locked', 'plan');
    await expect(generate).toBeDisabled();
  });
});
