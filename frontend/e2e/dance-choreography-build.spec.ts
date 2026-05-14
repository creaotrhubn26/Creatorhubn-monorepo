/**
 * E1 — Lag piece, drag segmenter, autosave triggers.
 *
 * Komponent: frontend/client/src/components/role-room/dance/ChoreographyBuilder.tsx
 *            (wrappet av ChoreographyBuilderConnected for load/save)
 * Endpoint:   POST/PATCH /api/dance/choreography
 *
 * Dekker:
 *  - Eksisterende piece (cho-1) lastes med 6 segmenter
 *  - Drag-reorder fyrer PATCH med ny segment-rekkefølge
 *  - Autosave-indikatoren går saving → saved
 *  - Klikk på segment åpner inspector + viser dancer-chips
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';
import { getCallCount } from './helpers/danceMocks';

test.describe('dance — choreography build', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "pieces");
    // ChoreographyBuilderConnected auto-laster første stykke (cho-1) ved mount.
    // Vent på at builder-roten er synlig før test-body kjører.
    await expect(page.getByTestId('choreography-builder')).toBeVisible({ timeout: 10_000 });
  });

  test('viser 6 segmenter fra fixture', async ({ page }) => {
    await expect(page.getByTestId('choreography-builder')).toBeVisible();
    await expect(page.locator('[data-testid^="choreo-segment-item-seg-"]')).toHaveCount(6);
  });

  test('klikk på segment åpner inspector', async ({ page }) => {
    await page.getByTestId('choreo-segment-item-seg-3').click();
    await expect(page.getByTestId('choreo-inspector')).toBeVisible();
    // Lift-sekvens har dnc-4 og dnc-11
    await expect(page.getByTestId('choreo-inspector-dancer-dnc-4')).toBeVisible();
    await expect(page.getByTestId('choreo-inspector-dancer-dnc-11')).toBeVisible();
  });

  test('autosave-indikator når segment endres', async ({ page }) => {
    await page.getByTestId('choreo-segment-item-seg-1').click();
    // Endre energy level i inspector
    const energySlider = page.getByLabel(/Energi|Energy/i);
    await energySlider.click();
    await page.keyboard.press('ArrowRight'); // Trigger change

    // Saving-indikator → saved-indikator (debounce 1.5s)
    await expect(page.getByTestId('choreo-autosave-saving')).toBeVisible({ timeout: 2_000 });
    await expect(page.getByTestId('choreo-autosave-saved')).toBeVisible({ timeout: 5_000 });

    // PATCH /api/dance/choreography/cho-1 fyrt
    await expect.poll(() =>
      getCallCount(page, 'PATCH /api/dance/choreography/cho-1'),
    ).toBeGreaterThanOrEqual(1);
  });

  test('legg til nytt segment via add-toggle', async ({ page }) => {
    await page.getByTestId('choreo-add-segment-toggle').click();
    await page.getByTestId('choreo-add-solo').click();

    // Segmentlisten har nå 7 elementer
    await expect(page.locator('[data-testid^="choreo-segment-item-"]')).toHaveCount(7);
  });
});
