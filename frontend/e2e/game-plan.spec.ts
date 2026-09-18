/**
 * Story Graph Fase 7d — produksjonsplan: Gantt per bane, i-dag-markør, zoom,
 * popover-redigering, liste med sortering, «Uten dato», ny milepæl, Solo-gate.
 */
import { expect, test, type Page } from '@playwright/test';
import { installNarrativeMocks, type MockGamePlanSlug } from './helpers/narrativeMocks';

async function open(page: Page, gamePlan: MockGamePlanSlug = 'studio') {
  await installNarrativeMocks(page, { seed: 'what-follows-us', gamePlan });
  await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=plan');
  await expect(page.getByTestId('narrative-plan')).toBeVisible({ timeout: 15_000 });
}

test.describe('Story Graph — produksjonsplan', () => {
  test('Gantt viser baner fra det ekte prosjektet, i-dag-markør og uten-dato-gruppe', async ({ page }) => {
    await open(page);
    // Fixturen har ingen datoer ennå → alt ligger under «Uten dato».
    await expect(page.getByTestId('narrative-plan-undated')).toContainText('M1-varmtest');
    await expect(page.getByTestId('narrative-plan-gantt')).toHaveCount(0);
    // Sett frist på en milepæl uten dato → den flytter inn i Gantt-banen «Teknikk».
    await page.getByTestId('narrative-plan-undated').getByText('M1-varmtest', { exact: false }).first().click();
    await page.getByTestId('narrative-plan-pop-due').fill('2026-10-15');
    await page.getByTestId('narrative-plan-pop-due').blur();
    await expect(page.getByTestId('narrative-plan-lane-engineering')).toBeVisible();
    await page.mouse.click(4, 4); // lukk popover via backdrop
    await expect(page.getByTestId('narrative-plan-lane-engineering')).toBeVisible();
    await expect(page.getByTestId('narrative-plan-lane-engineering').getByTestId('narrative-plan-today')).toBeVisible();
    await page.getByTestId('narrative-plan-zoom-week').click();
    await expect(page.getByTestId('narrative-plan-gantt')).toContainText('U');
  });

  test('Ny milepæl havner i listen; status kan endres; sortering på status', async ({ page }) => {
    await open(page);
    await page.getByTestId('narrative-plan-new').click();
    await page.getByTestId('narrative-plan-new-title').fill('Første produksjonsprøve P03 på 8 GB-iPad');
    await page.getByTestId('narrative-plan-new-due').fill('2026-11-01');
    await page.getByTestId('narrative-plan-create').click();
    await expect(page.getByTestId('narrative-notice')).toContainText('Milepæl opprettet');
    await page.getByTestId('narrative-plan-view-list').click();
    const list = page.getByTestId('narrative-plan-list');
    await expect(list).toContainText('Første produksjonsprøve P03 på 8 GB-iPad');
    await page.getByTestId('narrative-plan-sort').click();
    await page.getByRole('option', { name: 'Sorter: status' }).click();
    await expect(list.locator('tbody tr').first()).toContainText('Blokkert');
  });

  test('Solo: planen er lesbar, men «Ny milepæl» er låst med banner', async ({ page }) => {
    await open(page, 'solo');
    await expect(page.getByTestId('narrative-plan-gate-production_plan')).toBeVisible();
    await expect(page.getByTestId('narrative-plan-new')).toBeDisabled();
    await expect(page.getByTestId('narrative-plan-new')).toHaveAttribute('data-locked', 'plan');
    await expect(page.getByTestId('narrative-plan-undated')).toContainText('M1-varmtest');
  });
});
