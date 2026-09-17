/**
 * Story Graph Fase 7b — skall + hjem: sidebar-navigasjon, hjem som standard,
 * ⌘K-palett, innboks-bjelle, mobil-drawer og KPI-navigasjon.
 */
import { expect, test, type Page } from '@playwright/test';
import { installNarrativeMocks } from './helpers/narrativeMocks';

async function openShell(page: Page, opts: { tab?: string; seed?: 'default' | 'what-follows-us' } = {}) {
  await installNarrativeMocks(page, { seed: opts.seed ?? 'what-follows-us' });
  const tab = opts.tab ? `&tab=${opts.tab}` : '';
  await page.goto(`/e2e-test.html?harness=game_studio&harness-project=proj-game-2026${tab}`);
  await expect(page.getByTestId('narrative-workspace')).toBeVisible({ timeout: 15_000 });
}

test.describe('Story Graph — skall og hjem', () => {
  test('hjem er standard landing og viser KPI-er fra det ekte prosjektet', async ({ page }) => {
    await openShell(page);
    await expect(page.getByTestId('narrative-tab-home')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('narrative-home-title')).toContainText('What Follows Us');
    await expect(page.getByTestId('narrative-home-kpi-scenes')).toContainText('34');
    await expect(page.getByTestId('narrative-home-kpi-gates')).toBeVisible();
    await expect(page.getByTestId('narrative-home-episode-E01')).toBeVisible();
    await expect(page.getByTestId('narrative-home-milestones')).toContainText('M1-varmtest');
  });

  test('sidebar har alle fanene med testids, seksjoner, og navigerer', async ({ page }) => {
    await openShell(page);
    for (const id of ['home', 'story', 'scenes', 'characters', 'locations', 'platform', 'boards', 'plan', 'play', 'exports', 'assets', 'history', 'team', 'pricing', 'billing']) {
      await expect(page.getByTestId(`narrative-tab-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId('narrative-sidebar-section-core')).toBeVisible();
    await expect(page.getByTestId('narrative-sidebar-section-production')).toBeVisible();
    await page.getByTestId('narrative-tab-scenes').click();
    await expect(page.getByTestId('narrative-tab-scenes')).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/tab=scenes/);
    await expect(page.getByTestId('narrative-scene-row-nsc_p01')).toBeVisible();
  });

  test('KPI-kort navigerer til Scener', async ({ page }) => {
    await openShell(page);
    await page.getByTestId('narrative-home-kpi-scenes').click();
    await expect(page.getByTestId('narrative-tab-scenes')).toHaveAttribute('aria-selected', 'true');
  });

  test('⌘K åpner paletten og hopper til Scener', async ({ page }) => {
    await openShell(page);
    await page.keyboard.press('Meta+k');
    const input = page.getByRole('textbox').last();
    await expect(input).toBeVisible();
    await input.fill('Scener');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('narrative-tab-scenes')).toHaveAttribute('aria-selected', 'true');
  });

  test('bjellen viser uleste fra innboksen og «marker alle lest» nullstiller', async ({ page }) => {
    await openShell(page);
    const bell = page.getByTestId('narrative-inbox-bell');
    await expect(bell).toHaveAttribute('data-unread', '1');
    await bell.click();
    await expect(page.getByTestId('narrative-inbox-item-ntf_1')).toHaveAttribute('data-read', 'false');
    await page.getByTestId('narrative-inbox-read-all').click();
    await expect(page.getByTestId('narrative-inbox-item-ntf_1')).toHaveAttribute('data-read', 'true');
    await page.keyboard.press('Escape');
    await expect(bell).toHaveAttribute('data-unread', '0');
  });

  test('tomt prosjekt viser første-gangs-hero med CTA', async ({ page }) => {
    await openShell(page, { seed: 'default' });
    await expect(page.getByTestId('narrative-home-empty')).toBeVisible();
    await page.getByTestId('narrative-home-cta-scene').click();
    await expect(page.getByTestId('narrative-tab-scenes')).toHaveAttribute('aria-selected', 'true');
  });

  test('mobil: sidebar ligger i drawer bak hamburger', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 800 });
    await openShell(page);
    await expect(page.getByTestId('narrative-sidebar')).toHaveCount(0);
    await page.getByTestId('narrative-shell-menu').click();
    await expect(page.getByTestId('narrative-tab-story')).toBeVisible();
    await page.getByTestId('narrative-tab-story').click();
    await expect(page).toHaveURL(/tab=story/);
  });
});
