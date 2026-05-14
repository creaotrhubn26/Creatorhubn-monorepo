/**
 * E2 — Music-upload via FormData.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';
import { getCallCount } from './helpers/danceMocks';

test.describe('dance — music upload', () => {
  test('upload mp3 til piece → musicSignedUrl returneres + waveform vises', async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "pieces");
    await page.getByText('Konkurranse — Quartet').click();

    // FileChooser-trigger
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('choreo-audio-file-trigger').click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles({
      name: 'test-music.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from('fake-mp3-bytes'),
    });

    await expect.poll(() =>
      getCallCount(page, 'POST /api/dance/choreography/cho-3/music'),
    ).toBe(1);
    await expect(page.getByTestId('music-waveform')).toBeVisible({ timeout: 5_000 });
  });
});
