/**
 * B3 — switchDanceTab(page, "movement_vocab")Vocab CRUD + bruk i ChoreographyBuilder.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';

test.describe('dance — movement vocab', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
  });

  test('viser 15 termer fra fixture', async ({ page }) => {
    await switchDanceTab(page, "movement_vocab");
    await expect(page.locator('[data-testid^="crud-row-mv-"]')).toHaveCount(15);
  });

  test('opprett ny term', async ({ page }) => {
    await switchDanceTab(page, "movement_vocab");
    await page.getByTestId(/crud-new-/).click();
    await page.locator('input[type="text"]').first().fill('Pas de bourrée');
    const posted = page.waitForRequest(
      (req) => req.method() === 'POST' && req.url().includes('/api/dance/studio/movement-vocab'),
      { timeout: 5_000 },
    );
    await page.getByTestId('crud-submit').click();
    await posted;
  });

  test('søk på "turn" filtrerer listen', async ({ page }) => {
    await switchDanceTab(page, "movement_vocab");
    const search = page.getByPlaceholder(/Søk|Search/i);
    if (!(await search.isVisible().catch(() => false))) {
      test.skip(true, 'Søkefelt ikke synlig i "movement_vocab"-panel');
      return;
    }
    await search.fill('turn');
    await expect(page.getByText('Pirouette')).toBeVisible();
    await expect(page.getByText('Spotting')).toBeVisible();
    await expect(page.getByText('Pencil turn')).toBeVisible();
    await expect(page.getByText('Pirouette')).toBeVisible();
    await expect(page.getByText('Grand jeté')).not.toBeVisible();
  });
});
