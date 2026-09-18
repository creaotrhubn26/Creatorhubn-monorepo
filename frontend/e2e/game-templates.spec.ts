/**
 * Story Graph Fase 8g — «Start fra mal» på tomt prosjekt og Studio-gating av CI-hooks/spilltest-tokens.
 */
import { expect, test } from '@playwright/test';
import { installNarrativeMocks } from './helpers/narrativeMocks';

test.describe('Story Graph — maler og salgsklar gating (Fase 8g)', () => {
  test('tomt prosjekt → Start fra mal → Demo-eventyr → hjem viser KPI-er og scener finnes', async ({ page }) => {
    await installNarrativeMocks(page, { empty: true });
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=home');
    await expect(page.getByTestId('narrative-home-empty')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('narrative-home-cta-template').click();
    await expect(page.getByTestId('narrative-template-dialog')).toBeVisible();
    await expect(page.getByTestId('narrative-template-wfu-sample')).toContainText('uten replikker');
    await page.getByTestId('narrative-template-demo-adventure').click();
    await expect(page.getByTestId('narrative-home-template-notice')).toContainText('Mal «demo-adventure» lagt inn (6 rader)');
    await expect(page.getByTestId('narrative-home')).toBeVisible();
    await expect(page.getByTestId('narrative-home-kpi-scenes')).toContainText('3');
    await page.getByTestId('narrative-tab-scenes').click();
    await expect(page.locator('[data-testid^="narrative-scene-row-"]')).toHaveCount(3);
  });

  test('Studio: hooks og tokens kan opprettes; Pro: låst med banner', async ({ page }) => {
    await installNarrativeMocks(page, { seed: 'what-follows-us', gamePlan: 'pro' });
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=integrations');
    await expect(page.getByTestId('narrative-integrations-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('narrative-ci-hook-create')).toHaveAttribute('data-locked', 'plan');
    await expect(page.getByTestId('narrative-ci-hook-create')).toBeDisabled();
    await expect(page.getByTestId('narrative-playtest-token-create')).toHaveAttribute('data-locked', 'plan');
    await expect(page.getByTestId('narrative-plan-gate-ci_evidence')).toBeVisible();
    await expect(page.getByTestId('narrative-plan-gate-playtest_telemetry')).toBeVisible();
  });
});
