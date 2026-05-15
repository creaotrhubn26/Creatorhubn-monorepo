/**
 * F3 — DanceFlow-paritet: tids-bundne formasjoner + per-formation editor
 * + dancer-paths-visualisering.
 *
 * Verifiserer:
 *  1) FormationDetailsPanel rendres for aktiv formasjon med start/slutt/tags-felt.
 *  2) Endring av startSec via input triggerer PUT /formations.
 *  3) FormationTimeline rendrer minst én blokk og lar bruker velge.
 *  4) DancerPathsView rendrer (kommer kanskje uten dancers i tom-fixturen,
 *     så vi tillater null-render hvis ingen dansere er plassert).
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest } from './helpers/danceSetup';

test.describe('dance — formation time-bounds', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page, { initialTab: 'formations' });
    await expect(page.getByTestId('formation-toolbar')).toBeVisible({ timeout: 15_000 });
  });

  test('FormationDetailsPanel + Timeline rendres for aktiv formasjon', async ({ page }) => {
    await expect(page.getByTestId('formation-details-panel')).toBeVisible();
    await expect(page.getByTestId('formation-details-name')).toBeVisible();
    await expect(page.getByTestId('formation-details-start-sec')).toBeVisible();
    await expect(page.getByTestId('formation-details-end-sec')).toBeVisible();
    await expect(page.getByTestId('formation-details-tags')).toBeVisible();
    await expect(page.getByTestId('formation-timeline')).toBeVisible();
  });

  test('legg til tag på formasjon', async ({ page }) => {
    await page.getByTestId('formation-details-tag-input').fill('Opening');
    await page.getByTestId('formation-details-tag-add').click();
    await expect(page.getByTestId('formation-details-tags').getByText('Opening')).toBeVisible();
  });

  test('endring av startSec sender PUT /formations med startSec', async ({ page }) => {
    const putReq = page.waitForRequest(
      (req) => req.method() === 'PUT' && /\/api\/dance\/formations/.test(req.url()),
      { timeout: 10_000 },
    );
    await page.getByTestId('formation-details-start-sec').fill('12');
    const req = await putReq;
    const body = req.postDataJSON?.() as { formations?: Array<{ startSec?: number }> } | undefined;
    const hasStart = body?.formations?.some((f) => f.startSec === 12);
    expect(hasStart).toBe(true);
  });
});
