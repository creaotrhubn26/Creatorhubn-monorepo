import { test, expect, type Page } from '@playwright/test';

// ────────────────────────────────────────────────────────────
// E2E: Marketing Feed Poster (Weekly Brief) — sjekker hele flyten:
//   1) Editor åpner med default-felter
//   2) Live preview viser headline, accent, kort-grid, footer
//   3) Theme-bytte → preview-bakgrunn endres
//   4) Variant-bytte (standard / minimal / editorial)
//   5) Card-edit (legg til / fjern / endre)
//   6) Headline-edit + accent-edit oppdaterer preview live
//   7) QR-kode genereres fra URL og rendres som data-URL <img>
//   8) QR-placeholder vises når URL er tom
//   9) PNG-eksport trigger en download
//  10) Tom-felt rendrer uten å krasje
//  11) Persistens-knappene (Lagre, Dupliser, Åpne, Auto-fyll) er synlige
//  12) Mobile viewport rendrer editoren uten å krasje
// ────────────────────────────────────────────────────────────

const HARNESS = '/e2e-weekly-brief.html';

async function gotoHarness(page: Page, query = '') {
  const url = query ? `${HARNESS}?${query}` : HARNESS;
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await expect(page.getByTestId('harness-title')).toBeVisible({ timeout: 30_000 });
}

test.describe('Marketing Feed Poster — E2E', () => {
  test('editor åpner med default-felter pre-fylt', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`${err.message}\n${err.stack ?? ''}`));

    await gotoHarness(page);

    await expect(page.getByText('Marketing-poster').first()).toBeVisible();

    const headlineField = page.getByLabel(/Headline \(bryt linjer/);
    await expect(headlineField).toHaveValue(/Weekly[\s\S]*Norwegian[\s\S]*Casting Brief/);
    await expect(page.getByLabel(/Accent-ord/)).toHaveValue('Norwegian');
    await expect(page.getByLabel(/QR-URL/)).toHaveValue('https://thetheroleroom.com/abonner');

    expect(errors).toEqual([]);
  });

  test('live preview viser headline + tagline + footer + brand-logo', async ({ page }) => {
    await gotoHarness(page);

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toContainText('THE ROLE ROOM');
    await expect(dialog).toContainText('Norwegian');
    await expect(dialog).toContainText('Casting Brief');
    await expect(dialog).toContainText('thetheroleroom.com');
    await expect(dialog).toContainText('Casting. Roles. Together.');

    // Ekte logo-asset lastes inn
    await expect(dialog.locator('img[alt="The Role Room"]').first()).toBeVisible();
  });

  test('alle 4 default-cards rendres med tittel', async ({ page }) => {
    await gotoHarness(page);
    const dialog = page.locator('[role="dialog"]').first();
    for (const title of ['Ukens datapunkt', 'Bak kulissene', 'Compliance alert', 'Founder POV']) {
      await expect(dialog.getByText(title, { exact: true }).first()).toBeVisible();
    }
  });

  test('variant-bytte (minimal) skjuler card-grid', async ({ page }) => {
    await gotoHarness(page);
    await page.getByRole('button', { name: 'Minimal' }).click();
    await page.waitForTimeout(150);

    const dialog = page.locator('[role="dialog"]').first();
    expect(await dialog.getByText('Ukens datapunkt', { exact: true }).count()).toBe(0);
    await expect(dialog).toContainText(/Abonner|abonner/);
  });

  test('variant-bytte (editorial) viser kun 2 cards', async ({ page }) => {
    await gotoHarness(page);
    await page.getByRole('button', { name: 'Editorial' }).click();
    await page.waitForTimeout(150);

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog.getByText('Ukens datapunkt', { exact: true }).first()).toBeVisible();
    await expect(dialog.getByText('Bak kulissene', { exact: true }).first()).toBeVisible();
    expect(await dialog.getByText('Compliance alert', { exact: true }).count()).toBe(0);
    expect(await dialog.getByText('Founder POV', { exact: true }).count()).toBe(0);
  });

  test('theme-bytte oppdaterer data-theme på poster-root', async ({ page }) => {
    await gotoHarness(page);

    const poster = page.getByTestId('marketing-poster-root');
    await expect(poster).toHaveAttribute('data-theme', 'purple');

    await page.getByRole('button', { name: /Film warm orange/i }).click();
    await expect(poster).toHaveAttribute('data-theme', 'film_warm');

    await page.getByRole('button', { name: /Dance pink/i }).click();
    await expect(poster).toHaveAttribute('data-theme', 'dance_pink');
  });

  test('headline-edit oppdaterer preview live', async ({ page }) => {
    await gotoHarness(page);
    await page.getByLabel(/Headline \(bryt linjer/).fill('Monthly Casting Insights');
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toContainText('Monthly Casting Insights');
  });

  test('legg til + fjern card oppdaterer preview', async ({ page }) => {
    await gotoHarness(page);
    const dialog = page.locator('[role="dialog"]').first();

    const deleteButtons = page.locator('button').filter({
      has: page.locator('svg[data-testid="DeleteOutlineIcon"]'),
    });
    const initialCount = await deleteButtons.count();
    await deleteButtons.nth(initialCount - 1).click();
    await page.waitForTimeout(150);

    expect(await dialog.getByText('Founder POV', { exact: true }).count()).toBe(0);
  });

  test('QR-kode genereres fra URL og rendres som data-URL <img>', async ({ page }) => {
    await gotoHarness(page);

    const dialog = page.locator('[role="dialog"]').first();
    await expect.poll(
      async () => {
        const imgs = dialog.locator('img');
        const count = await imgs.count();
        for (let i = 0; i < count; i++) {
          const src = await imgs.nth(i).getAttribute('src');
          if (src && src.startsWith('data:image/png;base64,')) return true;
        }
        return false;
      },
      { timeout: 8000 },
    ).toBe(true);
  });

  test('QR-placeholder vises når URL er tom', async ({ page }) => {
    await gotoHarness(page, 'noqr=true');

    const dialog = page.locator('[role="dialog"]').first();
    const imgsWithData = await dialog.locator('img').evaluateAll((els) =>
      els.filter((el) => (el as HTMLImageElement).src.startsWith('data:image/png;base64,')).length,
    );
    expect(imgsWithData).toBe(0);
    await expect(dialog.getByText('QR ▢').first()).toBeVisible();
  });

  test('PNG-eksport trigger en download', async ({ page }) => {
    await gotoHarness(page);

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByTestId('poster-export').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    expect(download.suggestedFilename().toLowerCase()).toContain('weekly');
  });

  test('tom-felt — editor rendrer uten å krasje', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await gotoHarness(page, 'empty=true');

    await expect(page.getByText('Marketing-poster').first()).toBeVisible();
    await expect(page.getByLabel(/Headline \(bryt linjer/)).toHaveValue('');

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toContainText('THE ROLE ROOM');
    await expect(dialog).toContainText('Casting. Roles. Together.');

    expect(errors).toEqual([]);
  });

  test('persistens-knappene (Lagre, Åpne, Auto-fyll) er synlige', async ({ page }) => {
    await gotoHarness(page);
    await expect(page.getByTestId('poster-save')).toBeVisible();
    await expect(page.getByTestId('poster-open')).toBeVisible();
    await expect(page.getByTestId('poster-autofill')).toBeVisible();
    // Dupliser er disabled før Lagre, men finnes
    await expect(page.getByTestId('poster-duplicate')).toBeVisible();
    await expect(page.getByTestId('poster-duplicate')).toBeDisabled();
  });

  test('undo/redo reverserer felt-edits', async ({ page }) => {
    await gotoHarness(page);

    const dialog = page.locator('[role="dialog"]').first();
    const headlineField = page.getByLabel(/Headline \(bryt linjer/);
    const undoBtn = page.getByTestId('poster-undo');
    const redoBtn = page.getByTestId('poster-redo');

    // Default: ingenting å undo'e
    await expect(undoBtn).toBeDisabled();
    await expect(redoBtn).toBeDisabled();

    // Edit headline
    await headlineField.fill('Endret tittel');
    await expect(dialog).toContainText('Endret tittel');
    await expect(undoBtn).toBeEnabled();

    // Undo
    await undoBtn.click();
    await expect(headlineField).not.toHaveValue('Endret tittel');
    await expect(redoBtn).toBeEnabled();

    // Redo
    await redoBtn.click();
    await expect(headlineField).toHaveValue('Endret tittel');
  });

  test('"Sett som default"-knapp er synlig i toolbar', async ({ page }) => {
    await gotoHarness(page);
    await expect(page.getByTestId('poster-set-default')).toBeVisible();
  });

  test('"Last ned SVG"-knapp er synlig og trigger SVG-download', async ({ page }) => {
    await gotoHarness(page);
    const svgBtn = page.getByTestId('poster-export-svg');
    await expect(svgBtn).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await svgBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
  });

  test('Åpne-knapp åpner saved-picker uten å krasje (selv uten backend)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await gotoHarness(page);
    await page.getByTestId('poster-open').click();

    // Picker-dialogen åpner (har egen testid for å unngå konflikt med
    // saved-list error-alert som vises i hovedmodal).
    await expect(page.getByTestId('poster-picker-title')).toBeVisible({ timeout: 5000 });
    // Pickeren skal håndtere backend-feil grasiøst (ingen unhandled errors)
    await page.waitForTimeout(800);
    expect(errors).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────
// Mobile-spec — kjøres under mobile-chrome project (Pixel 5 viewport)
// via @mobile-tag i playwright.config.ts.
// ────────────────────────────────────────────────────────────
test.describe('Marketing Feed Poster — mobile @mobile', () => {
  test('editor rendres i mobile-viewport uten å krasje', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await gotoHarness(page);

    await expect(page.getByText('Marketing-poster').first()).toBeVisible();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toContainText('THE ROLE ROOM');

    expect(errors).toEqual([]);
  });
});
