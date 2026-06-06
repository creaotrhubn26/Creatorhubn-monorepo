/**
 * dance-annotate-visual-regression — Playwright snapshot-tests mot
 * standalone live-demo-harness `/e2e-dance-annotate.html`.
 *
 * Bruker Playwright's innebygde `toHaveScreenshot()` matcher som lagrer
 * baseline-bilder i `__snapshots__/`. Ved divergens > 0.1% feiler testen
 * og diff lagres til test-results/.
 *
 * Første gang: kjør med `--update-snapshots` for å generere baseline.
 *   npx playwright test e2e/dance-annotate-visual-regression.spec.ts \
 *     --update-snapshots --project=chromium
 *
 * Deretter kjøres som vanlig spec; flag-fri kjøring sammenligner mot
 * lagret baseline.
 *
 * Maskerer dynamiske elementer (timestamps i Save-pill) for å unngå
 * falske diff-er.
 */
import { test, expect } from '@playwright/test';

const HARNESS = '/e2e-dance-annotate.html';

test.describe('dance-annotate — visual regression', () => {
  test('annotate-flate baseline (initial mount)', async ({ page }) => {
    test.setTimeout(20_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(HARNESS);
    await expect(page.getByTestId('dance-annotate-view')).toBeVisible({ timeout: 10_000 });
    // Vent på video + annotations mounted
    await page.waitForFunction(() => document.querySelector('video') != null, { timeout: 5_000 });
    await page.waitForTimeout(500); // la layout settle

    await expect(page).toHaveScreenshot('annotate-flate-baseline.png', {
      // Maskere dynamiske elementer som ellers gir falske diff-er
      mask: [
        page.getByTestId('dance-annotate-layout-save'),         // "Saved kl HH:MM"
        page.locator('[data-testid="dance-annotate-video-time-overlay"]'),
      ],
      maxDiffPixelRatio: 0.01,
    });
  });

  test('annotations-list-view baseline', async ({ page }) => {
    test.setTimeout(20_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(HARNESS);
    await expect(page.getByTestId('dance-annotate-view')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('dance-annotate-layout-nav-annotations').click();
    await page.waitForTimeout(800);

    await expect(page).toHaveScreenshot('annotations-list-baseline.png', {
      mask: [page.getByTestId('dance-annotate-layout-save')],
      maxDiffPixelRatio: 0.01,
    });
  });

  test('statistics-view baseline', async ({ page }) => {
    test.setTimeout(20_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(HARNESS);
    await expect(page.getByTestId('dance-annotate-view')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('dance-annotate-layout-nav-statistics').click();
    await page.waitForTimeout(800);

    await expect(page).toHaveScreenshot('statistics-baseline.png', {
      mask: [page.getByTestId('dance-annotate-layout-save')],
      maxDiffPixelRatio: 0.01,
    });
  });

  test('category-dialog baseline', async ({ page }) => {
    test.setTimeout(20_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(HARNESS);
    await expect(page.getByTestId('dance-annotate-view')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('annotate-category-add').click();
    await expect(page.getByTestId('annotate-category-dialog')).toBeVisible();
    await page.waitForTimeout(400); // dialog-animasjon

    await expect(page).toHaveScreenshot('category-dialog-baseline.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
