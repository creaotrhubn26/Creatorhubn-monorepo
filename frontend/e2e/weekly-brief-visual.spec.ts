import { test, expect, type Page } from '@playwright/test';

// ────────────────────────────────────────────────────────────
// Visual-regression baseline for marketing-poster preview.
// Baseline-PNGs lagres i e2e/weekly-brief-visual.spec.ts-snapshots/.
//
// Første run: kjør med --update-snapshots for å generere baseline.
// Påfølgende runs: tester sammenligner pixel-by-pixel med terskel.
//
// Vi tar screenshot av POSTER-PREVIEW-elementet, ikke hele siden, så
// scroll/scrollbar-variasjoner ikke gir false positives.
//
// Terskler: maxDiffPixelRatio 0.02 (2%) er romslig nok til å tåle små
// font-rendering-forskjeller på tvers av OSer/Vite-cacheinglinger,
// men strengt nok til å fange reelle visuelle bugs.
// ────────────────────────────────────────────────────────────

const HARNESS = '/e2e-weekly-brief.html';

async function gotoHarness(page: Page, query = '') {
  const url = query ? `${HARNESS}?${query}` : HARNESS;
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await expect(page.getByTestId('harness-title')).toBeVisible({ timeout: 30_000 });
  // Vent på at QR-data-URL faktisk har resolved og at fonter er lastet
  // for stabile snapshots.
  const dialog = page.locator('[role="dialog"]').first();
  await expect.poll(
    async () => {
      const imgs = dialog.locator('img');
      const count = await imgs.count();
      for (let i = 0; i < count; i++) {
        const src = await imgs.nth(i).getAttribute('src');
        if (src && src.startsWith('data:image/png;base64,')) return true;
      }
      return false;
    },
    { timeout: 8000 },
  ).toBe(true);
  await page.evaluate(() => document.fonts.ready);
}

async function snapshotPoster(page: Page, name: string) {
  const poster = page.getByTestId('marketing-poster-root');
  await expect(poster).toHaveScreenshot(name, {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
}

test.describe('Marketing Feed Poster — visual regression', () => {
  test('standard variant × purple theme (default)', async ({ page }) => {
    await gotoHarness(page);
    await snapshotPoster(page, 'standard-purple.png');
  });

  test('standard variant × film_warm theme', async ({ page }) => {
    await gotoHarness(page);
    await page.getByRole('button', { name: /Film warm orange/i }).click();
    await page.waitForTimeout(200);
    await snapshotPoster(page, 'standard-film-warm.png');
  });

  test('standard variant × dance_pink theme', async ({ page }) => {
    await gotoHarness(page);
    await page.getByRole('button', { name: /Dance pink/i }).click();
    await page.waitForTimeout(200);
    await snapshotPoster(page, 'standard-dance-pink.png');
  });

  test('minimal variant × purple theme', async ({ page }) => {
    await gotoHarness(page);
    await page.getByRole('button', { name: 'Minimal' }).click();
    await page.waitForTimeout(200);
    await snapshotPoster(page, 'minimal-purple.png');
  });

  test('editorial variant × purple theme', async ({ page }) => {
    await gotoHarness(page);
    await page.getByRole('button', { name: 'Editorial' }).click();
    await page.waitForTimeout(200);
    await snapshotPoster(page, 'editorial-purple.png');
  });
});
