import { test, expect, type Page } from '@playwright/test';

// ────────────────────────────────────────────────────────────
// E2E: Casting Call Poster — sjekker hele flyten i isolasjon
//   1) Panel åpner med pre-fylt data
//   2) Live preview rendrer alle felter
//   3) Variant-bytte (standard → minimal → quote_first) påvirker preview
//   4) Edit i felter oppdaterer preview live
//   5) "Last ned PNG" trigger en download
//   6) Tom source rendrer uten å krasje
// ────────────────────────────────────────────────────────────

const HARNESS = '/e2e-casting-call.html';

async function gotoHarness(page: Page, query = '') {
  const url = query ? `${HARNESS}?${query}` : HARNESS;
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await expect(page.getByTestId('harness-title')).toBeVisible({ timeout: 30_000 });
}

test.describe('Casting Call Poster — E2E', () => {
  test('panel åpner med pre-fylte felter fra source', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`${err.message}\n${err.stack ?? ''}`));

    await gotoHarness(page);

    // Modal er åpen (DialogTitle "Del som casting call")
    await expect(page.getByText('Del som casting call').first()).toBeVisible();

    // Pre-fylt rolle-navn
    const roleField = page.getByLabel('Rolle-navn (lilla headline)');
    await expect(roleField).toHaveValue('Lead Actor (Male)');

    // Pre-fylt sitat
    const quoteField = page.getByLabel(/Sitat \(vises i quote-blokk\)/);
    await expect(quoteField).toContainText(/karakterdrevet drama/);

    // CTA-tekst default
    await expect(page.getByLabel('CTA-tekst')).toHaveValue('Apply now');

    // Apply-URL er satt
    await expect(page.getByLabel('Apply-URL')).toHaveValue(/\/r\/e2e-role-1$/);

    // Ingen JS-feil under mount
    expect(errors).toEqual([]);
  });

  test('live preview viser rolle-navn fra source', async ({ page }) => {
    await gotoHarness(page);
    // Preview-blokken inneholder roller-navnet i toppen (siden den er pure
    // markup vil teksten dukke opp i DOM-treet selv om CSS-styling skjules
    // bak gradient).
    const previewArea = page.locator('[role="dialog"]').first();
    await expect(previewArea).toContainText('Lead Actor (Male)');
    await expect(previewArea).toContainText('CASTING CALL');
    await expect(previewArea).toContainText('THE ROLE ROOM');
  });

  test('variant-bytte oppdaterer preview live', async ({ page }) => {
    await gotoHarness(page);

    // Default = Standard (chip skal være highlighted). Vi sjekker at MINIMAL-
    // varianten skjuler stats-grid og sitat.
    await page.getByRole('button', { name: 'Minimal' }).click();

    // Stats-blokken har ikoner/labels — etter minimal-skift skal "PRODUKSJON"
    // ikke lenger være synlig i preview. Vi sjekker via dialog-scope.
    const dialog = page.locator('[role="dialog"]').first();
    // Etiketten "PRODUKSJON" rendres som uppercase i poster-rendrer; vi venter
    // litt på re-render og sjekker antall "PRODUKSJON"-tekstforekomster.
    await page.waitForTimeout(150);
    const occurrences = await dialog.getByText('PRODUKSJON', { exact: true }).count();
    expect(occurrences).toBe(0);

    // Bytte til Sitat-først skal vise PRODUKSJON igjen (kompakt grid)
    await page.getByRole('button', { name: 'Sitat-først' }).click();
    await expect(dialog.getByText('PRODUKSJON', { exact: true }).first()).toBeVisible({ timeout: 5000 });
  });

  test('editing rolle-navn-feltet oppdaterer preview', async ({ page }) => {
    await gotoHarness(page);

    const roleField = page.getByLabel('Rolle-navn (lilla headline)');
    await roleField.fill('Birgitte Hjort Sørensen');

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toContainText('Birgitte Hjort Sørensen');
  });

  test('"Last ned PNG"-knapp er enablet og clickable', async ({ page }) => {
    await gotoHarness(page);
    const downloadBtn = page.getByRole('button', { name: /Last ned PNG/i });
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toBeEnabled();
  });

  test('PNG-eksport trigger en download', async ({ page }) => {
    await gotoHarness(page);

    // html2canvas kan ta noen sekunder; vent på en download-event
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: /Last ned PNG/i }).click();

    const download = await downloadPromise;
    // Filnavnet inkluderer slug-en av rolle-navnet
    expect(download.suggestedFilename()).toMatch(/^casting-call-lead-actor-male\.png$/);
  });

  test('tom source — panel rendrer uten å krasje, men eksport blokkeres ikke', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await gotoHarness(page, 'empty=true');
    await expect(page.getByText('Del som casting call').first()).toBeVisible();

    // Roller-navn-feltet skal være tomt
    const roleField = page.getByLabel('Rolle-navn (lilla headline)');
    await expect(roleField).toHaveValue('');

    // Preview rendrer fortsatt (badge + tagline er hardkodet defaults)
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toContainText('CASTING CALL');
    await expect(dialog).toContainText('THE ROLE ROOM');

    expect(errors).toEqual([]);
  });

  test('"Kopier delelink" gir feil-melding når Apply-URL er tom', async ({ page }) => {
    await gotoHarness(page);

    // Tøm apply-URL-feltet
    const applyField = page.getByLabel('Apply-URL');
    await applyField.fill('');

    await page.getByRole('button', { name: /Kopier delelink/i }).click();

    // Alert om at URL må settes — fra DialogContent inside the modal
    await expect(page.getByText(/Sett en Apply-URL/i)).toBeVisible();
  });
});
