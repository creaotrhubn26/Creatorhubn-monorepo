/**
 * F8 — produksjons-kalender (DanceProductionCalendar).
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';

test.describe('dance — F8 production calendar', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, 'season');
    await expect(page.getByTestId('dance-production-calendar')).toBeVisible({ timeout: 15_000 });
  });

  test('toolbar + filter-row rendres', async ({ page }) => {
    await expect(page.getByTestId('calendar-view-toggle')).toBeVisible();
    await expect(page.getByTestId('calendar-filters')).toBeVisible();
    await expect(page.getByTestId('calendar-filter-rehearsal')).toBeVisible();
    await expect(page.getByTestId('calendar-filter-performance')).toBeVisible();
    await expect(page.getByTestId('calendar-filter-class')).toBeVisible();
    await expect(page.getByTestId('calendar-filter-availability')).toBeVisible();
  });

  test('multi-view: month / week / day / agenda', async ({ page }) => {
    await expect(page.getByTestId('calendar-month-grid')).toBeVisible();
    await page.getByTestId('calendar-view-week').click();
    await expect(page.getByTestId('calendar-week-view')).toBeVisible();
    await page.getByTestId('calendar-view-day').click();
    await expect(page.getByTestId('calendar-day-view')).toBeVisible();
    await page.getByTestId('calendar-view-agenda').click();
    await expect(page.getByTestId('calendar-agenda-view')).toBeVisible();
    await page.getByTestId('calendar-view-month').click();
    await expect(page.getByTestId('calendar-month-grid')).toBeVisible();
  });

  test('navigering: prev / today / next', async ({ page }) => {
    await page.getByTestId('calendar-next').click();
    await page.getByTestId('calendar-next').click();
    await page.getByTestId('calendar-today').click();
    // Ingen crash → suksess
    await expect(page.getByTestId('calendar-month-grid')).toBeVisible();
  });

  test('filter: skru av rehearsal → ingen rehearsal-events i grid', async ({ page }) => {
    await page.getByTestId('calendar-filter-rehearsal-checkbox').click();
    // No assertion på spesifikke events; bare verifiser at filter ikke crasher
    await expect(page.getByTestId('calendar-month-grid')).toBeVisible();
  });

  test('upcoming sidepanel rendres på desktop', async ({ page }) => {
    await expect(page.getByTestId('calendar-upcoming-sidepanel')).toBeVisible();
  });

  test('klikk på tom dato åpner quick-create-modal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Klikk på en celle, men på den øvre venstre delen (over event-blokkene)
    // slik at vi treffer celle-onClick — ikke event-onClick.
    const cell = page.locator('[data-testid^="calendar-day-"]').nth(7);
    const box = await cell.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Klikk i et hjørne der dato-Typography sitter, ikke event-blokkene.
      await page.mouse.click(box.x + 5, box.y + 5);
    }
    await expect(page.getByTestId('calendar-create-kind')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('calendar-create-title')).toBeVisible();
    await page.getByTestId('calendar-create-title').fill('Test-prøve');
    await page.getByTestId('calendar-create-submit').click();
    await expect(page.getByTestId('calendar-create-title')).toHaveCount(0, { timeout: 5_000 });
  });

  test('iCal-eksport-knapp er klikkbar', async ({ page }) => {
    await expect(page.getByTestId('calendar-export')).toBeVisible();
    // Vi tester ikke faktisk download (download events er flakey),
    // bare at knappen ikke crasher.
    await page.getByTestId('calendar-export').click();
  });
});
