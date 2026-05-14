/**
 * H3 — VideoLibrary skal håndtere 50+ clips uten å rendre alle samtidig.
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';

test.describe('dance — video library virtualization', () => {
  test('50 clips → maks ~25 DOM-nodes initially', async ({ page }) => {
    await installDanceMocks(page);
    // Override clips med 50 stk
    await page.route('**/api/dance/video-clips*', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const many = Array.from({ length: 50 }, (_, i) => ({
        id: `clip-bulk-${i}`,
        ownerUserId: 'user-owner-1',
        projectId: null,
        choreographyId: null,
        segmentId: null,
        kind: 'rehearsal',
        title: `Clip ${i}`,
        storageKey: `mock/c-${i}.mp4`,
        signedUrl: `blob:mock-${i}`,
        durationSec: 60,
        mime: 'video/mp4',
        sourceUserId: 'user-owner-1',
        capturedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: many }),
      });
    });
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026&tab=video');

    const rendered = await page.locator('[data-testid^="video-library-item-clip-bulk-"]').count();
    expect(rendered).toBeLessThanOrEqual(25);
  });
});
