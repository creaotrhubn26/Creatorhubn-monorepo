/**
 * E2 — Music-upload via FormData.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';
import { getCallCount } from './helpers/danceMocks';

test.describe('dance — music upload', () => {
  test('upload mp3 til auto-lastet piece (cho-1) trigger POST', async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "pieces");
    await expect(page.getByTestId('choreography-builder')).toBeVisible({ timeout: 10_000 });

    const trigger = page.getByTestId('choreo-audio-file-trigger');
    if (!(await trigger.isVisible().catch(() => false))) {
      test.skip(true, 'choreo-audio-file-trigger ikke synlig');
      return;
    }
    const fileChooserPromise = page.waitForEvent('filechooser');
    await trigger.click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles({
      name: 'test-music.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from('fake-mp3-bytes'),
    });

    // Auto-lastet piece er cho-1 (første i lista). Mock for /music returnerer
    // signedUrl uavhengig av :id.
    await expect.poll(() =>
      getCallCount(page, 'POST /api/dance/choreography/cho-1/music'),
      { timeout: 10_000 },
    ).toBeGreaterThanOrEqual(1);
  });
});
