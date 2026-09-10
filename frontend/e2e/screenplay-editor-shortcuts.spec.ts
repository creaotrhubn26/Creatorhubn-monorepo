import { expect, test, type Locator, type Page } from '@playwright/test';

const TEST_PAGE = '/e2e-screenplay-editor-test.html';
const runtimeErrors = new WeakMap<Page, string[]>();
const isMac = process.platform === 'darwin';
const primaryKey = isMac ? 'Meta' : 'Control';
const primaryLabel = isMac ? '⌘' : 'Ctrl+';
const primaryShortcut = (key: string) => `${primaryKey}+${key}`;

const setCaret = async (editor: Locator, position: number | 'end') => {
  await editor.evaluate((element: HTMLTextAreaElement, target) => {
    const offset = target === 'end' ? element.value.length : target;
    element.setSelectionRange(offset, offset);
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  }, position);
};

test.describe('ScreenplayEditor Final Draft keyboard flow', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    runtimeErrors.set(page, errors);
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.addInitScript(() => window.localStorage.clear());
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

  test('uses the first Enter for normal flow and the second Enter for the chooser', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.fill('Action line');
    await setCaret(editor, 'end');

    await editor.press('Enter');
    await expect(editor).toHaveValue('Action line\n');
    await expect(page.getByRole('menu', { name: 'Velg manuselement' })).toBeHidden();

    await editor.press('Enter');
    const menu = page.getByRole('menu', { name: 'Velg manuselement' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /^Character\./ })).toContainText(`${primaryLabel}3`);

    await page.keyboard.press('3');
    await expect(menu).toBeHidden();
    await editor.type('nora');
    await expect(editor).toHaveValue('Action line\nNORA');
  });

  test('Tab creates the alternative next paragraph without rewriting the current line', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.fill('Action stays exactly like this');
    await setCaret(editor, 'end');

    await editor.press('Tab');
    await expect(editor).toHaveValue('Action stays exactly like this\n\n');
    await editor.type('nora');
    await expect(editor).toHaveValue('Action stays exactly like this\n\nNORA');
  });

  test('Tab and Shift+Tab cycle element type on a blank line without inserting text', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.fill('');
    await editor.focus();

    await editor.press('Tab');
    await expect(editor).toHaveValue('');
    await expect(page.getByTestId('screenplay-keyboard-status')).toContainText('Character');

    await editor.press('Shift+Tab');
    await expect(editor).toHaveValue('');
    await expect(page.getByTestId('screenplay-keyboard-status')).toContainText('Action');
  });

  test('does not modify text when Tab is pressed inside a line or over a selection', async ({ page }) => {
    const editor = page.locator('textarea');
    const original = 'Never rewrite this sentence';
    await editor.fill(original);
    await setCaret(editor, 5);
    await editor.press('Tab');
    await expect(editor).toHaveValue(original);

    await editor.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 5));
    await editor.press('Tab');
    await expect(editor).toHaveValue(original);
  });

  test('shows context-sensitive Enter and Tab actions in the status bar', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.fill('NORA\nHei der');
    await setCaret(editor, 4);

    const status = page.getByTestId('screenplay-keyboard-status');
    await expect(status).toContainText('Character');
    await expect(status).toContainText('Enter: Dialogue');
    await expect(status).toContainText('Tab: Parenthetical');
    await expect(status).toContainText(`${primaryLabel}3: Character`);
  });

  test('shows all registered shortcuts while the primary modifier is held', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.focus();
    await page.keyboard.down(primaryKey);

    const status = page.getByTestId('screenplay-keyboard-status');
    await expect(status).toContainText(`${primaryLabel}0 General`);
    await expect(status).toContainText(`${primaryLabel}7 Shot`);
    await expect(status).toContainText(isMac ? '⌘⌃4 Note' : 'Ctrl+Shift+4 Note');

    await page.keyboard.up(primaryKey);
  });

  test('opens, filters and closes the chooser with slash without moving the caret', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.fill('Action\n');
    await setCaret(editor, 'end');
    const caretBefore = await editor.evaluate((element: HTMLTextAreaElement) => element.selectionStart);

    await editor.press('/');
    const menu = page.getByRole('menu', { name: 'Velg manuselement' });
    await expect(menu).toBeVisible();
    await page.keyboard.type('ch');
    await expect(menu.getByRole('menuitem', { name: /^Character\./ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /^Centered\./ })).toBeHidden();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect.poll(() => editor.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(caretBefore);
  });

  test('selects a filtered element with arrow keys and Enter', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.fill('Action\n');
    await setCaret(editor, 'end');

    await editor.press('/');
    const menu = page.getByRole('menu', { name: 'Velg manuselement' });
    await page.keyboard.type('ch');
    await expect(menu.getByRole('menuitem', { name: /^Character\./ })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(menu).toBeHidden();
    await expect(editor).toHaveValue('Action\n');
    await expect(page.getByTestId('screenplay-keyboard-status')).toContainText('Character');
  });

  test('supports General, Shot, Note and Dual Dialogue commands', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.fill('camera');
    await setCaret(editor, 'end');
    await editor.press(primaryShortcut('7'));
    await expect(editor).toHaveValue('SHOT: CAMERA');

    await editor.fill('NORA\nHei');
    await setCaret(editor, 4);
    await editor.press(isMac ? 'Meta+d' : 'Control+Alt+d');
    await expect(editor).toHaveValue('NORA ^\nHei');

    await editor.press(isMac ? 'Meta+d' : 'Control+Alt+d');
    await expect(editor).toHaveValue('NORA\nHei');

    await editor.fill('');
    await editor.focus();
    await editor.press(isMac ? 'Meta+Control+4' : 'Control+Shift+4');
    await expect(editor).toHaveValue('[[]]');
    await expect(page.getByTestId('screenplay-keyboard-status')).toContainText('Note');
  });

  test('makes a Tab paragraph command immediately undoable', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.fill('Keep me');
    await setCaret(editor, 'end');
    await editor.press('Tab');
    await expect(editor).toHaveValue('Keep me\n\n');

    await editor.press('Control+z');
    await expect(editor).toHaveValue('Keep me');
  });

  test('supports a persisted custom shortcut preset', async ({ page }) => {
    await page.getByRole('button', { name: 'Tilpass hurtigtaster for manuskript' }).click();
    const dialog = page.getByRole('dialog', { name: 'Hurtigtaster for manuskript' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Endre hurtigtast for Character' }).click();
    await page.keyboard.press(primaryShortcut('k'));
    await expect(dialog.getByRole('button', { name: 'Endre hurtigtast for Character' })).toContainText(`${primaryLabel}K`);
    await dialog.getByRole('button', { name: 'Lagre' }).click();
    await expect(dialog).toBeHidden();

    const editor = page.locator('textarea');
    await editor.fill('nora');
    await setCaret(editor, 'end');
    await editor.press(primaryShortcut('k'));
    await expect(editor).toHaveValue('NORA');
  });

  test('shows where character suggestions come from', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.fill('');
    await editor.focus();
    await editor.press(primaryShortcut('3'));

    const nora = page.getByRole('menuitem', { name: /^NORA/ });
    await expect(nora).toBeVisible();
    await expect(nora).toContainText('Rolle');
    const whyNora = page.getByLabel(/Hvorfor vises NORA\?/);
    await expect(whyNora).toBeVisible();
    await whyNora.click();
    await expect(editor).toHaveValue('');
    await expect(nora).toBeVisible();
    await expect(page.getByText(/Canon|Autel|Apple iPad/i)).toHaveCount(0);
  });

  test('previews and applies an undoable rename across exact Character lines', async ({ page }) => {
    const editor = page.locator('textarea');
    const original = 'INT. STUE - DAG\n\nBOB\nHei.\n\nBOB (V.O.)\nDer er du.';
    await editor.fill(original);
    await setCaret(editor, 20);

    await page.getByTestId('screenplay-character-rename-open').click();
    const dialog = page.getByRole('dialog', { name: 'Endre karakternavn i manuset' });
    await expect(dialog).toBeVisible();
    await dialog.getByTestId('character-rename-to').fill('ROBERT');
    await expect(dialog).toContainText('Forhåndsvisning · 2 forekomster');
    await dialog.getByTestId('character-rename-confirm').click();

    await expect(dialog).toBeHidden();
    await expect(editor).toHaveValue('INT. STUE - DAG\n\nROBERT\nHei.\n\nROBERT (V.O.)\nDer er du.');
    await editor.press('Control+z');
    await expect(editor).toHaveValue(original);
  });

  test('requires confirmation before a script-only character becomes a project character', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.fill('ZELDA\nHei');
    await setCaret(editor, 5);

    const confirmButton = page.getByRole('button', { name: 'Legg ZELDA til som prosjektkarakter' });
    await expect(confirmButton).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(confirmButton).toBeVisible();

    await confirmButton.click();
    await expect(confirmButton).toBeHidden();
  });

  test('does not claim a character was saved when project persistence rejects it', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.fill('FAILME\nHei');
    await setCaret(editor, 6);

    const confirmButton = page.getByRole('button', { name: 'Legg FAILME til som prosjektkarakter' });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    await expect(confirmButton).toBeVisible();
    await expect(page.getByText('FAILME kunne ikke legges til i prosjektet.')).toBeAttached();
  });

  test('separates local recovery from cloud sync and restores without losing current text', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.fill('Recovery original');
    const localStatus = page.getByTestId('screenplay-local-save-status');
    await expect(localStatus).toContainText('Lagret lokalt');
    await expect(page.getByTestId('screenplay-cloud-save-status')).toContainText('Synkronisert 12:00:00');

    await page.getByRole('button', { name: 'Åpne lokal gjenopprettingshistorikk' }).click();
    const dialog = page.getByRole('dialog', { name: 'Lokal gjenopprettingshistorikk' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Opprett punkt nå' }).click();
    await dialog.getByRole('button', { name: 'Lukk' }).click();

    await editor.fill('Changed after checkpoint');
    await expect(localStatus).toContainText('Lagret lokalt');
    await page.getByRole('button', { name: 'Åpne lokal gjenopprettingshistorikk' }).click();
    await dialog.getByRole('button', { name: /Manuelt punkt/ }).click();
    await expect(dialog.getByLabel('Forhåndsvisning av gjenopprettingspunkt')).toContainText('Recovery original');
    await dialog.getByRole('button', { name: 'Gjenopprett valgt' }).click();

    await expect(dialog).toBeHidden();
    await expect(editor).toHaveValue('Recovery original');
  });

  test('keeps SmartType suggestions visible at the caret in a long manuscript', async ({ page }) => {
    const editor = page.locator('textarea');
    await editor.focus();
    await setCaret(editor, 'end');
    await editor.type('I');

    const suggestion = page.getByRole('menuitem', { name: 'INT.' }).first();
    await expect(suggestion).toBeVisible();
    const box = await suggestion.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });
});
