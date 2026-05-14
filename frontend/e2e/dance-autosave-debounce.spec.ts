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
    await page.getByText('Spring Showcase — Hovedstykke').click();
    resetCallCounts(page);
  });

  test('5 raske edits fyrer eksakt 1 PATCH innen 3s', async ({ page }) => {
    await page.getByTestId('choreo-segment-item-seg-1').click();

    // 5 raske keypresses på energy-slider
    const slider = page.getByLabel(/Energi|Energy/i);
    for (let i = 0; i < 5; i++) {
      await slider.click();
      await page.keyboard.press('ArrowRight');
    }

    // Vent på at debounce-vinduet er over (1.5s + slack)
    await page.waitForTimeout(2_500);

    // Kun 1 PATCH skal være fyrt
    expect(getCallCount(page, 'PATCH /api/dance/choreography/cho-1')).toBe(1);
  });

  test('edit etter debounce-vinduet trigger ny PATCH', async ({ page }) => {
    await page.getByTestId('choreo-segment-item-seg-1').click();
    const slider = page.getByLabel(/Energi|Energy/i);

    await slider.click();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(2_000); // Vent ut debounce

    await page.keyboard.press('ArrowRight'); // Ny edit
    await page.waitForTimeout(2_000);

    expect(getCallCount(page, 'PATCH /api/dance/choreography/cho-1')).toBe(2);
  });
});
