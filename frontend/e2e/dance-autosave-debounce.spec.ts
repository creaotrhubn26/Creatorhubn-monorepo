/**
 * H2 — Autosave-debounce: 5 raske edits → 1 PATCH.
 *
 * Komponent: ChoreographyBuilder.tsx (debounce 1.5s, callback i ChoreographyBuilderConnected)
 *
 * Dette er en perf/budget-test — verifiserer at vi ikke spammer backend
 * med PATCH per keystroke.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';
import { getCallCount, resetCallCounts } from './helpers/danceMocks';

test.describe('dance — autosave debounce', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "pieces");
    await expect(page.getByTestId('choreography-builder')).toBeVisible({ timeout: 10_000 });
    resetCallCounts(page);
  });

  // Helper: trigger autosave via inspector text-field — dette er trigger-mønsteret
  // som ChoreographyBuilder bruker for "save segment changes".
  async function editInspectorOnce(page: import('@playwright/test').Page, value: string) {
    const inspector = page.getByTestId('choreo-inspector');
    await page.getByTestId('choreo-segment-item-seg-1').click();
    await expect(inspector).toBeVisible();
    const last = inspector.locator('input[type="text"], textarea').last();
    await last.fill(value);
  }

  test('5 raske edits fyrer eksakt 1 PATCH innen 3s', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await editInspectorOnce(page, `edit-${i}-${Date.now()}`);
    }
    await page.waitForTimeout(2_500);
    // Autosave bruker enten PATCH (header) eller PUT (segments) avhengig av felt
    const total = getCallCount(page, 'PATCH /api/dance/choreography/cho-1') +
                  getCallCount(page, 'PUT /api/dance/choreography/cho-1/segments');
    expect(total).toBe(1);
  });

  test('edit etter debounce-vinduet trigger ny PATCH', async ({ page }) => {
    await editInspectorOnce(page, `first-${Date.now()}`);
    await page.waitForTimeout(2_000);
    await editInspectorOnce(page, `second-${Date.now()}`);
    await page.waitForTimeout(2_000);
    const total = getCallCount(page, 'PATCH /api/dance/choreography/cho-1') +
                  getCallCount(page, 'PUT /api/dance/choreography/cho-1/segments');
    expect(total).toBe(2);
  });
});
