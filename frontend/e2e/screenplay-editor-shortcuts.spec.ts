import { expect, test, type Page } from '@playwright/test';

const TEST_PAGE = '/e2e-screenplay-editor-test.html';
const runtimeErrors = new WeakMap<Page, string[]>();

test.describe('ScreenplayEditor keyboard element flow', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    runtimeErrors.set(page, errors);
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.route('**/api/settings**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(route.request().method() === 'GET' ? { data: null, entries: [] } : { success: true }),
      });
    });
    await page.goto(TEST_PAGE, { waitUntil: 'load' });
    await expect(page.locator('textarea')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    expect(runtimeErrors.get(page) ?? []).toEqual([]);
  });

  test('opens the element chooser on Enter at a blank line and selects by number', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.focus();
    await editor.evaluate((element: HTMLTextAreaElement) => {
      element.setSelectionRange(element.value.length, element.value.length);
      element.scrollTop = element.scrollHeight;
    });

    await editor.press('Enter');
    const menu = page.getByRole('menu', { name: 'Velg manuselement' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /^Character / })).toContainText('⌘/Ctrl+3');

    await page.keyboard.press('3');
    await expect(menu).toBeHidden();
    await editor.type('nora');
    await expect(editor).toHaveValue(/NORA$/);
  });

  test('reformats the current line with Cmd/Ctrl shortcuts', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.fill('museum');
    await editor.evaluate((element: HTMLTextAreaElement) => {
      element.setSelectionRange(element.value.length, element.value.length);
    });
    await editor.press('Control+1');
    await expect(editor).toHaveValue('INT. MUSEUM - DAY');
  });

  test('opens the same chooser with Tab on a blank line', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.focus();
    await editor.evaluate((element: HTMLTextAreaElement) => {
      element.setSelectionRange(element.value.length, element.value.length);
      element.scrollTop = element.scrollHeight;
    });

    await editor.press('Tab');
    await expect(page.getByRole('menu', { name: 'Velg manuselement' })).toBeVisible();
  });

  test('keeps SmartType suggestions visible at the caret in a long manuscript', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.focus();
    await editor.evaluate((element: HTMLTextAreaElement) => {
      element.setSelectionRange(element.value.length, element.value.length);
      element.scrollTop = element.scrollHeight;
    });
    await editor.type('I');

    const suggestion = page.getByRole('menuitem', { name: 'INT.' }).first();
    await expect(suggestion).toBeVisible();
    const box = await suggestion.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });
});
