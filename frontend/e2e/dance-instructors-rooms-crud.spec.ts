/**
 * B2 — Instructors + switchDanceTab(page, "rooms") CRUD via EntityCrudPanel.
 *
 * Samme mønster som B1 — bare en annen tab.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';
import { getCallCount } from './helpers/danceMocks';

test.describe('dance — instructors CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "instructors");
  });

  test('viser 5 instruktører fra fixture', async ({ page }) => {
    await expect(page.locator('[data-testid^="crud-row-ins-"]')).toHaveCount(5);
  });

  test('opprett ny instruktør', async ({ page }) => {
    await page.getByTestId(/crud-new-/).click();
    await page.getByLabel(/Navn|Name/i).fill('Ny Lærer');
    await page.getByLabel(/E-?post|Email/i).fill('nylaerer@example.com');
    await page.getByTestId('crud-submit').click();

    await expect.poll(() =>
      getCallCount(page, 'POST /api/dance/studio/instructors'),
    ).toBe(1);
  });

  test('hourly rate validation — negativt tall blokkerer submit', async ({ page }) => {
    await page.getByTestId(/crud-new-/).click();
    await page.getByLabel(/Navn|Name/i).fill('Test Lærer');
    const rateField = page.getByLabel(/timepris|hourly|rate/i);
    if (await rateField.isVisible().catch(() => false)) {
      await rateField.fill('-100');
      const submit = page.getByTestId('crud-submit');
      await submit.click();
      // Enten disabled, eller alert vises, eller HTML5-validity blokkerer
      const stillOpen = await page.getByRole('dialog').isVisible().catch(() => false);
      expect(stillOpen).toBe(true);
    } else {
      test.skip(true, 'rate-felt ikke i UI ennå');
    }
  });
});

test.describe('dance — rooms CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "rooms");
  });

  test('viser 3 rom fra fixture', async ({ page }) => {
    await expect(page.locator('[data-testid^="crud-row-rm-"]')).toHaveCount(3);
  });

  test('capacity må være positivt tall', async ({ page }) => {
    await page.getByTestId(/crud-new-/).click();
    await page.getByLabel(/Navn|Name/i).fill('Test Studio');
    const capField = page.getByLabel(/Kapasitet|Capacity/i);
    if (await capField.isVisible().catch(() => false)) {
      await capField.fill('-5');
      await page.getByTestId('crud-submit').click();
      const stillOpen = await page.getByRole('dialog').isVisible().catch(() => false);
      expect(stillOpen).toBe(true);
    } else {
      test.skip(true, 'capacity-felt ikke i UI ennå');
    }
  });

  test('floorType-dropdown viser opsjoner', async ({ page }) => {
    await page.getByTestId(/crud-new-/).click();
    const floorField = page.getByLabel(/floortype|gulvtype|gulv/i);
    if (!(await floorField.isVisible().catch(() => false))) {
      test.skip(true, 'floorType-felt ikke i UI ennå');
      return;
    }
    await floorField.click();
    await expect(page.getByRole('option', { name: /marley|sprung-wood|concrete/i }).first()).toBeVisible();
  });
});
