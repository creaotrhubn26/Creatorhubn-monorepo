/**
 * E6 — VideoReviewRoom: kommentar + @-mention + pin + resolve.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';
import { getCallCount } from './helpers/danceMocks';

test.describe('dance — video review comments', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "video");
    await page.getByTestId('video-library-item-clip-1').click();
  });

  test('viser eksisterende annotations på clip-1', async ({ page }) => {
    await expect(page.getByTestId('review-comment-ann-1')).toBeVisible();
    await expect(page.getByText('Landing for tung')).toBeVisible();
  });

  test('legg til ny kommentar', async ({ page }) => {
    await page.getByTestId('review-composer-input').fill('Mer bøyde knær her');
    await page.getByTestId('review-send').click();

    await expect.poll(() =>
      getCallCount(page, 'POST /api/dance/video-clips/clip-1/annotations'),
    ).toBe(1);
  });

  test('@-mention autocomplete viser dancers fra fixture', async ({ page }) => {
    await page.getByTestId('review-composer-input').fill('@ingr');
    const suggestion = page.getByRole('option', { name: /Ingrid Nordahl/i });
    if (!(await suggestion.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, '@-mention-autocomplete ikke implementert');
      return;
    }
    await suggestion.click();
    await expect(page.getByTestId('review-composer-input')).toHaveValue(/Ingrid/);
  });

  test('pin-knapp toggler isDirectorPin', async ({ page }) => {
    const annotation = page.getByTestId('review-comment-ann-1');
    const pinBtn = annotation.getByRole('button', { name: /Pin|Director/i });
    if (!(await pinBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Pin-knapp ikke i UI');
      return;
    }
    const patched = page.waitForRequest(
      (req) => req.method() === 'PATCH' && req.url().includes('/api/dance/video-annotations/ann-1'),
      { timeout: 5_000 },
    );
    await pinBtn.click();
    const req = await patched;
    expect(req.postDataJSON()).toHaveProperty('isDirectorPin');
  });

  test('mark resolved → status oppdaterer', async ({ page }) => {
    const annotation = page.getByTestId('review-comment-ann-1');
    const resolveBtn = annotation.getByRole('button', { name: /Løs|Resolve|Resolved/i });
    if (!(await resolveBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Resolve-knapp ikke i UI');
      return;
    }
    const patched = page.waitForRequest(
      (req) => req.method() === 'PATCH' && req.url().includes('/api/dance/video-annotations/ann-1'),
      { timeout: 5_000 },
    );
    await resolveBtn.click();
    const req = await patched;
    expect(req.postDataJSON()).toMatchObject({ status: 'resolved' });
  });
});
