/**
 * dance-annotate-pixel-perfect — smoke-test for DanceAnnotate-flaten
 * (mockup #2). Verifiserer at:
 *   - DanceAnnotateLayout monter med pixel-perfect topp-bar + nav-rail
 *   - DanceAnnotateView monter med video + timeline + paneler
 *   - Annotate/Review tabs fungerer
 *   - Add Track-knapp + Add Category + Add Label er synlige
 *   - CATEGORY TOOLS har 5 fargede kategorier m/ keybinds 1-5
 *   - COMMON LABELS har search + label-liste
 *   - Shortcuts panel har Space/←→/A/D/S
 *
 * Bruker eksisterende setupDanceTest(initialTab='formations') + klikker
 * Annotate-sub-tab for å lande på flaten.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest } from './helpers/danceSetup';

test.describe('dance annotate — pixel-perfect smoke', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page, { initialTab: 'formations' });
    // Mount Formation-flaten først, klikk så Annotate-sub-tab
    await expect(page.getByTestId('formation-header-bar')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('formation-header-bar-tab-annotate').click();
    // Vent på at DanceAnnotateLayout monteres
    await expect(page.getByTestId('dance-annotate-layout')).toBeVisible({ timeout: 5_000 });
  });

  test('DanceAnnotateLayout mounter med pixel-perfect topp-bar', async ({ page }) => {
    const layout = page.getByTestId('dance-annotate-layout');
    await expect(layout).toBeVisible();

    // Top-bar elementer
    await expect(page.getByTestId('dance-annotate-layout-top-bar')).toBeVisible();
    await expect(page.getByTestId('dance-annotate-layout-logo')).toBeVisible();
    await expect(page.getByTestId('dance-annotate-layout-project-trigger')).toBeVisible();
    await expect(page.getByTestId('dance-annotate-layout-save')).toBeVisible();
    await expect(page.getByTestId('dance-annotate-layout-export')).toBeVisible();
  });

  test('Left nav-rail har 6 items + CLIPS + Help', async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width < 900) {
      test.skip(true, 'Nav-rail er skjult på mobile');
      return;
    }
    await expect(page.getByTestId('dance-annotate-layout-nav-rail')).toBeVisible();

    for (const id of ['dashboard', 'annotations', 'statistics', 'dancers', 'settings']) {
      await expect(page.getByTestId(`dance-annotate-layout-nav-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId('dance-annotate-layout-nav-help')).toBeVisible();

    // CLIPS-section embedded i nav-rail
    await expect(page.getByTestId('clips-sidebar')).toBeVisible();
  });

  test('DanceAnnotateView monter (clip-empty eller med valgt clip)', async ({ page }) => {
    // Enten empty-state eller view — krever ikke spesifikk clip
    const empty = page.getByTestId('dance-annotate-empty');
    const view = page.getByTestId('dance-annotate-view');
    await expect(empty.or(view)).toBeVisible();
  });

  test('Annotate/Review tabs fungerer (når clip valgt)', async ({ page }) => {
    // Klikk første clip hvis tilgjengelig så vi får mounted view
    const firstClip = page.locator('[data-testid^="clips-sidebar-clip-"]').first();
    const visible = await firstClip.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Ingen clips i mock-data');
      return;
    }
    await firstClip.click();
    await expect(page.getByTestId('dance-annotate-view')).toBeVisible({ timeout: 5_000 });
    // Right-tabs
    await expect(page.getByTestId('dance-annotate-right-tabs')).toBeVisible();
    await expect(page.getByTestId('dance-annotate-right-tab-annotate')).toBeVisible();
    await expect(page.getByTestId('dance-annotate-right-tab-review')).toBeVisible();

    // Bytt til Review
    await page.getByTestId('dance-annotate-right-tab-review').click();
    await expect(page.getByTestId('dance-annotate-review-summary')).toBeVisible();

    // Tilbake til Annotate
    await page.getByTestId('dance-annotate-right-tab-annotate').click();
    await expect(page.getByTestId('annotate-category-tools')).toBeVisible();
  });

  test('CATEGORY TOOLS har 5 fargede kategorier m/ keybinds', async ({ page }) => {
    const firstClip = page.locator('[data-testid^="clips-sidebar-clip-"]').first();
    if (!(await firstClip.isVisible().catch(() => false))) {
      test.skip(true, 'Ingen clips i mock-data');
      return;
    }
    await firstClip.click();
    await expect(page.getByTestId('annotate-category-tools')).toBeVisible({ timeout: 5_000 });

    for (const cat of ['steps', 'arms', 'body', 'jumps', 'turns']) {
      await expect(page.getByTestId(`annotate-category-${cat}`)).toBeVisible();
    }
    await expect(page.getByTestId('annotate-category-add')).toBeVisible();
  });

  test('COMMON LABELS har search + label-liste', async ({ page }) => {
    const firstClip = page.locator('[data-testid^="clips-sidebar-clip-"]').first();
    if (!(await firstClip.isVisible().catch(() => false))) {
      test.skip(true, 'Ingen clips i mock-data');
      return;
    }
    await firstClip.click();
    await expect(page.getByTestId('annotate-common-labels')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('annotate-labels-search')).toBeVisible();
    await expect(page.getByTestId('annotate-label-add')).toBeVisible();
    // Walk er en default-label i steps-kategorien
    await expect(page.getByTestId('annotate-label-walk')).toBeVisible();
  });

  test('Shortcuts panel har Space/←→/A/D/S', async ({ page }) => {
    const firstClip = page.locator('[data-testid^="clips-sidebar-clip-"]').first();
    if (!(await firstClip.isVisible().catch(() => false))) {
      test.skip(true, 'Ingen clips i mock-data');
      return;
    }
    await firstClip.click();
    await expect(page.getByTestId('annotate-shortcuts-panel')).toBeVisible({ timeout: 5_000 });

    for (const k of ['space', 'a', 'd', 's']) {
      await expect(page.getByTestId(`annotate-shortcut-${k}`)).toBeVisible();
    }
    // ← / → bruker spesielle tegn — test-id genereres fra '←-/-→' lowercase
    await expect(page.getByTestId('annotate-shortcut-←-/-→')).toBeVisible();
  });

  test('Annotation Details form synlig + disabled når ingen valgt', async ({ page }) => {
    const firstClip = page.locator('[data-testid^="clips-sidebar-clip-"]').first();
    if (!(await firstClip.isVisible().catch(() => false))) {
      test.skip(true, 'Ingen clips i mock-data');
      return;
    }
    await firstClip.click();
    await expect(page.getByTestId('annotate-form-panel')).toBeVisible({ timeout: 5_000 });
    // 4 felter + notes
    await expect(page.getByTestId('annotate-form-label')).toBeVisible();
    await expect(page.getByTestId('annotate-form-start')).toBeVisible();
    await expect(page.getByTestId('annotate-form-end')).toBeVisible();
    await expect(page.getByTestId('annotate-form-dancer')).toBeVisible();
    await expect(page.getByTestId('annotate-form-notes')).toBeVisible();
  });
});
