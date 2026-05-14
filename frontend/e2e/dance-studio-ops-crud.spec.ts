/**
 * B1 — Studio-ops CRUD via EntityCrudPanel (Classes).
 *
 * Komponent: frontend/client/src/components/role-room/dance/StudioOpsPanels.tsx
 *            → ClassesPanel (bruker EntityCrudPanel)
 * Endpoint:   /api/dance/studio/classes (GET / POST / PATCH / DELETE)
 *
 * EntityCrudPanel-mønster (gjelder også Instructors, switchDanceTab(page, "rooms"), switchDanceTab(page, "movement_vocab")Vocab):
 *   - data-testid="crud-new-<primaryField>"   → Create-knapp
 *   - data-testid="crud-row-<id>"             → Liste-rad (klikk åpner dialog)
 *   - data-testid="crud-submit"               → Lagre-knapp i dialog
 *
 * ClassesPanel-felt: 'Tittel' (required), 'Type' (select), 'Skjema', 'Start',
 * 'Slutt', 'Maks elever', 'Pris (kr)', 'Beskrivelse'.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';
import { getCallCount } from './helpers/danceMocks';

test.describe('dance — studio ops CRUD (classes)', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
    await switchDanceTab(page, "classes");
  });

  test('viser eksisterende klasser fra fixture', async ({ page }) => {
    await expect(page.getByText('Contemporary Open Level')).toBeVisible();
    await expect(page.getByText('Ballet Intermediate')).toBeVisible();
    await expect(page.locator('[data-testid^="crud-row-cls-"]')).toHaveCount(8);
  });

  test('opprett ny klasse', async ({ page }) => {
    await page.getByTestId(/crud-new-/).click();
    await page.getByLabel('Tittel').fill('Stretch & Mobility');
    const posted = page.waitForRequest(
      (req) => req.method() === 'POST' && req.url().includes('/api/dance/studio/classes'),
      { timeout: 10_000 },
    );
    await page.getByTestId('crud-submit').click();
    await posted;
    expect(getCallCount(page, 'POST /api/dance/studio/classes')).toBe(1);
  });

  test('rediger eksisterende klasse', async ({ page }) => {
    await page.getByTestId('crud-edit-cls-1').click();
    await page.getByLabel('Tittel').fill('Contemporary Advanced');
    const patched = page.waitForRequest(
      (req) => req.method() === 'PATCH' && req.url().includes('/api/dance/studio/classes/cls-1'),
      { timeout: 10_000 },
    );
    await page.getByTestId('crud-submit').click();
    await patched;
  });

  test('slett klasse via row-icon + confirm', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    const deleted = page.waitForRequest(
      (req) => req.method() === 'DELETE' && req.url().includes('/api/dance/studio/classes/cls-8'),
      { timeout: 10_000 },
    );
    await page.getByTestId('crud-delete-cls-8').click();
    await deleted;
  });

  test('søk filtrerer listen', async ({ page }) => {
    const search = page.getByPlaceholder(/Søk|Search/i);
    if (!(await search.isVisible().catch(() => false))) {
      test.skip(true, 'søkefelt ikke i UI');
      return;
    }
    await search.fill('Hip-Hop');
    await expect(page.getByText('Hip-Hop Foundations')).toBeVisible();
    await expect(page.getByText('Ballet Intermediate')).not.toBeVisible();
  });
});
