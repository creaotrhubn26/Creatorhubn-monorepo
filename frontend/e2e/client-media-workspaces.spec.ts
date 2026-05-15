import { expect, test, type Page } from '@playwright/test';
import { openCastingPlanner } from './helpers/role-room';

/** Sprint A.6+A.7: Migrert til felles helper. seed=basic gir et demo-prosjekt
 * fra harness så `selectProject` har data å treffe. */
async function openRoleRoom(page: Page) {
  await openCastingPlanner(page, {
    urlFlags: { session: 'content-producer', seed: 'producer-demo' },
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
    await page.getByText(projectNamePattern).first().waitFor({ state: 'visible', timeout: 4_000 }).then(
      () => true,
      () => false,
    )
  ) {
    return;
  }

  const projectChip = page.locator('[data-testid="role-room-active-project"]').first();
  if (await projectChip.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await projectChip.click();
  } else {
    const fallbackButton = page
      .getByRole('button', { name: /Prosjekter|Velg aktivt prosjekt/i })
      .first();
    await fallbackButton.click();
  }

  const projectDialog = page.locator('[role="dialog"]').filter({ hasText: /prosjekt|project/i }).first();
  await expect(projectDialog).toBeVisible({ timeout: 10_000 });

  const searchField = projectDialog.getByPlaceholder(/Søk på prosjektnavn, ID eller klient/i);
  await searchField.fill(projectName);

  const projectRow = projectDialog
    .locator('[data-testid="role-room-project-modal-row"]')
    .filter({ hasText: projectNamePattern })
    .first();
  await expect(projectRow).toBeVisible({ timeout: 10_000 });
  await projectRow.getByRole('button', { name: /^Åpne$|^Åpent$/ }).click();

  await expect(projectDialog).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText(projectNamePattern).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('text=/Bytter prosjekt og laster tilgang for workspace/i')).toBeHidden({
    timeout: 15_000,
  });
}

async function openProducerMediaWorkspace(page: Page) {
  await page.getByRole('tab', { name: /^Prosjektrom$/i }).click();
  await expect(page.getByTestId('producer-media-page-brief')).toBeVisible({ timeout: 20_000 });
}

const DEMO_PROJECT_NAME = 'Northwind Drilling - Sikker start';

test.describe('Client media workspaces', () => {
  test.beforeEach(async ({ page }) => {
    await openRoleRoom(page);
    await dismissOnboardingIfPresent(page);
    await selectProject(page, DEMO_PROJECT_NAME);
    await openProducerMediaWorkspace(page);
  });

  test('storyboard inspirations, manuscript suggestions, and shotlist overview are available', async ({ page }) => {
    await page.getByTestId('producer-media-page-storyboard').click();
    const storyboardWorkspace = page.getByTestId('producer-media-storyboard-workspace');
    await expect(storyboardWorkspace).toBeVisible();
    await storyboardWorkspace.getByTestId('producer-media-storyboard-title-input').fill('Noir warehouse light reference');
    await storyboardWorkspace
      .getByTestId('producer-media-storyboard-note-input')
      .fill('Sterkere lysstråler, våtere gulv og mer negativ space rundt figurene.');
    const saveStoryboardButton = storyboardWorkspace.getByTestId('producer-media-storyboard-save-inspiration');
    await saveStoryboardButton.click();
    await expect(saveStoryboardButton).toContainText('Lagre inspirasjon', { timeout: 20_000 });
    await expect(storyboardWorkspace).toContainText('Noir warehouse light reference', { timeout: 20_000 });

    await page.getByTestId('producer-media-page-manuscript').click();
    const manuscriptWorkspace = page.getByTestId('producer-media-manuscript-workspace');
    await expect(manuscriptWorkspace).toBeVisible();
    await manuscriptWorkspace.getByTestId('producer-media-manuscript-title-input').fill('Strammere replikk');
    await manuscriptWorkspace
      .getByTestId('producer-media-manuscript-suggestion-input')
      .fill('Kort ned replikkvekslingen og la informasjonen komme tidligere i scenen.');
    await manuscriptWorkspace
      .getByTestId('producer-media-manuscript-rationale-input')
      .fill('Det vil gjøre scenen tydeligere og raskere å lese for klient og regissør.');
    const saveManuscriptButton = manuscriptWorkspace.getByTestId('producer-media-manuscript-save-suggestion');
    await saveManuscriptButton.click();
    await expect(saveManuscriptButton).toContainText('Lagre forslag', { timeout: 20_000 });
    await expect(manuscriptWorkspace).toContainText('Strammere replikk', { timeout: 20_000 });

    await page.getByTestId('producer-media-page-shotlist').click();
    const shotlistWorkspace = page.getByTestId('producer-media-shotlist-workspace');
    await expect(shotlistWorkspace).toBeVisible();
    await expect(shotlistWorkspace.getByTestId('producer-media-shotlist-table')).toBeVisible();
    await expect(shotlistWorkspace).toContainText('Scene / klipp');
    await expect(shotlistWorkspace).toContainText('Sted');
    await expect(shotlistWorkspace).toContainText('Cast');
    await expect(shotlistWorkspace).toContainText('Beskrivelse');
  });
});
