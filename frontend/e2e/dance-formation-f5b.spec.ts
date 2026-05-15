/**
 * F5-B — ekte 3D/curve/waveform-implementasjoner (ingen stubs).
 *
 *  F5-10B: wavesurfer.js loader audio og rendrer waveform-spor
 *  F5-12B: Three.js StageMap3D renders Canvas-elementet i 3D-modus
 *  F5-13B: CurveOverlay rendrer SVG-baner og handles, drag oppdaterer state
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest } from './helpers/danceSetup';

test.describe('dance — F5-B implementations (no stubs)', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page, { initialTab: 'formations' });
    await expect(page.getByTestId('formation-toolbar')).toBeVisible({ timeout: 15_000 });
  });

  test('F5-12B: 3D-modus mountrer Three.js Canvas-element', async ({ page }) => {
    await page.getByTestId('formation-stage-mode-3d').click();
    await expect(page.getByTestId('formation-stage-3d')).toBeVisible();
    // Three.js setter et <canvas>-element inni — verifiser at det finnes.
    const threeCanvas = page.locator('[data-testid="formation-stage-3d"] canvas');
    await expect(threeCanvas).toHaveCount(1);
  });

  test('F5-12B: bytte tilbake til 2D viser Fabric-canvas igjen', async ({ page }) => {
    await page.getByTestId('formation-stage-mode-3d').click();
    await expect(page.getByTestId('formation-stage-3d')).toBeVisible();
    await page.getByTestId('formation-stage-mode-2d').click();
    // 2D-canvas (Fabric) bør være synlig igjen
    await expect(page.getByTestId('formation-canvas')).toBeVisible();
  });

  test('F5-13B: curve-overlay rendres når 2+ dancers + 2+ formasjoner', async ({ page }) => {
    // Plasser to dancers på aktiv formasjon (formasjon 1)
    await page.getByTestId('roster-item-dnc-1').click();
    await page.getByTestId('roster-item-dnc-2').click();
    // Lagre en ny formasjon (snapshot av nåværende posisjoner)
    const saveInput = page.locator('input[placeholder="Formation navn"]');
    await saveInput.fill('Curve target');
    await page.keyboard.press('Enter');
    // Bytt tilbake til den første formasjonen slik at "next" peker mot den nye
    const firstFormationItem = page.locator('[data-testid^="formation-item-"]').first();
    await firstFormationItem.click();
    // Curve-tool toggle
    await page.getByTestId('formation-curve-tool').click();
    await expect(page.getByTestId('formation-curve-overlay')).toBeAttached();
    // Curve-handles skal rendres (2 per danser-par × 2 dansere = 4 totalt)
    await expect(page.getByTestId('formation-curve-handle-dnc-1-0')).toBeVisible();
    await expect(page.getByTestId('formation-curve-handle-dnc-1-1')).toBeVisible();
  });
});
