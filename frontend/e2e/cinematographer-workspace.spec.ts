import { expect, test, type Page } from '@playwright/test';
import { openCastingPlanner, selectFirstProject } from './helpers/role-room';

function collectRuntimeErrors(page: Page): string[] {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error: Error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(text)) {
      runtimeErrors.push(text);
    }
  });
  return runtimeErrors;
}

test.describe('Filmfotografens rom', () => {
  test('åpner rolleflaten og sender valg til eksisterende prosjektverktøy', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);

    await openCastingPlanner(page, { urlFlags: { seed: 'basic' } });
    await selectFirstProject(page);

    const launcher = page.getByTestId('cinematographer-workspace-launcher');
    await expect(launcher).toBeVisible({ timeout: 15_000 });
    await launcher.getByRole('button', { name: 'Åpne filmfotografvisning' }).click();

    await expect(page.getByTestId('cinematographer-workspace')).toBeVisible();
    await expect(page.getByText('Kun registrerte data')).toBeVisible();
    await expect(page.getByTestId('cinematographer-surface-today')).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBe('cinematography');
    await expect.poll(() => new URL(page.url()).searchParams.get('surface')).toBe('today');

    await page.getByTestId('cinematographer-surface-shot-plan').click();
    await expect(page.locator('#tab-story-arc-studio')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('shot-list');
    await expect.poll(() => new URL(page.url()).searchParams.get('surface')).toBe('shot-plan');

    await page.locator('#tab-oversikt').click();
    await expect(page.getByTestId('cinematographer-workspace')).toBeVisible();
    await page.getByTestId('cinematographer-surface-camera-crew').click();
    await expect(page.locator('#tab-team')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => new URL(page.url()).searchParams.get('surface')).toBe('camera-crew');

    await page.locator('#tab-oversikt').click();
    await page.getByTestId('cinematographer-open-full-workspace').click();
    await expect(page.getByTestId('cinematographer-workspace-launcher')).toBeVisible();
    await expect(page.getByTestId('cinematographer-workspace')).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBeNull();

    expect(runtimeErrors).toEqual([]);
  });

  test('gjenoppretter en direkte lenke til filmfotografens oversikt', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);

    await openCastingPlanner(page, {
      urlFlags: { seed: 'basic', lens: 'cinematography', surface: 'today' },
    });
    await selectFirstProject(page);

    await expect(page.getByTestId('cinematographer-workspace')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('cinematographer-surface-today')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('navigation', { name: 'Filmfotografens arbeidsflater' })).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });

  test('viser filmfotografvisningen automatisk for en innlogget DoP', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);

    await openCastingPlanner(page, {
      urlFlags: { seed: 'cinematographer', session: 'cinematographer' },
    });
    await selectFirstProject(page);

    await expect(page.getByTestId('cinematographer-workspace')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('FILMFOTOGRAF · DoP')).toBeVisible();
    await expect(page.getByText('1 scene mangler registrerte shots')).toBeVisible();
    await expect(page.getByText('1 crewmedlem er ikke bekreftet')).toBeVisible();
    await expect(page.getByText('1/2', { exact: true })).toHaveCount(2);
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBe('cinematography');
    await expect(page.getByTestId('director-workspace-launcher')).toHaveCount(0);
    expect(runtimeErrors).toEqual([]);
  });

  test('@mobile holder navigasjon og status lesbart på telefon', async ({ page }) => {
    await openCastingPlanner(page, { urlFlags: { seed: 'basic' } });
    await selectFirstProject(page);
    await page.getByTestId('cinematographer-workspace-launcher')
      .getByRole('button', { name: 'Åpne filmfotografvisning' })
      .click();

    await expect(page.getByTestId('cinematographer-workspace')).toBeVisible();
    await expect(page.getByTestId('cinematographer-surface-nav')).toBeVisible();
    await expect(page.getByText('Tekniske avklaringer')).toBeVisible();
    await expect(page.getByText('Bildestatus')).toBeVisible();
    await expect(page.getByTestId('cinematographer-open-full-workspace')).toBeVisible();
  });
});
