/**
 * F2 — DanceAnnotate-paritet: movement-kategorier på video-annotasjoner.
 *
 * Verifiserer:
 *  1) Kategori-chips rendres i composer-toolbar med shortcut-tekst (Steps · 1).
 *  2) Tastatur-shortcut 1 setter aria-pressed=true på Steps-chip.
 *  3) Submit av kommentar inkluderer `category` i POST-payload.
 *  4) AnnotationTimeline rendres med 5 kategori-spor + Annet-spor.
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';

test.describe('dance — annotation categories', () => {
  test.beforeEach(async ({ page }) => {
    await installDanceMocks(page);
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026&tab=video');
    await page.getByTestId('video-library-item-clip-1').click();
    await expect(page.getByTestId('review-category-picker')).toBeVisible({ timeout: 15_000 });
  });

  test('kategori-chips med shortcuts er rendret i composer', async ({ page }) => {
    await expect(page.getByTestId('review-category-steps')).toContainText(/Steps.*1/);
    await expect(page.getByTestId('review-category-arms')).toContainText(/Arms.*2/);
    await expect(page.getByTestId('review-category-body')).toContainText(/Body.*3/);
    await expect(page.getByTestId('review-category-jumps')).toContainText(/Jumps.*4/);
    await expect(page.getByTestId('review-category-turns')).toContainText(/Turns.*5/);
  });

  test('shortcut 1 toggler Steps-kategori', async ({ page }) => {
    const steps = page.getByTestId('review-category-steps');
    await expect(steps).toHaveAttribute('aria-pressed', 'false');
    // Klikk utenfor input slik at keydown ikke fanges av et tekstfelt
    await page.getByTestId('annotation-timeline').click({ position: { x: 5, y: 5 }, force: true });
    await page.keyboard.press('1');
    await expect(steps).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('1');
    await expect(steps).toHaveAttribute('aria-pressed', 'false');
  });

  test('submit av kommentar inkluderer category i POST-body', async ({ page }) => {
    await page.getByTestId('review-category-arms').click();
    await page.getByTestId('review-composer-input').fill('Reach lengre opp');
    const postReq = page.waitForRequest(
      (req) => req.method() === 'POST' && /\/annotations$/.test(req.url()),
      { timeout: 5_000 },
    );
    await page.getByTestId('review-send').click();
    const req = await postReq;
    const body = req.postDataJSON?.() as { category?: string } | undefined;
    expect(body?.category).toBe('arms');
  });

  test('AnnotationTimeline rendrer alle kategori-spor', async ({ page }) => {
    await expect(page.getByTestId('annotation-timeline')).toBeVisible();
    await expect(page.getByTestId('annotation-track-steps')).toBeVisible();
    await expect(page.getByTestId('annotation-track-arms')).toBeVisible();
    await expect(page.getByTestId('annotation-track-body')).toBeVisible();
    await expect(page.getByTestId('annotation-track-jumps')).toBeVisible();
    await expect(page.getByTestId('annotation-track-turns')).toBeVisible();
    await expect(page.getByTestId('annotation-track-__uncat__')).toBeVisible();
  });
});
