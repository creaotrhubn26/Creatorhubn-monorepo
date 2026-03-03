import { expect, test, type Page } from '@playwright/test';

const TEST_PAGE = '/e2e-casting-test.html';

function trackMaxUpdateDepthWarnings(page: Page): string[] {
  const warnings: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Maximum update depth exceeded/i.test(text)) {
      warnings.push(text);
    }
  });
  page.on('pageerror', (error) => {
    const text = String(error?.message ?? error);
    if (/Maximum update depth exceeded/i.test(text)) {
      warnings.push(text);
    }
  });
  return warnings;
}

function suppressBrowserDialogs(page: Page): void {
  page.on('dialog', (dialog) => {
    void dialog.dismiss().catch(() => undefined);
  });
}

async function dismissStartupDialogs(page: Page): Promise<void> {
  const professionDialog = page
    .locator('[role="dialog"]')
    .filter({ hasText: /velg din rolle|velg rolle|profesjon/i })
    .first();

  if (await professionDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
    const pickButton = professionDialog.locator('button').filter({ hasText: /admin|foto|video|felles/i }).first();
    if (await pickButton.isVisible({ timeout: 1500 }).catch(() => false)) {
      await pickButton.click({ force: true });
      await page.waitForTimeout(500);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  }

  const projectDialog = page
    .locator('[role="dialog"]')
    .filter({ hasText: /prosjekt/i })
    .first();

  if (await projectDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
    const projectEntry = projectDialog.locator('p,div,button').filter({ hasText: /troll|prosjekt|project/i }).first();
    if (await projectEntry.isVisible({ timeout: 1500 }).catch(() => false)) {
      await projectEntry.click({ force: true });
      await page.waitForTimeout(500);
    }
    if (await projectDialog.isVisible({ timeout: 700 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  }

  for (let index = 0; index < 3; index += 1) {
    const anyDialog = page.locator('[role="dialog"]').first();
    if (await anyDialog.isVisible({ timeout: 400 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
    }
  }
}

async function closeBlockingDialogs(page: Page, attempts = 5): Promise<void> {
  for (let index = 0; index < attempts; index += 1) {
    const openDialog = page.locator('[role="dialog"]').first();
    const visible = await openDialog.isVisible({ timeout: 300 }).catch(() => false);
    if (!visible) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}

async function ensureProjectSelected(page: Page): Promise<void> {
  const noProjectText = page.locator('text=/Ingen prosjekt valgt|Velg et prosjekt/i').first();
  const needsSelection = await noProjectText.isVisible({ timeout: 2000 }).catch(() => false);
  if (!needsSelection) return;

  const projectCard = page.locator('p,div,button').filter({ hasText: /^TROLL$/i }).first();
  if (await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await projectCard.click({ force: true });
    await page.waitForTimeout(700);
  }
}

async function openTechnicalDashboardFromCrew(page: Page): Promise<void> {
  await closeBlockingDialogs(page);
  const teamCandidates = [
    page.locator('#tab-team').first(),
    page.getByRole('tab', { name: /Team fane|Team/i }).first(),
    page.getByRole('button', { name: /^Team$/i }).first(),
    page.locator('button, [role="button"], a').filter({ hasText: /^Team$/i }).first(),
  ];
  let resolvedTeamTab = teamCandidates[0];
  for (const candidate of teamCandidates) {
    if (await candidate.isVisible({ timeout: 1200 }).catch(() => false)) {
      resolvedTeamTab = candidate;
      break;
    }
  }
  await expect(resolvedTeamTab).toBeVisible({ timeout: 15_000 });
  await resolvedTeamTab.click({ force: true });
  await page.waitForTimeout(1200);
  await ensureProjectSelected(page);
  await closeBlockingDialogs(page);
  await resolvedTeamTab.click({ force: true });
  await page.waitForTimeout(800);

  const technicalDashboardButton = page.getByRole('button', { name: /Teknisk.*dashboard/i }).first();
  await expect(technicalDashboardButton).toBeVisible({ timeout: 15_000 });
  await technicalDashboardButton.click({ force: true });
}

test.describe('Crew -> Team Dashboard technical flow', () => {
  test('opens technical Team Dashboard from Crew tab and lands in Shot List', async ({ page }) => {
    test.slow();
    suppressBrowserDialogs(page);
    const maxDepthWarnings = trackMaxUpdateDepthWarnings(page);

    await page.goto(TEST_PAGE, { waitUntil: 'load', timeout: 60_000 });
    await dismissStartupDialogs(page);
    await ensureProjectSelected(page);

    await openTechnicalDashboardFromCrew(page);

    const shotListTab = page.locator('#tab-shot-lists');
    if ((await shotListTab.count()) > 0) {
      await expect(shotListTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    } else {
      await expect(page.getByRole('tab', { name: /Bildeliste fane|Shot Lists|Bildeliste/i }).first()).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    }

    await expect(page.locator('text=Team Dashboard').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=/Teknisk/i').first()).toBeVisible({ timeout: 10_000 });

    const openCallsheetButton = page
      .getByRole('button', { name: /Callsheet|Call Sheet/i })
      .first();
    await expect(openCallsheetButton).toBeVisible({ timeout: 10_000 });
    await openCallsheetButton.click({ force: true });

    await expect(page.getByRole('button', { name: /Send callsheet/i }).first()).toBeVisible({ timeout: 10_000 });

    const segmentToggleShortcut = process.platform === 'darwin' ? 'Meta+Shift+S' : 'Control+Shift+S';
    await page.keyboard.press(segmentToggleShortcut);
    await page.waitForTimeout(600);

    await expect(page.locator('text=/Alle team|Teknisk/i').first()).toBeVisible({ timeout: 10_000 });
    expect(maxDepthWarnings, 'No maximum update depth warnings should occur during flow').toEqual([]);
  });

  test('saves and reloads snapshot that restores technical segment', async ({ page }) => {
    test.slow();
    suppressBrowserDialogs(page);
    const maxDepthWarnings = trackMaxUpdateDepthWarnings(page);

    await page.goto(TEST_PAGE, { waitUntil: 'load', timeout: 60_000 });
    await dismissStartupDialogs(page);
    await ensureProjectSelected(page);
    await openTechnicalDashboardFromCrew(page);

    await expect(page.locator('text=Team Dashboard').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=/Teknisk/i').first()).toBeVisible({ timeout: 10_000 });

    const snapshotName = `E2E Snapshot ${Date.now()}`;

    await page.getByRole('button', { name: /Lagre snapshot/i }).first().click({ force: true });
    const snapshotDialog = page.getByRole('dialog').filter({ hasText: /Dashboard snapshots/i }).first();
    await expect(snapshotDialog).toBeVisible({ timeout: 10_000 });
    await snapshotDialog.getByRole('textbox').first().fill(snapshotName);
    await snapshotDialog.getByRole('button', { name: /Lagre snapshot nå|Lagre/i }).first().click({ force: true });
    await page.waitForTimeout(900);

    const segmentToggleShortcut = process.platform === 'darwin' ? 'Meta+Shift+S' : 'Control+Shift+S';
    await page.keyboard.press(segmentToggleShortcut);
    await page.waitForTimeout(600);
    await expect(page.locator('text=/Alle team/i').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Lagre snapshot/i }).first().click({ force: true });
    await expect(snapshotDialog).toBeVisible({ timeout: 10_000 });
    const loadSnapshotCombobox = snapshotDialog.locator('[role="combobox"]').first();
    await loadSnapshotCombobox.click({ force: true });
    await page.getByRole('option', { name: snapshotName }).click({ force: true });
    await page.waitForTimeout(700);

    await expect(page.locator('text=/Teknisk/i').first()).toBeVisible({ timeout: 10_000 });
    expect(maxDepthWarnings, 'No maximum update depth warnings should occur during snapshot reload').toEqual([]);
  });
});
