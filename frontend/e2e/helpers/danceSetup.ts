/**
 * danceSetup — felles setup-mønster for alle dance-* specs.
 *
 * En typisk spec ser slik ut:
 *
 *   import { test } from '@playwright/test';
 *   import { setupDanceTest } from './helpers/danceSetup';
 *
 *   test('owner ser team-admin-tab', async ({ page }) => {
 *     await setupDanceTest(page);                  // mocks + nav + ready
 *     await page.getByRole('tab', { name: 'Team' }).click();
 *     // ...
 *   });
 *
 * Setup gjør:
 *  1. Installerer mocks (alle /api/dance/*)
 *  2. Navigerer til e2e-harness med ?harness=dance_studio
 *  3. Venter på at workspace er ferdig mounted
 *
 * Bruker harness — det går mye raskere enn å drive login + project-creation
 * modal i hver spec. For specs som EKSPLISITT skal teste login/project-
 * creation-flowet, ikke bruk denne — driv den vanlige Vite-appen i stedet.
 */
import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { installDanceMocks, type DanceMockOptions } from './danceMocks';

export interface SetupOptions extends DanceMockOptions {
  /** dance_studio (default) eller dance_freelance */
  mode?: 'dance_studio' | 'dance_freelance';
  /** Hvilken tab som skal være åpen ved start. Default: dashboard. */
  initialTab?: string;
  /** Override projectId — default proj-spring-2026 */
  projectId?: string;
  /** Hopp over default-navigasjon; spec gjør sin egen page.goto */
  skipNavigate?: boolean;
}

export async function setupDanceTest(page: Page, opts: SetupOptions = {}): Promise<void> {
  await installDanceMocks(page, opts);

  if (opts.skipNavigate) return;

  const mode = opts.mode ?? 'dance_studio';
  const projectId = opts.projectId ?? 'proj-spring-2026';
  const tabSuffix = opts.initialTab ? `&tab=${opts.initialTab}` : '';
  await page.goto(`/e2e-test.html?harness=${mode}&harness-project=${projectId}${tabSuffix}`);

  // Vent på at workspace-roten er mounted. Vi unngår å vente på spesifikke
  // text-strenger fordi labels endrer seg ofte.
  await expect(page.getByTestId('e2e-harness-root')).toBeVisible({ timeout: 15_000 });
}

/**
 * Hopp til en spesifikk tab i DanceWorkspace.
 *
 * Bruker `data-testid="dance-tab-<id>"` som primær matcher — stabil mot
 * label-endringer. Fallback til getByRole/text-matching hvis kalleren
 * passerer en RegExp.
 */
export async function switchDanceTab(page: Page, tabLabel: string | RegExp): Promise<void> {
  const tab = typeof tabLabel === 'string' && !/[\W]/.test(tabLabel)
    ? page.getByTestId(`dance-tab-${tabLabel}`)
    : page.getByRole('tab', { name: tabLabel });
  await tab.click();
  // Vent på at den nye tab-en er aktiv. MUI setter aria-selected=true.
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
}

/**
 * Eksplisitt id-basert tab-bytter. Tryggere enn label-matching.
 */
export async function switchDanceTabById(page: Page, tabId: string): Promise<void> {
  const tab = page.getByTestId(`dance-tab-${tabId}`);
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
}

/**
 * Vent på at et spesifikt API-kall blir gjort. Brukes i stedet for
 * page.waitForTimeout(N) — sammen med call-counter.
 */
export async function waitForDanceRequest(
  page: Page,
  method: string,
  pathRegex: RegExp,
  timeout = 10_000,
): Promise<void> {
  await page.waitForRequest(
    (req) => req.method() === method && pathRegex.test(new URL(req.url()).pathname),
    { timeout },
  );
}

/**
 * Hent danser-portrett URL slik specs slipper å duplisere prefiks.
 */
export function dancerPortrait(filename: string): string {
  return `/__fixtures/dance/portraits/${filename}`;
}

/**
 * Hjelper for å hente en synlig portretts-img-locator. Bruk i a11y-test
 * og visuell-regresjon.
 */
export function portraitLocator(page: Page, filename: string): Locator {
  return page.locator(`img[src*="${filename}"]`);
}
