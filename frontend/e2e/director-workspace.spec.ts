import { expect, test } from '@playwright/test';
import { openCastingPlanner, selectFirstProject } from './helpers/role-room';

test.describe('Regissørrom', () => {
  test('åpner den rollebaserte oversikten og navigerer til eksisterende produksjonsflater', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (/TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(text)) {
        runtimeErrors.push(text);
      }
    });

    await openCastingPlanner(page, { urlFlags: { seed: 'basic' } });
    await selectFirstProject(page);

    const launcher = page.getByTestId('director-workspace-launcher');
    await expect(launcher).toBeVisible({ timeout: 15_000 });
    await launcher.getByRole('button', { name: 'Åpne regissørvisning' }).click();

    await expect(page.getByTestId('director-workspace')).toBeVisible();
    await expect(page.getByText('Ingen AI-antakelser')).toBeVisible();
    await expect(page.getByTestId('director-surface-today')).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBe('director');
    await expect.poll(() => new URL(page.url()).searchParams.get('surface')).toBe('today');

    await page.getByTestId('director-surface-visual-plan').click();
    await expect(page.locator('#tab-storyboard')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => new URL(page.url()).searchParams.get('surface')).toBe('visual-plan');

    await page.locator('#tab-oversikt').click();
    await expect(page.getByTestId('director-workspace')).toBeVisible();
    await page.getByTestId('director-open-full-workspace').click();
    await expect(page.getByTestId('director-workspace-launcher')).toBeVisible();
    await expect(page.getByTestId('director-workspace')).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
  });
});
