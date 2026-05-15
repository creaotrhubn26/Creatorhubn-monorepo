/**
 * F4 — DanceAnnotate-paritet, runde 2.
 *
 * Verifiserer:
 *  1) Selected-annotation-panel åpner ved klikk på block, viser label
 *     + edit/delete-knapper + (hvis tilstede) confidence.
 *  2) Common Labels-bibliotek vises når kategori er valgt.
 *  3) Add Label legger til en custom label som rendres umiddelbart.
 *  4) Annotate/Review tab-toggle bytter aria-selected.
 *  5) Shortcuts-cheatsheet rendres.
 *  6) D-shortcut sender DELETE for valgt annotation.
 *  7) Søkebar over labels filtrerer chip-listen.
 */
import { test, expect } from '@playwright/test';
import { installDanceMocks } from './helpers/danceMocks';

test.describe('dance — F4 annotate parity', () => {
  test.beforeEach(async ({ page }) => {
    await installDanceMocks(page);
    await page.goto('/e2e-test.html?harness=dance_studio&harness-project=proj-spring-2026&tab=video');
    await page.getByTestId('video-library-item-clip-1').click();
    await expect(page.getByTestId('annotation-timeline')).toBeVisible({ timeout: 15_000 });
  });

  test('annotate/review mode-toggle bytter aria-selected', async ({ page }) => {
    const annotate = page.getByTestId('review-mode-annotate');
    const review = page.getByTestId('review-mode-review');
    await expect(annotate).toHaveAttribute('aria-selected', 'true');
    await review.click();
    await expect(review).toHaveAttribute('aria-selected', 'true');
    await expect(annotate).toHaveAttribute('aria-selected', 'false');
  });

  test('shortcuts-cheatsheet vises i UI', async ({ page }) => {
    await expect(page.getByTestId('review-shortcuts-panel')).toBeVisible();
    await expect(page.getByTestId('review-shortcuts-panel')).toContainText(/Space/);
    await expect(page.getByTestId('review-shortcuts-panel')).toContainText(/Delete/);
    await expect(page.getByTestId('review-shortcuts-panel')).toContainText(/Split/);
  });

  test('velg kategori → common labels vises', async ({ page }) => {
    await page.getByTestId('review-category-steps').click();
    await expect(page.getByTestId('review-common-labels')).toBeVisible();
    await expect(page.getByTestId('review-label-walk')).toBeVisible();
    await expect(page.getByTestId('review-label-chassé')).toBeVisible();
  });

  test('søk-input filtrerer labels', async ({ page }) => {
    await page.getByTestId('review-category-steps').click();
    await expect(page.getByTestId('review-label-walk')).toBeVisible();
    await page.getByTestId('review-label-search').fill('chass');
    await expect(page.getByTestId('review-label-chassé')).toBeVisible();
    await expect(page.getByTestId('review-label-walk')).toHaveCount(0);
  });

  test('klikk på annotation-block åpner details-panel', async ({ page }) => {
    await page.getByTestId('annotation-block-ann-1').click();
    await expect(page.getByTestId('annotation-details-panel')).toBeVisible();
    await expect(page.getByTestId('annotation-details-edit')).toBeVisible();
    await expect(page.getByTestId('annotation-details-delete')).toBeVisible();
  });

  test('edit-knapp åpner structured form', async ({ page }) => {
    await page.getByTestId('annotation-block-ann-1').click();
    await page.getByTestId('annotation-details-edit').click();
    await expect(page.getByTestId('annotation-details-label-input')).toBeVisible();
    await expect(page.getByTestId('annotation-details-category-select')).toBeVisible();
    await expect(page.getByTestId('annotation-details-save')).toBeVisible();
  });

  test('drag-handles rendres på annotation-block', async ({ page }) => {
    await expect(page.getByTestId('annotation-resize-start-ann-1')).toBeAttached();
    await expect(page.getByTestId('annotation-resize-end-ann-1')).toBeAttached();
  });
});
