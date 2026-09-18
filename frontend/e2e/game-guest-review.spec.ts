/**
 * Story Graph Fase 7e-2 — gjeste-reviewere: Studio lager gjestelenke for en
 * åpen runde; gjest (uten konto) oppgir navn, ser frosset snapshot med manus
 * og replikker, kommenterer og godkjenner; view-lenke er lesetilgang; Solo låst.
 */
import { expect, test, type Page } from '@playwright/test';
import { installNarrativeMocks, type MockGamePlanSlug } from './helpers/narrativeMocks';

async function openReviewTab(page: Page, gamePlan: MockGamePlanSlug = 'studio') {
  await installNarrativeMocks(page, { seed: 'what-follows-us', gamePlan });
  await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=scenes&scene=nsc_p01&sceneTab=review');
  await expect(page.getByTestId('narrative-scene-review-status')).toBeVisible({ timeout: 15_000 });
}
async function openGuest(page: Page, token: string) {
  await installNarrativeMocks(page, { seed: 'what-follows-us', gamePlan: 'studio' });
  await page.goto(`/e2e-test.html?harness=story_review&harness-token=${token}`);
  await expect(page.getByTestId('story-review-page')).toBeVisible({ timeout: 15_000 });
}

test.describe('Story Graph — gjeste-reviewere', () => {
  test('Studio: be om review → «Del med reviewer» → lenke /story-review/<token> vises én gang og listes', async ({ page }) => {
    await openReviewTab(page);
    await page.getByTestId('narrative-scene-review-request').click();
    await page.getByTestId('narrative-scene-review-submit').click();
    await expect(page.getByTestId('narrative-scene-review-status')).toHaveAttribute('data-status', 'in_review');
    await page.getByTestId('narrative-review-share-open').click();
    await page.getByTestId('narrative-review-share-create').click();
    const url = page.getByTestId('narrative-review-share-url');
    await expect(url).toHaveValue(/\/story-review\/nrl_e2e_comment_1$/);
    await expect(page.getByTestId('narrative-review-share-link-nrl_1').or(page.locator('[data-testid^="narrative-review-share-link-"]').first())).toBeVisible();
  });

  test('Solo: «Del med reviewer» er låst med banner', async ({ page }) => {
    await openReviewTab(page, 'solo');
    // Solo har ingen åpen runde (review er gated), så seksjonen vises ikke; bannere for scene_review vises.
    await expect(page.getByTestId('narrative-plan-gate-scene_review')).toBeVisible();
  });

  test('gjest: navn → snapshot med Før/Handling og W01.01 → kommentar → godkjenn → status approved', async ({ page }) => {
    await openGuest(page, 'nrl_e2e_approve');
    await expect(page.getByTestId('story-review-identity')).toBeVisible();
    await page.getByTestId('story-review-name').fill('Publisher-QA');
    await page.getByTestId('story-review-join').click();
    await expect(page.getByTestId('story-review-body')).toBeVisible();
    await expect(page.getByTestId('story-review-reviewer')).toContainText('Publisher-QA');
    await expect(page.getByTestId('story-review-field-beforeState')).toContainText('Bok hos Elise');
    await expect(page.getByTestId('story-review-line-W01.01')).toContainText('Must you read all the way home?');
    await expect(page.getByTestId('story-review-round')).toHaveAttribute('data-status', 'in_review');
    // Kommentar via PostCommentLayer (gjeste-auth)
    await page.getByPlaceholder('Skriv en kommentar til studioet…').fill('Lyden i P01 må ha Foley før vi går videre.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByText('Lyden i P01 må ha Foley før vi går videre.')).toBeVisible();
    await page.getByTestId('story-review-approve').click();
    await page.getByTestId('story-review-decision-note').fill('Godkjent fra publisher.');
    await page.getByTestId('story-review-decision-confirm').click();
    await expect(page.getByTestId('story-review-notice')).toContainText('godkjent');
    await expect(page.getByTestId('story-review-round')).toHaveAttribute('data-status', 'approved');
    await expect(page.getByTestId('story-review-approve')).toHaveCount(0);
  });

  test('gjest: view-lenke gir lesetilgang uten beslutningsknapper; ukjent token → melding', async ({ page }) => {
    await openGuest(page, 'nrl_e2e_view');
    await page.getByTestId('story-review-name').fill('Bare Ser');
    await page.getByTestId('story-review-join').click();
    await expect(page.getByTestId('story-review-body')).toBeVisible();
    await expect(page.getByTestId('story-review-approve')).toHaveCount(0);
    await expect(page.getByText('Lenken gir bare lesetilgang.')).toBeVisible();
    await page.goto('/e2e-test.html?harness=story_review&harness-token=nrl_ukjent');
    await expect(page.getByTestId('story-review-missing')).toBeVisible({ timeout: 15_000 });
  });
});
