import { stat } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { openCastingPlanner } from './helpers/role-room';

const DEMO_PROJECT_NAME = 'Northwind Drilling - Sikker start';

/**
 * Sprint A.6: Migrert til felles helper. Bruker session=content-producer
 * URL-flag som spec-en alltid trenger.
 */
async function openRoleRoom(page: Page) {
  await openCastingPlanner(page, {
    urlFlags: { session: 'content-producer' },
  });
}

async function dismissOnboardingIfPresent(page: Page) {
  const onboardingDialog = page.locator('[role="dialog"]').filter({
    hasText: /Velkommen, Fotograf|Hva er The Role Room/i,
  });
  const closeButton = page.getByRole('button', { name: /Lukk onboarding/i });

  await onboardingDialog.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);

  if (await closeButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await closeButton.click();
    await expect(onboardingDialog).toBeHidden({ timeout: 10_000 });
  }
}

async function selectProject(page: Page, projectName: string) {
  const projectNamePattern = new RegExp(projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (
    await page.getByText(projectNamePattern).first().waitFor({ state: 'visible', timeout: 10_000 }).then(
      () => true,
      () => false,
    )
  ) {
    return;
  }

  const projectSelectorButton = page.getByRole('button', { name: /Alle prosjekter/i }).first();
  await projectSelectorButton.click();

  const projectDialog = page.locator('[role="dialog"]').filter({ hasText: /prosjekter|project/i }).first();
  await expect(projectDialog).toBeVisible({ timeout: 10_000 });

  const searchField = projectDialog.getByPlaceholder(/Søk på prosjektnavn, ID eller klient/i);
  await searchField.fill(projectName);

  const projectOption = projectDialog.getByText(projectNamePattern).first();
  await expect(projectOption).toBeVisible({ timeout: 10_000 });
  await projectOption.click();

  await expect(projectDialog).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText(projectNamePattern).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('text=/Bytter prosjekt og laster tilgang for workspace/i')).toBeHidden({
    timeout: 15_000,
  });
}

async function openShotListWorkspace(page: Page) {
  const storyArcTab = page.locator('#tab-story-arc-studio');
  await storyArcTab.scrollIntoViewIfNeeded({ timeout: 5_000 });
  await storyArcTab.click();

  const shotListCard = page.getByText(/Role Room planlegging og progresjon per scene/i).first();
  await expect(shotListCard).toBeVisible({ timeout: 10_000 });
  await shotListCard.click();

  await expect(page.getByText(/PRO-VISNING/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Shot List|Shotlist/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('legacy-shotlist-coverage-cp-shotlist-2')).toBeVisible({ timeout: 20_000 });
}

test.describe('Shotlist storyboard bridge', () => {
  test.beforeEach(async ({ page }) => {
    await openRoleRoom(page);
    await dismissOnboardingIfPresent(page);
    await selectProject(page, DEMO_PROJECT_NAME);
    await openShotListWorkspace(page);
  });

  test('coverage renders and linked frame edits can resync back to the shot list', async ({ page }) => {
    const coverage = page.getByTestId('legacy-shotlist-coverage-cp-shotlist-2');
    await expect(coverage).toContainText('2/3 frames brukt');
    await expect(coverage).toContainText('1 mangler shot');
    await expect(coverage).toContainText('1 shots uten storyboard');
    await expect(coverage).toContainText('Mangler: 2C');

    const trainingCard = coverage.locator('xpath=ancestor::article[1]');
    await trainingCard.getByRole('button', { name: /Vis 3 shots/i }).click();

    const descriptionField = page.getByTestId('legacy-shot-description-cp-shot-2A');
    const originalDescription = await descriptionField.inputValue();
    expect(originalDescription.trim().length).toBeGreaterThan(0);

    await page.getByTestId('legacy-shot-open-frame-cp-shot-2A').click();
    await expect(page.getByTestId('scene-storyboard-dialog')).toBeVisible();
    await expect(page.getByTestId('scene-storyboard-active-frame-card')).toBeVisible();

    await page.getByTestId('scene-storyboard-active-edit-button').click();
    const nextDescription = `${originalDescription} · oppdatert fra storyboard E2E`;
    await page.getByTestId('scene-storyboard-edit-description').fill(nextDescription);
    await page.getByTestId('scene-storyboard-edit-save').click();
    await expect(page.getByTestId('scene-storyboard-edit-dialog')).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(/Storyboard lagret|shot oppdatert/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId('scene-storyboard-dialog').getByRole('button', { name: /^Lukk$/i }).click();

    await page.getByTestId('legacy-shot-resync-cp-shot-2A').click();
    await expect(page.getByTestId('legacy-shot-description-cp-shot-2A')).toHaveValue(nextDescription);
  });

  test('coverage actions can open the first missing storyboard frame directly', async ({ page }) => {
    await page.getByTestId('legacy-shotlist-open-missing-frame-cp-shotlist-2').click();
    await expect(page.getByTestId('scene-storyboard-dialog')).toBeVisible();
    await expect(page.getByTestId('scene-storyboard-active-frame-card')).toContainText('Shot 2C');
    await page.getByTestId('scene-storyboard-dialog').getByRole('button', { name: /^Lukk$/i }).click();
  });

  test('scene exports support board pdf, contact sheet, and shot deck', async ({ page }, testInfo) => {
    await page.getByTestId('legacy-shotlist-export-trigger-cp-shotlist-2').click();
    await expect(page.getByTestId('legacy-shotlist-export-dialog')).toBeVisible();

    const [boardDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('legacy-shotlist-export-board-scene').click(),
    ]);
    expect(boardDownload.suggestedFilename()).toContain('-board.pdf');
    const boardPath = testInfo.outputPath(boardDownload.suggestedFilename());
    await boardDownload.saveAs(boardPath);
    expect((await stat(boardPath)).size).toBeGreaterThan(10_000);

    await page.getByTestId('legacy-shotlist-export-trigger-cp-shotlist-2').click();
    const [contactDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('legacy-shotlist-export-contact-scene').click(),
    ]);
    expect(contactDownload.suggestedFilename()).toContain('-contact-sheet.pdf');
    const contactPath = testInfo.outputPath(contactDownload.suggestedFilename());
    await contactDownload.saveAs(contactPath);
    expect((await stat(contactPath)).size).toBeGreaterThan(8_000);

    await page.getByTestId('legacy-shotlist-export-trigger-cp-shotlist-2').click();
    const [deckDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('legacy-shotlist-export-deck-scene').click(),
    ]);
    expect(deckDownload.suggestedFilename()).toContain('-shot-deck.pdf');
    const deckPath = testInfo.outputPath(deckDownload.suggestedFilename());
    await deckDownload.saveAs(deckPath);
    expect((await stat(deckPath)).size).toBeGreaterThan(8_000);
  });

  test('scene exports support clean still bundles', async ({ page }, testInfo) => {
    await page.getByTestId('legacy-shotlist-export-trigger-cp-shotlist-2').click();
    await expect(page.getByTestId('legacy-shotlist-export-dialog')).toBeVisible();

    const [stillDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('legacy-shotlist-export-stills-scene').click(),
    ]);
    expect(stillDownload.suggestedFilename()).toContain('-clean-stills.zip');
    const stillPath = testInfo.outputPath(stillDownload.suggestedFilename());
    await stillDownload.saveAs(stillPath);
    expect((await stat(stillPath)).size).toBeGreaterThan(10_000);
  });
});
