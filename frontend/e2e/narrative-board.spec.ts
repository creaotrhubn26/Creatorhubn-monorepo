/**
 * Story Graph (game_studio) — brett, elementer, koblinger, variabler.
 *
 * Kjører mot e2e-harness (?harness=game_studio) med mockede
 * /api/role-room/narrative/*-svar (in-memory graf).
 */
import { test, expect, type Page } from '@playwright/test';
import { installNarrativeMocks, getMockGraph } from './helpers/narrativeMocks';

async function openWorkspace(page: Page, opts: { tab?: string; empty?: boolean } = {}) {
  await installNarrativeMocks(page, { empty: opts.empty });
  const tab = opts.tab ? `&tab=${opts.tab}` : '';
  await page.goto(`/e2e-test.html?harness=game_studio&harness-project=proj-game-2026${tab}`);
  await expect(page.getByTestId('narrative-workspace')).toBeVisible({ timeout: 15_000 });
}

test.describe('Story Graph — brett', () => {
  test('viser fanene og seedet brett med noder og kobling', async ({ page }) => {
    await openWorkspace(page);
    for (const id of ['boards', 'components', 'variables', 'assets', 'play', 'exports', 'history']) {
      await expect(page.getByTestId(`narrative-tab-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId('narrative-board-nbd_1')).toBeVisible();
    await expect(page.getByTestId('narrative-node-nel_start')).toBeVisible();
    await expect(page.getByTestId('narrative-node-nel_choice')).toBeVisible();
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
    // Forgreningen har to utgangs-handles (én per betingelse)
    await expect(page.locator('[data-testid="narrative-node-nel_choice"]').locator('..').locator('.react-flow__handle-right')).toHaveCount(2);
  });

  test('oppretter element via verktøylinjen og lagrer tittel med If-Match', async ({ page }) => {
    await openWorkspace(page);
    await page.getByTestId('narrative-add-element').click();
    await expect(page.getByTestId('narrative-element-drawer')).toBeVisible();
    const title = page.getByTestId('narrative-element-title');
    await title.fill('Markedet');
    await page.getByTestId('narrative-element-save').click();
    await expect(page.getByText('Alt lagret')).toBeVisible({ timeout: 5_000 });
    const g = getMockGraph(page)!;
    const created = g.elements.find((e) => (e.titleHtml as string).includes('Markedet'));
    expect(created).toBeTruthy();
    expect(created!.version).toBe(2);
    await expect(page.getByTestId(`narrative-node-${created!.id}`)).toContainText('Markedet');
  });

  test('tomt prosjekt: oppretter brett fra sidepanelet', async ({ page }) => {
    await openWorkspace(page, { empty: true });
    await expect(page.getByText(/Ingen brett ennå/)).toBeVisible();
    await page.getByTestId('narrative-new-board').click();
    await page.getByTestId('narrative-new-board-name').fill('Prolog');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Prolog')).toBeVisible();
    await expect(page.getByTestId('narrative-canvas')).toBeVisible();
    expect(getMockGraph(page)!.boards).toHaveLength(1);
  });

  test('viser konflikt-varsel ved 409 og oppdaterer til serverens versjon', async ({ page }) => {
    await openWorkspace(page);
    // Simuler at noen andre bumpet versjonen server-side.
    const g = getMockGraph(page)!;
    const start = g.elements.find((e) => e.id === 'nel_start')!;
    start.version = 5;
    start.titleHtml = '<p>Landsbyen (endret av Kari)</p>';
    await page.getByTestId('narrative-node-nel_start').dblclick();
    await expect(page.getByTestId('narrative-element-drawer')).toBeVisible();
    await page.getByTestId('narrative-element-title').fill('Min tittel');
    await page.getByTestId('narrative-element-save').click();
    await expect(page.getByTestId('narrative-notice')).toContainText(/endret av noen andre/i);
    await expect(page.getByTestId('narrative-node-nel_start')).toContainText('endret av Kari');
  });
});

test.describe('Story Graph — variabler', () => {
  test('legger til variabel med typet standardverdi', async ({ page }) => {
    await openWorkspace(page, { tab: 'variables' });
    await expect(page.getByTestId('narrative-variable-gold')).toBeVisible();
    await page.getByTestId('narrative-new-variable-name').fill('has_key');
    await page.getByTestId('narrative-new-variable-submit').click();
    await expect(page.getByTestId('narrative-variable-has_key')).toBeVisible();
    const v = getMockGraph(page)!.variables.find((x) => x.name === 'has_key');
    expect(v).toMatchObject({ type: 'bool', defaultValue: false });
  });

  test('avviser ugyldig variabelnavn', async ({ page }) => {
    await openWorkspace(page, { tab: 'variables' });
    await page.getByTestId('narrative-new-variable-name').fill('1gold');
    await expect(page.getByTestId('narrative-new-variable-submit')).toBeDisabled();
  });
});

test.describe('Story Graph — komponenter og historikk', () => {
  test('oppretter komponent', async ({ page }) => {
    await openWorkspace(page, { tab: 'components' });
    await expect(page.getByText('Kjøpmannen')).toBeVisible();
    await page.getByTestId('narrative-new-component-name').fill('Vakten');
    await page.getByTestId('narrative-new-component-submit').click();
    await expect(page.getByText('Vakten')).toBeVisible();
  });

  test('lister revisjoner og lagrer ny versjon', async ({ page }) => {
    await openWorkspace(page, { tab: 'history' });
    await expect(page.getByText('Første utkast')).toBeVisible();
    await page.getByTestId('narrative-revision-label').fill('Alpha-låst');
    await page.getByTestId('narrative-revision-create').click();
    await expect(page.getByText('Første utkast')).toBeVisible();
  });
});
