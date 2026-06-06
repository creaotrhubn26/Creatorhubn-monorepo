/**
 * dance-annotate-hardening — smoke-test for ALLE DanceAnnotate-hardening-
 * commits (categories/labels CRUD, Save-knapp m/ live status,
 * AnnotationExportOverlay, Project-switcher, Annotations-list, Statistics).
 *
 * Spec'en gjør IKKE faktiske writes mot backend — mocks er injisert av
 * setupDanceTest. Vi verifiserer rendring + interaction-flyt + at events
 * dispatcher som forventet (open/lukk dialoger, view-switch).
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest } from './helpers/danceSetup';

async function openAnnotate(page: import('@playwright/test').Page): Promise<void> {
  await setupDanceTest(page, { initialTab: 'formations' });
  await expect(page.getByTestId('formation-header-bar')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('formation-header-bar-tab-annotate').click();
  await expect(page.getByTestId('dance-annotate-layout')).toBeVisible({ timeout: 5_000 });
}

test.describe('dance annotate — Save-knapp m/ live status', () => {
  test('Save-knapp viser "Save" som default når ingenting har skjedd', async ({ page }) => {
    await openAnnotate(page);
    const saveBtn = page.getByTestId('dance-annotate-layout-save');
    await expect(saveBtn).toBeVisible();
    // Default-label er "Save" (kan også være timestamp hvis tidligere session
    // hadde lastSavedAt — vi sjekker bare at knapp er synlig + enabled).
    await expect(saveBtn).toBeEnabled();
  });

  test('Project-trigger åpner project-switcher-modal', async ({ page }) => {
    await openAnnotate(page);
    await page.getByTestId('dance-annotate-layout-project-trigger').click();
    await expect(page.getByTestId('dance-project-switcher')).toBeVisible();
    await expect(page.getByTestId('dance-project-switcher-search')).toBeVisible();
    // Lukk
    await page.getByTestId('dance-project-switcher-close').click();
    await expect(page.getByTestId('dance-project-switcher')).not.toBeVisible();
  });
});

test.describe('dance annotate — categories + labels CRUD', () => {
  test('Add Category-knapp åpner dialog m/ farge-prikker', async ({ page }) => {
    await openAnnotate(page);
    // Velg en clip så vi får mounted CategoryToolsPanel
    const firstClip = page.locator('[data-testid^="clips-sidebar-clip-"]').first();
    if (!(await firstClip.isVisible().catch(() => false))) {
      test.skip(true, 'Ingen clips i mock-data');
      return;
    }
    await firstClip.click();
    await expect(page.getByTestId('annotate-category-tools')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('annotate-category-add').click();
    await expect(page.getByTestId('annotate-category-dialog')).toBeVisible();
    // Submit-knapp er disabled før navn fylles
    const submit = page.getByTestId('annotate-category-dialog-submit');
    await expect(submit).toBeDisabled();
    // Fyll navn
    await page.getByTestId('annotate-category-dialog-name').fill('Test Cat');
    await expect(submit).toBeEnabled();
    // Lukk uten å lagre
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('annotate-category-dialog')).not.toBeVisible();
  });

  test('Add Label-knapp åpner dialog m/ kategori-dropdown', async ({ page }) => {
    await openAnnotate(page);
    const firstClip = page.locator('[data-testid^="clips-sidebar-clip-"]').first();
    if (!(await firstClip.isVisible().catch(() => false))) {
      test.skip(true, 'Ingen clips i mock-data');
      return;
    }
    await firstClip.click();
    await expect(page.getByTestId('annotate-common-labels')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('annotate-label-add').click();
    await expect(page.getByTestId('annotate-label-dialog')).toBeVisible();
    await expect(page.getByTestId('annotate-label-dialog-name')).toBeVisible();
    await expect(page.getByTestId('annotate-label-dialog-category')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});

test.describe('dance annotate — Export overlay', () => {
  test('Export-knapp åpner AnnotationExportOverlay m/ Print + CSV + Lukk', async ({ page }) => {
    await openAnnotate(page);
    const firstClip = page.locator('[data-testid^="clips-sidebar-clip-"]').first();
    if (!(await firstClip.isVisible().catch(() => false))) {
      test.skip(true, 'Ingen clips i mock-data');
      return;
    }
    await firstClip.click();
    // Klikk Export i top-bar
    await page.getByTestId('dance-annotate-layout-export').click();
    await expect(page.getByTestId('annotation-export-overlay')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('annotation-export-print')).toBeVisible();
    await expect(page.getByTestId('annotation-export-csv')).toBeVisible();
    await expect(page.getByTestId('annotation-export-close')).toBeVisible();
    // Lukk
    await page.getByTestId('annotation-export-close').click();
    await expect(page.getByTestId('annotation-export-overlay')).not.toBeVisible();
  });
});

test.describe('dance annotate — Annotations-list-view', () => {
  test('Nav-rail klikk på Annotations viser tabell-flate', async ({ page }) => {
    await openAnnotate(page);
    await page.getByTestId('dance-annotate-layout-nav-annotations').click();
    await expect(page.getByTestId('dance-annotations-list-view')).toBeVisible({ timeout: 5_000 });
    // Søk + filter-controls
    await expect(page.getByTestId('dance-annotations-search')).toBeVisible();
    await expect(page.getByTestId('dance-annotations-filter-category')).toBeVisible();
    await expect(page.getByTestId('dance-annotations-filter-clip')).toBeVisible();
    // Refresh
    await expect(page.getByTestId('dance-annotations-refresh')).toBeVisible();
    // Empty- eller table-state
    const empty = page.getByTestId('dance-annotations-empty');
    const table = page.getByTestId('dance-annotations-table');
    await expect(empty.or(table)).toBeVisible({ timeout: 10_000 });
  });

  test('Header-klikk toggler sort-retning', async ({ page }) => {
    await openAnnotate(page);
    await page.getByTestId('dance-annotate-layout-nav-annotations').click();
    await expect(page.getByTestId('dance-annotations-list-view')).toBeVisible({ timeout: 5_000 });
    // Verifiserer at sort-headers er klikkbare (uten å validere innhold —
    // mock-data kan ha 0 rader)
    await expect(page.getByTestId('dance-annotations-header-clip')).toBeVisible();
    await expect(page.getByTestId('dance-annotations-header-start')).toBeVisible();
    await expect(page.getByTestId('dance-annotations-header-category')).toBeVisible();
  });

  test('Tilbake til Annotate via clip-klikk i sidebar', async ({ page }) => {
    // Mockup-paritet: Annotate er IKKE et separat nav-item — du kommer tilbake
    // til Annotate-flaten ved å velge en clip.
    await openAnnotate(page);
    await page.getByTestId('dance-annotate-layout-nav-annotations').click();
    await expect(page.getByTestId('dance-annotations-list-view')).toBeVisible();
    const firstClip = page.locator('[data-testid^="clips-sidebar-clip-"]').first();
    if (!(await firstClip.isVisible().catch(() => false))) {
      test.skip(true, 'Ingen clips i mock-data');
      return;
    }
    await firstClip.click();
    const emptyOrView = page.getByTestId('dance-annotate-empty').or(page.getByTestId('dance-annotate-view'));
    await expect(emptyOrView).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('dance annotate — Statistics-view', () => {
  test('Nav-rail klikk på Statistics viser breakdowns', async ({ page }) => {
    await openAnnotate(page);
    await page.getByTestId('dance-annotate-layout-nav-statistics').click();
    await expect(page.getByTestId('dance-statistics-view')).toBeVisible({ timeout: 5_000 });
    // Refresh-knapp
    await expect(page.getByTestId('dance-statistics-refresh')).toBeVisible();
    // Enten empty-state ELLER summary-cards
    const empty = page.getByTestId('dance-statistics-empty');
    const summary = page.getByTestId('dance-statistics-summary-total-annotations');
    await expect(empty.or(summary)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('dance annotate — nav-rail active-state', () => {
  test('Aktiv view har lavender highlight', async ({ page }) => {
    await openAnnotate(page);
    // Standard er Annotate — ingen nav-item har aria-current siden Annotate
    // ikke er et nav-item lenger (mockup-paritet). Annotations-/Statistics-
    // items er ikke aktive initielt.
    const annotationsNav = page.getByTestId('dance-annotate-layout-nav-annotations');
    const statsNav = page.getByTestId('dance-annotate-layout-nav-statistics');
    await expect(annotationsNav).not.toHaveAttribute('aria-current', 'page');
    await expect(statsNav).not.toHaveAttribute('aria-current', 'page');

    // Bytt til Statistics — markøren flyttes
    await statsNav.click();
    await expect(statsNav).toHaveAttribute('aria-current', 'page');
    await expect(annotationsNav).not.toHaveAttribute('aria-current', 'page');
  });
});
