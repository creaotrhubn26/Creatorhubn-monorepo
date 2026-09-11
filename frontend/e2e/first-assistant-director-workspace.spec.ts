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

test.describe('Innspillingsledelse · 1st AD', () => {
  test('åpner rolleflaten og sender arbeidsvalg til eksisterende produksjonsverktøy', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);

    await openCastingPlanner(page, { urlFlags: { seed: 'basic' } });
    await selectFirstProject(page);

    const launcher = page.getByTestId('first-ad-workspace-launcher');
    await expect(launcher).toBeVisible({ timeout: 15_000 });
    await launcher.getByRole('button', { name: 'Åpne 1st AD-visning' }).click();

    await expect(page.getByTestId('first-ad-workspace')).toBeVisible();
    await expect(page.getByText('Kun registrerte data')).toBeVisible();
    await expect(page.getByTestId('first-ad-surface-today')).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBe('assistant-direction');
    await expect.poll(() => new URL(page.url()).searchParams.get('surface')).toBe('today');

    await page.getByTestId('first-ad-surface-shooting-plan').click();
    await expect(page.locator('#tab-produksjonsplan')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => new URL(page.url()).searchParams.get('surface')).toBe('shooting-plan');

    await page.locator('#tab-oversikt').click();
    await expect(page.getByTestId('first-ad-workspace')).toBeVisible();
    await page.getByTestId('first-ad-open-full-workspace').click();
    await expect(page.getByTestId('first-ad-workspace-launcher')).toBeVisible();
    await expect(page.getByTestId('first-ad-workspace')).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
  });

  test('viser 1st AD-flaten automatisk og åpner stripboard og callsheet-flyten', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);

    await openCastingPlanner(page, {
      urlFlags: { seed: 'first-ad', session: 'first-ad' },
    });
    await selectFirstProject(page);

    await expect(page.getByTestId('first-ad-workspace')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('1ST AD · INNSPILLINGSLEDELSE')).toBeVisible();
    await expect(page.getByText('1 scene er ikke planlagt')).toBeVisible();
    await expect(page.getByText('1 tildelt crewmedlem er ikke bekreftet')).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBe('assistant-direction');
    await expect(page.getByTestId('director-workspace-launcher')).toHaveCount(0);
    await expect(page.getByTestId('cinematographer-workspace-launcher')).toHaveCount(0);

    await page.getByTestId('first-ad-surface-stripboard').click();
    await expect(page.locator('#tab-story-arc-studio')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('story-writer');
    await expect.poll(() => new URL(page.url()).searchParams.get('surface')).toBe('stripboard');
    await expect(page.getByTestId('pmv-stripboard-dialog')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Lukk stripboard' }).click();
    await expect(page.getByTestId('pmv-stripboard-dialog')).toBeHidden();
    await page.getByRole('button', { name: 'Lukk produksjonsmanus' }).click();
    await page.locator('#tab-oversikt').click();
    await expect(page.getByTestId('first-ad-workspace')).toBeVisible();
    await page.getByTestId('first-ad-surface-call-sheet').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('surface')).toBe('call-sheet');
    await expect(page.getByTestId('pmv-shooting-day-planner-dialog')).toBeVisible({ timeout: 20_000 });

    expect(runtimeErrors).toEqual([]);
  });

  test('gjenoppretter en direkte lenke til 1st AD-oversikten', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);

    await openCastingPlanner(page, {
      urlFlags: { seed: 'basic', lens: 'assistant-direction', surface: 'today' },
    });
    await selectFirstProject(page);

    await expect(page.getByTestId('first-ad-workspace')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('navigation', { name: '1st ADs arbeidsflater' })).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });

  test('@mobile holder dagsberedskap og navigasjon lesbart på telefon', async ({ page }) => {
    await openCastingPlanner(page, {
      urlFlags: { seed: 'first-ad', session: 'first-ad' },
    });
    await selectFirstProject(page);

    await expect(page.getByTestId('first-ad-workspace')).toBeVisible();
    await expect(page.getByTestId('first-ad-surface-nav')).toBeVisible();
    await expect(page.getByText('Dagens avklaringer')).toBeVisible();
    await expect(page.getByText('Opptaksberedskap')).toBeVisible();
    await expect(page.getByTestId('first-ad-open-full-workspace')).toBeVisible();
  });
});
