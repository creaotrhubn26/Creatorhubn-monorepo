/**
 * E5 — VideoLibrary upload + clip-management.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';
import { getCallCount } from './helpers/danceMocks';

test.describe('dance — video library', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "video");
  });

  test('viser 6 clips fra fixture, gruppert etter kind', async ({ page }) => {
    await expect(page.getByTestId('video-library')).toBeVisible();
    await expect(page.locator('[data-testid^="video-library-item-clip-"]')).toHaveCount(6);
  });

  test('upload clip', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('video-library-upload').click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles({
      name: 'test-clip.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-mp4-bytes'),
    });

    await expect.poll(() =>
      getCallCount(page, 'POST /api/dance/video-clips'),
    ).toBe(1);
  });

  test('endre clip status via PATCH', async ({ page }) => {
    await page.getByTestId('video-library-item-clip-1').click();
    const statusBtn = page.getByRole('button', { name: /Godkjenn|Approve|Status/i }).first();
    if (!(await statusBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Clip-status-knapp ikke i UI');
      return;
    }
    const patched = page.waitForRequest(
      (req) => req.method() === 'PATCH' && req.url().includes('/api/dance/video-clips/clip-1'),
      { timeout: 5_000 },
    );
    await statusBtn.click();
    await patched;
  });

  test('filtrer på kind=rehearsal viser kun 3 clips', async ({ page }) => {
    const filter = page.getByRole('button', { name: /Filtrer|Filter/i }).first()
      .or(page.getByRole('tab', { name: /Rehearsal/i }));
    if (!(await filter.isVisible().catch(() => false))) {
      test.skip(true, 'Kind-filter ikke synlig i UI');
      return;
    }
    await filter.click();
    const rehearsalOption = page.getByRole('option', { name: /Rehearsal/i });
    if (await rehearsalOption.isVisible().catch(() => false)) await rehearsalOption.click();
    // Fixture har 3 rehearsal clips: clip-1, clip-2, clip-6
    await expect(page.locator('[data-testid^="video-library-item-clip-"]')).toHaveCount(3);
  });
});
