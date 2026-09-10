import { expect, test, type Locator, type Page } from '@playwright/test';

const TEST_PAGE = '/e2e-manuscript-toolbar-test.html';
const runtimeErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) ?? []).toEqual([]);
});

async function openToolbar(page: Page) {
  await page.goto(TEST_PAGE, { waitUntil: 'load' });
  await expect(page.getByTestId('manuscript-toolbar')).toBeVisible();
  await expect(page.getByTestId('manuscript-back-to-list')).toBeVisible();
}

async function expectSameActionRow(controls: Locator[]) {
  const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
  expect(boxes.every(Boolean)).toBe(true);
  const top = boxes[0]!.y;
  for (const box of boxes.slice(1)) {
    expect(Math.abs(box!.y - top)).toBeLessThanOrEqual(2);
  }
}

test('keeps the editing toolbar compact and groups secondary actions', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openToolbar(page);

  const toolbar = page.getByTestId('manuscript-toolbar');
  await expect(toolbar.getByText('Troll – opptaksmanus med et langt arbeidsnavn')).toBeVisible();
  await expect(toolbar.getByText('Utkast', { exact: true })).toBeVisible();
  await expect(toolbar.getByText('Mål 90 min')).toBeVisible();
  await expect(toolbar.getByText(/Auto Breakdown På|Eksporter JSON|Nytt manuskript/i)).toHaveCount(0);

  const breakdown = toolbar.locator('button').filter({ hasText: /^Breakdown$/ }).first();
  const save = toolbar.getByTestId('manuscript-save-status');
  const approval = toolbar.getByRole('button', { name: 'Send til godkjenning' });
  const more = toolbar.getByRole('button', { name: 'Flere manusverktøy' });
  await expectSameActionRow([breakdown, save, approval, more]);

  const toolbarBox = await toolbar.boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(toolbarBox!.height).toBeLessThanOrEqual(72);

  await more.click();
  const moreMenu = page.getByRole('menu', { name: 'Flere manusverktøy' });
  await expect(moreMenu.getByText('Eksporter Fountain')).toBeVisible();
  await expect(moreMenu.getByText('Eksporter FDX')).toBeVisible();
  await expect(moreMenu.getByText('Eksporter prosjektdata')).toBeVisible();
  await expect(moreMenu.getByText('Mål-lengde: 90 min')).toBeVisible();

  await page.keyboard.press('Escape');
  await toolbar.getByTestId('manuscript-back-to-list').click();
  await expect(toolbar.getByRole('button', { name: 'Importer' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Maler' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Nytt manuskript' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Breakdown', exact: true })).toHaveCount(0);
});

test('keeps mobile actions on one deliberate row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openToolbar(page);

  const toolbar = page.getByTestId('manuscript-toolbar');
  const breakdown = toolbar.locator('button').filter({ hasText: /^Breakdown$/ }).first();
  const save = toolbar.getByTestId('manuscript-save-status');
  const approval = toolbar.getByRole('button', { name: 'Godkjenning' });
  const more = toolbar.getByRole('button', { name: 'Flere manusverktøy' });
  await expectSameActionRow([breakdown, save, approval, more]);

  await toolbar.getByRole('button', { name: 'Innstillinger for breakdown' }).click();
  const breakdownMenu = page.getByRole('menu', { name: 'Innstillinger for breakdown' });
  await expect(breakdownMenu).toContainText('Breakdown er aktivert');
  await breakdownMenu.getByText('Breakdown er aktivert').click();
  await expect(breakdown).toBeDisabled();
});
