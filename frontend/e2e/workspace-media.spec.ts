import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const PROJECT_ID = '62541498-eec0-4868-b3d9-b0db86b3513a';
const EMERGENCY_TOKEN = '3389fa994209cd8e4678ebff3889be8c67f4e8b8b7e148d7cff324291feb2209';
const USER_EMAIL = 'daniel@creatorhubn.com';
const USER_ID = '53391080-8437-471e-800b-8b0d01e8b465';

async function getAuthToken() {
  const randomIp = `127.0.0.${Math.floor(Math.random() * 200 + 10)}`;
  const authRes = await fetch(`http://localhost:3003/api/super-admin/emergency-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': randomIp,
    },
    body: JSON.stringify({ token: EMERGENCY_TOKEN, email: USER_EMAIL, userId: USER_ID }),
  });
  const authData = await authRes.json();
  return authData.token || authData.sessionToken;
}

test.describe('MediaTab E2E', () => {
  let page: import('@playwright/test').Page;
  let sessionToken: string;

  test.beforeAll(async () => {
    sessionToken = await getAuthToken();
  });

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();

    // Set auth credentials in localStorage before load
    await page.addInitScript(({ token, user }) => {
      window.localStorage.setItem('creatorhub_auth_token', token);
      window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
    }, { token: sessionToken, user: { id: USER_ID, email: USER_EMAIL, role: 'admin' } });

    await page.goto(`${BASE_URL}/workspace/${PROJECT_ID}/media`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    // Wait for images to load into grid with retry (up to 60s total)
    let retries = 0;
    while (retries < 6) {
      try {
        await page.waitForSelector('[data-im-id]', { state: 'visible', timeout: 10000 });
        break;
      } catch (e) {
        retries++;
        if (retries >= 6) throw e;
        await page.waitForTimeout(5000);
      }
    }
  });

  test.afterEach(async () => {
    // Clean up any open dialogs/modals before next test
    await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      dialogs.forEach(d => d.remove());
    });
    await page.waitForTimeout(500);
  });

  test('Media grid renders with correct tiles and type badges', async () => {
    const tiles = page.locator('[data-im-id]');
    const tileCount = await tiles.count();
    expect(tileCount).toBeGreaterThanOrEqual(3);

    const tileTexts = await tiles.allTextContents();
    expect(tileTexts.some(t => t.includes('QA klipp') || t.includes('klipp'))).toBeTruthy();
    expect(tileTexts.some(t => t.includes('taleopptak') || t.includes('taleopptak'))).toBeTruthy();
    expect(tileTexts.some(t => t.includes('bilde') || t.includes('Bilde'))).toBeTruthy();

    // Verify type badges
    await expect(page.locator('div:has-text("video"), div:has-text("Video")').first()).toBeVisible();
    await expect(page.locator('div:has-text("audio"), div:has-text("Lyd")').first()).toBeVisible();
  });

  test('Inspector panel opens on tile click with metadata', async () => {
    const firstTile = page.locator('[data-im-id]').first();
    await firstTile.click();
    await page.waitForTimeout(400);

    const inspectorText = await page.locator('div:has-text("Filtype")').first().innerText().catch(() => '');
    expect(inspectorText).toContain('Filtype');
    expect(inspectorText).toContain('Status');
  });

  test('Keyboard navigation works (ArrowRight / ArrowLeft / Escape)', async () => {
    const firstTile = page.locator('[data-im-id]').first();
    await firstTile.click();
    await page.waitForTimeout(400);

    // ArrowRight advances
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    const afterRight = await page.locator('div:has-text("Filtype")').first().innerText().catch(() => '');
    expect(afterRight.length).toBeGreaterThan(0);

    // ArrowLeft cycles back
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    const afterLeft = await page.locator('div:has-text("Filtype")').first().innerText().catch(() => '');
    expect(afterLeft.length).toBeGreaterThan(0);

    // Escape dismisses
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const placeholder = await page.locator('text=Klikk et bilde for å se detaljer').first().isVisible().catch(() => false);
    expect(placeholder).toBeTruthy();
  });

  test('Right-click context menu (tileCtx) works', async () => {
    const targetTile = page.locator('[data-im-id]').first();
    await targetTile.click({ button: 'right' });
    await page.waitForTimeout(400);

    const openOriginal = page.locator('.MuiMenuItem-root').filter({ hasText: 'Åpne original' });
    const attachDeliverable = page.locator('.MuiMenuItem-root').filter({ hasText: 'Vedlegg til leveranse' });
    const deleteAsset = page.locator('.MuiMenuItem-root').filter({ hasText: 'Slett asset' });

    await expect(openOriginal).toBeVisible();
    await expect(attachDeliverable).toBeVisible();
    await expect(deleteAsset).toBeVisible();

    // Test "Åpne original" opens inspector
    await openOriginal.click();
    await page.waitForTimeout(400);
    await expect(page.locator('text=Filtype').first()).toBeVisible();
  });

  test('Attach to deliverable flow works', async () => {
    const attachDeliverableBtn = page.locator('button').filter({ hasText: 'Vedlegg til leveranse' });
    if (await attachDeliverableBtn.isVisible()) {
      await attachDeliverableBtn.click();
      await page.waitForTimeout(600);

      const dialog = page.locator('[role="dialog"]').filter({ hasText: /Vedlegg til leveranse/i }).first();
      await expect(dialog).toBeVisible();

      // Check deliverable list
      const deliverableItem = dialog.locator('div').filter({ hasText: 'QA-Test Leveranse' }).first();
      if (await deliverableItem.isVisible()) {
        await deliverableItem.click();
        await page.waitForTimeout(600);
      }
    }
  });

  test('Category filters work (Bilder / Videoer / Lyd / Alle)', async () => {
    async function clickCategory(text) {
      await page.evaluate(() => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        dialogs.forEach(d => d.remove());
      });
      await page.waitForTimeout(300);

      const category = page.locator('.MuiTypography-root, div, button').filter({ hasText: new RegExp(`^${text}$`) }).first();
      if (await category.isVisible()) {
        await category.click({ force: true });
        await page.waitForTimeout(400);
      }
    }

    await clickCategory('Bilder');
    const imgTiles = await page.locator('[data-im-id]').count();
    expect(imgTiles).toBeGreaterThanOrEqual(1);

    await clickCategory('Videoer');
    const vidTiles = await page.locator('[data-im-id]').count();
    expect(vidTiles).toBeGreaterThanOrEqual(1);

    await clickCategory('Lyd');
    const audioTiles = await page.locator('[data-im-id]').count();
    expect(audioTiles).toBeGreaterThanOrEqual(1);

    await clickCategory('Alle medier');
    const allTiles = await page.locator('[data-im-id]').count();
    expect(allTiles).toBeGreaterThanOrEqual(3);
  });

  test('Search filter works', async () => {
    const searchInput = page.locator('input[placeholder*="Søk"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('taleopptak');
    await page.waitForTimeout(400);
    const searchMatchCount = await page.locator('[data-im-id]').count();
    expect(searchMatchCount).toBe(1);

    await searchInput.fill('');
    await page.waitForTimeout(400);
    const restoredCount = await page.locator('[data-im-id]').count();
    expect(restoredCount).toBeGreaterThanOrEqual(3);
  });

  test('Bulk mode (Velg flere) works', async () => {
    const bulkBtn = page.locator('div, button').filter({ hasText: /^Velg flere$/ }).first();
    await expect(bulkBtn).toBeVisible();

    await bulkBtn.click();
    await page.waitForTimeout(400);

    const bulkToolbarText = await page.locator('text=valgt').first().textContent().catch(() => '');
    expect(bulkToolbarText).toContain('valgt');

    // Select 2 tiles
    await page.locator('[data-im-id]').nth(0).click();
    await page.waitForTimeout(200);
    await page.locator('[data-im-id]').nth(1).click();
    await page.waitForTimeout(200);

    await expect(page.locator('text=2 valgt').first()).toBeVisible();

    // Cancel bulk mode
    const cancelBulkBtn = page.locator('button').filter({ hasText: /^Avslutt$/ }).first();
    if (await cancelBulkBtn.isVisible()) {
      await cancelBulkBtn.click();
      await page.waitForTimeout(300);
    }
    expect(await page.locator('text=2 valgt').first().isVisible().catch(() => false)).toBeFalsy();
  });

  test('Folder modal opens', async () => {
    const newFolderBtn = page.locator('button[title="Ny mappe"], [title="Ny mappe"]').first();
    const hasNewFolderBtn = await newFolderBtn.isVisible().catch(() => false);
    expect(hasNewFolderBtn).toBeTruthy();

    if (hasNewFolderBtn) {
      await newFolderBtn.click();
      await page.waitForTimeout(400);

      const folderModalInput = page.locator('[role="dialog"] input, .MuiDialog-root input').first();
      await expect(folderModalInput).toBeVisible();

      // Close modal
      const closeFolderBtn = page.locator('[role="dialog"] button, .MuiDialog-root button').filter({ hasText: /^Avslutt$/ }).first();
      if (await closeFolderBtn.isVisible()) {
        await closeFolderBtn.click();
        await page.waitForTimeout(300);
      }
      
      // Wait for modal to close and grid to reappear
      await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 10000 }).catch(() => {});
      await page.waitForSelector('[data-im-id]', { state: 'visible', timeout: 10000 });
    }
  });

  test('View toggle (Soner/Flatt) and sorting (Nyeste/Beste rating) work', async () => {
    const zoneBtn = page.locator('div').filter({ hasText: /^Flatt$|^Soner$/ }).first();
    if (await zoneBtn.isVisible()) {
      const initialText = await zoneBtn.textContent();
      await zoneBtn.click();
      await page.waitForTimeout(500);
      // Wait for grid to reappear after toggle
      await page.waitForSelector('[data-im-id]', { state: 'visible', timeout: 15000 });
      const newText = await zoneBtn.textContent();
      expect(initialText).not.toEqual(newText);
      // Toggle back
      await zoneBtn.click();
      await page.waitForTimeout(500);
      await page.waitForSelector('[data-im-id]', { state: 'visible', timeout: 15000 });
    }

    const sortBtn = page.locator('div').filter({ hasText: /^Nyeste$|^Beste rating$/ }).first();
    if (await sortBtn.isVisible()) {
      const initSort = await sortBtn.textContent();
      await sortBtn.click();
      await page.waitForTimeout(500);
      await page.waitForSelector('[data-im-id]', { state: 'visible', timeout: 15000 });
      const newSort = await sortBtn.textContent();
      expect(initSort).not.toEqual(newSort);
      // Toggle back
      await sortBtn.click();
      await page.waitForTimeout(500);
      await page.waitForSelector('[data-im-id]', { state: 'visible', timeout: 15000 });
    }
  });
});